import {emitResult} from '@/infrastructure/powershell/runner';
import {PS_HELPERS} from '@/infrastructure/powershell/scripts/helpers';

/**
 * Measuring and clearing share one traversal rule, so it lives in one place:
 * a file is eligible only when it is older than the target's minimum age and,
 * when the target restricts extensions, carries one of them.
 */
const TRAVERSAL = `
function Test-RuxEligible {
    param($File, $Target, [datetime] $Cutoff)
    if ($File.LastWriteTime -gt $Cutoff) { return $false }
    if ($Target.extensions) {
        $extension = $File.Extension.ToLowerInvariant()
        if (-not (@($Target.extensions) -contains $extension)) { return $false }
    }
    return $true
}

function Get-RuxCutoff {
    param($Target)
    return (Get-Date).AddDays(-1 * [double] $Target.minimumAgeDays)
}

function Measure-RuxRecycleBin {
    $shell = New-Object -ComObject Shell.Application
    $bin = $shell.Namespace(0xA)
    $total = [int64] 0
    $count = 0
    if ($bin) {
        foreach ($item in $bin.Items()) {
            $count = $count + 1
            $total = $total + [int64] $item.Size
        }
    }
    return [pscustomobject]@{ fileCount = $count; sizeBytes = $total }
}
`;

export const MEASURE_JUNK_SCRIPT = `
${PS_HELPERS}
${TRAVERSAL}

$RuxResults = New-Object System.Collections.Generic.List[object]

foreach ($target in $RuxInput.targets) {
    $resolved = Expand-RuxPath $target.path
    $exists = $false
    $fileCount = 0
    $sizeBytes = [int64] 0
    $note = $null

    try {
        if ($target.sweep -eq 'recycle-bin') {
            $measured = Measure-RuxRecycleBin
            $exists = $true
            $fileCount = $measured.fileCount
            $sizeBytes = $measured.sizeBytes
        } elseif ($resolved -and (Test-Path -LiteralPath $resolved)) {
            $exists = $true
            $item = Get-Item -LiteralPath $resolved -Force -ErrorAction SilentlyContinue
            $cutoff = Get-RuxCutoff $target

            if ($item -and -not $item.PSIsContainer) {
                if (Test-RuxEligible -File $item -Target $target -Cutoff $cutoff) {
                    $fileCount = 1
                    $sizeBytes = [int64] $item.Length
                }
            } else {
                $files = Get-ChildItem -LiteralPath $resolved -Recurse -File -Force -ErrorAction SilentlyContinue
                foreach ($file in $files) {
                    if (Test-RuxEligible -File $file -Target $target -Cutoff $cutoff) {
                        $fileCount = $fileCount + 1
                        $sizeBytes = $sizeBytes + [int64] $file.Length
                    }
                }
            }
        }
    } catch {
        $note = 'junk.notes.partialRead'
    }

    $RuxResults.Add([pscustomobject]@{
        targetId = $target.id
        resolvedPath = $resolved
        exists = $exists
        fileCount = $fileCount
        sizeBytes = $sizeBytes
        note = $note
    })
}

${emitResult('[pscustomobject]@{ measurements = @($RuxResults.ToArray()) }')}
`;

export const CLEAN_JUNK_SCRIPT = `
${PS_HELPERS}
${TRAVERSAL}

$receipts = New-Object System.Collections.Generic.List[object]
$freed = [int64] 0

foreach ($target in $RuxInput.targets) {
    $resolved = Expand-RuxPath $target.path
    $cleared = 0
    $errors = 0

    try {
        if ($target.sweep -eq 'recycle-bin') {
            # Clear-RecycleBin is the only supported way to empty it; the shell
            # owns the index and deleting the folder by hand corrupts it.
            Clear-RecycleBin -Force -ErrorAction Stop
            $receipts.Add([pscustomobject]@{ id = $target.id; ok = $true; message = $target.id })
            continue
        }

        if (-not $resolved -or -not (Test-Path -LiteralPath $resolved)) {
            $receipts.Add([pscustomobject]@{ id = $target.id; ok = $false; message = 'Path not found' })
            continue
        }

        $cutoff = Get-RuxCutoff $target
        $item = Get-Item -LiteralPath $resolved -Force -ErrorAction SilentlyContinue

        if ($target.sweep -eq 'entry') {
            $size = [int64] 0
            if ($item.PSIsContainer) {
                $sum = (Get-ChildItem -LiteralPath $resolved -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum
                if ($sum) { $size = [int64] $sum }
            } else {
                $size = [int64] $item.Length
            }
            Remove-Item -LiteralPath $resolved -Recurse -Force -ErrorAction Stop
            $freed = $freed + $size
            $cleared = 1
        } else {
            # 'contents': empty the folder but keep it, because Windows recreates
            # files inside these locations lazily and expects the folder to exist.
            $files = Get-ChildItem -LiteralPath $resolved -Recurse -File -Force -ErrorAction SilentlyContinue
            foreach ($file in $files) {
                if (-not (Test-RuxEligible -File $file -Target $target -Cutoff $cutoff)) { continue }
                try {
                    $size = [int64] $file.Length
                    Remove-Item -LiteralPath $file.FullName -Force -ErrorAction Stop
                    $freed = $freed + $size
                    $cleared = $cleared + 1
                } catch {
                    # Files held open by a running process are expected here and
                    # are not a failure of the sweep.
                    $errors = $errors + 1
                }
            }

            # Remove directories that the sweep emptied, deepest first.
            $directories = Get-ChildItem -LiteralPath $resolved -Recurse -Directory -Force -ErrorAction SilentlyContinue | Sort-Object { $_.FullName.Length } -Descending
            foreach ($directory in $directories) {
                $remaining = Get-ChildItem -LiteralPath $directory.FullName -Force -ErrorAction SilentlyContinue | Select-Object -First 1
                if ($null -eq $remaining) {
                    Remove-Item -LiteralPath $directory.FullName -Force -Recurse -ErrorAction SilentlyContinue
                }
            }
        }

        $message = [string] $cleared
        if ($errors -gt 0) { $message = $message + ' (' + $errors + ' in use)' }
        $receipts.Add([pscustomobject]@{ id = $target.id; ok = $true; message = $message })
    } catch {
        $receipts.Add([pscustomobject]@{ id = $target.id; ok = $false; message = $_.Exception.Message })
    }
}

$cleared = @($receipts.ToArray() | Where-Object { $_.ok }).Count
${emitResult(`[pscustomobject]@{
    cleared = $cleared
    failed = ($receipts.Count - $cleared)
    freedBytes = $freed
    receipts = @($receipts.ToArray())
}`)}
`;
