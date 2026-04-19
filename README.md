# ZZZ Mod Manager (zzz-mm)

A **desktop Mod Manager for Zenless Zone Zero**, built with **Electron + Angular**, focused on **local mod management** and safe file system access.


---

## ✨ Features

- 📦 Scan and manage local mods
- 🧠 Group mods by agent
- 🖼️ Mod details with preview image support
- ➕ Import mods from `.zip` / `.rar`
- 📂 Open mod folders directly from the app
- ⚙️ Configurable source mods directory

---

## 🛠️ Tech Stack

- **Electron** (desktop + IPC)
- **Angular 17+** (signals, standalone components)
- **Node.js** (`fs`, archive extraction)
- **Angular Material**

---

## 🚀 Development

### Requirements
- Node.js 18+
- Angular CLI

### Run
```bash
npm install
npm run electron:dev
```
Electron loads Angular from http://localhost:4200 in development mode.

📦 Mod Structure
```
MyMod/
├── mod.json
├── preview.png (optional)
└── mod files...
```


⚠️ Disclaimer
Not affiliated with or endorsed by HoYoverse.
Zenless Zone Zero is a trademark of its respective owners.

### Portraits
Source: https://zenless.hoyoverse.com/en-us/character