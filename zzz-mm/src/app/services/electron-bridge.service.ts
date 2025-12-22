import { Injectable, signal } from '@angular/core';
import { AppConfigs } from './config.service';

export interface ElectronAPI {
  readFolder(folderPath: string): Promise<string[]>;
  readJsonfile<T = any>(filePath: string): Promise<T>;
  loadImage(filePath: string): Promise<string>;
  openExternalUrl(url: string): void;
  downloadImage(url: string, fileName: string, downloadPath: string): void;
  writeJsonFile(filePath: string, data: unknown): void;
  loadConfig(): Promise<AppConfigs>;
  saveConfig(data: unknown): void;
  createSymlink(
    target: string,
    linkPath: string
  ): Promise<{ success: boolean; error?: string }>;
  removeSymlink(
    linkPath: string
  ): Promise<{ success: boolean; error?: string }>;
  installMod(data: unknown): void;
  getFilePath(file: File): string;
  selectDirectory(options?: any): Promise<string>;
}

@Injectable({ providedIn: 'root' })
export class ElectronBridgeService {
  private _api = signal<ElectronAPI | null>(null);

  constructor() {
    if (typeof window === 'undefined') return;

    if ((window as any).electronAPI) {
      this._api.set((window as any).electronAPI as ElectronAPI);
      return;
    }

    window.addEventListener('electron-ready', () => {
      this._api.set((window as any).electronAPI as ElectronAPI);
    });
  }

  get api(): ElectronAPI | null {
    return this._api();
  }

  get isElectron(): boolean {
    return !!this._api();
  }
}
