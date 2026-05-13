import { NextRequest, NextResponse } from "next/server";
import { ALL_TOOLS, runTool } from "@/lib/bot/tools";
import { env } from "@/lib/bot/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Stateless MCP server over HTTP (JSON-RPC 2.0).
 *
 * Supported methods:
 *   - initialize
 *   - tools/list
 *   - tools/call
 *
 * Auth: `Authorization: Bearer <MCP_BEARER_TOKEN>` on every request.
 *
 * Connect from Claude (Mac app) by adding a custom MCP server entry pointing
 * to `https://<your-domain>/api/mcp` with the bearer token header.
 */
export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return rpcError(null, -32001, "Unauthorized", 401);
  }

  let body: JsonRpcRequest;
  try {
    body = (await req.json()) as JsonRpcRequest;
  } catch {
    return rpcError(null, -32700, "Parse error", 400);
  }

  const { id = null, method, params } = body;

  try {
    switch (method) {
      case "initialize":
        return rpcOk(id, {
          protocolVersion: "2024-11-05",
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: "rehabstudio-mcp", version: "0.1.0" },
        });

      case "tools/list":
        return rpcOk(id, {
          tools: ALL_TOOLS.map((t) => ({
            name: t.name,
            description: t.description,
            inputSchema: t.schema,
          })),
        });

      case "tools/call": {
        const { name, arguments: args = {} } = (params ?? {}) as {
          name: string;
          arguments?: unknown;
        };
        // MCP comes from the owner, so always run with owner privileges.
        const result = await runTool(name, args, { callerPhone: null, isOwner: true });
        return rpcOk(id, {
          content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        });
      }

      case "notifications/initialized":
        // Notifications carry no id and expect no response.
        return new NextResponse(null, { status: 204 });

      case "ping":
        return rpcOk(id, {});

      default:
        return rpcError(id, -32601, `Method not found: ${method}`);
    }
  } catch (err) {
    return rpcError(id, -32000, (err as Error).message);
  }
}

export async function GET() {
  return new NextResponse(
    JSON.stringify({
      name: "rehabstudio-mcp",
      version: "0.1.0",
      transport: "http+json-rpc",
      tools: ALL_TOOLS.map((t) => t.name),
    }),
    { headers: { "Content-Type": "application/json" } },
  );
}

interface JsonRpcRequest {
  jsonrpc?: "2.0";
  id?: number | string | null;
  method: string;
  params?: unknown;
}

function rpcOk(id: number | string | null, result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: number | string | null, code: number, message: string, http = 200) {
  return NextResponse.json(
    { jsonrpc: "2.0", id, error: { code, message } },
    { status: http },
  );
}

function authorized(req: NextRequest): boolean {
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${env.mcpToken()}`;
}
