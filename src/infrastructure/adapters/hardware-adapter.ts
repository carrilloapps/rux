import si from 'systeminformation';
import {z} from 'zod';
import {bytes} from '@/domain/common';
import type {
	DisplayDevice,
	DriverRecord,
	GraphicsController,
	HardwareReport,
	SystemCapabilities,
} from '@/domain/hardware';
import type {HardwarePort} from '@/application/ports';
import type {PowerShellRunner} from '@/infrastructure/powershell/runner';
import {psArray, psBoolean, psCount, psNumber, psString, psText} from '@/infrastructure/powershell/schema';
import {INSPECT_SYSTEM_SCRIPT} from '@/infrastructure/powershell/scripts/hardware';

const settingsSchema = z.object({
	hardwareAcceleratedScheduling: psBoolean,
	variableRefreshRate: psBoolean,
	gameMode: psBoolean,
	gameDvr: psBoolean,
	gpuPreferenceCount: psCount(0),
});

const displayModeSchema = z.object({
	adapter: psText(''),
	width: z.number(),
	height: z.number(),
	refreshHz: psNumber,
	maxRefreshHz: psNumber,
	bitsPerPixel: psNumber,
});

const driverSchema = z.object({
	id: z.string(),
	deviceName: psText(''),
	deviceClass: psString,
	manufacturer: psString,
	driverProvider: psString,
	driverVersion: psString,
	driverDate: psString,
	signed: psBoolean,
	health: z.enum(['ok', 'warning', 'error', 'disabled', 'unknown']),
	problemCode: psNumber,
	infName: psString,
});

const capabilitiesSchema = z.object({
	secureBoot: psBoolean,
	virtualizationEnabled: psBoolean,
	powerPlan: psString,
	batteryPresent: z
		.union([z.boolean(), z.null()])
		.optional()
		.transform((v): boolean => v === true),
	osBuild: psText(''),
});

const inspectSchema = z.object({
	graphicsSettings: settingsSchema,
	displayModes: psArray(displayModeSchema),
	drivers: psArray(driverSchema),
	capabilities: capabilitiesSchema,
});

/** Adapters with no dedicated memory share system RAM; the vendor string alone is unreliable. */
function isIntegrated(controller: si.Systeminformation.GraphicsControllerData): boolean {
	const model = `${controller.vendor ?? ''} ${controller.model ?? ''}`.toLowerCase();
	if (model.includes('intel') && !model.includes('arc')) return true;
	if (model.includes('radeon graphics') || model.includes('vega') || model.includes('uhd')) return true;
	if (typeof controller.vram === 'number' && controller.vram > 0 && controller.vramDynamic === true)
		return true;
	return false;
}

function toController(
	controller: si.Systeminformation.GraphicsControllerData,
	index: number,
	registryDate: string | null,
): GraphicsController {
	return {
		id: controller.busAddress ?? `gpu-${index}`,
		vendor: controller.vendor ?? 'unknown',
		model: controller.model ?? 'unknown',
		busAddress: controller.busAddress ?? null,
		// systeminformation reports VRAM in megabytes.
		vramBytes:
			typeof controller.vram === 'number' && controller.vram > 0
				? bytes(controller.vram * 1024 * 1024)
				: null,
		integrated: isIntegrated(controller),
		driverVersion: controller.driverVersion ?? null,
		driverDate: registryDate,
	};
}

type DisplayMode = z.infer<typeof displayModeSchema>;

/**
 * systeminformation reports the DPI-scaled desktop size as the current
 * resolution, so a 1920x1080 panel at 125% scaling reads as 1536x864. The
 * adapter's own mode is authoritative and is preferred whenever available.
 */
