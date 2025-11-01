import { Player, SortKey, SortOrder } from "../pages/Admin";

function timeAgo(dateString: string): string {
  const now = new Date();
  const past = new Date(dateString);
  const diffMs = now.getTime() - past.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${diffDay}d ago`;
}

export default function AdminTable({
  players,
  onBan,
  onSort,
  sortKey,
  sortOrder,
}: {
  players: Player[];
  onBan: (id: string) => void;
  onSort: (key: SortKey) => void;
  sortKey: SortKey;
  sortOrder: SortOrder;
}) {
  const sortIndicator = (key: SortKey) =>
    key === sortKey ? (sortOrder === "asc" ? "▲" : "▼") : "⇅";

  return (
    <div className="w-full border border-gray-300 rounded-lg overflow-hidden">
      <div className="overflow-auto max-h-[60vh]">
        <table className="min-w-full text-sm border-collapse">
          <thead className="bg-gray-100 text-gray-700 sticky top-0 z-10">
            <tr>
              {[
                { key: "nickname", label: "Nickname" },
                { key: "email", label: "Email" },
                { key: "provider", label: "Provider" },
                { key: "coins", label: "Coins", center: true },
                { key: "killCount", label: "Kills", center: true },
                { key: "deathCount", label: "Deaths", center: true },
                { key: "admin", label: "Admin", center: true },
                { key: "createdAt", label: "Created" },
                { key: "lastSeenAt", label: "Last Seen" },
              ].map((col) => (
                <th
                  key={col.key}
                  onClick={() => onSort(col.key as SortKey)}
                  className={`p-3 font-medium cursor-pointer select-none whitespace-nowrap border-b border-gray-200 ${
                    col.center ? "text-center" : "text-left"
                  } hover:bg-gray-200 transition`}
                >
                  {col.label}{" "}
                  <span className="text-gray-400">
                    {sortIndicator(col.key as SortKey)}
                  </span>
                </th>
              ))}
              <th className="p-3 text-center font-medium border-b border-gray-200 whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="bg-white">
            {players.map((p, i) => (
              <tr
                key={p.id}
                className={`border-b border-gray-200 ${
                  i % 2 === 0 ? "bg-white" : "bg-gray-50"
                } hover:bg-gray-100 transition`}
              >
                <td
                  className="p-3 truncate max-w-[160px]"
                  title={p.nickname ?? "—"}
                >
                  {p.nickname ?? "—"}
                </td>
                <td
                  className="p-3 truncate max-w-[220px]"
                  title={p.email ?? "—"}
                >
                  {p.email ?? "—"}
                </td>
                <td className="p-3 capitalize">{p.provider}</td>
                <td className="p-3 text-center">{p.coins}</td>
                <td className="p-3 text-center">{p.killCount}</td>
                <td className="p-3 text-center">{p.deathCount}</td>
                <td
                  className={`p-3 text-center font-semibold ${
                    p.admin ? "text-green-600" : "text-gray-400"
                  }`}
                >
                  {p.admin ? "✔" : "—"}
                </td>
                <td className="p-3 whitespace-nowrap">
                  {timeAgo(p.createdAt)}{" "}
                  <span className="text-gray-400 text-xs">
                    ({new Date(p.createdAt).toLocaleDateString()})
                  </span>
                </td>
                <td className="p-3 whitespace-nowrap">
                  {timeAgo(p.lastSeenAt)}{" "}
                  <span className="text-gray-400 text-xs">
                    ({new Date(p.lastSeenAt).toLocaleDateString()})
                  </span>
                </td>
                <td className="p-3 text-center">
                  <button
                    onClick={() => onBan(p.id)}
                    className="px-3 py-1 text-xs bg-red-500 hover:bg-red-600 text-white rounded-md transition"
                  >
                    Ban
                  </button>
                </td>
              </tr>
            ))}

            {players.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="text-center py-8 text-gray-500 text-sm italic"
                >
                  No player records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
