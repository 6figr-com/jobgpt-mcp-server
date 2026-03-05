import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JobGPTApiClient } from '../api-client.js';

export function registerResumeTools(server: McpServer, client: JobGPTApiClient) {
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
    'Generate an AI-optimized resume tailored for a specific job application. This creates a customized version of your resume highlighting relevant skills and experience for the job. Returns JSON resume data.',
    {
      applicationId: z.string().describe('The job application ID to generate a resume for'),
      modifications: z.array(z.string()).optional().describe('Custom modifications or instructions for resume customization'),
      keywords: z.array(z.string()).optional().describe('Specific keywords to emphasize in the resume'),
      sections: z.array(z.enum(['summary', 'basics', 'work', 'education', 'skills', 'projects', 'certificates', 'awards', 'volunteer', 'publications', 'languages', 'interests', 'references'])).optional().describe('Which resume sections to AI-enhance. Defaults to ["summary", "work", "skills"] if not specified.'),
      generatePdf: z.boolean().optional().describe('Generate a downloadable PDF from the resume (default: false). When true, returns a PDF download URL.'),
    },
    async (args) => {
      const result = await client.generateResumeForJob(args.applicationId, {
        modifications: args.modifications,
        keywords: args.keywords,
        sections: args.sections,
        generatePdf: args.generatePdf,
      });
      const response: Record<string, unknown> = {
        message: 'Resume generation complete',
        resumeJson: result.jsonResume,
        addedKeywords: result.addedKeywords,
      };
      if (result.pdfUrl) {
        response.pdfUrl = result.pdfUrl;
        response.generatedResumeId = result.generatedResumeId;
        response.message = 'Resume generated with downloadable PDF';
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }] };
    }
  );

  // calculate_match_score - temporarily disabled
  // server.tool(
  //   'calculate_match_score',
  //   'Calculate how well your resume matches a job application. Returns a relevancy score and analysis including matching skills, missing skills, and optimization suggestions.',
  //   {
  //     applicationId: z.string().describe('The job application ID to calculate match score for'),
  //   },
  //   async (args) => {
  //     const result = await client.calculateMatchScore(args.applicationId);
  //     const response = {
  //       applicationId: args.applicationId,
  //       matchScore: result.relevancyScore >= 0 ? `${Math.round(result.relevancyScore * 100)}%` : 'Unable to calculate',
  //       justification: result.justification,
  //       matchingSkills: result.matchingSkills,
  //       missingSkills: result.missingSkills,
  //       optimizations: result.optimizations,
  //     };
  //     return { content: [{ type: 'text' as const, text: JSON.stringify(response, null, 2) }] };
  //   }
  // );

  server.tool(
    'upload_resume',
    'Upload a resume from a URL or a local file path. Supported formats: PDF, DOC, DOCX. Maximum file size: 5MB. Provide exactly one of `url` or `filePath`. By default, your profile will be synced with the resume content. Use isAltResume to upload as an alternate resume instead of replacing your primary.',
    {
      url: z.string().optional().describe('The URL of the resume file to upload (must be a direct link to PDF, DOC, or DOCX)'),
      filePath: z.string().optional().describe('Absolute path to a local resume file to upload (PDF, DOC, or DOCX)'),
      syncProfile: z.boolean().optional().describe('Whether to sync profile with resume content (default: true). Ignored for alt resumes.'),
      isAltResume: z.boolean().optional().describe('Upload as an alternate resume instead of replacing the primary resume (default: false)'),
    },
    async (args) => {
      const hasUrl = !!args.url;
      const hasFilePath = !!args.filePath;

      if (hasUrl && hasFilePath) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Please provide either a URL or a file path, not both.' }, null, 2) }] };
      }
      if (!hasUrl && !hasFilePath) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Please provide either a URL or a file path.' }, null, 2) }] };
      }

      const isAlt = args.isAltResume || false;
      const syncProfile = args.syncProfile !== false;

      if (hasFilePath) {
        // Local file upload via base64
        let fs: typeof import('node:fs');
        let path: typeof import('node:path');
        try {
          fs = await import('node:fs');
          path = await import('node:path');
        } catch {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Local file upload is not supported in cloud mode. Please use a URL instead.' }, null, 2) }] };
        }

        if (!fs.existsSync(args.filePath!)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: `File not found: ${args.filePath}` }, null, 2) }] };
        }

        const fileName = path.basename(args.filePath!);
        const ext = fileName.substring(fileName.lastIndexOf('.') + 1).toLowerCase();
        if (!['pdf', 'docx', 'doc'].includes(ext)) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Invalid file type. Supported formats: PDF, DOC, DOCX.' }, null, 2) }] };
        }

        const fileBuffer = fs.readFileSync(args.filePath!);
        if (fileBuffer.length === 0) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'File is empty.' }, null, 2) }] };
        }
        if (fileBuffer.length > 5 * 1024 * 1024) {
          return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'File size exceeds 5MB limit.' }, null, 2) }] };
        }

        const fileContent = fileBuffer.toString('base64');
        const result = await client.uploadResumeFromBase64(fileContent, fileName, syncProfile, isAlt);
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

      // URL upload (existing behavior)
      const result = await client.uploadResumeFromUrl(args.url!, syncProfile, isAlt);
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
