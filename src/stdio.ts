#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadConfig, log } from './config.js';
import { JobGPTApiClient } from './api-client.js';
import { registerAllTools } from './tools/index.js';

async function main(): Promise<void> {
  try {
    const config = loadConfig();
    log('Configuration loaded');

    const server = new McpServer({ name: 'jobgpt-mcp-server', version: '1.0.0' });
    const client = new JobGPTApiClient(config);
    registerAllTools(server, client);

    const transport = new StdioServerTransport();
    await server.connect(transport);
    log('JobGPT MCP Server running on stdio');
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`Failed to start JobGPT MCP Server: ${message}`);
    process.exit(1);
  }
}

main();
