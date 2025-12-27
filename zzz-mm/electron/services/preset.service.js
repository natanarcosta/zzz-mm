const fs = require("fs");
const path = require("path");

function createPresetService(app) {
  const USER_DIR = app.getPath("userData");
  const PRESETS_DIR = path.join(USER_DIR, "presets");
  const ACTIVE_PRESET_FILE = path.join(PRESETS_DIR, "_active.json");
  const CONFIG_PATH = path.join(USER_DIR, "config.json");

  function ensurePresetsDir() {
    if (!fs.existsSync(PRESETS_DIR))
      fs.mkdirSync(PRESETS_DIR, { recursive: true });
  }

  function getConfig() {
    try {
      if (!fs.existsSync(CONFIG_PATH)) return null;
      return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
    } catch (e) {
      console.error("PRESET:LOAD_CONFIG_ERROR", e);
      return null;
    }
  }

  function getPresetPath(id) {
    return path.join(PRESETS_DIR, `${id}.json`);
  }

  function readPreset(id) {
    return JSON.parse(fs.readFileSync(getPresetPath(id), "utf-8"));
  }

  function writePreset(preset) {
    preset.updatedAt = Date.now();
    fs.writeFileSync(getPresetPath(preset.id), JSON.stringify(preset, null, 2));
  }

  function ensureDefaultPreset() {
    ensurePresetsDir();
    const defaultPath = getPresetPath("default");
    if (!fs.existsSync(defaultPath)) {
      const preset = {
        id: "default",
        name: "Default",
        mods: {},
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      writePreset(preset);
      fs.writeFileSync(
        ACTIVE_PRESET_FILE,
        JSON.stringify({ id: preset.id }, null, 2),
      );
    }
  }

  function listPresets() {
    ensureDefaultPreset();
    return fs
      .readdirSync(PRESETS_DIR)
      .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
      .map((file) =>
        JSON.parse(fs.readFileSync(path.join(PRESETS_DIR, file), "utf-8")),
      );
  }

  function getActivePresetId() {
    ensureDefaultPreset();
    if (!fs.existsSync(ACTIVE_PRESET_FILE)) return "default";
    return JSON.parse(fs.readFileSync(ACTIVE_PRESET_FILE, "utf-8")).id;
  }

  function getActivePreset() {
    return readPreset(getActivePresetId());
  }

  function createPreset(name) {
    const id = name.toLowerCase().replace(/\s+/g, "-");
    const preset = {
      id,
      name,
      mods: {},
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    writePreset(preset);
    return preset;
  }

  function setActivePreset(id) {
    fs.writeFileSync(ACTIVE_PRESET_FILE, JSON.stringify({ id }, null, 2));
  }

  function updatePresetMod(presetId, modId, enabled) {
    const preset = readPreset(presetId);
    preset.mods[modId] = enabled;
    writePreset(preset);
  }

  function deletePreset(presetId) {
    try {
      ensureDefaultPreset();
      if (presetId === "default") {
        return { success: false, error: "Cannot delete default preset" };
      }

      const filePath = getPresetPath(presetId);
      if (!fs.existsSync(filePath)) {
        return { success: false, error: "Preset not found" };
      }

      const activeId = getActivePresetId();
      const deletedWasActive = activeId === presetId;
      if (deletedWasActive) {
        // Switch to default before removing
        setActivePreset("default");
      }

      fs.rmSync(filePath, { force: true });

      return { success: true, activeId: getActivePresetId(), deletedWasActive };
    } catch (e) {
      console.error("PRESET:DELETE_ERROR", presetId, e);
      return { success: false, error: e?.message || String(e) };
    }
  }

  // Symlink management and mod.json update
  async function _ensureDir(dir) {
    if (!fs.existsSync(dir)) await fs.promises.mkdir(dir, { recursive: true });
  }

  async function _createSymlink(target, linkPath) {
    await _ensureDir(path.dirname(linkPath));
    if (fs.existsSync(linkPath))
      await fs.promises.rm(linkPath, { recursive: true, force: true });
    const type = process.platform === "win32" ? "junction" : "dir";
    await fs.promises.symlink(target, linkPath, type);
  }

  async function _removeSymlink(linkPath) {
    if (!fs.existsSync(linkPath)) return;
    const stat = await fs.promises.lstat(linkPath);
    if (stat.isSymbolicLink()) await fs.promises.unlink(linkPath);
    else if (stat.isDirectory())
      await fs.promises.rm(linkPath, { recursive: true, force: true });
  }

  async function _writeModJson(sourceFolder, active) {
    const jsonPath = path.join(sourceFolder, "mod.json");
    if (!fs.existsSync(jsonPath)) return;
    try {
      const json = JSON.parse(await fs.promises.readFile(jsonPath, "utf-8"));
      if (json.active === active) return; // avoid unnecessary writes
      json.active = active;
      json.localUpdatedAt = new Date().toISOString();
      await fs.promises.writeFile(jsonPath, JSON.stringify(json, null, 2));
    } catch (e) {
      console.error("PRESET:WRITE_MOD_JSON_ERROR", jsonPath, e);
    }
  }

  async function applyPreset(preset) {
    const config = getConfig();
    if (!config) return { success: false, error: "Config not ready" };
    const sourceRoot = config.source_mods_folder;
    const linksRoot = config.mod_links_folder;
    if (!sourceRoot || !linksRoot)
      return { success: false, error: "Missing folders in config" };

    await _ensureDir(sourceRoot);
    await _ensureDir(linksRoot);

    const folders = fs
      .readdirSync(sourceRoot)
      .filter((f) => !f.endsWith(".txt"));

    for (const folder of folders) {
      const shouldEnable = preset.mods[folder] === true;
      const source = path.join(sourceRoot, folder);
      const link = path.join(linksRoot, folder);

      if (shouldEnable) {
        try {
          await _createSymlink(source, link);
        } catch (e) {
          console.error("SYMLINK_CREATE", folder, e);
        }
      } else {
        try {
          await _removeSymlink(link);
        } catch (e) {
          console.error("SYMLINK_REMOVE", folder, e);
        }
      }

      await _writeModJson(source, shouldEnable);
    }

    return { success: true };
  }

  async function applyActivePreset() {
    const preset = getActivePreset();
    return await applyPreset(preset);
  }

  async function applyPresetModChange(modId, enabled) {
    const preset = getActivePreset();
    preset.mods[modId] = enabled;
    writePreset(preset);

    const config = getConfig();
    if (!config) return { success: false, error: "Config not ready" };
    const sourceRoot = config.source_mods_folder;
    const linksRoot = config.mod_links_folder;
    if (!sourceRoot || !linksRoot)
      return { success: false, error: "Missing folders in config" };

    const source = path.join(sourceRoot, modId);
    const link = path.join(linksRoot, modId);

    try {
      if (enabled) await _createSymlink(source, link);
      else await _removeSymlink(link);
    } catch (e) {
      console.error("PRESET:APPLY_MOD_CHANGE", modId, e);
    }

    await _writeModJson(source, enabled);

    return { success: true, preset };
  }

  async function applyPresetBatchChanges(changes) {
    const preset = getActivePreset();
    for (const { modId, enabled } of changes) {
      preset.mods[modId] = enabled;
    }
    writePreset(preset);

    const config = getConfig();
    if (!config) return { success: false, error: "Config not ready" };
    const sourceRoot = config.source_mods_folder;
    const linksRoot = config.mod_links_folder;
    if (!sourceRoot || !linksRoot)
      return { success: false, error: "Missing folders in config" };

    await Promise.all(
      changes.map(async ({ modId, enabled }) => {
        const source = path.join(sourceRoot, modId);
        const link = path.join(linksRoot, modId);
        try {
          if (enabled) await _createSymlink(source, link);
          else await _removeSymlink(link);
        } catch (e) {
          console.error("PRESET:BATCH_CHANGE", modId, e);
        }
        await _writeModJson(source, enabled);
      }),
    );

    return { success: true, preset };
  }

  return {
    listPresets,
    getActivePreset,
    createPreset,
    setActivePreset,
    updatePresetMod,
    applyPreset,
    applyActivePreset,
    applyPresetModChange,
    applyPresetBatchChanges,
    getActivePresetId,
    deletePreset,
  };
}

module.exports = { createPresetService };
