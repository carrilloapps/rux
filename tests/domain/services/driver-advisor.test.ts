import {describe, expect, it} from 'vitest';
import {bytes} from '@/domain/common';
import {analyzeDrivers} from '@/domain/services/driver-advisor';
import {aDriver, capabilities} from '@tests/helpers/builders';

const NOW = new Date('2026-09-14T00:00:00.000Z');

const ids = (items: readonly {id: string}[]): string[] => items.map(item => item.id);

describe('analyzeDrivers', () => {
	it('confirms a healthy machine', () => {
		const result = analyzeDrivers([aDriver()], capabilities(), NOW);
		expect(ids(result)).toEqual(['driver.all-healthy']);
		expect(result[0]?.impact).toBe('info');
	});

	it('says nothing when there are no devices to judge', () => {
		expect(analyzeDrivers([], capabilities(), NOW)).toHaveLength(0);
	});

	it('defaults the clock to now', () => {
		expect(analyzeDrivers([aDriver()], capabilities())).toHaveLength(1);
	});

	describe('device health', () => {
		it('raises devices in error to critical', () => {
			const result = analyzeDrivers([aDriver({health: 'error', problemCode: 28})], capabilities(), NOW);
			expect(result[0]?.id).toBe('driver.devices-in-error');
			expect(result[0]?.impact).toBe('critical');
			expect(result[0]?.evidence[0]).toContain('code 28');
		});

		it('reports degraded devices separately', () => {
			const result = analyzeDrivers([aDriver({health: 'warning', problemCode: 24})], capabilities(), NOW);
			expect(ids(result)).toContain('driver.devices-degraded');
		});

		it('handles a device with no problem code recorded', () => {
			const result = analyzeDrivers([aDriver({health: 'error', problemCode: null})], capabilities(), NOW);
			expect(result[0]?.evidence[0]).toContain('code ?');
		});

		it('lists at most eight devices as evidence', () => {
			const drivers = Array.from({length: 12}, (_value, index) =>
				aDriver({id: `d${index}`, health: 'error', problemCode: 10}),
			);
			const result = analyzeDrivers(drivers, capabilities(), NOW);
			expect(result[0]?.evidence).toHaveLength(8);
		});

		it('flags unsigned drivers', () => {
			const result = analyzeDrivers([aDriver({signed: false})], capabilities(), NOW);
			expect(ids(result)).toContain('driver.unsigned');
		});

		it('does not treat an unknown signature as unsigned', () => {
			const result = analyzeDrivers([aDriver({signed: null})], capabilities(), NOW);
			expect(ids(result)).not.toContain('driver.unsigned');
		});

		it('withholds the healthy verdict when anything is wrong', () => {
			const result = analyzeDrivers([aDriver({signed: false})], capabilities(), NOW);
			expect(ids(result)).not.toContain('driver.all-healthy');
		});
	});

	describe('driver age', () => {
		it('flags a stale vendor driver on a core device class', () => {
			const result = analyzeDrivers(
				[aDriver({deviceClass: 'Net', driverDate: '2019-01-01T00:00:00.000Z'})],
				capabilities(),
				NOW,
			);
			expect(ids(result)).toContain('driver.stale-critical');
		});

		it('ignores a stale driver on a peripheral class', () => {
			const result = analyzeDrivers(
				[aDriver({deviceClass: 'Printer', driverDate: '2019-01-01T00:00:00.000Z'})],
				capabilities(),
				NOW,
			);
			expect(ids(result)).not.toContain('driver.stale-critical');
		});

		it('ignores inbox drivers, which are dated by contract', () => {
			const result = analyzeDrivers(
				[
					aDriver({
						deviceClass: 'System',
						driverProvider: 'Microsoft',
						driverDate: '2006-06-21T00:00:00.000Z',
					}),
				],
				capabilities(),
				NOW,
			);
			expect(ids(result)).not.toContain('driver.stale-critical');
		});

		it('ignores a device with no class recorded', () => {
			const result = analyzeDrivers(
				[aDriver({deviceClass: null, driverDate: '2019-01-01T00:00:00.000Z'})],
				capabilities(),
				NOW,
			);
			expect(ids(result)).not.toContain('driver.stale-critical');
		});
	});

	describe('system capabilities', () => {
		it('flags disabled Secure Boot', () => {
			expect(ids(analyzeDrivers([aDriver()], capabilities({secureBoot: false}), NOW))).toContain(
				'system.secure-boot-off',
			);
		});

		it('says nothing when Secure Boot cannot be read', () => {
			expect(ids(analyzeDrivers([aDriver()], capabilities({secureBoot: null}), NOW))).not.toContain(
				'system.secure-boot-off',
			);
		});

		it('flags disabled virtualization', () => {
			expect(ids(analyzeDrivers([aDriver()], capabilities({virtualizationEnabled: false}), NOW))).toContain(
				'system.virtualization-off',
			);
		});

		it('flags memory pressure with the free percentage', () => {
			const result = analyzeDrivers(
				[aDriver()],
				capabilities({memoryTotalBytes: bytes(1000), memoryFreeBytes: bytes(50)}),
				NOW,
			);
			const finding = result.find(item => item.id === 'system.memory-pressure');
			expect(finding?.finding.values?.percent).toBe(5);
		});

		it('cannot judge memory when the total is unknown', () => {
			const result = analyzeDrivers(
				[aDriver()],
				capabilities({memoryTotalBytes: bytes(0), memoryFreeBytes: bytes(0)}),
				NOW,
			);
			expect(ids(result)).not.toContain('system.memory-pressure');
		});

		it.each(['Power saver', 'Economizador de energia'])('flags the %s plan on a laptop', plan => {
			const result = analyzeDrivers([aDriver()], capabilities({batteryPresent: true, powerPlan: plan}), NOW);
			expect(ids(result)).toContain('system.power-saver-plan');
		});

		it('leaves a balanced plan alone', () => {
			const result = analyzeDrivers(
				[aDriver()],
				capabilities({batteryPresent: true, powerPlan: 'Balanced'}),
				NOW,
			);
			expect(ids(result)).not.toContain('system.power-saver-plan');
		});

		it('ignores the power plan on a desktop', () => {
			const result = analyzeDrivers(
				[aDriver()],
				capabilities({batteryPresent: false, powerPlan: 'Power saver'}),
				NOW,
			);
			expect(ids(result)).not.toContain('system.power-saver-plan');
		});

		it('ignores an unknown power plan', () => {
			const result = analyzeDrivers([aDriver()], capabilities({batteryPresent: true, powerPlan: null}), NOW);
			expect(ids(result)).not.toContain('system.power-saver-plan');
		});
	});
});
