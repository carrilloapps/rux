import {text} from '@/domain/common';
import type {DisplayDevice, GraphicsProfile} from '@/domain/hardware';
import type {Recommendation} from '@/domain/recommendation';
import {sortRecommendations} from '@/domain/recommendation';

/** A refresh rate this far below the panel maximum is treated as misconfigured. */
const REFRESH_TOLERANCE_HZ = 2;

/** Driver builds older than this are worth flagging on an actively developed GPU. */
const STALE_GRAPHICS_DRIVER_DAYS = 365;

function ageInDays(isoDate: string | null, now: Date): number | null {
	if (!isoDate) return null;
	const date = new Date(isoDate);
	if (Number.isNaN(date.getTime())) return null;
	return Math.floor((now.getTime() - date.getTime()) / 86_400_000);
}

function displayLabel(display: DisplayDevice, index: number): string {
	const name = [display.vendor, display.model].filter(Boolean).join(' ').trim();
	return name.length > 0 ? name : `Display ${index + 1}`;
}

/** Windows DPI scale factors, as the ratio between native and reported size. */
const DPI_SCALE_FACTORS: readonly number[] = [1.25, 1.5, 1.75, 2, 2.25, 2.5, 3];
const SCALE_EPSILON = 0.01;

/**
 * True when the reported size differs from native only because the desktop is
 * DPI-scaled. Reporting that as a misconfigured resolution would be wrong: the
 * panel is running at its native mode and only the logical size differs.
 */
function isDpiScaled(
	currentWidth: number,
	currentHeight: number,
	nativeWidth: number,
	nativeHeight: number,
): boolean {
	// Both axes must scale by the same factor. Checking width alone would
	// misread a different aspect ratio, such as 1280x1024 on a 1920x1080 panel,
	// as scaling and hide a genuinely wrong display mode.
	const widthRatio = nativeWidth / currentWidth;
	const heightRatio = nativeHeight / currentHeight;
	if (Math.abs(widthRatio - heightRatio) > SCALE_EPSILON) return false;

	return DPI_SCALE_FACTORS.some(factor => Math.abs(widthRatio - factor) < SCALE_EPSILON);
}

function resolutionMismatch(display: DisplayDevice): boolean {
	const {currentWidth, currentHeight, nativeWidth, nativeHeight} = display;

	// Zero counts as unknown rather than as a wrong mode: a driver that has not
	// finished initialising reports zero where it later reports a real size, and
	// dividing by it would produce Infinity rather than a ratio.
	if (!currentWidth || !currentHeight || !nativeWidth || !nativeHeight) return false;
	if (currentWidth === nativeWidth && currentHeight === nativeHeight) return false;

	return !isDpiScaled(currentWidth, currentHeight, nativeWidth, nativeHeight);
}

function refreshMismatch(display: DisplayDevice): boolean {
	return (
		display.currentRefreshHz !== null &&
		display.maximumRefreshHz !== null &&
		display.maximumRefreshHz - display.currentRefreshHz > REFRESH_TOLERANCE_HZ
	);
}

/**
 * Derives actionable graphics advice from an observed profile.
 *
 * Pure and synchronous: every rule is a function of the profile alone, which
 * keeps the rules unit-testable without a GPU present.
 */
