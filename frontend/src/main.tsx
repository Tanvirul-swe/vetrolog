import React from "react";
import { createRoot } from "react-dom/client";
import "@/style.css";
import App from "@/App";
import { useThemeStore } from "@/stores/useThemeStore";

// Initialize theme listener for system theme changes & persistence
useThemeStore.getState().initTheme();

const container = document.getElementById("root");

const root = createRoot(container!);

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
