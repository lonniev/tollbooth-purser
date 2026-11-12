// Cloudflare Pages Function: /mcp → the Purser operator on Horizon.
import { makeMcpProxy } from "@tollbooth-dpyc/web/pages-proxy";

export const onRequest = makeMcpProxy("https://tollbooth-purser.fastmcp.app/mcp");
