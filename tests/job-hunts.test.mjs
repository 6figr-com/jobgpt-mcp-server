import { mockClient, connect, callTool, toolSchema } from './helpers.mjs';

const HUNT = { id: 'h1', name: 'Hunt', status: 'ACTIVE', autoMode: false, config: { titles: ['Engineer'] } };
const LIST = { jobHunts: [HUNT], autoApplyQuota: 10, autoApplyQuotaRemaining: 7 };

describe('list_job_hunts', () => {
  test('default call sends only page and limit', async () => {
    const client = mockClient();
    client.listJobHunts.mockResolvedValue(LIST);
    const mcp = await connect(client);
    const res = await callTool(mcp, 'list_job_hunts', {});
    expect(client.listJobHunts).toHaveBeenCalledWith({ page: 1, limit: 20 });
    expect(res.json.count).toBe(1);
    expect(res.json.credits).toBe(10);
    expect(res.json.creditsRemaining).toBe(7);
    expect(res.json.note).toBeUndefined();
  });

  test('passes status and includeStats and returns stats and total count', async () => {
    const client = mockClient();
    const stats = { matched: 4, applications: 2, byStatus: { MATCHED: 4, APPLIED: 2 } };
    client.listJobHunts.mockResolvedValue({ ...LIST, count: 31, jobHunts: [{ ...HUNT, status: 'ARCHIVED', stats }] });
    const mcp = await connect(client);
    const res = await callTool(mcp, 'list_job_hunts', { status: 'ALL', includeStats: true, page: 2, limit: 5 });
    expect(client.listJobHunts).toHaveBeenCalledWith({ page: 2, limit: 5, status: 'ALL', includeStats: true });
    expect(res.json.count).toBe(31);
    expect(res.json.jobHunts[0].stats).toEqual(stats);
  });

  test('falls back to a plain call when the server rejects the new params', async () => {
    const client = mockClient();
    client.listJobHunts
      .mockRejectedValueOnce(new Error('API Error (400): "status" is not allowed'))
      .mockResolvedValueOnce(LIST);
    const mcp = await connect(client);
    const res = await callTool(mcp, 'list_job_hunts', { status: 'ARCHIVED' });
    expect(client.listJobHunts).toHaveBeenNthCalledWith(1, { page: 1, limit: 20, status: 'ARCHIVED' });
    expect(client.listJobHunts).toHaveBeenNthCalledWith(2, { page: 1, limit: 20 });
    expect(res.isError).toBe(false);
    expect(res.json.note).toMatch(/does not support status or includeStats/);
  });

  test('does not swallow other errors', async () => {
    const client = mockClient();
    client.listJobHunts.mockRejectedValue(new Error('API Error (500): boom'));
    const mcp = await connect(client);
    const res = await callTool(mcp, 'list_job_hunts', { includeStats: true });
    expect(res.isError).toBe(true);
    expect(client.listJobHunts).toHaveBeenCalledTimes(1);
  });

  test('rejects unknown status values', async () => {
    const client = mockClient();
    const mcp = await connect(client);
    const res = await callTool(mcp, 'list_job_hunts', { status: 'DELETED' });
    expect(res.isError).toBe(true);
    expect(client.listJobHunts).not.toHaveBeenCalled();
  });
});

describe('job hunt config schemas', () => {
  test('create_job_hunt keeps workAuthorization instead of stripping it', async () => {
    const client = mockClient();
    client.createJobHunt.mockResolvedValue(HUNT);
    const mcp = await connect(client);
    await callTool(mcp, 'create_job_hunt', { name: 'H1B hunt', config: { titles: ['Engineer'], workAuthorization: ['h1b'], h1bSponsorship: true } });
    expect(client.createJobHunt.mock.calls[0][0].config).toEqual({ titles: ['Engineer'], workAuthorization: ['h1b'], h1bSponsorship: true });
  });

  test('update_job_hunt sends partial config with explicit empty values', async () => {
    const client = mockClient();
    client.updateJobHunt.mockResolvedValue(undefined);
    client.getJobHunt.mockResolvedValue(HUNT);
    const mcp = await connect(client);
    const config = { workAuthorization: [], h1bSponsorship: false, companies: [], relevancy: null, dateOffset: null, baseSalaryMin: null };
    const res = await callTool(mcp, 'update_job_hunt', { id: 'h1', config });
    expect(res.isError).toBe(false);
    expect(client.updateJobHunt).toHaveBeenCalledWith('h1', { config });
  });

  test('both schemas expose workAuthorization and describe the merge', async () => {
    const mcp = await connect(mockClient());
    const create = await toolSchema(mcp, 'create_job_hunt');
    const update = await toolSchema(mcp, 'update_job_hunt');
    expect(create.inputSchema.properties.config.properties.workAuthorization).toBeDefined();
    expect(update.inputSchema.properties.config.properties.workAuthorization).toBeDefined();
    expect(update.description).toMatch(/merged/);
    expect(update.description).not.toMatch(/REPLACES/);
    expect(update.inputSchema.properties.config.description).toMatch(/MERGED/);
    expect(create.inputSchema.required).toContain('config');
    expect(create.inputSchema.properties.config.required).toContain('titles');
  });

  test('search_jobs passes workAuthorization through', async () => {
    const client = mockClient();
    client.searchJobs.mockResolvedValue({ jobs: [], count: 0 });
    const mcp = await connect(client);
    await callTool(mcp, 'search_jobs', { titles: ['Engineer'], workAuthorization: ['h1b'] });
    expect(client.searchJobs.mock.calls[0][0].filters).toEqual({ titles: ['Engineer'], workAuthorization: ['h1b'] });
  });
});
