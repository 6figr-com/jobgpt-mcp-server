import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { JobGPTApiClient } from './api-client.js';
import { registerAllTools } from './tools/index.js';
import glamaConnector from './well-known/glama.json';

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

    // Serve Glama connector claim file
    if (url.pathname === '/.well-known/glama.json') {
      return new Response(JSON.stringify(glamaConnector, null, 2), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    // Serve MCP server card for discovery (used by Smithery and other registries)
    if (url.pathname === '/.well-known/mcp/server-card.json') {
      return new Response(JSON.stringify({
        serverInfo: { name: 'jobgpt-mcp-server', version: '1.1.4' },
        description: 'Job search automation, auto apply, resume generation, application tracking, and recruiter outreach',
        homepage: 'https://6figr.com/jobgpt',
        authentication: { required: true, schemes: ['bearer'] },
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
          { name: 'get_job_recruiters', description: 'Get recruiters who posted or are associated with a specific job' },
          { name: 'get_job_referrers', description: 'Find potential referrers at a company for a specific job' },
          { name: 'get_application_recruiters', description: 'Get recruiters for a job application you have saved' },
          { name: 'get_application_referrers', description: 'Find potential referrers for a job application' },
          { name: 'list_outreaches', description: 'List your outreach emails sent to recruiters and referrers' },
          { name: 'send_outreach', description: 'Send an outreach email to a recruiter or referrer for a job application' },
        ],
        resources: [],
        prompts: [],
      }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    // Handle unknown paths (return proper error format for OAuth discovery compatibility)
    if (url.pathname !== '/' && url.pathname !== '/mcp') {
      return new Response(JSON.stringify({ error: 'not_found', error_description: 'Not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Only POST is supported for stateless Streamable HTTP transport
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed. Use POST for MCP requests.' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Allow': 'POST, OPTIONS' },
      });
    }

    // Extract user's API key from Authorization header (supports "Bearer <key>" or raw key)
    const authHeader = request.headers.get('Authorization');
    const apiKey = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : authHeader || '';

    // Allow unauthenticated discovery requests for scanner (Smithery, etc.)
    const discoveryMethods = ['initialize', 'tools/list', 'resources/list', 'prompts/list', 'notifications/initialized'];
    if (!apiKey) {
      try {
        const body = await request.clone().json() as { method?: string };
        if (body.method && discoveryMethods.includes(body.method)) {
          const server = new McpServer({ name: 'jobgpt-mcp-server', version: '1.1.4' });
          registerAllTools(server, new JobGPTApiClient({ apiKey: '', apiUrl: env.BACKEND_URL || 'https://6figr.com', debug: false }), 'worker');
          const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
          await server.connect(transport);
          return transport.handleRequest(request);
        }
      } catch (_) {
        // Not JSON or not a discovery method — fall through to 401
      }
      return new Response(JSON.stringify({ error: 'Missing Authorization header. Pass your JobGPT API key as Bearer token.' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Create server + client per request (stateless mode)
    const server = new McpServer({ name: 'jobgpt-mcp-server', version: '1.1.4' });
    const client = new JobGPTApiClient({
      apiKey,
      apiUrl: env.BACKEND_URL || 'https://6figr.com',
      debug: false,
    });
    registerAllTools(server, client, 'worker');

    // Stateless transport — no session ID
    const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
    await server.connect(transport);

    return transport.handleRequest(request);
  },
};
