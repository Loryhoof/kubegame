import { useEffect, useState } from "react";
import "../../index.css";
import { GameManager } from "../GameManager";
import { parseInviteURL } from "../utils";
import { handleGoogleLogin, handleGuestLogin } from "../services/authService";
import { useAuthValidate } from "../auth/useAuthValidate";
import { FaDiscord } from "react-icons/fa";
import { FcGoogle } from "react-icons/fc";

import { googleLogout } from "@react-oauth/google";
import { useNavigate } from "react-router-dom";

declare global {
  interface Window {
    google?: any;
  }
}

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
  const [googleClient, setGoogleClient] = useState<any>(null);

  useEffect(() => {
    const data = parseInviteURL();
    if (data) setLobbyId(data);

    // Initialize Google OAuth client
    const initializeGoogle = () => {
      if (!window.google || !window.google.accounts?.oauth2) {
        console.error(
          "Google OAuth script not loaded. Make sure it's in index.html"
        );
        return;
      }

      const client = window.google.accounts.oauth2.initCodeClient({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        scope: "openid email profile",
        ux_mode: "popup",
        callback: async (response: any) => {
          try {
            if (!response.code) {
              console.error("No code returned from Google:", response);
              setLoginError(true);
              return;
            }

            setLoginLoading(true);
            setLoginError(false);

            // Send the code to your backend
            const success = await handleGoogleLogin(response.code);
            if (!success) setLoginError(true);
            else await revalidate();
          } catch (err) {
            console.error("Login error:", err);
            setLoginError(true);
          } finally {
            setLoginLoading(false);
          }
        },
      });

      setGoogleClient(client);
    };

    if (window.google) {
      initializeGoogle();
    } else {
      const interval = setInterval(() => {
        if (window.google) {
          clearInterval(interval);
          initializeGoogle();
        }
      }, 300);
      setTimeout(() => clearInterval(interval), 8000);
    }
  }, []);

  const handleGoogleClick = () => {
    if (!googleClient) {
      setLoginError(true);
      return;
    }
    googleClient.requestCode();
  };

  const handleJoinWorld = () => {
    GameManager.instance.joinWorld();
  };

  const handleGuestJoin = async () => {
    try {
      setLoginLoading(true);
      setLoginError(false);

      const success = await handleGuestLogin();

      if (!success) {
        setLoginError(true);
        return;
      }

      // re-run auth validation (will set authenticated=true)
      await revalidate();
    } catch (err) {
      console.error("Guest login error:", err);
      setLoginError(true);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("jwt");
    googleLogout();
    window.location.href = "/";
  };

  return (
    <div className="text-white flex flex-col w-screen h-screen items-center justify-center bg-gray-900 user-select-none">
      <div className="text-3xl font-extrabold text-yellow-400 tracking-wider font-mono mb-8">
        kubegame
      </div>

      <div>
        {loading && <div>Checking session...</div>}

        {/* Not logged in */}
        {!loading && !authenticated && !loginLoading && (
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={handleGoogleClick}
              className="flex items-center justify-center gap-3 bg-white text-black font-semibold px-6 py-3 rounded-md hover:bg-gray-200 transition w-54"
            >
              <FcGoogle className="w-5 h-5" />
              <span className="text-center">Sign in with Google</span>
            </button>

            <button
              onClick={handleGuestJoin}
              className="text-gray-400 hover:text-white underline text-sm"
            >
              Continue as guest
            </button>

            {loginError && (
              <div className="text-red-400 text-sm mt-2">
                Login failed. Try again.
              </div>
            )}
          </div>
        )}

        {/* Loading */}
        {loginLoading && <div className="text-gray-400">Loading...</div>}

        {/* Logged in */}
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
