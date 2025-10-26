import { useNavigate } from "react-router-dom";

export default function PatchNotes() {
  const navigate = useNavigate();

  const notes = [
    {
      version: "v0.1.4",
      date: "2025-10-26",
      changes: [
        "Added accounts and persistent data",
        "Added /stats command for player statistics",
      ],
      fixes: ["UI improvements", "Bug fixes"],
    },
    {
      version: "v0.1.39",
      date: "2025-10-25",
      changes: [],
      fixes: ["Bug fixes"],
    },
    {
      version: "v0.1.38",
      date: "2025-10-25",
      changes: ["Added deathmatch mode", "Added NPC pathfinding"],
      fixes: [],
    },
  ];

  return (
    <div className="h-screen overflow-y-auto bg-[#0c0c0f] text-white p-6">
      <div className="max-w-3xl mx-auto pb-10">
        {/* ✅ Back Button */}
        <button
          onClick={() => navigate("/")}
          className="text-sm mb-6 opacity-70 hover:opacity-100 transition flex items-center gap-1"
        >
          <span className="text-xl">←</span> Back
        </button>

        <h1 className="text-4xl font-bold mb-6 tracking-wide">
          Kubegame Patch Notes
        </h1>

        {notes.map((entry, i) => (
          <div
            key={i}
            className="bg-[#15151a] border border-[#2a2a30] rounded-xl p-5 mb-6 shadow-lg"
          >
            <div className="flex justify-between items-center mb-3">
              <h2 className="text-xl font-semibold">{entry.version}</h2>
              <span className="text-sm opacity-60">{entry.date}</span>
            </div>

            {entry.changes.length > 0 && (
              <>
                <h3 className="text-md font-semibold mt-2 mb-1 text-green-400">
                  ✦ Changes
                </h3>
                <ul className="list-disc list-inside text-sm opacity-90 leading-relaxed mb-2">
                  {entry.changes.map((c, idx) => (
                    <li key={idx}>{c}</li>
                  ))}
                </ul>
              </>
            )}

            {entry.fixes.length > 0 && (
              <>
                <h3 className="text-md font-semibold mt-2 mb-1 text-blue-400">
                  ✔ Fixes
                </h3>
                <ul className="list-disc list-inside text-sm opacity-90 leading-relaxed">
                  {entry.fixes.map((f, idx) => (
                    <li key={idx}>{f}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        ))}

        <p className="text-center text-xs opacity-50 mt-10">
          More updates coming soon…
        </p>
      </div>
    </div>
  );
}
