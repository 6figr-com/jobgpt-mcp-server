import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JobGPTApiClient, JobHunt, JobHuntListParams, JobHuntListResponse, JobSearchFilters } from '../api-client.js';

// How to remove a saved filter on update. update_job_hunt merges config, so omitting a field keeps it.
const CLEAR_FILTER_HELP = 'To remove a filter, send its empty value: [] for list filters (e.g. "companies": []), null for relevancy, dateOffset, baseSalaryMin and baseSalaryMax, and false for remote and h1bSponsorship. Clearing H1B takes both "workAuthorization": [] and "h1bSponsorship": false. If locations and countries both end up empty, JobGPT falls back to a default country.';

// Filters shared by create_job_hunt and update_job_hunt (bane jobSearchFiltersSchema)
const huntFilterFields = {
  locations: z.array(z.string()).optional().describe('Locations to match. Use plain city names without state abbreviations (e.g., "San Francisco" not "San Francisco, CA"). For states, use the full state name (e.g., "Texas"). Use "Remote" to match remote jobs worldwide without country restrictions.'),
  countries: z.array(z.string()).optional().describe('Country codes (e.g., ["US", "CA"])'),
  companies: z.array(z.string()).optional().describe('Companies to include'),
  excludedCompanies: z.array(z.string()).optional().describe('Companies to exclude'),
  skills: z.array(z.string()).optional().describe('Required skills'),
  remote: z.boolean().optional().describe('When true, only return remote jobs. When false or omitted, return all jobs (both remote and non-remote).'),
  baseSalaryMin: z.number().nullable().optional().describe('Minimum salary (null removes it)'),
  baseSalaryMax: z.number().nullable().optional().describe('Maximum salary (null removes it)'),
  expLevels: z.array(z.string()).optional().describe('Experience levels (e.g., ["SE" for Senior, "MI" for Mid-level, "EN" for Entry])'),
  industries: z.array(z.string()).optional().describe('Industries (use get_industries to see valid values)'),
  companySize: z.array(z.string()).optional().describe('Company sizes (e.g., ["xs" for 1-50, "s" for 50-200, "m" for 200-1K, "l" for 1K-5K, "xl" for 5K+])'),
  h1bSponsorship: z.boolean().optional().describe('When true, only match jobs that sponsor H1B visas. Same filter as workAuthorization ["h1b"]; either one turns it on.'),
  workAuthorization: z.array(z.string()).max(5).optional().describe('Work authorization filters (max 5). "h1b" is the only value that filters today: it only matches jobs that sponsor H1B, the same filter as h1bSponsorship true. Since either field turns the H1B filter on, clearing it takes workAuthorization [] AND h1bSponsorship false.'),
  relevancy: z.enum(['HIGH', 'MEDIUM']).nullable().optional().describe('Search relevancy mode - HIGH for strict title/skills matching (recommended), MEDIUM for broader keyword-based results. Default is null (MEDIUM behavior).'),
  dateOffset: z.enum(['24H', '1D', '2D', '7D', '14D', '1M', '3M', '6M', '9M', '1Y']).nullable().optional().describe('Only match jobs posted within this time window (e.g., "7D" for last 7 days). Default is "7D".'),
  workArrangement: z.array(z.string()).optional().describe('Work arrangement filter (e.g., ["Full Time", "Part Time", "Contract", "Internship", "Freelance", "Temporary"]). Defaults to ["Full Time"] if not set or empty.'),
  excludedKeywords: z.array(z.string()).optional().describe('Keywords to exclude from job results'),
  excludedTitles: z.array(z.string()).optional().describe('Job titles to exclude from results'),
};

