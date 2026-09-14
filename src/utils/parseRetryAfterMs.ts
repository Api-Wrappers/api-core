/**
 * Parses an HTTP `Retry-After` header value into a non-negative delay in
 * milliseconds. Supports both the delay-seconds and HTTP-date forms defined
 * by RFC 9110; returns `undefined` for missing or malformed values.
 */
export function parseRetryAfterMs(
	value: string | null | undefined,
	now: number = Date.now(),
): number | undefined {
	if (!value) return undefined;

	const seconds = Number(value);
	if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);

	const date = Date.parse(value);
	if (Number.isNaN(date)) return undefined;

	return Math.max(0, date - now);
}
