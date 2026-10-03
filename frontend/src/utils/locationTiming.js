// Session-only diagnostics: durations and source names, never coordinates or shop names.
export function recordLocationTiming(phase, started, detail = {}) {
  const duration = Math.round(performance.now() - started);
  const event = { phase, duration_ms: duration, ...detail };
  window.arkiLocationTimings = [
    ...(window.arkiLocationTimings || []).slice(-29),
    event,
  ];
  return duration;
}
