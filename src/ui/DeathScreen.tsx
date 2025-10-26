import { useState } from "react";
import { DeathState } from "./Game";
import NetworkManager from "../NetworkManager";
import { Socket } from "socket.io-client";
import { isMobile } from "../utils";

export default function DeathScreen({ state }: { state: DeathState }) {
  const [socket] = useState<Socket>(
    NetworkManager.instance.getSocket(localStorage.getItem("jwt") as string)
  );

  const handleRespawnRequest = () => {
    socket.emit("player-respawn");
  };

  return (
    <div className="fixed inset-0 z-[1000] flex flex-col items-center justify-center bg-black/90 backdrop-blur-sm text-white animate-fadeIn user-select-none">
      {/* Big dramatic title */}
      <h1 className="text-6xl font-extrabold tracking-wider text-red-500 drop-shadow-2xl animate-pulse-slow">
        YOU DIED
      </h1>

      {/* Optional stats */}
      {state && (
        <p className="mt-4 text-gray-300 text-base tracking-wide">
          Kills: {state.kills}
        </p>
      )}

      {/* Respawn hint */}
      <div className="mt-10 text-sm tracking-widest uppercase">
        {isMobile() ? (
          <button
            onClick={handleRespawnRequest}
            className="text-white bg-red-500 p-4 rounded-lg"
          >
            Respawn
          </button>
        ) : (
          <div className="text-gray-400">
            Press{" "}
            <span className="text-white px-2 py-1 bg-white/10 rounded border border-white/20">
              R
            </span>{" "}
            to respawn
          </div>
        )}
      </div>

      {/* Animations */}
      <style>{`
        @keyframes fadeIn {
          0% { opacity: 0; transform: scale(1.05); }
          100% { opacity: 1; transform: scale(1); }
        }
        @keyframes pulseSlow {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.05); }
        }
        .animate-fadeIn { animation: fadeIn 0.4s ease-out forwards; }
        .animate-pulse-slow { animation: pulseSlow 2s ease-in-out infinite; }
      `}</style>
    </div>
  );
}
