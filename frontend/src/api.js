import { recordLocationTiming } from "./utils/locationTiming";
const API_BASE = "/api";

async function checkResponse(res, fallback) {
  if (res.ok) return;
  const body = await res.json().catch(() => ({}));
  const error = new Error(body.error || fallback);
  error.status = res.status;
  throw error;
}

async function authenticatedRequest(path, method = "GET", body, signal) {
  const started = performance.now();
  const res = await fetch(`${API_BASE}${path}`, {
    signal,
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (path.startsWith("/places/nearby") || path.startsWith("/places/search"))
    recordLocationTiming("shops", started, {
      source: res.headers.get("X-Places-Source"),
      server: res.headers.get("Server-Timing"),
      status: res.status,
    });
  await checkResponse(res, "Request failed");
  return res.json();
}

export const api = {
  searchArea: (query, setupToken) =>
    authenticatedRequest(
      setupToken === undefined
        ? "/household/area-search"
        : "/setup/area-search",
      "POST",
      { query, setupToken },
    ),
  getDirectoryStatus: () => authenticatedRequest("/household/directory"),
  getSetup: () => authenticatedRequest("/setup"),
  setup: (body) => authenticatedRequest("/setup", "POST", body),
  getHousehold: () => authenticatedRequest("/household"),
  saveHousehold: (body) => authenticatedRequest("/household", "PUT", body),
  addCategory: (body) => authenticatedRequest("/categories", "POST", body),
  updateCategory: (id, body) =>
    authenticatedRequest(`/categories/${id}`, "PUT", body),
  getUsers: () => authenticatedRequest("/users"),
  addUser: (body) => authenticatedRequest("/users", "POST", body),
  updateUser: (id, body) => authenticatedRequest(`/users/${id}`, "PUT", body),
  getPlaces: (signal) =>
    authenticatedRequest("/places", "GET", undefined, signal),
  searchPlaces: (q, signal) =>
    authenticatedRequest(
      `/places/search?q=${encodeURIComponent(q)}`,
      "GET",
      undefined,
      signal,
    ),
  nearbyPlaces: (position, signal) =>
    authenticatedRequest("/places/nearby", "POST", position, signal),
  async savePlace(place) {
    const result = await authenticatedRequest("/places", "PUT", place);
    window.dispatchEvent(new Event("shops-updated"));
    return result;
  },
  async removePlace(name) {
    const result = await authenticatedRequest("/places", "DELETE", { name });
    window.dispatchEvent(new Event("shops-updated"));
    return result;
  },
  getBudget: (month) => authenticatedRequest(`/budgets/${month}`),
  setBudget: (month, amount) =>
    authenticatedRequest(`/budgets/${month}`, "PUT", { amount }),
  changePassword: (currentPassword, newPassword) =>
    authenticatedRequest("/auth/password", "PUT", {
      currentPassword,
      newPassword,
    }),
  async login(username, password) {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    await checkResponse(res, "Login failed");
    return res.json();
  },

  async getExpenses(month = null) {
    const token = localStorage.getItem("token");
    const url = month
      ? `${API_BASE}/expenses?month=${month}`
      : `${API_BASE}/expenses`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await checkResponse(res, "Failed to fetch expenses");
    return res.json();
  },

  async createExpense(expense) {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/expenses`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(expense),
    });
    await checkResponse(res, "Failed to create expense");
    return res.json();
  },

  async updateExpense(id, updates) {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/expenses/${id}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(updates),
    });
    await checkResponse(res, "Failed to update expense");
    return res.json();
  },

  async deleteExpense(id) {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/expenses/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    await checkResponse(res, "Failed to delete expense");
    return res.json();
  },

  async getSuggestions() {
    const token = localStorage.getItem("token");
    const res = await fetch(`${API_BASE}/expenses/suggestions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    await checkResponse(res, "Failed to fetch suggestions");
    return res.json();
  },

  async updateLocation(oldName, newName) {
    const token = localStorage.getItem("token");
    const res = await fetch(
      `${API_BASE}/expenses/locations/${encodeURIComponent(oldName)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ newName }),
      },
    );
    await checkResponse(res, "Failed to update location");
    return res.json();
  },
};
