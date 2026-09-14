import {beforeAll, describe, expect, it} from 'vitest';
import {createUseCases} from '@/application/use-cases';
import {bytes} from '@/domain/common';
import {createTranslator, initI18n, type Translator} from '@/i18n/translator';
import {renderHardware, renderJunk, renderResidue, renderStartup} from '@/presentation/cli/reports';
import type {RawStartupEntry} from '@/domain/startup';
import {
	aDisplay,
	aGraphicsController,
	aGraphicsProfile,
	aHardwareReport,
	aJunkFinding,
	aJunkTarget,
	aProcess,
	aRawStartupEntry,
	aResidueFinding,
	capabilities,
} from '@tests/helpers/builders';
import {fakePorts, fakeStartupInventoryPort} from '@tests/helpers/fakes';

let t: Translator;

beforeAll(async () => {
	t = createTranslator(await initI18n('en-US'));
});

async function inventoryWith(entries: readonly RawStartupEntry[]) {
	const useCases = createUseCases(
		fakePorts({startupInventory: fakeStartupInventoryPort(entries, [aProcess()])}),
	);
	return useCases.scanStartup.execute(false);
}

const residueReport = (findings: ReturnType<typeof aResidueFinding>[], deep = false) => ({
	findings,
	classesScanned: ['startup' as const],
	deep,
	elevated: false,
	scannedAt: '2026-09-14T00:00:00.000Z',
});

describe('renderStartup', () => {
	it('prints a header, a row per entry and a summary', async () => {
		const inventory = await inventoryWith([
			aRawStartupEntry(),
			aRawStartupEntry({
				id: 'b',
				name: 'Broken',
				executableExists: false,
				executablePath: 'C:\\Gone\\x.exe',
				executableName: 'x.exe',
				command: 'C:\\Gone\\x.exe',
			}),
			aRawStartupEntry({id: 'c', name: 'Off', enabled: false}),
		]);

		const output = renderStartup(inventory, t);

		expect(output).toContain('NAME');
		expect(output).toContain('App');
		expect(output).toContain('Broken');
		expect(output).toContain('3 entries');
		expect(output).toContain('1 running');
		expect(output).toContain('1 disabled');
		expect(output).toContain('1 missing');
	});

	it('marks each status with its own glyph', async () => {
		const inventory = await inventoryWith([
			aRawStartupEntry(),
			aRawStartupEntry({
				id: 'b',
				name: 'Stopped',
				executablePath: 'C:\\Other\\other.exe',
				executableName: 'other.exe',
				command: 'C:\\Other\\other.exe',
			}),
			aRawStartupEntry({id: 'c', name: 'Off', enabled: false}),
			aRawStartupEntry({
				id: 'd',
				name: 'Gone',
				executableExists: false,
				executablePath: 'C:\\Gone\\gone.exe',
				executableName: 'gone.exe',
				command: 'C:\\Gone\\gone.exe',
			}),
		]);

		const output = renderStartup(inventory, t);

		expect(output).toMatch(/\+ App/);
		expect(output).toMatch(/o Stopped/);
		expect(output).toMatch(/x Off/);
		expect(output).toMatch(/! Gone/);
	});

	it('falls back to a dash for an unknown publisher', async () => {
		const inventory = await inventoryWith([aRawStartupEntry({publisher: null})]);
		expect(renderStartup(inventory, t)).toContain('-');
	});
});

describe('renderResidue', () => {
	it('groups findings under a heading per class', () => {
		const output = renderResidue(
			residueReport([
				aResidueFinding(),
				aResidueFinding({id: 'b', residueClass: 'service', title: 'Ghost Service'}),
				aResidueFinding({id: 'c', residueClass: 'service', title: 'Another', risk: 'review'}),
			]),
			t,
		);

		expect(output).toContain('STARTUP ENTRY');
		expect(output).toContain('SERVICE');
		expect(output).toContain('3 leftovers');
		expect(output).toContain('2 safe');
		expect(output).toContain('1 need review');
	});

	it('marks review findings differently from safe ones', () => {
		const output = renderResidue(
			residueReport([aResidueFinding(), aResidueFinding({id: 'b', title: 'Maybe', risk: 'review'})], true),
			t,
		);

		expect(output).toMatch(/- Ghost/);
		expect(output).toMatch(/\? Maybe/);
	});

	it('shows a size when the finding has one', () => {
		const output = renderResidue(residueReport([aResidueFinding({sizeBytes: bytes(2048)})]), t);
		expect(output).toContain('(2.0 KB)');
	});
});

describe('renderJunk', () => {
	it('sorts by size and totals what is reclaimable', () => {
		const output = renderJunk(
			{
				findings: [
					aJunkFinding({target: aJunkTarget({id: 'small'}), sizeBytes: bytes(1024)}),
					aJunkFinding({target: aJunkTarget({id: 'large'}), sizeBytes: bytes(1024 ** 3)}),
					aJunkFinding({target: aJunkTarget({id: 'risky', risk: 'review'}), sizeBytes: bytes(512)}),
				],
				elevated: false,
				scannedAt: '2026-09-14T00:00:00.000Z',
			},
			t,
		);

		expect(output.indexOf('large')).toBeLessThan(output.indexOf('small'));
		expect(output).toContain('3 locations');
		expect(output).toMatch(/\? risky/);
		expect(output).toContain('2 safe');
	});
});

