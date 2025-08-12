import React, { useState, useEffect } from "react";

type EventData = {
  wantsToInteract: boolean;
};

export default function InteractButton() {
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    // Define the event handler with a typed CustomEvent
    function onUIUpdate(e: CustomEvent<EventData>) {
      const eventDetails = e.detail;

      setIsActive(eventDetails.wantsToInteract);
    }

    // Add event listener with type cast
    window.addEventListener("ui-update", onUIUpdate as EventListener);

    // Cleanup on unmount
    return () => {
      window.removeEventListener("ui-update", onUIUpdate as EventListener);
    };
  }, []);

  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        position: "fixed",
        height: "100vh",
        width: "100vw",
        zIndex: 1000,
        fontFamily: "Arial",
        fontSize: 14,
        color: "white",
        paddingTop: "144px",
      }}
    >
      {isActive && <div style={boxStyle}>E</div>}
    </div>
  );
}

const boxStyle: React.CSSProperties = {
  background: "rgba(0, 0, 0, 0.5)",
  padding: "5px 10px",
  borderRadius: "5px",
  marginBottom: "5px",
  userSelect: "none",
};
