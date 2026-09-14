import {describe, expect, it} from 'vitest';
import {createUseCases} from '@/application/use-cases';
import {bytes} from '@/domain/common';
import {RESIDUE_CLASSES} from '@/domain/residue';
import {JUNK_CATALOG} from '@/domain/services/junk-catalog';
import {
	aJunkFinding,
	aJunkTarget,
	aProcess,
	aRawStartupEntry,
	aResidueFinding,
	aStartupEntry,
	aWslStatus,
	capabilities,
	aHardwareReport,
} from '../helpers/builders';
import {
	fakeBackupPort,
	fakeHardwarePort,
	fakeJunkCleanPort,
	fakeJunkScanPort,
	fakePorts,
	fakeResidueRemovalPort,
	fakeResidueScanPort,
	fakeStartupInventoryPort,
	fakeStartupMutationPort,
	fakeWslPort,
} from '../helpers/fakes';

describe('ScanStartup', () => {
	it('correlates entries with processes and records the scan context', async () => {
		const entry = aRawStartupEntry();
		const port = fakeStartupInventoryPort([entry], [aProcess()]);
		const useCases = createUseCases(fakePorts({startupInventory: port}));

		const inventory = await useCases.scanStartup.execute(true);

		expect(port.calls).toEqual([true]);
		expect(inventory.entries[0]?.running).toBe(true);
		expect(inventory.entries[0]?.matchReason).toBe('path');
		expect(inventory.machineName).toBe('TESTBOX');
		expect(inventory.tasksIncluded).toBe(true);
		expect(Date.parse(inventory.scannedAt)).not.toBeNaN();
	});
});

describe('RefreshProcesses', () => {
	it('re-correlates without re-reading the entries', async () => {
		const entry = aRawStartupEntry();
		const port = fakeStartupInventoryPort([entry], [aProcess()]);
		const useCases = createUseCases(fakePorts({startupInventory: port}));

		const first = await useCases.scanStartup.execute(false);
		const refreshed = await useCases.refreshProcesses.execute(first);

		expect(port.calls).toHaveLength(1);
		expect(port.processCalls).toHaveLength(1);
		expect(refreshed.entries[0]?.running).toBe(true);
		expect(refreshed.machineName).toBe(first.machineName);
	});
});

describe('MutateStartupEntry', () => {
	it('passes the entry and the mutation through', async () => {
		const port = fakeStartupMutationPort();
		const useCases = createUseCases(fakePorts({startupMutation: port}));

		await useCases.mutateStartupEntry.execute(aStartupEntry(), 'disable');

		expect(port.calls[0]?.mutation).toBe('disable');
		expect(port.calls[0]?.entry.name).toBe('App');
	});

	it('surfaces a failure rather than swallowing it', async () => {
		const port = fakeStartupMutationPort(new Error('access denied'));
		const useCases = createUseCases(fakePorts({startupMutation: port}));

		await expect(useCases.mutateStartupEntry.execute(aStartupEntry(), 'remove')).rejects.toThrow(
			'access denied',
		);
	});
});

describe('ScanResidue', () => {
	it('scans every class by default', async () => {
		const port = fakeResidueScanPort([aResidueFinding()]);
		const useCases = createUseCases(fakePorts({residueScan: port}));

		const report = await useCases.scanResidue.execute();

		expect(port.calls[0]?.classes).toEqual(RESIDUE_CLASSES);
		expect(port.calls[0]?.deep).toBe(false);
		expect(report.classesScanned).toEqual(RESIDUE_CLASSES);
	});

	it('honours an explicit class list and deep mode', async () => {
		const port = fakeResidueScanPort();
		const useCases = createUseCases(fakePorts({residueScan: port}));

		const report = await useCases.scanResidue.execute(['service'], true);

		expect(port.calls[0]?.classes).toEqual(['service']);
		expect(report.deep).toBe(true);
	});
});

describe('RemoveResidue', () => {
	it('does nothing, and calls nothing, for an empty batch', async () => {
		const port = fakeResidueRemovalPort();
		const useCases = createUseCases(fakePorts({residueRemoval: port}));

		const result = await useCases.removeResidue.execute([], false);

		expect(port.calls).toHaveLength(0);
		expect(result).toEqual({removed: 0, failed: 0, backupId: null, receipts: []});
	});

	it('requests elevation when the batch needs it and the process lacks it', async () => {
		const port = fakeResidueRemovalPort();
		const useCases = createUseCases(fakePorts({residueRemoval: port}));

		await useCases.removeResidue.execute([aResidueFinding({elevation: 'administrator'})], false);

		expect(port.calls[0]?.elevate).toBe(true);
	});

	it('does not request elevation when already elevated', async () => {
		const port = fakeResidueRemovalPort();
		const useCases = createUseCases(fakePorts({residueRemoval: port}));

		await useCases.removeResidue.execute([aResidueFinding({elevation: 'administrator'})], true);

		expect(port.calls[0]?.elevate).toBe(false);
	});

	it('does not request elevation for user-level items', async () => {
		const port = fakeResidueRemovalPort();
		const useCases = createUseCases(fakePorts({residueRemoval: port}));

		await useCases.removeResidue.execute([aResidueFinding()], false);

		expect(port.calls[0]?.elevate).toBe(false);
	});
});

