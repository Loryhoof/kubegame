import React, { useState, useEffect } from "react";

type EventData = {
  networkId: string;
  position: { x: number; y: number; z: number };
  coins: number;
  health: number;
  playerCount: number;
};

export default function HUD() {
  const [networkId, setNetworkId] = useState("Server: connecting...");
  const [players, setPlayers] = useState<string[]>([]);
  const [playerCount, setPlayerCount] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [health, setHealth] = useState(100);
  const [coins, setCoins] = useState(0);

  useEffect(() => {
    // Define the event handler with a typed CustomEvent
    function onPlayerUpdate(e: CustomEvent<EventData>) {
      const eventDetails = e.detail;
      setNetworkId(eventDetails.networkId);
      setPosition(eventDetails.position);
      setCoins(eventDetails.coins);
      setHealth(eventDetails.health);
      setPlayerCount(eventDetails.playerCount);
    }

    // Add event listener with type cast
    window.addEventListener("player-update", onPlayerUpdate as EventListener);

    // Cleanup on unmount
    return () => {
      window.removeEventListener(
        "player-update",
        onPlayerUpdate as EventListener
      );
    };
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        top: 10,
        left: 10,
        zIndex: 1000,
        fontFamily: "Arial",
        fontSize: 14,
        color: "white",
      }}
    >
      <div style={boxStyle}>{networkId}</div>
      {/* <div style={boxStyle}>Players: {players.join(", ")}</div> */}
      <div style={boxStyle}>{playerCount} Online</div>
      <div style={boxStyle}>
        Pos: {position.x.toFixed(0)}, {position.y.toFixed(0)},{" "}
        {position.z.toFixed(0)}
      </div>
      <div style={boxStyle}>Health: {health.toFixed(0)}</div>
      <div style={boxStyle}>Coins: {coins}</div>
    </div>
  );
}

const boxStyle: React.CSSProperties = {
  background: "rgba(0, 0, 0, 0.5)",
  padding: "5px 10px",
  borderRadius: "5px",
  marginBottom: "5px",
  userSelect: "none",
};
