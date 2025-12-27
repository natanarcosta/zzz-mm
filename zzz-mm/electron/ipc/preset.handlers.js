const { IpcHandler } = require("../../shared/ipc.channels");
const { createPresetService } = require("../services/preset.service");

function registerPresetHandlers(ipcMain, app) {
  const svc = createPresetService(app);

  ipcMain.handle(IpcHandler.PRESET_LIST, async () => {
    return svc.listPresets();
  });

  ipcMain.handle(IpcHandler.PRESET_GET_ACTIVE, async () => {
    return { id: svc.getActivePresetId(), preset: svc.getActivePreset() };
  });

  ipcMain.handle(IpcHandler.PRESET_SET_ACTIVE, async (_, id) => {
    svc.setActivePreset(id);
    const result = await svc.applyActivePreset();
    const active = svc.getActivePreset();
    return { ...result, id, preset: active };
  });

  ipcMain.handle(IpcHandler.PRESET_CREATE, async (_, name) => {
    const preset = svc.createPreset(name);
    return preset;
  });

  ipcMain.handle(
    IpcHandler.PRESET_UPDATE_MOD,
    async (_, payload) => {
      const { modId, enabled } = payload;
      const result = await svc.applyPresetModChange(modId, enabled);
      const active = svc.getActivePreset();
      return { ...result, preset: active };
    }
  );

  ipcMain.handle(
    IpcHandler.PRESET_BATCH_UPDATE,
    async (_, changes) => {
      const result = await svc.applyPresetBatchChanges(changes);
      const active = svc.getActivePreset();
      return { ...result, preset: active };
    }
  );
}

module.exports = { registerPresetHandlers };
