import type {Impact, LocalizableText} from '@/domain/common';
import {IMPACT_ORDER} from '@/domain/common';

export const RECOMMENDATION_AREAS = ['graphics', 'display', 'driver', 'system', 'storage', 'wsl'] as const;
export type RecommendationArea = (typeof RECOMMENDATION_AREAS)[number];

/**
 * How the user carries out a recommendation.
 *
 * rux deliberately does not apply graphics or driver changes itself: those are
 * vendor- and model-specific, and a wrong automated write is far more damaging
 * than a leftover registry key. Instead every recommendation names the exact
 * place to make the change, and `command` carries a copyable one-liner when one
 * exists.
 */
export interface RecommendationAction {
	/** Where the user performs it, e.g. "Settings > System > Display". */
	readonly location: LocalizableText;
	/** A shell command that performs or opens the change, when one applies. */
	readonly command: string | null;
}

export interface Recommendation {
	readonly id: string;
	readonly area: RecommendationArea;
	readonly impact: Impact;
	readonly title: LocalizableText;
	/** What rux observed on this machine. */
	readonly finding: LocalizableText;
	/** What to do about it and why it helps. */
	readonly advice: LocalizableText;
	readonly action: RecommendationAction | null;
	/** Raw values behind the finding, shown verbatim for verification. */
	readonly evidence: readonly string[];
}

export function sortRecommendations(items: readonly Recommendation[]): readonly Recommendation[] {
	return [...items].sort(
		(a, b) => IMPACT_ORDER[a.impact] - IMPACT_ORDER[b.impact] || a.id.localeCompare(b.id),
	);
}

export function countByImpact(items: readonly Recommendation[]): Readonly<Record<Impact, number>> {
	const counts: Record<Impact, number> = {critical: 0, high: 0, medium: 0, low: 0, info: 0};
	for (const item of items) counts[item.impact] += 1;
	return counts;
}
