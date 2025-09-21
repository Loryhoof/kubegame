import React, { useState, useEffect, useCallback } from "react";

import { BiCoinStack } from "react-icons/bi";

type WeaponData = {
  ammo: number;
  capacity: number;
  isReloading: boolean;
  reloadProgress?: number; // 0 → 1 for slider fill
};

type EventData = {
  networkId: string;
  position: { x: number; y: number; z: number };
  coins: number;
  health: number;
  playerCount: number;
  ping: number;
  weapon: WeaponData;
  ammo: number;
};

export default function HUD() {
  const [state, setState] = useState({
    networkId: "Server: connecting...",
    playerCount: 0,
    position: { x: 0, y: 0, z: 0 },
    health: 100,
    coins: 0,
    ping: 0,
    weaponData: null as WeaponData | null,
    ammo: 0,
  });

  const onPlayerUpdate = useCallback((e: CustomEvent<EventData>) => {
    const d = e.detail;
    setState({
      networkId: d.networkId,
      position: d.position,
      coins: d.coins,
      health: d.health,
      playerCount: d.playerCount,
      ping: d.ping,
      ammo: d.ammo,
      weaponData: d.weapon,
    });
  }, []);

  useEffect(() => {
    window.addEventListener("player-update", onPlayerUpdate as EventListener);
    return () =>
      window.removeEventListener(
        "player-update",
        onPlayerUpdate as EventListener
      );
  }, [onPlayerUpdate]);

  const { playerCount, ping, health, coins, position, weaponData, ammo } =
    state;

  return (
    <>
      {/* Top Left: Players & Ping */}
      <div className="fixed top-3 left-3 z-[1000] min-w-[150px] bg-black/50 rounded-md p-2 text-white text-xs leading-[1.6] space-y-1">
        <div className="flex justify-between text-gray-200">
          <span>{playerCount} online</span>
          <span>{ping} ms</span>
        </div>

        <div className="text-gray-300 text-[11px]">
          Pos: {position.x.toFixed(0)}, {position.y.toFixed(0)},{" "}
          {position.z.toFixed(0)}
        </div>
      </div>

      {/* Top Right: Coins */}
      <div className="fixed top-3 right-3 z-[1000] bg-black/50 rounded-md px-3 py-1 text-yellow-400 font-bold text-sm flex items-center gap-1 shadow-lg border border-yellow-500/30">
        {/* <img
          src="/icons/coin.png"
          alt="coin"
          className="w-4 h-4 inline-block"
        /> */}

        <BiCoinStack />

        {coins}
      </div>

      {/* Weapon Info */}
      {weaponData && (
        <div className="absolute left-1/2 bottom-20 -translate-x-1/2 z-[1000] text-center w-28">
          <div className="relative w-full h-9 bg-black/40 rounded-sm flex items-center justify-center overflow-hidden border border-white/10">
            <span className="text-white text-lg font-bold z-10">
              {weaponData.ammo}/{ammo}
            </span>
            {weaponData.isReloading && (
              <div className="absolute bottom-0 left-0 h-1 w-full bg-yellow-500 animate-reload-pixel  z-0">
                <div
                  className="h-full bg-yellow-400 transition-all duration-100"
                  style={{
                    width: `${(weaponData.reloadProgress ?? 0) * 100}%`,
                  }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Health Bar */}
      <div className="absolute left-1/2 bottom-10 -translate-x-1/2 z-[1000] w-44 h-3 bg-black/60 border border-white/20 rounded-sm overflow-hidden shadow-md">
        <div
          className={`h-full transition-all duration-200 ${
            health > 50
              ? "bg-green-500"
              : health > 25
              ? "bg-yellow-400"
              : "bg-red-500"
          }`}
          style={{ width: `${Math.max(0, Math.min(100, health))}%` }}
        />
      </div>
    </>
  );
}