describe('ScanJunk', () => {
	it('measures the whole catalog by default', async () => {
		const port = fakeJunkScanPort([aJunkFinding()]);
		const useCases = createUseCases(fakePorts({junkScan: port}));

		await useCases.scanJunk.execute();

		expect(port.calls[0]).toEqual(JUNK_CATALOG);
	});

	it('drops locations that do not exist on this machine', async () => {
		const port = fakeJunkScanPort([
			aJunkFinding(),
			aJunkFinding({target: aJunkTarget({id: 'absent'}), exists: false}),
		]);
		const useCases = createUseCases(fakePorts({junkScan: port}));

		const report = await useCases.scanJunk.execute([aJunkTarget()]);

		expect(report.findings).toHaveLength(1);
		expect(report.findings[0]?.target.id).toBe('user-temp');
	});
});

describe('CleanJunk', () => {
	it('does nothing for an empty batch', async () => {
		const port = fakeJunkCleanPort();
		const useCases = createUseCases(fakePorts({junkClean: port}));

		const result = await useCases.cleanJunk.execute([], false);

		expect(port.calls).toHaveLength(0);
		expect(result.freedBytes).toBe(0);
	});

	it('requests elevation for machine-wide locations', async () => {
		const port = fakeJunkCleanPort();
		const useCases = createUseCases(fakePorts({junkClean: port}));

		await useCases.cleanJunk.execute(
			[aJunkFinding({target: aJunkTarget({elevation: 'administrator'})})],
			false,
		);

		expect(port.calls[0]?.elevate).toBe(true);
	});

	it('skips elevation when the process already has it', async () => {
		const port = fakeJunkCleanPort();
		const useCases = createUseCases(fakePorts({junkClean: port}));

		await useCases.cleanJunk.execute(
			[aJunkFinding({target: aJunkTarget({elevation: 'administrator'})})],
			true,
		);

		expect(port.calls[0]?.elevate).toBe(false);
	});
});

describe('AnalyzeHardware', () => {
	it('merges graphics, driver and WSL advice into one ordered list', async () => {
		const useCases = createUseCases(
			fakePorts({
				hardware: fakeHardwarePort(
					aHardwareReport({capabilities: capabilities({secureBoot: false, virtualizationEnabled: false})}),
				),
				wsl: fakeWslPort(aWslStatus()),
			}),
		);

		const analysis = await useCases.analyzeHardware.execute();
		const ids = analysis.recommendations.map(item => item.id);

		expect(ids).toContain('system.secure-boot-off');
		expect(ids).toContain('wsl.virtualization-off');
		expect(analysis.wsl).not.toBeNull();
		// Sorted by impact: the critical WSL blocker comes first.
		expect(analysis.recommendations[0]?.impact).toBe('critical');
	});

	it('reports no WSL status when WSL is not installed', async () => {
		const useCases = createUseCases(fakePorts({wsl: fakeWslPort(aWslStatus({installed: false}))}));

		const analysis = await useCases.analyzeHardware.execute();

		expect(analysis.wsl).toBeNull();
		expect(analysis.recommendations.every(item => item.area !== 'wsl')).toBe(true);
	});
});

describe('ManageBackups', () => {
	it('lists, restores and purges through the port', async () => {
		const port = fakeBackupPort(
			[
				{
					backupId: 'b1',
					createdAt: '2026-09-14T00:00:00.000Z',
					location: 'C:\\b1',
					itemCount: 2,
					titles: ['a'],
				},
			],
			{restored: 2, failed: 0, receipts: []},
		);
		const useCases = createUseCases(fakePorts({backup: port}));

		expect(await useCases.manageBackups.list()).toHaveLength(1);
		expect((await useCases.manageBackups.restore('b1')).restored).toBe(2);
		await useCases.manageBackups.purge('b1');

		expect(port.restored).toEqual(['b1']);
		expect(port.purged).toEqual(['b1']);
	});
});

describe('createUseCases', () => {
	it('wires every use case from one set of ports', () => {
		const useCases = createUseCases(fakePorts());
		expect(Object.keys(useCases)).toEqual([
			'scanStartup',
			'refreshProcesses',
			'mutateStartupEntry',
			'scanResidue',
			'removeResidue',
			'scanJunk',
			'cleanJunk',
			'analyzeHardware',
			'manageBackups',
		]);
	});

	it('keeps byte sizes branded through the pipeline', async () => {
		const useCases = createUseCases(
			fakePorts({junkScan: fakeJunkScanPort([aJunkFinding({sizeBytes: bytes(2048)})])}),
		);
		const report = await useCases.scanJunk.execute([aJunkTarget()]);
		expect(report.findings[0]?.sizeBytes).toBe(2048);
	});
});
