import { inject, Injectable, signal } from '@angular/core';
import { AgentMode, ModJson, ZZZAgent } from '../models/agent.model';
import { MainService } from './main.service';
import { ElectronAPI, ElectronBridgeService } from './electron-bridge.service';
import { BehaviorSubject, ReplaySubject, Subject } from 'rxjs';
import { NotificationService } from './notifications.service';

export interface AppConfigs {
  source_mods_folder: string;
  mod_links_folder: string;
  blur: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  public config!: AppConfigs;
  agents = signal<Array<ZZZAgent>>([]);
  folders = signal<Array<string>>([]);

  private _mainService = inject(MainService);
  private _electronBridge = inject(ElectronBridgeService);
  private _notify = inject(NotificationService);

  public configReady = new ReplaySubject<AppConfigs>();

  constructor() {
    this._mainService.agents$.subscribe(async (a) => {
      this.agents.set(a);

      await this.loadConfig();

      if (this._electronBridge.isElectron && this.config) {
        await this.initConfigs();
      } else {
        console.warn('Electron ainda não pronto');
      }
    });
  }

  private get electronAPI(): ElectronAPI | null {
    return this._electronBridge.api;
  }

  async initConfigs() {
    await this.readDirectory(this.config.source_mods_folder, true);
    await this.populateCharacterMods();
  }

  async loadConfig() {
    if (!this.electronAPI) return;

    this.config = await this.electronAPI.loadConfig();
    this.configReady.next(this.config);
    this._notify.info('Configs loaded successfuly');
  }

  updateConfig(partial: Partial<AppConfigs>) {
    if (!this.electronAPI) return;

    this.config = { ...this.config, ...partial };
    this.electronAPI.saveConfig(this.config);
    this._notify.success('Configs saved successfuly');
  }

  async readDirectory(folderPath: string, setFolders = false) {
    const electronAPI = this.electronAPI;
    if (!electronAPI) {
      console.warn('Electron API indisponível');
      return [];
    }

    try {
      const folders = await electronAPI.readFolder(folderPath);
      if (setFolders) this.folders.set(folders);
      return folders;
    } catch (err) {
      console.error('READ_DIRECTORY ERRO:', err);
      return [];
    }
  }

  async readJsonFile(path: string): Promise<ModJson | undefined> {
    const electronAPI = this.electronAPI;

    if (!electronAPI) {
      console.warn('Electron API indisponível');
      return undefined;
    }

    try {
      return await electronAPI.readJsonfile(path);
    } catch (err) {
      console.error('READ_JSON_FILE ERRO: ', err);
      return undefined;
    }
  }

  async populateCharacterMods() {
    this.agents().forEach((agent) => (agent.mods = []));

    for (let folder of this.folders()) {
      if (folder.endsWith('.txt')) continue;

      const filePath =
        this.config.source_mods_folder + '\\' + folder + '\\mod.json';
      const folderPath = this.config.source_mods_folder + '\\' + folder;
      const folderContent: string[] = await this.readDirectory(
        folderPath,
        false
      );

      const hasPreview = folderContent.find(
        (content) => content === 'preview.jpg'
      );

      const hasImage = folderContent.find(
        (content) =>
          content.endsWith('.png') ||
          content.endsWith('.jpg') ||
          content.endsWith('.jpeg')
      );

      const jsonContent = await this.readJsonFile(filePath);
      if (!jsonContent) continue;

      const character = jsonContent.character
        .toLowerCase()
        .replaceAll(' ', '-');

      const url = jsonContent.url;
      const isGBananaId = url && url.includes('gamebanana');

      const agent = this.agents().find((a) => a.name === character);

      if (agent) {
        const agentMod: AgentMode = { folderName: folder };
        if (isGBananaId)
          agentMod.id = Number(url.split('/')[url.split('/').length - 1]);

        let image: string | undefined = hasPreview;
        if (!hasPreview) image = hasImage;

        const imagePath = image
          ? this.config.source_mods_folder + '\\' + folder + '\\' + image
          : 'src/assets/char-portraits/' + agent.id + '.png';

        const electronAPI = this.electronAPI;
        if (!electronAPI) continue;

        const src = await electronAPI.loadImage(imagePath);

        agentMod.previewPath = src;
        agentMod.json = jsonContent;

        agent.mods?.push(agentMod);
      } else {
        console.log('Not found: ', jsonContent.character);
      }
    }
  }
}
