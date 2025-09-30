import "../../index.css";
import React, { useState, useEffect } from "react";
import { ServerNotification } from "../main";

type LocalNotification = ServerNotification & {
  id: number;
  fading?: boolean;
};

export default function Notifications() {
  const [notifications, setNotifications] = useState<LocalNotification[]>([]);
  const FADE_DURATION = 500; // ms

  useEffect(() => {
    let counter = 0;
    function onServerNotification(e: CustomEvent<ServerNotification>) {
      const id = counter++;
      const notif: LocalNotification = { id, ...e.detail };

      setNotifications((prev) => [...prev, notif]);

      // Start fade-out after duration
      const duration = notif.duration ?? 3500;
      setTimeout(() => {
        setNotifications((prev) =>
          prev.map((n) => (n.id === id ? { ...n, fading: true } : n))
        );

        // Remove fully after fade completes
        setTimeout(() => {
          setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, FADE_DURATION);
      }, duration);
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
      case "achievement":
        return "bg-purple-500/70";
      default:
        return "bg-blue-500/70";
    }
  };

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 flex flex-col items-center space-y-1 z-[1000] user-select-none">
      {notifications.map((n) => (
        <p
          key={n.id}
          className={`px-3 py-1 rounded text-sm font-semibold text-white shadow-md transition-all duration-300 ${getNotificationStyle(
            n.type
          )} ${n.fading ? "fade-out" : "fade-in"}`}
        >
          {n.content}
        </p>
      ))}
    </div>
  );
}
