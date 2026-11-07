import { mockClient, connect, callTool, toolSchema } from './helpers.mjs';

const OUTREACH = { id: 'o1', contactName: 'Pat', contactEmail: 'pat@example.com', subject: 'Hi', status: 'SENT' };
const BASE = { contactId: 'c1', subject: 'Hi', body: 'Hello' };

describe('send_outreach', () => {
  test('applicationId path is unchanged and passes the slot', async () => {
    const client = mockClient();
    client.createOutreach.mockResolvedValue(OUTREACH);
    const mcp = await connect(client);
    const res = await callTool(mcp, 'send_outreach', { ...BASE, applicationId: 'a1', slot: 'hiring_manager' });
    expect(client.createOutreach).toHaveBeenCalledWith('a1', 'c1', 'Hi', 'Hello', 'hiring_manager');
    expect(client.addJobToApplications).not.toHaveBeenCalled();
    expect(res.json.applicationId).toBe('a1');
    expect(res.json.outreach.id).toBe('o1');
  });

  test('jobId + jobHuntId adds the job to applications, then sends', async () => {
    const client = mockClient();
    client.addJobToApplications.mockResolvedValue({ id: 'a2' });
    client.createOutreach.mockResolvedValue(OUTREACH);
    const mcp = await connect(client);
    const res = await callTool(mcp, 'send_outreach', { ...BASE, jobId: 'j1', jobHuntId: 'h9', slot: 'recruiter' });
    expect(client.listJobHunts).not.toHaveBeenCalled();
    expect(client.addJobToApplications).toHaveBeenCalledWith('j1', 'h9');
    expect(client.createOutreach).toHaveBeenCalledWith('a2', 'c1', 'Hi', 'Hello', 'recruiter');
    expect(res.json.applicationId).toBe('a2');
  });

  test('jobId without jobHuntId uses the most recent active hunt', async () => {
    const client = mockClient();
    client.listJobHunts.mockResolvedValue({ jobHunts: [{ id: 'hRecent' }, { id: 'hOld' }], autoApplyQuota: 0, autoApplyQuotaRemaining: 0 });
    client.addJobToApplications.mockResolvedValue({ id: 'a3' });
    client.createOutreach.mockResolvedValue(OUTREACH);
    const mcp = await connect(client);
    await callTool(mcp, 'send_outreach', { ...BASE, jobId: 'j1' });
    expect(client.listJobHunts).toHaveBeenCalledWith({ page: 1, limit: 1 });
    expect(client.addJobToApplications).toHaveBeenCalledWith('j1', 'hRecent');
    expect(client.createOutreach).toHaveBeenCalledWith('a3', 'c1', 'Hi', 'Hello', undefined);
  });

  test('jobId with no job hunt fails before sending', async () => {
    const client = mockClient();
    client.listJobHunts.mockResolvedValue({ jobHunts: [], autoApplyQuota: 0, autoApplyQuotaRemaining: 0 });
    const mcp = await connect(client);
    const res = await callTool(mcp, 'send_outreach', { ...BASE, jobId: 'j1' });
    expect(res.isError).toBe(true);
    expect(res.text).toMatch(/create_job_hunt/);
    expect(client.createOutreach).not.toHaveBeenCalled();
  });

  test('needs exactly one of applicationId and jobId', async () => {
    const client = mockClient();
    const mcp = await connect(client);
    const neither = await callTool(mcp, 'send_outreach', BASE);
    const both = await callTool(mcp, 'send_outreach', { ...BASE, applicationId: 'a1', jobId: 'j1' });
    expect(neither.isError).toBe(true);
    expect(both.isError).toBe(true);
    expect(client.createOutreach).not.toHaveBeenCalled();
    expect(client.addJobToApplications).not.toHaveBeenCalled();
  });

  test('schema keeps contactId/subject/body required and applicationId optional', async () => {
    const mcp = await connect(mockClient());
    const tool = await toolSchema(mcp, 'send_outreach');
    expect(tool.inputSchema.required.sort()).toEqual(['body', 'contactId', 'subject']);
    expect(Object.keys(tool.inputSchema.properties)).toEqual(expect.arrayContaining(['applicationId', 'jobId', 'jobHuntId', 'slot']));
  });
});
