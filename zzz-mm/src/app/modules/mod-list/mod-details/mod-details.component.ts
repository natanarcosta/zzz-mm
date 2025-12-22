import { CommonModule, NgOptimizedImage } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { AgentMode } from '../../../models/agent.model';
import {
  ElectronAPI,
  ElectronBridgeService,
} from '../../../services/electron-bridge.service';
import { GameBananaService } from '../../../services/gamebanana.service';
import { CdkOverlayOrigin } from '@angular/cdk/overlay';
import { MatButtonModule } from '@angular/material/button';
import { ConfigService } from '../../../services/config.service';
import { MainService } from '../../../services/main.service';
import { NotificationService } from '../../../services/notifications.service';
import { ModManagerService } from '../../../services/mod-manager.service';

@Component({
  selector: 'app-mod-details',
  templateUrl: './mod-details.component.html',
  styleUrls: ['./mod-details.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatDialogModule,
    NgOptimizedImage,
    CdkOverlayOrigin,
    MatButtonModule,
  ],
})
export class ModDetailsComponent implements OnInit {
  private _ref = inject(MatDialogRef<ModDetailsComponent>);
  private _electronBridge = inject(ElectronBridgeService);
  private _gBananaService = inject(GameBananaService);
  private _cdr = inject(ChangeDetectorRef);
  private _configService = inject(ConfigService);
  private _mainService = inject(MainService);
  private _notify = inject(NotificationService);
  private _modManagerService = inject(ModManagerService);

  private _data: { mod: AgentMode } = inject(MAT_DIALOG_DATA);
  public mod = signal<AgentMode | null>(null);
  public hasGbananaImage = signal<boolean>(false);

  ngOnInit(): void {
    this.mod.set(this._data.mod);
    this._cdr.markForCheck();
  }

  public closeDialog(): void {
    this._ref.close();
  }

  get electronAPI(): ElectronAPI | null {
    return this._electronBridge.api;
  }

  get hasGameBananaUrl(): boolean | undefined {
    return this.mod()?.json?.url.startsWith('https://gamebanana');
  }

  get imageUrl(): string {
    const path = this.mod()?.previewPath || '';
    return path;
  }

  get modFolderPath(): string {
    const diskPath =
      this._configService.config.source_mods_folder +
      '\\' +
      this.mod()?.folderName;

    return diskPath;
  }

  handleOpenExternalUrl(): void {
    const url = this.mod()?.json?.url;
    if (!url) return;

    this.electronAPI?.openExternalUrl(url);
  }

  handleGetModDataFromGBanana(): void {
    const id = this.mod()?.id;
    if (!id) return;

    this._gBananaService.getModData(id).subscribe({
      next: (data) => {
        this.mod.set({
          ...this.mod(),
          folderName: this.mod()!.folderName,
          previewPath: this._gBananaService.getGBImage(id),
          json: {
            ...this.mod()?.json,
            character: this.mod()!.json!.character,
            preview: this.mod()!.json!.preview,
            url: this.mod()!.json!.url,
            hotkeys: this.mod()!.json!.hotkeys,
            modName: data.name,
            active: this.mod()!.json!.active,
          },
        });
        if (data.fullSizePreview) this.hasGbananaImage.set(true);
        this._notify.info('Gamebanana data loaded');
        this._cdr.markForCheck();
      },
    });
  }

  handleSaveModDetails(): void {
    if (!this.hasGbananaImage()) return;

    const fileName = 'preview.jpg';
    const previewPath = this.mod()!.previewPath;
    if (!previewPath) return;
    const diskPath =
      this._configService.config.source_mods_folder +
      '\\' +
      this.mod()?.folderName;

    this.electronAPI?.downloadImage(previewPath, fileName, diskPath);
    this._notify.success('Image saved successfuly');
  }

  handleSaveMetadata() {
    const jsonPath = this.modFolderPath + '/mod.json';
    this.electronAPI?.writeJsonFile(jsonPath, this.mod()?.json);
    const mod = this.mod();
    if (!mod) return;

    this._mainService.updateAgentMod(mod);
    this._notify.success('Mod data saved successfuly');
  }

  handleActivateMod() {
    const mod = this.mod();
    if (!mod) return;

    this._modManagerService.handleActivateMod(mod);
  }

  handleRemoveMod() {
    const mod = this.mod();
    if (!mod) return;

    this._modManagerService.handleRemoveMod(mod);
  }
}
