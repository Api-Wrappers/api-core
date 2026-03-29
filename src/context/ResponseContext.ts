import type { RequestContext } from "./RequestContext";

/**
 * Represents the result of an HTTP request as it flows through the
 * `afterResponse` plugin chain.
 *
 * Plugins may return a mutated copy to transform `parsedBody` or attach
 * state to `meta`. The final `parsedBody` value is what `client.request`
 * returns to the caller.
 */
export interface ResponseContext {
	/** The request context that produced this response. */
	request: RequestContext;
	/** The raw `Response` object returned by the transport. */
	response: Response;
	/**
	 * Body parsed from the response. JSON responses are parsed with
	 * `response.json()`; everything else is returned as a string via
	 * `response.text()`. Plugins may replace this with a transformed value.
	 */
	parsedBody?: unknown;
	/**
	 * Arbitrary key/value store for plugins to attach response-scoped state
	 * without polluting `parsedBody`. Keys should be namespaced by plugin
	 * name (e.g. `"cache.served"`, `"logger.durationMs"`).
	 */
	meta: Record<string, unknown>;
}
