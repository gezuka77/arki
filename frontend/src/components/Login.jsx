import { useState } from "react";
import { api } from "../api";
import Icon from "./Icon";
export default function Login({ onLogin }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const data = await api.login(username, password);
      localStorage.setItem("token", data.token);
      localStorage.setItem("username", data.username);
      onLogin(data.username);
    } catch (err) {
      setError(err.message || "Unable to sign in. Please try again.");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="login-screen">
      <div className="login-story">
        <div className="brand">
          <span className="brand-mark">
            <Icon name="basket" size={26} />
          </span>
          <div>
            Arki Tracker<small>Everyday spending</small>
          </div>
        </div>
        <h1>
          Everyday spending.
          <br />A clearer picture.
        </h1>
        <p>
          From the weekly shop to your afternoon coffee. Keep track of the
          little things, together.
        </p>
        <div className="login-categories">
          <span>
            <Icon name="receipt" size={16} />
            Shared receipts
          </span>
          <span>
            <Icon name="settings" size={16} />
            Your categories
          </span>
          <span>
            <Icon name="dog" size={16} />
            Named pets
          </span>
        </div>
      </div>
      <div className="login-form-wrap">
        <div className="login-form">
          <span className="brand-mark">
            <Icon name="basket" size={26} />
          </span>
          <h2>Welcome back.</h2>
          <p>Sign in to your household’s expense tracker.</p>
          <form onSubmit={handleSubmit}>
            <label>
              Username
              <input
                className="field"
                type="text"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </label>
            <label>
              Password
              <input
                className="field"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </label>
            {error && (
              <p role="alert" className="error-banner">
                {error}
              </p>
            )}
            <button type="submit" className="primary" disabled={loading}>
              {loading ? "Signing in…" : "Sign in"}
              <Icon name="arrow" size={18} />
            </button>
          </form>
          <p className="login-footer">
            Your household. Your receipts. All in one place.
          </p>
        </div>
      </div>
    </div>
  );
}
