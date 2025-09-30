import React, { useState, useEffect, useCallback } from "react";
import NetworkManager from "../NetworkManager";

type Leaderboard = {
  id: string;
  nickname: string | null;
  time: number;
};

export default function MinigameHUD() {
  const [startTime, setStartTime] = useState<number | null>(null);
  const [elapsedTime, setElapsedTime] = useState<number>(0);

  const [hasStarted, setHasStarted] = useState<boolean>(false);
  const [hasFinished, setHasFinished] = useState<boolean>(false);

  const [serverTotalTime, setServerTotalTime] = useState<number>(0);

  const [leaderboard, setLeaderboard] = useState<Leaderboard[]>([]);

  const onMinigameStart = useCallback((e: any) => {
    const { startTime } = e.detail;
    setStartTime(startTime);
    setHasStarted(true);
    setHasFinished(false);
    setElapsedTime(0);
  }, []);

  const onMinigameEnd = useCallback((e: any) => {
    const { totalTime, leaderboard } = e.detail;
    setServerTotalTime(totalTime);
    setLeaderboard(leaderboard);
    setHasFinished(true);
  }, []);

  const onMinigameCancel = useCallback(() => {
    handleReset();
  }, []);

  // Update elapsed time
  useEffect(() => {
    if (!hasStarted || hasFinished || startTime === null) return;

    const interval = setInterval(() => {
      setElapsedTime((Date.now() - startTime) / 1000);
    }, 100);

    return () => clearInterval(interval);
  }, [hasStarted, hasFinished, startTime]);

  // Add event listeners for minigame start/end
  useEffect(() => {
    window.addEventListener("minigame-start", onMinigameStart as EventListener);
    window.addEventListener("minigame-end", onMinigameEnd as EventListener);
    window.addEventListener(
      "minigame-cancel",
      onMinigameCancel as EventListener
    );

    return () => {
      window.removeEventListener(
        "minigame-start",
        onMinigameStart as EventListener
      );
      window.removeEventListener(
        "minigame-end",
        onMinigameEnd as EventListener
      );
      window.removeEventListener(
        "minigame-cancel",
        onMinigameEnd as EventListener
      );
    };
  }, [onMinigameStart, onMinigameEnd, onMinigameCancel]);

  const localId = NetworkManager.instance?.localId;

  const handleBackToHub = useCallback(() => {
    NetworkManager.instance.getSocket().emit("minigame-exit");
    handleReset();
  }, []);

  const handleRestart = useCallback(() => {
    NetworkManager.instance.getSocket().emit("minigame-restart");
    handleReset();
  }, []);

  const handleReset = useCallback(() => {
    setStartTime(null);
    setElapsedTime(0);
    setHasStarted(false);
    setHasFinished(false);
    setServerTotalTime(0);
    setLeaderboard([]);
  }, []);

  // Keyboard shortcuts for R and B
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!hasFinished) return; // only when finished
      if (e.key.toLowerCase() === "r") handleRestart();
      if (e.key.toLowerCase() === "b") handleBackToHub();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [hasFinished, handleRestart, handleBackToHub]);

  return (
    <>
      {hasStarted && (
        <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-[1000] user-select-none">
          <div className="bg-black/70 text-white px-5 py-3 rounded-lg shadow-lg text-center min-w-[220px] max-w-[420px]">
            {!hasFinished && (
              <div className="text-lg font-semibold">
                Time elapsed:{" "}
                <span className="text-yellow-400">
                  {elapsedTime.toFixed(2)}s
                </span>
              </div>
            )}

            {hasFinished && (
              <div>
                <div className="text-lg font-semibold mb-2">
                  Finished in{" "}
                  <span className="text-green-400 font-bold">
                    {serverTotalTime}s
                  </span>
                </div>

                <div className="mt-3">
                  <h3 className="text-sm font-semibold text-gray-300 mb-1">
                    Leaderboard
                  </h3>
                  <div className="bg-white/10 rounded-md divide-y divide-white/10 text-sm max-h-48 overflow-y-auto scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-transparent">
                    {leaderboard.map((item, index) => {
                      const isLocalPlayer = item.id === localId;
                      const rankColor =
                        index === 0
                          ? "text-yellow-400"
                          : index === 1
                          ? "text-gray-300"
                          : index === 2
                          ? "text-amber-600"
                          : "text-white";

                      return (
                        <div
                          key={index}
                          className={`flex justify-between px-3 py-1 text-left gap-4 transition-colors ${
                            isLocalPlayer
                              ? "bg-green-700/40"
                              : "hover:bg-white/5"
                          }`}
                        >
                          <span className={`font-semibold ${rankColor}`}>
                            #{index + 1}
                          </span>
                          <span
                            className={`truncate flex-1 text-left ${
                              isLocalPlayer ? "font-bold text-green-300" : ""
                            }`}
                          >
                            {item.id}
                          </span>
                          <span className="font-mono w-16 text-right tabular-nums">
                            {item.time.toFixed(3)}s
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Buttons */}
                <div className="mt-4 flex gap-3 justify-center">
                  <button
                    className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white rounded-md font-semibold shadow-md transition-colors"
                    onClick={handleRestart}
                  >
                    Restart (R)
                  </button>
                  <button
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-md font-semibold shadow-md transition-colors"
                    onClick={handleBackToHub}
                  >
                    Back to Hub (B)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
