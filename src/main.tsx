import React from "react";
import ReactDOM from "react-dom/client";
import { DbProvider } from "./db/DbProvider";
import App from "./App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DbProvider>
      <App />
    </DbProvider>
  </React.StrictMode>,
);
