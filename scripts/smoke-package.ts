import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { $ } from "bun";

const tempDir = await mkdtemp(join(tmpdir(), "api-core-smoke-"));
const consumerDir = join(tempDir, "consumer");

try {
	const packOutput =
		await $`bun pm pack --destination ${tempDir} --quiet`.text();
	const tarballName = packOutput.trim().split(/\s+/).at(-1);
	if (!tarballName) {
		throw new Error("bun pm pack did not report a tarball name");
	}
	const tarballPath = isAbsolute(tarballName)
		? tarballName
		: join(tempDir, tarballName);
	await mkdir(consumerDir);
	await writeFile(
		join(consumerDir, "package.json"),
		JSON.stringify({ type: "module", dependencies: {} }, null, 2),
	);
	await $`bun install --no-progress ${tarballPath}`.cwd(consumerDir).quiet();

	await writeFile(
		join(consumerDir, "esm.mjs"),
		[
			'import { createClient, createLoggerPlugin } from "@api-wrappers/api-core";',
			'import { gql } from "@api-wrappers/api-core/graphql";',
			'const client = createClient({ baseUrl: "https://api.test", plugins: [createLoggerPlugin({ logRequest: false, logResponse: false, logError: false })] });',
			'if (!client || typeof client.get !== "function") throw new Error("missing ESM client");',
			'if (typeof gql !== "function") throw new Error("missing ESM GraphQL subpath");',
		].join("\n"),
	);
	await $`node esm.mjs`.cwd(consumerDir).quiet();

	await writeFile(
		join(consumerDir, "cjs.cjs"),
		[
			'const { createClient, createLoggerPlugin } = require("@api-wrappers/api-core");',
			'const { gql } = require("@api-wrappers/api-core/graphql");',
			'const client = createClient({ baseUrl: "https://api.test", plugins: [createLoggerPlugin({ logRequest: false, logResponse: false, logError: false })] });',
			'if (!client || typeof client.get !== "function") throw new Error("missing CJS client");',
			'if (typeof gql !== "function") throw new Error("missing CJS GraphQL subpath");',
		].join("\n"),
	);
	await $`node cjs.cjs`.cwd(consumerDir).quiet();
} finally {
	await rm(tempDir, { force: true, recursive: true });
}
