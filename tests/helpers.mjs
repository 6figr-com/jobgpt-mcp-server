import { jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { registerAllTools } from '../dist/tools/index.js';

// Every JobGPTApiClient method the tools call, as jest mocks. Tests set return values per case.
const CLIENT_METHODS = [
  'searchJobs', 'getJob', 'matchJobs', 'getProfile', 'updateProfile', 'getCredits', 'listJobHunts', 'createJobHunt',
  'getJobHunt', 'updateJobHunt', 'listApplications', 'getApplicationStats', 'getApplication', 'updateApplication',
  'autoApply', 'listInterviews', 'addJobToApplications', 'importJobByUrl', 'listResumes', 'getResume', 'deleteResume',
  'uploadResumeFromUrl', 'uploadResumeFromBase64', 'listGeneratedResumes', 'getGeneratedResume', 'generateResumeForJob',
  'calculateMatchScore', 'getIndustries', 'getCurrencies', 'getProfileSalary', 'updateProfileSalary', 'getSalary',
  'getJobRecruiters', 'getJobReferrers', 'getApplicationRecruiters', 'getApplicationReferrers', 'listOutreaches',
  'createOutreach', 'listEmailTemplates', 'generateEmailFromTemplate',
];

export function mockClient() {
  const client = {};
  for (const name of CLIENT_METHODS) {
    client[name] = jest.fn(async () => {
      throw new Error(`unexpected call: ${name}`);
    });
  }
  return client;
}

// Connects an MCP client to a server built with the mocked API client
export async function connect(client) {
  const server = new McpServer({ name: 'test', version: '0.0.0' });
  registerAllTools(server, client, 'stdio');
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const mcp = new Client({ name: 'jest', version: '0.0.0' });
  await server.connect(serverTransport);
  await mcp.connect(clientTransport);
  return mcp;
}

export async function callTool(mcp, name, args) {
  const result = await mcp.callTool({ name, arguments: args });
  const text = result.content && result.content[0] ? result.content[0].text : '';
  let json = null;
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = null;
  }
  return { isError: !!result.isError, text, json };
}

export async function toolSchema(mcp, name) {
  const { tools } = await mcp.listTools();
  return tools.find(t => t.name === name);
}
