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
