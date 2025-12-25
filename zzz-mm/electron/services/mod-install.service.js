const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");

const {
  extractZip,
  extractRar,
  unwrapSingleFolder,
} = require("../../utils/archive");

function createModInstaller({ isDev, sanitizeFolderName, scanKeysForMod }) {
  const unrarPath = isDev
    ? undefined
    : path.join(process.resourcesPath, "unrar", "unrar.exe");

  async function copyRecursive(src, dest) {
    const entries = await fs.promises.readdir(src, { withFileTypes: true });

    await fs.promises.mkdir(dest, { recursive: true });

    for (const entry of entries) {
      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        await copyRecursive(srcPath, destPath);
      } else if (entry.isFile()) {
        await fs.promises.copyFile(srcPath, destPath);
      }
    }
  }

  async function installMod({ archivePath, destinationPath, modData }) {
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
        await extractRar(archivePath, tempDir, unrarPath);
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

      await copyRecursive(contentRoot, finalPath);

      // DOWNLOAD PREVIEW IMAGE (optional)
      if (modData.gamebananaPreviewUrl) {
        try {
          const previewPath = path.join(finalPath, "preview.jpg");

          await new Promise((resolve, _reject) => {
            const file = fs.createWriteStream(previewPath);

            https
              .get(modData.gamebananaPreviewUrl, (response) => {
                if (response.statusCode !== 200) {
                  fs.unlink(previewPath, () => {});
                  return resolve(); // falha silenciosa
                }

                response.pipe(file);
                file.on("finish", () => {
                  file.close(resolve);
                });
              })
              .on("error", () => {
                fs.unlink(previewPath, () => {});
                resolve(); // falha silenciosa
              });
          });
        } catch (err) {
          console.warn("Preview download failed:", err.message);
        }
      }

      // ✅ scan correto (sem IPC, sem await desnecessário)
      let hotkeys = [];
      try {
        hotkeys = scanKeysForMod(destinationPath, safeFolderName);
      } catch (e) {
        console.warn("Key scan failed:", e.message);
      }

      // ✅ modJson criado UMA ÚNICA VEZ, já completo
      const modJson = {
        ...modData,
        folderName: safeFolderName,
        hotkeys,
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
  }

  async function extractModUpdate({ zipPath, targetFolder, baseModsDir }) {
    const targetPath = path.join(baseModsDir, targetFolder);
    const tempDir = path.join(os.tmpdir(), "zzz-mm", "install_" + Date.now());

    try {
      fs.mkdirSync(tempDir, { recursive: true });

      // 1) extrair
      const ext = path.extname(zipPath).toLowerCase();
      if (ext === ".zip") {
        await extractZip(zipPath, tempDir);
      } else if (ext === ".rar") {
        await extractRar(zipPath, tempDir, unrarPath);
      } else {
        throw new Error("Formato não suportado");
      }

      // 2) detectar raiz real do update
      const root = unwrapSingleFolder(tempDir);

      const updateEntries = fs.readdirSync(root);
      if (updateEntries.length === 0) {
        throw new Error("Pacote de update vazio");
      }

      // 3) copiar arquivos do update (merge)
      for (const file of updateEntries) {
        const src = path.join(root, file);
        const dest = path.join(targetPath, file);

        fs.cpSync(src, dest, {
          recursive: true,
          force: true, // sobrescreve se existir
        });
      }

      // 4) copiar novos arquivos
      for (const file of updateEntries) {
        fs.cpSync(path.join(root, file), path.join(targetPath, file), {
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

  return { installMod, extractModUpdate };
}

module.exports = { createModInstaller };
