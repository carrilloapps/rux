import {describe, expect, it} from 'vitest';
import {createHardwareAdapter} from '@/infrastructure/adapters/hardware-adapter';
import {createJunkCleanAdapter, createJunkScanAdapter} from '@/infrastructure/adapters/junk-adapter';
import {
	createBackupAdapter,
	createResidueRemovalAdapter,
	createResidueScanAdapter,
} from '@/infrastructure/adapters/residue-adapter';
import {
	createStartupInventoryAdapter,
	createStartupMutationAdapter,
} from '@/infrastructure/adapters/startup-adapter';
import {createWslAdapter} from '@/infrastructure/adapters/wsl-adapter';
import {aJunkFinding, aJunkTarget, aRawStartupEntry, aResidueFinding} from '@tests/helpers/builders';
import {fakeRunner} from '@tests/helpers/fakes';

/**
 * These cover the layer where shape bugs live: the schemas that absorb
 * PowerShell output and the mapping into domain objects. The payloads below are
 * the shapes the real scripts emit, including the single-item collections that
 * ConvertTo-Json flattens into bare objects.
 */

const STARTUP_PAYLOAD = {
	entries: {
		id: 'run-user::App',
		name: 'App',
		command: '"C:\\App\\app.exe"',
		executablePath: 'C:\\App\\app.exe',
		executableName: 'app.exe',
		source: 'run-user',
		kind: 'registry',
		elevation: 'user',
		enabled: true,
		location: 'HKCU:\\Run',
		approvalKey: 'Run',
		approvalHive: 'HKCU',
		taskPath: null,
		executableExists: true,
		publisher: 'Acme',
		fileSizeBytes: 2048,
		modifiedAt: '2026-01-01T00:00:00.000Z',
	},
	processes: {pid: 10, name: 'app', executablePath: 'C:\\App\\app.exe', memoryBytes: 4096},
	elevated: false,
	userName: 'TESTBOX\\tester',
	machineName: 'TESTBOX',
};

describe('startup inventory adapter', () => {
	it('accepts the bare objects ConvertTo-Json emits for single-item collections', async () => {
		const result = await createStartupInventoryAdapter(fakeRunner([STARTUP_PAYLOAD])).readStartupEntries(
			false,
		);

		expect(result.entries).toHaveLength(1);
		expect(result.processes).toHaveLength(1);
		expect(result.machineName).toBe('TESTBOX');
	});

	it('passes the scheduled-task flag to the script', async () => {
		const runner = fakeRunner([STARTUP_PAYLOAD]);
		await createStartupInventoryAdapter(runner).readStartupEntries(true);
		expect(runner.parameters[0]).toEqual({includeTasks: true});
	});

	it('normalises absent sizes and empty publishers to null', async () => {
		const runner = fakeRunner([
			{...STARTUP_PAYLOAD, entries: {...STARTUP_PAYLOAD.entries, fileSizeBytes: null, publisher: ''}},
		]);

		const result = await createStartupInventoryAdapter(runner).readStartupEntries(false);

		expect(result.entries[0]?.fileSizeBytes).toBeNull();
		expect(result.entries[0]?.publisher).toBeNull();
	});

	it('reads the process table on its own', async () => {
		const runner = fakeRunner([{processes: STARTUP_PAYLOAD.processes}]);
		const processes = await createStartupInventoryAdapter(runner).readProcesses();
		expect(processes[0]?.memoryBytes).toBe(4096);
	});
});

describe('startup mutation adapter', () => {
	it('sends the entry and the mutation to the script', async () => {
		const runner = fakeRunner([{ok: true, message: 'App -> disable'}]);

		await createStartupMutationAdapter(runner).mutate(aRawStartupEntry(), 'disable');

		const parameters = runner.parameters[0] as {mutation: string; entry: {name: string}};
		expect(parameters.mutation).toBe('disable');
		expect(parameters.entry.name).toBe('App');
	});

	it('turns a reported failure into an error', async () => {
		const runner = fakeRunner([{ok: false, message: 'access denied'}]);

		await expect(createStartupMutationAdapter(runner).mutate(aRawStartupEntry(), 'remove')).rejects.toThrow(
			'access denied',
		);
	});
});

