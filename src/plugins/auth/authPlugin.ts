import type { ApiPlugin } from "../../plugin/types";
import type { MaybePromise } from "../../types/common";
import type { AuthPluginOptions } from "./types";

type TokenInput =
	| string
	| (() => MaybePromise<string | null | undefined>)
	| AuthPluginOptions;

/**
 * Adds an auth token header before each request. The token can be static or
 * loaded asynchronously per request, which covers wrappers with refreshable
 * access tokens.
 */
export function createAuthPlugin(input: TokenInput): ApiPlugin {
	const options = normalizeOptions(input);
	const headerName = (options.headerName ?? "authorization").toLowerCase();
	const scheme = options.scheme === undefined ? "Bearer" : options.scheme;

	return {
		name: "auth",
		priority: 2,

		async beforeRequest(ctx) {
			const token = await options.getToken();
			if (!token) return ctx;

			return {
				...ctx,
				headers: {
					...ctx.headers,
					[headerName]: scheme ? `${scheme} ${token}` : token,
				},
			};
		},
	};
}

function normalizeOptions(input: TokenInput): AuthPluginOptions {
	if (typeof input === "string") {
		return { getToken: () => input };
	}
	if (typeof input === "function") {
		return { getToken: input };
	}
	return input;
}
