#!/usr/bin/env node
/**
 * Tiny stdio <-> HTTP MCP bridge.
 *
 * Claude Desktop only speaks stdio MCP. This script forwards stdio JSON-RPC
 * frames to the remote /api/mcp endpoint.
 *
 * Usage (Claude Desktop config):
 *
 *   "rehabstudio": {
 *     "command": "node",
 *     "args": ["/absolute/path/to/scripts/mcp-stdio-bridge.mjs"],
 *     "env": {
 *       "MCP_URL": "https://YOUR-DOMAIN/api/mcp",
 *       "MCP_BEARER_TOKEN": "..."
 *     }
 *   }
 */

import readline from "node:readline";

const URL = process.env.MCP_URL;
const TOKEN = process.env.MCP_BEARER_TOKEN;

if (!URL || !TOKEN) {
  console.error("MCP_URL and MCP_BEARER_TOKEN env vars are required");
  process.exit(1);
}

const rl = readline.createInterface({ input: process.stdin });

rl.on("line", async (line) => {
  if (!line.trim()) return;
  try {
    const res = await fetch(URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: line,
    });
    if (res.status === 204) return; // notification, no reply
    const text = await res.text();
    if (text) process.stdout.write(text + "\n");
  } catch (err) {
    process.stderr.write(`bridge error: ${err.message}\n`);
  }
});
