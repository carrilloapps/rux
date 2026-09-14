import {beforeEach, describe, expect, it, vi} from 'vitest';
import {createUseCases} from '@/application/use-cases';
import {bytes} from '@/domain/common';
import {
	runBackupsReport,
	runCleanReport,
	runHardwareReport,
	runJunkReport,
	runPurge,
	runRestore,
	runStartupReport,
	type CommandContext,
} from '@/presentation/cli/commands';
import type {CliOptions} from '@/presentation/cli/options';
import {aJunkFinding, aJunkTarget, aRawStartupEntry, aResidueFinding} from '../../helpers/builders';
import {
	fakeBackupPort,
	fakeJunkCleanPort,
	fakeJunkScanPort,
	fakePorts,
	fakeResidueRemovalPort,
	fakeResidueScanPort,
	fakeStartupInventoryPort,
} from '../../helpers/fakes';

vi.mock('@/presentation/config', () => ({
	createPreferenceStore: () => ({
		getLocale: () => 'en-US' as const,
		setLocale: () => undefined,
		path: '(test)',
	}),
}));

let lines: string[];

function context(options: CliOptions, ports = fakePorts()): CommandContext {
	return {
		useCases: createUseCases(ports),
		options,
		print: line => lines.push(line),
	};
}

const output = () => lines.join('\n');

beforeEach(() => {
	lines = [];
});

describe('runStartupReport', () => {
	it('prints a table by default', async () => {
		await runStartupReport(
			context({}, fakePorts({startupInventory: fakeStartupInventoryPort([aRawStartupEntry()])})),
		);
		expect(output()).toContain('App');
		expect(output()).toContain('1 entries');
	});

	it('prints JSON when asked', async () => {
		await runStartupReport(
			context({json: true}, fakePorts({startupInventory: fakeStartupInventoryPort([aRawStartupEntry()])})),
		);
		expect(JSON.parse(output())).toHaveProperty('entries');
	});
});

describe('runHardwareReport', () => {
	it('prints a report, or JSON when asked', async () => {
		await runHardwareReport(context({}));
		expect(output()).toContain('SYSTEM');

		lines = [];
		await runHardwareReport(context({json: true}));
		expect(JSON.parse(output())).toHaveProperty('report');
	});
});

describe('runBackupsReport', () => {
	it('explains when there is nothing to restore', async () => {
		await runBackupsReport(context({}));
		expect(output()).toContain('No backups');
	});

	it('lists backups with a restore hint', async () => {
		const ports = fakePorts({
			backup: fakeBackupPort([
				{
					backupId: 'b1',
					createdAt: '2026-09-14T10:00:00.000Z',
					location: 'C:\\b1',
					itemCount: 3,
					titles: ['Ghost'],
				},
			]),
		});

		await runBackupsReport(context({}, ports));

		expect(output()).toContain('b1');
		expect(output()).toContain('Ghost, ...');
		expect(output()).toContain('rux restore');
	});

	it('prints JSON when asked', async () => {
		await runBackupsReport(context({json: true}));
		expect(JSON.parse(output())).toEqual([]);
	});
});

describe('runCleanReport', () => {
	const ports = (findings = [aResidueFinding()], removal = fakeResidueRemovalPort()) =>
		fakePorts({residueScan: fakeResidueScanPort(findings), residueRemoval: removal});

	it('prints the report and a hint, and removes nothing', async () => {
		const removal = fakeResidueRemovalPort();
		await runCleanReport(context({}, ports([aResidueFinding()], removal)));

		expect(output()).toContain('STARTUP ENTRY');
		expect(output()).toContain('Run with --yes');
		expect(removal.calls).toHaveLength(0);
	});

	it('prints JSON without the hint', async () => {
		await runCleanReport(context({json: true}, ports()));
		expect(JSON.parse(output())).toHaveProperty('findings');
	});

	it('says so when nothing is safe to remove', async () => {
		await runCleanReport(context({yes: true}, ports([aResidueFinding({risk: 'review'})])));
		expect(output()).toContain('Nothing safe to remove');
	});

	it('lists what it would do on a dry run, and changes nothing', async () => {
		const removal = fakeResidueRemovalPort();
		await runCleanReport(
			context(
				{yes: true, dryRun: true},
				ports([aResidueFinding(), aResidueFinding({id: 'b', elevation: 'administrator'})], removal),
			),
		);

		expect(output()).toContain('Dry run');
		expect(output()).toContain('registryValue');
		expect(output()).toContain('1 of them are machine-wide');
		expect(removal.calls).toHaveLength(0);
	});

	it('removes the safe subset and reports the backup', async () => {
		const removal = fakeResidueRemovalPort({
			removed: 1,
			failed: 0,
			backupId: '20260914-000000-abcd',
			receipts: [{id: 'abc123', ok: true, message: 'Ghost'}],
		});

		await runCleanReport(context({yes: true}, ports([aResidueFinding()], removal)));

		expect(removal.calls).toHaveLength(1);
		expect(output()).toContain('Removed 1 of 1');
		expect(output()).toContain('rux restore 20260914-000000-abcd');
	});

	it('reports each failure', async () => {
		const removal = fakeResidueRemovalPort({
			removed: 0,
			failed: 1,
			backupId: null,
			receipts: [{id: 'abc123', ok: false, message: 'access denied'}],
		});

		await runCleanReport(context({yes: true}, ports([aResidueFinding()], removal)));

		expect(output()).toContain('! access denied');
	});
});

