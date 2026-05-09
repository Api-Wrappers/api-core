import type { MaybePromise } from "../../types/common";

export interface AuthPluginOptions {
	/**
	 * Returns the token to attach to each request. Called per request so
	 * wrappers can refresh credentials without rebuilding the client.
	 */
	getToken: () => MaybePromise<string | null | undefined>;
	/** Header name to set. Defaults to `authorization`. */
	headerName?: string;
	/**
	 * Token scheme prefix. Defaults to `Bearer`. Pass `null` to write the raw
	 * token value without a scheme.
	 */
	scheme?: string | null;
}
