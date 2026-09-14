import {emitResult} from '@/infrastructure/powershell/runner';
import {PS_HELPERS} from '@/infrastructure/powershell/scripts/helpers';

/**
 * Folders that must never be reported as leftovers.
 *
 * Two groups: shared containers whose contents say nothing about an uninstall,
 * and folders Windows itself creates and expects to find. Several of the latter
 * are empty by design, so removing them is a system change, not a cleanup.
 */
const SKIP_DIRECTORIES = `
$RuxSkipDirectories = @(
    'windowsapps','microsoft','microsoft shared','common files','packages','temp','tmp',
    'crashdumps','connecteddevicesplatform','comms','d3dscache','elevateddiagnostics',
    'publisher cache','internet explorer','modifiablewindowsapps','application data',
    'history','package cache','onedrive','programdata','start menu','desktop.ini',
    'uninstall information','windows sidebar','virtualstore','peerdistrepub',
    'placeholdertilelogofolder','packagemanagement','softwaredistribution','usoshared',
    'windowspowershell','windows defender','windows nt','windows photo viewer',
    'windows portable devices','windows security','windows mail','application verifier',
    'inteloptanedata','spp','ssh','diagnosis','setup','installer','regid'
)
`;

const ADD_FINDING = `
$RuxFindings = New-Object System.Collections.Generic.List[object]

function Add-RuxFinding {
    param(
        [string] $Class, [string] $Title, [string] $ReasonKey, [hashtable] $ReasonValues,
        [string] $Evidence, [string] $Risk, [string] $Elevation,
        [string] $RemovalKind, [string] $RemovalTarget, [string] $ValueName, [string] $TaskPath,
        [int64] $SizeBytes
    )
    $values = @{}
    if ($ReasonValues) { $values = $ReasonValues }
    $RuxFindings.Add([pscustomobject]@{
        id = [guid]::NewGuid().ToString('N').Substring(0, 12)
        residueClass = $Class
        title = $Title
        reasonKey = $ReasonKey
        reasonValues = $values
        evidence = $Evidence
        risk = $Risk
        elevation = $Elevation
        sizeBytes = $SizeBytes
        removalKind = $RemovalKind
        removalTarget = $RemovalTarget
        removalValueName = $ValueName
        removalTaskPath = $TaskPath
    })
}

function Get-RuxUninstallEntries {
    $roots = @(
        'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
        'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall',
        'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall'
    )
    $result = New-Object System.Collections.Generic.List[object]
    foreach ($root in $roots) {
        foreach ($child in (Get-ChildItem -LiteralPath $root -ErrorAction SilentlyContinue)) {
            $props = Get-ItemProperty -LiteralPath $child.PSPath -ErrorAction SilentlyContinue
            if ($null -eq $props) { continue }
            $result.Add([pscustomobject]@{
                keyPath = $child.PSPath
                regPath = $child.Name
                displayName = $props.DisplayName
                installLocation = $props.InstallLocation
                uninstallString = $props.UninstallString
                publisher = $props.Publisher
                systemComponent = $props.SystemComponent
            })
        }
    }
    return $result.ToArray()
}
`;

const FIND_STARTUP = `
function Find-RuxStartupResidue {
    $sources = @(
        @{ path = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'; elevation = 'user' }
        @{ path = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce'; elevation = 'user' }
        @{ path = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'; elevation = 'administrator' }
        @{ path = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce'; elevation = 'administrator' }
        @{ path = 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'; elevation = 'administrator' }
        @{ path = 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\RunOnce'; elevation = 'administrator' }
    )
    foreach ($source in $sources) {
        $key = Get-Item -LiteralPath $source.path -ErrorAction SilentlyContinue
        if ($null -eq $key) { continue }
        foreach ($name in $key.GetValueNames()) {
            if ([string]::IsNullOrWhiteSpace($name)) { continue }
            $executable = Resolve-RuxExecutable ([string] $key.GetValue($name))
            if (Test-RuxMissing $executable) {
                Add-RuxFinding -Class 'startup' -Title $name -ReasonKey 'residue.reasons.startup' -ReasonValues @{ location = $source.path } -Evidence $executable -Risk 'safe' -Elevation $source.elevation -RemovalKind 'registryValue' -RemovalTarget $source.path -ValueName $name -TaskPath $null -SizeBytes 0
            }
        }
    }
}
`;

