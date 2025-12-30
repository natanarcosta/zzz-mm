import { Injectable, signal } from '@angular/core';
import { AppConfigs } from './config.service';
import { Observable, throwError, from } from 'rxjs';
import { ModHotkey } from '../models/agent.model';

export interface ElectronAPI {
  readFolder(folderPath: string): Promise<string[]>;
  readJsonfile<T = any>(filePath: string): Promise<T>;
  loadImage(filePath: string): Promise<string>;
  openExternalUrl(url: string): void;
  downloadImage(
    url: string,
    fileName: string,
    downloadPath: string,
  ): Promise<void>;
  writeJsonFile(filePath: string, data: unknown): void;
  folderSize(folderPath: string): Promise<{ success: boolean; size?: number; error?: string }>;
  deleteFolder(folderPath: string): Promise<{ success: boolean; error?: string }>;
  loadConfig(): Promise<AppConfigs>;
  saveConfig(data: unknown): void;
  createSymlink(
    target: string,
    linkPath: string,
  ): Promise<{ success: boolean; error?: string }>;
  removeSymlink(
    linkPath: string,
  ): Promise<{ success: boolean; error?: string }>;
  installMod(data: unknown): Promise<{ success: boolean; error?: string }>;
  getFilePath(file: File): string;
  selectDirectory(options?: any): Promise<string>;
  extractModForUpdate(
    zipPath: string,
    targetFolder: string,
    baseModsDir: string,
    deleteArchiveAfter: boolean,
  ): Promise<{ success: boolean; error?: string }>;
  scanModKeys(
    modsRoot: string,
    folderName: string,
  ): Promise<{ success: boolean; hotkeys?: ModHotkey[]; err?: any }>;
  openModFolder(payload: { modsRoot: string; folderName: string }): void;
  syncModIniFromUser(payload: {
    modFolderName: string;
    d3dxUserIniPath: string;
    modsRoot: string;
  }): Promise<{ success: boolean; error?: string }>;
  quitApp(): void;
  getAppVersion: () => Promise<string>;
  saveModPreview(payload: {
    sourcePath: string;
    modFolderPath: string;
  }): Promise<{ success: boolean; previewPath?: string; error?: string }>;
  // Presets
  listPresets(): Promise<Preset[]>;
  getActivePreset(): Promise<{ id: string; preset: Preset }>;
  setActivePreset(
    id: string,
  ): Promise<{ success: boolean; id: string; preset: Preset }>;
  createPreset(name: string): Promise<Preset>;
  updatePresetMod(
    modId: string,
    enabled: boolean,
  ): Promise<{ success: boolean; preset: Preset }>;
  updatePresetBatch(
    changes: Array<{ modId: string; enabled: boolean }>,
  ): Promise<{ success: boolean; preset: Preset }>;
  deletePreset(
    presetId: string,
  ): Promise<{ success: boolean; activeId?: string; preset?: Preset; error?: string }>;
}

@Injectable({ providedIn: 'root' })
export class ElectronBridgeService {
  private _api = signal<ElectronAPI | null>(null);

  constructor() {
    if (typeof window === 'undefined') return;

    const win = window as any;

    if (win.electronAPI) {
      this._api.set(win.electronAPI as ElectronAPI);
    } else {
      window.addEventListener('electron-ready', () => {
        this._api.set(win.electronAPI as ElectronAPI);
      });
    }
  }

  private call<T>(fn: () => Promise<T>): Observable<T> {
    if (!this._api()) {
      return throwError(() => new Error('Electron API unavailable'));
    }

    return from(fn());
  }

  get api(): ElectronAPI | null {
    return this._api();
  }

  get isElectron(): boolean {
    return !!this._api();
  }

  loadConfig(): Observable<AppConfigs> {
    const api = this.api;
    return this.call(() => api!.loadConfig());
  }

  downloadImage(
    url: string,
    fileName: string,
    downloadPath: string,
  ): Observable<void> {
    const api = this.api;
    return this.call(() => api!.downloadImage(url, fileName, downloadPath));
  }

  installMod(
    payload: unknown,
  ): Observable<{ success: boolean; error?: string }> {
    return this.call(() => this._api()!.installMod(payload));
  }

  extractModForUpdate(
    zipPath: string,
    targetFolder: string,
    baseModsDir: string,
    deleteArchiveAfter: boolean,
  ): Observable<{
    success: boolean;
    error?: string;
    stats?: { updated: number; added: number; total: number };
  }> {
    return this.call(() =>
      this._api()!.extractModForUpdate(
        zipPath,
        targetFolder,
        baseModsDir,
        deleteArchiveAfter,
      ),
    );
  }

  scanModKeys(
    folderName: string,
    sourceFolder: string,
  ): Observable<{ success: boolean; err?: any; hotkeys?: ModHotkey[] }> {
    return from(
      this.api?.scanModKeys(sourceFolder, folderName) ??
        Promise.resolve({ success: false }),
    );
  }

  openModFolder(modsRoot: string, folderName: string) {
    return this.api!.openModFolder({
      modsRoot,
      folderName,
    });
  }

  syncModIniFromUser(
    modFolderName: string,
    d3dxUserIniPath: string,
    modsRoot: string,
  ): Observable<{ success: boolean; error?: string }> {
    return this.call(() =>
      this._api()!.syncModIniFromUser({
        modFolderName,
        d3dxUserIniPath,
        modsRoot,
      }),
    );
  }

  saveModPreview(payload: { sourcePath: string; modFolderPath: string }) {
    return this.call(() => this.api!.saveModPreview(payload));
  }

  // Presets
  listPresets() {
    return this.call(() => this.api!.listPresets());
  }

  getActivePreset() {
    return this.call(() => this.api!.getActivePreset());
  }

  setActivePreset(id: string) {
    return this.call(() => this.api!.setActivePreset(id));
  }

  createPreset(name: string) {
    return this.call(() => this.api!.createPreset(name));
  }

  updatePresetMod(modId: string, enabled: boolean) {
    return this.call(() => this.api!.updatePresetMod(modId, enabled));
  }

  updatePresetBatch(changes: Array<{ modId: string; enabled: boolean }>) {
    return this.call(() => this.api!.updatePresetBatch(changes));
  }

  deletePreset(presetId: string) {
    return this.call(() => this.api!.deletePreset(presetId));
  }

  quitApp(): void {
    return this._api()!.quitApp();
  }

  getAppVersion(): Observable<string> {
    return this.call(() => this.api!.getAppVersion());
  }

  folderSize(folderPath: string): Observable<{ success: boolean; size?: number; error?: string }> {
    return this.call(() => this.api!.folderSize(folderPath));
  }

  deleteFolder(folderPath: string): Observable<{ success: boolean; error?: string }> {
    return this.call(() => this.api!.deleteFolder(folderPath));
  }
}

export interface Preset {
  id: string;
  name: string;
  mods: Record<string, boolean>;
  createdAt: number;
  updatedAt: number;
}
