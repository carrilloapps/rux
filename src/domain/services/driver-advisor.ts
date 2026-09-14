import {text} from '@/domain/common';
import type {DriverRecord, SystemCapabilities} from '@/domain/hardware';
import {driverAgeDays, isInboxDriver} from '@/domain/hardware';
import type {Recommendation} from '@/domain/recommendation';
import {sortRecommendations} from '@/domain/recommendation';

/** Drivers untouched for this long are worth reviewing, but are not a fault by themselves. */
const STALE_DRIVER_DAYS = 365 * 3;

/** Device classes where a stale or broken driver has user-visible consequences. */
const CRITICAL_CLASSES: readonly string[] = [
	'display',
	'net',
	'system',
	'hdc',
	'scsiadapter',
	'usb',
	'media',
];

/** Free memory below this share of total suggests real pressure rather than healthy caching. */
const LOW_MEMORY_RATIO = 0.1;

function isCritical(driver: DriverRecord): boolean {
	const deviceClass = driver.deviceClass?.toLowerCase() ?? '';
	return CRITICAL_CLASSES.includes(deviceClass);
}

/**
 * Derives actionable driver and capability advice.
 *
 * Device Manager problem codes are the only authoritative signal Windows
 * exposes, so they drive the high-impact rules; everything else is advisory.
 */
export function analyzeDrivers(
	drivers: readonly DriverRecord[],
	capabilities: SystemCapabilities,
	now: Date = new Date(),
): readonly Recommendation[] {
	const recommendations: Recommendation[] = [];

	const failing = drivers.filter(driver => driver.health === 'error');
	const warning = drivers.filter(driver => driver.health === 'warning');
	const unsigned = drivers.filter(driver => driver.signed === false);

	if (failing.length > 0) {
		recommendations.push({
			id: 'driver.devices-in-error',
			area: 'driver',
			impact: 'critical',
			title: text('recommendations.driver.devicesInError.title'),
			finding: text('recommendations.driver.devicesInError.finding', {count: failing.length}),
			advice: text('recommendations.driver.devicesInError.advice'),
			action: {location: text('actions.deviceManager'), command: 'devmgmt.msc'},
			evidence: failing.slice(0, 8).map(driver => `${driver.deviceName} (code ${driver.problemCode ?? '?'})`),
		});
	}

	if (warning.length > 0) {
		recommendations.push({
			id: 'driver.devices-degraded',
			area: 'driver',
			impact: 'high',
			title: text('recommendations.driver.devicesDegraded.title'),
			finding: text('recommendations.driver.devicesDegraded.finding', {count: warning.length}),
			advice: text('recommendations.driver.devicesDegraded.advice'),
			action: {location: text('actions.deviceManager'), command: 'devmgmt.msc'},
			evidence: warning.slice(0, 8).map(driver => `${driver.deviceName} (code ${driver.problemCode ?? '?'})`),
		});
	}

	const staleCritical = drivers.filter(driver => {
		if (!isCritical(driver)) return false;
		// Inbox drivers are dated by contract, not by neglect.
		if (isInboxDriver(driver)) return false;
		const age = driverAgeDays(driver, now);
		return age !== null && age > STALE_DRIVER_DAYS;
	});

	if (staleCritical.length > 0) {
		recommendations.push({
			id: 'driver.stale-critical',
			area: 'driver',
			impact: 'medium',
			title: text('recommendations.driver.staleCritical.title'),
			finding: text('recommendations.driver.staleCritical.finding', {count: staleCritical.length}),
			advice: text('recommendations.driver.staleCritical.advice'),
			action: {location: text('actions.windowsUpdateOptional'), command: 'start ms-settings:windowsupdate'},
			evidence: staleCritical
				.slice(0, 8)
				.map(driver => `${driver.deviceName} - ${driver.driverDate?.slice(0, 10) ?? '?'}`),
		});
	}

	if (unsigned.length > 0) {
		recommendations.push({
			id: 'driver.unsigned',
			area: 'driver',
			impact: 'high',
			title: text('recommendations.driver.unsigned.title'),
			finding: text('recommendations.driver.unsigned.finding', {count: unsigned.length}),
			advice: text('recommendations.driver.unsigned.advice'),
			action: {location: text('actions.deviceManager'), command: 'devmgmt.msc'},
			evidence: unsigned.slice(0, 8).map(driver => driver.deviceName),
		});
	}

	if (capabilities.secureBoot === false) {
		recommendations.push({
			id: 'system.secure-boot-off',
			area: 'system',
			impact: 'medium',
			title: text('recommendations.system.secureBootOff.title'),
			finding: text('recommendations.system.secureBootOff.finding'),
			advice: text('recommendations.system.secureBootOff.advice'),
			action: {location: text('actions.firmwareSettings'), command: null},
			evidence: ['SecureBoot: disabled'],
		});
	}

	if (capabilities.virtualizationEnabled === false) {
		recommendations.push({
			id: 'system.virtualization-off',
			area: 'system',
			impact: 'low',
			title: text('recommendations.system.virtualizationOff.title'),
			finding: text('recommendations.system.virtualizationOff.finding'),
			advice: text('recommendations.system.virtualizationOff.advice'),
			action: {location: text('actions.firmwareSettings'), command: null},
			evidence: ['Virtualization: disabled'],
		});
	}

	if (
		capabilities.memoryTotalBytes > 0 &&
		capabilities.memoryFreeBytes / capabilities.memoryTotalBytes < LOW_MEMORY_RATIO
	) {
		recommendations.push({
			id: 'system.memory-pressure',
			area: 'system',
			impact: 'medium',
			title: text('recommendations.system.memoryPressure.title'),
			finding: text('recommendations.system.memoryPressure.finding', {
				percent: Math.round((capabilities.memoryFreeBytes / capabilities.memoryTotalBytes) * 100),
			}),
			advice: text('recommendations.system.memoryPressure.advice'),
			action: {location: text('actions.ruxStartup'), command: 'rux'},
			evidence: [`${capabilities.memoryFreeBytes} / ${capabilities.memoryTotalBytes} bytes free`],
		});
	}

	if (capabilities.batteryPresent && capabilities.powerPlan !== null) {
		const plan = capabilities.powerPlan.toLowerCase();
		if (plan.includes('power saver') || plan.includes('economiz')) {
			recommendations.push({
				id: 'system.power-saver-plan',
				area: 'system',
				impact: 'low',
				title: text('recommendations.system.powerSaverPlan.title'),
				finding: text('recommendations.system.powerSaverPlan.finding', {plan: capabilities.powerPlan}),
				advice: text('recommendations.system.powerSaverPlan.advice'),
				action: {location: text('actions.powerSettings'), command: 'start ms-settings:powersleep'},
				evidence: [capabilities.powerPlan],
			});
		}
	}

	if (drivers.length > 0 && failing.length === 0 && warning.length === 0 && unsigned.length === 0) {
		recommendations.push({
			id: 'driver.all-healthy',
			area: 'driver',
			impact: 'info',
			title: text('recommendations.driver.allHealthy.title'),
			finding: text('recommendations.driver.allHealthy.finding', {count: drivers.length}),
			advice: text('recommendations.driver.allHealthy.advice'),
			action: null,
			evidence: [],
		});
	}

	return sortRecommendations(recommendations);
}
