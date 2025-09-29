// import World from "./World";

// export default class WorldManager {
//   private worlds: World[] = [];

//   constructor() {}

//   create(id: string): World {
//     const world = new World(id);
//     this.worlds.push(world);

//     console.log("Created new world with id: ", id);

//     return world;
//   }

//   remove(id: string) {
//     const index = this.worlds.findIndex((w) => w.id == id);

//     if (index == -1) return;

//     this.worlds.splice(index, 1);

//     console.log("Deleted world with id: ", id);
//   }
// }
