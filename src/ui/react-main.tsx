import React from "react";
import ReactDOM from "react-dom/client";
import HUD from "./HUD";
import InteractButton from "./InteractButton";

ReactDOM.createRoot(
  document.getElementById("react-root") as HTMLElement
).render(
  <React.StrictMode>
    <HUD />
    <InteractButton />
  </React.StrictMode>
);
