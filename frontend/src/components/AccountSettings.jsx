import { useState } from "react";
import { api } from "../api";
export default function AccountSettings({ onPasswordChanged }) {
  const [current, setCurrent] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmation)
      return setError("New passwords do not match.");
    setBusy(true);
    try {
      await api.changePassword(current, password);
      alert("Password changed. Please sign in again.");
      onPasswordChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <details className="panel account-panel" open>
      <summary className="font-semibold cursor-pointer">
        Account settings
      </summary>
      <form className="space-y-3 mt-4" onSubmit={submit}>
        <p className="text-sm text-gray-600">
          Changing your password signs this account out on all devices. Use at
          least 12 characters (maximum 72 UTF-8 bytes).
        </p>
        <label className="block">
          Current password
          <input
            className="field"
            type="password"
            autoComplete="current-password"
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            required
          />
        </label>
        <label className="block">
          New password
          <input
            className="field"
            type="password"
            autoComplete="new-password"
            minLength={12}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        <label className="block">
          Confirm new password
          <input
            className="field"
            type="password"
            autoComplete="new-password"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
            required
          />
        </label>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <button className="primary" disabled={busy}>
          {busy ? "Saving…" : "Change password"}
        </button>
      </form>
    </details>
  );
}
