import { Injectable, inject, signal } from '@angular/core';
import { AgentMod, ModJson } from '../models/agent.model';
import { AppConfigs, ConfigService } from './config.service';
import { ElectronBridgeService } from './electron-bridge.service';
import { ModCacheService } from './mod-cache.service';

@Injectable({ providedIn: 'root' })
export class ModIndexService {
  private _configService = inject(ConfigService);
  private _electronBridge = inject(ElectronBridgeService);
  private _modCache = inject(ModCacheService);
  private _configs = signal<AppConfigs | null>(null);

  modsByAgent = signal<Map<string, AgentMod[]>>(new Map());

  constructor() {
    this._configService.configReady.subscribe({
      next: (config) => {
        this._configs.set(config);
        this.refresh();
      },
    });
  }

  async refresh() {
    await this._indexMods();
  }

  invalidate(folderName: string) {
    for (const key of this._modCache.keys) {
      if (key.startsWith(folderName + ':')) {
        this._modCache.delete(key);
      }
    }
  }

  async rebuild() {
    this._modCache.clear();
    await this._indexMods();
  }

  private async _indexMods() {
    const config = this._configs();
    if (!config) return;

    const electronAPI = this._electronBridge.api;
    if (!electronAPI) return;

    const result = new Map<string, AgentMod[]>();

    const folders = await electronAPI.readFolder(config.source_mods_folder);

    for (const folder of folders) {
      if (folder.endsWith('.txt') || folder.includes('.backup')) continue;

      try {
        const jsonPath = `${config.source_mods_folder}\\${folder}\\mod.json`;

        const json: ModJson = await electronAPI.readJsonfile(jsonPath);
        if (!json) continue;

        const cacheKey = `${folder}:${json.localUpdatedAt}`;
        const cached = this._modCache.get(cacheKey);
        if (cached) {
          this._attach(result, cached);
          continue;
        }

        const mod: AgentMod = {
          folderName: folder,
          json,
        };

        if (json.url.includes('gamebanana.com')) {
          const id = Number(json.url.split('/').pop());
          if (!isNaN(id)) mod.id = id;
        }

        const folderFiles = await electronAPI.readFolder(
          `${config.source_mods_folder}\\${folder}`,
        );

        let image: string | undefined = folderFiles.find(
          (i) => i.toLowerCase() === 'preview.jpg',
        );

        if (!image) {
          image = folderFiles.find(
            (f) => f !== 'preview.jpg' && /\.(png|jpe?g)$/i.test(f),
          );
        }

        if (image) {
          mod.previewPath = await electronAPI.loadImage(
            `${config.source_mods_folder}\\${folder}\\${image}`,
          );
        }

        this._modCache.set(cacheKey, mod);
        this._attach(result, mod);
      } catch (err) {
        console.error('INDEX ERROR', folder, err);
      }
    }

    this.modsByAgent.set(result);
  }

  private _attach(map: Map<string, AgentMod[]>, mod: AgentMod) {
    const agent = mod.json!.character.toLowerCase().replaceAll(' ', '-');
    const list = map.get(agent) ?? [];
    list.push(mod);
    map.set(agent, list);
  }
}
