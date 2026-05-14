import type { HeaderInput } from "../types/common";

/**
 * Merges header objects left to right. Keys are normalized to
 * lowercase so merging is case-insensitive. Later sources win.
 */
export function mergeHeaders(
	...sources: (HeaderInput | undefined)[]
): Record<string, string> {
	const result: Record<string, string> = {};
	for (const source of sources) {
		if (!source) continue;

		if (isHeaders(source)) {
			source.forEach((value, key) => {
				result[key.toLowerCase()] = value;
			});
			continue;
		}

		if (Array.isArray(source)) {
			for (const [key, value] of source) {
				result[key.toLowerCase()] = value;
			}
			continue;
		}

		for (const [key, value] of Object.entries(source)) {
			result[key.toLowerCase()] = String(value);
		}
	}
	return result;
}

function isHeaders(source: HeaderInput): source is Headers {
	return typeof Headers !== "undefined" && source instanceof Headers;
}
