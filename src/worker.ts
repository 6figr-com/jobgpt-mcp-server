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

    // Serve MCP server card for discovery (used by Smithery and other registries)
    if (url.pathname === '/.well-known/mcp/server-card.json') {
      return new Response(JSON.stringify({
        serverInfo: { name: 'jobgpt-mcp-server', version: '1.0.2' },
        description: 'MCP server for JobGPT - search jobs, auto-apply, generate tailored resumes, track applications, and find recruiters',
        homepage: 'https://6figr.com/jobgpt',
        authentication: { required: true, schemes: ['bearer'] },
        tools: [
          { name: 'search_jobs', description: 'Search jobs with filters - titles, locations, companies, skills, salary, remote, H1B sponsorship' },
          { name: 'match_jobs', description: 'Get new job matches from a saved job hunt (only unseen jobs)' },
          { name: 'get_job', description: 'Get full details of a specific job posting' },
          { name: 'get_profile', description: 'View your profile - skills, experience, work history, education' },
          { name: 'update_profile', description: 'Update name, headline, location, skills, experience' },
          { name: 'get_salary_data', description: 'Get your current compensation details' },
          { name: 'get_credits', description: 'Check your remaining credits balance' },
          { name: 'list_job_hunts', description: 'List your saved job hunts with credits balance' },
          { name: 'create_job_hunt', description: 'Create a new job hunt with search filters and auto-apply settings' },
          { name: 'get_job_hunt', description: 'Get details of a specific job hunt' },
          { name: 'update_job_hunt', description: 'Update filters, auto-apply mode, daily limits, status' },
          { name: 'get_application_stats', description: 'Aggregated stats - counts by status, auto-apply metrics' },
          { name: 'list_applications', description: 'List applications filtered by job hunt or status' },
          { name: 'get_application', description: 'Get full application details' },
          { name: 'update_application', description: 'Update status or notes' },
          { name: 'apply_to_job', description: 'Trigger auto-apply for an application' },
          { name: 'add_job_to_applications', description: 'Save a job from search results to your applications' },
          { name: 'import_job_by_url', description: 'Import a job from any URL (LinkedIn, Greenhouse, Lever, Workday, etc.)' },
          { name: 'list_resumes', description: 'List your uploaded resumes' },
          { name: 'get_resume', description: 'Get resume details and download URL' },
          { name: 'delete_resume', description: 'Delete an alternate resume' },
          { name: 'upload_resume', description: 'Upload a resume from URL (PDF, DOC, DOCX)' },
          { name: 'list_generated_resumes', description: 'List AI-tailored resumes created for applications' },
          { name: 'get_generated_resume', description: 'Get a generated resume download URL' },
          { name: 'generate_resume_for_job', description: 'Generate an AI-optimized resume for a specific application' },
          { name: 'calculate_match_score', description: 'Calculate resume-to-job match score with skill analysis' },
          { name: 'get_job_recruiters', description: 'Find recruiters associated with a job' },
          { name: 'get_job_referrers', description: 'Find potential referrers at a company' },
          { name: 'get_application_recruiters', description: 'Get recruiters for a saved application' },
          { name: 'get_application_referrers', description: 'Find referrers for a saved application' },
          { name: 'list_outreaches', description: 'List your sent outreach emails' },
          { name: 'send_outreach', description: 'Send an outreach email to a recruiter or referrer' },
          { name: 'list_email_templates', description: 'List available email templates' },
          { name: 'generate_email_from_template', description: 'Generate an email from a template' },
        ],
        resources: [],
        prompts: [],
      }), { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } });
    }

    // Handle root and /mcp paths
    if (url.pathname !== '/' && url.pathname !== '/mcp') {
      return new Response(JSON.stringify({
        name: 'jobgpt-mcp-server',
        version: '1.0.2',
      }), { status: 404, headers: { 'Content-Type': 'application/json' } });
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
