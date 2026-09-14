/* eslint-disable @typescript-eslint/no-unsafe-return --
 * Mirrors the suppression on the real runner: these helpers are generic
 * over a Zod schema, so `z.output<S>` is `any` while the generic is
 * unresolved even though every call site receives a fully typed value.
 */
import type {ZodTypeAny, output as ZodOutput} from 'zod';
import type {
	BackupPort,
	BackupSummary,
	HardwarePort,
	JunkCleanPort,
	JunkCleanResult,
	JunkScanPort,
	Ports,
	RemovalResult,
	ResidueRemovalPort,
	ResidueScanPort,
	RestoreResult,
	StartupInventoryPort,
	StartupMutation,
	StartupMutationPort,
	WslPort,
} from '@/application/ports';
import type {HardwareReport} from '@/domain/hardware';
import type {JunkFinding, JunkTarget} from '@/domain/junk';
import type {ResidueClass, ResidueFinding} from '@/domain/residue';
import type {ProcessInfo, RawStartupEntry} from '@/domain/startup';
import type {WslStatus} from '@/domain/wsl';
import type {PowerShellRunner} from '@/infrastructure/powershell/runner';
import {aHardwareReport, aWslStatus} from '@tests/helpers/builders';

/**
 * In-memory doubles for every port and for the PowerShell transport.
 *
 * They record what they were called with, so a test can assert the wiring a use
 * case performs without touching Windows.
 */

export interface RecordedCall<T> {
	readonly calls: T[];
}

export function fakeStartupInventoryPort(
	entries: readonly RawStartupEntry[] = [],
	processes: readonly ProcessInfo[] = [],
): StartupInventoryPort & {readonly calls: boolean[]; readonly processCalls: number[]} {
	const calls: boolean[] = [];
	const processCalls: number[] = [];
	return {
		calls,
		processCalls,
		async readStartupEntries(includeTasks: boolean) {
			calls.push(includeTasks);
			return {
				entries,
				processes,
				elevated: false,
				machineName: 'TESTBOX',
				userName: 'TESTBOX\\tester',
			};
		},
		async readProcesses() {
			processCalls.push(processCalls.length);
			return processes;
		},
	};
}

export function fakeStartupMutationPort(
	failWith?: Error,
): StartupMutationPort & {readonly calls: Array<{entry: RawStartupEntry; mutation: StartupMutation}>} {
	const calls: Array<{entry: RawStartupEntry; mutation: StartupMutation}> = [];
	return {
		calls,
		async mutate(entry, mutation) {
			calls.push({entry, mutation});
			if (failWith) throw failWith;
		},
	};
}

export function fakeResidueScanPort(
	findings: readonly ResidueFinding[] = [],
	elevated = false,
): ResidueScanPort & {readonly calls: Array<{classes: readonly ResidueClass[]; deep: boolean}>} {
	const calls: Array<{classes: readonly ResidueClass[]; deep: boolean}> = [];
	return {
		calls,
		async scan(classes, deep) {
			calls.push({classes, deep});
			return {findings, elevated};
		},
	};
}

export function fakeResidueRemovalPort(
	result: RemovalResult = {removed: 0, failed: 0, backupId: null, receipts: []},
): ResidueRemovalPort & {readonly calls: Array<{findings: readonly ResidueFinding[]; elevate: boolean}>} {
	const calls: Array<{findings: readonly ResidueFinding[]; elevate: boolean}> = [];
	return {
		calls,
		async remove(findings, elevate) {
			calls.push({findings, elevate});
			return result;
		},
	};
}

export function fakeJunkScanPort(
	findings: readonly JunkFinding[] = [],
): JunkScanPort & {readonly calls: Array<readonly JunkTarget[]>} {
	const calls: Array<readonly JunkTarget[]> = [];
	return {
		calls,
		async measure(targets) {
			calls.push(targets);
			return findings;
		},
	};
}

export function fakeJunkCleanPort(
	result: JunkCleanResult = {cleared: 0, failed: 0, freedBytes: 0, receipts: []},
): JunkCleanPort & {readonly calls: Array<{findings: readonly JunkFinding[]; elevate: boolean}>} {
	const calls: Array<{findings: readonly JunkFinding[]; elevate: boolean}> = [];
	return {
		calls,
		async clean(findings, elevate) {
			calls.push({findings, elevate});
			return result;
		},
	};
}

export function fakeHardwarePort(report: HardwareReport = aHardwareReport()): HardwarePort {
	return {
		async inspect() {
			return report;
		},
	};
}

export function fakeWslPort(status: WslStatus = aWslStatus({installed: false})): WslPort {
	return {
		async inspect() {
			return status;
		},
	};
}

export function fakeBackupPort(
	backups: readonly BackupSummary[] = [],
	restore: RestoreResult = {restored: 0, failed: 0, receipts: []},
): BackupPort & {readonly purged: string[]; readonly restored: string[]} {
	const purged: string[] = [];
	const restored: string[] = [];
	return {
		purged,
		restored,
		async list() {
			return backups;
		},
		async restore(backupId) {
			restored.push(backupId);
			return restore;
		},
		async purge(backupId) {
			purged.push(backupId);
		},
	};
}

/** A complete set of ports, all inert unless a test replaces one. */
export function fakePorts(overrides: Partial<Ports> = {}): Ports {
	return {
		startupInventory: fakeStartupInventoryPort(),
		startupMutation: fakeStartupMutationPort(),
		residueScan: fakeResidueScanPort(),
		residueRemoval: fakeResidueRemovalPort(),
		junkScan: fakeJunkScanPort(),
		junkClean: fakeJunkCleanPort(),
		hardware: fakeHardwarePort(),
		wsl: fakeWslPort(),
		backup: fakeBackupPort(),
		...overrides,
	};
}

export interface FakeRunner extends PowerShellRunner {
	readonly scripts: string[];
	readonly parameters: unknown[];
	readonly elevatedCalls: number;
}

/**
 * A PowerShell runner that returns canned payloads.
 *
 * The payload is still validated against the real schema, so these tests cover
 * the parsing and mapping layer exactly as production would run it.
 */
export function fakeRunner(payloads: unknown[], options: {failElevated?: boolean} = {}): FakeRunner {
	const scripts: string[] = [];
	const parameters: unknown[] = [];
	let elevatedCalls = 0;
	let index = 0;

	const next = <S extends ZodTypeAny>(script: string, schema: S, params?: unknown): ZodOutput<S> => {
		scripts.push(script);
		parameters.push(params);
		const payload = payloads[Math.min(index, payloads.length - 1)];
		index += 1;
		return schema.parse(payload) as ZodOutput<S>;
	};

	return {
		get scripts() {
			return scripts;
		},
		get parameters() {
			return parameters;
		},
		get elevatedCalls() {
			return elevatedCalls;
		},
		async json(script, schema, params) {
			return next(script, schema, params);
		},
		async elevatedJson(script, schema, params) {
			elevatedCalls += 1;
			if (options.failElevated === true) throw new Error('elevation declined');
			return next(script, schema, params);
		},
	};
}
