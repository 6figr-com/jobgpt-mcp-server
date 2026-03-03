import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { JobGPTApiClient } from './api-client.js';
import { registerAllTools } from './tools/index.js';

interface Env {
  BACKEND_URL: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version',
        },
      });
    }

    // Only handle /mcp path
    if (url.pathname !== '/mcp') {
      return new Response(JSON.stringify({
        name: 'jobgpt-mcp-server',
        version: '1.0.0',
        mcp: '/mcp',
      }), { headers: { 'Content-Type': 'application/json' } });
    }

    // Extract user's API key from Authorization header
    const authHeader = request.headers.get('Authorization');
    const apiKey = authHeader?.replace('Bearer ', '') || '';
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'Missing Authorization header. Pass your JobGPT API key as Bearer token.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create server + client per request (stateless mode)
    const server = new McpServer({ name: 'jobgpt-mcp-server', version: '1.0.0' });
    const client = new JobGPTApiClient({
      apiKey,
      apiUrl: env.BACKEND_URL || 'https://6figr.com',
      debug: false,
    });
    registerAllTools(server, client);

    // Stateless transport — no session ID
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);

    return transport.handleRequest(request);
  },
};
