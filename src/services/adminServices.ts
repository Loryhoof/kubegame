export async function fetchPlayers(token: string): Promise<any> {
  try {
    const res = await fetch(
      `${(import.meta as any).env.VITE_SERVER_URL}/users`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (!res.ok) return false;

    const data = await res.json();
    return data;
  } catch {
    return null;
  }
}
