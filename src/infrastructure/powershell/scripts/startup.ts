import {emitResult} from '@/infrastructure/powershell/runner';
import {PS_HELPERS} from '@/infrastructure/powershell/scripts/helpers';

/**
 * Registry locations Windows reads startup entries from, paired with the
 * StartupApproved sub-key that owns their enabled flag.
 */
const REGISTRY_SOURCES = `
$RuxSources = @(
    @{ path = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'; source = 'run-user'; elevation = 'user'; approvalHive = 'HKCU'; approvalKey = 'Run' }
    @{ path = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\RunOnce'; source = 'run-once-user'; elevation = 'user'; approvalHive = $null; approvalKey = $null }
    @{ path = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run'; source = 'run-machine'; elevation = 'administrator'; approvalHive = 'HKLM'; approvalKey = 'Run' }
    @{ path = 'HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\RunOnce'; source = 'run-once-machine'; elevation = 'administrator'; approvalHive = $null; approvalKey = $null }
    @{ path = 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Run'; source = 'run-machine-x86'; elevation = 'administrator'; approvalHive = 'HKLM'; approvalKey = 'Run32' }
    @{ path = 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\RunOnce'; source = 'run-once-machine-x86'; elevation = 'administrator'; approvalHive = $null; approvalKey = $null }
)
`;

const BUILD_ENTRY = `
function New-RuxEntry {
    param(
        [string] $Name, [string] $Command, [string] $Source, [string] $Kind, [string] $Elevation,
        [bool] $Enabled, [string] $Location, [string] $ApprovalKey, [string] $ApprovalHive, [string] $TaskPath
    )
    $executable = Resolve-RuxExecutable $Command
    $facts = Get-RuxFileFacts $executable
    $executableName = $null
    if ($executable) { $executableName = [System.IO.Path]::GetFileName($executable) }
    return [pscustomobject]@{
        id = $Source + '::' + $Name
        name = $Name
        command = $Command
        executablePath = $executable
        executableName = $executableName
        source = $Source
        kind = $Kind
        elevation = $Elevation
        enabled = $Enabled
        location = $Location
        approvalKey = $ApprovalKey
        approvalHive = $ApprovalHive
        taskPath = $TaskPath
        executableExists = $facts.exists
        publisher = $facts.publisher
        fileSizeBytes = $facts.sizeBytes
        modifiedAt = $facts.modifiedAt
    }
}
`;

const COLLECT_PROCESSES = `
function Get-RuxProcesses {
    return @(Get-Process -ErrorAction SilentlyContinue | ForEach-Object {
        [pscustomobject]@{
            pid = $_.Id
            name = $_.ProcessName
            executablePath = $_.Path
            memoryBytes = [int64] $_.WorkingSet64
        }
    })
}
`;