describe('runJunkReport', () => {
	const ports = (findings = [aJunkFinding()], clean = fakeJunkCleanPort()) =>
		fakePorts({junkScan: fakeJunkScanPort(findings), junkClean: clean});

	it('prints the report and a hint', async () => {
		await runJunkReport(context({}, ports()));
		expect(output()).toContain('LOCATION');
		expect(output()).toContain('Run with --yes');
	});

	it('prints JSON when asked', async () => {
		await runJunkReport(context({json: true}, ports()));
		expect(JSON.parse(output())).toHaveProperty('findings');
	});

	it('ignores a safe location that is already empty', async () => {
		await runJunkReport(context({yes: true}, ports([aJunkFinding({sizeBytes: bytes(0), fileCount: 0})])));
		expect(output()).toContain('Nothing safe to remove');
	});

	it('lists what it would clear on a dry run', async () => {
		const clean = fakeJunkCleanPort();
		await runJunkReport(
			context(
				{yes: true, dryRun: true},
				ports(
					[
						aJunkFinding(),
						aJunkFinding({
							target: aJunkTarget({id: 'windows-temp', elevation: 'administrator'}),
							sizeBytes: bytes(2048),
						}),
					],
					clean,
				),
			),
		);

		expect(output()).toContain('Dry run');
		expect(output()).toContain('contents');
		expect(output()).toContain('1 of them are machine-wide');
		expect(clean.calls).toHaveLength(0);
	});

	it('clears the safe subset and reports what it freed', async () => {
		const clean = fakeJunkCleanPort({
			cleared: 1,
			failed: 1,
			freedBytes: 4096,
			receipts: [{id: 'user-temp', ok: false, message: 'in use'}],
		});

		await runJunkReport(context({yes: true}, ports([aJunkFinding()], clean)));

		expect(clean.calls).toHaveLength(1);
		expect(output()).toContain('Freed 4.0 KB');
		expect(output()).toContain('! user-temp: in use');
	});
});

describe('runRestore', () => {
	it('reports success and each receipt', async () => {
		const ports = fakePorts({
			backup: fakeBackupPort([], {
				restored: 2,
				failed: 0,
				receipts: [
					{id: 'a', ok: true, message: 'Ghost'},
					{id: 'b', ok: false, message: 'missing backup file'},
				],
			}),
		});

		const ok = await runRestore(context({}, ports), 'b1');

		expect(ok).toBe(true);
		expect(output()).toContain('+ Ghost');
		expect(output()).toContain('! missing backup file');
	});

	it('reports failure when anything did not restore', async () => {
		const ports = fakePorts({backup: fakeBackupPort([], {restored: 0, failed: 1, receipts: []})});
		expect(await runRestore(context({}, ports), 'b1')).toBe(false);
	});
});

describe('runPurge', () => {
	it('confirms the deletion by id', async () => {
		const backup = fakeBackupPort();
		await runPurge(context({}, fakePorts({backup})), 'b1');

		expect(backup.purged).toEqual(['b1']);
		expect(output()).toContain('b1');
	});
});

describe('dry run descriptors', () => {
	it('prints a removal target that has no registry value name', async () => {
		const service = aResidueFinding({
			id: 'svc',
			residueClass: 'service',
			title: 'Ghost Service',
			removal: {kind: 'service', target: 'GhostSvc', valueName: null, taskPath: null},
		});

		await runCleanReport(
			context({yes: true, dryRun: true}, fakePorts({residueScan: fakeResidueScanPort([service])})),
		);

		expect(output()).toContain('service        GhostSvc');
		expect(output()).not.toContain('->');
	});
});
