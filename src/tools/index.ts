import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { JobGPTApiClient } from '../api-client.js';
import { registerJobTools } from './jobs.js';
import { registerProfileTools } from './profile.js';
import { registerJobHuntTools } from './job-hunts.js';
import { registerApplicationTools } from './applications.js';
import { registerResumeTools } from './resume.js';
import { registerOutreachTools } from './outreach.js';

export function registerAllTools(server: McpServer, client: JobGPTApiClient, mode: 'stdio' | 'worker' = 'stdio') {
  registerJobTools(server, client);
  registerProfileTools(server, client);
  registerJobHuntTools(server, client);
  registerApplicationTools(server, client);
  registerResumeTools(server, client, mode);
  registerOutreachTools(server, client);
}
