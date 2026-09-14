import {z} from 'zod';
import {bytes} from '@/domain/common';
import type {JunkFinding, JunkTarget} from '@/domain/junk';
import type {JunkCleanPort, JunkCleanResult, JunkScanPort} from '@/application/ports';
import type {PowerShellRunner} from '@/infrastructure/powershell/runner';
import {psArray, psCount, psString, psText} from '@/infrastructure/powershell/schema';
import {CLEAN_JUNK_SCRIPT, MEASURE_JUNK_SCRIPT} from '@/infrastructure/powershell/scripts/junk';

const measurementSchema = z.object({
	targetId: z.string(),
	resolvedPath: psString,
	exists: z.boolean(),
	fileCount: psCount(0),
	sizeBytes: psCount(0),
	note: psString,
});

const measureSchema = z.object({measurements: psArray(measurementSchema)});

const receiptSchema = z.object({
	id: psText(''),
	ok: z.boolean(),
	message: psText(''),
});

const cleanSchema = z.object({
	cleared: z.number(),
	failed: z.number(),
	freedBytes: psCount(0),
	receipts: psArray(receiptSchema),
});

/** Only the fields the script reads, so parameter payloads stay small. */
function toScriptTarget(target: JunkTarget) {
	return {
		id: target.id,
		path: target.path,
		sweep: target.sweep,
		minimumAgeDays: target.minimumAgeDays,
		extensions: target.extensions,
	};
}

export function createJunkScanAdapter(runner: PowerShellRunner): JunkScanPort {
	return {
		async measure(targets: readonly JunkTarget[]): Promise<readonly JunkFinding[]> {
			const payload = await runner.json(MEASURE_JUNK_SCRIPT, measureSchema, {
				targets: targets.map(toScriptTarget),
			});

			const byId = new Map(targets.map(target => [target.id, target]));
			const findings: JunkFinding[] = [];

			for (const measurement of payload.measurements) {
				const target = byId.get(measurement.targetId);
				if (!target) continue;
				findings.push({
					target,
					resolvedPath: measurement.resolvedPath ?? target.path,
					exists: measurement.exists,
					fileCount: measurement.fileCount,
					sizeBytes: bytes(measurement.sizeBytes),
					note: measurement.note ? {key: measurement.note} : null,
				});
			}

			return findings;
		},
	};
}

export function createJunkCleanAdapter(runner: PowerShellRunner): JunkCleanPort {
	return {
		async clean(findings: readonly JunkFinding[], elevate: boolean): Promise<JunkCleanResult> {
			const parameters = {targets: findings.map(finding => toScriptTarget(finding.target))};
			const payload = elevate
				? await runner.elevatedJson(CLEAN_JUNK_SCRIPT, cleanSchema, parameters)
				: await runner.json(CLEAN_JUNK_SCRIPT, cleanSchema, parameters);
			return payload;
		},
	};
}
