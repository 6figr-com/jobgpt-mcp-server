import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JobGPTApiClient, GeneratedResumeJsonResponse } from '../api-client.js';
import * as fs from 'fs';
import * as path from 'path';
import { resolveApplicationId } from './application-id.js';

export const GENERATE_RESUME_DESCRIPTION = 'Tailor the user\'s resume for one job: makes a new AI-tailored copy of their resume for that job. Use it for any resume tailoring request, e.g. "tailor / customize / update my resume for this job", "highlight my X work", "add skill Y", "make the summary shorter". Pass applicationId for a saved application, or jobId for a job from search_jobs / match_jobs (it is first added to the user\'s applications, reusing their existing application for that job). Map the ask to arguments: "highlight / emphasize X" -> modifications; "add skill or keyword Y" -> keywords, plus a modifications line when they want it worked into their experience (e.g. "Add Java to my experience at Tesla"); "shorter summary" or "rewrite my summary" -> sections ["summary"] plus a modifications line saying how. Pass the user\'s asks through as they phrase them. Every run starts from the user\'s base resume, never from an earlier tailored copy, so for a follow-up edit on the same job include the earlier asks again with the new one. Set generatePdf: true when the user wants a file to download or send; only then is the copy saved (with a generatedResumeId, filename and download link, and listed by list_generated_resumes). Without it you get the tailored resume JSON only. The base resume is never changed. This does not apply to the job and costs no credits. Takes up to about a minute.';

// generate_resume_for_job result. bane only stores a GeneratedResume (id + PDF) when generatePdf is set;
// without it the tailored JSON is all there is. bane's response has no filename, so it is read back by id.
async function generatedResumeResponse(client: JobGPTApiClient, applicationId: string, pdfRequested: boolean, result: GeneratedResumeJsonResponse): Promise<Record<string, unknown>> {
  const response: Record<string, unknown> = { message: 'Tailored resume generated (JSON only, not saved). Call again with generatePdf: true for a downloadable PDF copy.', applicationId };
  if (result.generatedResumeId) {
    response.generatedResumeId = result.generatedResumeId;
  }
  if (result.pdfUrl) {
    response.message = 'Tailored resume saved as a PDF. The download link expires in about an hour; get_generated_resume with generatedResumeId gives a fresh one.';
    response.downloadUrl = result.pdfUrl;
    response.pdfUrl = result.pdfUrl;
    if (result.generatedResumeId) {
      const saved = await client.getGeneratedResume(result.generatedResumeId).catch(() => null);
      if (saved && saved.resumeFileName) {
        response.filename = saved.resumeFileName;
      }
    }
  } else if (pdfRequested) {
    response.message = 'Tailored resume generated, but the PDF could not be made, so nothing was saved. Try again with generatePdf: true.';
  }
  response.addedKeywords = result.addedKeywords;
  response.resumeJson = result.jsonResume;
  return response;
}

