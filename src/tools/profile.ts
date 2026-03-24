import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { JobGPTApiClient } from '../api-client.js';

export function registerProfileTools(server: McpServer, client: JobGPTApiClient) {
  server.tool(
    'get_currencies',
    'Get the list of supported currencies with their codes, symbols, and units. Use this to look up the correct currency code before updating salary.',
    {},
    async () => {
      const currencies = await client.getCurrencies();
      return { content: [{ type: 'text' as const, text: JSON.stringify(currencies, null, 2) }] };
    }
  );

  server.tool(
    'get_profile',
    'Get your user profile including personal info, skills, experience, and work history',
    {},
    async () => {
      const profile = await client.getProfile();
      const result = {
        id: profile.id,
        email: profile.email,
        name: profile.fullName,
        headline: profile.headline,
        location: profile.location,
        yearsOfExperience: profile.experience,
        skills: profile.skills,
        hasResume: !!profile.resumeFileName,
        resumeFileName: profile.resumeFileName,
        workHistory: (profile.company || []).map(c => ({
          company: c.name,
          title: c.title,
          startDate: c.start,
          endDate: c.end,
          current: c.current,
          location: c.location,
        })),
        education: (profile.school || []).map(s => ({
          school: s.name,
          degree: s.degree,
          fieldOfStudy: s.specialization,
          graduationYear: s.year,
        })),
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'get_salary',
    'Get your current salary/compensation details including base, stocks, bonus, and total compensation. IMPORTANT: For INR (currency code 2), values are in lakhs (e.g., 20 = 20 lakhs = 20,00,000 INR). For all other currencies (USD, etc.), values are in thousands (e.g., 400 = 400K = $400,000).',
    {},
    async () => {
      const salary = await client.getProfileSalary();
      const isINR = salary.currency === 2;
      const unit = isINR ? 'lakhs' : 'K';
      const formatValue = (val: number | undefined) => val !== undefined ? `${val} ${unit}` : undefined;
      const result = {
        ...salary,
        unit,
        currencyNote: isINR
          ? 'Values are in lakhs (e.g., 20 = 20,00,000 INR)'
          : 'Values are in thousands (e.g., 400 = $400,000)',
        formatted: {
          base: formatValue(salary.base),
          stocks: formatValue(salary.stocks),
          bonus: formatValue(salary.bonus),
          signingBonus: formatValue(salary.signingBonus),
          targetSalary: formatValue(salary.targetSalary),
          totalComp: formatValue(salary.salary),
        },
      };
      return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    'update_salary',
    'Update your salary/compensation details. IMPORTANT: For INR (currency code 2), pass values in lakhs (e.g., 20 for 20 lakhs). For all other currencies (USD, etc.), pass values in thousands (e.g., 400 for $400K). Use get_currencies to look up currency codes.',
    {
      currency: z.number().optional().describe('Currency code. Use get_currencies to look up valid codes (e.g., 2 = INR, 3 = USD)'),
      base: z.number().optional().describe('Base salary. For INR: in lakhs (e.g., 20 = 20 lakhs). For USD/others: in thousands (e.g., 400 = $400K)'),
      stocks: z.number().optional().describe('Annual stock/equity value. Same unit convention as base'),
      bonus: z.number().optional().describe('Annual bonus. Same unit convention as base'),
      signingBonus: z.number().optional().describe('Signing bonus. Same unit convention as base'),
      targetSalary: z.number().optional().describe('Target salary. Same unit convention as base'),
    },
    async (args) => {
      const salaryData: Record<string, unknown> = {};
      if (args.currency !== undefined) { salaryData.currency = args.currency; }
      if (args.base !== undefined) { salaryData.base = args.base; }
      if (args.stocks !== undefined) { salaryData.stocks = args.stocks; }
      if (args.bonus !== undefined) { salaryData.bonus = args.bonus; }
      if (args.signingBonus !== undefined) { salaryData.signingBonus = args.signingBonus; }
      if (args.targetSalary !== undefined) { salaryData.targetSalary = args.targetSalary; }
      await client.updateProfileSalary(salaryData);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ message: 'Salary updated successfully', updatedFields: Object.keys(salaryData) }, null, 2) }] };
    }
  );

  server.tool(
    'update_profile',
    'Update your user profile fields',
    {
      fullName: z.string().optional().describe('Your full name'),
      headline: z.string().optional().describe('Professional headline (e.g., "Senior Software Engineer at Google")'),
      location: z.string().optional().describe('Your location (e.g., "San Francisco, CA")'),
      skills: z.array(z.string()).optional().describe('List of skills (e.g., ["Python", "JavaScript", "AWS"])'),
      experience: z.number().optional().describe('Years of experience'),
    },
    async (args) => {
      const updateData: Record<string, unknown> = {};
      if (args.fullName !== undefined) { updateData.fullName = args.fullName; }
      if (args.headline !== undefined) { updateData.headline = args.headline; }
      if (args.location !== undefined) { updateData.location = args.location; }
      if (args.skills !== undefined) { updateData.skills = args.skills; }
      if (args.experience !== undefined) { updateData.experience = args.experience; }

      if (Object.keys(updateData).length === 0) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ message: 'No fields provided to update' }, null, 2) }] };
      }

      await client.updateProfile(updateData);
      return { content: [{ type: 'text' as const, text: JSON.stringify({ message: 'Profile updated successfully', updatedFields: Object.keys(updateData) }, null, 2) }] };
    }
  );
}
