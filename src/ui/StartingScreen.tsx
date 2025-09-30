import { useEffect, useState } from "react";
import "../../index.css";
import { GameManager } from "../GameManager";
import DebugState from "../state/DebugState";
import { parseInviteURL } from "../utils";

type ButtonProps = {
  title: string;
  onClick: () => void;
};

const Button = ({ title, onClick }: ButtonProps) => {
  return (
    <div onClick={onClick} className="p-2 hover:bg-white hover:text-black">
      {title}
    </div>
  );
};

const Header = () => {
  const handleButtonClick = () => {};
  return (
    <div className="fixed top-0 w-full border-b border-white flex flex-row gap-4 p-4 items-center justify-center">
      {/* <Button title={"Play now"} onClick={handleButtonClick}></Button>
      <Button title={"Server browser"} onClick={handleButtonClick}></Button> */}
      {/* <Button title={"Discord"} onClick={handleButtonClick}></Button> */}
      <Button title={"Patch notes"} onClick={handleButtonClick}></Button>
    </div>
  );
};

const Footer = () => {
  return (
    <div className="fixed bottom-5">
      <div className="flex flex-row text-sm gap-4">
        <a
          className="hover:underline"
          target="_blank"
          rel="noopener noreferrer"
          href="https://discord.gg/xYEgggpKHg"
        >
          Discord
        </a>
        <p className="hover:underline">Patch notes</p>
      </div>
    </div>
  );
};

const StartingScreen = () => {
  const [lobbyId, setLobbyId] = useState<string | null>(null);
  //

  const handleJoinWorld = () => {
    GameManager.instance.joinWorld();
  };

  useEffect(() => {
    const data = parseInviteURL();

    console.log(data, "Data ");

    if (data) setLobbyId(data);
  }, []);

  return (
    <>
      <div className="text-white flex flex-col w-screen h-screen items-center justify-center bg-gray-900 user-select-none">
        {/* Header */}
        {/* <Header /> */}

        {/* Title */}
        <div className="text-3xl font-extrabold text-yellow-400 tracking-wider font-mono mb-8">
          kubegame{" "}
        </div>

        <div>
          <div className="flex flex-col gap-4">
            <div
              onClick={handleJoinWorld}
              className="border-2 border-white font-bold text-white px-24 py-3 hover:bg-white hover:text-black text-center"
            >
              {/* Join <span className="text-yellow-400 font-bold">Hub</span> */}
              {/* {lobbyId ? (
                "Join"
              ) : (
                <>
                  Join Lobby
                  <span className="text-yellow-400">{lobbyId}</span>
                </>
              )} */}
              {lobbyId ? (
                <>
                  Join Lobby <span className="text-yellow-400">{lobbyId}</span>
                </>
              ) : (
                "Join World"
              )}
            </div>
            {/* 
            <div
              onClick={handleJoinWorld}
              className="border-2 border-white font-bold text-white px-24 py-3 hover:bg-white hover:text-black text-center"
            >
              Server browser
            </div> */}
          </div>
        </div>

        <Footer />
      </div>
    </>
  );
};

export default StartingScreen;