export function registerResumeTools(server: McpServer, client: JobGPTApiClient, mode: 'stdio' | 'worker') {
  server.tool(
    'list_resumes',
    'List your uploaded resumes. Returns all resumes you have uploaded to your profile, including your primary resume and any alternate versions.',
    {
      includeRawTxt: z.boolean().optional().describe('Include raw text content of the resume (default: false)'),
    },
    async (args) => {
      const resumes = await client.listResumes(args.includeRawTxt);
      const result = {
        count: resumes.length,
        resumes: resumes.map(r => ({
          id: r.uri,
          filename: r.fileName,
          isPrimary: r.primary,
          downloadUrl: r.url,
          tags: r.tags,
          createdAt: r.createdAt,
          ...(r.rawTxt && { rawTxt: r.rawTxt }),
        })),
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'get_resume',
    'Get details of a specific uploaded resume including download URL.',
    {
      id: z.string().describe('The resume ID (URI)'),
      includeRawTxt: z.boolean().optional().describe('Include raw text content of the resume (default: false)'),
    },
    async (args) => {
      const resume = await client.getResume(args.id, args.includeRawTxt);
      const result = {
        id: args.id,
        filename: resume.fileName,
        downloadUrl: resume.url,
        ...(resume.rawTxt && { rawTxt: resume.rawTxt }),
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'delete_resume',
    'Delete an uploaded resume from your profile. Note: You cannot delete your primary resume, only alternate resumes.',
    {
      id: z.string().describe('The resume ID (URI) to delete'),
    },
    async (args) => {
      await client.deleteResume(args.id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ success: true, message: 'Resume deleted successfully', id: args.id }, null, 2) }] };
    }
  );

  server.tool(
    'list_generated_resumes',
    'List AI-generated custom resumes. These are resumes that were automatically tailored for specific job applications.',
    {
      jobApplicationId: z.string().optional().describe('Filter by job application ID'),
      manualTrigger: z.boolean().optional().describe('Filter by whether resume was manually triggered'),
    },
    async (args) => {
      const result = await client.listGeneratedResumes({
        jobApplicationId: args.jobApplicationId,
        manualTrigger: args.manualTrigger,
      });
      const response = {
        count: result.resumes.length,
        generatedResumes: result.resumes.map(r => ({
          id: r._id,
          jobApplicationId: r.jobApplicationId,
          jobTitle: r.meta?.title,
          company: r.meta?.companyName,
          filename: r.fileName,
          status: r.status,
          aiRelevancyScore: r.aiRelevancyScore ? `${Math.round(r.aiRelevancyScore * 100)}%` : null,
          createdAt: r.dateCreated,
        })),
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }] };
    }
  );

  server.tool(
    'get_generated_resume',
    'Get details of a specific AI-generated resume including the download URL.',
    {
      id: z.string().describe('The generated resume ID'),
    },
    async (args) => {
      const resume = await client.getGeneratedResume(args.id);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ id: args.id, filename: resume.resumeFileName, downloadUrl: resume.url }, null, 2) }] };
    }
  );

  server.tool(
    'generate_resume_for_job',
    GENERATE_RESUME_DESCRIPTION,
    {
      applicationId: z.string().optional().describe('A saved job application ID (from list_applications or get_application). Pass this or jobId.'),
      jobId: z.string().optional().describe('A job ID (from search_jobs, match_jobs or get_job) for a job the user has not saved yet; it is added to their applications first. Pass this or applicationId.'),
      jobHuntId: z.string().optional().describe('With jobId only: the job hunt to save the job under. Defaults to the most recently updated active job hunt.'),
      modifications: z.array(z.string()).optional().describe('The user\'s asks in their own words, one per item, e.g. "Highlight the Kafka and data pipeline work", "Keep the summary to 2 sentences, focused on leadership", "Add Java to my experience at Tesla". Leave it out for a plain "tailor my resume for this job" with no other ask. On a follow-up for the same job, include the earlier asks again.'),
      keywords: z.array(z.string()).optional().describe('Skills or keywords to add or emphasize, as short names, e.g. ["Java", "Spring Boot"].'),
      sections: z.array(z.enum(['summary', 'basics', 'work', 'education', 'skills', 'projects', 'certificates', 'awards', 'volunteer', 'publications', 'languages', 'interests', 'references'])).optional().describe('Resume sections to rewrite. Defaults to ["summary", "work", "skills"]. Only the summary: ["summary"].'),
      generatePdf: z.boolean().optional().describe('true when the user wants a file to download or send: saves the tailored copy as a PDF and returns generatedResumeId, filename and downloadUrl. Default false: returns the tailored resume JSON only and saves nothing.'),
    },
    async (args) => {
      const applicationId = await resolveApplicationId(client, args);
      const result = await client.generateResumeForJob(applicationId, {
        modifications: args.modifications,
        keywords: args.keywords,
        sections: args.sections,
        generatePdf: args.generatePdf,
      });
      return { content: [{ type: 'text' as const, text: JSON.stringify(await generatedResumeResponse(client, applicationId, !!args.generatePdf, result), null, 2) }] };
    }
  );

  // URL-based upload — works in both stdio and worker modes
  server.tool(
    'upload_resume_from_url',
    'Upload a resume from a publicly accessible URL. Pass a direct link to a PDF, DOC, or DOCX file (e.g. Google Drive share link, Dropbox link, S3 URL). Maximum file size: 5MB. By default, your profile will be synced with the resume content. If the user does not have their resume hosted at a URL, they can upload it directly from their profile at https://6figr.com/profile instead.',
    {
      url: z.string().url().describe('Publicly accessible URL to the resume file (PDF, DOC, or DOCX)'),
      syncProfile: z.boolean().optional().describe('Whether to sync profile with resume content (default: true). Ignored for alt resumes.'),
      isAltResume: z.boolean().optional().describe('Upload as an alternate resume instead of replacing the primary resume (default: false)'),
    },
    async (args) => {
      const isAlt = args.isAltResume || false;
      const syncProfile = args.syncProfile !== false;
      const result = await client.uploadResumeFromUrl(args.url, syncProfile, isAlt);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            success: true,
            message: isAlt ? 'Alternate resume uploaded successfully' : 'Resume uploaded successfully',
            uri: result.uri,
            fileName: result.fileName,
            isAltResume: isAlt,
          }, null, 2),
        }],
      };
    }
  );

  // File path upload — only available in stdio (local) mode
  if (mode === 'stdio') {
    server.tool(
      'upload_resume_from_file',
      'Upload a resume from a file on the user\'s local machine. Provide the absolute file path to a PDF, DOC, or DOCX file. Maximum file size: 5MB. By default, your profile will be synced with the resume content.',
      {
        filePath: z.string().describe('Absolute path to the resume file on the local machine (e.g. "/Users/john/Documents/resume.pdf")'),
        syncProfile: z.boolean().optional().describe('Whether to sync profile with resume content (default: true). Ignored for alt resumes.'),
        isAltResume: z.boolean().optional().describe('Upload as an alternate resume instead of replacing the primary resume (default: false)'),
      },
      async (args) => {
        const isAlt = args.isAltResume || false;
        const syncProfile = args.syncProfile !== false;
        const fileName = path.basename(args.filePath);

        const ext = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
        if (!['pdf', 'docx', 'doc'].includes(ext)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Invalid file type. Supported formats: PDF, DOC, DOCX.' }, null, 2) }] };
        }

        if (!fs.existsSync(args.filePath)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: `File not found: ${args.filePath}` }, null, 2) }] };
        }

        const stats = fs.statSync(args.filePath);
        if (stats.size > 5 * 1024 * 1024) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'File exceeds 5MB limit.' }, null, 2) }] };
        }

        const fileBuffer = fs.readFileSync(args.filePath);
        const base64Content = fileBuffer.toString('base64');
        const result = await client.uploadResumeFromBase64(base64Content, fileName, syncProfile, isAlt);

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              message: isAlt ? 'Alternate resume uploaded successfully' : 'Resume uploaded successfully',
              uri: result.uri,
              fileName: result.fileName,
              isAltResume: isAlt,
            }, null, 2),
          }],
        };
      }
    );
  }
}
