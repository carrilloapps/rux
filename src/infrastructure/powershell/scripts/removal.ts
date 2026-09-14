import {emitResult} from '@/infrastructure/powershell/runner';
import {PS_HELPERS} from '@/infrastructure/powershell/scripts/helpers';

/**
 * Locations whose removal would damage the installation rather than clean it up.
 * Checked regardless of what a finding claims, so a scanner bug cannot become a
 * destructive operation.
 */
const PROTECTED_PATHS = `
$RuxProtected = @(
    $env:SystemRoot,
    (Join-Path $env:SystemRoot 'System32'),
    (Join-Path $env:SystemRoot 'SysWOW64'),
    $env:ProgramFiles,
    [Environment]::GetEnvironmentVariable('ProgramFiles(x86)'),
    $env:ProgramData,
    $env:LOCALAPPDATA,
    $env:APPDATA,
    $env:USERPROFILE,
    $env:SystemDrive
) | Where-Object { $_ } | ForEach-Object { $_.TrimEnd('\\').ToLowerInvariant() }

function Test-RuxProtectedPath {
    param([string] $Path)
    if ([string]::IsNullOrWhiteSpace($Path)) { return $true }
    $normalized = $Path.TrimEnd('\\').ToLowerInvariant()
    if ($RuxProtected -contains $normalized) { return $true }
    if ($normalized -match '^[a-z]:$') { return $true }
    return $false
}

function Get-RuxBackupRoot {
    if ($RuxInput.backupRoot) { return $RuxInput.backupRoot }
    return (Join-Path $env:LOCALAPPDATA 'rux\\backups')
}
`;

