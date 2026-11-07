import { mockClient, connect, callTool, toolSchema } from './helpers.mjs';

const JSON_ONLY = { jsonResume: { basics: { summary: 'Tailored' } }, addedKeywords: ['Java'] };
const WITH_PDF = { ...JSON_ONLY, pdfUrl: 'https://s3.example.com/r.pdf?sig=1', generatedResumeId: 'g1' };
const ASKS = { modifications: ['Add Java to my experience at Tesla'], keywords: ['Java'], sections: ['summary', 'work', 'skills'] };

describe('generate_resume_for_job', () => {
  test('applicationId path passes the asks through unchanged', async () => {
    const client = mockClient();
    client.generateResumeForJob.mockResolvedValue(JSON_ONLY);
    const mcp = await connect(client);
    const res = await callTool(mcp, 'generate_resume_for_job', { applicationId: 'a1', ...ASKS });
    expect(res.isError).toBe(false);
    expect(client.addJobToApplications).not.toHaveBeenCalled();
    expect(client.generateResumeForJob).toHaveBeenCalledWith('a1', { ...ASKS, generatePdf: undefined });
    expect(res.json.applicationId).toBe('a1');
  });

  test('jobId + jobHuntId saves the job under that hunt, then generates', async () => {
    const client = mockClient();
    client.addJobToApplications.mockResolvedValue({ id: 'a2', existing: false });
    client.generateResumeForJob.mockResolvedValue(JSON_ONLY);
    const mcp = await connect(client);
    const res = await callTool(mcp, 'generate_resume_for_job', { jobId: 'j1', jobHuntId: 'h9', keywords: ['Kafka'] });
    expect(client.listJobHunts).not.toHaveBeenCalled();
    expect(client.addJobToApplications).toHaveBeenCalledWith('j1', 'h9');
    expect(client.generateResumeForJob).toHaveBeenCalledWith('a2', expect.objectContaining({ keywords: ['Kafka'] }));
    expect(res.json.applicationId).toBe('a2');
  });

  test('jobId without jobHuntId uses the most recent active hunt (same as send_outreach)', async () => {
    const client = mockClient();
    client.listJobHunts.mockResolvedValue({ jobHunts: [{ id: 'hRecent' }, { id: 'hOld' }], autoApplyQuota: 0, autoApplyQuotaRemaining: 0 });
    client.addJobToApplications.mockResolvedValue({ id: 'a3', existing: true });
    client.generateResumeForJob.mockResolvedValue(JSON_ONLY);
    const mcp = await connect(client);
    await callTool(mcp, 'generate_resume_for_job', { jobId: 'j1' });
    expect(client.listJobHunts).toHaveBeenCalledWith({ page: 1, limit: 1 });
    expect(client.addJobToApplications).toHaveBeenCalledWith('j1', 'hRecent');
    expect(client.generateResumeForJob).toHaveBeenCalledWith('a3', expect.any(Object));
  });

  test('jobId with no job hunt fails before generating', async () => {
    const client = mockClient();
    client.listJobHunts.mockResolvedValue({ jobHunts: [], autoApplyQuota: 0, autoApplyQuotaRemaining: 0 });
    const mcp = await connect(client);
    const res = await callTool(mcp, 'generate_resume_for_job', { jobId: 'j1' });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/create_job_hunt/);
    expect(client.generateResumeForJob).not.toHaveBeenCalled();
  });

  test('needs exactly one of applicationId and jobId', async () => {
    const client = mockClient();
    const mcp = await connect(client);
    const neither = await callTool(mcp, 'generate_resume_for_job', { keywords: ['Java'] });
    const both = await callTool(mcp, 'generate_resume_for_job', { applicationId: 'a1', jobId: 'j1' });
    expect(neither.isError).toBe(true);
    expect(neither.text).toMatch(/applicationId or jobId is required/);
    expect(both.isError).toBe(true);
    expect(both.text).toMatch(/not both/);
    expect(client.generateResumeForJob).not.toHaveBeenCalled();
    expect(client.addJobToApplications).not.toHaveBeenCalled();
  });

  test('without a PDF: JSON only, no id, says nothing was saved', async () => {
    const client = mockClient();
    client.generateResumeForJob.mockResolvedValue(JSON_ONLY);
    const mcp = await connect(client);
    const res = await callTool(mcp, 'generate_resume_for_job', { applicationId: 'a1' });
    expect(Object.keys(res.json).sort()).toEqual(['addedKeywords', 'applicationId', 'message', 'resumeJson']);
    expect(res.json.message).toMatch(/not saved/);
    expect(res.json.resumeJson.basics.summary).toBe('Tailored');
    expect(client.getGeneratedResume).not.toHaveBeenCalled();
  });

  test('with a PDF: generatedResumeId, filename and downloadUrl', async () => {
    const client = mockClient();
    client.generateResumeForJob.mockResolvedValue(WITH_PDF);
    client.getGeneratedResume.mockResolvedValue({ resumeFileName: 'Acme_Data_Engineer.pdf', url: 'https://s3.example.com/short' });
    const mcp = await connect(client);
    const res = await callTool(mcp, 'generate_resume_for_job', { applicationId: 'a1', generatePdf: true });
    expect(client.generateResumeForJob).toHaveBeenCalledWith('a1', expect.objectContaining({ generatePdf: true }));
    expect(client.getGeneratedResume).toHaveBeenCalledWith('g1');
    expect(res.json).toMatchObject({ applicationId: 'a1', generatedResumeId: 'g1', filename: 'Acme_Data_Engineer.pdf', downloadUrl: WITH_PDF.pdfUrl, pdfUrl: WITH_PDF.pdfUrl, addedKeywords: ['Java'] });
  });

  test('with a PDF: the filename lookup failing does not fail the call', async () => {
    const client = mockClient();
    client.generateResumeForJob.mockResolvedValue(WITH_PDF);
    client.getGeneratedResume.mockRejectedValue(new Error('boom'));
    const mcp = await connect(client);
    const res = await callTool(mcp, 'generate_resume_for_job', { applicationId: 'a1', generatePdf: true });
    expect(res.isError).toBe(false);
    expect(res.json.generatedResumeId).toBe('g1');
    expect(res.json.downloadUrl).toBe(WITH_PDF.pdfUrl);
    expect(res.json.filename).toBeUndefined();
  });

  test('PDF asked for but not made: says so', async () => {
    const client = mockClient();
    client.generateResumeForJob.mockResolvedValue(JSON_ONLY);
    const mcp = await connect(client);
    const res = await callTool(mcp, 'generate_resume_for_job', { applicationId: 'a1', generatePdf: true });
    expect(res.json.message).toMatch(/PDF could not be made/);
    expect(res.json.generatedResumeId).toBeUndefined();
  });

  test('schema: no required ids, jobId/jobHuntId exposed, description covers tailoring asks', async () => {
    const mcp = await connect(mockClient());
    const tool = await toolSchema(mcp, 'generate_resume_for_job');
    expect(tool.inputSchema.required || []).toEqual([]);
    expect(Object.keys(tool.inputSchema.properties).sort()).toEqual(['applicationId', 'generatePdf', 'jobHuntId', 'jobId', 'keywords', 'modifications', 'sections']);
    expect(tool.description).toMatch(/tailor/i);
    expect(tool.description).toMatch(/base resume/);
    expect(tool.description).toMatch(/no credits/);
  });
});
