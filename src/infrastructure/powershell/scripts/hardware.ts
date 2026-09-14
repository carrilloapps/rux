import {emitResult} from '@/infrastructure/powershell/runner';
import {PS_HELPERS} from '@/infrastructure/powershell/scripts/helpers';

/**
 * Reads the Windows-side graphics configuration and the driver inventory.
 *
 * systeminformation covers adapters and displays well, but three things it
 * cannot see are decisive here: the registry switches that change rendering
 * behaviour, Device Manager problem codes, and the real display mode. The last
 * one matters because systeminformation reports the DPI-scaled desktop size,
 * so a 1920x1080 panel at 125% scaling looks like 1536x864 and would be
 * mistaken for a misconfigured resolution.
 */
export const INSPECT_SYSTEM_SCRIPT = `
${PS_HELPERS}

function Get-RuxRegistryValue {
    param([string] $Path, [string] $Name)
    $item = Get-ItemProperty -LiteralPath $Path -Name $Name -ErrorAction SilentlyContinue
    if ($null -eq $item) { return $null }
    return $item.$Name
}

function Get-RuxGraphicsSettings {
    $hwSch = Get-RuxRegistryValue 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers' 'HwSchMode'
    $vrr = Get-RuxRegistryValue 'HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences' 'DirectXUserGlobalSettings'
    $gameMode = Get-RuxRegistryValue 'HKCU:\\Software\\Microsoft\\GameBar' 'AutoGameModeEnabled'
    $gameDvr = Get-RuxRegistryValue 'HKCU:\\System\\GameConfigStore' 'GameDVR_Enabled'

    $preferences = Get-Item -LiteralPath 'HKCU:\\Software\\Microsoft\\DirectX\\UserGpuPreferences' -ErrorAction SilentlyContinue
    $preferenceCount = 0
    if ($preferences) {
        $preferenceCount = @($preferences.GetValueNames() | Where-Object { $_ -and $_ -ne 'DirectXUserGlobalSettings' }).Count
    }

    $hwSchValue = $null
    if ($null -ne $hwSch) { $hwSchValue = ([int] $hwSch -eq 2) }

    $vrrValue = $null
    if ($vrr) { $vrrValue = ([string] $vrr -match 'VRROptimizeEnable=1') }

    $gameModeValue = $null
    if ($null -ne $gameMode) { $gameModeValue = ([int] $gameMode -eq 1) }

    $gameDvrValue = $null
    if ($null -ne $gameDvr) { $gameDvrValue = ([int] $gameDvr -eq 1) }

    return [pscustomobject]@{
        hardwareAcceleratedScheduling = $hwSchValue
        variableRefreshRate = $vrrValue
        gameMode = $gameModeValue
        gameDvr = $gameDvrValue
        gpuPreferenceCount = $preferenceCount
    }
}

<#
  The true desktop mode, unaffected by DPI scaling, plus the highest refresh
  rate the attached panel advertises.
#>
function Get-RuxDisplayModes {
    $modes = New-Object System.Collections.Generic.List[object]

    $maxRefresh = $null
    foreach ($supported in (Get-CimInstance -Namespace 'root\\wmi' -ClassName WmiMonitorListedSupportedSourceModes -ErrorAction SilentlyContinue)) {
        foreach ($mode in $supported.MonitorSourceModes) {
            $vertical = $mode.VerticalRefreshRate
            if ($null -ne $vertical -and ($null -eq $maxRefresh -or $vertical -gt $maxRefresh)) {
                $maxRefresh = [int] $vertical
            }
        }
    }

    foreach ($controller in (Get-CimInstance -ClassName Win32_VideoController -ErrorAction SilentlyContinue)) {
        # An adapter that is not driving a desktop reports no mode at all.
        if ($null -eq $controller.CurrentHorizontalResolution) { continue }
        $controllerMax = $controller.MaxRefreshRate
        if ($null -ne $maxRefresh -and ($null -eq $controllerMax -or $maxRefresh -gt $controllerMax)) {
            $controllerMax = $maxRefresh
        }
        $modes.Add([pscustomobject]@{
            adapter = [string] $controller.Name
            width = [int] $controller.CurrentHorizontalResolution
            height = [int] $controller.CurrentVerticalResolution
            refreshHz = $(if ($null -ne $controller.CurrentRefreshRate) { [int] $controller.CurrentRefreshRate } else { $null })
            maxRefreshHz = $(if ($null -ne $controllerMax) { [int] $controllerMax } else { $null })
            bitsPerPixel = $(if ($null -ne $controller.CurrentBitsPerPixel) { [int] $controller.CurrentBitsPerPixel } else { $null })
        })
    }

    return @($modes.ToArray())
}

<#
  Maps the Win32 CM_PROB_* configuration manager codes onto a health state.
  Code 22 is a deliberately disabled device, not a fault.
#>
function Get-RuxDeviceHealth {
    param($Status, $ProblemCode)
    if ($ProblemCode -eq 22) { return 'disabled' }
    if ($ProblemCode -gt 0) {
        if ($ProblemCode -in @(1, 3, 10, 18, 19, 28, 31, 37, 39, 41, 43)) { return 'error' }
        return 'warning'
    }
    if ($Status -eq 'OK') { return 'ok' }
    if ($null -eq $Status) { return 'unknown' }
    return 'warning'
}

function Get-RuxDrivers {
    $drivers = New-Object System.Collections.Generic.List[object]
    $signed = @{}

    foreach ($record in (Get-CimInstance -ClassName Win32_PnPSignedDriver -ErrorAction SilentlyContinue)) {
        if (-not $record.DeviceID) { continue }
        $signed[[string] $record.DeviceID] = $record
    }

    foreach ($device in (Get-CimInstance -ClassName Win32_PnPEntity -ErrorAction SilentlyContinue)) {
        $deviceId = [string] $device.DeviceID
        $driver = $null
        if ($signed.ContainsKey($deviceId)) { $driver = $signed[$deviceId] }

        $problemCode = 0
        if ($null -ne $device.ConfigManagerErrorCode) { $problemCode = [int] $device.ConfigManagerErrorCode }

        $health = Get-RuxDeviceHealth -Status $device.Status -ProblemCode $problemCode
        if ($health -eq 'ok' -and $null -eq $driver) { continue }

        $driverDate = $null
        if ($driver -and $driver.DriverDate) { $driverDate = ([datetime] $driver.DriverDate).ToString('o') }

        $isSigned = $null
        if ($driver -and $null -ne $driver.IsSigned) { $isSigned = [bool] $driver.IsSigned }

        $providerName = $null
        if ($driver) { $providerName = [string] $driver.DriverProviderName }

        $drivers.Add([pscustomobject]@{
            id = $deviceId
            deviceName = [string] $device.Name
            deviceClass = [string] $device.PNPClass
            manufacturer = [string] $device.Manufacturer
            driverProvider = $providerName
            driverVersion = $(if ($driver) { [string] $driver.DriverVersion } else { $null })
            driverDate = $driverDate
            signed = $isSigned
            health = $health
            problemCode = $problemCode
            infName = $(if ($driver) { [string] $driver.InfName } else { $null })
        })
    }

    return @($drivers.ToArray())
}

function Get-RuxCapabilities {
    $os = Get-CimInstance -ClassName Win32_OperatingSystem -ErrorAction SilentlyContinue
    $computerSystem = Get-CimInstance -ClassName Win32_ComputerSystem -ErrorAction SilentlyContinue

    $secureBoot = $null
    try { $secureBoot = [bool] (Confirm-SecureBootUEFI) } catch { $secureBoot = $null }

    <#
      Windows reports VirtualizationFirmwareEnabled as False once Hyper-V has
      claimed the extensions, so a present hypervisor is the stronger signal and
      is checked first.
    #>
    $virtualization = $null
    $processor = Get-CimInstance -ClassName Win32_Processor -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($processor -and $null -ne $processor.VirtualizationFirmwareEnabled) {
        $virtualization = [bool] $processor.VirtualizationFirmwareEnabled
    }
    if ($computerSystem -and $computerSystem.HypervisorPresent -eq $true) { $virtualization = $true }

    # Win32_PowerPlan needs administrator rights; powercfg does not.
    $powerPlan = $null
    try {
        $plan = Get-CimInstance -Namespace 'root\\cimv2\\power' -ClassName Win32_PowerPlan -Filter 'IsActive = True' -ErrorAction Stop | Select-Object -First 1
        if ($plan) { $powerPlan = [string] $plan.ElementName }
    } catch {
        $powerPlan = $null
    }
    if (-not $powerPlan) {
        $active = (& powercfg.exe /getactivescheme 2>&1 | Out-String)
        $match = [regex]::Match($active, '\\(([^)]+)\\)')
        if ($match.Success) { $powerPlan = $match.Groups[1].Value.Trim() }
    }

    $battery = Get-CimInstance -ClassName Win32_Battery -ErrorAction SilentlyContinue | Select-Object -First 1

    return [pscustomobject]@{
        secureBoot = $secureBoot
        virtualizationEnabled = $virtualization
        powerPlan = $powerPlan
        batteryPresent = ($null -ne $battery)
        osBuild = $(if ($os) { [string] $os.BuildNumber } else { '' })
    }
}

${emitResult(`[pscustomobject]@{
    graphicsSettings = Get-RuxGraphicsSettings
    displayModes = Get-RuxDisplayModes
    drivers = Get-RuxDrivers
    capabilities = Get-RuxCapabilities
}`)}
`;
