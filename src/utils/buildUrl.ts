import type { QueryParams } from "../types/common";

/**
 * Appends a query string to a URL. Skips nullish values and repeats keys for
 * array values so APIs like TMDB can accept `with_genres=1&with_genres=2`.
 */
export function buildUrl(base: string, query?: QueryParams): string {
	if (!query || Object.keys(query).length === 0) return base;

	const params = new URLSearchParams();
	for (const [key, value] of Object.entries(query)) {
		if (value === undefined || value === null) continue;

		if (Array.isArray(value)) {
			for (const item of value) {
				if (item !== undefined && item !== null) {
					params.append(key, String(item));
				}
			}
		} else {
			params.append(key, String(value));
		}
	}

	const qs = params.toString();
	if (!qs) return base;

	const separator = base.includes("?")
		? base.endsWith("?") || base.endsWith("&")
			? ""
			: "&"
		: "?";
	return `${base}${separator}${qs}`;
}
