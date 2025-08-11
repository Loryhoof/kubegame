import React from "react";
import ReactDOM from "react-dom/client";
import HUD from "./HUD";

ReactDOM.createRoot(
  document.getElementById("react-root") as HTMLElement
).render(
  <React.StrictMode>
    <HUD />
  </React.StrictMode>
);
