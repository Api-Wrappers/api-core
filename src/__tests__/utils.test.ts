import { describe, expect, it } from "bun:test";
import { buildUrl } from "../utils/buildUrl";
import { isPlainObject } from "../utils/isPlainObject";
import { mergeHeaders } from "../utils/mergeHeaders";
import { resolveUrl } from "../utils/resolveUrl";
import { sleep } from "../utils/sleep";

describe("buildUrl", () => {
	it("returns base when no query", () => {
		expect(buildUrl("https://api.test/v1")).toBe("https://api.test/v1");
	});

	it("appends query params", () => {
		const url = buildUrl("https://api.test/v1", { page: 1, q: "hi" });
		expect(url).toContain("page=1");
		expect(url).toContain("q=hi");
	});

	it("skips undefined query values", () => {
		const url = buildUrl("https://api.test/v1", {
			a: "x",
			b: undefined,
		});
		expect(url).not.toContain("b=");
		expect(url).toContain("a=x");
	});

	it("skips null query values and repeats array query values", () => {
		const url = buildUrl("https://api.test/v1", {
			a: ["x", null, "y"],
			b: null,
		});
		expect(url).toBe("https://api.test/v1?a=x&a=y");
	});

	it("appends query params to URLs that already have a query string", () => {
		const url = buildUrl("https://api.test/v1?existing=1", { page: 2 });
		expect(url).toBe("https://api.test/v1?existing=1&page=2");
	});
});

describe("resolveUrl", () => {
	it("joins base URLs and paths without duplicate slashes", () => {
		expect(resolveUrl("https://api.test/v1/", "/users")).toBe(
			"https://api.test/v1/users",
		);
		expect(resolveUrl("https://api.test/v1", "users")).toBe(
			"https://api.test/v1/users",
		);
	});

	it("returns absolute request URLs unchanged", () => {
		expect(resolveUrl("https://api.test", "https://other.test/users")).toBe(
			"https://other.test/users",
		);
	});
});

describe("mergeHeaders", () => {
	it("merges multiple sources", () => {
		const result = mergeHeaders(
			{ "Content-Type": "application/json" },
			{ Authorization: "Bearer token" },
		);
		expect(result["content-type"]).toBe("application/json");
		expect(result.authorization).toBe("Bearer token");
	});

	it("later source wins on collision", () => {
		const result = mergeHeaders({ "x-custom": "old" }, { "X-Custom": "new" });
		expect(result["x-custom"]).toBe("new");
	});

	it("handles undefined sources", () => {
		const result = mergeHeaders({ a: "1" }, undefined, { b: "2" });
		expect(result).toEqual({ a: "1", b: "2" });
	});
});

describe("isPlainObject", () => {
	it("returns true for plain objects", () => {
		expect(isPlainObject({})).toBe(true);
		expect(isPlainObject({ a: 1 })).toBe(true);
	});

	it("returns false for non-objects", () => {
		expect(isPlainObject(null)).toBe(false);
		expect(isPlainObject("string")).toBe(false);
		expect(isPlainObject([])).toBe(false);
		expect(isPlainObject(new Date())).toBe(false);
	});
});

describe("sleep", () => {
	it("resolves after the given ms", async () => {
		const start = Date.now();
		await sleep(50);
		expect(Date.now() - start).toBeGreaterThanOrEqual(40);
	});
});
