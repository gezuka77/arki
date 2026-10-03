import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import "./index.css";
import { watchDisplayMode } from "./utils/displayMode";

const stopWatchingDisplayMode = watchDisplayMode();
if (import.meta.hot) import.meta.hot.dispose(stopWatchingDisplayMode);

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
