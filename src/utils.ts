export function getAnimationByName(animations: any[], name: string) {
  return animations.find((clip) => clip.name === name);
}
