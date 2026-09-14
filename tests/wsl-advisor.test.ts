import {describe, expect, it} from 'vitest';
import {bytes} from '@/domain/common';
import type {SystemCapabilities} from '@/domain/hardware';
import {analyzeWsl} from '@/domain/services/wsl-advisor';
import type {WslConfig, WslStatus} from '@/domain/wsl';
import {defaultWslMemoryBytes, hasWsl2Distribution} from '@/domain/wsl';

const GIB = 1024 ** 3;

function config(overrides: Partial<WslConfig> = {}): WslConfig {
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

function status(overrides: Partial<WslStatus> = {}): WslStatus {
	return {
		installed: true,
		defaultVersion: 2,
		kernelVersion: '5.15.153.1',
		running: false,
		distributions: [{name: 'Ubuntu', version: 2, state: 'Running', isDefault: true}],
		config: config(),
		...overrides,
	};
}

function capabilities(overrides: Partial<SystemCapabilities> = {}): SystemCapabilities {
	return {
		osDistro: 'Windows 11',
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

const ids = (items: readonly {id: string}[]): string[] => items.map(item => item.id);

describe('wsl helpers', () => {
	it('detects a WSL 2 distribution', () => {
		expect(hasWsl2Distribution(status())).toBe(true);
		expect(
			hasWsl2Distribution(
				status({distributions: [{name: 'Legacy', version: 1, state: 'Stopped', isDefault: true}]}),
			),
		).toBe(false);
	});

	it('models the WSL 2 default memory share', () => {
		expect(defaultWslMemoryBytes(bytes(64 * GIB))).toBe(32 * GIB);
	});
});

describe('analyzeWsl', () => {
	it('says nothing when WSL is not installed', () => {
		expect(analyzeWsl(status({installed: false}), capabilities())).toHaveLength(0);
	});

	it('produces nothing for a well-tuned configuration', () => {
		expect(analyzeWsl(status(), capabilities())).toHaveLength(0);
	});

	it('recommends upgrading when only WSL 1 is present', () => {
		const result = analyzeWsl(
			status({distributions: [{name: 'Legacy', version: 1, state: 'Stopped', isDefault: true}]}),
			capabilities(),
		);
		expect(ids(result)).toContain('wsl.version-1-only');
	});

	it('reports a missing configuration file', () => {
		const result = analyzeWsl(status({config: config({exists: false})}), capabilities());
		expect(ids(result)).toContain('wsl.no-config');
	});

	it('flags a memory limit that starves the distribution', () => {
		const result = analyzeWsl(status({config: config({memoryBytes: bytes(2 * GIB)})}), capabilities());
		expect(ids(result)).toContain('wsl.memory-too-low');
	});

	it('flags a memory limit that starves Windows', () => {
		const result = analyzeWsl(status({config: config({memoryBytes: bytes(60 * GIB)})}), capabilities());
		expect(ids(result)).toContain('wsl.memory-starves-host');
	});

	it('accepts a memory limit that leaves the host enough headroom', () => {
		const result = analyzeWsl(status({config: config({memoryBytes: bytes(48 * GIB)})}), capabilities());
		expect(ids(result)).not.toContain('wsl.memory-starves-host');
	});

	it('flags too few processors on a many-core host', () => {
		const result = analyzeWsl(status({config: config({processors: 2})}), capabilities());
		expect(ids(result)).toContain('wsl.processors-too-low');
	});

	it('flags an allocation that leaves no processor to Windows', () => {
		const result = analyzeWsl(status({config: config({processors: 16})}), capabilities());
		expect(ids(result)).toContain('wsl.processors-all-cores');
	});

	it('flags disabled GPU access', () => {
		const result = analyzeWsl(status({config: config({gpuSupport: false})}), capabilities());
		expect(ids(result)).toContain('wsl.gpu-disabled');
	});

	it('flags swap disabled on a small memory limit', () => {
		const result = analyzeWsl(
			status({config: config({swapBytes: bytes(0), memoryBytes: bytes(8 * GIB)})}),
			capabilities(),
		);
		expect(ids(result)).toContain('wsl.swap-disabled');
	});

	it('flags a virtual disk that never shrinks', () => {
		const result = analyzeWsl(status({config: config({sparseVhd: false})}), capabilities());
		expect(ids(result)).toContain('wsl.sparse-vhd-off');
	});

	it('raises missing firmware virtualization to critical', () => {
		const result = analyzeWsl(status(), capabilities({virtualizationEnabled: false}));
		const finding = result.find(item => item.id === 'wsl.virtualization-off');
		expect(finding?.impact).toBe('critical');
		expect(result[0]?.id).toBe('wsl.virtualization-off');
	});

	it('never recommends anything about networking', () => {
		const result = analyzeWsl(
			status({config: config({exists: false, sparseVhd: false, gpuSupport: false, processors: 1})}),
			capabilities({virtualizationEnabled: false}),
		);
		for (const item of result) {
			expect(item.id).not.toMatch(/network|dns|proxy|mirrored/i);
		}
	});
});