const FIND_UNINSTALL = `
function Find-RuxUninstallResidue {
    foreach ($entry in (Get-RuxUninstallEntries)) {
        if (-not $entry.displayName) { continue }
        if ($entry.systemComponent -eq 1) { continue }

        $locationMissing = $false
        if ($entry.installLocation) { $locationMissing = Test-RuxMissing $entry.installLocation }
        $uninstallExecutable = Resolve-RuxExecutable $entry.uninstallString
        $uninstallMissing = $false
        if ($uninstallExecutable) { $uninstallMissing = Test-RuxMissing $uninstallExecutable }

        # An MSI uninstaller is msiexec plus a product code, so it always
        # resolves. Only the install folder can prove such an entry is dead.
        $isMsi = $entry.uninstallString -match 'msiexec'
        if ($isMsi) {
            $orphaned = $locationMissing
        } else {
            $orphaned = $locationMissing -or ($uninstallMissing -and -not $entry.installLocation)
        }
        if (-not $orphaned) { continue }

        if ($locationMissing) { $evidence = $entry.installLocation } else { $evidence = $uninstallExecutable }
        if ($entry.regPath -like 'HKEY_LOCAL_MACHINE*') { $elevation = 'administrator' } else { $elevation = 'user' }
        $publisher = ''
        if ($entry.publisher) { $publisher = $entry.publisher }
        Add-RuxFinding -Class 'uninstall' -Title $entry.displayName -ReasonKey 'residue.reasons.uninstall' -ReasonValues @{ publisher = $publisher } -Evidence $evidence -Risk 'safe' -Elevation $elevation -RemovalKind 'registryKey' -RemovalTarget $entry.keyPath -ValueName $null -TaskPath $null -SizeBytes 0
    }
}
`;

const FIND_SERVICE_TASK = `
function Find-RuxServiceResidue {
    foreach ($service in (Get-CimInstance -ClassName Win32_Service -ErrorAction SilentlyContinue)) {
        $executable = Resolve-RuxExecutable $service.PathName
        if (Test-RuxMissing $executable) {
            Add-RuxFinding -Class 'service' -Title $service.Name -ReasonKey 'residue.reasons.service' -ReasonValues @{ displayName = [string] $service.DisplayName; state = [string] $service.State } -Evidence $executable -Risk 'safe' -Elevation 'administrator' -RemovalKind 'service' -RemovalTarget $service.Name -ValueName $null -TaskPath $null -SizeBytes 0
        }
    }
}

function Find-RuxTaskResidue {
    foreach ($task in (Get-ScheduledTask -ErrorAction SilentlyContinue)) {
        if ($task.TaskPath -like '\\Microsoft\\Windows\\*') { continue }
        foreach ($action in $task.Actions) {
            if (-not $action.Execute) { continue }
            $executable = Resolve-RuxExecutable $action.Execute
            if (Test-RuxMissing $executable) {
                Add-RuxFinding -Class 'task' -Title $task.TaskName -ReasonKey 'residue.reasons.task' -ReasonValues @{ path = [string] $task.TaskPath } -Evidence $executable -Risk 'safe' -Elevation 'administrator' -RemovalKind 'task' -RemovalTarget $task.TaskName -ValueName $null -TaskPath $task.TaskPath -SizeBytes 0
                break
            }
        }
    }
}
`;

