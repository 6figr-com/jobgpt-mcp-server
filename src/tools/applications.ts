import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JobGPTApiClient, JobApplication, Interview } from '../api-client.js';

export function registerApplicationTools(server: McpServer, client: JobGPTApiClient) {
  server.tool(
    'get_application_stats',
    'Get aggregated stats for your job applications — total counts by status and auto-apply metrics. Much faster than paginating through list_applications.',
    {
      jobHuntId: z.string().optional().describe('Filter stats to a specific job hunt'),
      dateOffset: z.enum(['24H', '1D', '2D', '7D', '14D', '1M', '3M', '6M', '9M', '1Y']).optional().describe('Filter by time period (e.g., "24H", "7D", "1M", "3M", "1Y")'),
    },
    async (args) => {
      const stats = await client.getApplicationStats(args.jobHuntId, args.dateOffset);
      return { content: [{ type: 'text' as const, text: JSON.stringify(stats, null, 2) }] };
    }
  );

  server.tool(
    'list_applications',
    'List your job applications, optionally filtered by job hunt or status',
    {
      jobHuntId: z.string().optional().describe('Filter by job hunt ID'),
      status: z.string().optional().describe('Filter by status (e.g., "PENDING", "APPLIED", "INTERVIEW", "OFFER", "REJECTED")'),
      page: z.number().optional().describe('Page number (default: 1)'),
      limit: z.number().optional().describe('Number of results per page (default: 20, max: 50)'),
    },
    async (args) => {
      const result = await client.listApplications({
        jobHuntId: args.jobHuntId,
        status: args.status,
        page: args.page || 1,
        limit: args.limit || 20,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify({ count: result.count, applications: result.applications.map(formatApplication) }, null, 2) }] };
    }
  );

  server.tool(
    'get_application',
    'Get details of a specific job application by ID. Optionally include the full job listing (description, salary, skills, etc.).',
    {
      id: z.string().describe('The application ID'),
      includeJobListing: z.boolean().optional().describe('If true, includes the full job listing details (description, salary, experience level, skills) in the response'),
    },
    async (args) => {
      const application = await client.getApplication(args.id, { includeJobListing: args.includeJobListing });
      const formatted = formatApplication(application);
      if (args.includeJobListing) {
        const raw = application as unknown as Record<string, unknown>;
        if (raw.jobListing) { formatted.jobListing = raw.jobListing; }
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(formatted, null, 2) }] };
    }
  );

  server.tool(
    'update_application',
    'Update a job application status or notes',
    {
      id: z.string().describe('The application ID'),
      status: z.string().optional().describe('New status (e.g., "PENDING", "APPLIED", "INTERVIEW", "OFFER", "REJECTED")'),
      notes: z.string().optional().describe('Notes about the application'),
    },
    async (args) => {
      const updateData: Record<string, unknown> = {};
      if (args.status !== undefined) { updateData.status = args.status; }
      if (args.notes !== undefined) { updateData.notes = args.notes; }

      if (Object.keys(updateData).length === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ message: 'No fields provided to update' }, null, 2) }] };
      }

      const updated = await client.updateApplication(args.id, updateData);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ message: 'Application updated successfully', application: formatApplication(updated) }, null, 2) }] };
    }
  );

  server.tool(
    'apply_to_job',
    'Trigger auto-apply for a job application. This will automatically fill and submit the job application form. You can optionally specify a specific resume to use for this application.',
    {
      id: z.string().describe('The application ID to auto-apply for'),
      resumeUri: z.string().optional().describe('Optional: The URI of a specific resume to use for this application. Get this from list_resumes or upload_resume. If not provided, the primary resume will be used.'),
    },
    async (args) => {
      await client.autoApply(args.id, args.resumeUri);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            message: 'Auto-apply triggered successfully. The application will be submitted shortly.',
            applicationId: args.id,
            resumeUri: args.resumeUri || 'primary resume',
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'add_job_to_applications',
    'Add a job from search results to your applications. Use this when a user wants to save/track a job they found.',
    {
      jobId: z.string().describe('The job ID to add to applications'),
      jobHuntId: z.string().describe('The job hunt ID to add this job to'),
    },
    async (args) => {
      const result = await client.addJobToApplications(args.jobId, args.jobHuntId);
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'import_job_by_url',
    'Import a job from a URL (e.g., LinkedIn, Greenhouse, Lever, Workday) and add it to your applications. Optionally trigger auto-apply immediately. Use this when a user has a direct link to a job posting.',
    {
      url: z.string().describe('The job posting URL (supports LinkedIn, Greenhouse, Lever, Workday, and most ATS platforms)'),
      jobHuntId: z.string().describe('The job hunt ID to add this job to'),
      autoApply: z.boolean().optional().describe('Whether to automatically apply to this job (default: false)'),
    },
    async (args) => {
      const result = await client.importJobByUrl(args.url, args.jobHuntId, args.autoApply || false);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            message: args.autoApply
              ? 'Job imported and auto-apply triggered. The application will be submitted shortly.'
              : 'Job imported successfully and added to your applications.',
            application: formatApplication(result),
          }, null, 2),
        }],
      };
    }
  );

  server.tool(
    'list_interviews',
    'List job interviews that are being actively tracked by JobGPT (detected from email confirmations). Use upcoming=true to get scheduled/rescheduled interviews. Can also filter by application ID or status.',
    {
      jobApplicationId: z.string().optional().describe('Filter interviews for a specific job application'),
      status: z.enum(['SCHEDULED', 'RESCHEDULED', 'CANCELLED', 'COMPLETED']).optional().describe('Filter by interview status'),
      upcoming: z.boolean().optional().describe('If true, returns only upcoming interviews (SCHEDULED or RESCHEDULED)'),
      page: z.number().optional().describe('Page number (default: 1)'),
      limit: z.number().optional().describe('Number of results per page (default: 20, max: 50)'),
    },
    async (args) => {
      const result = await client.listInterviews({
        jobApplicationId: args.jobApplicationId,
        status: args.status,
        upcoming: args.upcoming,
        page: args.page,
        limit: args.limit,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify({ count: result.count, interviews: result.interviews.map(formatInterview) }, null, 2) }] };
    }
  );
}

function formatInterview(interview: Interview): Record<string, unknown> {
  return {
    id: interview.id,
    jobApplicationId: interview.jobApplicationId,
    company: interview.company,
    title: interview.title,
    interviewTime: interview.interviewTime,
    timezone: interview.timezone,
    format: interview.format,
    meetingPlatform: interview.meetingPlatform,
    location: interview.location,
    interviewerName: interview.interviewerName,
    interviewerEmail: interview.interviewerEmail,
    duration: interview.duration,
    notes: interview.notes,
    status: interview.status,
  };
}

function formatApplication(app: JobApplication): Record<string, unknown> {
  return {
    id: app.id,
    jobHuntId: app.jobHuntId,
    jobId: app.jobId,
    title: app.title,
    company: app.company,
    location: app.location,
    url: app.url,
    status: app.status,
    autoApplied: app.autoApplied,
    appliedDate: app.appliedDate,
    notes: app.notes,
    matchScore: app.aiRelevancyScore ? `${Math.round(app.aiRelevancyScore)}%` : null,
    createdAt: app.createdAt,
    updatedAt: app.updatedAt,
  };
}
