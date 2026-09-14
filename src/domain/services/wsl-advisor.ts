import {text} from '@/domain/common';
import type {SystemCapabilities} from '@/domain/hardware';
import type {Recommendation} from '@/domain/recommendation';
import {sortRecommendations} from '@/domain/recommendation';
import type {WslStatus} from '@/domain/wsl';
import {defaultWslMemoryBytes, hasWsl2Distribution} from '@/domain/wsl';

const GIB = 1024 ** 3;

/** Below this, a WSL 2 distribution struggles with language servers and builds. */
const LOW_MEMORY_LIMIT_BYTES = 4 * GIB;

/** Leaving less than this to Windows itself causes host-side paging. */
const HOST_RESERVE_BYTES = 8 * GIB;

/** A single processor serialises every parallel build inside the distribution. */
const LOW_PROCESSOR_COUNT = 2;

/**
 * Derives WSL tuning advice from the host's capabilities and the current
 * `.wslconfig`.
 *
 * Scope note: memory, processors, swap and GPU only. WSL networking is
 * intentionally excluded — mirrored mode, DNS tunnelling and VPN interaction
 * depend on the host's adapters and security software, so they are manual
 * decisions rather than something derivable from inspection.
 */
export function analyzeWsl(status: WslStatus, capabilities: SystemCapabilities): readonly Recommendation[] {
	if (!status.installed) return [];

	const recommendations: Recommendation[] = [];
	const {config} = status;
	const hostMemory = capabilities.memoryTotalBytes;
	const hostCores = capabilities.cpuCores;

	if (!hasWsl2Distribution(status)) {
		recommendations.push({
			id: 'wsl.version-1-only',
			area: 'wsl',
			impact: 'medium',
			title: text('recommendations.wsl.version1Only.title'),
			finding: text('recommendations.wsl.version1Only.finding'),
			advice: text('recommendations.wsl.version1Only.advice'),
			action: {location: text('actions.terminal'), command: 'wsl --set-default-version 2'},
			evidence: status.distributions.map(distribution => `${distribution.name} (v${distribution.version})`),
		});
		return sortRecommendations(recommendations);
	}

	if (!config.exists) {
		recommendations.push({
			id: 'wsl.no-config',
			area: 'wsl',
			impact: 'medium',
			title: text('recommendations.wsl.noConfig.title'),
			finding: text('recommendations.wsl.noConfig.finding', {
				defaultMemory: Math.round(defaultWslMemoryBytes(hostMemory) / GIB),
				cores: hostCores,
			}),
			advice: text('recommendations.wsl.noConfig.advice'),
			action: {location: text('actions.wslConfigFile'), command: `notepad ${config.path}`},
			evidence: [config.path],
		});
	}

	if (config.memoryBytes !== null) {
		if (config.memoryBytes < LOW_MEMORY_LIMIT_BYTES) {
			recommendations.push({
				id: 'wsl.memory-too-low',
				area: 'wsl',
				impact: 'high',
				title: text('recommendations.wsl.memoryTooLow.title'),
				finding: text('recommendations.wsl.memoryTooLow.finding', {
					limit: Math.round((config.memoryBytes / GIB) * 10) / 10,
				}),
				advice: text('recommendations.wsl.memoryTooLow.advice'),
				action: {location: text('actions.wslConfigFile'), command: `notepad ${config.path}`},
				evidence: [`memory=${Math.round((config.memoryBytes / GIB) * 10) / 10}GB`],
			});
		}

		// Windows needs headroom of its own; starving the host to feed the VM
		// trades Linux speed for desktop stalls.
		if (hostMemory > 0 && hostMemory - config.memoryBytes < HOST_RESERVE_BYTES) {
			recommendations.push({
				id: 'wsl.memory-starves-host',
				area: 'wsl',
				impact: 'high',
				title: text('recommendations.wsl.memoryStarvesHost.title'),
				finding: text('recommendations.wsl.memoryStarvesHost.finding', {
					limit: Math.round(config.memoryBytes / GIB),
					host: Math.round(hostMemory / GIB),
				}),
				advice: text('recommendations.wsl.memoryStarvesHost.advice'),
				action: {location: text('actions.wslConfigFile'), command: `notepad ${config.path}`},
				evidence: [
					`memory=${Math.round(config.memoryBytes / GIB)}GB`,
					`host=${Math.round(hostMemory / GIB)}GB`,
				],
			});
		}
	}

	if (config.processors !== null) {
		if (config.processors <= LOW_PROCESSOR_COUNT && hostCores > 4) {
			recommendations.push({
				id: 'wsl.processors-too-low',
				area: 'wsl',
				impact: 'high',
				title: text('recommendations.wsl.processorsTooLow.title'),
				finding: text('recommendations.wsl.processorsTooLow.finding', {
					assigned: config.processors,
					host: hostCores,
				}),
				advice: text('recommendations.wsl.processorsTooLow.advice'),
				action: {location: text('actions.wslConfigFile'), command: `notepad ${config.path}`},
				evidence: [`processors=${config.processors}`, `host cores=${hostCores}`],
			});
		}

		if (hostCores > 0 && config.processors >= hostCores) {
			recommendations.push({
				id: 'wsl.processors-all-cores',
				area: 'wsl',
				impact: 'low',
				title: text('recommendations.wsl.processorsAllCores.title'),
				finding: text('recommendations.wsl.processorsAllCores.finding', {
					assigned: config.processors,
					host: hostCores,
				}),
				advice: text('recommendations.wsl.processorsAllCores.advice'),
				action: {location: text('actions.wslConfigFile'), command: `notepad ${config.path}`},
				evidence: [`processors=${config.processors}`, `host cores=${hostCores}`],
			});
		}
	}

	if (config.swapBytes !== null && config.swapBytes === 0 && (config.memoryBytes ?? hostMemory) < 16 * GIB) {
		recommendations.push({
			id: 'wsl.swap-disabled',
			area: 'wsl',
			impact: 'medium',
			title: text('recommendations.wsl.swapDisabled.title'),
			finding: text('recommendations.wsl.swapDisabled.finding'),
			advice: text('recommendations.wsl.swapDisabled.advice'),
			action: {location: text('actions.wslConfigFile'), command: `notepad ${config.path}`},
			evidence: ['swap=0'],
		});
	}

	if (config.gpuSupport === false) {
		recommendations.push({
			id: 'wsl.gpu-disabled',
			area: 'wsl',
			impact: 'high',
			title: text('recommendations.wsl.gpuDisabled.title'),
			finding: text('recommendations.wsl.gpuDisabled.finding'),
			advice: text('recommendations.wsl.gpuDisabled.advice'),
			action: {location: text('actions.wslConfigFile'), command: `notepad ${config.path}`},
			evidence: ['gpuSupport=false'],
		});
	}

	if (config.nestedVirtualization === false && capabilities.virtualizationEnabled === true) {
		recommendations.push({
			id: 'wsl.nested-virtualization-disabled',
			area: 'wsl',
			impact: 'low',
			title: text('recommendations.wsl.nestedVirtualizationDisabled.title'),
			finding: text('recommendations.wsl.nestedVirtualizationDisabled.finding'),
			advice: text('recommendations.wsl.nestedVirtualizationDisabled.advice'),
			action: {location: text('actions.wslConfigFile'), command: `notepad ${config.path}`},
			evidence: ['nestedVirtualization=false'],
		});
	}

	if (config.sparseVhd !== true) {
		recommendations.push({
			id: 'wsl.sparse-vhd-off',
			area: 'wsl',
			impact: 'low',
			title: text('recommendations.wsl.sparseVhdOff.title'),
			finding: text('recommendations.wsl.sparseVhdOff.finding'),
			advice: text('recommendations.wsl.sparseVhdOff.advice'),
			action: {location: text('actions.wslConfigFile'), command: `notepad ${config.path}`},
			evidence: ['sparseVhd is not enabled'],
		});
	}

	if (capabilities.virtualizationEnabled === false) {
		recommendations.push({
			id: 'wsl.virtualization-off',
			area: 'wsl',
			impact: 'critical',
			title: text('recommendations.wsl.virtualizationOff.title'),
			finding: text('recommendations.wsl.virtualizationOff.finding'),
			advice: text('recommendations.wsl.virtualizationOff.advice'),
			action: {location: text('actions.firmwareSettings'), command: null},
			evidence: ['Virtualization: disabled'],
		});
	}

	return sortRecommendations(recommendations);
}
