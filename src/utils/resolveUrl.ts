/**
 * Joins a client base URL and request path without requiring callers to keep
 * slashes perfectly aligned. Absolute request URLs are returned unchanged.
 */
export function resolveUrl(baseUrl: string, path: string): string {
	if (/^[a-z][a-z\d+\-.]*:\/\//i.test(path)) return path;

	const base = baseUrl.replace(/\/+$/, "");
	const next = path.replace(/^\/+/, "");

	return next ? `${base}/${next}` : base;
}
