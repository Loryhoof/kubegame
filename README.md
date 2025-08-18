# Kubegame

Kubegame is a sandbox-style multiplayer browser game built with **three.js**.
This repository contains the **frontend** client, responsible for rendering, player controls, and UI.

The **server** (authoritative game logic) lives in a separate repository: [kubegame-server](https://github.com/loryhoof/kubegame-server).

---

## Features

* 3D sandbox gameplay using **three.js**
* Works on **desktop** and **mobile browsers**
* Integrates with **kubegame-server** for multiplayer synchronization
* Written in **TypeScript**

---

## Requirements

* [Node.js](https://nodejs.org/) (v16 or newer recommended)
* npm (comes with Node.js)
* Access to a running **kubegame-server** instance

---

## Setup

1. **Clone the repo**

   ```bash
   git clone https://github.com/loryhoof/kubegame.git
   cd kubegame
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Configure environment variables**
   Create a `.env` file in the project root with the server connection info:

   ```env
   VITE_SOCKET_URL="http://localhost:3000/"
   ```

   > Adjust the URL and port according to your server setup.

4. **Run the frontend**

   ```bash
   npm run dev
   ```

   > Opens the game in your browser for development.

---

## Related Repositories

* [kubegame-server](https://github.com/loryhoof/kubegame-server) – authoritative game server