export function analyzeGraphics(profile: GraphicsProfile, now: Date = new Date()): readonly Recommendation[] {
	const recommendations: Recommendation[] = [];
	const {controllers, displays, settings} = profile;

	const discrete = controllers.filter(controller => !controller.integrated);
	const integrated = controllers.filter(controller => controller.integrated);

	// A hybrid laptop that renders on the iGPU wastes the discrete GPU entirely.
	if (discrete.length > 0 && integrated.length > 0 && settings.gpuPreferenceCount === 0) {
		recommendations.push({
			id: 'graphics.hybrid-no-preference',
			area: 'graphics',
			impact: 'high',
			title: text('recommendations.graphics.hybridNoPreference.title'),
			finding: text('recommendations.graphics.hybridNoPreference.finding', {
				discrete: discrete[0]!.model,
				integrated: integrated[0]!.model,
			}),
			advice: text('recommendations.graphics.hybridNoPreference.advice'),
			action: {
				location: text('actions.graphicsSettings'),
				command: 'start ms-settings:display-advancedgraphics',
			},
			evidence: controllers.map(controller => `${controller.vendor} ${controller.model}`),
		});
	}

	// Hardware-accelerated GPU scheduling reduces latency on supported hardware.
	if (settings.hardwareAcceleratedScheduling === false && discrete.length > 0) {
		recommendations.push({
			id: 'graphics.hags-disabled',
			area: 'graphics',
			impact: 'medium',
			title: text('recommendations.graphics.hagsDisabled.title'),
			finding: text('recommendations.graphics.hagsDisabled.finding'),
			advice: text('recommendations.graphics.hagsDisabled.advice'),
			action: {
				location: text('actions.graphicsSettings'),
				command: 'start ms-settings:display-advancedgraphics',
			},
			evidence: ['HKLM\\SYSTEM\\CurrentControlSet\\Control\\GraphicsDrivers\\HwSchMode'],
		});
	}

	// Background recording costs frame time on every machine that leaves it on.
	if (settings.gameDvr === true) {
		recommendations.push({
			id: 'graphics.game-dvr-enabled',
			area: 'graphics',
			impact: 'medium',
			title: text('recommendations.graphics.gameDvrEnabled.title'),
			finding: text('recommendations.graphics.gameDvrEnabled.finding'),
			advice: text('recommendations.graphics.gameDvrEnabled.advice'),
			action: {
				location: text('actions.gameCaptureSettings'),
				command: 'start ms-settings:gaming-gamedvr',
			},
			evidence: ['HKCU\\System\\GameConfigStore\\GameDVR_Enabled'],
		});
	}

	if (settings.gameMode === false) {
		recommendations.push({
			id: 'graphics.game-mode-disabled',
			area: 'graphics',
			impact: 'low',
			title: text('recommendations.graphics.gameModeDisabled.title'),
			finding: text('recommendations.graphics.gameModeDisabled.finding'),
			advice: text('recommendations.graphics.gameModeDisabled.advice'),
			action: {location: text('actions.gameModeSettings'), command: 'start ms-settings:gaming-gamemode'},
			evidence: ['HKCU\\Software\\Microsoft\\GameBar\\AutoGameModeEnabled'],
		});
	}

	displays.forEach((display, index) => {
		const label = displayLabel(display, index);

		if (refreshMismatch(display)) {
			recommendations.push({
				id: `display.refresh-below-maximum.${display.id}`,
				area: 'display',
				impact: 'high',
				title: text('recommendations.display.refreshBelowMaximum.title'),
				finding: text('recommendations.display.refreshBelowMaximum.finding', {
					display: label,
					current: display.currentRefreshHz ?? 0,
					maximum: display.maximumRefreshHz ?? 0,
				}),
				advice: text('recommendations.display.refreshBelowMaximum.advice'),
				action: {
					location: text('actions.advancedDisplaySettings'),
					command: 'start ms-settings:display-advanced',
				},
				evidence: [`${display.currentRefreshHz ?? '?'} Hz / ${display.maximumRefreshHz ?? '?'} Hz`],
			});
		}

		if (resolutionMismatch(display)) {
			recommendations.push({
				id: `display.non-native-resolution.${display.id}`,
				area: 'display',
				impact: 'medium',
				title: text('recommendations.display.nonNativeResolution.title'),
				finding: text('recommendations.display.nonNativeResolution.finding', {
					display: label,
					current: `${display.currentWidth ?? 0}x${display.currentHeight ?? 0}`,
					native: `${display.nativeWidth ?? 0}x${display.nativeHeight ?? 0}`,
				}),
				advice: text('recommendations.display.nonNativeResolution.advice'),
				action: {location: text('actions.displaySettings'), command: 'start ms-settings:display'},
				evidence: [
					`current ${display.currentWidth ?? 0}x${display.currentHeight ?? 0}`,
					`native ${display.nativeWidth ?? 0}x${display.nativeHeight ?? 0}`,
				],
			});
		}

		if (display.pixelDepth !== null && display.pixelDepth < 32) {
			recommendations.push({
				id: `display.low-color-depth.${display.id}`,
				area: 'display',
				impact: 'medium',
				title: text('recommendations.display.lowColorDepth.title'),
				finding: text('recommendations.display.lowColorDepth.finding', {
					display: label,
					depth: display.pixelDepth,
				}),
				advice: text('recommendations.display.lowColorDepth.advice'),
				action: {
					location: text('actions.advancedDisplaySettings'),
					command: 'start ms-settings:display-advanced',
				},
				evidence: [`${display.pixelDepth}-bit`],
			});
		}
	});

	for (const controller of controllers) {
		const age = ageInDays(controller.driverDate, now);
		if (age !== null && age > STALE_GRAPHICS_DRIVER_DAYS) {
			recommendations.push({
				id: `graphics.stale-driver.${controller.id}`,
				area: 'graphics',
				impact: 'high',
				title: text('recommendations.graphics.staleDriver.title'),
				finding: text('recommendations.graphics.staleDriver.finding', {
					model: controller.model,
					days: age,
					version: controller.driverVersion ?? 'unknown',
				}),
				advice: text('recommendations.graphics.staleDriver.advice'),
				action: {location: text('actions.vendorDriverPage'), command: null},
				evidence: [
					`${controller.vendor} ${controller.model}`,
					`driver ${controller.driverVersion ?? '?'} (${controller.driverDate ?? '?'})`,
				],
			});
		}
	}

	if (controllers.length === 0) {
		recommendations.push({
			id: 'graphics.no-controller',
			area: 'graphics',
			impact: 'info',
			title: text('recommendations.graphics.noController.title'),
			finding: text('recommendations.graphics.noController.finding'),
			advice: text('recommendations.graphics.noController.advice'),
			action: null,
			evidence: [],
		});
	}

	return sortRecommendations(recommendations);
}
