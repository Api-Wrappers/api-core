export function normalizeRetryMaxAttempts(value: number | undefined): number {
	if (value === undefined || !Number.isFinite(value)) return 1;
	return Math.max(1, Math.floor(value));
}
