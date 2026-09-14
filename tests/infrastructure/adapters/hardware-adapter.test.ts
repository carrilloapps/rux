/* eslint-disable @typescript-eslint/no-unsafe-return --
 * The systeminformation module is replaced with plain fixtures, so the mock
 * factory returns untyped objects. The assertions below check the mapped
 * result, which is fully typed.
 */
import {beforeEach, describe, expect, it, vi} from 'vitest';

const graphics = vi.fn();
const osInfo = vi.fn();
const cpu = vi.fn();
const mem = vi.fn();
const diskLayout = vi.fn();

vi.mock('systeminformation', () => ({
	default: {
		graphics: () => graphics(),
		osInfo: () => osInfo(),
		cpu: () => cpu(),
		mem: () => mem(),
		diskLayout: () => diskLayout(),
	},
}));

const {createHardwareAdapter} = await import('@/infrastructure/adapters/hardware-adapter');
const {fakeRunner} = await import('@tests/helpers/fakes');

/**
 * systeminformation reads real hardware, so it is replaced here. What is under
 * test is the mapping: how adapter, display and driver data from two sources
 * are reconciled into one report.
 */

const SCRIPT_PAYLOAD = {
	graphicsSettings: {
		hardwareAcceleratedScheduling: true,
		variableRefreshRate: null,
		gameMode: true,
		gameDvr: false,
		gpuPreferenceCount: 3,
	},
	displayModes: {
		adapter: 'Intel Iris Xe',
		width: 1920,
		height: 1080,
		refreshHz: 144,
		maxRefreshHz: 165,
		bitsPerPixel: 32,
	},
	drivers: {
		id: 'PCI\\DISPLAY',
		deviceName: 'NVIDIA GeForce RTX 3050',
		deviceClass: 'Display',
		manufacturer: 'NVIDIA',
		driverProvider: 'NVIDIA',
		driverVersion: '616.56',
		driverDate: '2026-06-01T00:00:00.000Z',
		signed: true,
		health: 'ok',
		problemCode: 0,
		infName: 'nv.inf',
	},
	capabilities: {
		secureBoot: null,
		virtualizationEnabled: true,
		powerPlan: 'Silent',
		batteryPresent: true,
		osBuild: '26200',
	},
};

beforeEach(() => {
	graphics.mockResolvedValue({
		controllers: [
			{
				vendor: 'NVIDIA',
				model: 'GeForce RTX 3050',
				busAddress: '0000:01:00.0',
				vram: 4096,
				driverVersion: '616.56',
			},
			{vendor: 'Intel Corporation', model: 'Iris Xe Graphics', vram: 2048, vramDynamic: true},
		],
		displays: [
			{
				deviceName: 'DISPLAY1',
				vendor: 'Acme',
				model: 'Panel',
				connection: 'eDP',
				main: true,
				builtin: true,
				// The DPI-scaled desktop size, which must not win over the real mode.
				currentResX: 1536,
				currentResY: 864,
				resolutionX: 1920,
				resolutionY: 1080,
				currentRefreshRate: 144,
				pixelDepth: '24',
			},
		],
	});
	osInfo.mockResolvedValue({distro: 'Microsoft Windows 11 Pro', release: '11', build: '26100', arch: 'x64'});
	cpu.mockResolvedValue({manufacturer: 'Intel', brand: 'Core i7', cores: 16, physicalCores: 12});
	mem.mockResolvedValue({total: 68719476736, available: 34359738368});
	diskLayout.mockResolvedValue([{type: 'NVMe'}]);
});

