import type {Bytes} from '@/domain/common';

export interface GraphicsController {
	readonly id: string;
	readonly vendor: string;
	readonly model: string;
	readonly busAddress: string | null;
	readonly vramBytes: Bytes | null;
	/** True when the adapter shares system memory rather than owning dedicated VRAM. */
	readonly integrated: boolean;
	readonly driverVersion: string | null;
	readonly driverDate: string | null;
}

export interface DisplayDevice {
	readonly id: string;
	readonly vendor: string | null;
	readonly model: string | null;
	readonly connection: string | null;
	readonly main: boolean;
	readonly builtin: boolean;
	readonly currentWidth: number | null;
	readonly currentHeight: number | null;
	readonly nativeWidth: number | null;
	readonly nativeHeight: number | null;
	readonly currentRefreshHz: number | null;
	readonly maximumRefreshHz: number | null;
	readonly pixelDepth: number | null;
}

/** Windows-level graphics settings that materially change behaviour. */
export interface GraphicsSettings {
	/** Hardware-accelerated GPU scheduling, HKLM GraphicsDrivers\\HwSchMode. */
	readonly hardwareAcceleratedScheduling: boolean | null;
	/** Variable refresh rate / "optimizations for windowed games". */
	readonly variableRefreshRate: boolean | null;
	/** Game Mode, HKCU GameBar\\AutoGameModeEnabled. */
	readonly gameMode: boolean | null;
	/** Game DVR background recording, a known source of frame-time cost. */
	readonly gameDvr: boolean | null;
	/** Per-application GPU preferences registered by the user. */
	readonly gpuPreferenceCount: number;
}

export interface GraphicsProfile {
	readonly controllers: readonly GraphicsController[];
	readonly displays: readonly DisplayDevice[];
	readonly settings: GraphicsSettings;
	readonly scannedAt: string;
}

/** Device Manager problem state, mapped from the Win32 CM_PROB_* codes. */
export type DeviceHealth = 'ok' | 'warning' | 'error' | 'disabled' | 'unknown';

export interface DriverRecord {
	readonly id: string;
	readonly deviceName: string;
	readonly deviceClass: string | null;
	readonly manufacturer: string | null;
	/** Who published the driver package; distinguishes inbox drivers from vendor ones. */
	readonly driverProvider: string | null;
	readonly driverVersion: string | null;
	readonly driverDate: string | null;
	readonly signed: boolean | null;
	readonly health: DeviceHealth;
	readonly problemCode: number | null;
	readonly infName: string | null;
}

export interface SystemCapabilities {
	readonly osDistro: string;
	readonly osRelease: string;
	readonly osBuild: string;
	readonly architecture: string;
	readonly cpuBrand: string;
	readonly cpuCores: number;
	readonly cpuPhysicalCores: number;
	readonly memoryTotalBytes: Bytes;
	readonly memoryFreeBytes: Bytes;
	readonly virtualizationEnabled: boolean | null;
	readonly secureBoot: boolean | null;
	readonly diskCount: number;
	readonly hasSsd: boolean;
	readonly batteryPresent: boolean;
	readonly powerPlan: string | null;
}

export interface HardwareReport {
	readonly graphics: GraphicsProfile;
	readonly drivers: readonly DriverRecord[];
	readonly capabilities: SystemCapabilities;
	readonly scannedAt: string;
}

/**
 * True for drivers that ship inside Windows itself.
 *
 * Inbox drivers legitimately carry dates from the 2000s because the hardware
 * contract has not changed since; treating them as stale would bury the handful
 * of vendor drivers that genuinely need attention.
 */
export function isInboxDriver(driver: DriverRecord): boolean {
	const provider = driver.driverProvider?.toLowerCase() ?? '';
	const manufacturer = driver.manufacturer?.toLowerCase() ?? '';
	return (
		provider.startsWith('microsoft') ||
		manufacturer.startsWith('microsoft') ||
		manufacturer.startsWith('(standard') ||
		manufacturer.startsWith('(generic')
	);
}

/**
 * Drivers predating this year carry a sentinel date rather than a real one.
 * Windows itself ships packages stamped 1968 and 2006, so an age derived from
 * them is meaningless and must not drive a recommendation.
 */
const EARLIEST_PLAUSIBLE_DRIVER_YEAR = 1995;

/** Age of a driver in whole days, or null when the date is unknown or implausible. */
export function driverAgeDays(driver: DriverRecord, now: Date = new Date()): number | null {
	if (!driver.driverDate) return null;
	const date = new Date(driver.driverDate);
	if (Number.isNaN(date.getTime())) return null;
	if (date.getUTCFullYear() < EARLIEST_PLAUSIBLE_DRIVER_YEAR) return null;
	return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}
