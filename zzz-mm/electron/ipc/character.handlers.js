const fs = require("fs");
const path = require("path");
const { IpcHandler } = require("../../shared/ipc.channels");

function registerCharacterHandlers(ipcMain, { app, sanitizeFileName }) {
  const USER_DIR = app.getPath("userData");
  const CHARACTERS_FILE = path.join(USER_DIR, "characters.json");
  const PORTRAITS_DIR = path.join(USER_DIR, "char-portraits");

  function ensurePortraitsDir() {
    if (!fs.existsSync(PORTRAITS_DIR)) {
      fs.mkdirSync(PORTRAITS_DIR, { recursive: true });
    }
  }

  function loadCharacters() {
    try {
      if (!fs.existsSync(CHARACTERS_FILE)) return [];
      const raw = fs.readFileSync(CHARACTERS_FILE, "utf-8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.error("CHARACTER:LOAD_ERROR", e);
      return [];
    }
  }

  function saveCharacters(list) {
    fs.writeFileSync(CHARACTERS_FILE, JSON.stringify(list, null, 2), "utf-8");
  }

  ipcMain.handle(IpcHandler.CHARACTER_LIST, async () => {
    try {
      return { success: true, characters: loadCharacters() };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle(IpcHandler.CHARACTER_CREATE, async (_, payload) => {
    try {
      const name = payload?.name;
      const sourceImagePath = payload?.sourceImagePath;

      if (!name || typeof name !== "string") {
        return { success: false, error: "Invalid name" };
      }

      if (!sourceImagePath || typeof sourceImagePath !== "string") {
        return { success: false, error: "Invalid image path" };
      }

      if (!fs.existsSync(sourceImagePath)) {
        return { success: false, error: "Image file not found" };
      }

      const ext = path.extname(sourceImagePath).toLowerCase();
      if (![".png", ".jpg", ".jpeg", ".webp"].includes(ext)) {
        return { success: false, error: "Unsupported image format" };
      }

      const list = loadCharacters();
      const exists = list.some(
        (c) =>
          typeof c?.name === "string" &&
          c.name.toLowerCase() === name.trim().toLowerCase(),
      );

      if (exists) {
        return { success: false, error: "Character already exists" };
      }

      ensurePortraitsDir();

      // ID: use timestamp to avoid clashes with built-in numeric ids
      const id = Date.now();

      const fileBase = sanitizeFileName(String(id) + ext);
      const destPath = path.join(PORTRAITS_DIR, fileBase);

      fs.copyFileSync(sourceImagePath, destPath);

      const character = {
        id,
        name: name.trim(),
        portraitPath: destPath,
        createdAt: Date.now(),
      };

      list.push(character);
      saveCharacters(list);

      return { success: true, character };
    } catch (err) {
      console.error("CHARACTER:CREATE_ERROR", err);
      return { success: false, error: err.message };
    }
  });
}

module.exports = { registerCharacterHandlers };