describe('renderHardware', () => {
	const report = aHardwareReport({
		graphics: aGraphicsProfile({
			controllers: [
				aGraphicsController(),
				aGraphicsController({id: 'g1', model: 'Iris Xe', integrated: true, vramBytes: null}),
			],
			displays: [aDisplay(), aDisplay({id: 'd2', vendor: null, model: null})],
		}),
	});

	it('prints system, graphics, display and WSL sections', () => {
		const output = renderHardware({report, wsl: null, recommendations: []}, t);

		expect(output).toContain('SYSTEM');
		expect(output).toContain('GRAPHICS');
		expect(output).toContain('DISPLAYS');
		expect(output).toContain('WSL');
		expect(output).toContain('RECOMMENDATIONS');
		expect(output).toContain('WSL is not installed');
		expect(output).toContain('No recommendations');
	});

	it('labels an unreadable capability as unknown', () => {
		const output = renderHardware(
			{
				report: aHardwareReport({
					capabilities: capabilities({secureBoot: null, virtualizationEnabled: null, powerPlan: null}),
				}),
				wsl: null,
				recommendations: [],
			},
			t,
		);

		expect(output.match(/unknown/g)?.length).toBeGreaterThanOrEqual(3);
	});

	it('prints each recommendation, with its action when there is one', () => {
		const output = renderHardware(
			{
				report,
				wsl: null,
				recommendations: [
					{
						id: 'x',
						area: 'graphics',
						impact: 'high',
						title: {key: 'recommendations.graphics.gameDvrEnabled.title'},
						finding: {key: 'recommendations.graphics.gameDvrEnabled.finding'},
						advice: {key: 'recommendations.graphics.gameDvrEnabled.advice'},
						action: {
							location: {key: 'actions.gameCaptureSettings'},
							command: 'start ms-settings:gaming-gamedvr',
						},
						evidence: [],
					},
					{
						id: 'y',
						area: 'system',
						impact: 'low',
						title: {key: 'recommendations.system.secureBootOff.title'},
						finding: {key: 'recommendations.system.secureBootOff.finding'},
						advice: {key: 'recommendations.system.secureBootOff.advice'},
						action: null,
						evidence: [],
					},
				],
			},
			t,
		);

		expect(output).toContain('[high]');
		expect(output).toContain('Command: start ms-settings:gaming-gamedvr');
		expect(output).toContain('[low]');
	});

	it('prints the WSL configuration when it is installed', () => {
		const output = renderHardware(
			{
				report,
				wsl: {
					installed: true,
					defaultVersion: 2,
					kernelVersion: '5.15',
					running: true,
					distributions: [
						{name: 'Ubuntu', version: 2, state: 'Running', isDefault: true},
						{name: 'docker-desktop', version: 2, state: 'Stopped', isDefault: false},
					],
					config: {
						exists: true,
						path: 'C:\\Users\\tester\\.wslconfig',
						memoryBytes: bytes(1024 ** 3),
						processors: 8,
						swapBytes: null,
						nestedVirtualization: null,
						gpuSupport: null,
						guiApplications: null,
						sparseVhd: null,
						otherKeys: [],
					},
				},
				recommendations: [],
			},
			t,
		);

		expect(output).toContain('Ubuntu (v2, Running, default)');
		expect(output).toContain('docker-desktop (v2, Stopped)');
		expect(output).toContain('processors=8');
		expect(output).toContain('swap=not set');
	});
});

describe('renderHardware capability states', () => {
	it.each([
		[true, 'enabled'],
		[false, 'disabled'],
	])('renders Secure Boot %s as %s', (secureBoot, expected) => {
		const output = renderHardware(
			{report: aHardwareReport({capabilities: capabilities({secureBoot})}), wsl: null, recommendations: []},
			t,
		);
		expect(output).toMatch(new RegExp(`Secure Boot\\s+${expected}`));
	});

	it.each([
		[true, 'enabled'],
		[false, 'disabled'],
	])('renders virtualization %s as %s', (virtualizationEnabled, expected) => {
		const output = renderHardware(
			{
				report: aHardwareReport({capabilities: capabilities({virtualizationEnabled})}),
				wsl: null,
				recommendations: [],
			},
			t,
		);
		expect(output).toMatch(new RegExp(`Virtualization\\s+${expected}`));
	});

	it('renders an adapter with no VRAM reading', () => {
		const output = renderHardware(
			{
				report: aHardwareReport({
					graphics: aGraphicsProfile({controllers: [aGraphicsController({vramBytes: null})]}),
				}),
				wsl: null,
				recommendations: [],
			},
			t,
		);
		expect(output).toContain('discrete');
	});

	it('keeps the report readable when there are no displays', () => {
		const output = renderHardware(
			{report: aHardwareReport({graphics: aGraphicsProfile({displays: []})}), wsl: null, recommendations: []},
			t,
		);
		expect(output).toContain('DISPLAYS');
	});
});