const FIND_SHORTCUT_APPPATH = `
function Find-RuxShortcutResidue {
    $shell = New-Object -ComObject WScript.Shell
    $roots = @(
        [Environment]::GetFolderPath('StartMenu'),
        [Environment]::GetFolderPath('CommonStartMenu'),
        [Environment]::GetFolderPath('Desktop'),
        [Environment]::GetFolderPath('CommonDesktopDirectory'),
        [Environment]::GetFolderPath('Startup'),
        [Environment]::GetFolderPath('CommonStartup')
    ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) } | Select-Object -Unique

    foreach ($root in $roots) {
        foreach ($file in (Get-ChildItem -LiteralPath $root -Recurse -Filter '*.lnk' -File -ErrorAction SilentlyContinue)) {
            $link = $shell.CreateShortcut($file.FullName)
            $target = $link.TargetPath
            if ([string]::IsNullOrWhiteSpace($target)) { continue }
            # Store apps and control panel items legitimately have no filesystem target.
            if ($target -notmatch '^[a-zA-Z]:\\\\') { continue }
            if (Test-Path -LiteralPath $target) { continue }
            if ($file.FullName -like ($env:ProgramData + '*')) { $elevation = 'administrator' } else { $elevation = 'user' }
            Add-RuxFinding -Class 'shortcut' -Title $file.BaseName -ReasonKey 'residue.reasons.shortcut' -ReasonValues @{ folder = (Split-Path $file.FullName -Parent) } -Evidence $target -Risk 'safe' -Elevation $elevation -RemovalKind 'path' -RemovalTarget $file.FullName -ValueName $null -TaskPath $null -SizeBytes ([int64] $file.Length)
        }
    }
}

function Find-RuxAppPathResidue {
    $roots = @(
        @{ path = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths'; elevation = 'administrator' }
        @{ path = 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\App Paths'; elevation = 'administrator' }
        @{ path = 'HKCU:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\App Paths'; elevation = 'user' }
    )
    foreach ($root in $roots) {
        foreach ($child in (Get-ChildItem -LiteralPath $root.path -ErrorAction SilentlyContinue)) {
            $props = Get-ItemProperty -LiteralPath $child.PSPath -ErrorAction SilentlyContinue
            $target = $props.'(default)'
            if (-not $target) { continue }
            $executable = Resolve-RuxExecutable $target
            if (Test-RuxMissing $executable) {
                Add-RuxFinding -Class 'apppath' -Title $child.PSChildName -ReasonKey 'residue.reasons.apppath' -ReasonValues @{} -Evidence $executable -Risk 'safe' -Elevation $root.elevation -RemovalKind 'registryKey' -RemovalTarget $child.PSPath -ValueName $null -TaskPath $null -SizeBytes 0
            }
        }
    }
}
`;