describe('residue scan adapter', () => {
	const finding = {
		id: 'abc',
		residueClass: 'service',
		title: 'Ghost Service',
		reasonKey: 'residue.reasons.service',
		reasonValues: {displayName: 'Ghost', state: 'Stopped'},
		evidence: 'C:\\Gone\\ghost.exe',
		risk: 'safe',
		elevation: 'administrator',
		sizeBytes: 0,
		removalKind: 'service',
		removalTarget: 'GhostSvc',
		removalValueName: null,
		removalTaskPath: null,
	};

	it('maps a finding into its domain shape', async () => {
		const runner = fakeRunner([{findings: [finding], elevated: false}]);

		const result = await createResidueScanAdapter(runner).scan(['service'], false);

		expect(result.findings[0]?.reason).toEqual({
			key: 'residue.reasons.service',
			values: {displayName: 'Ghost', state: 'Stopped'},
		});
		expect(result.findings[0]?.removal.kind).toBe('service');
		expect(result.findings[0]?.elevation).toBe('administrator');
	});

	it('tolerates an absent reasonValues object', async () => {
		const runner = fakeRunner([{findings: [{...finding, reasonValues: null}], elevated: false}]);

		const result = await createResidueScanAdapter(runner).scan(['service'], false);

		expect(result.findings[0]?.reason.values).toEqual({});
	});

	it('forwards the requested classes and the deep flag', async () => {
		const runner = fakeRunner([{findings: [], elevated: true}]);

		const result = await createResidueScanAdapter(runner).scan(['startup', 'task'], true);

		expect(runner.parameters[0]).toEqual({classes: ['startup', 'task'], deep: true});
		expect(result.elevated).toBe(true);
	});
});

describe('residue removal adapter', () => {
	const outcome = {
		removed: 1,
		failed: 0,
		backupId: '20260914-000000-abcd',
		receipts: {id: 'abc', ok: true, message: 'Ghost'},
	};

	it('flattens findings into removal descriptors', async () => {
		const runner = fakeRunner([outcome]);

		const result = await createResidueRemovalAdapter(runner).remove([aResidueFinding()], false);

		const parameters = runner.parameters[0] as {items: Array<{kind: string; valueName: string | null}>};
		expect(parameters.items[0]?.kind).toBe('registryValue');
		expect(parameters.items[0]?.valueName).toBe('Ghost');
		expect(result.backupId).toBe('20260914-000000-abcd');
		expect(result.receipts).toHaveLength(1);
	});

	it('routes through the elevated transport when asked', async () => {
		const runner = fakeRunner([outcome]);

		await createResidueRemovalAdapter(runner).remove([aResidueFinding()], true);

		expect(runner.elevatedCalls).toBe(1);
	});
});

describe('backup adapter', () => {
	it('lists backups, flattening a single title', async () => {
		const runner = fakeRunner([
			{
				backups: {
					backupId: 'b1',
					createdAt: '2026-09-14T00:00:00.000Z',
					location: 'C:\\b1',
					itemCount: 1,
					titles: 'Ghost',
				},
			},
		]);

		const backups = await createBackupAdapter(runner).list();

		expect(backups[0]?.titles).toEqual(['Ghost']);
	});

	it('distinguishes restoring from purging', async () => {
		const runner = fakeRunner([{restored: 1, failed: 0, receipts: []}]);
		const adapter = createBackupAdapter(runner);

		const result = await adapter.restore('b1');
		await adapter.purge('b1');

		expect(result.restored).toBe(1);
		expect((runner.parameters[0] as {purge: boolean}).purge).toBe(false);
		expect((runner.parameters[1] as {purge: boolean}).purge).toBe(true);
	});
});

