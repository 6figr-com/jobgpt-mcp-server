import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JobGPTApiClient, ContactWithEmail } from '../api-client.js';

export function registerOutreachTools(server: McpServer, client: JobGPTApiClient) {
  server.tool(
    'get_job_recruiters',
    'Get recruiters who posted or are associated with a specific job. Returns contact info including email and LinkedIn.',
    {
      jobId: z.string().describe('The job ID to find recruiters for'),
    },
    async (args) => {
      const result = await client.getJobRecruiters(args.jobId);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ recruiters: (result.contacts || []).map(formatContact) }, null, 2) }] };
    }
  );

  server.tool(
    'get_job_referrers',
    'Find potential referrers at a company for a specific job. Returns people who might be able to refer you based on your network and the job.',
    {
      jobId: z.string().describe('The job ID to find referrers for'),
      limit: z.number().optional().describe('Maximum number of referrers to return (default: 2, max: 2)'),
    },
    async (args) => {
      const result = await client.getJobReferrers(args.jobId, Math.min(args.limit || 2, 2));
      return { content: [{ type: 'text' as const, text: JSON.stringify({ referrers: (result.contacts || []).map(formatContact) }, null, 2) }] };
    }
  );

  server.tool(
    'get_application_recruiters',
    'Get recruiters for a job application you have saved. Returns contact info for reaching out.',
    {
      applicationId: z.string().describe('The job application ID'),
    },
    async (args) => {
      const result = await client.getApplicationRecruiters(args.applicationId);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ recruiters: (result.contacts || []).map(formatContact) }, null, 2) }] };
    }
  );

  server.tool(
    'get_application_referrers',
    'Find potential referrers for a job application. Returns people at the company who might refer you.',
    {
      applicationId: z.string().describe('The job application ID'),
      limit: z.number().optional().describe('Maximum number of referrers to return (default: 2, max: 2)'),
    },
    async (args) => {
      const result = await client.getApplicationReferrers(args.applicationId, Math.min(args.limit || 2, 2));
      return { content: [{ type: 'text' as const, text: JSON.stringify({ referrers: (result.contacts || []).map(formatContact) }, null, 2) }] };
    }
  );

  server.tool(
    'list_outreaches',
    'List your outreach emails that have been sent to recruiters and referrers.',
    {
      jobApplicationId: z.string().optional().describe('Filter by job application ID'),
      page: z.number().optional().describe('Page number (default: 1)'),
      limit: z.number().optional().describe('Results per page (default: 10, max: 25)'),
    },
    async (args) => {
      const result = await client.listOutreaches({
        jobApplicationId: args.jobApplicationId,
        page: args.page || 1,
        limit: args.limit || 10,
      });
      const response = {
        count: result.count,
        outreaches: result.outreaches.map(o => ({
          id: o.id,
          jobApplicationId: o.jobApplicationId,
          contactName: o.contactName,
          contactEmail: o.contactEmail,
          subject: o.subject,
          status: o.status,
          sentAt: o.sentAt,
          createdAt: o.createdAt,
        })),
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }] };
    }
  );

  server.tool(
    'send_outreach',
    'Send an outreach email to a recruiter or referrer for a job application. The email will be sent from your configured email.',
    {
      applicationId: z.string().describe('The job application ID'),
      contactId: z.string().describe('The contact ID (from get_application_recruiters or get_application_referrers)'),
      subject: z.string().describe('Email subject line'),
      body: z.string().describe('Email body content'),
    },
    async (args) => {
      const result = await client.createOutreach(args.applicationId, args.contactId, args.subject, args.body);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            message: 'Outreach email sent successfully',
            outreach: {
              id: result.id,
              contactName: result.contactName,
              contactEmail: result.contactEmail,
              subject: result.subject,
              status: result.status,
            },
          }, null, 2),
        }],
      };
    }
  );
}

function formatContact(item: ContactWithEmail): Record<string, unknown> {
  const c = item.contact;
  return {
    id: c.id,
    name: c.fullName,
    email: c.email,
    title: c.title,
    company: c.companyName,
    linkedinUrl: c.linkedinUrl,
    emailTemplate: item.emailTemplate,
    subject: item.subject,
  };
}
