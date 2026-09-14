import type {Bytes} from '@/domain/common';

/**
 * Windows Subsystem for Linux, as seen from the Windows side.
 *
 * rux inspects WSL as a consumer of Windows resources: how much memory, how
 * many processors and which GPU the Linux side is allowed to use. Networking is
 * deliberately out of scope, because WSL network behaviour depends on the
 * host's own adapters, VPN clients and firewall, and any change there is a
 * manual decision rather than something a tool should recommend.
 */

export type WslVersion = 1 | 2;

export interface WslDistribution {
	readonly name: string;
	readonly version: WslVersion;
	readonly state: string;
	readonly isDefault: boolean;
}

/**
 * The effective contents of `.wslconfig`.
 *
 * Every field is null when the user has not set it, which matters: WSL 2's
 * defaults are derived from host hardware, so "unset" and "set to the default"
 * lead to different advice.
 */
export interface WslConfig {
	readonly exists: boolean;
	readonly path: string;
	readonly memoryBytes: Bytes | null;
	readonly processors: number | null;
	readonly swapBytes: Bytes | null;
	readonly nestedVirtualization: boolean | null;
	readonly gpuSupport: boolean | null;
	readonly guiApplications: boolean | null;
	readonly sparseVhd: boolean | null;
	/** Keys rux read but does not reason about, kept for the detail panel. */
	readonly otherKeys: readonly string[];
}

export interface WslStatus {
	readonly installed: boolean;
	readonly defaultVersion: WslVersion | null;
	readonly kernelVersion: string | null;
	readonly distributions: readonly WslDistribution[];
	readonly config: WslConfig;
	/** True when the WSL virtual machine is currently running. */
	readonly running: boolean;
}

export function hasWsl2Distribution(status: WslStatus): boolean {
	return status.distributions.some(distribution => distribution.version === 2);
}

/**
 * WSL 2 defaults to half of host memory. Expressing that here lets the advisor
 * tell the user what WSL would claim when no explicit limit is configured.
 */
export function defaultWslMemoryBytes(hostMemoryBytes: Bytes): number {
	return Math.floor(hostMemoryBytes / 2);
}
