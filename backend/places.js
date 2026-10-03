const validCoordinates = (lat, lon) =>
  typeof lat === "number" &&
  typeof lon === "number" &&
  Number.isFinite(lat) &&
  Number.isFinite(lon) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lon) <= 180;
const address = (p) =>
  [
    p.street || p["addr:street"],
    p.housenumber || p["addr:housenumber"],
    p.postcode || p["addr:postcode"],
    p.city || p["addr:city"] || p.district,
  ]
    .filter(Boolean)
    .join(" ");
function photonPlaces(data) {
  return (data.features || [])
    .map((f) => ({
      name: f.properties?.name || f.properties?.street || "",
      address: address(f.properties || {}),
      latitude: f.geometry?.coordinates?.[1],
      longitude: f.geometry?.coordinates?.[0],
    }))
    .filter((p) => p.name && validCoordinates(p.latitude, p.longitude));
}
function nearbyPlaces(data, lat, lon) {
  return (data.elements || [])
    .map((e) => ({
      name: e.tags?.name || e.tags?.brand || "",
      address: address(e.tags || {}),
      latitude: e.lat ?? e.center?.lat,
      longitude: e.lon ?? e.center?.lon,
    }))
    .filter((p) => p.name && validCoordinates(p.latitude, p.longitude))
    .map((p) => ({
      ...p,
      distance: Math.round(distance(lat, lon, p.latitude, p.longitude)),
    }))
    .sort((a, b) => a.distance - b.distance)
    .filter(
      (p, i, all) =>
        all.findIndex(
          (q) =>
            q.name === p.name &&
            distance(q.latitude, q.longitude, p.latitude, p.longitude) < 50,
        ) === i,
    )
    .slice(0, 25);
}
function distance(a, b, c, d) {
  const rad = Math.PI / 180;
  const x =
    Math.sin(((c - a) * rad) / 2) ** 2 +
    Math.cos(a * rad) * Math.cos(c * rad) * Math.sin(((d - b) * rad) / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
module.exports = { validCoordinates, photonPlaces, nearbyPlaces, distance };
