import { household } from "../utils/expenses";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import { api } from "../api";
import { categories, filterExpenses } from "../utils/expenses";
import { groupPlaces } from "../utils/places";
import { formatCurrency, formatDate } from "../utils/format";
import PlacePicker from "./PlacePicker";
export default function PurchaseMap({ expenses, onUpdated }) {
  const host = useRef(),
    map = useRef(),
    layers = useRef();
  const [month, setMonth] = useState(""),
    [category, setCategory] = useState(""),
    [heat, setHeat] = useState(false),
    [selected, setSelected] = useState(null),
    [linkName, setLinkName] = useState(""),
    [error, setError] = useState(""),
    [tileError, setTileError] = useState(false),
    [saving, setSaving] = useState(false);
  const filtered = useMemo(
    () => filterExpenses(expenses, { month, category }),
    [expenses, month, category],
  );
  const { places, unmapped } = useMemo(() => groupPlaces(filtered), [filtered]);
  const names = [
    ...new Set(expenses.map((e) => e.location).filter(Boolean)),
  ].sort();
  useEffect(() => {
    const m = L.map(host.current, { scrollWheelZoom: false }).setView(
      [household.map_lat, household.map_lon],
      household.map_lat || household.map_lon ? 11 : 2,
    );
    map.current = m;
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      referrerPolicy: "strict-origin-when-cross-origin",
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    })
      .on("tileerror", () => setTileError(true))
      .addTo(m);
    layers.current = L.layerGroup().addTo(m);
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(host.current);
    return () => {
      resize.disconnect();
      m.remove();
      map.current = null;
    };
  }, []);
  useEffect(() => {
    if (!map.current) return;
    const group = layers.current;
    group.clearLayers();
    setSelected(null);
    if (heat && places.length)
      L.heatLayer(
        places.map((p) => [p.latitude, p.longitude, p.count]),
        {
          radius: 35,
          blur: 25,
          maxZoom: 12,
          max: Math.max(...places.map((p) => p.count)),
          minOpacity: 0.3,
        },
      ).addTo(group);
    if (!heat)
      for (const p of places) {
        const text = document.createElement("span");
        text.textContent = `${p.name}: ${p.count} purchases · ${household.currency} ${formatCurrency(p.total / 100)}`;
        L.marker([p.latitude, p.longitude], {
          icon: L.divIcon({
            className: "purchase-pin",
            html: `<span>${p.count}</span>`,
            iconSize: [36, 36],
            iconAnchor: [18, 18],
          }),
          title: `${p.name}: ${p.count} purchases`,
          alt: p.name,
        })
          .bindTooltip(text)
          .on("click", () => setSelected(p))
          .addTo(group);
      }
    if (places.length)
      map.current.fitBounds(
        places.map((p) => [p.latitude, p.longitude]),
        { padding: [40, 40], maxZoom: 15 },
      );
  }, [places, heat]);
  const save = async (p) => {
    setSaving(true);
    setError("");
    try {
      await api.savePlace({ ...p, name: linkName });
      await onUpdated();
      setLinkName("");
    } catch (e) {
      setError(e.message);
      throw e;
    } finally {
      setSaving(false);
    }
  };
  return (
    <section className="panel purchase-map-panel">
      <div className="panel-heading">
        <div>
          <h2 className="section-title">Your purchase map</h2>
          <p className="muted">
            Every pin is a shop you confirmed. Each receipt counts as one
            purchase.
          </p>
        </div>
      </div>
      <div className="map-filters">
        <label>
          Map month
          <select
            className="field"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
          >
            <option value="">All months</option>
            {[...new Set(expenses.map((e) => e.date.slice(0, 7)))]
              .sort()
              .reverse()
              .map((m) => (
                <option key={m} value={m}>
                  {m.slice(5)}/{m.slice(0, 4)}
                </option>
              ))}
          </select>
        </label>
        <label>
          Map expense type
          <select
            className="field"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="">All types</option>
            {Object.entries(categories).map(([k, v]) => (
              <option key={k} value={k}>
                {v}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="secondary"
          aria-pressed={heat}
          onClick={() => setHeat((h) => !h)}
        >
          Heatmap
        </button>
      </div>
      <p className="muted map-summary">
        {filtered.length - unmapped} mapped purchases · {places.length} shops ·{" "}
        {unmapped} without a map location
        {Boolean(category)
          ? ` · Includes mixed receipts with ${categories[category]} items. Totals are whole receipts.`
          : ""}
      </p>
      <div
        ref={host}
        className="purchase-map"
        role="region"
        aria-label="Purchase locations map"
      />
      {tileError && (
        <p role="status">
          Map tiles could not load. Your purchase counts and shop list are still
          available below.
        </p>
      )}
      {heat && (
        <p className="muted">
          Heat shows purchase frequency: blue → green → yellow → red. Red
          indicates higher concentrations; nearby shops blend together.
        </p>
      )}
      {!places.length && (
        <p className="muted">
          No mapped purchases in this view. Link a shop below or choose a branch
          when adding a receipt.
        </p>
      )}
      <div className="map-shop-list">
        {places.map((p) => (
          <button
            className="secondary"
            key={`${p.latitude},${p.longitude}`}
            onClick={() => {
              setSelected(p);
              map.current.setView([p.latitude, p.longitude], 16);
            }}
          >
            {p.name} · {p.count} {p.count === 1 ? "purchase" : "purchases"} ·{" "}
            {household.currency}
            {formatCurrency(p.total / 100)}
          </button>
        ))}
      </div>
      {selected && (
        <div className="map-receipts">
          <h3>{selected.name}</h3>
          <ul>
            {selected.receipts.map((e) => (
              <li key={e.id}>
                {formatDate(e.date)} ·{" "}
                {e.allocations.map((a) => categories[a.category_id]).join(", ")}{" "}
                · {household.currency}
                {formatCurrency(e.amount)}
                {e.description ? ` · ${e.description}` : ""}
              </li>
            ))}
          </ul>
        </div>
      )}
      <details className="map-linker">
        <summary>Save a shop for later</summary>
        <p className="muted">
          Add a named branch and precise pin now, even without a receipt. You
          can select it from Saved shops next time.
        </p>
        <fieldset disabled={saving}>
          <PlacePicker
            name=""
            saveShop
            onChoose={async (place) => {
              setSaving(true);
              setError("");
              try {
                await api.savePlace(place);
                await onUpdated();
              } catch (e) {
                setError(e.message);
                throw e;
              } finally {
                setSaving(false);
              }
            }}
          />
        </fieldset>
      </details>
      <details className="map-linker">
        <summary>Add or correct a shop’s map location</summary>
        <p className="muted">
          Choose an existing receipt location, search for its branch and select
          the correct address. This links every receipt with that location name.
        </p>
        <label>
          Receipt location
          <select
            className="field"
            value={linkName}
            onChange={(e) => {
              setLinkName(e.target.value);
              setError("");
            }}
          >
            <option value="">Choose a location</option>
            {names.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        {linkName && (
          <fieldset disabled={saving}>
            <PlacePicker
              editableQuery
              key={linkName}
              name={linkName}
              onChoose={save}
            />
            {expenses.some(
              (e) => e.location === linkName && e.latitude != null,
            ) && (
              <button
                className="secondary"
                onClick={async () => {
                  setSaving(true);
                  try {
                    await api.removePlace(linkName);
                    await onUpdated();
                    setLinkName("");
                  } catch (e) {
                    setError(e.message);
                  } finally {
                    setSaving(false);
                  }
                }}
              >
                Remove saved map location
              </button>
            )}
          </fieldset>
        )}
        {saving && <p role="status">Saving shop location…</p>}
        {error && <p role="alert">{error}</p>}
      </details>
    </section>
  );
}