function toDisplay(
	display: si.Systeminformation.GraphicsDisplayData,
	index: number,
	mode: DisplayMode | undefined,
): DisplayDevice {
	const pixelDepth =
		mode?.bitsPerPixel ??
		(typeof display.pixelDepth === 'number' ? display.pixelDepth : Number(display.pixelDepth) || null);

	return {
		id: display.deviceName ?? `display-${index}`,
		vendor: display.vendor ?? null,
		model: display.model ?? null,
		connection: display.connection ?? null,
		main: display.main === true,
		builtin: display.builtin === true,
		currentWidth: mode?.width ?? display.currentResX ?? null,
		currentHeight: mode?.height ?? display.currentResY ?? null,
		nativeWidth: display.resolutionX ?? null,
		nativeHeight: display.resolutionY ?? null,
		currentRefreshHz: mode?.refreshHz ?? display.currentRefreshRate ?? null,
		maximumRefreshHz: mode?.maxRefreshHz ?? null,
		pixelDepth,
	};
}

function toDriver(raw: z.infer<typeof driverSchema>): DriverRecord {
	return {
		id: raw.id,
		deviceName: raw.deviceName,
		deviceClass: raw.deviceClass,
		manufacturer: raw.manufacturer,
		driverProvider: raw.driverProvider,
		driverVersion: raw.driverVersion,
		driverDate: raw.driverDate,
		signed: raw.signed,
		health: raw.health,
		problemCode: raw.problemCode,
		infName: raw.infName,
	};
}

/**
 * Hardware inspection deliberately combines two sources.
 *
 * systeminformation gives clean, cross-checked adapter and display data;
 * PowerShell supplies the registry switches and Device Manager problem codes it
 * cannot see. Both run concurrently because neither depends on the other.
 */
export function createHardwareAdapter(runner: PowerShellRunner): HardwarePort {
	return {
		async inspect(): Promise<HardwareReport> {
			const [graphics, osInfo, cpu, memory, disks, script] = await Promise.all([
				si.graphics(),
				si.osInfo(),
				si.cpu(),
				si.mem(),
				si.diskLayout(),
				runner.json(INSPECT_SYSTEM_SCRIPT, inspectSchema),
			]);

			const drivers = script.drivers.map(toDriver);

			// The display driver's date is the most useful stamp for a GPU, and only
			// the PnP inventory carries it.
			const displayDriver = drivers.find(driver => driver.deviceClass?.toLowerCase() === 'display');

			const controllers = graphics.controllers.map((controller, index) =>
				toController(controller, index, displayDriver?.driverDate ?? null),
			);

			const capabilities: SystemCapabilities = {
				osDistro: osInfo.distro,
				osRelease: osInfo.release,
				osBuild: script.capabilities.osBuild || osInfo.build,
				architecture: osInfo.arch,
				cpuBrand: `${cpu.manufacturer} ${cpu.brand}`.trim(),
				cpuCores: cpu.cores,
				cpuPhysicalCores: cpu.physicalCores,
				memoryTotalBytes: bytes(memory.total),
				memoryFreeBytes: bytes(memory.available),
				virtualizationEnabled: script.capabilities.virtualizationEnabled,
				secureBoot: script.capabilities.secureBoot,
				diskCount: disks.length,
				hasSsd: disks.some(disk => disk.type?.toUpperCase() === 'SSD' || disk.type?.toUpperCase() === 'NVME'),
				batteryPresent: script.capabilities.batteryPresent,
				powerPlan: script.capabilities.powerPlan,
			};

			// One desktop mode is shared by all displays on an adapter; the primary
			// mode is the correct reference for the primary display.
			const primaryMode = script.displayModes[0];

			return {
				graphics: {
					controllers,
					displays: graphics.displays.map((display, index) =>
						toDisplay(
							display,
							index,
							display.main === true || index === 0 ? primaryMode : script.displayModes[index],
						),
					),
					settings: script.graphicsSettings,
					scannedAt: new Date().toISOString(),
				},
				drivers,
				capabilities,
				scannedAt: new Date().toISOString(),
			};
		},
	};
}
