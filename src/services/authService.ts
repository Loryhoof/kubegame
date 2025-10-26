export async function handleGoogleLogin(token?: string): Promise<boolean> {
  if (!token) return false;

  try {
    const res = await fetch(
      `${(import.meta as any).env.VITE_SERVER_URL}/auth/google`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      }
    );

    if (!res.ok) return false;

    const data = await res.json();
    localStorage.setItem("jwt", data.jwt);
    return true;
  } catch {
    return false;
  }
}

export async function handleValidateJWT(token?: string): Promise<boolean> {
  if (!token) return false;

  try {
    const res = await fetch(
      `${(import.meta as any).env.VITE_SERVER_URL}/auth/validate`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    return res.ok; // true if 200, false if 401/403
  } catch (err) {
    console.error("JWT validation failed:", err);
    return false;
  }
}
