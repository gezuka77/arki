const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../db");
const createRateLimit = require("../rate-limit");
const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error("JWT_SECRET must be configured");
const loginLimit = createRateLimit();
const passwordLimit = createRateLimit({ limit: 10 });
const dummyHash = bcrypt.hashSync("invalid-account-placeholder", 12);

router.post("/login", loginLimit, async (req, res, next) => {
  const { username, password } = req.body;
  if (
    typeof username !== "string" ||
    typeof password !== "string" ||
    !username ||
    !password ||
    username.length > 200 ||
    Buffer.byteLength(password) > 72
  ) {
    return res
      .status(400)
      .json({
        error: "Username and password required (password maximum 72 bytes)",
      });
  }
  try {
    const user = db
      .prepare("SELECT * FROM users WHERE username = ?")
      .get(username);
    const valid = await bcrypt.compare(
      password,
      user ? user.password : dummyHash,
    );
    if (!user || !user.active || !valid)
      return res.status(401).json({ error: "Invalid credentials" });
    const token = jwt.sign(
      {
        userId: user.id,
        username: user.username,
        authVersion: user.auth_version,
      },
      JWT_SECRET,
      { expiresIn: "24h" },
    );
    res.json({ token, username: user.username });
  } catch (err) {
    next(err);
  }
});

function verifyToken(req, res, next) {
  const match = /^Bearer (\S+)$/.exec(req.headers.authorization || "");
  if (!match) return res.status(401).json({ error: "Please sign in" });
  try {
    const decoded = jwt.verify(match[1], JWT_SECRET, { algorithms: ["HS256"] });
    const user = db
      .prepare(
        "SELECT id, username, auth_version, role, active FROM users WHERE id = ?",
      )
      .get(decoded.userId);
    if (
      !user ||
      !user.active ||
      user.auth_version !== (decoded.authVersion ?? 0)
    )
      return res
        .status(401)
        .json({ error: "Session expired. Please sign in again." });
    req.user = {
      userId: user.id,
      username: user.username,
      authVersion: user.auth_version,
      role: user.role,
    };
    next();
  } catch (err) {
    return res
      .status(401)
      .json({ error: "Session expired. Please sign in again." });
  }
}

router.put("/password", verifyToken, passwordLimit, async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  if (
    typeof currentPassword !== "string" ||
    typeof newPassword !== "string" ||
    newPassword.length < 12 ||
    Buffer.byteLength(newPassword) > 72 ||
    Buffer.byteLength(currentPassword) > 72
  ) {
    return res
      .status(400)
      .json({
        error:
          "Use a new password of at least 12 characters and at most 72 UTF-8 bytes",
      });
  }
  try {
    const user = db
      .prepare("SELECT * FROM users WHERE id = ?")
      .get(req.user.userId);
    if (!(await bcrypt.compare(currentPassword, user.password)))
      return res.status(400).json({ error: "Current password is incorrect" });
    const hash = await bcrypt.hash(newPassword, 12);
    const result = db
      .prepare(
        "UPDATE users SET password = ?, auth_version = auth_version + 1 WHERE id = ? AND auth_version = ?",
      )
      .run(hash, user.id, req.user.authVersion);
    if (!result.changes)
      return res
        .status(401)
        .json({ error: "Session expired. Please sign in again." });
    res.json({
      message: "Password changed. Please sign in again on each device.",
    });
  } catch (err) {
    next(err);
  }
});
module.exports = router;
module.exports.verifyToken = verifyToken;

module.exports.requireAdmin = (req, res, next) =>
  req.user.role === "admin"
    ? next()
    : res.status(403).json({ error: "Administrator access required" });
