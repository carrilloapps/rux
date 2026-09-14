/**
 * PowerShell helper functions shared by every rux script.
 *
 * Two conventions are enforced throughout these script modules:
 *  - no backtick line continuations, because a stray backtick inside a
 *    TypeScript template literal is an escape character and silently mangles
 *    the emitted script;
 *  - no `${...}` environment syntax, for the same reason. Environment values go
 *    through [Environment]::GetEnvironmentVariable instead.
 */
export const PS_HELPERS = `
function Get-RuxIdentity {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return [pscustomobject]@{
        userName = $identity.Name
        elevated = $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    }
}

function Expand-RuxPath {
    param([string] $Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $null }
    return [Environment]::ExpandEnvironmentVariables($Path)
}

<#
  Reduces a command line to the executable it launches.

  Registry values store paths in three shapes: fully quoted with arguments,
  quoted with nothing after them, and bare with arguments. All three have to
  collapse to the same path or healthy software gets reported as missing.
#>
function Resolve-RuxExecutable {
    param([string] $Command)
    if ([string]::IsNullOrWhiteSpace($Command)) { return $null }
    $trimmed = $Command.Trim()

    if ($trimmed.StartsWith('"')) {
        $closing = $trimmed.IndexOf('"', 1)
        if ($closing -gt 0) {
            return [Environment]::ExpandEnvironmentVariables($trimmed.Substring(1, $closing - 1))
        }
    }

    $expanded = [Environment]::ExpandEnvironmentVariables($trimmed)
    $match = [regex]::Match($expanded, '^(.*?\\.(exe|com|bat|cmd|scr|dll|sys))(\\s|$)', 'IgnoreCase')
    if ($match.Success) { return $match.Groups[1].Value }
    return ($expanded -split '\\s+')[0]
}

<#
  True when a referenced path is demonstrably absent.

  Registry values such as InstallLocation are routinely stored wrapped in their
  own quotes. Test-Path treats those quotes as part of the name and reports a
  healthy install as missing, so they are stripped first.
#>
function Test-RuxMissing {
    param([string] $Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $false }
    $clean = $Path.Trim().Trim('"').Trim()
    if ([string]::IsNullOrWhiteSpace($clean)) { return $false }
    if ($clean -match '^[a-z0-9]+\\.(exe|dll)$') { return $false }
    return -not (Test-Path -LiteralPath $clean)
}

function Get-RuxFileFacts {
    param([string] $Path)
    $facts = [pscustomobject]@{ exists = $false; publisher = $null; sizeBytes = $null; modifiedAt = $null }
    if ([string]::IsNullOrWhiteSpace($Path)) { return $facts }
    $item = Get-Item -LiteralPath $Path -ErrorAction SilentlyContinue
    if ($null -eq $item) { return $facts }
    $facts.exists = $true
    if (-not $item.PSIsContainer) { $facts.sizeBytes = [int64] $item.Length }
    $facts.modifiedAt = $item.LastWriteTime.ToString('o')
    if ($item.VersionInfo) { $facts.publisher = $item.VersionInfo.CompanyName }
    return $facts
}

<#
  Reads the StartupApproved flag Windows Task Manager writes.
  A leading byte of 3 or 9 means the user disabled the entry.
#>
function Get-RuxApprovalMap {
    param([string] $KeyPath)
    $map = @{}
    $key = Get-Item -LiteralPath $KeyPath -ErrorAction SilentlyContinue
    if ($null -eq $key) { return $map }
    foreach ($name in $key.GetValueNames()) {
        $raw = $key.GetValue($name)
        if ($raw -is [byte[]] -and $raw.Length -gt 0) {
            $map[$name] = -not (($raw[0] -eq 3) -or ($raw[0] -eq 9))
        }
    }
    return $map
}

function Set-RuxApprovalFlag {
    param([string] $Hive, [string] $ApprovalKey, [string] $ValueName, [bool] $Enabled)
    $path = $Hive + ':\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\' + $ApprovalKey
    if (-not (Test-Path -LiteralPath $path)) { New-Item -Path $path -Force | Out-Null }
    $stamp = [BitConverter]::GetBytes([DateTime]::Now.ToFileTime())
    if ($Enabled) { $head = [byte[]] @(2, 0, 0, 0) } else { $head = [byte[]] @(3, 0, 0, 0) }
    New-ItemProperty -LiteralPath $path -Name $ValueName -PropertyType Binary -Value ($head + $stamp) -Force | Out-Null
}

function ConvertTo-RuxRegExePath {
    param([string] $Path)
    $clean = $Path -replace '^Microsoft\\.PowerShell\\.Core\\\\Registry::', ''
    $clean = $clean -replace '^HKLM:\\\\', 'HKEY_LOCAL_MACHINE\\'
    $clean = $clean -replace '^HKCU:\\\\', 'HKEY_CURRENT_USER\\'
    $clean = $clean -replace '^HKCR:\\\\', 'HKEY_CLASSES_ROOT\\'
    $clean = $clean -replace '^HKU:\\\\', 'HKEY_USERS\\'
    return $clean
}

function ConvertTo-RuxProviderPath {
    param([string] $Path)
    $clean = $Path -replace '^Microsoft\\.PowerShell\\.Core\\\\Registry::', ''
    $clean = $clean -replace '^HKEY_LOCAL_MACHINE\\\\', 'HKLM:\\'
    $clean = $clean -replace '^HKEY_CURRENT_USER\\\\', 'HKCU:\\'
    $clean = $clean -replace '^HKEY_CLASSES_ROOT\\\\', 'HKCR:\\'
    $clean = $clean -replace '^HKEY_USERS\\\\', 'HKU:\\'
    return $clean
}

<#
  reg.exe writes even its success message to stderr. Under a Stop error
  preference a merged stderr stream becomes a terminating error, so a
  successful export would be reported as a failure. Judge it by exit code.
#>
function Invoke-RuxReg {
    param([string[]] $Arguments)
    $previous = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        $output = (& reg.exe @Arguments 2>&1 | Out-String).Trim()
    } finally {
        $ErrorActionPreference = $previous
    }
    if ($LASTEXITCODE -ne 0) { throw ('reg ' + $Arguments[0] + ' failed: ' + $output) }
    return $output
}
`;
