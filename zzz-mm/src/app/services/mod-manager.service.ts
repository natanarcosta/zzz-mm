import { inject, Injectable, signal } from '@angular/core';
import { ElectronAPI, ElectronBridgeService } from './electron-bridge.service';
import { NotificationService } from './notifications.service';
import { MainService } from './main.service';
import { AgentMod, ZZZAgent } from '../models/agent.model';
import { ConfigService } from './config.service';
import { Subject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class ModManagerService {
  private _electronBridge = inject(ElectronBridgeService);
  private _notify = inject(NotificationService);
  private _mainService = inject(MainService);
  private _selectedAgent = signal<ZZZAgent | null>(null);
  private _configService = inject(ConfigService);

  public symSyncProgress = new Subject<{ total: number; current: number }>();

  private get electronAPI(): ElectronAPI | null {
    return this._electronBridge.api;
  }

  modFolderPath(mod: AgentMod): string {
    const diskPath =
      this._configService.config.source_mods_folder + '\\' + mod.folderName;

    return diskPath;
  }

  constructor() {
    this._mainService.agentSelected.subscribe({
      next: (agent) => this._selectedAgent.set(agent),
    });
  }

  handleSaveMetadata(mod: AgentMod) {
    const jsonPath = this.modFolderPath(mod) + '/mod.json';

    const now = new Date().toISOString();
    const json = mod.json;
    console.log(json);
    if (!json) return;
    json.localUpdatedAt = now;

    console.log(json);

    this.electronAPI?.writeJsonFile(jsonPath, json);
    this._mainService.updateAgentMod(mod);
    this._notify.success('Mod data saved successfully');
  }

  handleActivateMod(mod: AgentMod) {
    const json = mod.json;
    if (!json) return;

    mod = { ...mod, json: { ...json, active: true } };
    this.handleSaveMetadata(mod);

    const source =
      this._configService.config.source_mods_folder + '\\' + mod.folderName;

    const target =
      this._configService.config.mod_links_folder + '\\' + mod.folderName;

    this._createModLink(source, target);
  }

  private async _createModLink(sourceFolder: string, modsFolder: string) {
    const electronAPI = this.electronAPI;
    if (!electronAPI) return;

    const linkPath = modsFolder;

    const result = await electronAPI.createSymlink(sourceFolder, linkPath);

    if (!result.success) {
      console.error('Erro ao criar symlink:', result.error);
    } else {
      this._notify.success('Link criado com sucesso!');
    }
  }

  handleRemoveMod(mod: AgentMod) {
    if (!mod) return;

    const json = mod.json;
    if (!json) return;

    mod = { ...mod, json: { ...json, active: false } };
    this.handleSaveMetadata(mod);

    const target =
      this._configService.config.mod_links_folder + '\\' + mod.folderName;

    this._removeModLink(target);
  }

  private async _removeModLink(linkPath: string) {
    const electronAPI = this.electronAPI;
    if (!electronAPI) return;

    const result = await electronAPI.removeSymlink(linkPath);

    if (!result.success) {
      console.error('Erro ao remover symlink:', result.error);
    } else {
      this._notify.success('Link removido com sucesso!');
    }
  }

  async syncSymLinks() {
    const target = this._configService.config.mod_links_folder;
    const result = await this._configService.readDirectory(target);

    this.symSyncProgress.next({ total: result.length, current: 0 });

    result.forEach(async (folder, i) => {
      const jsonPath = target + '\\' + folder + '\\' + 'mod.json';
      const jsonContent = await this._configService.readJsonFile(jsonPath);
      if (jsonContent) {
        jsonContent.active = true;
        this.electronAPI?.writeJsonFile(jsonPath, jsonContent);
      }
      this.symSyncProgress.next({ total: result.length, current: i + 1 });
    });
  }
}
