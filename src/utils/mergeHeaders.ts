/**
 * Merges header objects left to right. Keys are normalized to
 * lowercase so merging is case-insensitive. Later sources win.
 */
export function mergeHeaders(
	...sources: (Record<string, string> | undefined)[]
): Record<string, string> {
	const result: Record<string, string> = {};
	for (const source of sources) {
		if (!source) continue;
		for (const [key, value] of Object.entries(source)) {
			result[key.toLowerCase()] = value;
		}
	}
	return result;
}
