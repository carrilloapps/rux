import {bytes} from '@/domain/common';
import type {
	DisplayDevice,
	DriverRecord,
	GraphicsController,
	GraphicsProfile,
	GraphicsSettings,
	HardwareReport,
	SystemCapabilities,
} from '@/domain/hardware';
import type {JunkFinding, JunkTarget} from '@/domain/junk';
import type {ResidueFinding} from '@/domain/residue';
import type {ProcessInfo, RawStartupEntry, StartupEntry} from '@/domain/startup';
import type {WslConfig, WslStatus} from '@/domain/wsl';

/**
 * Builders for domain objects.
 *
 * Every builder returns a valid, healthy default and takes an override object,
 * so a test names only the field it is actually about. That keeps assertions
 * legible and stops a new required field from breaking dozens of fixtures.
 */

export const GIB = 1024 ** 3;

export function aProcess(overrides: Partial<ProcessInfo> = {}): ProcessInfo {
	return {
		pid: 1000,
		name: 'app',
		executablePath: 'C:\\App\\app.exe',
		memoryBytes: bytes(1024),
		...overrides,
	};
}

export function aRawStartupEntry(overrides: Partial<RawStartupEntry> = {}): RawStartupEntry {
	return {
		id: 'run-user::App',
		name: 'App',
		command: '"C:\\App\\app.exe"',
		executablePath: 'C:\\App\\app.exe',
		executableName: 'app.exe',
		source: 'run-user',
		kind: 'registry',
		elevation: 'user',
		enabled: true,
		location: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
		approvalKey: 'Run',
		approvalHive: 'HKCU',
		taskPath: null,
		executableExists: true,
		publisher: 'Acme',
		fileSizeBytes: bytes(2048),
		modifiedAt: '2026-01-01T00:00:00.000Z',
		...overrides,
	};
}

export function aStartupEntry(overrides: Partial<StartupEntry> = {}): StartupEntry {
	return {
		...aRawStartupEntry(overrides),
		running: false,
		pids: [],
		memoryBytes: bytes(0),
		matchReason: null,
		...overrides,
	};
}

export function aGraphicsController(overrides: Partial<GraphicsController> = {}): GraphicsController {
	return {
		id: 'gpu-0',
		vendor: 'NVIDIA',
		model: 'RTX 3050',
		busAddress: '0000:01:00.0',
		vramBytes: bytes(4 * GIB),
		integrated: false,
		driverVersion: '616.56',
		driverDate: '2026-06-01T00:00:00.000Z',
		...overrides,
	};
}

export function aDisplay(overrides: Partial<DisplayDevice> = {}): DisplayDevice {
	return {
		id: 'DISPLAY1',
		vendor: 'Acme',
		model: 'Panel',
		connection: 'eDP',
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

export function graphicsSettings(overrides: Partial<GraphicsSettings> = {}): GraphicsSettings {
	return {
		hardwareAcceleratedScheduling: true,
		variableRefreshRate: true,
		gameMode: true,
		gameDvr: false,
		gpuPreferenceCount: 5,
		...overrides,
	};
}

export function aGraphicsProfile(overrides: Partial<GraphicsProfile> = {}): GraphicsProfile {
	return {
		controllers: [aGraphicsController()],
		displays: [aDisplay()],
		settings: graphicsSettings(),
		scannedAt: '2026-09-14T00:00:00.000Z',
		...overrides,
	};
}

export function aDriver(overrides: Partial<DriverRecord> = {}): DriverRecord {
	return {
		id: 'PCI\\VEN_TEST',
		deviceName: 'Test device',
		deviceClass: 'Display',
		manufacturer: 'Vendor',
		driverProvider: 'Vendor',
		driverVersion: '1.0.0',
		driverDate: '2026-01-01T00:00:00.000Z',
		signed: true,
		health: 'ok',
		problemCode: 0,
		infName: 'test.inf',
		...overrides,
	};
}

export function capabilities(overrides: Partial<SystemCapabilities> = {}): SystemCapabilities {
	return {
		osDistro: 'Microsoft Windows 11 Pro',
		osRelease: '11',
		osBuild: '26200',
		architecture: 'x64',
		cpuBrand: 'Intel Core i7',
		cpuCores: 16,
		cpuPhysicalCores: 12,
		memoryTotalBytes: bytes(64 * GIB),
		memoryFreeBytes: bytes(32 * GIB),
		virtualizationEnabled: true,
		secureBoot: true,
		diskCount: 1,
		hasSsd: true,
		batteryPresent: false,
		powerPlan: 'Balanced',
		...overrides,
	};
}

export function aHardwareReport(overrides: Partial<HardwareReport> = {}): HardwareReport {
	return {
		graphics: aGraphicsProfile(),
		drivers: [aDriver()],
		capabilities: capabilities(),
		scannedAt: '2026-09-14T00:00:00.000Z',
		...overrides,
	};
}

export function aJunkTarget(overrides: Partial<JunkTarget> = {}): JunkTarget {
	return {
		id: 'user-temp',
		category: 'user-temp',
		path: '%LOCALAPPDATA%\\Temp',
		sweep: 'contents',
		risk: 'safe',
		elevation: 'user',
		description: {key: 'junk.targets.userTemp'},
		minimumAgeDays: 1,
		extensions: null,
		...overrides,
	};
}

export function aJunkFinding(overrides: Partial<JunkFinding> = {}): JunkFinding {
	return {
		target: aJunkTarget(),
		resolvedPath: 'C:\\Users\\tester\\AppData\\Local\\Temp',
		exists: true,
		fileCount: 12,
		sizeBytes: bytes(4096),
		note: null,
		...overrides,
	};
}

export function aResidueFinding(overrides: Partial<ResidueFinding> = {}): ResidueFinding {
	return {
		id: 'abc123',
		residueClass: 'startup',
		title: 'Ghost',
		reason: {key: 'residue.reasons.startup', values: {location: 'HKCU'}},
		evidence: 'C:\\Gone\\ghost.exe',
		risk: 'safe',
		sizeBytes: bytes(0),
		elevation: 'user',
		removal: {
			kind: 'registryValue',
			target: 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run',
			valueName: 'Ghost',
			taskPath: null,
		},
		...overrides,
	};
}

export function aWslConfig(overrides: Partial<WslConfig> = {}): WslConfig {
	return {
		exists: true,
		path: 'C:\\Users\\tester\\.wslconfig',
		memoryBytes: bytes(16 * GIB),
		processors: 8,
		swapBytes: bytes(4 * GIB),
		nestedVirtualization: true,
		gpuSupport: true,
		guiApplications: true,
		sparseVhd: true,
		otherKeys: [],
		...overrides,
	};
}

export function aWslStatus(overrides: Partial<WslStatus> = {}): WslStatus {
	return {
		installed: true,
		defaultVersion: 2,
		kernelVersion: '5.15.153.1',
		running: false,
		distributions: [{name: 'Ubuntu', version: 2, state: 'Running', isDefault: true}],
		config: aWslConfig(),
		...overrides,
	};
}
