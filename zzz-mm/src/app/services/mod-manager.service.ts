import { inject, Injectable } from '@angular/core';
import { ElectronAPI, ElectronBridgeService } from './electron-bridge.service';
import { NotificationService } from './notifications.service';

@Injectable({ providedIn: 'root' })
export class ModManagerService {
  private _electronBridge = inject(ElectronBridgeService);
  private _notify = inject(NotificationService);

  private get electronAPI(): ElectronAPI | null {
    return this._electronBridge.api;
  }

  async createModLink(sourceFolder: string, modsFolder: string) {
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

  async removeModLink(linkPath: string) {
    const electronAPI = this.electronAPI;
    if (!electronAPI) return;

    const result = await electronAPI.removeSymlink(linkPath);

    if (!result.success) {
      console.error('Erro ao remover symlink:', result.error);
    } else {
      this._notify.success('Link removido com sucesso!');
    }
  }
}
