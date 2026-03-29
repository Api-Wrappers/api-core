/**
 * Appends a query string to a URL. Skips undefined values.
 */
export function buildUrl(
	base: string,
	query?: Record<string, string | number | boolean | undefined>,
): string {
	if (!query || Object.keys(query).length === 0) return base;

	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value !== undefined) {
			params.set(key, String(value));
		}
	}

	const qs = params.toString();
	return qs ? `${base}?${qs}` : base;
}
