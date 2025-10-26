import { useState, useEffect, useCallback } from "react";
import { BiCoinStack } from "react-icons/bi";

import { LobbyDetails, MinigameMeta } from "../types/Lobby";
import { ItemSlot } from "../ClientPlayer";

type WeaponData = {
  ammo: number;
  capacity: number;
  isReloading: boolean;
  reloadProgress?: number;
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
  isDead: boolean;
  lobbyDetails: LobbyDetails;
  selectedItemSlot: number;
  itemSlots: ItemSlot[];
};

{
  /* Item Slots (with dummy data) */
}
const items = [
  { name: "Hands", icon: "/icons/hands.png" },
  { name: "Knife", icon: "/icons/knife.png" },
  { name: "Pistol", icon: "/icons/pistol.png" },
  { name: "Empty", icon: null },
];

const selectedSlot = 0; // highlight slot #2 for now (dummy)

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
    isDead: false,
    lobbyDetails: null as LobbyDetails | null,
    selectedItemSlot: 0,
    itemSlots: [] as ItemSlot[],
  });

  const [deathState, setDeathState] = useState(null);

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
      isDead: d.isDead,
      lobbyDetails: d.lobbyDetails,
      selectedItemSlot: d.selectedItemSlot,
      itemSlots: d.itemSlots,
    });
  }, []);

  const formatLobbyDetails = () => {
    if (!lobbyDetails) return "Unknown Lobby";
    if (lobbyDetails.type == "Hub") return "Hub World";
    if (lobbyDetails.type == "Minigame") return `Lobby Id: ${lobbyDetails.id}`;
    return "Oops...";
  };

  const MinigameInfo = ({ minigame }: { minigame: MinigameMeta }) => (
    <div className="fixed top-3 left-1/2">
      <div>
        <p>{minigame.type}</p>
        <p>{minigame.name}</p>
        <p>{minigame.description}</p>
      </div>
    </div>
  );

  useEffect(() => {
    window.addEventListener("player-update", onPlayerUpdate as EventListener);
    return () =>
      window.removeEventListener(
        "player-update",
        onPlayerUpdate as EventListener
      );
  }, [onPlayerUpdate]);

  const {
    playerCount,
    ping,
    health,
    coins,
    position,
    weaponData,
    ammo,
    isDead,
    lobbyDetails,
    selectedItemSlot,
    itemSlots,
  } = state;

  return (
    <>
      {/* Top Left: Players & Ping */}
      <div className="fixed top-3 left-3 z-[1000] min-w-[150px] bg-black/50 rounded-md p-2 text-white text-xs leading-[1.6] space-y-1 user-select-none">
        <div>{formatLobbyDetails()}</div>
        <div className="flex justify-between text-gray-200">
          <span>{playerCount} online</span>
          <span>{ping} ms</span>
        </div>
        <div className="text-gray-300 text-[11px]">
          Pos: {position.x.toFixed(0)}, {position.y.toFixed(0)},{" "}
          {position.z.toFixed(0)}
        </div>
      </div>

      {lobbyDetails?.minigame && (
        <MinigameInfo minigame={lobbyDetails.minigame} />
      )}

      {/* Top Right: Coins */}
      <div className="fixed top-3 right-3 z-[1000] bg-black/50 rounded-md px-3 py-1 text-yellow-400 font-bold text-sm flex items-center gap-1 shadow-lg border border-yellow-500/30 user-select-none">
        <BiCoinStack />
        {coins}
      </div>

      {/* Weapon Info */}
      {weaponData && (
        <div className="absolute left-1/2 bottom-28 -translate-x-1/2 z-[1000] text-center w-28 user-select-none">
          <div className="relative w-full h-9 bg-black/40 rounded-sm flex items-center justify-center overflow-hidden border border-white/10">
            <span className="text-white text-lg font-bold z-10">
              {weaponData.ammo}/{ammo}
            </span>
            {weaponData.isReloading && (
              <div className="absolute bottom-0 left-0 h-1 w-full bg-yellow-500 z-0">
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
      <div className="absolute left-1/2 bottom-16 -translate-x-1/2 z-[1000] w-44 h-3 bg-black/60 border border-white/20 rounded-sm overflow-hidden shadow-md user-select-none">
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

      {/* Item Slots */}
      <div className="absolute left-1/2 bottom-2 -translate-x-1/2 z-[1000] user-select-none">
        <div className="flex gap-2">
          {itemSlots.map((slot, index) => {
            const isSelected = index === selectedItemSlot;
            return (
              <div
                key={index}
                className={`
            w-9 h-9 border flex flex-col
            ${
              isSelected
                ? "bg-white/15 border-white/80"
                : "bg-black/30 border-white/10"
            }
          `}
              >
                {/* Number Row */}
                <div className="w-full h-[10px] pt-1 pl-1 flex items-center">
                  <span
                    className={`text-[9px] ${
                      isSelected ? "text-gray-600" : "text-gray-200"
                    }`}
                  >
                    {index + 1}
                  </span>
                </div>

                {/* Icon Center Slot */}
                <div className="flex-1 flex items-center justify-center overflow-hidden">
                  {slot.item && (
                    <img
                      src={`/icons/${slot.item.name}.png`}
                      className="max-w-full max-h-full object-contain pointer-events-none opacity-90"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
