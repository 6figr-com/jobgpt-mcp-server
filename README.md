# JobGPT MCP Server

The official [MCP server](https://modelcontextprotocol.io) for [JobGPT](https://6figr.com/jobgpt) — search jobs, auto-apply, manage resumes, and track applications directly from Claude, Cursor, Windsurf, and any MCP-compatible AI tool.

## What You Can Do

Ask your AI assistant things like:

- *"Find remote senior React jobs paying over $150k"*
- *"Auto-apply to the top 5 matches from my job hunt"*
- *"Generate a tailored resume for this Google application"*
- *"Show my application stats for the last 7 days"*
- *"Find recruiters for this job and draft an outreach email"*

The MCP server connects your AI assistant to the full JobGPT platform — 34 tools covering job search, applications, resumes, outreach, and more.

## Quick Start

### 1. Get Your API Key

1. Go to [6figr.com/account](https://6figr.com/account)
2. Scroll to **MCP Integrations**
3. Click **Generate API Key**
4. Copy the key (starts with `mcp_`)

### 2. Add to Your AI Tool

Pick your tool below and paste the config. Replace `your-api-key-here` with your actual key.

---

## Setup by Client

### Claude Desktop

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "jobgpt": {
      "command": "npx",
      "args": ["-y", "jobgpt-mcp-server"],
      "env": {
        "JOBGPT_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Claude Code (CLI)

Run this in your terminal:

```bash
claude mcp add jobgpt -e JOBGPT_API_KEY=your-api-key-here -- npx -y jobgpt-mcp-server
```

Or add manually to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "jobgpt": {
      "command": "npx",
      "args": ["-y", "jobgpt-mcp-server"],
      "env": {
        "JOBGPT_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Cursor

Go to **Settings** > **MCP** > **Add new MCP server**, or add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "jobgpt": {
      "command": "npx",
      "args": ["-y", "jobgpt-mcp-server"],
      "env": {
        "JOBGPT_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Windsurf

Go to **Settings** > **Cascade** > **MCP** > **Add Server** > **Add custom server**, or add to `~/.codeium/windsurf/mcp_config.json`:

```json
{
  "mcpServers": {
    "jobgpt": {
      "command": "npx",
      "args": ["-y", "jobgpt-mcp-server"],
      "env": {
        "JOBGPT_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Cline (VS Code)

Open the Cline MCP settings in VS Code and add:

```json
{
  "mcpServers": {
    "jobgpt": {
      "command": "npx",
      "args": ["-y", "jobgpt-mcp-server"],
      "env": {
        "JOBGPT_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

### Continue (VS Code / JetBrains)

Add to your Continue config (`~/.continue/config.yaml`):

```yaml
mcpServers:
  - name: jobgpt
    command: npx
    args: ["-y", "jobgpt-mcp-server"]
    env:
      JOBGPT_API_KEY: your-api-key-here
```

### Remote (Hosted) Mode

If you prefer not to run the server locally, you can connect to the hosted version using `mcp-remote`. This requires no local Node.js installation:

```json
{
  "mcpServers": {
    "jobgpt": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://jobgpt-mcp-server.cto-df7.workers.dev/mcp",
        "--header",
        "Authorization:Bearer your-api-key-here"
      ]
    }
  }
}
```

---

## Available Tools

### Job Search

| Tool | Description |
|------|-------------|
| `search_jobs` | Search jobs with filters — titles, locations, companies, skills, salary, remote, H1B sponsorship |
| `match_jobs` | Get new job matches from a saved job hunt (only unseen jobs) |
| `get_job` | Get full details of a specific job posting |

### Profile & Salary

| Tool | Description |
|------|-------------|
| `get_profile` | View your profile — skills, experience, work history, education |
| `update_profile` | Update name, headline, location, skills, experience |
| `get_salary` | Get your current compensation details |
| `update_salary` | Update base salary, stocks, bonus, target salary |
| `get_currencies` | List supported currencies (for salary updates) |
| `get_credits` | Check your remaining credits balance |

### Job Hunts

| Tool | Description |
|------|-------------|
| `list_job_hunts` | List your saved job hunts with credits balance |
| `create_job_hunt` | Create a new job hunt with search filters and auto-apply settings |
| `get_job_hunt` | Get details of a specific job hunt |
| `update_job_hunt` | Update filters, auto-apply mode, daily limits, status |

### Applications

| Tool | Description |
|------|-------------|
| `get_application_stats` | Aggregated stats — counts by status, auto-apply metrics |
| `list_applications` | List applications filtered by job hunt or status |
| `get_application` | Get full application details |
| `update_application` | Update status or notes |
| `apply_to_job` | Trigger auto-apply for an application |
| `add_job_to_applications` | Save a job from search results to your applications |
| `import_job_by_url` | Import a job from any URL (LinkedIn, Greenhouse, Lever, Workday, etc.) |

### Resume

| Tool | Description |
|------|-------------|
| `list_resumes` | List your uploaded resumes |
| `get_resume` | Get resume details and download URL |
| `delete_resume` | Delete an alternate resume |
| `upload_resume` | Upload a resume from URL (PDF, DOC, DOCX) |
| `list_generated_resumes` | List AI-tailored resumes created for applications |
| `get_generated_resume` | Get a generated resume's download URL |
| `generate_resume_for_job` | Generate an AI-optimized resume for a specific application |
| `calculate_match_score` | Calculate resume-to-job match score with skill analysis |

### Outreach

| Tool | Description |
|------|-------------|
| `get_job_recruiters` | Find recruiters associated with a job |
| `get_job_referrers` | Find potential referrers at a company |
| `get_application_recruiters` | Get recruiters for a saved application |
| `get_application_referrers` | Find referrers for a saved application |
| `list_outreaches` | List your sent outreach emails |
| `send_outreach` | Send an outreach email to a recruiter or referrer |

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `JOBGPT_API_KEY` | Yes | — | Your API key from [6figr.com/account](https://6figr.com/account) |
| `JOBGPT_API_URL` | No | `https://6figr.com` | API base URL |
| `DEBUG` | No | `false` | Enable debug logging to stderr |

## Troubleshooting

### "JOBGPT_API_KEY environment variable is required"

Your API key isn't being passed to the server. Make sure it's in the `env` block of your MCP config.

### Tool calls failing with "API Error (401)"

Your API key is invalid or expired. Generate a new one at [6figr.com/account](https://6figr.com/account).

### "You have run out of credits"

Some operations (auto-apply, resume generation) consume credits. Purchase more at [6figr.com/jobgpt](https://6figr.com/jobgpt?addCreditsPopup=true).

### Server not appearing in your AI tool

1. Make sure Node.js 18+ is installed (`node --version`)
2. Restart your AI tool after editing the config file
3. Try running manually to check for errors: `JOBGPT_API_KEY=your-key npx jobgpt-mcp-server`

### Debug mode

Add `"DEBUG": "true"` to your env config to see detailed API request/response logs in stderr.

## Development

```bash
git clone https://github.com/6figr/jobgpt-mcp-server.git
cd jobgpt-mcp-server
npm install
cp .env.example .env   # add your API key

npm run dev:local       # run stdio server locally
npm run build           # compile TypeScript
npm run dev:worker      # run Cloudflare Worker locally
npm run deploy          # deploy to Cloudflare Workers
```

### Testing with MCP Inspector

```bash
npx @modelcontextprotocol/inspector
```

## License

MIT

## Links

- [JobGPT](https://6figr.com/jobgpt) — AI-powered job search platform
- [Get API Key](https://6figr.com/account) — Generate your MCP API key
- [GitHub Issues](https://github.com/6figr/jobgpt-mcp-server/issues) — Report bugs or request features
