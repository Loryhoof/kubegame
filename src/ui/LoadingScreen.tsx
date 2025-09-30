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

type Error = {
  title: string;
  info: string;
};
const LoadingScreen = () => {
  const [step, setStep] = useState(0);
  const [active, setActive] = useState(true);
  const [ready, setReady] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Step animation with random delays
  useEffect(() => {
    if (!active || ready || error) return; // stop if error occurs

    let isCancelled = false;

    const nextStep = () => {
      if (isCancelled) return;

      setStep((prev) => {
        if (prev < stepStrings.length - 1) {
          const randomDelay = 400 + Math.random() * 700;
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
  }, [active, ready, error]);

  useEffect(() => {
    const onLoadingStatus = (e: any) => {
      const { ready, error } = e.detail;
      if (ready) {
        setTimeout(() => setReady(true), 1000);
      }

      if (error) {
        setError(error);
      }
    };

    window.addEventListener("loading-status", onLoadingStatus as any);
    return () =>
      window.removeEventListener("loading-status", onLoadingStatus as any);
  }, []);

  // Smoothly fill progress and fade out after extra delay
  useEffect(() => {
    if (!ready || error) return; // don't fade out if error

    const delayTimeout = setTimeout(() => {
      setFadeOut(true);
      setTimeout(() => setActive(false), 600);
    }, 1500);

    return () => clearTimeout(delayTimeout);
  }, [ready, error]);

  // Progress calculation (capped at 80% before ready)
  const progress = error
    ? ((step + 1) / stepStrings.length) * 100 // freeze at current step
    : ready
    ? 100
    : Math.min(80, ((step + 1) / stepStrings.length) * 100);

  return (
    <>
      {active && (
        <div
          className={`fixed inset-0 z-[1000] flex items-center justify-center bg-gray-900 select-none transition-opacity duration-500 user-select-none ${
            fadeOut ? "opacity-0" : "opacity-100"
          }`}
        >
          <div className="p-6 rounded-lg w-96 flex flex-col items-center space-y-4">
            <h1 className="text-3xl font-bold text-yellow-400 tracking-wider font-mono">
              kubegame
            </h1>

            {!error && (
              <p className="text-lg font-bold font-mono h-6 text-gray-200">
                {ready ? finalText : stepStrings[step]}
                <span className="loading-dots"></span>
              </p>
            )}

            {error && (
              <div className=" text-red-500 flex flex-col items-center text-center gap-2">
                <p className="font-bold text-xl">{error.title}</p>
                <p className="font-semibold text-red-900 bg-red-400 p-2">
                  {error.info}
                </p>
              </div>
            )}

            {/* Blocky progress bar */}
            {!error && (
              <div className="w-full bg-gray-800 h-6 flex overflow-hidden">
                <div
                  className={`h-full transition-all duration-500 ease-out ${
                    error ? "bg-red-500" : "bg-yellow-400"
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            )}

            {!error && (
              <p className="text-sm text-gray-400 font-mono">
                Preparing your sandbox adventure...
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default LoadingScreen;
