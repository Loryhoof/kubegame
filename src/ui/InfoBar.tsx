import "../../index.css";
import NetworkManager from "../NetworkManager";
import { isMobile } from "../utils";

function KeyBackground({ label, info }: { label: string; info: string }) {
  return (
    <div className="items-center align-center text-center flex flex-row gap-2">
      <div className="bg-gray-200 pt-1 mt-2 rounded-lg w-8 h-8 text-center items-center font-bold">
        {label}
      </div>
      <p className="pt-2 font-semibold ">{info}</p>
    </div>
  );
}

export default function InfoBar() {
  return (
    <>
      <div className="fixed z-[1000] p-4 flex flex-col bottom-0 left-0 select-none">
        {!isMobile() && (
          <>
            <KeyBackground label="E" info="Use" />
            <KeyBackground label="K" info="Spawn Car" />
          </>
        )}

        <p className="pt-2">Kubegame v0.1.30</p>
        {/* <p className="pt-2 text-xs text-black font-bold">
        Weapon test. type{" "}
        <span className="bg-yellow-500 text-yellow-700 p-0.5">
          /give pistol
        </span>{" "}
        in the chat
      </p> */}
      </div>
    </>
  );
}
