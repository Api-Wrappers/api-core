import type { RequestContext } from "../context/RequestContext";

export type FetchLike = (
	input: string | URL | Request,
	init?: RequestInit,
) => Promise<Response>;

export interface Transport {
	execute(ctx: RequestContext): Promise<Response>;
}