describe('junk scan adapter', () => {
	it('joins measurements back onto their targets', async () => {
		const runner = fakeRunner([
			{
				measurements: {
					targetId: 'user-temp',
					resolvedPath: 'C:\\Temp',
					exists: true,
					fileCount: 3,
					sizeBytes: 900,
					note: null,
				},
			},
		]);

		const findings = await createJunkScanAdapter(runner).measure([aJunkTarget()]);

		expect(findings[0]?.target.id).toBe('user-temp');
		expect(findings[0]?.sizeBytes).toBe(900);
		expect(findings[0]?.note).toBeNull();
	});

	it('drops a measurement for a target it was not asked about', async () => {
		const runner = fakeRunner([
			{
				measurements: {
					targetId: 'unknown',
					resolvedPath: null,
					exists: true,
					fileCount: 0,
					sizeBytes: 0,
					note: null,
				},
			},
		]);

		const findings = await createJunkScanAdapter(runner).measure([aJunkTarget()]);

		expect(findings).toHaveLength(0);
	});

	it('carries a partial-read note through as a localizable key', async () => {
		const runner = fakeRunner([
			{
				measurements: {
					targetId: 'user-temp',
					resolvedPath: null,
					exists: true,
					fileCount: 0,
					sizeBytes: 0,
					note: 'junk.notes.partialRead',
				},
			},
		]);

		const findings = await createJunkScanAdapter(runner).measure([aJunkTarget()]);

		expect(findings[0]?.note).toEqual({key: 'junk.notes.partialRead'});
		// With no resolved path the adapter falls back to the unexpanded one.
		expect(findings[0]?.resolvedPath).toBe('%LOCALAPPDATA%\\Temp');
	});
});

describe('junk clean adapter', () => {
	it('sends only the fields the script reads', async () => {
		const runner = fakeRunner([{cleared: 1, failed: 0, freedBytes: 900, receipts: []}]);

		await createJunkCleanAdapter(runner).clean([aJunkFinding()], false);

		const parameters = runner.parameters[0] as {targets: Array<Record<string, unknown>>};
		expect(Object.keys(parameters.targets[0] ?? {})).toEqual([
			'id',
			'path',
			'sweep',
			'minimumAgeDays',
			'extensions',
		]);
	});

	it('routes through the elevated transport when asked', async () => {
		const runner = fakeRunner([{cleared: 1, failed: 0, freedBytes: 900, receipts: []}]);

		const result = await createJunkCleanAdapter(runner).clean([aJunkFinding()], true);

		expect(runner.elevatedCalls).toBe(1);
		expect(result.freedBytes).toBe(900);
	});
});

describe('wsl adapter', () => {
	const installed = {
		installed: true,
		defaultVersion: 2,
		kernelVersion: '5.15.153.1',
		distributions: {name: 'Ubuntu', version: 2, state: 'Running', isDefault: true},
		config: {
			exists: true,
			path: 'C:\\Users\\tester\\.wslconfig',
			memoryBytes: 17179869184,
			processors: 8,
			swapBytes: 0,
			nestedVirtualization: true,
			gpuSupport: null,
			guiApplications: true,
			sparseVhd: false,
			otherKeys: 'kernel',
		},
		running: true,
	};

	it('maps an installed WSL into its domain shape', async () => {
		const status = await createWslAdapter(fakeRunner([installed])).inspect();

		expect(status.defaultVersion).toBe(2);
		expect(status.distributions[0]?.name).toBe('Ubuntu');
		expect(status.config.memoryBytes).toBe(17179869184);
		expect(status.config.gpuSupport).toBeNull();
		expect(status.config.otherKeys).toEqual(['kernel']);
		expect(status.running).toBe(true);
	});

	it('keeps an explicit zero swap distinct from an unset one', async () => {
		const status = await createWslAdapter(fakeRunner([installed])).inspect();
		expect(status.config.swapBytes).toBe(0);
	});

	it('normalises an unusable default version to null', async () => {
		const status = await createWslAdapter(fakeRunner([{...installed, defaultVersion: 9}])).inspect();
		expect(status.defaultVersion).toBeNull();
	});

	it('reports an absent WSL without inventing a configuration', async () => {
		const runner = fakeRunner([
			{
				installed: false,
				defaultVersion: null,
				kernelVersion: null,
				distributions: [],
				config: {
					...installed.config,
					exists: false,
					memoryBytes: null,
					processors: null,
					swapBytes: null,
					otherKeys: [],
				},
				running: false,
			},
		]);

		const status = await createWslAdapter(runner).inspect();

		expect(status.installed).toBe(false);
		expect(status.distributions).toEqual([]);
		expect(status.config.memoryBytes).toBeNull();
	});
});

describe('hardware adapter', () => {
	it('exposes an inspect operation built from a runner', () => {
		expect(typeof createHardwareAdapter(fakeRunner([{}])).inspect).toBe('function');
	});
});
