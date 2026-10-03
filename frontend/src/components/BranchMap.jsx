import { household } from "../utils/expenses";
import { recordLocationTiming } from "../utils/locationTiming";
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
export default function BranchMap({ places, onSelect, onMove, center }) {
  const host = useRef(),
    map = useRef(),
    group = useRef(),
    positionMarker = useRef(),
    select = useRef(onSelect),
    move = useRef(onMove);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(true);
  select.current = onSelect;
  move.current = onMove;
  useEffect(() => {
    const m = L.map(host.current, {
      scrollWheelZoom: false,
      zoomAnimation: false,
      fadeAnimation: false,
    });
    map.current = m;
    // Choose the relevant view before requesting any tiles. Only manual pin entry uses a default area.
    const initial = center || places[0];
    m.setView(
      initial
        ? [initial.latitude, initial.longitude]
        : [household.map_lat, household.map_lon],
      initial ? 15 : household.map_lat || household.map_lon ? 11 : 2,
    );
    if (!center && places.length)
      m.fitBounds(
        places.map((p) => [p.latitude, p.longitude]),
        { padding: [35, 35], maxZoom: 16, animate: false },
      );
    const loadingTimeout = setTimeout(() => {
      setLoading(false);
      setFailed(true);
    }, 15000);
    m.on("click", (e) =>
      move.current?.({
        latitude: e.latlng.lat,
        longitude: e.latlng.wrap().lng,
      }),
    );
    let tileStarted = performance.now();
    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      referrerPolicy: "strict-origin-when-cross-origin",
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>',
    })
      .on("loading", () => {
        tileStarted = performance.now();
      })
      .on("load", () => {
        clearTimeout(loadingTimeout);
        setLoading(false);
        recordLocationTiming("tiles", tileStarted);
      })
      .on("tileerror", () => {
        clearTimeout(loadingTimeout);
        setLoading(false);
        setFailed(true);
      })
      .addTo(m);
    group.current = L.layerGroup().addTo(m);
    const resize = new ResizeObserver(() => m.invalidateSize());
    resize.observe(host.current);
    return () => {
      clearTimeout(loadingTimeout);
      resize.disconnect();
      m.remove();
    };
  }, []);
  useEffect(() => {
    group.current.clearLayers();
    places.forEach((p, i) => {
      const label = document.createElement("span");
      label.textContent = p.name;
      L.marker([p.latitude, p.longitude], {
        icon: L.divIcon({
          className: "purchase-pin",
          html: `<span>${i + 1}</span>`,
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        }),
        draggable: Boolean(onMove),
        title: `${i + 1}. ${p.name}`,
        alt: p.name,
      })
        .on("dragend", (e) => {
          const p = e.target.getLatLng().wrap();
          move.current?.({ latitude: p.lat, longitude: p.lng });
        })
        .bindTooltip(label)
        .on("click", () => select.current?.(p))
        .addTo(group.current);
    });
    if (places.length)
      map.current.fitBounds(
        [
          ...places.map((p) => [p.latitude, p.longitude]),
          ...(center ? [[center.latitude, center.longitude]] : []),
        ],
        {
          animate: false,
          padding: [35, 35],
          maxZoom: onMove ? Math.max(16, map.current.getZoom()) : 16,
        },
      );
  }, [places]);
  useEffect(() => {
    if (positionMarker.current) {
      positionMarker.current.remove();
      positionMarker.current = null;
    }
    if (center) {
      positionMarker.current = L.circleMarker(
        [center.latitude, center.longitude],
        {
          radius: 7,
          color: "#fff",
          weight: 3,
          fillColor: "#1769aa",
          fillOpacity: 1,
        },
      )
        .bindTooltip("Your location")
        .addTo(map.current);
      map.current.setView([center.latitude, center.longitude], 15, {
        animate: false,
      });
    }
  }, [center]);
  return (
    <>
      <div className="branch-map-frame" aria-busy={loading}>
        <div
          ref={host}
          className="branch-map"
          role="region"
          aria-label={
            onMove ? "Precise shop location map" : "Shop search results map"
          }
        />
        {loading && (
          <div className="map-loading-overlay" role="status">
            Loading the map…
          </div>
        )}
      </div>
      {failed && (
        <p role="status">
          Map tiles could not load. You can still choose a branch using its
          address below.
        </p>
      )}
    </>
  );
}
