import { useEffect, useState } from "react";
import "../../index.css";
import { GameManager } from "../GameManager";
import { parseInviteURL } from "../utils";
import { GoogleLogin } from "@react-oauth/google";
import { handleGoogleLogin } from "../services/authService";
import { useAuthValidate } from "../auth/useAuthValidate";
import { FaDiscord } from "react-icons/fa";

import { useNavigate } from "react-router-dom";

const Footer = () => {
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-5">
      <div className="flex flex-row text-sm gap-6 items-center">
        {/* Discord Link */}
        <a
          className="hover:underline"
          target="_blank"
          rel="noopener noreferrer"
          href="https://discord.gg/xYEgggpKHg"
        >
          <span className="flex row gap-2 items-center">
            <FaDiscord />
            Join us on Discord!
          </span>
        </a>

        {/* Patch Notes Button */}
        <button
          onClick={() => navigate("/patch-notes")}
          className="hover:underline opacity-80 hover:opacity-100 transition"
        >
          Patch Notes
        </button>
      </div>
    </div>
  );
};

const StartingScreen = () => {
  const { authenticated, loading, revalidate } = useAuthValidate();
  const [loginError, setLoginError] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [lobbyId, setLobbyId] = useState<string | null>(null);

  const handleJoinWorld = () => {
    GameManager.instance.joinWorld();
  };

  const handleLogout = () => {
    localStorage.removeItem("jwt");
    window.location.href = "/";
  };

  useEffect(() => {
    const data = parseInviteURL();
    if (data) setLobbyId(data);
  }, []);

  return (
    <div className="text-white flex flex-col w-screen h-screen items-center justify-center bg-gray-900 user-select-none">
      <div className="text-3xl font-extrabold text-yellow-400 tracking-wider font-mono mb-8">
        kubegame
      </div>

      <div>
        {loading && <div>Checking session...</div>}

        {!loading && !authenticated && !loginLoading && (
          <div className="flex flex-col items-center gap-2">
            <GoogleLogin
              onSuccess={async (res) => {
                setLoginLoading(true);
                setLoginError(false);

                const success = await handleGoogleLogin(res.credential);
                if (!success) setLoginError(true);
                else await revalidate();

                setLoginLoading(false);
              }}
              onError={() => setLoginError(true)}
            />

            {loginError && (
              <div className="text-red-400 text-sm mt-2">
                Login failed. Try again.
              </div>
            )}
          </div>
        )}

        {loginLoading && <div className="text-gray-400">Logging in...</div>}

        {!loading && authenticated && (
          <div className="flex flex-col gap-3 items-center">
            <div
              onClick={handleJoinWorld}
              className="border-2 border-white font-bold text-white px-24 py-3 hover:bg-white hover:text-black text-center cursor-pointer"
            >
              {lobbyId ? (
                <>
                  Join Lobby <span className="text-yellow-400">{lobbyId}</span>
                </>
              ) : (
                "Join World"
              )}
            </div>

            <button
              onClick={handleLogout}
              className="text-sm text-gray-400 hover:text-white underline mt-2"
            >
              Logout
            </button>
          </div>
        )}
      </div>

      <Footer />
    </div>
  );
};

export default StartingScreen;
