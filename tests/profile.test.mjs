import { mockClient, connect, callTool } from './helpers.mjs';

describe('get_profile', () => {
  test('returns the fields update_profile sets', async () => {
    const client = mockClient();
    client.getProfile.mockResolvedValue({
      id: 'u1', email: 'a@b.c', fullName: 'A B', firstName: 'A', lastName: 'B', experience: 5,
      noticePeriodDays: 30, workPermitLocations: ['India', 'US'], immigrationSponsorshipRequired: false, openToRelocation: true,
      gender: 'F', ethnicity: 'asian',
    });
    const mcp = await connect(client);
    const res = await callTool(mcp, 'get_profile', {});
    expect(res.json).toMatchObject({
      firstName: 'A', lastName: 'B', noticePeriodDays: 30, workPermitLocations: ['India', 'US'],
      immigrationSponsorshipRequired: false, openToRelocation: true, gender: 'female', ethnicity: 'asian',
    });
  });

  test('unset fields come back as null / empty', async () => {
    const client = mockClient();
    client.getProfile.mockResolvedValue({ id: 'u1', email: 'a@b.c', fullName: 'A' });
    const mcp = await connect(client);
    const res = await callTool(mcp, 'get_profile', {});
    expect(res.json).toMatchObject({ noticePeriodDays: null, workPermitLocations: [], immigrationSponsorshipRequired: null, openToRelocation: null, gender: null, ethnicity: null });
  });
});
