import {describe, expect, it} from 'vitest';
import type {Recommendation} from '@/domain/recommendation';
import {analyzeGraphics} from '@/domain/services/graphics-advisor';
import {aDisplay, aGraphicsController, aGraphicsProfile, graphicsSettings} from '@tests/helpers/builders';

const NOW = new Date('2026-09-14T00:00:00.000Z');

const ids = (items: readonly Recommendation[]): string[] => items.map(item => item.id);
const find = (items: readonly Recommendation[], prefix: string): Recommendation | undefined =>
	items.find(item => item.id.startsWith(prefix));

describe('analyzeGraphics', () => {
	it('says nothing about a correctly configured machine', () => {
		expect(analyzeGraphics(aGraphicsProfile(), NOW)).toHaveLength(0);
	});

	it('defaults the clock to now', () => {
		expect(analyzeGraphics(aGraphicsProfile({controllers: [], displays: []}))).toHaveLength(1);
	});

	describe('adapters', () => {
		it('reports when no adapter is visible at all', () => {
			const result = analyzeGraphics(aGraphicsProfile({controllers: [], displays: []}), NOW);
			expect(ids(result)).toEqual(['graphics.no-controller']);
			expect(result[0]?.impact).toBe('info');
		});

		it('flags a hybrid machine with no per-application preference', () => {
			const result = analyzeGraphics(
				aGraphicsProfile({
					controllers: [aGraphicsController(), aGraphicsController({id: 'gpu-1', integrated: true})],
					settings: graphicsSettings({gpuPreferenceCount: 0}),
				}),
				NOW,
			);
			expect(ids(result)).toContain('graphics.hybrid-no-preference');
		});

		it('leaves a hybrid machine alone once preferences exist', () => {
			const result = analyzeGraphics(
				aGraphicsProfile({
					controllers: [aGraphicsController(), aGraphicsController({id: 'gpu-1', integrated: true})],
				}),
				NOW,
			);
			expect(ids(result)).not.toContain('graphics.hybrid-no-preference');
		});

		it('flags a stale graphics driver with its age', () => {
			const result = analyzeGraphics(
				aGraphicsProfile({
					controllers: [aGraphicsController({driverDate: '2024-01-01T00:00:00.000Z'})],
				}),
				NOW,
			);
			const finding = find(result, 'graphics.stale-driver');
			expect(finding?.impact).toBe('high');
			expect(finding?.evidence.join(' ')).toContain('616.56');
		});

		it('ignores an adapter with no driver date', () => {
			const result = analyzeGraphics(
				aGraphicsProfile({controllers: [aGraphicsController({driverDate: null, driverVersion: null})]}),
				NOW,
			);
			expect(find(result, 'graphics.stale-driver')).toBeUndefined();
		});

		it('ignores an unparseable driver date', () => {
			const result = analyzeGraphics(
				aGraphicsProfile({controllers: [aGraphicsController({driverDate: 'whenever'})]}),
				NOW,
			);
			expect(find(result, 'graphics.stale-driver')).toBeUndefined();
		});
	});

	describe('windows settings', () => {
		it('flags GPU scheduling only when a discrete adapter is present', () => {
			const withDiscrete = analyzeGraphics(
				aGraphicsProfile({settings: graphicsSettings({hardwareAcceleratedScheduling: false})}),
				NOW,
			);
			expect(ids(withDiscrete)).toContain('graphics.hags-disabled');

			const integratedOnly = analyzeGraphics(
				aGraphicsProfile({
					controllers: [aGraphicsController({integrated: true})],
					settings: graphicsSettings({hardwareAcceleratedScheduling: false}),
				}),
				NOW,
			);
			expect(ids(integratedOnly)).not.toContain('graphics.hags-disabled');
		});

		it('leaves GPU scheduling alone when the state is unknown', () => {
			const result = analyzeGraphics(
				aGraphicsProfile({settings: graphicsSettings({hardwareAcceleratedScheduling: null})}),
				NOW,
			);
			expect(ids(result)).not.toContain('graphics.hags-disabled');
		});

		it('flags background game recording', () => {
			const result = analyzeGraphics(aGraphicsProfile({settings: graphicsSettings({gameDvr: true})}), NOW);
			expect(ids(result)).toContain('graphics.game-dvr-enabled');
		});

		it('flags Game Mode only when it is explicitly off', () => {
			expect(
				ids(analyzeGraphics(aGraphicsProfile({settings: graphicsSettings({gameMode: false})}), NOW)),
			).toContain('graphics.game-mode-disabled');
			expect(
				ids(analyzeGraphics(aGraphicsProfile({settings: graphicsSettings({gameMode: null})}), NOW)),
			).not.toContain('graphics.game-mode-disabled');
		});
	});

	describe('displays', () => {
		it('flags a refresh rate below the panel maximum', () => {
			const result = analyzeGraphics(
				aGraphicsProfile({displays: [aDisplay({currentRefreshHz: 60, maximumRefreshHz: 144})]}),
				NOW,
			);
			expect(find(result, 'display.refresh-below-maximum')?.impact).toBe('high');
		});

		it('tolerates a rate within the rounding margin', () => {
			const result = analyzeGraphics(
				aGraphicsProfile({displays: [aDisplay({currentRefreshHz: 143, maximumRefreshHz: 144})]}),
				NOW,
			);
			expect(find(result, 'display.refresh-below-maximum')).toBeUndefined();
		});

		it('says nothing when the maximum is unknown', () => {
			const result = analyzeGraphics(
				aGraphicsProfile({displays: [aDisplay({currentRefreshHz: 60, maximumRefreshHz: null})]}),
				NOW,
			);
			expect(find(result, 'display.refresh-below-maximum')).toBeUndefined();
		});

		it.each([
			[1536, 864, 1.25],
			[1280, 720, 1.5],
			[960, 540, 2],
		])('treats %ix%i as %fx DPI scaling, not a wrong mode', (width, height) => {
			const result = analyzeGraphics(
				aGraphicsProfile({displays: [aDisplay({currentWidth: width, currentHeight: height})]}),
				NOW,
			);
			expect(find(result, 'display.non-native-resolution')).toBeUndefined();
		});

		it('flags a genuinely different aspect ratio', () => {
			// 1920/1280 is 1.5 but 1080/1024 is not, so this is not scaling.
			const result = analyzeGraphics(
				aGraphicsProfile({displays: [aDisplay({currentWidth: 1280, currentHeight: 1024})]}),
				NOW,
			);
			expect(find(result, 'display.non-native-resolution')?.impact).toBe('medium');
		});

		it('flags a non-scaling downgrade on the same aspect ratio', () => {
			const result = analyzeGraphics(
				aGraphicsProfile({displays: [aDisplay({currentWidth: 1600, currentHeight: 900})]}),
				NOW,
			);
			expect(find(result, 'display.non-native-resolution')).toBeDefined();
		});

		it('cannot judge a display whose native size is unknown', () => {
			const result = analyzeGraphics(
				aGraphicsProfile({
					displays: [
						aDisplay({currentWidth: 1280, currentHeight: 1024, nativeWidth: null, nativeHeight: null}),
					],
				}),
				NOW,
			);
			expect(find(result, 'display.non-native-resolution')).toBeUndefined();
		});

		it.each([
			['width', {currentWidth: 0}],
			['height', {currentHeight: 0}],
		])('cannot judge a display reporting a zero %s', (_axis, overrides) => {
			// A driver that has not finished initialising reports zero rather than
			// null, which would divide into Infinity and read as a wrong mode.
			const result = analyzeGraphics(
				aGraphicsProfile({displays: [aDisplay({...overrides, nativeWidth: 1920, nativeHeight: 1080})]}),
				NOW,
			);
			expect(find(result, 'display.non-native-resolution')).toBeUndefined();
		});

		it('cannot judge a display whose native height alone is unknown', () => {
			// Both axes are needed to tell DPI scaling from a wrong mode, so a
			// half-known native size has to be treated the same as an unknown one.
			const result = analyzeGraphics(
				aGraphicsProfile({
					displays: [aDisplay({currentWidth: 1280, currentHeight: 1024, nativeHeight: null})],
				}),
				NOW,
			);
			expect(find(result, 'display.non-native-resolution')).toBeUndefined();
		});

		it('flags reduced colour depth', () => {
			const result = analyzeGraphics(aGraphicsProfile({displays: [aDisplay({pixelDepth: 16})]}), NOW);
			expect(find(result, 'display.low-color-depth')?.impact).toBe('medium');
		});

		it('ignores an unknown colour depth', () => {
			const result = analyzeGraphics(aGraphicsProfile({displays: [aDisplay({pixelDepth: null})]}), NOW);
			expect(find(result, 'display.low-color-depth')).toBeUndefined();
		});

		it('names a display with no vendor or model by its position', () => {
			const result = analyzeGraphics(
				aGraphicsProfile({
					displays: [aDisplay({vendor: null, model: null, currentRefreshHz: 60, maximumRefreshHz: 144})],
				}),
				NOW,
			);
			expect(find(result, 'display.refresh-below-maximum')?.finding.values?.display).toBe('Display 1');
		});
	});

	it('orders findings by impact', () => {
		const result = analyzeGraphics(
			aGraphicsProfile({
				displays: [aDisplay({currentRefreshHz: 60, maximumRefreshHz: 144})],
				settings: graphicsSettings({gameDvr: true, gameMode: false}),
			}),
			NOW,
		);
		expect(result[0]?.impact).toBe('high');
		expect(result.at(-1)?.impact).toBe('low');
	});
});
