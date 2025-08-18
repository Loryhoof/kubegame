import "../../index.css";
import { isMobile } from "../utils";
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

  const handleKey = (key: string, pressed: boolean) => {
    const event = new CustomEvent("mobile-buttons", {
      detail: { key, pressed } as any,
    });
    window.dispatchEvent(event);
  };

  useEffect(() => {
    setIsActive(isMobile());
  }, []);

  const createButton = (label: string, key: string) => (
    <button
      className="bg-white text-black text-sm font-bold p-2 rounded-xl w-12 h-12 active:bg-red-500 user-select-none"
      onMouseDown={(e) => {
        e.preventDefault();
        handleKey(key, true);
      }}
      onMouseUp={(e) => {
        e.preventDefault();
        handleKey(key, false);
      }}
      onMouseLeave={(e) => {
        e.preventDefault();
        handleKey(key, false);
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        handleKey(key, true);
      }}
      onTouchEnd={(e) => {
        e.preventDefault();
        handleKey(key, false);
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
          <div className="fixed z-[10000] bottom-4 right-4">
            <div className="flex flex-col space-y-2">
              <button
                className=""
                onClick={() => {
                  document.documentElement.requestFullscreen();
                }}
              >
                FS
              </button>
              {createButton("Car", "k")}

              {createButton("Use", "e")}
              {createButton("Hit", "mouseLeft")}
              {createButton("JMP", " ")}

              {/* <button
                className=""
                onClick={() => {
                  document.documentElement.requestFullscreen();
                }}
              >
                FS
              </button> */}
            </div>
          </div>

          <Joystick side="left" eventName="mobile-controls" />
          <Joystick side="right" eventName="camera-controls" />
        </>
      )}
    </>
  );
}
