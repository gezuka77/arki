const express = require("express");

const path = require("path");
const fs = require("fs");

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)
  throw new Error("Set JWT_SECRET to at least 32 random characters");
if (!process.env.SETUP_TOKEN || process.env.SETUP_TOKEN.length < 24)
  throw new Error("Set SETUP_TOKEN to at least 24 random characters");

// Initialize database
const db = require("./db");

// Import routes
const authRoutes = require("./routes/auth");
const expenseRoutes = require("./routes/expenses");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.disable("x-powered-by");
if (process.env.TRUST_PROXY === "1") app.set("trust proxy", 1);
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("X-Frame-Options", "DENY");
  next();
});
app.use(express.json());

// API Routes
app.use("/api", require("./routes/household"));
app.use("/api/auth", authRoutes);
app.use("/api/expenses", expenseRoutes);
app.use("/api/places", require("./routes/places"));
app.use("/api/budgets", require("./routes/budgets"));
app.use("/api", (req, res) =>
  res.status(404).json({ error: "Endpoint not found" }),
);
app.use((err, req, res, next) => {
  const status = [400, 409].includes(err.status) ? err.status : 500;
  if (status === 500) console.error("Request failed");
  res
    .status(status)
    .json({ error: status === 500 ? "Server error" : err.message });
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// Serve static frontend files
const publicPath = path.join(__dirname, "public");
if (fs.existsSync(publicPath)) {
  app.use(express.static(publicPath));

  // Missing versioned files must not be served as HTML.
  app.use("/assets", (req, res) =>
    res
      .status(404)
      .set("Cache-Control", "no-store")
      .type("text")
      .send("Asset not found. Reopen the app to load the latest version."),
  );

  // SPA fallback
  app.get("/{*splat}", (req, res) => {
    res
      .set("Cache-Control", "no-cache")
      .sendFile(path.join(publicPath, "index.html"));
  });
} else {
  app.get("/{*splat}", (req, res) => {
    res.json({
      message:
        "Frontend not built yet. Run in development mode or build frontend first.",
    });
  });
}

// Ensure data directory exists
const dataDir = path.join(__dirname, "data");
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port ${PORT}`);
  require("./place-service").startRefresh();
});
