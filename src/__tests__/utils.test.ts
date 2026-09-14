import { describe, expect, it } from "bun:test";
import { buildUrl } from "../utils/buildUrl";
import { isPlainObject } from "../utils/isPlainObject";
import { mergeHeaders } from "../utils/mergeHeaders";
import { parseRetryAfterMs } from "../utils/parseRetryAfterMs";
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

	it("inserts query params before a URL fragment", () => {
		const url = buildUrl("https://api.test/v1#section", { page: 2 });
		expect(url).toBe("https://api.test/v1?page=2#section");
	});

	it("inserts query params before a fragment on URLs with a query string", () => {
		const url = buildUrl("https://api.test/v1?existing=1#section", { page: 2 });
		expect(url).toBe("https://api.test/v1?existing=1&page=2#section");
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

	it("accepts Headers instances and tuple arrays", () => {
		const headers = new Headers({
			"X-From-Headers": "yes",
			"X-Custom": "old",
		});
		const result = mergeHeaders(headers, [
			["X-Custom", "new"],
			["Accept", "application/json"],
		]);

		expect(result["x-from-headers"]).toBe("yes");
		expect(result["x-custom"]).toBe("new");
		expect(result.accept).toBe("application/json");
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

describe("parseRetryAfterMs", () => {
	it("parses delay-seconds values", () => {
		expect(parseRetryAfterMs("2")).toBe(2_000);
		expect(parseRetryAfterMs("0")).toBe(0);
	});

	it("parses HTTP-date values relative to now", () => {
		const now = Date.UTC(2024, 0, 1, 0, 0, 0);
		expect(parseRetryAfterMs("Mon, 01 Jan 2024 00:00:05 GMT", now)).toBe(5_000);
	});

	it("clamps past HTTP-dates to zero", () => {
		const now = Date.UTC(2024, 0, 1, 0, 0, 0);
		expect(
			parseRetryAfterMs("Mon, 01 Jan 2024 00:00:00 GMT", now + 10_000),
		).toBe(0);
	});

	it("returns undefined for missing or malformed values", () => {
		expect(parseRetryAfterMs(undefined)).toBeUndefined();
		expect(parseRetryAfterMs(null)).toBeUndefined();
		expect(parseRetryAfterMs("")).toBeUndefined();
		expect(parseRetryAfterMs("not-a-date")).toBeUndefined();
	});
});

describe("sleep", () => {
	it("resolves after the given ms", async () => {
		const start = Date.now();
		await sleep(50);
		expect(Date.now() - start).toBeGreaterThanOrEqual(40);
	});
});
