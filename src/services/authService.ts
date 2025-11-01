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

export async function handleGuestLogin(deviceId?: string): Promise<boolean> {
  try {
    // 1️⃣ Ensure we have a stable deviceId
    let storedDeviceId = localStorage.getItem("deviceId");
    if (!storedDeviceId) {
      storedDeviceId = crypto.randomUUID();
      localStorage.setItem("deviceId", storedDeviceId);
    }

    // 2️⃣ Send request to backend
    const res = await fetch(
      `${(import.meta as any).env.VITE_SERVER_URL}/auth/guest`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ deviceId: storedDeviceId }),
      }
    );

    if (!res.ok) return false;

    // 3️⃣ Store the JWT + any other info
    const data = await res.json();
    localStorage.setItem("jwt", data.token);
    localStorage.setItem("deviceId", data.deviceId || storedDeviceId);
    localStorage.setItem("nickname", data.user?.nickname || "");
    return true;
  } catch (err) {
    console.error("Guest login failed:", err);
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

export async function handleGetUser(token: string): Promise<any> {
  if (!token) return null;

  try {
    const res = await fetch(
      `${(import.meta as any).env.VITE_SERVER_URL}/auth/me`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = res.json();

    return data;
  } catch (err) {
    console.error("JWT validation failed:", err);
    return null;
  }
}
