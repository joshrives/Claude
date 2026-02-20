// Mock data layer for team members and their Claude Code usage.
// Replace this with real data sources (API calls, database queries, etc.) as needed.

const teamMembers = [
  { id: 1, name: "Josh Rives", avatar: "JR" },
  { id: 2, name: "Sarah Chen", avatar: "SC" },
  { id: 3, name: "Marcus Johnson", avatar: "MJ" },
  { id: 4, name: "Emily Park", avatar: "EP" },
  { id: 5, name: "David Kim", avatar: "DK" },
  { id: 6, name: "Lisa Thompson", avatar: "LT" },
];

// Simulated usage data
const usageData = new Map();

function initializeUsageData() {
  for (const member of teamMembers) {
    usageData.set(member.id, {
      linesToday: randomInt(0, 800),
      linesThisWeek: randomInt(500, 5000),
      linesAllTime: randomInt(10000, 120000),
      active: Math.random() > 0.5,
      lastSeen: new Date(),
    });
  }
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Simulate live activity: periodically update a random member's stats
function simulateLiveUpdates(onChange) {
  setInterval(() => {
    const member = teamMembers[randomInt(0, teamMembers.length - 1)];
    const data = usageData.get(member.id);

    // Randomly toggle active status
    if (Math.random() > 0.7) {
      data.active = !data.active;
    }

    // If active, accumulate lines
    if (data.active) {
      const newLines = randomInt(1, 25);
      data.linesToday += newLines;
      data.linesThisWeek += newLines;
      data.linesAllTime += newLines;
      data.lastSeen = new Date();
    }

    usageData.set(member.id, data);
    onChange(getSnapshot());
  }, 3000);
}

function getSnapshot() {
  return teamMembers.map((member) => ({
    ...member,
    ...usageData.get(member.id),
  }));
}

initializeUsageData();

module.exports = { getSnapshot, simulateLiveUpdates };
