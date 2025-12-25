import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import {
  MAT_DIALOG_DATA,
  MatDialog,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { AgentMod, ZZZAgent } from '../../../models/agent.model';
import {
  ElectronAPI,
  ElectronBridgeService,
} from '../../../services/electron-bridge.service';
import { GameBananaService } from '../../../services/gamebanana.service';
import { MatButtonModule } from '@angular/material/button';
import { ConfigService } from '../../../services/config.service';
import { MainService } from '../../../services/main.service';
import { NotificationService } from '../../../services/notifications.service';
import { ModManagerService } from '../../../services/mod-manager.service';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatInputModule } from '@angular/material/input';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import {
  finalize,
  firstValueFrom,
  map,
  Observable,
  startWith,
  Subject,
  takeUntil,
} from 'rxjs';
import { AddModComponent } from '../../add-mod/add-mod.component';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AgentNamePipe } from '../../../shared/agent-name.pipe';
import { MatIconModule } from '@angular/material/icon';

@Component({
  selector: 'app-mod-details',
  templateUrl: './mod-details.component.html',
  styleUrls: ['./mod-details.component.scss'],
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    FormsModule,
    ReactiveFormsModule,
    MatInputModule,
    MatFormFieldModule,
    MatAutocompleteModule,
    MatProgressBarModule,
    AgentNamePipe,
    MatIconModule,
  ],
})
export class ModDetailsComponent implements OnInit, OnDestroy {
  private _ref = inject(MatDialogRef<ModDetailsComponent>);
  private _electronBridge = inject(ElectronBridgeService);
  private _gBananaService = inject(GameBananaService);
  private _cdr = inject(ChangeDetectorRef);
  private _configService = inject(ConfigService);
  private _mainService = inject(MainService);
  private _notify = inject(NotificationService);
  private _modManagerService = inject(ModManagerService);
  private _data: { mod: AgentMod } = inject(MAT_DIALOG_DATA);
  private _onDestroy$ = new Subject<void>();
  private _dialog = inject(MatDialog);

  public mod = signal<AgentMod | null>(null);
  public hasGbananaImage = signal<boolean>(false);
  public editMode = signal<boolean>(false);
  public form = new FormGroup({
    character: new FormControl(),
    description: new FormControl(),
    url: new FormControl(),
    modName: new FormControl(),
  });
  public filteredAgents$!: Observable<ZZZAgent[]>;
  public agents!: ZZZAgent[];
  public selectedAgent!: ZZZAgent;
  public hasUpdate = signal(false);
  public availableUpdate = signal<Date | null>(null);
  public isRefreshing = signal(false);
  public isGettingGBananaData = signal(false);
  public blur = signal<boolean>(false);
  public isSyncingIni = signal<boolean>(false);
  public isDragging = false;
  file: File | null = null;
  filePath: string | null = null;
  public previewUrl = signal<string | null>(null);

  public hasGameBananaUrl = computed(() => {
    const url = this.mod()?.json?.url;
    return !!url && url.startsWith('https://gamebanana');
  });

  public imageUrl = computed(() => {
    const mod = this.mod();
    if (!mod) return '';

    //  preview local
    if (mod.previewPath) return mod.previewPath;

    // fallback GameBanana
    if (mod.json?.url?.includes('gamebanana') && mod.id) {
      return this._gBananaService.getGBananaImagePath(mod.id);
    }

    return '';
  });

  ngOnDestroy(): void {
    this._onDestroy$.next();
    this._onDestroy$.complete();
  }

  ngOnInit(): void {
    this._configService.configReady.subscribe({
      next: (config) => {
        this.blur.set(config.blur);
      },
    });

    this.mod.set(this._data.mod);

    this._mainService.agents$.pipe(takeUntil(this._onDestroy$)).subscribe({
      next: (agents) => (this.agents = agents),
    });

    this._mainService.agentSelected
      .pipe(takeUntil(this._onDestroy$))
      .subscribe({
        next: (data) => {
          if (!data) return;
          this.selectedAgent = data;
        },
      });

    this.filteredAgents$ = this.form.controls.character.valueChanges.pipe(
      startWith(''),
      map((value) => {
        const name = typeof value === 'string';
        return name ? this._filter(value) : this.agents.slice();
      })
    );

    this._cdr.markForCheck();
  }

