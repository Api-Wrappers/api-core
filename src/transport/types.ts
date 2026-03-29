import type { RequestContext } from "../context/RequestContext";

export interface Transport {
	execute(ctx: RequestContext): Promise<Response>;
}
