import { Routes, Route } from "react-router-dom";
import Game from "./Game";
import PatchNotes from "./pages/PatchNotes";
import AdminPanel from "./pages/Admin";

export default function Main() {
  return (
    <Routes>
      <Route path="/" element={<Game />} />
      <Route path="/patch-notes" element={<PatchNotes />} />
      <Route path="/admin" element={<AdminPanel />} />
    </Routes>
  );
}
