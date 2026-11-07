import { JobGPTApiClient } from '../api-client.js';

export interface ApplicationTarget {
  applicationId?: string;
  jobId?: string;
  jobHuntId?: string;
}

// Tools that act on a saved application take an applicationId, or a jobId (from search_jobs / match_jobs)
// that is saved to applications first: under jobHuntId, else the most recently updated active job hunt.
// bane's create-application returns the user's existing application for the same job instead of a duplicate.
export async function resolveApplicationId(client: JobGPTApiClient, args: ApplicationTarget): Promise<string> {
  if (args.applicationId && args.jobId) {
    throw new Error('Pass either applicationId or jobId, not both.');
  }
  if (args.applicationId) {
    return args.applicationId;
  }
  if (!args.jobId) {
    throw new Error('applicationId or jobId is required.');
  }
  let jobHuntId = args.jobHuntId;
  if (!jobHuntId) {
    const hunts = await client.listJobHunts({ page: 1, limit: 1 });
    if (!hunts.jobHunts.length) {
      throw new Error('You have no active job hunt to save this job under. Create one with create_job_hunt, or pass jobHuntId.');
    }
    jobHuntId = hunts.jobHunts[0].id;
  }
  const application = await client.addJobToApplications(args.jobId, jobHuntId);
  if (!application || !application.id) {
    throw new Error(`Could not add job ${args.jobId} to your applications.`);
  }
  return application.id;
}
