import { inject, Injectable, signal } from '@angular/core';
import { AgentMod, ModJson, ZZZAgent } from '../models/agent.model';
import { MainService } from './main.service';
import { ElectronAPI, ElectronBridgeService } from './electron-bridge.service';
import { from, Observable, ReplaySubject } from 'rxjs';
import { NotificationService } from './notifications.service';
import { NavbarTypeEnum } from '../models/enums';
import { ModCacheService } from './mod-cache.service';

export interface AppConfigs {
  source_mods_folder: string;
  mod_links_folder: string;
  blur: boolean;
  navbar_type: NavbarTypeEnum;
  auto_fetch: boolean;
  disable_others: boolean;
}

interface CahceMod {
  cacheKey: string;
  agentMod: AgentMod;
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  public config!: AppConfigs;
  agents = signal<Array<ZZZAgent>>([]);
  folders = signal<Array<string>>([]);
  attempts = 0;

  private _mainService = inject(MainService);
  private _electronBridge = inject(ElectronBridgeService);
  private _notify = inject(NotificationService);
  private _modCacheService = inject(ModCacheService);

  public configReady = new ReplaySubject<AppConfigs>();

  constructor() {
    this._mainService.agents$.subscribe(async (a) => {
      this.agents.set(a);

      this.loadConfig();
    });
  }

  private get electronAPI(): ElectronAPI | null {
    return this._electronBridge.api;
  }

  async initConfigs() {
    await this.loadFolders();
    await this.populateCharacterMods();
  }

  async loadFolders() {
    await this.readDirectory(this.config.source_mods_folder, true);
  }

  loadConfig() {
    if (!this.electronAPI) return;

    this._electronBridge.loadConfig().subscribe({
      next: (config) => {
        this.config = config;
        this.configReady.next(this.config);
        this._notify.info('Configs loaded successfully');

        if (this._electronBridge.isElectron && this.config) {
          this.initConfigs();
        } else {
          console.warn('Electron is not ready');
          if (this.attempts >= 3) return;

          setTimeout(() => {
            this.attempts++;
            this.initConfigs();
          }, 1500);
        }
      },
    });
  }

  updateConfig(partial: Partial<AppConfigs>) {
    if (!this.electronAPI) return;

    this.config = { ...this.config, ...partial };
    this.electronAPI.saveConfig(this.config);
    this.configReady.next(this.config);
    this._notify.success('Configs saved successfully');
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

  private attachToAgent(mod: AgentMod) {
    const character = mod.json!.character.toLowerCase().replaceAll(' ', '-');

    const agent = this.agents().find((a) => a.name === character);
    if (!agent) return;

    agent.mods ??= [];
    agent.mods.push(mod);
  }

  async populateCharacterMods() {
    this.agents().forEach((agent) => (agent.mods = []));

    for (let folder of this.folders()) {
      try {
        if (folder.endsWith('.txt')) continue;

        const filePath =
          this.config.source_mods_folder + '\\' + folder + '\\mod.json';
        const folderPath = this.config.source_mods_folder + '\\' + folder;
        const folderContent: string[] = await this.readDirectory(
          folderPath,
          false
        );

        const jsonContent = await this.readJsonFile(filePath);
        if (!jsonContent) continue;

        const cacheKey = `${folder}:${jsonContent.localUpdatedAt}`;

        // 🔥 CACHE HIT
        const cached = this._modCacheService.get(cacheKey);
        if (cached) {
          this.attachToAgent(cached);
          continue;
        }

        const hasPreview = folderContent.find(
          (content) => content === 'preview.jpg'
        );

        const hasImage = folderContent.find(
          (content) =>
            content.endsWith('.png') ||
            content.endsWith('.jpg') ||
            content.endsWith('.jpeg')
        );

        const character = jsonContent.character
          .toLowerCase()
          .replaceAll(' ', '-');

        const url = jsonContent.url;
        const isGBananaId = url && url.includes('gamebanana');

        const agent = this.agents().find((a) => a.name === character);

        if (agent) {
          const agentMod: AgentMod = { folderName: folder, json: jsonContent };
          if (isGBananaId)
            agentMod.id = Number(url.split('/')[url.split('/').length - 1]);

          let image: string | undefined = hasPreview;
          if (!hasPreview) image = hasImage;

          const imagePath = image
            ? this.config.source_mods_folder + '\\' + folder + '\\' + image
            : null;

          const electronAPI = this.electronAPI;
          if (!electronAPI) continue;

          let src!: string;

          if (imagePath) {
            src = await electronAPI.loadImage(imagePath);
            agentMod.previewPath = src;
          }

          agentMod.json = jsonContent;

          this._modCacheService.set(cacheKey, agentMod);
          this.attachToAgent(agentMod);
        } else {
          console.error('Not found: ', jsonContent.character);
          continue;
        }
      } catch (err) {
        console.error('ERROR_POPULATE: ', err);
        continue;
      }
    }
    this._notify.info('Loaded mods successfully');
  }

  public async pickFolder(): Promise<string | undefined> {
    const result = await this._electronBridge.api?.selectDirectory();
    return result;
  }

  public refreshMods(): Observable<void> {
    this.loadFolders();
    return from(this.populateCharacterMods());
  }
}
