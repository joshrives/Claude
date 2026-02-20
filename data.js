// Fetches team Claude Code usage from the Anthropic Admin API.
// Requires ANTHROPIC_ADMIN_API_KEY (sk-ant-admin...) environment variable.

const https = require("https");

const API_BASE = "https://api.anthropic.com";
const API_PATH = "/v1/organizations/usage_report/claude_code";
const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "300000", 10); // 5 min default
const ALL_TIME_DAYS = parseInt(process.env.ALL_TIME_DAYS || "90", 10);

let latestSnapshot = [];

// ── helpers ──────────────────────────────────────────────────────────────────

function getApiKey() {
  const key = process.env.ANTHROPIC_ADMIN_API_KEY;
  if (!key) {
    throw new Error(
      "ANTHROPIC_ADMIN_API_KEY is required. " +
        "Generate one at https://console.anthropic.com/settings/admin-keys"
    );
  }
  return key;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10); // YYYY-MM-DD
}

function todayUTC() {
  return new Date(new Date().toISOString().slice(0, 10));
}

function startOfWeekUTC() {
  const d = todayUTC();
  const day = d.getUTCDay(); // 0 = Sunday
  d.setUTCDate(d.getUTCDate() - (day === 0 ? 6 : day - 1)); // Monday
  return d;
}

function daysAgoUTC(n) {
  const d = todayUTC();
  d.setUTCDate(d.getUTCDate() - n);
  return d;
}

function nameFromEmail(email) {
  const local = email.split("@")[0];
  return local
    .replace(/[._+]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function initialsFromName(name) {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ── API fetch with pagination ────────────────────────────────────────────────

function fetchPage(date, page) {
  return new Promise((resolve, reject) => {
    const params = new URLSearchParams({
      starting_at: formatDate(date),
      limit: "1000",
    });
    if (page) params.set("page", page);

    const url = `${API_PATH}?${params}`;
    const options = {
      hostname: "api.anthropic.com",
      path: url,
      method: "GET",
      headers: {
        "x-api-key": getApiKey(),
        "anthropic-version": "2023-06-01",
        "User-Agent": "TeamCodeDashboard/1.0.0",
      },
    };

    const req = https.request(options, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode !== 200) {
          reject(new Error(`API ${res.statusCode}: ${body}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Invalid JSON: ${e.message}`));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

async function fetchDay(date) {
  const records = [];
  let page = null;
  do {
    const res = await fetchPage(date, page);
    records.push(...res.data);
    page = res.has_more ? res.next_page : null;
  } while (page);
  return records;
}

async function fetchDateRange(startDate, endDate) {
  const records = [];
  const d = new Date(startDate);
  while (d <= endDate) {
    try {
      const dayRecords = await fetchDay(new Date(d));
      records.push(...dayRecords);
    } catch (err) {
      console.error(`Warning: failed to fetch ${formatDate(d)}: ${err.message}`);
    }
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return records;
}

// ── aggregation ──────────────────────────────────────────────────────────────

function aggregateByUser(records) {
  const map = new Map();
  for (const rec of records) {
    const actor = rec.actor;
    const email =
      actor.type === "user_actor"
        ? actor.email_address
        : actor.api_key_name || "unknown";

    if (!map.has(email)) {
      map.set(email, { added: 0, removed: 0, sessions: 0 });
    }
    const agg = map.get(email);
    agg.added += rec.core_metrics.lines_of_code.added;
    agg.removed += rec.core_metrics.lines_of_code.removed;
    agg.sessions += rec.core_metrics.num_sessions;
  }
  return map;
}

// ── build snapshot ───────────────────────────────────────────────────────────

async function buildSnapshot() {
  const today = todayUTC();
  const weekStart = startOfWeekUTC();
  const allTimeStart = daysAgoUTC(ALL_TIME_DAYS);

  console.log(
    `Fetching analytics: today=${formatDate(today)}, ` +
      `weekStart=${formatDate(weekStart)}, ` +
      `allTimeStart=${formatDate(allTimeStart)}`
  );

  // Fetch all three ranges (all-time includes the others so we can optimize)
  const allTimeRecords = await fetchDateRange(allTimeStart, today);

  // Split records by date range
  const todayStr = formatDate(today);
  const weekStartStr = formatDate(weekStart);

  const todayRecords = allTimeRecords.filter((r) => r.date.startsWith(todayStr));
  const weekRecords = allTimeRecords.filter((r) => r.date >= weekStartStr);

  const todayByUser = aggregateByUser(todayRecords);
  const weekByUser = aggregateByUser(weekRecords);
  const allTimeByUser = aggregateByUser(allTimeRecords);

  // Build member list from all known emails
  const allEmails = new Set(allTimeByUser.keys());
  const members = [];
  let id = 0;

  for (const email of allEmails) {
    const name = nameFromEmail(email);
    const todayData = todayByUser.get(email) || { added: 0, sessions: 0 };
    const weekData = weekByUser.get(email) || { added: 0, sessions: 0 };
    const allTimeData = allTimeByUser.get(email) || { added: 0, sessions: 0 };

    members.push({
      id: ++id,
      email,
      name,
      avatar: initialsFromName(name),
      active: todayData.sessions > 0,
      linesToday: todayData.added,
      linesThisWeek: weekData.added,
      linesAllTime: allTimeData.added,
    });
  }

  return members;
}

// ── polling loop ─────────────────────────────────────────────────────────────

function startPolling(onChange) {
  async function poll() {
    try {
      latestSnapshot = await buildSnapshot();
      console.log(
        `Updated: ${latestSnapshot.length} members, ` +
          `${latestSnapshot.filter((m) => m.active).length} active today`
      );
      if (onChange) onChange(latestSnapshot);
    } catch (err) {
      console.error("Poll error:", err.message);
    }
  }

  // Initial fetch
  poll();

  // Re-fetch on interval
  setInterval(poll, POLL_INTERVAL_MS);
}

function getSnapshot() {
  return latestSnapshot;
}

module.exports = { getSnapshot, startPolling };
