import { useEffect, useState } from "react";
import "../../index.css";

import HUD from "./HUD";
import InfoBar from "./InfoBar";
import InteractButton from "./InteractButton";
import LoadingScreen from "./LoadingScreen";
import MobileControls from "./MobileControls";
import Chat from "./Chat";
import { isMobile } from "../utils";
import Notifications from "./Notifications";
import Crosshair from "./Crosshair";
import DeathScreen from "./DeathScreen";

export type DeathState = {
  kills: number;
};

const Main = () => {
  const [ready, setReady] = useState<boolean>(false);

  const [isDead, setIsDead] = useState<boolean>(false);
  const [deathState, setDeathState] = useState<DeathState | null>(null);

  useEffect(() => {
    const onLoadingStatus = (e: CustomEvent<any>) => {
      const { ready } = e.detail;

      setReady(ready);
    };

    const onUIState = (e: CustomEvent<any>) => {
      const d = e.detail;

      setIsDead(d.isDead);
      setDeathState(d.state);
    };

    window.addEventListener("loading-status", onLoadingStatus as any);
    window.addEventListener("ui-state", onUIState as any);

    return () => {
      window.removeEventListener("loading-status", onLoadingStatus as any);
      window.removeEventListener("ui-state", onUIState as any);
    };
  }, []);

  return (
    <>
      {ready && (
        <>
          {isDead && deathState && <DeathScreen state={deathState} />}

          {!isDead && (
            <>
              <HUD />
              <InteractButton />
              <MobileControls />
              <InfoBar />
              <Notifications />
              {!isMobile() && <Chat />}
              <Crosshair />
            </>
          )}
        </>
      )}
      <LoadingScreen />
    </>
  );
};

export default Main;
