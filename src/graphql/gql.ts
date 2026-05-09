/**
 * Lightweight GraphQL template tag.
 *
 * This intentionally does not parse into a DocumentNode. It preserves the
 * query string while still giving GraphQL-aware tooling a familiar `gql` tag.
 */
export function gql(
	chunks: TemplateStringsArray,
	...values: unknown[]
): string {
	return chunks.reduce(
		(source, chunk, index) =>
			`${source}${chunk}${index in values ? String(values[index]) : ""}`,
		"",
	);
}
