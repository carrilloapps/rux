import {z} from 'zod';
import {bytes} from '@/domain/common';
import type {ResidueClass, ResidueFinding} from '@/domain/residue';
import {RESIDUE_CLASSES} from '@/domain/residue';
import type {
	BackupPort,
	BackupSummary,
	RemovalResult,
	ResidueRemovalPort,
	ResidueScanPort,
	RestoreResult,
} from '@/application/ports';
import type {PowerShellRunner} from '@/infrastructure/powershell/runner';
import {psArray, psCount, psString, psText} from '@/infrastructure/powershell/schema';
import {SCAN_RESIDUE_SCRIPT} from '@/infrastructure/powershell/scripts/residue';
import {
	LIST_BACKUPS_SCRIPT,
	REMOVE_RESIDUE_SCRIPT,
	RESTORE_BACKUP_SCRIPT,
} from '@/infrastructure/powershell/scripts/removal';

const findingSchema = z.object({
	id: z.string(),
	residueClass: z.enum(RESIDUE_CLASSES),
	title: z.string(),
	reasonKey: z.string(),
	reasonValues: z
		.record(z.string(), z.union([z.string(), z.number()]))
		.nullish()
		.transform(v => v ?? {}),
	evidence: psString,
	risk: z.enum(['safe', 'review', 'sensitive']),
	elevation: z.enum(['user', 'administrator']),
	sizeBytes: psCount(0),
	removalKind: z.enum(['registryValue', 'registryKey', 'path', 'service', 'task', 'firewall']),
	removalTarget: z.string(),
	removalValueName: psString,
	removalTaskPath: psString,
});

const scanSchema = z.object({
	findings: psArray(findingSchema),
	elevated: z.boolean(),
});

const receiptSchema = z.object({
	id: psText(''),
	ok: z.boolean(),
	message: psText(''),
});

const removalSchema = z.object({
	removed: z.number(),
	failed: z.number(),
	backupId: psString,
	receipts: psArray(receiptSchema),
});

const backupSchema = z.object({
	backupId: z.string(),
	createdAt: z.string(),
	location: z.string(),
	itemCount: z.number(),
	titles: psArray(z.string()),
});

const backupListSchema = z.object({backups: psArray(backupSchema)});

const restoreSchema = z.object({
	restored: z.number(),
	failed: z.number(),
	receipts: psArray(receiptSchema),
});

function toFinding(raw: z.infer<typeof findingSchema>): ResidueFinding {
	return {
		id: raw.id,
		residueClass: raw.residueClass,
		title: raw.title,
		reason: {key: raw.reasonKey, values: raw.reasonValues},
		evidence: raw.evidence,
		risk: raw.risk,
		sizeBytes: bytes(raw.sizeBytes),
		elevation: raw.elevation,
		removal: {
			kind: raw.removalKind,
			target: raw.removalTarget,
			valueName: raw.removalValueName,
			taskPath: raw.removalTaskPath,
		},
	};
}

export function createResidueScanAdapter(runner: PowerShellRunner): ResidueScanPort {
	return {
		async scan(classes: readonly ResidueClass[], deep: boolean) {
			const payload = await runner.json(SCAN_RESIDUE_SCRIPT, scanSchema, {classes, deep});
			return {findings: payload.findings.map(toFinding), elevated: payload.elevated};
		},
	};
}

export function createResidueRemovalAdapter(runner: PowerShellRunner): ResidueRemovalPort {
	return {
		async remove(findings: readonly ResidueFinding[], elevate: boolean): Promise<RemovalResult> {
			const items = findings.map(finding => ({
				id: finding.id,
				title: finding.title,
				kind: finding.removal.kind,
				target: finding.removal.target,
				valueName: finding.removal.valueName,
				taskPath: finding.removal.taskPath,
			}));

			const parameters = {items, backupRoot: null};
			const payload = elevate
				? await runner.elevatedJson(REMOVE_RESIDUE_SCRIPT, removalSchema, parameters)
				: await runner.json(REMOVE_RESIDUE_SCRIPT, removalSchema, parameters);

			return {
				removed: payload.removed,
				failed: payload.failed,
				backupId: payload.backupId,
				receipts: payload.receipts,
			};
		},
	};
}

export function createBackupAdapter(runner: PowerShellRunner): BackupPort {
	return {
		async list(): Promise<readonly BackupSummary[]> {
			const payload = await runner.json(LIST_BACKUPS_SCRIPT, backupListSchema, {backupRoot: null});
			return payload.backups;
		},

		async restore(backupId: string): Promise<RestoreResult> {
			const payload = await runner.json(RESTORE_BACKUP_SCRIPT, restoreSchema, {
				backupId,
				purge: false,
				backupRoot: null,
			});
			return payload;
		},

		async purge(backupId: string): Promise<void> {
			await runner.json(RESTORE_BACKUP_SCRIPT, restoreSchema, {backupId, purge: true, backupRoot: null});
		},
	};
}
