import React from "react";
import ReactDOM from "react-dom/client";
import HUD from "./HUD";
import InteractButton from "./InteractButton";
import MobileControls from "./MobileControls";
import InfoBar from "./InfoBar";
import LoadingScreen from "./LoadingScreen";

ReactDOM.createRoot(
  document.getElementById("react-root") as HTMLElement
).render(
  <React.StrictMode>
    <LoadingScreen />
    <HUD />
    <InteractButton />
    <MobileControls />
    <InfoBar />
  </React.StrictMode>
);
