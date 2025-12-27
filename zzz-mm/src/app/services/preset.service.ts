import { Injectable, Signal, inject, signal } from '@angular/core';
import { ElectronBridgeService, Preset } from './electron-bridge.service';
import { ModIndexService } from './mod-index.service';
import { firstValueFrom } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class PresetService {
  private _electron = inject(ElectronBridgeService);
  private _modIndex = inject(ModIndexService);

  private _presets = signal<Preset[]>([]);
  private _activeId = signal<string>('default');
  private _activeMods = signal<Record<string, boolean>>({});

  get presets(): Signal<Preset[]> {
    return this._presets.asReadonly();
  }

  async updateModsBatch(
    changes: Array<{ modId: string; enabled: boolean }>,
  ): Promise<void> {
    const current = { ...(this._activeMods() || {}) };
    for (const c of changes) {
      current[c.modId] = c.enabled;
      this._patchActiveModInIndex(c.modId, c.enabled);
    }
    this._activeMods.set(current);

    const res = await firstValueFrom(this._electron.updatePresetBatch(changes));
    if (!res.success) return;
    this._activeMods.set(res.preset.mods || {});
    for (const c of changes) this._patchActiveModInIndex(c.modId, c.enabled);
  }

  get activePresetId(): Signal<string> {
    return this._activeId.asReadonly();
  }

  get activeMods(): Signal<Record<string, boolean>> {
    return this._activeMods.asReadonly();
  }

  load() {
    this._electron.listPresets().subscribe({
      next: (list) => this._presets.set(list),
    });

    this._electron.getActivePreset().subscribe({
      next: ({ id, preset }) => {
        this._activeId.set(id);
        this._activeMods.set(preset.mods || {});
      },
    });
  }

  setActivePreset(id: string) {
    return this._electron.setActivePreset(id).subscribe({
      next: (res) => {
        if (!res.success) return;
        this._activeId.set(res.id);
        this._activeMods.set(res.preset.mods || {});
        // ensure UI reflects new active statuses
        this._modIndex.refresh();
      },
    });
  }

  createPreset(name: string) {
    return this._electron.createPreset(name).subscribe({
      next: (preset) => {
        const list = this._presets();
        this._presets.set([...list, preset]);
      },
    });
  }

  deletePreset(presetId: string) {
    return this._electron.deletePreset(presetId).subscribe({
      next: (res) => {
        if (!res?.success) return;

        // remove from list
        const list = this._presets();
        this._presets.set(list.filter((p) => p.id !== presetId));

        // if active changed on backend, update active signals
        if (res.activeId && res.preset) {
          this._activeId.set(res.activeId);
          this._activeMods.set(res.preset.mods || {});
          this._modIndex.refresh();
        }
      },
    });
  }

  async updateMod(modId: string, enabled: boolean): Promise<void> {
    const current = { ...(this._activeMods() || {}) };
    current[modId] = enabled;
    this._activeMods.set(current);
    this._patchActiveModInIndex(modId, enabled);

    const res = await firstValueFrom(
      this._electron.updatePresetMod(modId, enabled),
    );
    if (!res.success) return;
    this._activeMods.set(res.preset.mods || {});
    this._patchActiveModInIndex(modId, enabled);
  }

  private _patchActiveModInIndex(folderName: string, active: boolean) {
    const map = new Map(this._modIndex.modsByAgent());
    for (const [key, list] of map.entries()) {
      const idx = list.findIndex((m) => m.folderName === folderName);
      if (idx >= 0) {
        const mod = list[idx];
        const json = mod.json ? { ...mod.json, active } : ({ active } as any);
        const updated = { ...mod, json };
        const newList = [...list];
        newList[idx] = updated;
        map.set(key, newList);
        this._modIndex.modsByAgent.set(map);
        break;
      }
    }
  }

  isModEnabled(modId: string): boolean {
    return !!this._activeMods()[modId];
  }
}
