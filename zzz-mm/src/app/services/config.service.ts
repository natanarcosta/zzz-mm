import { inject, Injectable } from '@angular/core';
import { ElectronAPI, ElectronBridgeService } from './electron-bridge.service';
import { ReplaySubject } from 'rxjs';
import { NotificationService } from './notifications.service';
import { NavbarTypeEnum } from '../models/enums';

export interface AppConfigs {
  source_mods_folder: string;
  mod_links_folder: string;
  blur: boolean;
  navbar_type: NavbarTypeEnum;
  auto_fetch: boolean;
  disable_others: boolean;
  user_ini_path: string;
  show_all_active_when_empty: boolean;
  delete_archive_after_install: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ConfigService {
  public config!: AppConfigs;
  attempts = 0;

  private _electronBridge = inject(ElectronBridgeService);
  private _notify = inject(NotificationService);

  public configReady = new ReplaySubject<AppConfigs>();

  constructor() {
    this.loadConfig();
  }

  private get electronAPI(): ElectronAPI | null {
    return this._electronBridge.api;
  }

  loadConfig() {
    if (!this.electronAPI) return;

    this._electronBridge.loadConfig().subscribe({
      next: (config) => {
        this.config = config;
        this.configReady.next(this.config);
        this._notify.info('Configs loaded successfully');
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

  public async pickFolder(): Promise<string | undefined> {
    const result = await this._electronBridge.api?.selectDirectory();
    return result;
  }
}
