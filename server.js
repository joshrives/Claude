const express = require("express");
const path = require("path");
const { getSnapshot, simulateLiveUpdates } = require("./data");

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

  // Send initial snapshot
  res.write(`data: ${JSON.stringify(getSnapshot())}\n\n`);

  clients.add(res);
  req.on("close", () => clients.delete(res));
});

// REST fallback
app.get("/api/team", (_req, res) => {
  res.json(getSnapshot());
});

// Broadcast updates to all SSE clients
simulateLiveUpdates((snapshot) => {
  const payload = `data: ${JSON.stringify(snapshot)}\n\n`;
  for (const client of clients) {
    client.write(payload);
  }
});

app.listen(PORT, () => {
  console.log(`Dashboard running at http://localhost:${PORT}`);
});
