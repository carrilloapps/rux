import {emitResult} from '@/infrastructure/powershell/runner';
import {PS_HELPERS} from '@/infrastructure/powershell/scripts/helpers';

/**
 * Inspects the Windows Subsystem for Linux from the Windows side.
 *
 * `wsl.exe` writes UTF-16LE to stdout, which arrives as text interleaved with
 * null bytes if read naively, so the output encoding is switched for the call
 * and the nulls are stripped defensively.
 */
export const INSPECT_WSL_SCRIPT = `
${PS_HELPERS}

function Get-RuxWslText {
    param([string[]] $Arguments)
    $previousEncoding = [Console]::OutputEncoding
    $previousPreference = $ErrorActionPreference
    $ErrorActionPreference = 'Continue'
    try {
        [Console]::OutputEncoding = [Text.Encoding]::Unicode
        $raw = (& wsl.exe @Arguments 2>&1 | Out-String)
    } catch {
        $raw = ''
    } finally {
        [Console]::OutputEncoding = $previousEncoding
        $ErrorActionPreference = $previousPreference
    }
    if ($null -eq $raw) { return '' }
    return ($raw -replace "\`0", '')
}

function Test-RuxWslInstalled {
    $command = Get-Command wsl.exe -ErrorAction SilentlyContinue
    return ($null -ne $command)
}

<#
  Parses "wsl --list --verbose". The output is a fixed-width table whose header
  is localized, so rows are identified by shape rather than by column name: the
  default distribution is marked with an asterisk and the version is the last
  numeric column.
#>
function Get-RuxWslDistributions {
    $output = Get-RuxWslText @('--list', '--verbose')
    $distributions = New-Object System.Collections.Generic.List[object]
    if ([string]::IsNullOrWhiteSpace($output)) { return @($distributions.ToArray()) }

    $lines = $output -split "\`r?\`n" | Where-Object { $_.Trim().Length -gt 0 }
    foreach ($line in $lines) {
        $trimmed = $line.Trim()
        $isDefault = $trimmed.StartsWith('*')
        if ($isDefault) { $trimmed = $trimmed.Substring(1).Trim() }
        $columns = $trimmed -split '\\s{2,}|\\s+' | Where-Object { $_.Length -gt 0 }
        if ($columns.Count -lt 3) { continue }
        $version = $columns[$columns.Count - 1]
        if ($version -notmatch '^[12]$') { continue }
        $state = $columns[$columns.Count - 2]
        $name = ($columns[0..($columns.Count - 3)] -join ' ')
        $distributions.Add([pscustomobject]@{
            name = $name
            version = [int] $version
            state = $state
            isDefault = $isDefault
        })
    }
    return @($distributions.ToArray())
}

<#
  Reads .wslconfig, a plain INI file under the user profile. Size values accept
  a GB/MB/KB suffix and are normalized to bytes here so the domain never parses
  text.
#>
function ConvertFrom-RuxWslSize {
    param([string] $Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
    $match = [regex]::Match($Value.Trim(), '^(\\d+(?:\\.\\d+)?)\\s*([GMK]B?)?$', 'IgnoreCase')
    if (-not $match.Success) { return $null }
    $number = [double] $match.Groups[1].Value
    $unit = $match.Groups[2].Value.ToUpperInvariant()
    switch -Wildcard ($unit) {
        'G*' { return [int64] ($number * 1GB) }
        'M*' { return [int64] ($number * 1MB) }
        'K*' { return [int64] ($number * 1KB) }
        default { return [int64] $number }
    }
}

function ConvertFrom-RuxWslBool {
    param([string] $Value)
    if ([string]::IsNullOrWhiteSpace($Value)) { return $null }
    $normalized = $Value.Trim().ToLowerInvariant()
    if ($normalized -eq 'true' -or $normalized -eq '1') { return $true }
    if ($normalized -eq 'false' -or $normalized -eq '0') { return $false }
    return $null
}

function Get-RuxWslConfig {
    $path = Join-Path $env:USERPROFILE '.wslconfig'
    $result = [pscustomobject]@{
        exists = $false
        path = $path
        memoryBytes = $null
        processors = $null
        swapBytes = $null
        nestedVirtualization = $null
        gpuSupport = $null
        guiApplications = $null
        sparseVhd = $null
        otherKeys = @()
    }
    if (-not (Test-Path -LiteralPath $path)) { return $result }
    $result.exists = $true

    $known = @('memory', 'processors', 'swap', 'nestedvirtualization', 'gpusupport', 'guiapplications', 'sparsevhd')
    $others = New-Object System.Collections.Generic.List[string]

    foreach ($line in (Get-Content -LiteralPath $path -ErrorAction SilentlyContinue)) {
        $trimmed = $line.Trim()
        if ($trimmed.Length -eq 0 -or $trimmed.StartsWith('#') -or $trimmed.StartsWith(';') -or $trimmed.StartsWith('[')) { continue }
        $separator = $trimmed.IndexOf('=')
        if ($separator -lt 1) { continue }
        $key = $trimmed.Substring(0, $separator).Trim()
        $value = $trimmed.Substring($separator + 1).Trim()
        switch ($key.ToLowerInvariant()) {
            'memory' { $result.memoryBytes = ConvertFrom-RuxWslSize $value }
            'processors' { $result.processors = [int] $value }
            'swap' { $result.swapBytes = ConvertFrom-RuxWslSize $value }
            'nestedvirtualization' { $result.nestedVirtualization = ConvertFrom-RuxWslBool $value }
            'gpusupport' { $result.gpuSupport = ConvertFrom-RuxWslBool $value }
            'guiapplications' { $result.guiApplications = ConvertFrom-RuxWslBool $value }
            'sparsevhd' { $result.sparseVhd = ConvertFrom-RuxWslBool $value }
            default { $others.Add($key) }
        }
        if (-not ($known -contains $key.ToLowerInvariant())) { }
    }

    $result.otherKeys = @($others.ToArray())
    return $result
}

if (-not (Test-RuxWslInstalled)) {
    ${emitResult(`[pscustomobject]@{
        installed = $false
        defaultVersion = $null
        kernelVersion = $null
        distributions = @()
        config = Get-RuxWslConfig
        running = $false
    }`)}
    return
}

$RuxStatusText = Get-RuxWslText @('--status')
$RuxVersionText = Get-RuxWslText @('--version')

$RuxDefaultVersion = $null
$RuxVersionMatch = [regex]::Match($RuxStatusText, '(?m):\\s*([12])\\s*$')
if ($RuxVersionMatch.Success) { $RuxDefaultVersion = [int] $RuxVersionMatch.Groups[1].Value }

$RuxKernel = $null
$RuxKernelMatch = [regex]::Match($RuxVersionText, '(\\d+\\.\\d+\\.\\d+(?:\\.\\d+)?)')
if ($RuxKernelMatch.Success) { $RuxKernel = $RuxKernelMatch.Groups[1].Value }

$RuxDistributions = Get-RuxWslDistributions
$RuxRunning = $null -ne (Get-Process -Name 'vmmem', 'vmmemWSL' -ErrorAction SilentlyContinue)

${emitResult(`[pscustomobject]@{
    installed = $true
    defaultVersion = $RuxDefaultVersion
    kernelVersion = $RuxKernel
    distributions = $RuxDistributions
    config = Get-RuxWslConfig
    running = $RuxRunning
}`)}
`;