  ngAfterViewInit(): void {
    const mod = this.mod();
    if (!mod) return;

    this.form.patchValue({
      modName: mod.json?.modName,
      character: this.selectedAgent,
      description: mod.json?.description,
      url: mod.json?.url,
    });
  }

  displayFn(character: ZZZAgent): string {
    return character && character.name ? character.name : '';
  }

  public closeDialog(): void {
    this._ref.close();
  }

  private _filter(name: string): ZZZAgent[] {
    const filterValue = name.toLowerCase();

    return this.agents.filter((option) =>
      option.name.toLowerCase().includes(filterValue)
    );
  }

  public cancelEditMode(): void {
    this.editMode.set(false);
    this.form.reset();
  }

  public toggleEditMode(): void {
    this.editMode.set(!this.editMode());
  }

  get electronAPI(): ElectronAPI | null {
    return this._electronBridge.api;
  }

  get modFolderPath(): string {
    const diskPath =
      this._configService.config.source_mods_folder +
      '\\' +
      this.mod()?.folderName;

    return diskPath;
  }

  handleSaveEdit(): void {
    const data: {
      character: string;
      description: string;
      url: string;
      modName: string;
    } = {
      ...this.form.getRawValue(),
      character: this.form.controls.character.value.name,
    };
    const mod = this.mod();
    if (!mod || !mod.json) return;
    this.mod.set({
      ...mod,

      json: {
        ...mod.json,
        character: data.character,
        description: data.description,
        url: data.url,
        modName: data.modName,
      },
    });

    this.editMode.set(false);
    this.handleSaveMetadata();
  }

  handleOpenExternalUrl(): void {
    const url = this.mod()?.json?.url;
    if (!url) return;

    this.electronAPI?.openExternalUrl(url);
  }

  handleGetModDataFromGBanana(): void {
    const id = this.mod()?.id;
    if (!id) return;

    this.isGettingGBananaData.set(true);
    this._gBananaService
      .getModData(id)
      .pipe(finalize(() => this.isGettingGBananaData.set(false)))
      .subscribe({
        next: (data) => {
          const mod = this.mod();
          if (!mod || !mod.json || !data.updatedAt) return;

          const remoteUpdatedAt = data.updatedAt.toISOString();
          const januaryFirst = 1735700400000;

          const localUpdatedAt =
            mod.json.localUpdatedAt ??
            mod.json.localInstalledAt ??
            new Date(0).toISOString();

          if (
            new Date(remoteUpdatedAt).getTime() >
            new Date(localUpdatedAt).getTime()
          ) {
            this.hasUpdate.set(true);
            this.availableUpdate.set(data.updatedAt);
          }

          this.mod.set({
            ...mod,
            previewPath: this._gBananaService.getGBananaImagePath(id),
            json: {
              ...mod.json,
              modName: data.name,
              remoteUpdatedAt,
            },
          });

          if (data.previews.full) {
            this.hasGbananaImage.set(true);
          }

          this._notify.info('Gamebanana data loaded');
        },
      });
  }

  handleSaveGBananaImage() {
    if (!this.hasGbananaImage()) return;

    const fileName = 'preview.jpg';
    const previewPath = this.mod()?.previewPath;
    if (!previewPath) return;

    const diskPath =
      this._configService.config.source_mods_folder +
      '\\' +
      this.mod()?.folderName;

    this.isRefreshing.set(true);

    this._electronBridge
      .downloadImage(previewPath, fileName, diskPath)
      .subscribe({
        next: () => this.handleRefreshMods(),
      });
    this._notify.success('Image saved successfully');
  }

  handleSaveMetadata() {
    const jsonPath = this.modFolderPath + '/mod.json';
    const json = this.mod()?.json;
    if (!json) return;

    const now = new Date().toISOString();
    json.localUpdatedAt = now;

    this.isRefreshing.set(true);
    this.electronAPI?.writeJsonFile(jsonPath, json);
    this.handleRefreshMods();

    const mod = this.mod();
    if (!mod) return;

    this._mainService.updateAgentMod(mod);
    this._notify.success('Mod data saved successfully');
  }

