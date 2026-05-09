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

	return dedupeFragmentDefinitions(source);
}

function dedupeFragmentDefinitions(source: string): string {
	const seen = new Set<string>();
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
		const fragmentEnd = consumeTrailingWhitespace(source, bodyEnd + 1);

		if (!seen.has(name)) {
			seen.add(name);
			result += source.slice(cursor, fragmentEnd);
		} else {
			result += source.slice(cursor, fragmentStart);
		}

		cursor = fragmentEnd;
		fragmentPattern.lastIndex = fragmentEnd;
		match = fragmentPattern.exec(source);
	}

	return result + source.slice(cursor);
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
