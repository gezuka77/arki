// A bounded in-memory limiter for this single-process household app.
// Express trusts forwarded IPs only when the operator explicitly configures TRUST_PROXY.
module.exports = function createRateLimit({
  limit = 30,
  windowMs = 15 * 60 * 1000,
  now = Date.now,
} = {}) {
  const attempts = new Map();
  return (req, res, next) => {
    const time = now();
    for (const [key, value] of attempts)
      if (value.reset <= time) attempts.delete(key);
    const key = req.ip || req.socket.remoteAddress;
    let entry = attempts.get(key);
    if (!entry) {
      if (attempts.size >= 10000)
        return res
          .status(429)
          .json({ error: "Too many requests. Try again later." });
      entry = { count: 0, reset: time + windowMs };
      attempts.set(key, entry);
    }
    entry.count += 1;
    if (entry.count > limit) {
      res.set("Retry-After", String(Math.ceil((entry.reset - time) / 1000)));
      return res
        .status(429)
        .json({ error: "Too many attempts. Try again in 15 minutes." });
    }
    next();
  };
};
