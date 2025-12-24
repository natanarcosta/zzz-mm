const { app, BrowserWindow, ipcMain, shell, dialog } = require("electron");
const url = require("url");
const path = require("path");
const fs = require("fs");
const https = require("https");
const AdmZip = require("adm-zip");
const { unrar } = require("unrar-promise");
const os = require("os");

var nodeConsole = require("console");
var myConsole = new nodeConsole.Console(process.stdout, process.stderr);

try {
  require("electron-reloader")(module);
} catch {}

let mainWindow;
const isDev = !app.isPackaged;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 768,
    frame: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    mainWindow.loadURL("http://localhost:4200/");
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadURL(
      url.format({
        pathname: path.join(__dirname, `/dist/zzz-mm/browser/index.html`),
        protocol: "file:",
        slashes: true,
      })
    );

    // mainWindow.webContents.openDevTools();
    mainWindow.setMenu(null);
  }

  mainWindow.on("closed", function () {
    mainWindow = null;
  });

  ipcMain.handle("read-folder", async (event, folderPath) => {
    try {
      const files = await fs.promises.readdir(folderPath);
      return files;
    } catch (err) {
      console.error("read-folder FAILED: ", err);
      throw err;
    }
  });

  ipcMain.handle("read-json-file", async (_, filePath) => {
    try {
      const content = await fs.promises.readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch (err) {
      console.error("READ_JSON_FILE_ERROR: ", err);
      throw err;
    }
  });

  ipcMain.handle("load-image", async (_, filePath) => {
    try {
      const buffer = fs.readFileSync(filePath);
      return `data:image/png;base64,${buffer.toString("base64")}`;
    } catch (err) {
      console.error("LOAD_IMAGE_ERROR: ", err);
      throw err;
    }
  });

  ipcMain.handle("open-external-url", async (_, url) => {
    await shell.openExternal(url);
  });

  ipcMain.handle(
    "download-image",
    async (_, { url, fileName, downloadPath }) => {
      const safeFileName = sanitizeFileName(fileName);
      const localDiskPath = path.join(downloadPath, safeFileName);

      return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(localDiskPath);

        https
          .get(url, (response) => {
            if (response.statusCode !== 200) {
              reject(`Erro HTTP: ${response.statusCode}`);
              return;
            }

            response.pipe(file);

            file.on("finish", () => {
              file.close();
              resolve(localDiskPath);
            });
          })
          .on("error", (err) => {
            fs.unlink(localDiskPath, () => {});
            reject(err.message);
          });
      });
    }
  );

  ipcMain.handle("write-json-file", async (_, { filePath, data }) => {
    try {
      const finalPath = filePath.endsWith(".json")
        ? filePath
        : `${filePath}.json`;

      fs.mkdirSync(path.dirname(finalPath), { recursive: true });

      // 🧾 escreve JSON formatado
      fs.writeFileSync(finalPath, JSON.stringify(data, null, 2), "utf-8");

      return { success: true, path: finalPath };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  const CONFIG_PATH = path.join(app.getPath("userData"), "config.json");

  ipcMain.handle("load-config", async () => {
    if (!fs.existsSync(CONFIG_PATH)) {
      const defaultConfig = {
        source_mods_folder: "",
        mod_links_folder: "",
        blur: false,
        navbar_type: "list",
        auto_fetch: false,
        disable_others: true,
      };

      fs.writeFileSync(
        CONFIG_PATH,
        JSON.stringify(defaultConfig, null, 2),
        "utf-8"
      );

      return defaultConfig;
    }

    return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  });

  ipcMain.handle("save-config", async (_, data) => {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), "utf-8");
    return { success: true };
  });

  ipcMain.handle("create-symlink", async (_, { target, linkPath }) => {
    try {
      // Garante que a pasta pai do link exista
      fs.mkdirSync(path.dirname(linkPath), { recursive: true });

      // Remove link existente (se houver)
      if (fs.existsSync(linkPath)) {
        fs.rmSync(linkPath, { recursive: true, force: true });
      }

      // Windows → junction é o mais seguro
      const type = process.platform === "win32" ? "junction" : "dir";

      fs.symlinkSync(target, linkPath, type);

      return { success: true };
    } catch (err) {
      console.error("CREATE_SYMLINK_ERROR:", err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("remove-symlink", async (_, linkPath) => {
    try {
      if (!fs.existsSync(linkPath)) {
        return { success: true }; // já não existe
      }

      const stat = fs.lstatSync(linkPath);

      if (stat.isSymbolicLink()) {
        // Symlink normal
        fs.unlinkSync(linkPath);
      } else if (stat.isDirectory()) {
        // Junction no Windows aparece como diretório
        fs.rmSync(linkPath, { recursive: true, force: true });
      } else {
        return {
          success: false,
          error: "O caminho não é um symlink",
        };
      }

      return { success: true };
    } catch (err) {
      console.error("REMOVE_SYMLINK_ERROR:", err);
      return { success: false, error: err.message };
    }
  });

  async function extractZip(zipPath, dest) {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(dest, true);
  }

  const unrarPath = isDev
    ? undefined // usa sistema
    : path.join(process.resourcesPath, "unrar", "unrar.exe");

  async function extractRar(rarPath, dest) {
    if (unrarPath) {
      await unrar(rarPath, dest, { unrarPath });
    } else {
      await unrar(rarPath, dest); // DEV → usa unrar do sistema
    }
  }

  function getRootFolder(tempDir) {
    const entries = fs.readdirSync(tempDir);

    if (entries.length === 1) {
      const fullPath = path.join(tempDir, entries[0]);
      if (fs.statSync(fullPath).isDirectory()) {
        return {
          path: fullPath,
          name: entries[0],
          isWrapped: true,
        };
      }
    }

    return {
      path: tempDir,
      name: null,
      isWrapped: false,
    };
  }

  function unwrapSingleFolder(dir) {
    let current = dir;

    while (true) {
      const entries = fs.readdirSync(current);
      if (entries.length !== 1) break;

      const next = path.join(current, entries[0]);
      if (!fs.statSync(next).isDirectory()) break;

      current = next;
    }

    return current;
  }

  function moveFolderContents(src, dest) {
    for (const entry of fs.readdirSync(src)) {
      const srcPath = path.join(src, entry);
      const destPath = path.join(dest, entry);
      fs.cpSync(srcPath, destPath, { recursive: true });
    }
  }

  function sanitizeFileName(name) {
    if (!name || typeof name !== "string") return "file";

    let sanitized = name
      .replace(/[\/\\?%*:|"<>]/g, "_") // proibidos
      .replace(/[\u0000-\u001F]/g, "") // controle
      .trim();

    // evita nomes vazios ou inválidos
    if (!sanitized || sanitized === "." || sanitized === "..") {
      sanitized = "file";
    }

    // Windows não gosta de nomes terminando com ponto ou espaço
    sanitized = sanitized.replace(/[\. ]+$/, "");

    // limite seguro
    if (sanitized.length > 120) {
      const ext = path.extname(sanitized);
      sanitized = sanitized.slice(0, 120 - ext.length) + ext;
    }

    return sanitized;
  }

  function sanitizeFolderName(name) {
    if (!name || typeof name !== "string") return "mod";

    // remove caracteres proibidos no Windows
    let sanitized = name
      .replace(/[\/\\?%*:|"<>]/g, "-") // separadores e proibidos
      .replace(/[\u0000-\u001F]/g, "") // caracteres de controle
      .replace(/\s+/g, " ") // normaliza espaços
      .trim();

    // fallback absoluto
    if (!sanitized) {
      return "mod";
    }

    // limite seguro de tamanho
    if (sanitized.length > 80) {
      sanitized = sanitized.slice(0, 80);
    }

    return sanitized;
  }

  ipcMain.handle("install-mod", async (_, data) => {
    const { archivePath, destinationPath, modData } = data;
    const tempDir = path.join(os.tmpdir(), "zzz-mm", "install_" + Date.now());

    try {
      if (!archivePath || !destinationPath || !modData?.modName) {
        return { success: false, error: "Payload inválido" };
      }

      const ext = path.extname(archivePath).toLowerCase();
      fs.mkdirSync(tempDir, { recursive: true });

      if (ext === ".zip") {
        await extractZip(archivePath, tempDir);
      } else if (ext === ".rar") {
        await extractRar(archivePath, tempDir);
      } else {
        return { success: false, error: "Formato não suportado" };
      }

      const contentRoot = unwrapSingleFolder(tempDir);

      const safeFolderName = sanitizeFolderName(modData.modName);
      const finalPath = path.join(destinationPath, safeFolderName);

      if (fs.existsSync(finalPath)) {
        return { success: false, error: "Já existe um mod com esse nome" };
      }

      fs.mkdirSync(finalPath, { recursive: true });

      moveFolderContents(contentRoot, finalPath);

      const scanResult = await scanKeysForMod(destinationPath, safeFolderName);

      modJson.hotkeys = scanResult.hotkeys || [];

      const modJson = {
        ...modData,
        folderName: safeFolderName,
      };

      fs.writeFileSync(
        path.join(finalPath, "mod.json"),
        JSON.stringify(modJson, null, 2),
        "utf-8"
      );

      return { success: true };
    } catch (err) {
      console.error("INSTALL MOD ERROR:", err);
      return { success: false, error: err.message };
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  ipcMain.handle("select-directory", async (event, options) => {
    const result = await dialog.showOpenDialog(
      BrowserWindow.getFocusedWindow(),
      {
        properties: ["openDirectory"], // This property enables folder selection
        ...options,
      }
    );

    if (result.canceled) {
      return null; // or handle cancellation as needed
    } else {
      // result.filePaths is an array of selected paths
      return result.filePaths[0]; // Return the first selected path
    }
  });

  ipcMain.handle(
    "extract-mod-update",
    async (_, { zipPath, targetFolder, baseModsDir }) => {
      const targetPath = path.join(baseModsDir, targetFolder);
      const tempDir = path.join(os.tmpdir(), "zzz-mm", "install_" + Date.now());

      try {
        fs.mkdirSync(tempDir, { recursive: true });

        // 1) extrair
        const ext = path.extname(zipPath).toLowerCase();
        if (ext === ".zip") {
          await extractZip(zipPath, tempDir);
        } else if (ext === ".rar") {
          await extractRar(zipPath, tempDir);
        } else {
          throw new Error("Formato não suportado");
        }

        // 2) detectar raiz real do update
        // const root = getRootFolder(tempDir);
        const root = unwrapSingleFolder(tempDir);

        const updateEntries = fs.readdirSync(root.path);
        if (updateEntries.length === 0) {
          throw new Error("Pacote de update vazio");
        }

        // 3) copiar arquivos do update (merge)
        for (const file of updateEntries) {
          const src = path.join(root.path, file);
          const dest = path.join(targetPath, file);

          fs.cpSync(src, dest, {
            recursive: true,
            force: true, // sobrescreve se existir
          });
        }

        // 4) copiar novos arquivos
        for (const file of updateEntries) {
          fs.cpSync(path.join(root.path, file), path.join(targetPath, file), {
            recursive: true,
          });
        }

        return { success: true };
      } catch (err) {
        console.error("EXTRACT_MOD_UPDATE_ERROR:", err);
        return { success: false, error: err.message };
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    }
  );

  const VK_MAP = {
    VK_UP: "UP",
    VK_DOWN: "DOWN",
    VK_LEFT: "LEFT",
    VK_RIGHT: "RIGHT",

    VK_NUMPAD0: "NUM0",
    VK_NUMPAD1: "NUM1",
    VK_NUMPAD2: "NUM2",
    VK_NUMPAD3: "NUM3",

    VK_F1: "F1",
    VK_F2: "F2",
    VK_F3: "F3",

    VK_HOME: "HOME",
    VK_END: "END",
  };

  function findIniFiles(dir, result = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        findIniFiles(fullPath, result);
      } else if (
        entry.isFile() &&
        entry.name.toLowerCase().endsWith(".ini") &&
        !["d3dx.ini", "dxgi.ini"].includes(entry.name.toLowerCase())
      ) {
        result.push(fullPath);
      }
    }

    return result;
  }

  function extractLabel(lines) {
    for (const line of lines) {
      const match = line.match(/^\$(\w+)\s*=/);
      if (!match) continue;

      const label = match[1];

      if (label.toLowerCase() === "active") continue;

      // tratar swapkey genérico
      if (/^swapkey\d+$/i.test(label)) {
        const index = label.match(/\d+/)?.[0];
        return `KeySwap${index ? ` #${index}` : ""}`;
      }

      return label;
    }

    return "KeySwap";
  }

  function normalizeKey(raw) {
    const tokens = raw
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => !t.startsWith("no_"));

    const parts = [];

    if (tokens.includes("ctrl")) parts.push("CTRL");
    if (tokens.includes("shift")) parts.push("SHIFT");
    if (tokens.includes("alt")) parts.push("ALT");

    const vk = tokens.find((t) => t.startsWith("vk_"));
    if (vk) {
      parts.push(
        VK_MAP[vk.toUpperCase()] ?? vk.replace("vk_", "").toUpperCase()
      );
    }

    return parts.join(" ");
  }

  function parseKeySwapBlock(blockLines) {
    const keyLine = blockLines.find((l) => l.toLowerCase().startsWith("key"));
    if (!keyLine) return null;

    const rawKey = keyLine.split("=")[1].trim();
    const label = extractLabel(blockLines);

    return {
      description: label,
      key: normalizeKey(rawKey),
      source: "ini",
    };
  }

  function splitIniBlocks(content) {
    const blocks = [];
    let current = null;

    const lines = content.split(/\r?\n/);

    for (const line of lines) {
      const headerMatch = line.match(/^\[(.+?)\]$/);

      if (headerMatch) {
        if (current) blocks.push(current);

        current = {
          name: headerMatch[1],
          lines: [],
        };
      } else if (current) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith(";")) {
          current.lines.push(trimmed);
        }
      }
    }

    if (current) blocks.push(current);

    return blocks;
  }

  function isKeySwapBlock(lines) {
    return (
      lines.some((l) => l.trim().startsWith("key")) &&
      lines.some((l) => l.trim().startsWith("$"))
    );
  }

  ipcMain.handle("scan-mod-keys", async (_, { modsRoot, folderName }) => {
    try {
      const modPath = path.join(modsRoot, folderName);

      if (!fs.existsSync(modPath)) {
        return { success: false, error: "Mod folder not found" };
      }

      const iniFiles = findIniFiles(modPath);

      let hotkeys = [];

      for (const ini of iniFiles) {
        const content = fs.readFileSync(ini, "utf-8");
        const blocks = splitIniBlocks(content);

        for (const block of blocks) {
          if (!isKeySwapBlock(block.lines)) continue;

          const parsed = parseKeySwapBlock(block.lines);
          if (parsed) hotkeys.push(parsed);
        }
      }
      return {
        success: true,
        hotkeys,
      };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle("open-mod-folder", async (_, { modsRoot, folderName }) => {
    try {
      const fullPath = path.join(modsRoot, folderName);

      if (!fs.existsSync(fullPath)) {
        return { success: false, error: "Mod folder not found" };
      }

      await shell.openPath(fullPath);

      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  });
}
app.on("ready", createWindow);
app.on("window-all-closed", function () {
  if (process.platform !== "darwin") app.quit();
});
app.on("activate", function () {
  if (mainWindow === null) createWindow();
});
