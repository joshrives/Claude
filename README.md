# Team Claude Code Dashboard

Live-updating dashboard showing your team's Claude Code usage metrics, powered by the [Claude Code Analytics API](https://platform.claude.com/docs/en/api/claude-code-analytics-api).

## Features

- **Active status indicator** — green dot for members with sessions today
- **Lines accepted** — broken down by today, this week, and all time
- **Live updates** — polls the API and pushes changes to the browser via Server-Sent Events
- **Summary cards** — team-wide active count, lines today, and lines this week

## Setup

1. **Get an Admin API key** from the [Anthropic Console](https://console.anthropic.com/settings/admin-keys) (requires admin role on a Team or Enterprise plan).

2. **Install and run:**

```bash
npm install
ANTHROPIC_ADMIN_API_KEY=sk-ant-admin-... npm start
```

3. Open **http://localhost:3000**.

## Configuration

Copy `.env.example` and set your values, or pass environment variables directly:

| Variable | Default | Description |
|---|---|---|
| `ANTHROPIC_ADMIN_API_KEY` | *(required)* | Admin API key (`sk-ant-admin...`) |
| `PORT` | `3000` | Server port |
| `POLL_INTERVAL_MS` | `300000` | API poll interval in ms (5 min) |
| `ALL_TIME_DAYS` | `90` | Number of days for the "All Time" column |

## How it works

The server polls `GET /v1/organizations/usage_report/claude_code` on the Anthropic Admin API, aggregates lines-of-code-added per user across three time windows (today, this week, all time), and streams snapshots to the browser over SSE. Names are derived from email addresses.

> **Note:** The Analytics API provides daily aggregated data with up to 1-hour delay. The "active" indicator reflects whether a member has recorded sessions today, not real-time presence. For true real-time monitoring, consider the [OpenTelemetry integration](https://code.claude.com/docs/en/monitoring-usage).