export const REMOVE_RESIDUE_SCRIPT = `
${PS_HELPERS}
${PROTECTED_PATHS}

$backupRoot = Get-RuxBackupRoot
$backupId = (Get-Date).ToString('yyyyMMdd-HHmmss') + '-' + ([guid]::NewGuid().ToString('N').Substring(0, 4))
$backupPath = Join-Path $backupRoot $backupId
$filesPath = Join-Path $backupPath 'files'
New-Item -ItemType Directory -Path $backupPath -Force | Out-Null

$receipts = New-Object System.Collections.Generic.List[object]
$manifest = New-Object System.Collections.Generic.List[object]
$index = 0

foreach ($item in $RuxInput.items) {
    $index = $index + 1
    try {
        $record = $null
        switch ($item.kind) {
            'registryValue' {
                $provider = ConvertTo-RuxProviderPath $item.target
                if (-not (Test-Path -LiteralPath $provider)) { throw ('Registry key not found: ' + $provider) }
                $backupFile = Join-Path $backupPath ($index.ToString() + '-value.reg')
                Invoke-RuxReg @('export', (ConvertTo-RuxRegExePath $item.target), $backupFile, '/y') | Out-Null
                Remove-ItemProperty -LiteralPath $provider -Name $item.valueName -Force
                $record = @{ kind = 'registryValue'; target = $item.target; valueName = $item.valueName; backup = $backupFile }
            }
            'registryKey' {
                $provider = ConvertTo-RuxProviderPath $item.target
                if (-not (Test-Path -LiteralPath $provider)) { throw ('Registry key not found: ' + $provider) }
                $backupFile = Join-Path $backupPath ($index.ToString() + '-key.reg')
                Invoke-RuxReg @('export', (ConvertTo-RuxRegExePath $item.target), $backupFile, '/y') | Out-Null
                Remove-Item -LiteralPath $provider -Recurse -Force
                $record = @{ kind = 'registryKey'; target = $item.target; backup = $backupFile }
            }
            'path' {
                if (Test-RuxProtectedPath $item.target) { throw ('Refusing to remove a protected location: ' + $item.target) }
                if (-not (Test-Path -LiteralPath $item.target)) { throw ('Path not found: ' + $item.target) }
                New-Item -ItemType Directory -Path $filesPath -Force | Out-Null
                $isDirectory = (Get-Item -LiteralPath $item.target).PSIsContainer
                $destination = Join-Path $filesPath ($index.ToString() + '-' + (Split-Path $item.target -Leaf))
                # Moving instead of deleting keeps the bytes recoverable until
                # the user clears the backup themselves.
                Move-Item -LiteralPath $item.target -Destination $destination -Force
                $record = @{ kind = 'path'; target = $item.target; backup = $destination; isDirectory = $isDirectory }
            }
            'service' {
                $serviceKey = 'HKEY_LOCAL_MACHINE\\SYSTEM\\CurrentControlSet\\Services\\' + $item.target
                $backupFile = Join-Path $backupPath ($index.ToString() + '-service.reg')
                Invoke-RuxReg @('export', $serviceKey, $backupFile, '/y') | Out-Null
                $output = & sc.exe delete $item.target 2>&1
                if ($LASTEXITCODE -ne 0) { throw ('sc delete failed: ' + $output) }
                $record = @{ kind = 'service'; target = $item.target; backup = $backupFile }
            }
            'task' {
                $taskPath = $item.taskPath
                if (-not $taskPath) { $taskPath = '\\' }
                $xml = Export-ScheduledTask -TaskName $item.target -TaskPath $taskPath
                $backupFile = Join-Path $backupPath ($index.ToString() + '-task.xml')
                Set-Content -LiteralPath $backupFile -Value $xml -Encoding Unicode
                Unregister-ScheduledTask -TaskName $item.target -TaskPath $taskPath -Confirm:$false
                $record = @{ kind = 'task'; target = $item.target; taskPath = $taskPath; backup = $backupFile }
            }
            'firewall' {
                $rule = Get-NetFirewallRule -Name $item.target -ErrorAction Stop
                $appFilter = $rule | Get-NetFirewallApplicationFilter
                $portFilter = $rule | Get-NetFirewallPortFilter
                # There is no export-one-rule cmdlet, so capture the fields
                # New-NetFirewallRule needs to rebuild it.
                $snapshot = @{
                    Name = $rule.Name
                    DisplayName = $rule.DisplayName
                    Description = $rule.Description
                    Group = $rule.Group
                    Enabled = [string] $rule.Enabled
                    Profile = [string] $rule.Profile
                    Direction = [string] $rule.Direction
                    Action = [string] $rule.Action
                    Program = $appFilter.Program
                    Protocol = [string] $portFilter.Protocol
                }
                $backupFile = Join-Path $backupPath ($index.ToString() + '-firewall.json')
                $snapshot | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $backupFile -Encoding UTF8
                Remove-NetFirewallRule -Name $item.target -ErrorAction Stop
                $record = @{ kind = 'firewall'; target = $item.target; backup = $backupFile }
            }
            default { throw ('Unsupported removal kind: ' + $item.kind) }
        }

        $record.title = $item.title
        $record.id = $item.id
        $manifest.Add([pscustomobject] $record)
        $receipts.Add([pscustomobject]@{ id = $item.id; ok = $true; message = $item.title })
    } catch {
        $receipts.Add([pscustomobject]@{ id = $item.id; ok = $false; message = $_.Exception.Message })
    }
}

$removed = @($receipts.ToArray() | Where-Object { $_.ok }).Count

if ($removed -gt 0) {
    $manifestObject = [pscustomobject]@{
        backupId = $backupId
        createdAt = (Get-Date).ToString('o')
        items = @($manifest.ToArray())
    }
    $manifestObject | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $backupPath 'manifest.json') -Encoding UTF8
    $resultBackupId = $backupId
} else {
    # Nothing was removed, so leave no empty backup folder behind.
    Remove-Item -LiteralPath $backupPath -Recurse -Force -ErrorAction SilentlyContinue
    $resultBackupId = $null
}

${emitResult(`[pscustomobject]@{
    removed = $removed
    failed = ($receipts.Count - $removed)
    backupId = $resultBackupId
    receipts = @($receipts.ToArray())
}`)}
`;

