export interface TimeoutPluginOptions {
	/**
	 * Request timeout in milliseconds. Overrides `ClientConfig.timeoutMs` and
	 * any per-request `timeoutMs` set before this plugin runs.
	 * The abort and {@link TimeoutError} are handled by the transport.
	 */
	timeoutMs: number;
}
