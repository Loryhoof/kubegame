import { useState, useEffect, useRef } from "react";
import "../../index.css";
import InputManager from "../InputManager";
import NetworkManager from "../NetworkManager";
import { Socket } from "socket.io-client";
import DebugState from "../state/DebugState";
import { LocalUserSettings } from "../main";
import { USER_SETTINGS_LOCAL_STORE } from "../constants";
import { formatDuration } from "../utils";
import { ChatMessage } from "../ChatManager";

const CHAR_LIMIT = 500;

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [socket] = useState<Socket>(
    NetworkManager.instance.getSocket(localStorage.getItem("jwt") as string)
  );
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);

  // --- Command registry ---
  const addSystemMessage = (text: string | string[]) => {
    const content = Array.isArray(text) ? text.join("\n") : text;
    setMessages((prev) => [...prev, { id: "system", text: content }]);
  };

  const commands: Record<
    string,
    {
      description: string;
      usage: string;
      execute: (args: string[]) => void;
    }
  > = {
    recon: {
      description: "Enable or disable reconciliation",
      usage: "/recon true|false",
      execute: (args) => {
        const value = args[0]?.toLowerCase();
        if (value === "true") {
          DebugState.instance.reconciliation = true;
          addSystemMessage("Reconciliation enabled");
        } else if (value === "false") {
          DebugState.instance.reconciliation = false;
          addSystemMessage("Reconciliation disabled");
        } else {
          addSystemMessage("Usage: " + commands.recon.usage);
        }
      },
    },
    ghost: {
      description: "Enable or disable ghost",
      usage: "/ghost true|false",
      execute: (args) => {
        const value = args[0]?.toLowerCase();
        if (value === "true") {
          DebugState.instance.showGhost = true;
          addSystemMessage("Ghost enabled");
        } else if (value === "false") {
          DebugState.instance.showGhost = false;
          addSystemMessage("Ghost disabled");
        } else {
          addSystemMessage("Usage: " + commands.ghost.usage);
        }
      },
    },
    nickname: {
      description: "Set user nickname",
      usage: "/nickname <your_nickname>",
      execute: (args) => {
        const value = args[0];
        if (!value || value.length === 0) {
          addSystemMessage("Nickname empty");
          return;
        }
        if (value.length > 20) {
          addSystemMessage("Nickname too long");
          return;
        }
        socket.emit("user-command", {
          command: "change-nickname",
          value: value,
        });
        addSystemMessage(`Changed nickname to: ${value}`);
        const localUserSettings: LocalUserSettings = { nickname: value };
        localStorage.setItem(
          USER_SETTINGS_LOCAL_STORE,
          JSON.stringify(localUserSettings)
        );
      },
    },
    give: {
      description: "Give item",
      usage: "/give <item_name>",
      execute: (args) => {
        const value = args[0];
        const amount = args[1];
        if (!value) {
          addSystemMessage("No item name");
          return;
        }
        socket.emit("user-command", {
          command: "give",
          value,
          amount: parseInt(amount),
        });
      },
    },
    suicide: {
      description: "Commit suicide",
      usage: "/suicide",
      execute: () => {
        socket.emit("user-command", { command: "suicide" });
        addSystemMessage(`Committed suicide`);
      },
    },
    race: {
      description: "Start race minigame",
      usage: "/race",
      execute: () => {
        socket.emit("user-command", { command: "race" });
        addSystemMessage(`Started race lobby`);
      },
    },
    hub: {
      description: "Go to hub world",
      usage: "/hub",
      execute: () => {
        socket.emit("user-command", { command: "hub" });
        addSystemMessage(`Joined hub`);
      },
    },
    server: {
      description: "Get server info",
      usage: "/server",
      execute: () => {
        socket.emit("user-command", { command: "server" });
        addSystemMessage(`Command: Get server info`);
      },
    },
    stats: {
      description: "Get player stats",
      usage: "/stats",
      execute: () => {
        socket.emit("user-command", { command: "stats" });
      },
    },
    coinflip: {
      description: "Flip a coin to double your coins",
      usage: "/coinflip <amount>",
      execute: (args) => {
        const value = args[0];
        if (!value || value.length === 0) {
          addSystemMessage("Please enter coinflip amount");
          return;
        }
        socket.emit("user-command", {
          command: "coinflip",
          value: value,
        });
      },
    },
    help: {
      description: "List all commands",
      usage: "/help",
      execute: () => {
        const lines = ["Available commands:"];
        for (const cmd in commands) {
          lines.push(`/${cmd} - ${commands[cmd].description}`);
        }
        addSystemMessage(lines);
      },
    },
  };

  // --- Parse and execute commands ---
  const handleCommand = (cmd: string) => {
    const parts = cmd.trim().split(" ");
    const commandName = parts[0].slice(1).toLowerCase();
    const args = parts.slice(1);
    if (commands[commandName]) {
      commands[commandName].execute(args);
    } else {
      addSystemMessage(`Unknown command: ${commandName}`);
    }
  };

  // --- Send message or command ---
  const sendMessage = () => {
    setIsTyping(false);
    if (!input.trim()) return;
    if (input.length >= CHAR_LIMIT) return;

    if (input.startsWith("/")) {
      handleCommand(input);
      setInput("");
      return;
    }

    const newMessage: ChatMessage = {
      id: socket.id as string,
      text: input,
    };

    // 🚫 don't push locally, let server echo back
    socket.emit("send-chat-message", newMessage);
    setInput("");
  };

  // --- Socket listeners ---
  useEffect(() => {
    const handleMessage = (e: any) => {
      setMessages((prev) => [
        ...prev,
        { id: e.id as string, text: e.text, nickname: e.nickname },
      ]);
    };

    const handleServerInfoCommand = (e: any) => {
      const info =
        `Uptime: ${formatDuration(e.uptime)}\n` +
        `Total clients: ${e.totalClients ?? 0}\n` +
        `Hub players: ${e.hub.players ?? 0}\n` +
        `Minigames: ${e.minigames}`;
      addSystemMessage(info);
    };

    const handlePlayerStatsCommand = (e: any) => {
      const info =
        `Player Stats:\n` + `Kills: ${e.kills}\n` + `Deaths: ${e.deaths}`;
      addSystemMessage(info);
    };

    socket.on("player-stats", handlePlayerStatsCommand);
    socket.on("server-info", handleServerInfoCommand);
    socket.on("chat-message", handleMessage);

    return () => {
      socket.off("player-stats", handlePlayerStatsCommand);
      socket.off("server-info", handleServerInfoCommand);
      socket.off("chat-message", handleMessage);
    };
  }, [socket]);

  // --- Typing hotkeys ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === "t" || e.key === "T") && !isTyping) {
        e.preventDefault();
        setIsTyping(true);
      } else if (e.key === "Escape") {
        setIsTyping(false);
      }
    };
    InputManager.instance.setIgnoreKeys(isTyping);
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isTyping]);

  // --- Auto-scroll ---
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  const formatUsername = (msg: ChatMessage): string => {
    if (msg.nickname && msg.nickname.length > 0) return msg.nickname;
    return msg.id.slice(0, 4);
  };

  return (
    <div className="fixed z-[1000] bottom-1/4 left-4 w-60 transition-all duration-200 flex flex-col pointer-events-none h-64 user-select-none">
      <p className="text-xs font-light ml-1 mb-2">
        Press <span className="bg-white rounded-lg p-1 px-2 font-bold">T</span>{" "}
        to type a message
      </p>
      <div
        ref={chatRef}
        className={`flex-1 overflow-y-auto p-1 space-y-1 rounded-lg text-xs text-gray-100 hide-scrollbar pointer-events-auto transition-colors duration-200 ${
          isTyping ? "bg-gray-900/60" : "bg-gray-900/25"
        }`}
      >
        {messages.map((msg, index) => (
          <div
            key={`${msg.id}-${index}`}
            className={`px-1 py-0.5 ${
              msg.id === "system"
                ? "text-yellow-400 bg-gray-700/40 rounded p-1 whitespace-pre-line"
                : "text-gray-200"
            }`}
          >
            {msg.id === "system" ? "" : `${formatUsername(msg)}: `}
            {msg.text}
          </div>
        ))}
      </div>

      {isTyping && (
        <div className="mt-1 p-1 flex items-center bg-gray-800/50 rounded-md pointer-events-auto">
          <input
            type="text"
            value={input}
            autoFocus
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") sendMessage();
              if (e.key === "Escape") setIsTyping(false);
            }}
            className="flex-1 bg-transparent text-gray-100 px-2 py-1 text-sm focus:outline-none"
            placeholder="Type a message..."
          />
        </div>
      )}
    </div>
  );
}
