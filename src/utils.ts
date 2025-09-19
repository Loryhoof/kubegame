import { ServerNotification } from "./main";

export function getAnimationByName(animations: any[], name: string) {
  return animations.find((clip) => clip.name === name);
}

export function getRandomFromArray(arr: any[]) {
  if (!Array.isArray(arr) || arr.length === 0) {
    throw new Error("Input must be a non-empty array");
  }
  const randomIndex = Math.floor(Math.random() * arr.length);
  return arr[randomIndex];
}

export function createToast(data: ServerNotification) {
  const event = new CustomEvent("server-notification", {
    detail: data,
  } as any);
  window.dispatchEvent(event);
}

export function isMobile() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
}
