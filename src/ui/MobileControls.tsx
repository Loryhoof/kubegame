import "../../index.css";
import { isIOS, isMobile } from "../utils";
import React, { useEffect, useState } from "react";
import Joystick from "./Joystick";

type EventData = {
  networkId: string;
  position: { x: number; y: number; z: number };
  coins: number;
  health: number;
  playerCount: number;
  ping: number;
};

export default function MobileControls() {
  const [isActive, setIsActive] = useState(false);

  const ios = isIOS();

  const handleAction = (action: string, pressed: boolean) => {
    if (action === "openLobby" && pressed) {
      window.dispatchEvent(new Event("open-lobby-finder"));
      return;
    }

    const event = new CustomEvent("mobile-buttons", {
      detail: { action, pressed } as any,
    });
    window.dispatchEvent(event);
  };

  useEffect(() => {
    setIsActive(isMobile());
  }, []);

  const createButton = (label: string, key: string) => (
    <button
      className="bg-white text-black text-sm font-bold p-2 rounded-xl w-12 h-12 active:bg-gray-200 user-select-none"
      onMouseDown={(e) => {
        e.preventDefault();
        handleAction(key, true);
      }}
      onMouseUp={(e) => {
        e.preventDefault();
        handleAction(key, false);
      }}
      onMouseLeave={(e) => {
        e.preventDefault();
        handleAction(key, false);
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        handleAction(key, true);
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        handleAction(key, false);
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {label.toUpperCase()}
    </button>
  );

  return (
    <>
      {isActive && (
        <>
          {/* Left side */}
          <div className="fixed z-[10000] bottom-1/3 left-4 user-select-none">
            <div className="flex flex-col space-y-2">
              {createButton("R", "reload")}

              {createButton("Aim", "aim")}
            </div>
          </div>

          {/* Right side */}
          <div className="fixed z-[10000] bottom-4 right-4">
            <div className="flex flex-col space-y-2">
              {!ios && (
                <button
                  className=""
                  onClick={() => {
                    document.documentElement.requestFullscreen();
                  }}
                >
                  FS
                </button>
              )}
              {createButton("Lobby", "openLobby")}

              {createButton("Car", "spawnVehicle")}

              {createButton("Use", "interact")}
              {createButton("Hit", "shoot")}
              {createButton("JMP", "jump")}
              {createButton("RUN", "sprint")}
            </div>
          </div>

          <Joystick side="left" eventName="mobile-controls" />
          <Joystick side="right" eventName="camera-controls" />
        </>
      )}
    </>
  );
}
