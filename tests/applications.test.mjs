import { mockClient, connect, callTool, toolSchema } from './helpers.mjs';

const APPS = [
  { id: 'a1', title: 'Data Engineer', company: { name: 'Anthropic' }, status: 'MATCHED' },
  { id: 'a2', title: 'Senior Data Engineer', company: { name: 'Stripe' }, status: 'APPLIED' },
  { id: 'a3', title: 'Product Manager', company: 'Anthropic Labs', status: 'MATCHED' },
  { id: 'a4', title: 'Backend Engineer (C++)', company: { name: 'Acme' }, status: 'MATCHED' },
];

describe('list_applications', () => {
  test('default call sends no search', async () => {
    const client = mockClient();
    client.listApplications.mockResolvedValue({ applications: APPS, count: 40 });
    const mcp = await connect(client);
    const res = await callTool(mcp, 'list_applications', {});
    expect(client.listApplications).toHaveBeenCalledWith({ jobHuntId: undefined, status: undefined, page: 1, limit: 20 });
    expect(res.json.count).toBe(40);
    expect(res.json.applications).toHaveLength(4);
    expect(res.json.note).toBeUndefined();
  });

  test('passes a trimmed search through with the other filters', async () => {
    const client = mockClient();
    client.listApplications.mockResolvedValue({ applications: [APPS[0]], count: 1 });
    const mcp = await connect(client);
    const res = await callTool(mcp, 'list_applications', { search: '  anthropic ', status: 'MATCHED', jobHuntId: 'h1', page: 2, limit: 5 });
    expect(client.listApplications).toHaveBeenCalledTimes(1);
    expect(client.listApplications).toHaveBeenCalledWith({ jobHuntId: 'h1', status: 'MATCHED', page: 2, limit: 5, search: 'anthropic' });
    expect(res.json.count).toBe(1);
    expect(res.json.note).toBeUndefined();
  });

  test('a blank search behaves like no search', async () => {
    const client = mockClient();
    client.listApplications.mockResolvedValue({ applications: APPS, count: 4 });
    const mcp = await connect(client);
    await callTool(mcp, 'list_applications', { search: '   ' });
    expect(client.listApplications).toHaveBeenCalledWith({ jobHuntId: undefined, status: undefined, page: 1, limit: 20 });
  });

  test('falls back to filtering the page client-side when the server rejects search', async () => {
    const client = mockClient();
    client.listApplications
      .mockRejectedValueOnce(new Error('API Error (400): child "search" fails because ["search" is not allowed]'))
      .mockResolvedValueOnce({ applications: APPS, count: 120 });
    const mcp = await connect(client);
    const res = await callTool(mcp, 'list_applications', { search: 'ANTHROPIC', status: 'MATCHED' });
    expect(client.listApplications).toHaveBeenNthCalledWith(1, { jobHuntId: undefined, status: 'MATCHED', page: 1, limit: 20, search: 'ANTHROPIC' });
    expect(client.listApplications).toHaveBeenNthCalledWith(2, { jobHuntId: undefined, status: 'MATCHED', page: 1, limit: 20 });
    expect(res.isError).toBe(false);
    expect(res.json.applications.map(a => a.id)).toEqual(['a1', 'a3']);
    expect(res.json.count).toBe(2);
    expect(res.json.note).toMatch(/does not support search/);
    expect(res.json.note).toMatch(/4 of 120/);
  });

  test('fallback matches titles and treats special characters literally', async () => {
    const client = mockClient();
    client.listApplications
      .mockRejectedValueOnce(new Error('API Error (400): "search" is not allowed'))
      .mockResolvedValueOnce({ applications: APPS, count: 4 });
    const mcp = await connect(client);
    const res = await callTool(mcp, 'list_applications', { search: 'c++' });
    expect(res.json.applications.map(a => a.id)).toEqual(['a4']);
  });

  test('does not swallow other errors', async () => {
    const client = mockClient();
    client.listApplications.mockRejectedValue(new Error('API Error (500): boom'));
    const mcp = await connect(client);
    const res = await callTool(mcp, 'list_applications', { search: 'anthropic' });
    expect(res.isError).toBe(true);
    expect(client.listApplications).toHaveBeenCalledTimes(1);
  });

  test('schema exposes search with a description', async () => {
    const mcp = await connect(mockClient());
    const tool = await toolSchema(mcp, 'list_applications');
    expect(tool.inputSchema.properties.search.description).toMatch(/company name or job title/);
    expect(tool.inputSchema.properties.search.maxLength).toBe(100);
  });
});

describe('JobGPTApiClient.listApplications', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  async function queryFor(params) {
    const { JobGPTApiClient } = await import('../dist/api-client.js');
    let calledUrl = '';
    globalThis.fetch = async (url) => {
      calledUrl = String(url);
      return new Response(JSON.stringify({ success: true, data: { jobs: [], count: 0 } }), { status: 200 });
    };
    const client = new JobGPTApiClient({ apiKey: 'test', apiUrl: 'https://example.test', debug: false });
    await client.listApplications(params);
    return new URL(calledUrl).searchParams;
  }

  test('only sends search when set', async () => {
    const plain = await queryFor({ page: 1, limit: 20 });
    expect([...plain.keys()].sort()).toEqual(['limit', 'page']);
    const searched = await queryFor({ page: 1, limit: 20, search: 'c++ (x)' });
    expect(searched.get('search')).toBe('c++ (x)');
  });
});
