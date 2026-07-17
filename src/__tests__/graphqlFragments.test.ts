import { describe, expect, it } from "bun:test";
import {
	dedupeGraphQLFragmentDefinitions,
	gql,
} from "../graphql/gql";

const USER_FRAGMENT = gql`
	fragment UserFields on User {
		id
		name
	}
`;

describe("GraphQL fragment deduplication", () => {
	it("removes equivalent definitions even when whitespace differs", () => {
		const document = dedupeGraphQLFragmentDefinitions(`
			${USER_FRAGMENT}
			fragment UserFields on User { id name }
			query Viewer { Viewer { ...UserFields } }
		`);

		expect(document.match(/fragment UserFields on User/g)).toHaveLength(1);
	});

	it("throws when duplicate names have different selections", () => {
		expect(() =>
			dedupeGraphQLFragmentDefinitions(`
				fragment UserFields on User { id }
				fragment UserFields on User { name }
			`),
		).toThrow("Conflicting GraphQL fragment definition: UserFields");
	});
});
