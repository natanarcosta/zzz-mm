const IpcHandler = {
  // =====================
  // CONFIG
  // =====================
  LOAD_CONFIG: "load-config",
  SAVE_CONFIG: "save-config",

  // =====================
  // FILE SYSTEM
  // =====================
  READ_FOLDER: "read-folder",
  READ_JSON_FILE: "read-json-file",
  WRITE_JSON_FILE: "write-json-file",

  // =====================
  // IMAGE / PREVIEW
  // =====================
  LOAD_IMAGE: "load-image",
  SAVE_MOD_PREVIEW: "save-mod-preview",
  DOWNLOAD_IMAGE: "download-image",

  // =====================
  // MODS
  // =====================
  SCAN_MOD_KEYS: "scan-mod-keys",
  INSTALL_MOD: "install-mod",
  EXTRACT_MOD_UPDATE: "extract-mod-update",
  SYNC_MOD_INI_FROM_D3DX: "sync-mod-ini-from-d3dx",

  // =====================
  // SYMLINK
  // =====================
  CREATE_SYMLINK: "create-symlink",
  REMOVE_SYMLINK: "remove-symlink",

  // =====================
  // PRESETS
  // =====================
  PRESET_LIST: "preset-list",
  PRESET_GET_ACTIVE: "preset-get-active",
  PRESET_SET_ACTIVE: "preset-set-active",
  PRESET_CREATE: "preset-create",
  PRESET_UPDATE_MOD: "preset-update-mod",
  PRESET_BATCH_UPDATE: "preset-batch-update",

  // =====================
  // SYSTEM
  // =====================
  OPEN_EXTERNAL_URL: "open-external-url",
  SELECT_DIRECTORY: "select-directory",
  OPEN_MOD_FOLDER: "open-mod-folder",
  APP_QUIT: "app-quit",
  GET_APP_VERSION: "get-app-version",
};

module.exports = { IpcHandler };
