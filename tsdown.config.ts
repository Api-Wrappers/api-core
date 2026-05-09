import { defineConfig } from "tsdown";

export default defineConfig({
	// Single public entry — everything flows through src/index.ts
	entry: ["src/index.ts"],

	// Ship both ESM (for bundlers / modern Node / Bun) and CJS (for older
	// Node consumers that still require() packages).
	format: ["esm", "cjs"],

	// Generate .d.ts + .d.cts declaration files so TypeScript consumers
	// get types for whichever module format they load.
	dts: true,

	// Wipe dist/ before each build so stale artefacts never ship.
	clean: true,

	// Inline sourcemaps for debuggability; consumers can strip them later.
	sourcemap: true,

	// Drop dead code on the ESM output — keeps the bundle small for
	// wrappers that only use a subset of plugins.
	treeshake: true,

	// Targets modern runtimes that have native fetch, Request, Response,
	// and structuredClone. Adjust down if older Node support is needed.
	target: "es2020",
});
