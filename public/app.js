const tbody = document.getElementById("team-body");
const summaryBar = document.getElementById("summary-bar");
const connStatus = document.getElementById("connection-status");

let previousData = new Map();

function formatNumber(n) {
  return n.toLocaleString();
}

function renderSummary(members) {
  const activeCount = members.filter((m) => m.active).length;
  const totalToday = members.reduce((s, m) => s + m.linesToday, 0);
  const totalWeek = members.reduce((s, m) => s + m.linesThisWeek, 0);

  summaryBar.innerHTML = `
    <div class="summary-card">
      <div class="label">Active Now</div>
      <div class="value active-count">${activeCount} / ${members.length}</div>
    </div>
    <div class="summary-card">
      <div class="label">Team Lines Today</div>
      <div class="value">${formatNumber(totalToday)}</div>
    </div>
    <div class="summary-card">
      <div class="label">Team Lines This Week</div>
      <div class="value">${formatNumber(totalWeek)}</div>
    </div>
  `;
}

function renderTable(members) {
  // Sort: active members first, then by linesToday descending
  const sorted = [...members].sort((a, b) => {
    if (a.active !== b.active) return b.active - a.active;
    return b.linesToday - a.linesToday;
  });

  tbody.innerHTML = sorted
    .map((m) => {
      const prev = previousData.get(m.id);
      const todayChanged = prev && prev.linesToday !== m.linesToday;
      const weekChanged = prev && prev.linesThisWeek !== m.linesThisWeek;
      const allTimeChanged = prev && prev.linesAllTime !== m.linesAllTime;

      return `
      <tr>
        <td class="col-status" style="text-align:center">
          <span class="status-indicator ${m.active ? "active" : ""}"
                title="${m.active ? "Currently using Claude Code" : "Inactive"}"></span>
        </td>
        <td>
          <div class="member-name">
            <span class="avatar">${m.avatar}</span>
            <span>${m.name}</span>
          </div>
        </td>
        <td class="col-lines ${todayChanged ? "flash" : ""}">${formatNumber(m.linesToday)}</td>
        <td class="col-lines ${weekChanged ? "flash" : ""}">${formatNumber(m.linesThisWeek)}</td>
        <td class="col-lines ${allTimeChanged ? "flash" : ""}">${formatNumber(m.linesAllTime)}</td>
      </tr>`;
    })
    .join("");

  // Store current data for next diff
  previousData = new Map(members.map((m) => [m.id, { ...m }]));
}

function render(members) {
  renderSummary(members);
  renderTable(members);
}

// Connect via Server-Sent Events
function connect() {
  const es = new EventSource("/api/events");

  es.onopen = () => {
    connStatus.className = "connection-status connected";
    connStatus.querySelector(".label").textContent = "Live";
  };

  es.onmessage = (event) => {
    const members = JSON.parse(event.data);
    render(members);
  };

  es.onerror = () => {
    connStatus.className = "connection-status";
    connStatus.querySelector(".label").textContent = "Reconnecting...";
  };
}

connect();
