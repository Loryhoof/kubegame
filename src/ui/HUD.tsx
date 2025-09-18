import "../../index.css";
import React, { useState, useEffect } from "react";
import { ServerNotification } from "../main";

type EventData = {
  networkId: string;
  position: { x: number; y: number; z: number };
  coins: number;
  health: number;
  playerCount: number;
  ping: number;
};

export default function HUD() {
  const [networkId, setNetworkId] = useState("Server: connecting...");
  const [playerCount, setPlayerCount] = useState(0);
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [health, setHealth] = useState(100);
  const [coins, setCoins] = useState(0);
  const [ping, setPing] = useState(0);
  const [notifications, setNotifications] = useState<ServerNotification[]>([]);

  useEffect(() => {
    function onPlayerUpdate(e: CustomEvent<EventData>) {
      const eventDetails = e.detail;
      setNetworkId(eventDetails.networkId);
      setPosition({ ...eventDetails.position });
      setCoins(eventDetails.coins);
      setHealth(eventDetails.health);
      setPlayerCount(eventDetails.playerCount);
      setPing(eventDetails.ping);
    }

    function onServerNotification(e: CustomEvent<ServerNotification>) {
      const notif = e.detail;
      setNotifications((prev) => [...prev, notif]);

      setTimeout(() => {
        setNotifications((prev) => prev.slice(1));
      }, 2500); // short display time for game feel
    }

    window.addEventListener("player-update", onPlayerUpdate as EventListener);
    window.addEventListener(
      "server-notification",
      onServerNotification as EventListener
    );

    return () => {
      window.removeEventListener(
        "player-update",
        onPlayerUpdate as EventListener
      );
      window.removeEventListener(
        "server-notification",
        onServerNotification as EventListener
      );
    };
  }, []);

  const getNotificationStyle = (type: string) => {
    switch (type) {
      case "error":
        return "bg-red-500/70";
      case "success":
        return "bg-green-500/70";
      default:
        return "bg-blue-500/70"; // info
    }
  };

  return (
    <>
      {/* Game-style subtle notifications */}
      <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center space-y-1 z-[1000]">
        {notifications.map((n, index) => (
          <p
            key={index}
            className={`px-3 py-1 rounded text-sm font-semibold text-white shadow-md transition-all duration-300 ${getNotificationStyle(
              n.type
            )}`}
            style={{ animation: "fadeInOut 2.5s forwards" }}
          >
            {n.content}
          </p>
        ))}
      </div>

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
