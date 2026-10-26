import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { JobGPTApiClient } from './api-client.js';
import { registerAllTools } from './tools/index.js';
import glamaConnector from './well-known/glama.json';

export interface Env {
  BACKEND_URL: string;
  OAUTH_KV: KVNamespace;
  OAUTH_PROVIDER: any;
  MCP_OAUTH_SECRET: string;
  MCP_WORKER_TOKEN: string;
}

const SERVER_VERSION = '1.3.0';

export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, Mcp-Session-Id, MCP-Protocol-Version',
};

export function corsPreflight(): Response {
  return new Response(null, { headers: CORS_HEADERS });
}

// Static discovery documents used by MCP registries (Glama, Smithery, etc.).
// These replace the old live anonymous-discovery path, which had to be removed:
// an unauthenticated `initialize` now returns 401 so Claude Desktop's native
// connector can bootstrap OAuth (the two are otherwise indistinguishable).
export function serveWellKnown(pathname: string): Response | null {
  if (pathname === '/.well-known/glama.json') {
    return new Response(JSON.stringify(glamaConnector, null, 2), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  if (pathname === '/.well-known/mcp/server-card.json') {
    return new Response(JSON.stringify({
      serverInfo: { name: 'jobgpt-mcp-server', version: SERVER_VERSION },
      description: 'Job search automation, auto apply, resume generation, application tracking, and recruiter outreach',
      homepage: 'https://6figr.com/jobgpt',
      authentication: { required: true, schemes: ['bearer', 'oauth2'] },
      tools: [
        { name: 'search_jobs', description: 'Search for jobs with filters like titles, locations, companies, skills, salary, and remote options' },
        { name: 'match_jobs', description: 'Get new job matches from a saved job hunt - only returns jobs you have not already seen' },
        { name: 'get_job', description: 'Get detailed information about a specific job listing/posting by its job listing ID' },
        { name: 'get_industries', description: 'Get the list of valid company industries for search and job hunt filters' },
        { name: 'get_profile', description: 'Get your user profile including personal info, skills, experience, and work history' },
        { name: 'update_profile', description: 'Update your user profile fields' },
        { name: 'get_salary', description: 'Get your current salary/compensation details including base, stocks, bonus, and total compensation' },
        { name: 'update_salary', description: 'Update your salary/compensation details' },
        { name: 'get_currencies', description: 'Get the list of supported currencies with their codes, symbols, and units' },
        { name: 'get_credits', description: 'Get your current credit balance and usage information' },
        { name: 'list_job_hunts', description: 'List your saved job hunts. Also returns your current credits balance' },
        { name: 'create_job_hunt', description: 'Create a new job hunt to start tracking and applying to jobs' },
        { name: 'get_job_hunt', description: 'Get details of a specific job hunt by ID' },
        { name: 'update_job_hunt', description: 'Update job hunt settings and search filters' },
        { name: 'get_application_stats', description: 'Get aggregated stats for your job applications - total counts by status and auto-apply metrics' },
        { name: 'list_applications', description: 'List your job applications, optionally filtered by job hunt or status' },
        { name: 'get_application', description: 'Get details of a specific job application by ID' },
        { name: 'update_application', description: 'Update a job application status or notes' },
        { name: 'apply_to_job', description: 'Trigger auto-apply for a job application - automatically fills and submits the application form' },
        { name: 'add_job_to_applications', description: 'Add a job from search results to your applications' },
        { name: 'import_job_by_url', description: 'Import a job from a URL (LinkedIn, Greenhouse, Lever, Workday) and add it to your applications' },
        { name: 'list_interviews', description: 'List job interviews being actively tracked by JobGPT' },
        { name: 'list_resumes', description: 'List your uploaded resumes including primary and alternate versions' },
        { name: 'get_resume', description: 'Get details of a specific uploaded resume including download URL' },
        { name: 'delete_resume', description: 'Delete an uploaded alternate resume from your profile' },
        { name: 'upload_resume_from_url', description: 'Upload a resume from a publicly accessible URL (Google Drive, Dropbox, etc.). Supported formats: PDF, DOC, DOCX' },
        { name: 'list_generated_resumes', description: 'List AI-generated resumes tailored for specific job applications' },
        { name: 'get_generated_resume', description: 'Get details of a specific AI-generated resume including download URL' },
        { name: 'generate_resume_for_job', description: 'Generate an AI-optimized resume tailored for a specific job application' },
        { name: 'get_job_recruiters', description: "Get the recruiter for a specific job, matched to the role's function" },
        { name: 'get_job_referrers', description: "Get the job's hiring manager when JobGPT is confident, otherwise a peer who could refer you" },
        { name: 'get_application_recruiters', description: "Get the recruiter for a saved job application, matched to the role's function" },
        { name: 'get_application_referrers', description: "Get a saved application's hiring manager when JobGPT is confident, otherwise a peer who could refer you" },
        { name: 'list_outreaches', description: 'List your outreach emails sent to recruiters and referrers' },
        { name: 'send_outreach', description: 'Send an outreach email to a recruiter or referrer for a job application' },
      ],
      resources: [],
      prompts: [],
    }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
  }

  return null;
}

// Build an MCP response for a given (already-resolved) API key. Shared by the
// legacy raw-sk_ path and the OAuth apiHandler.
export async function serveMcp(request: Request, apiKey: string, backendUrl: string): Promise<Response> {
  const server = new McpServer({ name: 'jobgpt-mcp-server', version: SERVER_VERSION });
  const client = new JobGPTApiClient({ apiKey, apiUrl: backendUrl || 'https://6figr.com', debug: false });
  registerAllTools(server, client, 'worker');
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  return transport.handleRequest(request);
}

// Legacy path: authenticated by a raw `sk_` JobGPT API key passed as the Bearer
// token. Preserves the pre-OAuth behavior exactly so existing clients (Claude
// Code, mcp-remote, Cursor, Windsurf, Cline) keep working unchanged.
export async function legacyMcpHandler(request: Request, env: Env): Promise<Response> {
  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed. Use POST for MCP requests.' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json', 'Allow': 'POST, OPTIONS' },
    });
  }

  const authHeader = request.headers.get('Authorization');
  const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader || '';

  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'Missing Authorization header. Pass your JobGPT API key as Bearer token.' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return serveMcp(request, apiKey, env.BACKEND_URL);
}
