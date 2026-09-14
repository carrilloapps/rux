import {describe, expect, it} from 'vitest';
import {createApplication, createPorts} from '@/infrastructure/container';

const PORT_NAMES = [
	'backup',
	'hardware',
	'junkClean',
	'junkScan',
	'residueRemoval',
	'residueScan',
	'startupInventory',
	'startupMutation',
	'wsl',
];

const USE_CASE_NAMES = [
	'analyzeHardware',
	'cleanJunk',
	'manageBackups',
	'mutateStartupEntry',
	'refreshProcesses',
	'scanJunk',
	'scanResidue',
	'scanStartup',
	'removeResidue',
];

describe('composition root', () => {
	it('builds every port', () => {
		expect(Object.keys(createPorts()).sort()).toEqual([...PORT_NAMES].sort());
	});

	it('builds every use case from those ports', () => {
		expect(Object.keys(createApplication()).sort()).toEqual([...USE_CASE_NAMES].sort());
	});

	it('hands out independent instances, so nothing is shared by accident', () => {
		expect(createPorts()).not.toBe(createPorts());
		expect(createApplication()).not.toBe(createApplication());
	});
});
