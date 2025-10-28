import { useEffect, useState } from "react";
import DebugState from "../state/DebugState";
import { isMobile } from "../utils";

export const VersionSection = () => {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    setMobile(isMobile());
  }, []);

  return (
    <p
      className={`fixed text-xs z-[9999] text-white user-select-none
        ${mobile ? "top-5 left-1/2 -translate-x-1/2" : "bottom-5 right-5"}
      `}
    >
      v{DebugState.instance.buildVersion}
    </p>
  );
};