describe('hardware adapter', () => {
	it('prefers the real display mode over the DPI-scaled size', async () => {
		const report = await createHardwareAdapter(fakeRunner([SCRIPT_PAYLOAD])).inspect();
		const display = report.graphics.displays[0];

		expect(display?.currentWidth).toBe(1920);
		expect(display?.currentHeight).toBe(1080);
		expect(display?.nativeWidth).toBe(1920);
		expect(display?.maximumRefreshHz).toBe(165);
		// The adapter reports the true bit depth, not the scaled guess.
		expect(display?.pixelDepth).toBe(32);
	});

	it('classifies integrated and discrete adapters', async () => {
		const report = await createHardwareAdapter(fakeRunner([SCRIPT_PAYLOAD])).inspect();

		expect(report.graphics.controllers[0]?.integrated).toBe(false);
		expect(report.graphics.controllers[0]?.vramBytes).toBe(4096 * 1024 * 1024);
		expect(report.graphics.controllers[1]?.integrated).toBe(true);
	});

	it('classifies an AMD integrated adapter by its model name', async () => {
		// AMD ships integrated parts under names that carry no vendor hint, so
		// the model string is the only signal available.
		graphics.mockResolvedValue({
			controllers: [
				{vendor: 'Advanced Micro Devices, Inc.', model: 'AMD Radeon Graphics', vram: 512},
				{vendor: 'AMD', model: 'Vega 8 Graphics', vram: 512},
				{vendor: 'Intel Corporation', model: 'UHD Graphics 630', vram: 128},
			],
			displays: [],
		});

		const report = await createHardwareAdapter(fakeRunner([{...SCRIPT_PAYLOAD, displayModes: []}])).inspect();

		expect(report.graphics.controllers.map(controller => controller.integrated)).toEqual([true, true, true]);
	});

	it('treats shared dynamic memory as integrated whatever the name says', async () => {
		graphics.mockResolvedValue({
			controllers: [{vendor: 'Acme', model: 'Mystery Adapter', vram: 1024, vramDynamic: true}],
			displays: [],
		});

		const report = await createHardwareAdapter(fakeRunner([{...SCRIPT_PAYLOAD, displayModes: []}])).inspect();

		expect(report.graphics.controllers[0]?.integrated).toBe(true);
	});

	it('keeps an unknown adapter with dedicated memory discrete', async () => {
		graphics.mockResolvedValue({
			controllers: [{vendor: 'Acme', model: 'Mystery Adapter', vram: 8192, vramDynamic: false}],
			displays: [],
		});

		const report = await createHardwareAdapter(fakeRunner([{...SCRIPT_PAYLOAD, displayModes: []}])).inspect();

		expect(report.graphics.controllers[0]?.integrated).toBe(false);
	});

	it('stamps adapters with the display driver date, which only the PnP inventory has', async () => {
		const report = await createHardwareAdapter(fakeRunner([SCRIPT_PAYLOAD])).inspect();
		expect(report.graphics.controllers[0]?.driverDate).toBe('2026-06-01T00:00:00.000Z');
	});

	it('merges capabilities from both sources, preferring the script for Windows state', async () => {
		const report = await createHardwareAdapter(fakeRunner([SCRIPT_PAYLOAD])).inspect();

		expect(report.capabilities.cpuBrand).toBe('Intel Core i7');
		expect(report.capabilities.memoryTotalBytes).toBe(68719476736);
		expect(report.capabilities.hasSsd).toBe(true);
		expect(report.capabilities.powerPlan).toBe('Silent');
		expect(report.capabilities.secureBoot).toBeNull();
		// The script's build number wins over the systeminformation one.
		expect(report.capabilities.osBuild).toBe('26200');
	});

	it('falls back to the systeminformation build when the script has none', async () => {
		const runner = fakeRunner([
			{...SCRIPT_PAYLOAD, capabilities: {...SCRIPT_PAYLOAD.capabilities, osBuild: ''}},
		]);
		const report = await createHardwareAdapter(runner).inspect();
		expect(report.capabilities.osBuild).toBe('26100');
	});

	it('copes with a machine that reports no adapters, displays or disks', async () => {
		graphics.mockResolvedValue({controllers: [], displays: []});
		diskLayout.mockResolvedValue([]);

		const report = await createHardwareAdapter(fakeRunner([{...SCRIPT_PAYLOAD, displayModes: []}])).inspect();

		expect(report.graphics.controllers).toEqual([]);
		expect(report.graphics.displays).toEqual([]);
		expect(report.capabilities.diskCount).toBe(0);
		expect(report.capabilities.hasSsd).toBe(false);
	});

	it('falls back to the reported resolution when no adapter mode is available', async () => {
		const report = await createHardwareAdapter(fakeRunner([{...SCRIPT_PAYLOAD, displayModes: []}])).inspect();
		const display = report.graphics.displays[0];

		expect(display?.currentWidth).toBe(1536);
		expect(display?.pixelDepth).toBe(24);
		expect(display?.maximumRefreshHz).toBeNull();
	});

	it('names an adapter without a bus address by its position', async () => {
		graphics.mockResolvedValue({controllers: [{vendor: 'Acme', model: 'Card'}], displays: []});

		const report = await createHardwareAdapter(fakeRunner([{...SCRIPT_PAYLOAD, displayModes: []}])).inspect();

		expect(report.graphics.controllers[0]?.id).toBe('gpu-0');
		expect(report.graphics.controllers[0]?.vramBytes).toBeNull();
	});
});
