import "../../index.css";
import React, { useEffect, useState } from "react";

export default function Crosshair() {
  const [showCrosshair, setShowCrosshair] = useState(false);

  useEffect(() => {
    function onPlayerUpdate(e: CustomEvent<any>) {
      const eventDetails = e.detail;
      setShowCrosshair(eventDetails.showCrosshair);
    }

    window.addEventListener("player-update", onPlayerUpdate as EventListener);

    return () => {
      window.removeEventListener(
        "player-update",
        onPlayerUpdate as EventListener
      );
    };
  }, []);

  return (
    <>
      {showCrosshair && (
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none user-select-none">
          <div className="relative w-6 h-6">
            {" "}
            {/* a bit bigger container */}
            {/* Top line */}
            <div className="absolute top-0 left-1/2 w-[2px] h-2 bg-black -translate-x-1/2" />
            {/* Bottom line */}
            <div className="absolute bottom-0 left-1/2 w-[2px] h-2 bg-black -translate-x-1/2" />
            {/* Left line */}
            <div className="absolute left-0 top-1/2 w-2 h-[2px] bg-black -translate-y-1/2" />
            {/* Right line */}
            <div className="absolute right-0 top-1/2 w-2 h-[2px] bg-black -translate-y-1/2" />
          </div>
        </div>
      )}
    </>
  );
}
