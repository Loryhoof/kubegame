import { useEffect, useState } from "react";
import { handleValidateJWT } from "../services/authService";

export function useAuthValidate() {
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  async function revalidate() {
    const token = localStorage.getItem("jwt");
    const valid = token ? await handleValidateJWT(token) : false;
    setAuthenticated(valid);
  }

  useEffect(() => {
    async function check() {
      const token = localStorage.getItem("jwt");

      if (!token) {
        setAuthenticated(false);
        setLoading(false);
        return;
      }

      const valid = await handleValidateJWT(token);
      setAuthenticated(valid);

      if (!valid) {
        localStorage.removeItem("jwt");
      }

      setLoading(false);
    }

    check();
  }, []);

  return { loading, authenticated, revalidate };
}
