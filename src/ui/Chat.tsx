import { useState, useEffect, useRef } from "react";
import "../../index.css";
import InputManager from "../InputManager";
import NetworkManager from "../NetworkManager";
import { Socket } from "socket.io-client";
import ChatManager, { ChatMessage } from "../ChatManager";
import DebugState from "../state/DebugState";

const CHAR_LIMIT = 500;

export default function Chat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [socket] = useState<Socket>(NetworkManager.instance.getSocket());
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);

  // --- Command registry ---
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
    help: {
      description: "List all commands",
      usage: "/help",
      execute: () => {
        addSystemMessage("Available commands:");
        for (const cmd in commands) {
          addSystemMessage(`/${cmd} - ${commands[cmd].description}`);
        }
      },
    },
  };

  // --- Parse and execute commands ---
  const handleCommand = (cmd: string) => {
    const parts = cmd.trim().split(" ");
    const commandName = parts[0].slice(1).toLowerCase(); // remove "/"
    const args = parts.slice(1);

    if (commands[commandName]) {
      commands[commandName].execute(args);
    } else {
      addSystemMessage(`Unknown command: ${commandName}`);
    }
  };

  const addSystemMessage = (text: string) => {
    setMessages((prev) => [...prev, { id: "system", text }]);
  };

  // --- Send message or command ---
  const sendMessage = () => {
    setIsTyping(false);
    if (!input.trim()) return;
    if (input.length >= CHAR_LIMIT) return;

    // --- Handle commands before sending normal chat ---
    if (input.startsWith("/")) {
      handleCommand(input);
      setInput("");
      return;
    }

    // Regular chat message
    const newMessage: ChatMessage = { id: socket.id as string, text: input };
    setMessages((prev) => [...prev, newMessage]);
    socket.emit("send-chat-message", newMessage);
    setInput("");
  };

  // --- Initialize chat from events ---
  useEffect(() => {
    const initChatMessages = (data: any) => {
      setMessages(data.detail.messages);
    };

    window.addEventListener("init-chat-messages", initChatMessages as any);

    return () =>
      window.removeEventListener("init-chat-messages", initChatMessages as any);
  }, []);

  // --- Listen for incoming messages from server ---
  useEffect(() => {
    const handleMessage = (e: any) => {
      setMessages((prev) => [...prev, { id: e.id as string, text: e.text }]);
    };

    socket.on("chat-message", handleMessage);
    return () => {
      socket.off("chat-message", handleMessage);
    };
  }, [socket]);

  // --- Handle typing hotkeys ---
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

  // --- Auto-scroll to latest message ---
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTo({
        top: chatRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages]);

  return (
    <div className="fixed z-[1000] bottom-1/4 left-4 w-60 transition-all duration-200 flex flex-col pointer-events-none h-64">
      {/* Chat field */}
      <p className="text-xs font-light ml-1 mb-2">
        Press <span className="bg-white rounded-lg p-1 px-2 font-bold">T</span>{" "}
        to type a message
      </p>
      <div
        ref={chatRef}
        className={`flex-1 overflow-y-auto p-1 space-y-1 rounded-lg text-xs text-gray-100 pointer-events-auto transition-colors duration-200 ${
          isTyping ? "bg-gray-900/60" : "bg-gray-900/25"
        }`}
      >
        {messages.map((msg, index) => (
          <div
            key={`${msg.id}-${index}`}
            className={`px-1 py-0.5 ${
              msg.id === "system" ? "text-yellow-400" : "text-gray-200"
            }`}
          >
            {msg.id === "system" ? "system:" : `${msg.id.slice(0, 4)}:`}{" "}
            {msg.text}
          </div>
        ))}
      </div>

      {/* Input field only shows when typing */}
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
