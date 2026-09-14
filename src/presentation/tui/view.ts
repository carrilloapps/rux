/** The four things rux can show, and how they are labelled. */
export const VIEWS = ['startup', 'residue', 'junk', 'hardware'] as const;

export type View = (typeof VIEWS)[number];

/**
 * View ids are internal and stable; the label keys read naturally in each
 * language. They are not the same word, so the mapping is explicit rather than
 * derived from the id.
 */
export const VIEW_LABEL_KEY: Readonly<Record<View, string>> = Object.freeze({
	startup: 'views.startup',
	residue: 'views.leftovers',
	junk: 'views.junk',
	hardware: 'views.hardware',
});

export function nextView(current: View, direction: 1 | -1): View {
	const index = VIEWS.indexOf(current);
	return VIEWS[(index + direction + VIEWS.length) % VIEWS.length] as View;
}

/** Views whose rows are selected and acted on in bulk. */
export function isSelectableView(view: View): view is 'residue' | 'junk' {
	return view === 'residue' || view === 'junk';
}
