import { useEffect, useState } from "react";
import "../../index.css";

const stepStrings = [
  "Loading terrain",
  "Spawning entities",
  "Generating biomes",
  "Initializing physics engine",
  "Applying textures",
  "Loading player data",
  "Configuring controls",
  "Optimizing performance",
  "Synchronizing multiplayer",
  "Finalizing world setup",
  "Preparing inventory",
  "Loading sounds",
  "Rendering lighting",
  "Spinning up hamster wheels",
  "Reticulating splines",
  "Greasing gears",
  "Untangling spaghetti code",
];

// Final text when ready
const finalText = "Spawning in";

const LoadingScreen = () => {
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(true);
  const [ready, setReady] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  // Step animation with random delays
  useEffect(() => {
    if (!active || ready) return;

    let isCancelled = false;

    const nextStep = () => {
      if (isCancelled) return;

      setStep((prev) => {
        if (prev < stepStrings.length - 1) {
          const randomDelay = 400 + Math.random() * 700; // 0.3s to 1s
          setTimeout(nextStep, randomDelay);
          return prev + 1;
        }
        return prev;
      });
    };

    nextStep();

    return () => {
      isCancelled = true;
    };
  }, [active, ready]);

  // Listen for external "loading-status" event
  useEffect(() => {
    const onLoadingStatus = (e: any) => {
      const { ready } = e.detail;
      if (ready)
        setTimeout(() => {
          setReady(true);
        }, 1000); // add a small delay before marking ready
    };

    window.addEventListener("loading-status", onLoadingStatus as any);
    return () =>
      window.removeEventListener("loading-status", onLoadingStatus as any);
  }, []);

  // Smoothly fill progress and fade out after extra delay
  useEffect(() => {
    if (!ready) return;

    const delayTimeout = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => setActive(false), 600); // fade-out duration
    }, 1500); // extra delay before fading out

    return () => clearTimeout(delayTimeout);
  }, [ready]);

  // Progress calculation (capped at 80% before ready)
  const progress = ready
    ? 100
    : Math.min(80, ((step + 1) / stepStrings.length) * 100);

  return (
    <>
      {active && (
        <div
          className={`fixed inset-0 z-[10000] flex items-center justify-center bg-gray-900 select-none transition-opacity duration-500 ${
            fadeOut ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className=" p-6 rounded-lg w-96 flex flex-col items-center space-y-4">
            <h1 className="text-3xl font-bold text-yellow-400 tracking-wider font-mono">
              KUBEGAME
            </h1>

            {/* Step text */}
            <p className="text-lg text-gray-200 font-bold font-mono h-6">
              {ready ? finalText : stepStrings[step]}
              <span className="loading-dots"></span>
            </p>

            {/* Blocky progress bar */}
            <div className="w-full bg-gray-800 h-6 flex overflow-hidden">
              <div
                className="bg-yellow-400 h-full transition-all duration-500 ease-out"
                style={{ width: `${progress}%` }}
              />
            </div>

            <p className="text-sm text-gray-400 font-mono">
              Preparing your sandbox adventure...
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default LoadingScreen;
