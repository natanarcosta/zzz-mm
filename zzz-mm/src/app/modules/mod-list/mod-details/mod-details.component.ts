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
import { map, Observable, startWith, Subject, takeUntil } from 'rxjs';

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

  public hasGameBananaUrl = computed(() => {
    const url = this.mod()?.json?.url;
    return !!url && url.startsWith('https://gamebanana');
  });

  public imageUrl = computed(() => this.mod()?.previewPath ?? '');

  ngOnDestroy(): void {
    this._onDestroy$.next();
    this._onDestroy$.complete();
  }

  ngOnInit(): void {
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

    this._gBananaService.getModData(id).subscribe({
      next: (data) => {
        const mod = this.mod();
        if (!mod || !mod.json || !data.updated_at) return;

        const remoteUpdatedAt = data.updated_at.toISOString();
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
          this.availableUpdate.set(data.updated_at);
        }

        this.mod.set({
          ...mod,
          previewPath: this._gBananaService.getGBImage(id),
          json: {
            ...mod.json,
            modName: data.name,
            remoteUpdatedAt,
          },
        });

        if (data.fullSizePreview) {
          this.hasGbananaImage.set(true);
        }

        this._notify.info('Gamebanana data loaded');
      },
    });
  }

  handleSaveModDetails(): void {
    if (!this.hasGbananaImage()) return;

    const fileName = 'preview.jpg';
    const previewPath = this.mod()?.previewPath;
    if (!previewPath) return;

    const diskPath =
      this._configService.config.source_mods_folder +
      '\\' +
      this.mod()?.folderName;

    this.electronAPI?.downloadImage(previewPath, fileName, diskPath);
    this._notify.success('Image saved successfully');
  }

  handleSaveMetadata() {
    const jsonPath = this.modFolderPath + '/mod.json';
    const json = this.mod()?.json;
    if (!json) return;

    const now = new Date().toISOString();
    json.localUpdatedAt = now;

    this.electronAPI?.writeJsonFile(jsonPath, json);
    const mod = this.mod();
    if (!mod) return;

    this._mainService.updateAgentMod(mod);
    this._notify.success('Mod data saved successfully');
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
