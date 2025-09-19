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

const Main = () => {
  const [ready, setReady] = useState<boolean>(false);

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
          <Notifications />
          {!isMobile() && <Chat />}
        </>
      )}
      <LoadingScreen />
    </>
  );
};

export default Main;
