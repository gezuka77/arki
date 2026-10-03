export function groupPlaces(expenses) {
  const groups = new Map();
  let unmapped = 0;
  for (const e of expenses) {
    if (!Number.isFinite(e.latitude) || !Number.isFinite(e.longitude)) {
      unmapped++;
      continue;
    }
    const key = `${e.latitude},${e.longitude}`;
    if (!groups.has(key))
      groups.set(key, {
        latitude: e.latitude,
        longitude: e.longitude,
        names: new Set(),
        count: 0,
        total: 0,
        receipts: [],
      });
    const p = groups.get(key);
    p.names.add(e.location);
    p.count++;
    p.total += e.amount_cents ?? Math.round(e.amount * 100);
    p.receipts.push(e);
  }
  return {
    places: [...groups.values()].map((p) => ({
      ...p,
      name: [...p.names].join(" / "),
    })),
    unmapped,
  };
}

// Use the confirmed branch when two providers locate the same shop a few metres apart.
export function reuseSavedBranch(place, saved) {
  const match = saved.find(
    (p) =>
      p.name.toLowerCase().includes(place.name.toLowerCase()) &&
      Math.hypot(
        (p.latitude - place.latitude) * 111320,
        (p.longitude - place.longitude) *
          111320 *
          Math.cos((place.latitude * Math.PI) / 180),
      ) < 75,
  );
  return match ? { ...place, ...match, saved: true } : place;
}

export function branchDisplayName(place) {
  if (place.saved) return place.name;
  const street =
    place.street ||
    (place.address || "")
      .replace(/\s+\d{5}.*$/, "")
      .replace(/\s+\d+[a-zA-Z]?(?:[-–]\d+)?$/, "");
  return `${place.name}${street && !place.name.toLowerCase().includes(street.toLowerCase()) ? " " + street : ""}`.slice(
    0,
    200,
  );
}
