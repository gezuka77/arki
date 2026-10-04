import { recordLocationTiming } from "../utils/locationTiming";
import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { reuseSavedBranch, branchDisplayName } from "../utils/places";
import BranchMap from "./BranchMap";
import MapBoundary from "./MapBoundary";
export default function PlacePicker({
  name,
  onChoose,
  editableQuery = false,
  saveShop = false,
}) {
  const [places, setPlaces] = useState([]),
    [results, setResults] = useState([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [searched, setSearched] = useState(false);
  const [query, setQuery] = useState(name),
    [candidate, setCandidate] = useState(null),
    [displayName, setDisplayName] = useState(""),
    [address, setAddress] = useState(""),
    [latitude, setLatitude] = useState(""),
    [longitude, setLongitude] = useState(""),
    [replace, setReplace] = useState(false);
  const [pinLocating, setPinLocating] = useState(false);
  const [pinError, setPinError] = useState("");
  const [pinCenter, setPinCenter] = useState(null);
  const [pinAccuracy, setPinAccuracy] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [mapCenter, setMapCenter] = useState(null);
  const [phase, setPhase] = useState(""),
    [seconds, setSeconds] = useState(0);
  const version = useRef(0),
    controller = useRef(),
    lastSearch = useRef(null),
    lastPosition = useRef(null),
    confirmation = useRef(null),
    resultBox = useRef(null);
  const cancel = () => {
    version.current++;
    controller.current?.abort();
    setBusy(false);
    setPinLocating(false);
  };
  useEffect(() => {
    let active = true;
    const refresh = () =>
      api
        .getPlaces()
        .then((p) => {
          if (active) setPlaces(p);
        })
        .catch(() => {});
    refresh();
    window.addEventListener("shops-updated", refresh);
    return () => {
      active = false;
      window.removeEventListener("shops-updated", refresh);
      version.current++;
      controller.current?.abort();
    };
  }, [name]);
  useEffect(() => {
    cancel();
    setResults([]);
    setSearched(false);
    setError("");
    setMapOpen(false);
    setMapCenter(null);
    setQuery(name);
    setCandidate(null);
  }, [name]);
  useEffect(() => {
    if (!busy) return;
    setSeconds(0);
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [busy]);
  useEffect(() => {
    if (candidate)
      confirmation.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
  }, [candidate]);
  useEffect(() => {
    if (mapOpen)
      resultBox.current?.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
  }, [mapOpen]);
  const saved = places
    .filter(
      (p) =>
        !query.trim() ||
        `${p.name} ${p.address}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .slice(0, 8);
  const preview = (p, nearby = false) => {
    cancel();
    setPinError("");
    setPinCenter(null);
    setPinAccuracy(null);
    setError("");
    setMapOpen(false);
    setCandidate(p);
    setAddress(p.address || "");
    setLatitude(p.latitude == null ? "" : String(p.latitude));
    setLongitude(p.longitude == null ? "" : String(p.longitude));
    setReplace(false);
    setDisplayName(
      editableQuery
        ? name
        : p.saved
          ? p.name
          : !nearby && name.trim()
            ? name.trim()
            : branchDisplayName(p),
    );
  };
  const run = async (nearby, retry = false) => {
    cancel();
    const request = ++version.current;
    const abort = new AbortController();
    controller.current = abort;
    const timeout = setTimeout(() => abort.abort(), 35000);
    lastSearch.current = nearby;
    setMapOpen(true);
    setMapCenter(null);
    setBusy(true);
    setCandidate(null);
    setError("");
    setResults([]);
    setSearched(false);
    try {
      let found;
      if (nearby) {
        let position = retry ? lastPosition.current : null;
        if (!position) {
          setPhase("Waiting for your phone’s location…");
          if (!navigator.geolocation)
            throw Error(
              "Location is unavailable. Search by shop name or address instead.",
            );
          const gpsStarted = performance.now();
          const p = await new Promise((resolve, reject) =>
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              timeout: 12000,
              maximumAge: 60000,
              enableHighAccuracy: false,
            }),
          ).then(
            (p) => {
              recordLocationTiming("gps", gpsStarted, { outcome: "success" });
              return p;
            },
            (e) => {
              recordLocationTiming("gps", gpsStarted, {
                outcome: "failed",
                code: e.code,
              });
              throw e;
            },
          );
          position = {
            latitude: p.coords.latitude,
            longitude: p.coords.longitude,
          };
          lastPosition.current = position;
        }
        if (request !== version.current) return;
        setMapCenter(position);
        setPhase("Looking up nearby shops…");
        found = await api.nearbyPlaces(position, abort.signal);
      } else {
        setPhase("Searching for this shop or address…");
        found = await api.searchPlaces(query, abort.signal);
      }
      const known = places;
      if (request === version.current) {
        setPlaces(known);
        setResults(
          found.map((p) => ({ ...reuseSavedBranch(p, known), nearby })),
        );
        setSearched(true);
      }
    } catch (e) {
      if (request === version.current)
        setError(
          e.name === "AbortError"
            ? "Search took too long. Retry, search by address, or place a pin manually."
            : e.code === 1
              ? "Location permission was denied. Search by name or address, or place a pin manually."
              : e.code === 2 || e.code === 3
                ? "Could not get your position. Search by name or address instead."
                : e.message,
        );
    } finally {
      clearTimeout(timeout);
      if (request === version.current) setBusy(false);
    }
  };
  const locatePin = async () => {
    cancel();
    const request = ++version.current;
    setPinError("");
    setPinLocating(true);
    const started = performance.now();
    try {
      if (!navigator.geolocation)
        throw Error(
          "Location is unavailable. Search for an address or place the pin manually.",
        );
      const p = await new Promise((resolve, reject) =>
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          timeout: 12000,
          maximumAge: 60000,
          enableHighAccuracy: false,
        }),
      );
      if (request !== version.current) return;
      const position = {
        latitude: p.coords.latitude,
        longitude: p.coords.longitude,
      };
      setLatitude(position.latitude.toFixed(6));
      setLongitude(position.longitude.toFixed(6));
      setPinCenter(position);
      setPinAccuracy(
        Number.isFinite(p.coords.accuracy)
          ? Math.round(p.coords.accuracy)
          : null,
      );
      setReplace(false);
      recordLocationTiming("manual-pin-gps", started, { outcome: "success" });
    } catch (e) {
      if (request !== version.current) return;
      setPinError(
        e.code === 1
          ? "Location permission was denied. Allow location access and try again, or search for the venue’s address."
          : e.code === 2 || e.code === 3
            ? "Your phone could not find its position. Try again, search for the venue’s address, or place the pin manually."
            : e.message,
      );
      recordLocationTiming("manual-pin-gps", started, { outcome: "failed" });
    } finally {
      if (request === version.current) setPinLocating(false);
    }
  };
  const lat = latitude.trim() === "" ? NaN : Number(latitude.replace(",", ".")),
    lon = longitude.trim() === "" ? NaN : Number(longitude.replace(",", "."));
  const valid =
    Number.isFinite(lat) &&
    Math.abs(lat) <= 90 &&
    Number.isFinite(lon) &&
    Math.abs(lon) <= 180;
  const existing = places.find(
    (p) => p.name.toLowerCase() === displayName.trim().toLowerCase(),
  );
  const conflict =
    existing &&
    valid &&
    (existing.latitude !== lat ||
      existing.longitude !== lon ||
      existing.address !== address.trim());
  return (
    <div className="place-picker">
      <label>
        Search shop name or address
        <input
          className="field"
          maxLength={200}
          value={query}
          onChange={(e) => {
            cancel();
            setMapOpen(false);
            setQuery(e.target.value);
            setResults([]);
            setSearched(false);
            setCandidate(null);
            setError("");
          }}
          placeholder="Shop name, street and town"
        />
      </label>
      <p className="muted">
        Away from the shop? Search its name, street and town, or enter its exact
        location below. This search does not use your GPS.
      </p>
      <div className="place-actions">
        <button
          type="button"
          className="secondary"
          disabled={busy || query.trim().length < 2}
          onClick={() => run(false)}
        >
          Find shop on map
        </button>
        <button
          type="button"
          className="secondary"
          disabled={busy}
          onClick={() => run(true)}
        >
          Nearby shops
        </button>
        <button
          type="button"
          className="secondary"
          onClick={() => preview({ name: name || "", address: "" })}
        >
          Add precise location
        </button>
      </div>
      <p className="muted">
        Nearby uses your phone location once to find shops within about 1.5 km.
        Configured local shop directories are searched on our server. Elsewhere,
        a coarse area may be sent to Overpass. Your precise phone position is
        not saved.
      </p>
      {busy && (
        <div role="status">
          <p>
            {phase} {seconds}s
          </p>
          {seconds >= 6 && (
            <p>
              {phase.startsWith("Waiting")
                ? "Your phone is taking a while to find its location."
                : "The shop service is taking a while."}{" "}
              You can already use a saved shop or cancel and place a pin
              manually.
            </p>
          )}
          <button type="button" className="secondary" onClick={cancel}>
            Cancel search
          </button>
        </div>
      )}
      {error && (
        <div role="alert">
          <p>{error}</p>
          {lastSearch.current !== null && (
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => run(lastSearch.current, true)}
            >
              Retry search
            </button>
          )}
        </div>
      )}
      {!!saved.length && (
        <div className="place-results">
          <p className="eyebrow">SAVED SHOPS · REUSE A CONFIRMED BRANCH</p>
          {saved.map((p) => (
            <button
              type="button"
              key={p.name}
              onClick={() => preview({ ...p, saved: true })}
            >
              <strong>{p.name}</strong>
              <span>{p.address}</span>
            </button>
          ))}
        </div>
      )}
      <div ref={resultBox}>
        {mapOpen && busy && !mapCenter && !results.length && (
          <div
            className="map-loading-placeholder"
            role="status"
            aria-live="polite"
          >
            <strong>
              {phase.startsWith("Waiting")
                ? "Finding your location…"
                : "Finding the shop…"}
            </strong>
            <span>The map will appear at the right location.</span>
          </div>
        )}
        {mapOpen && (mapCenter || results.length > 0) && (
          <MapBoundary>
            <BranchMap
              places={results}
              center={mapCenter}
              onSelect={(p) => preview(p, p.nearby)}
            />
          </MapBoundary>
        )}
        {!!results.length && (
          <div className="place-results">
            <p className="eyebrow">CHOOSE THE CORRECT BRANCH</p>
            {results.map((p, i) => (
              <button
                type="button"
                key={i}
                onClick={() => preview(p, p.nearby)}
              >
                <strong>
                  {i + 1}. {p.name}
                  {p.distance != null ? ` · ${p.distance} m` : ""}
                  {p.saved ? " · Saved" : ""}
                </strong>
                <span>
                  {p.address ||
                    `${p.latitude.toFixed(4)}, ${p.longitude.toFixed(4)}`}
                </span>
              </button>
            ))}
          </div>
        )}
        {searched && !results.length && (
          <p role="status">
            No matches. Try a street and town, or use Add precise location.
          </p>
        )}
      </div>
      {candidate && (
        <div className="branch-confirmation" ref={confirmation}>
          <h3>Confirm this place</h3>
          <p>
            Use your current location for a temporary stall or event, or tap the
            map and move the pin to the venue. Keep your own name on the
            receipt.
          </p>
          <div className="place-actions">
            <button
              type="button"
              className="secondary"
              disabled={pinLocating}
              onClick={locatePin}
            >
              Use my current location
            </button>
            {pinLocating && (
              <button type="button" className="secondary" onClick={cancel}>
                Cancel location request
              </button>
            )}
          </div>
          {pinError && <p role="alert">{pinError}</p>}
          {pinAccuracy !== null && (
            <p className="muted">
              Phone accuracy: about {pinAccuracy} m. Check the pin and move it
              if needed. Nothing is saved until you confirm.
            </p>
          )}
          {pinLocating ? (
            <div className="map-loading-placeholder" role="status">
              <strong>Finding your current location…</strong>
              <span>
                The map will centre on your position when it is available.
              </span>
            </div>
          ) : (
            <MapBoundary>
              <BranchMap
                center={pinCenter}
                places={
                  valid ? [{ ...candidate, latitude: lat, longitude: lon }] : []
                }
                onSelect={() => {}}
                onMove={({ latitude, longitude }) => {
                  setPinCenter(null);
                  setLatitude(latitude.toFixed(6));
                  setLongitude(longitude.toFixed(6));
                  setReplace(false);
                }}
              />
            </MapBoundary>
          )}

          <label>
            Place name on receipts
            <input
              className="field"
              value={displayName}
              maxLength={200}
              readOnly={editableQuery}
              onChange={(e) => {
                setDisplayName(e.target.value);
                setReplace(false);
              }}
            />
          </label>
          <label>
            Address (optional)
            <input
              className="field"
              value={address}
              maxLength={500}
              onChange={(e) => {
                setAddress(e.target.value);
                setReplace(false);
              }}
              placeholder="Street, number, postcode and town"
            />
          </label>
          <div className="coordinate-fields">
            <label>
              Latitude
              <input
                className="field"
                inputMode="decimal"
                value={latitude}
                disabled={pinLocating}
                onChange={(e) => {
                  setLatitude(e.target.value);
                  setReplace(false);
                }}
                placeholder="Latitude"
              />
            </label>
            <label>
              Longitude
              <input
                className="field"
                inputMode="decimal"
                value={longitude}
                disabled={pinLocating}
                onChange={(e) => {
                  setLongitude(e.target.value);
                  setReplace(false);
                }}
                placeholder="Longitude"
              />
            </label>
          </div>
          {!valid && (
            <p className="muted">
              Choose a pin or enter valid coordinates before saving (latitude
              −90 to 90, longitude −180 to 180).
            </p>
          )}
          {conflict && (
            <label className="place-replace">
              <input
                type="checkbox"
                checked={replace}
                onChange={(e) => setReplace(e.target.checked)}
              />{" "}
              Update the saved branch “{existing.name}” for all its receipts. To
              keep another branch separate, use a different name.
            </label>
          )}
          <p className="muted">
            {editableQuery
              ? `Saving links all receipts named “${name}” to this branch.`
              : saveShop
                ? "Save this branch once, then select it from Saved shops on future receipts."
                : "The full address stays separate. This place and its pin are saved when you save the expense."}
          </p>
          <div className="place-actions">
            <button
              type="button"
              className="primary"
              disabled={
                pinLocating ||
                !displayName.trim() ||
                !valid ||
                (conflict && !replace)
              }
              onClick={async () => {
                try {
                  await onChoose(
                    {
                      ...candidate,
                      name: displayName.trim(),
                      address: address.trim(),
                      latitude: lat,
                      longitude: lon,
                      replace,
                    },
                    true,
                  );
                  setCandidate(null);
                  setResults([]);
                  setSearched(false);
                  setPlaces(await api.getPlaces().catch(() => places));
                } catch (e) {
                  setError(e.message);
                }
              }}
            >
              {editableQuery
                ? "Save map location"
                : saveShop
                  ? "Save shop"
                  : "Use this place"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => {
                cancel();
                setCandidate(null);
              }}
            >
              Cancel selection
            </button>
          </div>
        </div>
      )}
      <p className="map-credit">
        Shop data: OpenStreetMap · Search: local directory / Photon / Overpass ·
        ©{" "}
        <a
          href="https://www.openstreetmap.org/copyright"
          target="_blank"
          rel="noreferrer"
        >
          OpenStreetMap contributors
        </a>
      </p>
    </div>
  );
}
