import { useEffect, useState } from "react";
import { fetchPlayers } from "../../services/adminServices";
import { handleGetUser } from "../../services/authService";
import { useNavigate } from "react-router-dom";
import AdminTable from "../components/AdminTable";

export type Player = {
  id: string;
  provider: "google" | "guest";
  providerId: string | null;
  email: string | null;
  coins: number;
  killCount: number;
  deathCount: number;
  admin: boolean;
  nickname: string | null;
  isGuest: boolean;
  deviceHash: string | null;
  createdAt: string;
  lastSeenAt: string;
};

export type SortKey = keyof Player | "createdAt" | "lastSeenAt";
export type SortOrder = "asc" | "desc";

const AdminPanel = () => {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>([]);
  const [sortKey, setSortKey] = useState<SortKey>("createdAt");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  // 🔐 Auth + player fetch
  useEffect(() => {
    const init = async () => {
      try {
        const token = localStorage.getItem("jwt");
        if (!token) {
          setIsAdmin(false);
          navigate("/");
          return;
        }

        const user = await handleGetUser(token);
        if (!user?.admin) {
          setIsAdmin(false);
          navigate("/");
          return;
        }

        setIsAdmin(true);
        const data = await fetchPlayers(token);
        setPlayers(data);
      } catch (err) {
        console.error("Admin init failed:", err);
        setIsAdmin(false);
        navigate("/");
      }
    };
    init();
  }, []);

  const handleBan = (playerId: string) => {
    console.log("Ban triggered for player:", playerId);
    // TODO: call backend ban endpoint
  };

  const handleSort = (key: SortKey) => {
    if (key === sortKey) setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    else {
      setSortKey(key);
      setSortOrder("asc");
    }
  };

  const sortedPlayers = [...players].sort((a, b) => {
    const valA = a[sortKey] as any;
    const valB = b[sortKey] as any;
    if (valA == null) return 1;
    if (valB == null) return -1;

    if (typeof valA === "number" && typeof valB === "number")
      return sortOrder === "asc" ? valA - valB : valB - valA;

    if (typeof valA === "boolean" && typeof valB === "boolean")
      return sortOrder === "asc"
        ? Number(valA) - Number(valB)
        : Number(valB) - Number(valA);

    if (sortKey === "createdAt" || sortKey === "lastSeenAt") {
      const dateA = new Date(valA).getTime();
      const dateB = new Date(valB).getTime();
      return sortOrder === "asc" ? dateA - dateB : dateB - dateA;
    }

    return sortOrder === "asc"
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  // ⏳ States
  if (isAdmin === null)
    return (
      <div className="flex items-center justify-center h-screen text-gray-500 text-lg">
        Loading admin panel...
      </div>
    );

  if (!isAdmin)
    return (
      <div className="flex items-center justify-center h-screen text-gray-500 text-lg">
        Access denied.
      </div>
    );

  // ✅ Admin view
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <div className="mx-auto px-6 py-10">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-semibold">Kubegame Admin Panel</h1>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="text-sm px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-md transition"
          >
            ← Go Back
          </button>
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-md border border-gray-200 overflow-hidden">
          <AdminTable
            players={sortedPlayers}
            onBan={handleBan}
            onSort={handleSort}
            sortKey={sortKey}
            sortOrder={sortOrder}
          />
        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
