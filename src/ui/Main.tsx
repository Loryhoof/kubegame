import { useEffect, useState } from "react";
import "../../index.css";

import HUD from "./HUD";
import InfoBar from "./InfoBar";
import InteractButton from "./InteractButton";
import LoadingScreen from "./LoadingScreen";
import MobileControls from "./MobileControls";
import Chat from "./Chat";
import { isMobile } from "../utils";
import { StartScreen } from "./StartScreen";

const Main = () => {
  const [ready, setReady] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const onLoadingStatus = (e: CustomEvent<any>) => {
      const { ready } = e.detail;

      setReady(ready);
    };

    window.addEventListener("loading-status", onLoadingStatus as any);

    return () => {
      window.removeEventListener("loading-status", onLoadingStatus as any);
    };
  }, []);

  return (
    <>
      {ready && (
        <>
          <HUD />
          <InteractButton />
          <MobileControls />
          <InfoBar />
          {!isMobile() && <Chat />}
        </>
      )}
      {!loading && (
        <StartScreen
          onStart={() => {
            setLoading(true);
          }}
        />
      )}
      {loading && <LoadingScreen />}
    </>
  );
};

export default Main;
