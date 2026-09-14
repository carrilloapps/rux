import {z} from 'zod';
import type {WslPort} from '@/application/ports';
import {bytes} from '@/domain/common';
import type {WslStatus, WslVersion} from '@/domain/wsl';
import type {PowerShellRunner} from '@/infrastructure/powershell/runner';
import {psArray, psBoolean, psNumber, psString, psText} from '@/infrastructure/powershell/schema';
import {INSPECT_WSL_SCRIPT} from '@/infrastructure/powershell/scripts/wsl';

const distributionSchema = z.object({
	name: psText(''),
	// Parsed as a plain number and narrowed below. A required 1-or-2 literal
	// made any unexpected row fail the whole scan rather than be discarded.
	version: psNumber,
	state: psText(''),
	isDefault: z.boolean().catch(false),
});

const configSchema = z.object({
	exists: z.boolean().catch(false),
	path: psText(''),
	memoryBytes: psNumber,
	processors: psNumber,
	swapBytes: psNumber,
	nestedVirtualization: psBoolean,
	gpuSupport: psBoolean,
	guiApplications: psBoolean,
	sparseVhd: psBoolean,
	otherKeys: psArray(z.string()),
});

const statusSchema = z.object({
	installed: z.boolean().catch(false),
	defaultVersion: psNumber,
	kernelVersion: psString,
	distributions: psArray(distributionSchema),
	config: configSchema,
	running: z.boolean().catch(false),
});

function toVersion(value: number | null): WslVersion | null {
	return value === 1 || value === 2 ? value : null;
}

export function createWslAdapter(runner: PowerShellRunner): WslPort {
	return {
		async inspect(): Promise<WslStatus> {
			const payload = await runner.json(INSPECT_WSL_SCRIPT, statusSchema);

			return {
				installed: payload.installed,
				defaultVersion: toVersion(payload.defaultVersion),
				kernelVersion: payload.kernelVersion,
				running: payload.running,
				// `wsl --list --verbose` prints headings and notices alongside the
				// real rows, and on a machine with no WSL installed there is
				// nothing but those. A row without a name and a usable version is
				// one of them, so it is dropped rather than reported as a distro.
				distributions: payload.distributions.flatMap(distribution => {
					const version = toVersion(distribution.version);
					if (distribution.name === '' || version === null) return [];
					return [
						{
							name: distribution.name,
							version,
							state: distribution.state,
							isDefault: distribution.isDefault,
						},
					];
				}),
				config: {
					exists: payload.config.exists,
					path: payload.config.path,
					memoryBytes: payload.config.memoryBytes === null ? null : bytes(payload.config.memoryBytes),
					processors: payload.config.processors,
					swapBytes: payload.config.swapBytes === null ? null : bytes(payload.config.swapBytes),
					nestedVirtualization: payload.config.nestedVirtualization,
					gpuSupport: payload.config.gpuSupport,
					guiApplications: payload.config.guiApplications,
					sparseVhd: payload.config.sparseVhd,
					otherKeys: payload.config.otherKeys,
				},
			};
		},
	};
}
