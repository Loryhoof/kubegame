import React from "react";
import ReactDOM from "react-dom/client";
import HUD from "./HUD";
import InteractButton from "./InteractButton";
import MobileControls from "./MobileControls";

ReactDOM.createRoot(
  document.getElementById("react-root") as HTMLElement
).render(
  <React.StrictMode>
    <HUD />
    <InteractButton />
    <MobileControls />
  </React.StrictMode>
);
