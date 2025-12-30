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

  async function installMod({ archivePath, destinationPath, modData, deleteArchiveAfter }) {
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

      // Optionally delete source archive after success
      if (deleteArchiveAfter) fs.rmSync(archivePath, { force: true });

      return { success: true };
    } catch (err) {
      console.error("INSTALL MOD ERROR:", err);
      return { success: false, error: err.message };
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }

  async function extractModUpdate({ zipPath, targetFolder, baseModsDir, deleteArchiveAfter }) {
    const targetPath = path.join(baseModsDir, targetFolder);
    const tempDir = path.join(os.tmpdir(), "zzz-mm", "install_" + Date.now());

    // Relevantes para mods (texturas/configs)
    const relevantExts = new Set([".ini", ".dds", ".ib", ".buf"]);

    function isRelevantFile(filePath) {
      return relevantExts.has(path.extname(filePath).toLowerCase());
    }

    function listFilesRecursive(baseDir) {
      const results = [];
      const stack = [""];
      while (stack.length) {
        const rel = stack.pop();
        const abs = path.join(baseDir, rel);
        const entries = fs.readdirSync(abs, { withFileTypes: true });
        for (const e of entries) {
          const nextRel = path.join(rel, e.name);
          const nextAbs = path.join(baseDir, nextRel);
          if (e.isDirectory()) {
            stack.push(nextRel);
          } else if (e.isFile()) {
            results.push({ relPath: nextRel, absPath: nextAbs });
          }
        }
      }
      return results;
    }

    function findBestContentDir(rootDir) {
      // varre todas as pastas e escolhe a que possui mais arquivos relevantes
      let bestDir = rootDir;
      let bestCount = 0;
      const stack = [rootDir];
      while (stack.length) {
        const dir = stack.pop();
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        let relCount = 0;
        for (const e of entries) {
          if (e.isDirectory()) stack.push(path.join(dir, e.name));
          else if (e.isFile() && isRelevantFile(e.name)) relCount++;
        }
        if (relCount > bestCount) {
          bestCount = relCount;
          bestDir = dir;
        }
      }
      return bestDir;
    }

    function ensureDir(p) {
      fs.mkdirSync(path.dirname(p), { recursive: true });
    }

    // =========================
    // INI Constants Merge Helpers
    // =========================
    function _findConstantsBlock(content) {
      // Locate [Constants] section boundaries
      const sectionRegex = /^\s*\[(.+?)\]\s*$/gmi;
      let match;
      let constantsStart = -1;
      let nextStart = content.length;
      while ((match = sectionRegex.exec(content)) !== null) {
        const name = match[1].trim();
        if (name.toLowerCase() === 'constants') {
          constantsStart = match.index;
          // find next section start after this match
          nextStart = content.length;
          while ((match = sectionRegex.exec(content)) !== null) {
            nextStart = match.index;
            break;
          }
          break;
        }
      }
      if (constantsStart < 0) return null;
      const startIdx = constantsStart;
      const endIdx = nextStart;
      const block = content.slice(startIdx, endIdx);

      // Extract variable names inside block using pattern like: global persist $var = value
      const varRegex = /^\s*global\s+persist\s+\$?([A-Za-z0-9_-]+)\s*=.*$/gmi;
      const keys = new Set();
      let m;
      while ((m = varRegex.exec(block)) !== null) {
        keys.add(m[1]);
      }
      return { startIdx, endIdx, block, keys };
    }

    function _tryMergeIniConstants(oldContent, newContent) {
      const oldBlk = _findConstantsBlock(oldContent);
      const newBlk = _findConstantsBlock(newContent);
      if (!oldBlk || !newBlk) return null;

      // Compare schema by variable names set
      if (oldBlk.keys.size !== newBlk.keys.size) return null;
      for (const k of oldBlk.keys) {
        if (!newBlk.keys.has(k)) return null;
      }

      // Replace the new block with the old block (preserve user-synced values)
      const merged =
        newContent.slice(0, newBlk.startIdx) +
        oldBlk.block +
        newContent.slice(newBlk.endIdx);
      return merged;
    }

    try {
      fs.mkdirSync(tempDir, { recursive: true });

      // 1) extrair para temp
      const ext = path.extname(zipPath).toLowerCase();
      if (ext === ".zip") {
        await extractZip(zipPath, tempDir);
      } else if (ext === ".rar") {
        await extractRar(zipPath, tempDir, unrarPath);
      } else {
        throw new Error("Formato não suportado");
      }

      // 2) detectar raiz real do update e pasta de conteudo
      const extractedRoot = unwrapSingleFolder(tempDir);
      const srcContentDir = findBestContentDir(extractedRoot);

      // 3) detectar pasta de conteúdo de destino (ex: subpasta cheias de .dds/.ini)
      let destContentDir = targetPath;
      try {
        destContentDir = findBestContentDir(targetPath);
      } catch {
        destContentDir = targetPath;
      }

      // 4) listar arquivos relevantes a copiar
      const srcFiles = listFilesRecursive(srcContentDir).filter((f) =>
        isRelevantFile(f.relPath)
      );

      if (srcFiles.length === 0) {
        return { success: false, error: "Nenhum arquivo relevante encontrado no update" };
      }

      // 5) criar pasta de backup para arquivos que serão sobrescritos
      const backupRoot = path.join(
        baseModsDir,
        ".backup",
        targetFolder,
        String(Date.now())
      );
      fs.mkdirSync(backupRoot, { recursive: true });

      let updated = 0;
      let added = 0;

      for (const f of srcFiles) {
        const destFile = path.join(destContentDir, f.relPath);
        // backup se destino existir
        if (fs.existsSync(destFile)) {
          const backupFile = path.join(backupRoot, path.relative(destContentDir, destFile));
          ensureDir(backupFile);
          fs.copyFileSync(destFile, backupFile);
          updated++;
        } else {
          added++;
        }
        ensureDir(destFile);
        const ext = path.extname(f.relPath).toLowerCase();
        let wrote = false;
        if (ext === '.ini' && fs.existsSync(destFile)) {
          try {
            const prevContent = fs.readFileSync(destFile, 'utf-8');
            const newContent = fs.readFileSync(f.absPath, 'utf-8');
            const merged = _tryMergeIniConstants(prevContent, newContent);
            if (merged) {
              fs.writeFileSync(destFile, merged, 'utf-8');
              wrote = true;
            }
          } catch {
            // fallback to regular copy
          }
        }
        if (!wrote) {
          fs.copyFileSync(f.absPath, destFile);
        }
      }

      // 6) atualizar timestamp do mod.json (para invalidar cache e registrar update)
      try {
        const modJsonPath = path.join(targetPath, "mod.json");
        if (fs.existsSync(modJsonPath)) {
          const json = JSON.parse(fs.readFileSync(modJsonPath, "utf-8"));
          json.localUpdatedAt = new Date().toISOString();
          fs.writeFileSync(modJsonPath, JSON.stringify(json, null, 2), "utf-8");
        }
      } catch (e) {
        console.warn("Falha ao atualizar mod.json:", e.message);
      }

      // Optionally delete update archive after success
      if (deleteArchiveAfter) fs.rmSync(zipPath, { force: true });

      return { success: true, stats: { updated, added, total: srcFiles.length } };
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