export function registerJobHuntTools(server: McpServer, client: JobGPTApiClient) {
  server.tool(
    'get_credits',
    'Get your current credit balance and usage information',
    {},
    async () => {
      const result = await client.getCredits();
      const response = {
        credits: result.autoApplyQuota,
        creditsRemaining: result.autoApplyQuotaRemaining,
        message: result.autoApplyQuotaRemaining > 0
          ? `You have ${result.autoApplyQuotaRemaining} credits available for auto-apply and other operations.`
          : 'You have no credits remaining. Purchase credits to continue: https://6figr.com/jobgpt?addCreditsPopup=true',
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }] };
    }
  );

  server.tool(
    'list_job_hunts',
    'List your saved job hunts (job searches), newest first. By default only ACTIVE hunts; pass status ARCHIVED or ALL (ACTIVE + ARCHIVED) to see archived ones. Pass includeStats to get per-hunt counts: matched (suggested jobs not yet acted on), applications (auto-applying, applied, interviewing, offer, rejected) and byStatus (every status). Also returns your current credits balance.',
    {
      page: z.number().optional().describe('Page number (default: 1)'),
      limit: z.number().optional().describe('Number of results per page (default: 20, max: 50)'),
      status: z.enum(['ACTIVE', 'ARCHIVED', 'ALL']).optional().describe('Which hunts to list: ACTIVE (default), ARCHIVED, or ALL (ACTIVE + ARCHIVED). Deleted hunts are never listed.'),
      includeStats: z.boolean().optional().describe('Include per-hunt application counts (matched, applications, byStatus). Default: false.'),
    },
    async (args) => {
      const params: JobHuntListParams = { page: args.page || 1, limit: args.limit || 20 };
      if (args.status) {
        params.status = args.status;
      }
      if (args.includeStats) {
        params.includeStats = true;
      }
      let result: JobHuntListResponse;
      let note: string | undefined;
      try {
        result = await client.listJobHunts(params);
      } catch (error) {
        // JobGPT servers without the status/includeStats support reject unknown query keys with a 400
        if (!(params.status || params.includeStats) || !isUnknownQueryKeyError(error)) {
          throw error;
        }
        result = await client.listJobHunts({ page: params.page, limit: params.limit });
        note = 'The JobGPT server does not support status or includeStats yet, so this lists ACTIVE hunts only, without stats.';
      }
      const response: Record<string, unknown> = {
        count: result.count !== undefined ? result.count : result.jobHunts.length,
        jobHunts: result.jobHunts.map(formatJobHunt),
        credits: result.autoApplyQuota,
        creditsRemaining: result.autoApplyQuotaRemaining,
      };
      if (note) {
        response.note = note;
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }] };
    }
  );

  server.tool(
    'create_job_hunt',
    'Create a new job hunt to start tracking and applying to jobs. A job hunt defines what jobs you want to find based on titles, locations, skills, salary, etc. You need at least one job hunt to use match_jobs or add_job_to_applications.',
    {
      name: z.string().describe('A name for this job hunt (e.g., "Senior Engineer roles in SF")'),
      config: z.object({
        titles: z.array(z.string()).max(6).describe('Job titles to match (required, max 6)'),
        ...huntFilterFields,
      }).describe('Search filters configuration'),
      autoMode: z.boolean().optional().describe('Enable full autopilot mode (default: false). When enabled, jobs are automatically matched, scored against your resume using AI, and applied to if they meet your minMatchScore threshold. Resume customization (if enabled) is applied before each application. Each auto-apply consumes a credit.'),
      dailyLimit: z.number().optional().describe('Maximum jobs to auto-apply per day (default: 5, max: 100)'),
      minMatchScore: z.number().optional().describe('Minimum match score for auto-apply (0-1). Jobs below this score will not be auto-applied. Default is 0.70 (70%) when not explicitly set.'),
      customizeResume: z.boolean().optional().describe('Enable AI resume customization for applications (default: false)'),
    },
    async (args) => {
      if (!args.config || !args.config.titles) {
        throw new Error('config.titles is required');
      }
      const jobHunt = await client.createJobHunt({
        name: args.name,
        config: args.config as JobSearchFilters,
        autoMode: args.autoMode,
        dailyLimit: args.dailyLimit,
        minMatchScore: args.minMatchScore,
        customizeResume: args.customizeResume,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify({ message: 'Job hunt created successfully', jobHunt: formatJobHunt(jobHunt) }, null, 2) }] };
    }
  );

  server.tool(
    'get_job_hunt',
    'Get details of a specific job hunt by ID',
    {
      id: z.string().describe('The job hunt ID'),
    },
    async (args) => {
      const jobHunt = await client.getJobHunt(args.id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(formatJobHunt(jobHunt), null, 2) }] };
    }
  );

  server.tool(
    'update_job_hunt',
    `Update job hunt settings and search filters. Use this to change what jobs are matched. config is merged into the saved config: send only the filters you want to change, and every filter you leave out keeps its saved value. ${CLEAR_FILTER_HELP} Use get_job_hunt to see the current config.`,
    {
      id: z.string().describe('The job hunt ID'),
      name: z.string().optional().describe('New name for the job hunt'),
      autoMode: z.boolean().optional().describe('Enable/disable full autopilot mode. When enabled, jobs are automatically matched, scored against your resume using AI, and applied to if they meet your minMatchScore threshold. Resume customization (if enabled) is applied before each application. Each auto-apply consumes a credit.'),
      dailyLimit: z.number().optional().describe('Maximum jobs to auto-apply per day (max: 100)'),
      minMatchScore: z.number().optional().describe('Minimum match score for auto-apply (0-1). Default is 0.70 (70%) when not explicitly set.'),
      customizeResume: z.boolean().optional().describe('Enable/disable AI resume customization for applications'),
      status: z.enum(['ACTIVE', 'ARCHIVED', 'DELETED']).optional().describe('Job hunt status'),
      config: z.object({
        titles: z.array(z.string()).max(6).optional().describe('Job titles to match (max 6)'),
        ...huntFilterFields,
      }).optional().describe(`Search filter changes. MERGED into the saved config: only the fields you send change, omitted fields keep their saved values. ${CLEAR_FILTER_HELP}`),
    },
    async (args) => {
      const updateData: Record<string, unknown> = {};
      if (args.name !== undefined) { updateData.name = args.name; }
      if (args.autoMode !== undefined) { updateData.autoMode = args.autoMode; }
      if (args.dailyLimit !== undefined) { updateData.dailyLimit = args.dailyLimit; }
      if (args.minMatchScore !== undefined) { updateData.minMatchScore = args.minMatchScore; }
      if (args.customizeResume !== undefined) { updateData.customizeResume = args.customizeResume; }
      if (args.status !== undefined) { updateData.status = args.status; }
      if (args.config !== undefined) { updateData.config = args.config; }

      if (Object.keys(updateData).length === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ message: 'No fields provided to update' }, null, 2) }] };
      }

      await client.updateJobHunt(args.id, updateData);
      const updated = await client.getJobHunt(args.id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ message: 'Job hunt updated successfully', jobHunt: formatJobHunt(updated) }, null, 2) }] };
    }
  );
}

function formatJobHunt(jobHunt: JobHunt): Record<string, unknown> {
  return {
    id: jobHunt.id,
    name: jobHunt.name,
    status: jobHunt.status,
    autoMode: jobHunt.autoMode,
    dailyLimit: jobHunt.dailyLimit,
    minMatchScore: jobHunt.minMatchScore,
    customizeResume: jobHunt.customizeResume,
    filters: jobHunt.config,
    stats: jobHunt.stats,
    createdAt: jobHunt.createdAt || jobHunt.dateCreated,
    updatedAt: jobHunt.updatedAt || jobHunt.dateUpdated,
  };
}

function isUnknownQueryKeyError(error: unknown): boolean {
  return error instanceof Error && /API Error \(400\)/.test(error.message) && /not allowed/.test(error.message);
}
