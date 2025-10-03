import { useEffect, useState } from "react";
import InputManager from "../../InputManager";
import { IoIosClose } from "react-icons/io";
import NetworkManager from "../../NetworkManager";

export default function LobbyFinder() {
  const [active, setActive] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ignore if typing into an input or textarea
      const tag = (e.target as HTMLElement).tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (e.target as HTMLElement).isContentEditable
      ) {
        return;
      }

      if (e.key.toLowerCase() === "m") {
        setActive((prev) => {
          const next = !prev;

          if (next) document.exitPointerLock();
          else {
            const renderer = InputManager.instance.getRenderer();
            if (renderer) renderer.domElement.requestPointerLock();
          }

          InputManager.instance.setIgnoreKeys(next);
          return next;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleClose = () => {
    setActive(false);
    InputManager.instance.setIgnoreKeys(false);
  };

  const handleSelect = (mode: string) => {
    NetworkManager.instance.getSocket().emit("user-command", {
      command: mode,
    });
    handleClose();
  };

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center select-none">
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleClose}
      />

      {/* modal */}
      <div className="relative bg-gray-900 text-white rounded-2xl shadow-xl w-[400px] max-w-[90%] p-6 space-y-6 z-10">
        {/* header */}
        <div className="flex justify-between items-center border-b border-gray-800 pb-3">
          <h2 className="text-xl font-bold">Minigames</h2>
          <button
            className="p-1 rounded-full hover:bg-gray-800 transition"
            onClick={handleClose}
          >
            <IoIosClose className="text-3xl" />
          </button>
        </div>

        {/* mode buttons */}
        <div className="space-y-3">
          <button
            onClick={() => handleSelect("race")}
            className="w-full bg-gray-800 hover:bg-indigo-600 transition text-left py-4 px-5 rounded-lg font-semibold text-lg"
          >
            🏁 Race
          </button>

          {/* <div className="w-full bg-gray-800 text-left py-4 px-5 rounded-lg font-semibold text-lg opacity-50 relative">
            ⚔️ Deathmatch
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs bg-yellow-500 text-black px-2 py-0.5 rounded">
              Coming Soon
            </span>
          </div> */}

          <button
            onClick={() => handleSelect("deathmatch")}
            className="w-full bg-gray-800 hover:bg-indigo-600 transition text-left py-4 px-5 rounded-lg font-semibold text-lg"
          >
            ⚔️ Deathmatch
          </button>
        </div>

        {/* back to hub */}
        <button
          onClick={() => handleSelect("hub")}
          className="w-full bg-green-700 hover:bg-green-600 transition text-white py-3 px-4 rounded-lg font-semibold mt-4"
        >
          Return to Hub
        </button>
      </div>
    </div>
  );
}
