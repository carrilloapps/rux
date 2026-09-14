import {describe, expect, it} from 'vitest';
import {IMPACT_LEVELS, IMPACT_ORDER, RISK_LEVELS, bytes, text} from '@/domain/common';
import {JUNK_CATEGORIES} from '@/domain/junk';
import {RECOMMENDATION_AREAS, sortRecommendations} from '@/domain/recommendation';
import {RESIDUE_CLASSES, isResidueClass, requiresElevation, safeFindings} from '@/domain/residue';
import {STARTUP_SOURCES, canToggle, statusOf} from '@/domain/startup';
import {driverAgeDays, isInboxDriver} from '@/domain/hardware';
import {defaultWslMemoryBytes, hasWsl2Distribution} from '@/domain/wsl';
import {GIB, aDriver, aResidueFinding, aStartupEntry, aWslStatus} from '@tests/helpers/builders';

describe('bytes', () => {
	it('keeps a positive value', () => {
		expect(bytes(2048)).toBe(2048);
	});

	it('floors anything unusable to zero', () => {
		expect(bytes(-1)).toBe(0);
		expect(bytes(0)).toBe(0);
		expect(bytes(Number.NaN)).toBe(0);
		expect(bytes(Number.POSITIVE_INFINITY)).toBe(0);
	});
});

describe('text', () => {
	it('omits the values object when there is nothing to interpolate', () => {
		expect(text('a.key')).toEqual({key: 'a.key'});
	});

	it('carries interpolation values', () => {
		expect(text('a.key', {count: 2})).toEqual({key: 'a.key', values: {count: 2}});
	});
});

describe('vocabulary', () => {
	it('orders impact from critical to info', () => {
		const ordered = [...IMPACT_LEVELS].sort((a, b) => IMPACT_ORDER[a] - IMPACT_ORDER[b]);
		expect(ordered).toEqual(['critical', 'high', 'medium', 'low', 'info']);
	});

	it('exposes the full vocabulary', () => {
		expect(RISK_LEVELS).toContain('safe');
		expect(RECOMMENDATION_AREAS).toContain('wsl');
		expect(JUNK_CATEGORIES).toContain('browser-cache');
		expect(STARTUP_SOURCES).toContain('scheduled-task');
		expect(RESIDUE_CLASSES).toContain('firewall');
	});
});

describe('sortRecommendations', () => {
	const make = (id: string, impact: (typeof IMPACT_LEVELS)[number]) => ({
		id,
		area: 'system' as const,
		impact,
		title: text('t'),
		finding: text('f'),
		advice: text('a'),
		action: null,
		evidence: [],
	});

	it('sorts by impact, then by id', () => {
		const sorted = sortRecommendations([make('b', 'low'), make('a', 'critical'), make('a', 'low')]);
		expect(sorted.map(item => `${item.id}:${item.impact}`)).toEqual(['a:critical', 'a:low', 'b:low']);
	});

	it('does not mutate its input', () => {
		const input = [make('b', 'low'), make('a', 'critical')];
		sortRecommendations(input);
		expect(input[0]?.id).toBe('b');
	});
});

describe('statusOf', () => {
	it('reports disabled before anything else', () => {
		expect(statusOf(aStartupEntry({enabled: false, executableExists: false, running: true}))).toBe(
			'disabled',
		);
	});

	it('reports missing when the executable is gone', () => {
		expect(statusOf(aStartupEntry({executableExists: false}))).toBe('missing');
	});

	it('distinguishes running from stopped', () => {
		expect(statusOf(aStartupEntry({running: true}))).toBe('running');
		expect(statusOf(aStartupEntry({running: false}))).toBe('stopped');
	});
});

describe('canToggle', () => {
	it('allows scheduled tasks', () => {
		expect(canToggle(aStartupEntry({kind: 'task', approvalKey: null}))).toBe(true);
	});

	it('allows registry entries that Windows tracks an approval flag for', () => {
		expect(canToggle(aStartupEntry({approvalKey: 'Run'}))).toBe(true);
	});

	it('refuses RunOnce entries, which have no approval flag', () => {
		expect(canToggle(aStartupEntry({source: 'run-once-user', approvalKey: null}))).toBe(false);
	});
});

describe('residue helpers', () => {
	it('recognises known classes', () => {
		expect(isResidueClass('service')).toBe(true);
		expect(isResidueClass('nonsense')).toBe(false);
	});

	it('detects when a batch needs elevation', () => {
		expect(requiresElevation([aResidueFinding()])).toBe(false);
		expect(requiresElevation([aResidueFinding(), aResidueFinding({elevation: 'administrator'})])).toBe(true);
	});

	it('keeps only provable findings', () => {
		const findings = [aResidueFinding(), aResidueFinding({id: 'x', risk: 'review'})];
		expect(safeFindings(findings)).toHaveLength(1);
		expect(safeFindings(findings)[0]?.risk).toBe('safe');
	});
});

describe('driver dates', () => {
	const now = new Date('2026-09-14T00:00:00.000Z');

	it('returns null when there is no date', () => {
		expect(driverAgeDays(aDriver({driverDate: null}), now)).toBeNull();
	});

	it('returns null for an unparseable date', () => {
		expect(driverAgeDays(aDriver({driverDate: 'not a date'}), now)).toBeNull();
	});

	it('returns null for a sentinel date Windows ships', () => {
		expect(driverAgeDays(aDriver({driverDate: '1968-07-17T00:00:00.000Z'}), now)).toBeNull();
	});

	it('computes a real age in whole days', () => {
		expect(driverAgeDays(aDriver({driverDate: '2026-09-04T00:00:00.000Z'}), now)).toBe(10);
	});

	it('defaults to the current time', () => {
		expect(driverAgeDays(aDriver({driverDate: new Date().toISOString()}))).toBe(0);
	});
});

describe('isInboxDriver', () => {
	it('recognises the shapes Windows uses for its own drivers', () => {
		expect(isInboxDriver(aDriver({driverProvider: 'Microsoft'}))).toBe(true);
		expect(isInboxDriver(aDriver({driverProvider: null, manufacturer: 'Microsoft'}))).toBe(true);
		expect(isInboxDriver(aDriver({driverProvider: null, manufacturer: '(Standard system devices)'}))).toBe(
			true,
		);
		expect(isInboxDriver(aDriver({driverProvider: null, manufacturer: '(Generic USB Hub)'}))).toBe(true);
	});

	it('leaves vendor drivers alone', () => {
		expect(isInboxDriver(aDriver({driverProvider: 'NVIDIA', manufacturer: 'NVIDIA'}))).toBe(false);
		expect(isInboxDriver(aDriver({driverProvider: null, manufacturer: null}))).toBe(false);
	});
});

describe('wsl helpers', () => {
	it('detects a WSL 2 distribution', () => {
		expect(hasWsl2Distribution(aWslStatus())).toBe(true);
		expect(
			hasWsl2Distribution(
				aWslStatus({distributions: [{name: 'Legacy', version: 1, state: 'Stopped', isDefault: true}]}),
			),
		).toBe(false);
	});

	it('models the default memory share WSL 2 would claim', () => {
		expect(defaultWslMemoryBytes(bytes(64 * GIB))).toBe(32 * GIB);
		expect(defaultWslMemoryBytes(bytes(0))).toBe(0);
	});
});
