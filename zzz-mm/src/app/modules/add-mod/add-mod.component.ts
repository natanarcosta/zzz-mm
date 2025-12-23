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
import { map, Observable, startWith } from 'rxjs';
import { AddModMode } from '../../models/types.model';
import {
  GameBananaService,
  GameBananaModData,
} from '../../services/gamebanana.service';

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

  form = new FormGroup({
    character: new FormControl<ZZZAgent | null>(null, { nonNullable: true }),
    name: new FormControl('', { nonNullable: true }),
    url: new FormControl('', { nonNullable: true }),
  });

  get electronAPI() {
    return this._electronBridge.api;
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
      startWith(''),
      map((value) => {
        const name = typeof value === 'string';
        return name ? this._filter(value) : this.agents.slice();
      })
    );
  }

  private _filter(name: string): ZZZAgent[] {
    const filterValue = name.toLowerCase();

    return this.agents.filter((option) =>
      option.name.toLowerCase().includes(filterValue)
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

    if (this._config.auto_fetch) {
      const url = this.form.controls.url.value;
      const isGameBananaMod = url.includes('gamebanana.com');
      if (isGameBananaMod) {
        const id = Number(url.split('/')[url.split('/').length - 1]);
        if (id && !isNaN(id)) {
          this.handleAddGameBananMod(id);
          return;
        }
      }
    }

    console.log('Chegou no switch');
    switch (this.data.mode) {
      case 'install':
        this.installMod();
        break;
      case 'update':
        this.updateMod();
        break;
    }
  }

  handleAddGameBananMod(id: number): void {
    if (!id) return;

    this._gBananaService.getModData(id).subscribe({
      next: (data) => {
        const image = this._gBananaService.getGBananaImagePath(id);
        console.log(data);
        this._gBananaData.set(data);
        this.installMod();

        // const fileName = 'preview.jpg';
        // const previewPath = this.mod()?.previewPath;
        // if (!previewPath) return;

        // const diskPath =
        //   this._configService.config.source_mods_folder + '\\' + data.name;

        // this._electronBridge
        //   .downloadImage(previewPath, fileName, diskPath)
        //   .subscribe({
        //     next: () => {},
        //   });
      },
    });
  }

  installMod() {
    if (!this.file || !this.filePath) return;
    if (this.data.mode === 'install' && !this.form.valid) return;
    if (!this.electronAPI) return;

    const now = new Date().toISOString();
    const payload = {
      archivePath: this.filePath,
      destinationPath: this._config.source_mods_folder,
      modData: {
        ...this.form.value,
        modName: this.form.controls.name.value,
        character: (this.form.controls.character.value as any).name,
        localInstalledAt: now,
        localUpdatedAt: now,
      },
    };

    const gBananaData = this._gBananaData();
    if (gBananaData) {
      payload.modData.modName = gBananaData.name;
    }

    console.log('Payload: ', payload);

    this._electronBridge.installMod(payload).subscribe({
      next: (value) => {
        if (value.success) {
          this._configService.refreshMods();
          this._notify.success('Mod instalado com sucesso');
          this._dialogRef.close(true);
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

    this._electronBridge
      .extractModForUpdate(
        payload.archivePath,
        mod.folderName,
        this._config.source_mods_folder
      )
      .subscribe({
        next: (result) => {
          if (result.success) {
            this._notify.success('Mod atualizado com sucesso');
            this._dialogRef.close(true);
          } else {
            this._notify.error('Falha no update: ' + result.error);
          }
        },
      });
  }
}