const FIND_FIREWALL_DIRECTORY = `
function Find-RuxFirewallResidue {
    $filters = Get-NetFirewallApplicationFilter -ErrorAction SilentlyContinue
    if ($null -eq $filters) { return }

    # Piping each filter to Get-NetFirewallRule costs a WMI round trip per rule
    # and takes roughly twenty seconds on a normal machine. Index once instead.
    $rules = @{}
    foreach ($rule in (Get-NetFirewallRule -ErrorAction SilentlyContinue)) { $rules[$rule.Name] = $rule }

    $missingCache = @{}
    foreach ($filter in $filters) {
        $program = $filter.Program
        if ([string]::IsNullOrWhiteSpace($program) -or $program -eq 'Any') { continue }
        $expanded = [Environment]::ExpandEnvironmentVariables($program)
        if ($expanded -notmatch '^[a-zA-Z]:\\\\') { continue }

        $cacheKey = $expanded.ToLowerInvariant()
        if (-not $missingCache.ContainsKey($cacheKey)) {
            $missingCache[$cacheKey] = -not (Test-Path -LiteralPath $expanded)
        }
        if (-not $missingCache[$cacheKey]) { continue }

        $rule = $rules[$filter.InstanceID]
        if ($null -eq $rule) { continue }
        # A resource-string group ("@FirewallAPI.dll,-32002") marks a rule that
        # ships with Windows for an optional feature, not an uninstall leftover.
        if ($rule.Group -like '@*') { continue }
        if ($rule.Owner) { continue }

        Add-RuxFinding -Class 'firewall' -Title $rule.DisplayName -ReasonKey 'residue.reasons.firewall' -ReasonValues @{ direction = [string] $rule.Direction } -Evidence $expanded -Risk 'safe' -Elevation 'administrator' -RemovalKind 'firewall' -RemovalTarget $rule.Name -ValueName $null -TaskPath $null -SizeBytes 0
    }
}

function Find-RuxDirectoryResidue {
    $installLocations = @{}
    foreach ($entry in (Get-RuxUninstallEntries)) {
        if ($entry.installLocation) {
            $normalized = $entry.installLocation.Trim().Trim('"').TrimEnd('\\').ToLowerInvariant()
            if ($normalized) { $installLocations[$normalized] = $true }
        }
    }

    # rux keeps its own backups under LocalAppData and empties that folder as
    # backups are restored, so it would otherwise report itself.
    $ownData = (Join-Path $env:LOCALAPPDATA 'rux').TrimEnd('\\').ToLowerInvariant()

    $roots = @(
        @{ path = $env:ProgramFiles; label = 'Program Files'; elevation = 'administrator' }
        @{ path = [Environment]::GetEnvironmentVariable('ProgramFiles(x86)'); label = 'Program Files (x86)'; elevation = 'administrator' }
        @{ path = $env:LOCALAPPDATA; label = 'Local AppData'; elevation = 'user' }
        @{ path = $env:APPDATA; label = 'Roaming AppData'; elevation = 'user' }
        @{ path = $env:ProgramData; label = 'ProgramData'; elevation = 'administrator' }
    )

    foreach ($root in $roots) {
        if (-not $root.path -or -not (Test-Path -LiteralPath $root.path)) { continue }
        foreach ($dir in (Get-ChildItem -LiteralPath $root.path -Directory -Force -ErrorAction SilentlyContinue)) {
            if ($RuxSkipDirectories -contains $dir.Name.ToLowerInvariant()) { continue }
            if ($dir.FullName.TrimEnd('\\').ToLowerInvariant() -eq $ownData) { continue }
            if ($dir.Attributes -band [IO.FileAttributes]::ReparsePoint) { continue }

            $firstFile = Get-ChildItem -LiteralPath $dir.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($null -eq $firstFile) {
                Add-RuxFinding -Class 'directory' -Title $dir.Name -ReasonKey 'residue.reasons.emptyDirectory' -ReasonValues @{ root = $root.label } -Evidence $dir.FullName -Risk 'safe' -Elevation $root.elevation -RemovalKind 'path' -RemovalTarget $dir.FullName -ValueName $null -TaskPath $null -SizeBytes 0
                continue
            }

            if (-not $RuxInput.deep) { continue }

            $normalized = $dir.FullName.TrimEnd('\\').ToLowerInvariant()
            if ($installLocations.ContainsKey($normalized)) { continue }
            $claimed = $false
            foreach ($location in $installLocations.Keys) {
                if ($location.StartsWith($normalized) -or $normalized.StartsWith($location)) { $claimed = $true; break }
            }
            if ($claimed) { continue }

            $hasExecutable = Get-ChildItem -LiteralPath $dir.FullName -Recurse -Include '*.exe','*.dll' -File -Force -ErrorAction SilentlyContinue | Select-Object -First 1
            if ($null -eq $hasExecutable) { continue }

            $size = (Get-ChildItem -LiteralPath $dir.FullName -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
            if ($null -eq $size) { $size = 0 }
            Add-RuxFinding -Class 'directory' -Title $dir.Name -ReasonKey 'residue.reasons.unclaimedDirectory' -ReasonValues @{ root = $root.label } -Evidence $dir.FullName -Risk 'review' -Elevation $root.elevation -RemovalKind 'path' -RemovalTarget $dir.FullName -ValueName $null -TaskPath $null -SizeBytes ([int64] $size)
        }
    }
}
`;

export const SCAN_RESIDUE_SCRIPT = `
${PS_HELPERS}
${SKIP_DIRECTORIES}
${ADD_FINDING}
${FIND_STARTUP}
${FIND_UNINSTALL}
${FIND_SERVICE_TASK}
${FIND_SHORTCUT_APPPATH}
${FIND_FIREWALL_DIRECTORY}

foreach ($class in $RuxInput.classes) {
    switch ($class) {
        'startup'   { Find-RuxStartupResidue }
        'uninstall' { Find-RuxUninstallResidue }
        'service'   { Find-RuxServiceResidue }
        'task'      { Find-RuxTaskResidue }
        'shortcut'  { Find-RuxShortcutResidue }
        'apppath'   { Find-RuxAppPathResidue }
        'firewall'  { Find-RuxFirewallResidue }
        'directory' { Find-RuxDirectoryResidue }
    }
}

$RuxIdentity = Get-RuxIdentity
${emitResult(`[pscustomobject]@{
    findings = @($RuxFindings.ToArray())
    elevated = $RuxIdentity.elevated
}`)}
`;
