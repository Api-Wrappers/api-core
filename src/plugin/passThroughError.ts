const PASS_THROUGH_ERROR = Symbol("apiCore.passThroughError");

export interface PassThroughError {
	readonly [PASS_THROUGH_ERROR]: true;
	readonly cause: unknown;
}

export function createPassThroughError(cause: unknown): PassThroughError {
	return { [PASS_THROUGH_ERROR]: true, cause };
}

export function getPassThroughCause(error: unknown): unknown | undefined {
	if (!isPassThroughError(error)) return undefined;
	return error.cause;
}

function isPassThroughError(error: unknown): error is PassThroughError {
	return (
		typeof error === "object" &&
		error !== null &&
		(error as Partial<PassThroughError>)[PASS_THROUGH_ERROR] === true
	);
}
