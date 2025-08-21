import "../../index.css";
import { start } from "../main";

type StartScreenProps = {
  onStart: () => void;
};

export function StartScreen({ onStart }: StartScreenProps) {
  const handleStartGame = () => {
    start();
  };
  return (
    <>
      <div className="fixed w-full h-full flex justify-center items-center">
        <button
          onClick={handleStartGame}
          className="bg-red-500 hover:bg-red-600 p-4 rounded-lg"
        >
          Start Game
        </button>
      </div>
    </>
  );
}
