import { Routes, Route } from "react-router-dom";
import Game from "./Game";
import PatchNotes from "./pages/PatchNotes";

export default function Main() {
  return (
    <Routes>
      <Route path="/" element={<Game />} />
      <Route path="/patch-notes" element={<PatchNotes />} />
    </Routes>
  );
}
