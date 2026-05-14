export type MaybePromise<T> = T | Promise<T>;

export type HeaderInput = HeadersInit;

export type HttpMethod =
	| "GET"
	| "POST"
	| "PUT"
	| "PATCH"
	| "DELETE"
	| "HEAD"
	| "OPTIONS";

export type QueryPrimitive = string | number | boolean;

export type QueryValue =
	| QueryPrimitive
	| null
	| undefined
	| readonly (QueryPrimitive | null | undefined)[];

export type QueryParams = Record<string, QueryValue>;
