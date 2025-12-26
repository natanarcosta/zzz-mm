import { CommonModule } from '@angular/common';
import {
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { NotificationService } from '../../services/notifications.service';
import { AppConfigs, ConfigService } from '../../services/config.service';
import { ElectronBridgeService } from '../../services/electron-bridge.service';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import {
  MatAutocompleteModule,
  MatAutocompleteTrigger,
} from '@angular/material/autocomplete';

import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MainService } from '../../services/main.service';
import { AgentMod, ZZZAgent } from '../../models/agent.model';
import { finalize, firstValueFrom, map, Observable, startWith } from 'rxjs';
import { AddModMode } from '../../models/types.model';
import {
  GameBananaService,
  GameBananaModData,
} from '../../services/gamebanana.service';
import { MatProgressBarModule } from '@angular/material/progress-bar';

@Component({
  selector: 'app-add-mod',
  templateUrl: './add-mod.component.html',
  styleUrl: './add-mod.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatDialogModule,
    MatIconModule,
    MatAutocompleteModule,
    MatProgressBarModule,
  ],
})
export class AddModComponent implements OnInit, OnDestroy {
  @ViewChild('trigger')
  autocompleteTrigger!: MatAutocompleteTrigger;

  private _notify = inject(NotificationService);
  private _configService = inject(ConfigService);
  private _electronBridge = inject(ElectronBridgeService);
  private _dialogRef = inject(MatDialogRef<AddModComponent>);
  private _mainService = inject(MainService);
  private _gBananaService = inject(GameBananaService);

  public data: {
    selectedAgent?: ZZZAgent;
    mode: AddModMode;
    targetMod?: AgentMod;
  } = inject(MAT_DIALOG_DATA);
  private _config!: AppConfigs;
  private _gBananaData = signal<GameBananaModData | null>(null);

  public filteredAgents$!: Observable<ZZZAgent[]>;
  public agents!: ZZZAgent[];

  file: File | null = null;
  filePath: string | null = null;
  isDragging = false;
  isInstalling = false;
  public previewUrl = signal<string | null>(null);

  form = new FormGroup({
    character: new FormControl<ZZZAgent | null>(null, {
      nonNullable: true,
      validators: [Validators.required],
    }),
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
    url: new FormControl('', { nonNullable: true }),
  });

  get electronAPI() {
    return this._electronBridge.api;
  }

  get disableSubmit(): boolean {
    if (this.data.mode === 'install') {
      return !this.form.valid || !this.file || this.isInstalling;
    }
    return !this.file || this.isInstalling;
  }

  displayFn(character: ZZZAgent): string {
    return character && character.name ? character.name : '';
  }

  ngOnDestroy(): void {}

  ngOnInit(): void {
    this._configService.configReady.subscribe({
      next: (config) => (this._config = config),
    });

    this._mainService.agents$.subscribe({
      next: (agents) => (this.agents = agents),
    });

    if (this.data.mode === 'install' && this.data.selectedAgent) {
      this.form.controls.character.setValue(this.data.selectedAgent);
    }

    this.filteredAgents$ = this.form.controls.character.valueChanges.pipe(
      map((value) => {
        const name = typeof value === 'string';
        return name ? this._filter(value) : this.agents.slice();
      }),
    );

    this.form.controls.url.valueChanges.subscribe({
      next: (data) => {
        const isGbananaUrl = data.includes('gamebanana.com');
        const modId = Number(data.split('/').pop());
        if (isGbananaUrl && modId) {
          this.previewUrl.set(this._gBananaService.getGBananaImagePath(modId));
        }
      },
    });
  }

  private _filter(name: string): ZZZAgent[] {
    const filterValue = name.toLowerCase();

    return this.agents.filter((option) =>
      option.name.toLowerCase().includes(filterValue),
    );
  }

  closeDialog(): void {
    this._dialogRef.close();
  }

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'; // 👈 LINHA CRÍTICA
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

    this.form.controls.name.setValue(file.name);

    const filePath = this.electronAPI?.getFilePath(file as any);
    if (!filePath) return;

    this.file = file;
    this.filePath = filePath;
  }

  async confirm() {
    if (!this.file || !this.filePath) return;
    if (this.data.mode === 'install' && !this.form.valid) return;
    if (!this.electronAPI) return;

    switch (this.data.mode) {
      case 'install':
        this.installMod();
        break;
      case 'update':
        this.updateMod();
        break;
    }
  }

  async installMod() {
    if (!this.file || !this.filePath) return;
    if (this.data.mode === 'install' && !this.form.valid) return;
    if (!this.electronAPI) return;
    const characterName = this.form.controls.character.value?.name;
    if (!characterName) {
      this._notify.error('Invalid character name');
    }

    this.isInstalling = true;

    const modId = Number(this.form.controls.url.value.split('/').pop());
    const isGBananaUrl = this.form.controls.url.value.includes('gamebanana');
    if (modId && this._config.auto_fetch && isGBananaUrl) {
      console.log('Fetch gbanana');
      const data = await firstValueFrom(this._gBananaService.getModData(modId));
      this._gBananaData.set(data);
      console.log('Proceeding after fetch');
    }

    const now = new Date().toISOString();
    const payload = {
      archivePath: this.filePath,
      destinationPath: this._config.source_mods_folder,
      modData: {
        ...this.form.value,
        modName: this.form.controls.name.value,
        character: characterName,
        localInstalledAt: now,
        localUpdatedAt: now,
        gamebananaPreviewUrl:
          this._config.auto_fetch && isGBananaUrl
            ? this._gBananaService.getGBananaImagePath(modId)
            : null,
      },
    };

    const gBananaData = this._gBananaData();
    if (gBananaData) {
      payload.modData.modName = gBananaData.name;
    }

    console.log('Payload: ', payload);

    this._electronBridge
      .installMod(payload)
      .pipe(finalize(() => (this.isInstalling = false)))
      .subscribe({
        next: (value) => {
          if (value.success) {
            this._notify.success('Mod instalado com sucesso');
            this._dialogRef.close(true);
          } else {
            this._notify.error(value.error || 'Erro ao instalar mod');
          }
        },
      });
  }

  updateMod() {
    if (!this.file || !this.filePath) return;
    if (!this.electronAPI) return;

    const mod = this.data.targetMod;
    if (!mod) return;
    const json = this.data.targetMod?.json;
    if (!json) return;

    const now = new Date().toISOString();

    const payload = {
      archivePath: this.filePath,
      destinationPath: this._config.source_mods_folder,
      modData: {
        ...json,
        localUpdatedAt: now,
      },
    };

    this.isInstalling = true;
    this._electronBridge
      .extractModForUpdate(
        payload.archivePath,
        mod.folderName,
        this._config.source_mods_folder,
      )
      .pipe(finalize(() => (this.isInstalling = false)))
      .subscribe({
        next: (result) => {
          if (result?.success) {
            this._notify.success('Mod atualizado com sucesso');
            this._dialogRef.close(true);
          } else {
            this._notify.error('Falha no update: ' + result?.error);
          }
        },
      });
  }
}
