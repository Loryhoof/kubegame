import "../../index.css";
import React, { useState, useEffect } from "react";
import { ServerNotification } from "../main";

export default function Notifications() {
  const [notifications, setNotifications] = useState<ServerNotification[]>([]);

  useEffect(() => {
    function onServerNotification(e: CustomEvent<ServerNotification>) {
      const notif = e.detail;
      setNotifications((prev) => [...prev, notif]);

      setTimeout(() => {
        setNotifications((prev) => prev.slice(1));
      }, notif.duration ?? 3500); // short display time for game feel
    }

    window.addEventListener(
      "server-notification",
      onServerNotification as EventListener
    );

    return () => {
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
            )} fade-in-out`}
          >
            {n.content}
          </p>
        ))}
      </div>
    </>
  );
}
