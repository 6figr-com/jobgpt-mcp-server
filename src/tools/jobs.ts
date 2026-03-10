import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JobGPTApiClient, Job } from '../api-client.js';

export function registerJobTools(server: McpServer, client: JobGPTApiClient) {
  server.tool(
    'search_jobs',
    'Search for jobs with filters like titles, locations, companies, skills, salary, and remote options. Returns a list of matching job postings.',
    {
      titles: z.array(z.string()).optional().describe('Job titles to search for (e.g., ["Software Engineer", "Senior Developer"])'),
      locations: z.array(z.string()).optional().describe('Locations to search in (e.g., ["San Francisco", "New York", "Remote"])'),
      countries: z.array(z.string()).optional().describe('Country codes to filter (e.g., ["US", "CA", "UK"])'),
      companies: z.array(z.string()).optional().describe('Specific companies to search (e.g., ["Google", "Meta", "Apple"])'),
      excludedCompanies: z.array(z.string()).optional().describe('Companies to exclude from results'),
      skills: z.array(z.string()).optional().describe('Required skills (e.g., ["Python", "React", "AWS"])'),
      remote: z.boolean().optional().describe('Filter for remote jobs only'),
      baseSalaryMin: z.number().optional().describe('Minimum base salary (USD)'),
      baseSalaryMax: z.number().optional().describe('Maximum base salary (USD)'),
      expLevels: z.array(z.string()).optional().describe('Experience levels (e.g., ["SE" for Senior, "MI" for Mid-level, "EN" for Entry])'),
      dateOffset: z.enum(['24H', '1D', '2D', '7D', '14D', '1M', '3M', '6M', '9M', '1Y']).optional().describe('Only show jobs posted within this time period (e.g., "2D" for last 2 days)'),
      industries: z.array(z.string()).optional().describe('Filter by company industries (use get_industries to see valid values)'),
      companySize: z.array(z.string()).optional().describe('Filter by company size (e.g., ["xs" for 1-50, "s" for 50-200, "m" for 200-1K, "l" for 1K-5K, "xl" for 5K+])'),
      h1bSponsorship: z.boolean().optional().describe('Filter for jobs offering H1B sponsorship'),
      limit: z.number().optional().describe('Maximum number of results (default: 5, max: 50). Keep low to avoid large responses.'),
      page: z.number().optional().describe('Page number for pagination (default: 1)'),
    },
    async (args) => {
      const filters: Record<string, unknown> = {};
      if (args.titles) { filters.titles = args.titles; }
      if (args.locations) { filters.locations = args.locations; }
      if (args.countries) { filters.countries = args.countries; }
      if (args.companies) { filters.companies = args.companies; }
      if (args.excludedCompanies) { filters.excludedCompanies = args.excludedCompanies; }
      if (args.skills) { filters.skills = args.skills; }
      if (args.remote !== undefined) { filters.remote = args.remote; }
      if (args.baseSalaryMin) { filters.baseSalaryMin = args.baseSalaryMin; }
      if (args.baseSalaryMax) { filters.baseSalaryMax = args.baseSalaryMax; }
      if (args.expLevels) { filters.expLevels = args.expLevels; }
      if (args.dateOffset) { filters.dateOffset = args.dateOffset; }
      if (args.industries) { filters.industries = args.industries; }
      if (args.companySize) { filters.companySize = args.companySize; }
      if (args.h1bSponsorship !== undefined) { filters.h1bSponsorship = args.h1bSponsorship; }

      const result = await client.searchJobs({
        filters,
        limit: args.limit || 5,
        page: args.page,
      });

      return { content: [{ type: 'text' as const, text: JSON.stringify({ count: result.count, jobs: result.jobs.map(formatJob) }, null, 2) }] };
    }
  );

  server.tool(
    'match_jobs',
    'Get new job matches based on a saved job hunt configuration. Uses the filters saved in your job hunt (titles, locations, skills, salary, etc.) and only returns jobs you have not already seen, applied to, or rejected. To change filters, use update_job_hunt first.',
    {
      jobHuntId: z.string().describe('The job hunt ID to match jobs against'),
      limit: z.number().optional().describe('Maximum number of results (default: 5, max: 50). Keep low to avoid large responses.'),
      page: z.number().optional().describe('Page number for pagination (default: 1)'),
    },
    async (args) => {
      const result = await client.matchJobs({
        jobHuntId: args.jobHuntId,
        page: args.page,
        limit: args.limit || 5,
      });

      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            count: result.count,
            jobs: result.jobs.map(formatJob),
            note: 'These are new jobs matching your job hunt criteria that you have not yet seen or applied to.',
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'get_industries',
    'Get the list of valid company industries. Use these values for the "industries" filter in search_jobs, create_job_hunt, or update_job_hunt.',
    {},
    async () => {
      const industries = await client.getIndustries();
      return { content: [{ type: 'text' as const, text: JSON.stringify({ count: industries.length, industries }, null, 2) }] };
    }
  );

  server.tool(
    'get_job',
    'Get detailed information about a specific job listing/posting by its job listing ID (not application ID). Use this to view the full job posting details including description, salary, skills, and company info. For job application details, use get_application instead.',
    {
      id: z.string().describe('The job ID'),
    },
    async (args) => {
      const job = await client.getJob(args.id);
      return { content: [{ type: 'text' as const, text: JSON.stringify(formatJob(job), null, 2) }] };
    }
  );
}

function formatJob(job: Job): Record<string, unknown> {
  return {
    id: job.id,
    title: job.title,
    company: job.company,
    location: job.location,
    remote: job.remote,
    salary: job.salaryMin && job.salaryMax
      ? `$${job.salaryMin.toLocaleString()} - $${job.salaryMax.toLocaleString()}`
      : job.salaryMin
        ? `$${job.salaryMin.toLocaleString()}+`
        : null,
    postedDate: job.postedDate,
    url: job.url,
    applyUrl: job.applyUrl,
    description: job.description?.substring(0, 500) + (job.description && job.description.length > 500 ? '...' : ''),
    experienceLevel: job.experienceLevel,
    skills: job.skills,
    companySize: job.companySize,
    industries: job.companyIndustries,
  };
}
