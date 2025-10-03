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
import StartingScreen from "./StartingScreen";
import DebugState from "../state/DebugState";
import MinigameHUD from "./MinigameHUD";
import LobbyFinder from "./Lobby/LobbyFinder";

export type DeathState = {
  kills: number;
};

const VersionSection = () => {
  return (
    <p className="fixed bottom-5 right-5 text-xs z-[9999] text-white user-select-none">
      v{DebugState.instance.buildVersion}
    </p>
  );
};

const Main = () => {
  const [ready, setReady] = useState<boolean>(false);

  const [isDead, setIsDead] = useState<boolean>(false);
  const [deathState, setDeathState] = useState<DeathState | null>(null);

  const [worldIsLoading, setWorldIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const url = new URL(window.location.href);
    const params = url.searchParams;

    const lobbyId = params.get("lobby");

    if (lobbyId) {
      console.log(`Invite to lobby: ${lobbyId}`);
    }
  }, []);

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

    const onStartLoadingWorld = () => {
      setWorldIsLoading(true);
      console.log("event called");
    };

    window.addEventListener("loading-status", onLoadingStatus as any);
    window.addEventListener("ui-state", onUIState as any);
    window.addEventListener("join-world", onStartLoadingWorld as any);

    return () => {
      window.removeEventListener("loading-status", onLoadingStatus as any);
      window.removeEventListener("ui-state", onUIState as any);
      window.removeEventListener("join-world", onStartLoadingWorld as any);
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
              <MinigameHUD />
              <LobbyFinder />
            </>
          )}
        </>
      )}

      {!worldIsLoading && <StartingScreen />}
      {worldIsLoading && <LoadingScreen />}
      {/* <LoadingScreen /> */}

      <VersionSection />
    </>
  );
};

export default Main;