export const SCAN_STARTUP_SCRIPT = `
${PS_HELPERS}
${REGISTRY_SOURCES}
${BUILD_ENTRY}
${COLLECT_PROCESSES}

$RuxEntries = New-Object System.Collections.Generic.List[object]

foreach ($definition in $RuxSources) {
    $key = Get-Item -LiteralPath $definition.path -ErrorAction SilentlyContinue
    if ($null -eq $key) { continue }
    $approvals = @{}
    if ($definition.approvalHive) {
        $approvals = Get-RuxApprovalMap ($definition.approvalHive + ':\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\' + $definition.approvalKey)
    }
    foreach ($name in $key.GetValueNames()) {
        if ([string]::IsNullOrWhiteSpace($name)) { continue }
        $enabled = $true
        if ($approvals.ContainsKey($name)) { $enabled = [bool] $approvals[$name] }
        $RuxEntries.Add((New-RuxEntry -Name $name -Command ([string] $key.GetValue($name)) -Source $definition.source -Kind 'registry' -Elevation $definition.elevation -Enabled $enabled -Location $definition.path -ApprovalKey $definition.approvalKey -ApprovalHive $definition.approvalHive -TaskPath $null))
    }
}

$RuxShell = New-Object -ComObject WScript.Shell
$RuxFolders = @(
    @{ path = [Environment]::GetFolderPath('Startup'); source = 'startup-folder-user'; elevation = 'user'; hive = 'HKCU' }
    @{ path = [Environment]::GetFolderPath('CommonStartup'); source = 'startup-folder-machine'; elevation = 'administrator'; hive = 'HKLM' }
)

foreach ($folder in $RuxFolders) {
    if (-not $folder.path -or -not (Test-Path -LiteralPath $folder.path)) { continue }
    $approvals = Get-RuxApprovalMap ($folder.hive + ':\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\StartupApproved\\StartupFolder')
    $files = Get-ChildItem -LiteralPath $folder.path -File -ErrorAction SilentlyContinue | Where-Object { $_.Name -ne 'desktop.ini' }
    foreach ($file in $files) {
        $command = $file.FullName
        if ($file.Extension -eq '.lnk') {
            $link = $RuxShell.CreateShortcut($file.FullName)
            if ($link.TargetPath) {
                if ($link.Arguments) { $command = '"' + $link.TargetPath + '" ' + $link.Arguments }
                else { $command = '"' + $link.TargetPath + '"' }
            }
        }
        $enabled = $true
        if ($approvals.ContainsKey($file.Name)) { $enabled = [bool] $approvals[$file.Name] }
        $RuxEntries.Add((New-RuxEntry -Name $file.BaseName -Command $command -Source $folder.source -Kind 'folder' -Elevation $folder.elevation -Enabled $enabled -Location $file.FullName -ApprovalKey 'StartupFolder' -ApprovalHive $folder.hive -TaskPath $null))
    }
}

if ($RuxInput.includeTasks) {
    foreach ($task in (Get-ScheduledTask -ErrorAction SilentlyContinue)) {
        $triggerTypes = @($task.Triggers | ForEach-Object { $_.CimClass.CimClassName })
        if (-not ($triggerTypes -match 'LogonTrigger|BootTrigger')) { continue }
        $action = $task.Actions | Where-Object { $_.Execute } | Select-Object -First 1
        if ($null -eq $action) { continue }
        if ($action.Arguments) { $command = '"' + $action.Execute + '" ' + $action.Arguments }
        else { $command = '"' + $action.Execute + '"' }
        $RuxEntries.Add((New-RuxEntry -Name $task.TaskName -Command $command -Source 'scheduled-task' -Kind 'task' -Elevation 'administrator' -Enabled ($task.State -ne 'Disabled') -Location ($task.TaskPath + $task.TaskName) -ApprovalKey $null -ApprovalHive $null -TaskPath $task.TaskPath))
    }
}

$RuxIdentity = Get-RuxIdentity
${emitResult(`[pscustomobject]@{
    entries = @($RuxEntries.ToArray())
    processes = Get-RuxProcesses
    elevated = $RuxIdentity.elevated
    userName = $RuxIdentity.userName
    machineName = $env:COMPUTERNAME
}`)}
`;

export const SCAN_PROCESSES_SCRIPT = `
${COLLECT_PROCESSES}
${emitResult('[pscustomobject]@{ processes = Get-RuxProcesses }')}
`;

export const MUTATE_STARTUP_SCRIPT = `
${PS_HELPERS}

$entry = $RuxInput.entry
$mutation = $RuxInput.mutation

try {
    switch ($entry.kind) {
        'task' {
            $taskPath = $entry.taskPath
            if (-not $taskPath) { $taskPath = '\\' }
            switch ($mutation) {
                'enable'  { Enable-ScheduledTask -TaskName $entry.name -TaskPath $taskPath | Out-Null }
                'disable' { Disable-ScheduledTask -TaskName $entry.name -TaskPath $taskPath | Out-Null }
                'remove'  { Unregister-ScheduledTask -TaskName $entry.name -TaskPath $taskPath -Confirm:$false | Out-Null }
            }
        }
        'folder' {
            if ($mutation -eq 'remove') {
                if (-not (Test-Path -LiteralPath $entry.location)) { throw ('Shortcut not found: ' + $entry.location) }
                Remove-Item -LiteralPath $entry.location -Force
            } else {
                $valueName = [System.IO.Path]::GetFileName($entry.location)
                Set-RuxApprovalFlag -Hive $entry.approvalHive -ApprovalKey 'StartupFolder' -ValueName $valueName -Enabled ($mutation -eq 'enable')
            }
        }
        default {
            if ($mutation -eq 'remove') {
                if (-not (Test-Path -LiteralPath $entry.location)) { throw ('Registry key not found: ' + $entry.location) }
                Remove-ItemProperty -LiteralPath $entry.location -Name $entry.name -Force
            } else {
                if (-not $entry.approvalKey) { throw 'This entry type cannot be toggled; remove it instead.' }
                Set-RuxApprovalFlag -Hive $entry.approvalHive -ApprovalKey $entry.approvalKey -ValueName $entry.name -Enabled ($mutation -eq 'enable')
            }
        }
    }
    $RuxResult = [pscustomobject]@{ ok = $true; message = ($entry.name + ' -> ' + $mutation) }
} catch {
    $RuxResult = [pscustomobject]@{ ok = $false; message = $_.Exception.Message }
}

${emitResult('$RuxResult')}
`;
