/**
 * Stand-in for react-devtools-core.
 *
 * Ink imports that package from its development tooling module. The import is
 * static, so leaving it unresolved makes the bundle fail to load even though the
 * code path is never taken: Ink only reaches it when the DEV environment
 * variable is set, which a shipped build never does.
 *
 * Aliasing it here keeps the distribution self-contained without pulling a
 * browser devtools bridge into it. The function throws rather than returning
 * silently, so an unexpected caller is loud instead of mysterious.
 */
export function connectToDevTools() {
	throw new Error('React DevTools are not available in a released rux build.');
}

export default {connectToDevTools};
