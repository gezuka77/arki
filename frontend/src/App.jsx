import TrendsSummary from "./components/TrendsSummary";
import SetupWizard from "./components/SetupWizard";
import HouseholdSettings from "./components/HouseholdSettings";
import { configure, household } from "./utils/expenses";
import { useState, useEffect } from "react";
import Login from "./components/Login";
import ExpenseForm from "./components/ExpenseForm";
import ExpenseList from "./components/ExpenseList";
import MonthlyStats from "./components/MonthlyStats";
import MonthlyChart from "./components/MonthlyChart";
import LocationSummary from "./components/LocationSummary";
import Budget from "./components/Budget";
import AccountSettings from "./components/AccountSettings";
import Modal from "./components/Modal";
import Icon from "./components/Icon";
import { api } from "./api";
import { formatDate, localDate } from "./utils/format";

import MapBoundary from "./components/MapBoundary";
import PurchaseMap from "./components/PurchaseMap";
const navigation = [
  ["overview", "Overview", "overview"],
  ["expenses", "Receipts", "receipt"],
  ["add", "Add", "plus"],
  ["trends", "Trends", "chart"],
  ["map", "Map", "map"],
  ["settings", "Settings", "settings"],
];
export default function App() {
  const [setup, setSetup] = useState(null);
  const [config, setConfig] = useState(null);
  const [startupError, setStartupError] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState("");
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState("overview");
  const [adding, setAdding] = useState(false);
  const [notice, setNotice] = useState("");
  const [scrolled, setScrolled] = useState(() => window.scrollY > 8);

  useEffect(() => {
    const updateScroll = () => setScrolled(window.scrollY > 8);
    updateScroll();
    window.addEventListener("scroll", updateScroll, { passive: true });
    return () => window.removeEventListener("scroll", updateScroll);
  }, []);

  const initialize = async () => {
    setLoading(true);
    setStartupError("");
    try {
      const status = await api.getSetup();
      setSetup(status);
      if (status.initialized && localStorage.getItem("token")) {
        setIsLoggedIn(true);
        await loadExpenses();
      } else setLoading(false);
    } catch (e) {
      setStartupError(e.message);
      setLoading(false);
    }
  };
  useEffect(() => {
    initialize();
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(""), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const loadExpenses = async () => {
    try {
      const data = await api.getHousehold();
      configure(data);
      setConfig(data);
      setUsername(data.user.username);
      setExpenses(await api.getExpenses());
      setError("");
    } catch (err) {
      if (err.status === 401) handleLogout();
      else
        setError(
          "Unable to refresh expenses. Displayed totals may be out of date. Please retry.",
        );
    } finally {
      setLoading(false);
    }
  };
  const handleLogin = (user) => {
    setUsername(user);
    setIsLoggedIn(true);
    setLoading(true);
    loadExpenses();
  };
  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    setIsLoggedIn(false);
    setUsername("");
    setExpenses([]);
    setConfig(null);
    setError("");
    setAdding(false);
    setNotice("");
    setView("overview");
  };
  const navigate = (next) => {
    setView(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  };
  if (loading)
    return (
      <div className="loading-screen">
        <div className="brand-mark">
          <Icon name="basket" size={28} />
        </div>
        <p>Opening your tracker…</p>
      </div>
    );
  if (startupError)
    return (
      <main className="setup-page">
        <p role="alert">Unable to open the app: {startupError}</p>
        <button className="primary" onClick={initialize}>
          Retry
        </button>
      </main>
    );
  if (setup && !setup.initialized)
    return <SetupWizard options={setup} onComplete={initialize} />;
  if (!isLoggedIn || !config) return <Login onLogin={handleLogin} />;

  const nav = (mobile = false) => (
    <nav aria-label="Main navigation">
      {navigation
        .filter(([key]) => !mobile || key !== "settings")
        .map(([key, label, icon]) => (
          <button
            key={key}
            className={key === "add" ? "nav-add" : undefined}
            aria-label={key === "add" ? "Add expense" : undefined}
            aria-current={view === key ? "page" : undefined}
            onClick={() => (key === "add" ? setAdding(true) : navigate(key))}
          >
            <Icon name={icon} />
            <span>{label}</span>
          </button>
        ))}
    </nav>
  );
  const headings = {
    overview: ["Your everyday spending", "A little clarity for every receipt."],
    expenses: ["Your receipts", "Your household spending, together."],
    trends: [
      "Spending trends",
      "Monthly totals, category splits and the places you spend.",
    ],
    map: ["Where you shop", "Your familiar places, on the map."],
    settings: ["Your account", "A few things to make this space yours."],
  };
  return (
    <div className="app-shell">
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="basket" size={26} />
          </span>
          <div>
            Arki Tracker
            <small>{config.name}</small>
          </div>
        </div>
        {nav()}
        <div className="sidebar-note">
          <Icon name="receipt" />
          <p>
            Small receipts.
            <br />A clearer picture.
          </p>
        </div>
        <div className="profile">
          <span className="avatar">{username.slice(0, 1).toUpperCase()}</span>
          <div>
            <strong>{username}</strong>
            <small>Shared household</small>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="mobile-brand">
            <span className="brand-mark">
              <Icon name="basket" />
            </span>
            <strong>Arki Tracker</strong>
          </div>
          <span className="desktop-context">HOUSEHOLD EXPENSES</span>
          <div className="topbar-actions">
            <span className="today">{formatDate(localDate())}</span>
            <button
              className="mobile-account"
              aria-label="Account settings"
              title="Account settings"
              aria-current={view === "settings" ? "page" : undefined}
              onClick={() => navigate("settings")}
            >
              <Icon name="account" size={22} />
            </button>
          </div>
        </header>
        <main id="main-content" className="page-content" tabIndex={-1}>
          <div className="page-heading">
            <div>
              <h1>{headings[view][0]}</h1>
              <p>{headings[view][1]}</p>
            </div>
            <button
              className="primary add-action"
              onClick={() => setAdding(true)}
            >
              <Icon name="plus" />
              <span>Add expense</span>
            </button>
          </div>
          {error && (
            <div role="alert" className="error-banner">
              {error}
              <button onClick={loadExpenses}>Retry</button>
            </div>
          )}
          {view === "overview" && (
            <>
              <MonthlyStats expenses={expenses} />
              <div className="overview-columns">
                <ExpenseList
                  compact
                  expenses={expenses}
                  onViewAll={() => navigate("expenses")}
                  onAdd={() => setAdding(true)}
                  onExpenseDeleted={loadExpenses}
                  onExpenseUpdated={loadExpenses}
                />
                <Budget expenses={expenses} />
              </div>
            </>
          )}
          {view === "expenses" && (
            <ExpenseList
              expenses={expenses}
              onAdd={() => setAdding(true)}
              onExpenseDeleted={loadExpenses}
              onExpenseUpdated={loadExpenses}
            />
          )}
          {view === "trends" && (
            <>
              <TrendsSummary expenses={expenses} />
              <div className="trends-layout">
                <MonthlyChart expenses={expenses} />
                <LocationSummary
                  expenses={expenses}
                  onLocationUpdated={loadExpenses}
                />
              </div>
            </>
          )}
          {view === "map" && (
            <MapBoundary>
              <PurchaseMap expenses={expenses} onUpdated={loadExpenses} />
            </MapBoundary>
          )}
          {view === "settings" && (
            <div className="settings-layout">
              <section className="panel">
                <div className="profile">
                  <span className="avatar">
                    {username.slice(0, 1).toUpperCase()}
                  </span>
                  <div>
                    <strong>{username}</strong>
                    <small>Signed in · shared household</small>
                  </div>
                </div>
                <p className="muted mt-4">
                  Amounts in {config.currency}. Dates in DD/MM/YYYY.
                </p>
                <button className="secondary mt-4" onClick={handleLogout}>
                  Log out
                </button>
              </section>
              <AccountSettings onPasswordChanged={handleLogout} />
              {config.user.role === "admin" && (
                <HouseholdSettings config={config} onUpdated={loadExpenses} />
              )}
            </div>
          )}
          <footer className="page-footer">
            Made for the everyday. <span>{config.currency} · DD/MM/YYYY</span>
          </footer>
        </main>
      </div>
      <div className={`mobile-navigation${scrolled ? " is-scrolled" : ""}`}>
        {nav(true)}
      </div>
      <Modal open={adding} onClose={() => setAdding(false)}>
        <ExpenseForm
          expenses={expenses}
          onExpenseAdded={async () => {
            await loadExpenses();
            setAdding(false);
            setNotice("Expense saved");
          }}
        />
      </Modal>
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" />
          {notice}
        </div>
      )}
    </div>
  );
}
