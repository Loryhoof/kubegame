import React, { useState, useRef } from "react";

type JoystickProps = {
  size?: number;
  knobSize?: number;
  deadZone?: number;
  side?: "left" | "right";
  eventName?: string;
};

export default function Joystick({
  size = 120,
  knobSize = 60,
  deadZone = 0.1,
  side = "right",
  eventName = "camera-controls",
}: JoystickProps) {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const activeTouch = useRef<number | null>(null);
  const startPos = useRef({ x: 0, y: 0 });

  const clamp = (v: number) => Math.max(-1, Math.min(1, v));

  const dispatch = (x: number, y: number) => {
    const outX = Math.abs(x) < deadZone ? 0 : x;
    const outY = Math.abs(y) < deadZone ? 0 : y;
    setPosition({ x: outX, y: outY });
    window.dispatchEvent(
      new CustomEvent(eventName, { detail: { x: outX, y: outY } })
    );
  };

  const onTouchStart = (e: React.TouchEvent) => {
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const rect = (e.target as HTMLDivElement).getBoundingClientRect();
      if (
        t.clientX >= rect.left &&
        t.clientX <= rect.right &&
        t.clientY >= rect.top &&
        t.clientY <= rect.bottom
      ) {
        activeTouch.current = t.identifier;
        startPos.current = { x: t.clientX, y: t.clientY };
        dispatch(0, 0);
        break;
      }
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (activeTouch.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === activeTouch.current) {
        const dx = (t.clientX - startPos.current.x) / (size / 2);
        const dy = (t.clientY - startPos.current.y) / (size / 2);
        dispatch(clamp(dx), clamp(dy));
        break;
      }
    }
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (activeTouch.current === null) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === activeTouch.current) {
        activeTouch.current = null;
        dispatch(0, 0);
        break;
      }
    }
  };

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className={`fixed bottom-8 ${
        side === "left" ? "left-20" : "right-20"
      } flex items-center justify-center z-[10000]`}
      style={{
        width: size,
        height: size,
        backgroundColor: "rgba(128,128,128,0.5)",
        borderRadius: "50%",
        touchAction: "none",
      }}
    >
      <div
        style={{
          width: knobSize,
          height: knobSize,
          backgroundColor: "rgba(200,200,200,0.8)",
          borderRadius: "50%",
          transform: `translate(${(position.x * (size - knobSize)) / 2}px, ${
            (position.y * (size - knobSize)) / 2
          }px)`,
          transition: "transform 0.1s ease-out",
        }}
      />
    </div>
  );
}
