import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Add global error handler to prevent WebSocket errors from breaking the app
window.addEventListener('error', (event) => {
  // Suppress WebSocket connection errors that prevent app loading
  if (event.message && event.message.includes('WebSocket')) {
    console.warn('WebSocket error suppressed:', event.message);
    event.preventDefault();
    return false;
  }
});

// Handle unhandled promise rejections
window.addEventListener('unhandledrejection', (event) => {
  // Suppress WebSocket-related promise rejections
  if (event.reason && event.reason.toString().includes('WebSocket')) {
    console.warn('WebSocket promise rejection suppressed:', event.reason);
    event.preventDefault();
    return false;
  }
});

createRoot(document.getElementById("root")!).render(<App />);
