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
	const source = chunks.reduce(
		(source, chunk, index) =>
			`${source}${chunk}${index in values ? String(values[index]) : ""}`,
		"",
	);

	return dedupeGraphQLFragmentDefinitions(source);
}

/**
 * Removes repeated, equivalent fragment definitions from a GraphQL document.
 * Conflicting definitions with the same fragment name throw instead of silently
 * changing the meaning of the operation.
 */
export function dedupeGraphQLFragmentDefinitions(source: string): string {
	const seen = new Map<string, string>();
	const fragmentPattern =
		/\bfragment\s+([_A-Za-z][_0-9A-Za-z]*)\s+on\s+[_A-Za-z][_0-9A-Za-z]*/g;

	let result = "";
	let cursor = 0;
	let match = fragmentPattern.exec(source);

	while (match) {
		const name = match[1];
		if (!name) {
			match = fragmentPattern.exec(source);
			continue;
		}

		const bodyStart = source.indexOf("{", fragmentPattern.lastIndex);
		if (bodyStart === -1) {
			match = fragmentPattern.exec(source);
			continue;
		}

		const bodyEnd = findMatchingBrace(source, bodyStart);
		if (bodyEnd === -1) {
			match = fragmentPattern.exec(source);
			continue;
		}

		const fragmentStart = match.index;
		const fragmentBodyEnd = bodyEnd + 1;
		const fragmentEnd = consumeTrailingWhitespace(source, fragmentBodyEnd);
		const normalizedDefinition = normalizeDefinition(
			source.slice(fragmentStart, fragmentBodyEnd),
		);
		const previousDefinition = seen.get(name);

		if (previousDefinition === undefined) {
			seen.set(name, normalizedDefinition);
			result += source.slice(cursor, fragmentEnd);
		} else if (previousDefinition === normalizedDefinition) {
			result += source.slice(cursor, fragmentStart);
		} else {
			throw new Error(`Conflicting GraphQL fragment definition: ${name}`);
		}

		cursor = fragmentEnd;
		fragmentPattern.lastIndex = fragmentEnd;
		match = fragmentPattern.exec(source);
	}

	return result + source.slice(cursor);
}

function normalizeDefinition(source: string): string {
	return source.replace(/\s+/g, " ").trim();
}

function findMatchingBrace(source: string, openBraceIndex: number): number {
	let depth = 0;

	for (let index = openBraceIndex; index < source.length; index++) {
		const char = source[index];
		if (char === "{") depth++;
		if (char === "}") depth--;
		if (depth === 0) return index;
	}

	return -1;
}

function consumeTrailingWhitespace(source: string, index: number): number {
	let next = index;
	while (next < source.length && /\s/.test(source[next] ?? "")) {
		next++;
	}
	return next;
}