export const LIST_BACKUPS_SCRIPT = `
${PS_HELPERS}
${PROTECTED_PATHS}

$backupRoot = Get-RuxBackupRoot
$backups = New-Object System.Collections.Generic.List[object]

if (Test-Path -LiteralPath $backupRoot) {
    foreach ($directory in (Get-ChildItem -LiteralPath $backupRoot -Directory -ErrorAction SilentlyContinue)) {
        $manifestPath = Join-Path $directory.FullName 'manifest.json'
        if (-not (Test-Path -LiteralPath $manifestPath)) { continue }
        $manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
        $items = @($manifest.items)
        $backups.Add([pscustomobject]@{
            backupId = $manifest.backupId
            createdAt = $manifest.createdAt
            location = $directory.FullName
            itemCount = $items.Count
            titles = @($items | ForEach-Object { [string] $_.title } | Select-Object -First 8)
        })
    }
}

$sorted = @($backups.ToArray() | Sort-Object createdAt -Descending)
${emitResult('[pscustomobject]@{ backups = $sorted }')}
`;

export const RESTORE_BACKUP_SCRIPT = `
${PS_HELPERS}
${PROTECTED_PATHS}

$backupRoot = Get-RuxBackupRoot
$backupPath = Join-Path $backupRoot $RuxInput.backupId
$manifestPath = Join-Path $backupPath 'manifest.json'
if (-not (Test-Path -LiteralPath $manifestPath)) { throw ('No backup named ' + $RuxInput.backupId) }

if ($RuxInput.purge) {
    Remove-Item -LiteralPath $backupPath -Recurse -Force
    ${emitResult('[pscustomobject]@{ restored = 0; failed = 0; receipts = @() }')}
    return
}

$manifest = Get-Content -LiteralPath $manifestPath -Raw | ConvertFrom-Json
$items = @($manifest.items)
$receipts = New-Object System.Collections.Generic.List[object]

foreach ($item in $items) {
    try {
        if (-not (Test-Path -LiteralPath $item.backup)) { throw ('Backup file missing: ' + $item.backup) }
        switch ($item.kind) {
            'registryValue' { Invoke-RuxReg @('import', $item.backup) | Out-Null }
            'registryKey'   { Invoke-RuxReg @('import', $item.backup) | Out-Null }
            'service'       { Invoke-RuxReg @('import', $item.backup) | Out-Null }
            'path' {
                if (Test-Path -LiteralPath $item.target) { throw ('Something already exists at ' + $item.target) }
                $parent = Split-Path $item.target -Parent
                if ($parent -and -not (Test-Path -LiteralPath $parent)) {
                    New-Item -ItemType Directory -Path $parent -Force | Out-Null
                }
                Move-Item -LiteralPath $item.backup -Destination $item.target -Force
            }
            'task' {
                $xml = Get-Content -LiteralPath $item.backup -Raw
                Register-ScheduledTask -TaskName $item.target -TaskPath $item.taskPath -Xml $xml -Force | Out-Null
            }
            'firewall' {
                $snapshot = Get-Content -LiteralPath $item.backup -Raw | ConvertFrom-Json
                $parameters = @{
                    Name = $snapshot.Name
                    DisplayName = $snapshot.DisplayName
                    Direction = $snapshot.Direction
                    Action = $snapshot.Action
                    Enabled = $snapshot.Enabled
                    Profile = $snapshot.Profile
                }
                if ($snapshot.Description) { $parameters.Description = $snapshot.Description }
                if ($snapshot.Group) { $parameters.Group = $snapshot.Group }
                if ($snapshot.Program -and $snapshot.Program -ne 'Any') { $parameters.Program = $snapshot.Program }
                if ($snapshot.Protocol -and $snapshot.Protocol -ne 'Any') { $parameters.Protocol = $snapshot.Protocol }
                New-NetFirewallRule @parameters | Out-Null
            }
            default { throw ('Unsupported restore kind: ' + $item.kind) }
        }
        $receipts.Add([pscustomobject]@{ id = [string] $item.id; ok = $true; message = [string] $item.title })
    } catch {
        $receipts.Add([pscustomobject]@{ id = [string] $item.id; ok = $false; message = $_.Exception.Message })
    }
}

$restored = @($receipts.ToArray() | Where-Object { $_.ok }).Count

# A fully replayed backup has nothing left to hold; keep partial ones for a retry.
if ($restored -eq $items.Count) {
    Remove-Item -LiteralPath $backupPath -Recurse -Force -ErrorAction SilentlyContinue
}

${emitResult(`[pscustomobject]@{
    restored = $restored
    failed = ($items.Count - $restored)
    receipts = @($receipts.ToArray())
}`)}
`;
