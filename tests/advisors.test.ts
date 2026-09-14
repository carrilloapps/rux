import {describe, expect, it} from 'vitest';
import {bytes} from '@/domain/common';
import type {DisplayDevice, DriverRecord, GraphicsProfile, SystemCapabilities} from '@/domain/hardware';
import {driverAgeDays, isInboxDriver} from '@/domain/hardware';
import {analyzeGraphics} from '@/domain/services/graphics-advisor';
import {analyzeDrivers} from '@/domain/services/driver-advisor';

const NOW = new Date('2026-09-14T00:00:00.000Z');

function display(overrides: Partial<DisplayDevice> = {}): DisplayDevice {
	return {
		id: 'DISPLAY1',
		vendor: 'Acme',
		model: 'Panel',
		connection: null,
		main: true,
		builtin: true,
		currentWidth: 1920,
		currentHeight: 1080,
		nativeWidth: 1920,
		nativeHeight: 1080,
		currentRefreshHz: 144,
		maximumRefreshHz: 144,
		pixelDepth: 32,
		...overrides,
	};
}

function profile(overrides: Partial<GraphicsProfile> = {}): GraphicsProfile {
	return {
		controllers: [
			{
				id: 'gpu-0',
				vendor: 'NVIDIA',
				model: 'RTX 3050',
				busAddress: null,
				vramBytes: bytes(4 * 1024 ** 3),
				integrated: false,
				driverVersion: '616.56',
				driverDate: '2026-06-01T00:00:00.000Z',
			},
		],
		displays: [display()],
		settings: {
			hardwareAcceleratedScheduling: true,
			variableRefreshRate: true,
			gameMode: true,
			gameDvr: false,
			gpuPreferenceCount: 5,
		},
		scannedAt: NOW.toISOString(),
		...overrides,
	};
}

function driver(overrides: Partial<DriverRecord> = {}): DriverRecord {
	return {
		id: 'PCI\\TEST',
		deviceName: 'Test device',
		deviceClass: 'Display',
		manufacturer: 'Vendor',
		driverProvider: 'Vendor',
		driverVersion: '1.0',
		driverDate: '2026-01-01T00:00:00.000Z',
		signed: true,
		health: 'ok',
		problemCode: 0,
		infName: 'test.inf',
		...overrides,
	};
}

function capabilities(overrides: Partial<SystemCapabilities> = {}): SystemCapabilities {
	return {
		osDistro: 'Windows 11',
		osRelease: '11',
		osBuild: '26200',
		architecture: 'x64',
		cpuBrand: 'Intel Core i5',
		cpuCores: 16,
		cpuPhysicalCores: 12,
		memoryTotalBytes: bytes(64 * 1024 ** 3),
		memoryFreeBytes: bytes(32 * 1024 ** 3),
		virtualizationEnabled: true,
		secureBoot: true,
		diskCount: 1,
		hasSsd: true,
		batteryPresent: true,
		powerPlan: 'Balanced',
		...overrides,
	};
}

