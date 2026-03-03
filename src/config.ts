import * as dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

export interface Config {
  apiKey: string;
  apiUrl: string;
  debug: boolean;
}

export function loadConfig(): Config {
  const apiKey = process.env.JOBGPT_API_KEY;

  if (!apiKey) {
    throw new Error(
      'JOBGPT_API_KEY environment variable is required.\n' +
      'Get your API key from https://6figr.com/account (MCP Integrations section)'
    );
  }

  return {
    apiKey,
    apiUrl: process.env.JOBGPT_API_URL || 'https://6figr.com',
    debug: process.env.DEBUG === 'true',
  };
}

export function log(message: string, ...args: unknown[]): void {
  if (process.env.DEBUG === 'true') {
    console.error(`[JobGPT MCP] ${message}`, ...args);
  }
}
