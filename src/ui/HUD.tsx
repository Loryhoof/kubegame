import "../../index.css";
import React, { useState, useEffect } from "react";

type WeaponData = {
  ammo: number;
  capacity: number;
};

type EventData = {
  networkId: string;
  position: { x: number; y: number; z: number };
  coins: number;
  health: number;
  playerCount: number;
  ping: number;
  weapon: WeaponData;
};

export default function HUD() {
  const [networkId, setNetworkId] = useState("Server: connecting...");
  const [playerCount, setPlayerCount] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [health, setHealth] = useState(100);
  const [coins, setCoins] = useState(0);
  const [ping, setPing] = useState(0);
  const [weaponData, setWeaponData] = useState<WeaponData | null>(null);

  useEffect(() => {
    function onPlayerUpdate(e: CustomEvent<EventData>) {
      const eventDetails = e.detail;
      setNetworkId(eventDetails.networkId);
      setPosition({ ...eventDetails.position });
      setCoins(eventDetails.coins);
      setHealth(eventDetails.health);
      setPlayerCount(eventDetails.playerCount);
      setPing(eventDetails.ping);

      setWeaponData(eventDetails.weapon);
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
      {/* HUD stats */}
      <div
        style={{
          position: "fixed",
          top: 10,
          left: 10,
          zIndex: 1000,
          fontSize: 14,
          color: "white",
        }}
      >
        <div style={boxStyle}>Ping: {ping} ms</div>
        <div style={boxStyle}>{networkId}</div>
        <div style={boxStyle}>{playerCount} Online</div>
        <div style={boxStyle}>
          Pos: {position.x.toFixed(0)}, {position.y.toFixed(0)},{" "}
          {position.z.toFixed(0)}
        </div>
        <div style={boxStyle}>Health: {health.toFixed(0)}</div>
        <div style={boxStyle}>Coins: {coins}</div>
      </div>

      {/* Weapon data display */}
      {weaponData && (
        <div className="absolute left-1/2 bottom-5 -translate-x-1/2 -translate-y-1/2 z-[1000] pointer-events-none">
          {weaponData.ammo}/{weaponData.capacity}
        </div>
      )}
    </>
  );
}

const boxStyle: React.CSSProperties = {
  background: "rgba(0, 0, 0, 0.5)",
  padding: "5px 10px",
  borderRadius: "5px",
  marginBottom: "5px",
  userSelect: "none",
};

// Add this to your CSS somewhere (e.g., index.css):
/*
@keyframes fadeInOut {
  0% { opacity: 0; transform: translateY(-10px); }
  10% { opacity: 1; transform: translateY(0); }
  80% { opacity: 1; transform: translateY(0); }
  100% { opacity: 0; transform: translateY(-10px); }
}
*/