describe('analyzeGraphics', () => {
	it('produces nothing for a correctly configured machine', () => {
		expect(analyzeGraphics(profile(), NOW)).toHaveLength(0);
	});

	it('treats a DPI-scaled desktop as correct, not a wrong resolution', () => {
		// 1920 / 1536 is exactly 125% scaling; the panel is still at native mode.
		const result = analyzeGraphics(
			profile({displays: [display({currentWidth: 1536, currentHeight: 864})]}),
			NOW,
		);
		expect(result.find(item => item.id.startsWith('display.non-native-resolution'))).toBeUndefined();
	});

	it('flags a genuinely non-native resolution', () => {
		const result = analyzeGraphics(
			profile({displays: [display({currentWidth: 1280, currentHeight: 1024})]}),
			NOW,
		);
		expect(result.find(item => item.id.startsWith('display.non-native-resolution'))).toBeDefined();
	});

	it('flags a display running below its maximum refresh rate', () => {
		const result = analyzeGraphics(
			profile({displays: [display({currentRefreshHz: 60, maximumRefreshHz: 144})]}),
			NOW,
		);
		const finding = result.find(item => item.id.startsWith('display.refresh-below-maximum'));
		expect(finding?.impact).toBe('high');
	});

	it('flags a hybrid machine with no GPU preferences', () => {
		const result = analyzeGraphics(
			profile({
				controllers: [
					...profile().controllers,
					{
						id: 'gpu-1',
						vendor: 'Intel',
						model: 'Iris Xe',
						busAddress: null,
						vramBytes: null,
						integrated: true,
						driverVersion: null,
						driverDate: null,
					},
				],
				settings: {...profile().settings, gpuPreferenceCount: 0},
			}),
			NOW,
		);
		expect(result.find(item => item.id === 'graphics.hybrid-no-preference')).toBeDefined();
	});

	it('flags background game recording', () => {
		const result = analyzeGraphics(profile({settings: {...profile().settings, gameDvr: true}}), NOW);
		expect(result.find(item => item.id === 'graphics.game-dvr-enabled')).toBeDefined();
	});

	it('orders findings by impact', () => {
		const result = analyzeGraphics(
			profile({
				displays: [display({currentRefreshHz: 60, maximumRefreshHz: 144})],
				settings: {...profile().settings, gameDvr: true},
			}),
			NOW,
		);
		expect(result[0]?.impact).toBe('high');
	});
});

describe('driver helpers', () => {
	it('treats sentinel dates as unknown rather than ancient', () => {
		expect(driverAgeDays(driver({driverDate: '1968-07-17T00:00:00.000Z'}), NOW)).toBeNull();
	});

	it('computes a real age', () => {
		expect(driverAgeDays(driver({driverDate: '2026-09-04T00:00:00.000Z'}), NOW)).toBe(10);
	});

	it('recognises inbox drivers', () => {
		expect(isInboxDriver(driver({driverProvider: 'Microsoft'}))).toBe(true);
		expect(isInboxDriver(driver({manufacturer: '(Standard system devices)'}))).toBe(true);
		expect(isInboxDriver(driver({driverProvider: 'NVIDIA', manufacturer: 'NVIDIA'}))).toBe(false);
	});
});

describe('analyzeDrivers', () => {
	it('reports a healthy machine as healthy', () => {
		const result = analyzeDrivers([driver()], capabilities(), NOW);
		expect(result.find(item => item.id === 'driver.all-healthy')).toBeDefined();
	});

	it('raises failing devices to critical', () => {
		const result = analyzeDrivers([driver({health: 'error', problemCode: 28})], capabilities(), NOW);
		expect(result[0]?.id).toBe('driver.devices-in-error');
		expect(result[0]?.impact).toBe('critical');
	});

	it('does not flag inbox drivers as stale', () => {
		const result = analyzeDrivers(
			[driver({driverProvider: 'Microsoft', driverDate: '2006-06-21T00:00:00.000Z'})],
			capabilities(),
			NOW,
		);
		expect(result.find(item => item.id === 'driver.stale-critical')).toBeUndefined();
	});

	it('flags stale vendor drivers on core components', () => {
		const result = analyzeDrivers(
			[driver({driverProvider: 'Vendor', deviceClass: 'Net', driverDate: '2019-01-01T00:00:00.000Z'})],
			capabilities(),
			NOW,
		);
		expect(result.find(item => item.id === 'driver.stale-critical')).toBeDefined();
	});

	it('flags disabled secure boot and virtualization', () => {
		const result = analyzeDrivers(
			[driver()],
			capabilities({secureBoot: false, virtualizationEnabled: false}),
			NOW,
		);
		expect(result.find(item => item.id === 'system.secure-boot-off')).toBeDefined();
		expect(result.find(item => item.id === 'system.virtualization-off')).toBeDefined();
	});

	it('flags memory pressure', () => {
		const result = analyzeDrivers(
			[driver()],
			capabilities({memoryTotalBytes: bytes(1000), memoryFreeBytes: bytes(50)}),
			NOW,
		);
		expect(result.find(item => item.id === 'system.memory-pressure')).toBeDefined();
	});
});