  async handleActivateMod() {
    const mod = this.mod();
    if (!mod) return;

    await this._modManagerService.handleActivateMod(mod);
    if (this._configService.config.disable_others) {
      const selectedAgent = await firstValueFrom(
        this._mainService.agentSelected
      );
      if (!selectedAgent) return;

      const modIndex = selectedAgent.mods?.findIndex(
        (_mod) => _mod.folderName === mod.folderName
      );
      if (modIndex && modIndex < 0) return;

      const toDisable = selectedAgent.mods?.filter((_, i) => i !== modIndex);
      if (!toDisable?.length) return;

      for (const disableMod of toDisable) {
        if (!disableMod) continue;
        await this.handleRemoveMod(disableMod);
      }
    }
  }

  async handleRemoveMod(targetMod?: AgentMod) {
    const mod = targetMod ? targetMod : this.mod();
    if (!mod) return;

    await this._modManagerService.handleRemoveMod(mod);
  }

  public handleUpdateExistindMod() {
    this._dialog
      .open(AddModComponent, {
        width: '40vw',
        data: {
          mode: 'update',
          targetMod: this.mod(),
        },
      })
      .afterClosed()
      .subscribe({
        next: (value: boolean) => {
          if (value) this._configService.refreshMods();
        },
      });
  }

  public handleRefreshMods() {
    this.isRefreshing.set(true);
    this._configService
      .refreshMods()
      .pipe(
        finalize(() => {
          this.isRefreshing.set(false);
        })
      )
      .subscribe();
  }

  scanKeys() {
    const mod = this.mod();
    if (!mod) return;
    const sourceFolderPath = this._configService.config.source_mods_folder;

    this._electronBridge
      .scanModKeys(mod.folderName, sourceFolderPath)
      .subscribe((res) => {
        if (!res.success) return;

        if (res.hotkeys?.length) {
          mod.json!.hotkeys = res.hotkeys;

          this.mod.set({ ...mod });
          this._electronBridge.api?.writeJsonFile(
            `${sourceFolderPath}\\${mod.folderName}\\mod.json`,
            mod.json
          );
        }
      });
  }

  handleOpenModFolder() {
    const mod = this.mod();
    if (!mod?.folderName) return;

    const modsRoot = this._configService.config.source_mods_folder;

    this._electronBridge.openModFolder(modsRoot, mod.folderName);
  }

  handleSyncIniVariables() {
    const configs = this._configService.config;
    const userIniPath = configs.user_ini_path + '\\' + 'd3dx_user.ini';
    const folderName = this.mod()?.folderName;
    const rootMods = configs.source_mods_folder;

    if (!folderName || !userIniPath || !rootMods) return;

    this.isSyncingIni.set(true);
    this._electronBridge
      .syncModIniFromUser(folderName, userIniPath, rootMods)
      .pipe(finalize(() => this.isSyncingIni.set(false)))
      .subscribe({
        next: (data) => {
          if (data.success) {
            this._notify.success('.ini file updated successfuly!');
          } else {
            this._notify.error('Error updating .ini file: ' + data.error);
          }
        },
      });
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }

    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    this.isDragging = false;

    const file = event.dataTransfer?.files?.[0];
    if (!file) return;

    const filePath = this.electronAPI?.getFilePath(file as any);
    if (!filePath) return;

    this.file = file;
    this.filePath = filePath;

    const objectUrl = URL.createObjectURL(file);
    this.previewUrl.set(objectUrl);
    this._cdr.markForCheck();
  }

  handleSaveLocalImage() {
    if (!this.filePath) return;

    const mod = this.mod();
    if (!mod) return;

    const modFolderPath = this.modFolderPath;

    this._electronBridge
      .saveModPreview({
        sourcePath: this.filePath,
        modFolderPath,
      })
      .subscribe({
        next: (res) => {
          if (!res.success) {
            this._notify.error(res.error ?? 'Failed to save image');
            return;
          }
          const json = mod.json;
          const now = new Date().toISOString();
          if (json) json.localUpdatedAt = now;

          this.mod.set({
            ...mod,
            previewPath: res.previewPath,
          });
          this._configService.deleteByFolder(mod.folderName);
          this._notify.success('Preview image saved');
          this.file = null;
          this.filePath = null;
          this.handleRefreshMods();
          this._cdr.markForCheck();
        },
      });
  }
}
