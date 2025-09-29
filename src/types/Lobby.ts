export type MinigameType = "race" | "deathmatch" | "custom";

export type MinigameMeta = {
  type: MinigameType;
  name: string;
  description: string;
};

export type LobbyType = "Hub" | "Minigame";

export type LobbyDetails = {
  id: string;
  type: LobbyType;
  minigame?: MinigameMeta;
};
