const express = require("express");
const path = require("path");
const { getSnapshot, startPolling } = require("./data");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, "public")));

// SSE endpoint for live updates
const clients = new Set();

app.get("/api/events", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Send current snapshot immediately
  const snapshot = getSnapshot();
  if (snapshot.length > 0) {
    res.write(`data: ${JSON.stringify(snapshot)}\n\n`);
  }

  clients.add(res);
  req.on("close", () => clients.delete(res));
});

// REST fallback
app.get("/api/team", (_req, res) => {
  res.json(getSnapshot());
});

// Broadcast to all SSE clients whenever data refreshes
function broadcast(snapshot) {
  const payload = `data: ${JSON.stringify(snapshot)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
}

// Start polling the Anthropic Admin API and broadcast on each refresh
startPolling(broadcast);

app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
