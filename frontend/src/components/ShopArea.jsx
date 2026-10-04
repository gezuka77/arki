import { useState, useEffect } from "react";
import { api } from "../api";
export default function ShopArea({ value, onChange, setupToken, directory }) {
  const [query, setQuery] = useState(""),
    [results, setResults] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [status, setStatus] = useState(directory);
  useEffect(() => {
    setStatus(directory);
    if (!directory) return;
    const timer = setInterval(
      () =>
        api
          .getDirectoryStatus()
          .then(setStatus)
          .catch(() => {}),
      5000,
    );
    return () => clearInterval(timer);
  }, [directory]);
  const choose = (p) => {
    onChange({
      label: p.name,
      latitude: Math.round(p.latitude * 100) / 100,
      longitude: Math.round(p.longitude * 100) / 100,
      radius: value?.radius || 20,
    });
    setResults([]);
    setError("");
  };
  async function search() {
    setBusy(true);
    setError("");
    try {
      const rows = await api.searchArea(query, setupToken);
      setResults(rows);
      if (!rows.length)
        setError(
          "No matching areas. Try a nearby city or use your current location.",
        );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function locate() {
    setError("");
    if (!navigator.geolocation)
      return setError("Location is unavailable. Search for a city instead.");
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        choose({
          name: "Around my chosen location",
          latitude: p.coords.latitude,
          longitude: p.coords.longitude,
        });
        setBusy(false);
      },
      () => {
        setBusy(false);
        setError("Could not get your location. Search for a city instead.");
      },
      { enableHighAccuracy: false, maximumAge: 300000, timeout: 12000 },
    );
  }
  return (
    <section className="form-stack" aria-label="Nearby-shop preparation">
      <h3>
        Which city or area should we prepare for faster nearby-shop searches?
      </h3>
      <p className="muted">
        We download public shop locations around this area in the background and
        refresh them weekly. This speeds up finding shops after your phone gets
        its GPS position. You can skip this or change it later.
      </p>
      <label>
        City or area
        <input
          className="field"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (query.trim().length >= 2 && !busy) void search();
            }
          }}
          placeholder="City, region or country"
        />
      </label>
      <div className="editor-actions">
        <button
          type="button"
          className="secondary"
          disabled={busy || query.trim().length < 2}
          onClick={search}
        >
          {busy ? "Finding area…" : "Find area"}
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={locate}
        >
          Use current location
        </button>
      </div>
      {error && (
        <p role="alert" className="error-banner">
          {error}
        </p>
      )}
      {!!results.length && (
        <ul className="place-results">
          {results.map((p, i) => (
            <li key={i}>
              <button type="button" onClick={() => choose(p)}>
                {p.name}
                {p.address ? ` · ${p.address}` : ""}
              </button>
            </li>
          ))}
        </ul>
      )}
      {value ? (
        <>
          <p>
            <strong>{value.label}</strong> · {value.latitude}, {value.longitude}{" "}
            (approximate centre)
          </p>
          <label>
            Area size
            <select
              className="field"
              aria-label="Area size"
              value={value.radius}
              onChange={(e) =>
                onChange({ ...value, radius: Number(e.target.value) })
              }
            >
              <option value={5}>About 5 km around the centre</option>
              <option value={10}>About 10 km around the centre</option>
              <option value={20}>About 20 km around the centre</option>
            </select>
          </label>
          <p className="muted">
            This approximate centre is saved for the shared household. City
            search uses an external map service; the directory download uses the
            surrounding area. Your precise phone position is not saved.
          </p>
        </>
      ) : (
        <p className="muted">
          {value === undefined &&
          status?.source === "server" &&
          status.configured
            ? "Using the area already configured on this server."
            : "No area selected. Nearby searches will still work and cache results as you use them."}
        </p>
      )}
      <button
        type="button"
        className="text-button"
        onClick={() => {
          onChange(null);
          setResults([]);
        }}
      >
        {setupToken !== undefined
          ? "Skip area preparation"
          : "Turn off area preparation"}
      </button>
      {status && (
        <p role="status" className="muted">
          {status.state === "ready"
            ? `${status.count.toLocaleString()} shop locations ready.`
            : status.state === "preparing"
              ? "Preparing nearby-shop locations in the background…"
              : status.state === "retrying"
                ? "The download could not finish. We will retry automatically; nearby search is still available."
                : status.state === "pending"
                  ? "Area download is queued."
                  : "Area preparation is off."}{" "}
          Changes take effect when you save.
        </p>
      )}
    </section>
  );
}
