/**
 * The single source of truth for the running version.
 *
 * `__RUX_VERSION__` is replaced at build time by tsup with the value from
 * package.json, which CI in turn derives from the published release tag. That
 * chain means the tag, the npm package, the installer and `rux --version` can
 * never disagree, and no version string is ever typed into source.
 *
 * The fallback only applies when running straight from source, where no build
 * step has taken place.
 */
declare const __RUX_VERSION__: string | undefined;

export const VERSION: string =
	typeof __RUX_VERSION__ === 'string' && __RUX_VERSION__.length > 0 ? __RUX_VERSION__ : '0.0.0-dev';
