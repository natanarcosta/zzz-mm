import { CommonModule } from '@angular/common';
import { Component, inject, OnInit, ViewChild } from '@angular/core';
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
import { ZZZAgent } from '../../models/agent.model';
import { map, Observable, startWith } from 'rxjs';

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
export class AddModComponent implements OnInit {
  @ViewChild('trigger')
  autocompleteTrigger!: MatAutocompleteTrigger;

  private _notify = inject(NotificationService);
  private _configService = inject(ConfigService);
  private _electronBridge = inject(ElectronBridgeService);
  private _dialogRef = inject(MatDialogRef<AddModComponent>);
  private _mainService = inject(MainService);
  private _data: { selectedAgent: ZZZAgent } = inject(MAT_DIALOG_DATA);
  private _config!: AppConfigs;

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

  ngOnInit(): void {
    this._configService.configReady.subscribe({
      next: (config) => (this._config = config),
    });

    this._mainService.agents$.subscribe({
      next: (agents) => (this.agents = agents),
    });

    this.form.controls.character.setValue(this._data.selectedAgent);

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
    this.isDragging = true;
  }

  onDragLeave(event: DragEvent) {
    event.preventDefault();
    this.isDragging = false;
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
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
    if (!this.form.valid || !this.file || !this.filePath) return;
    if (!this.electronAPI) return;

    const payload = {
      archivePath: this.filePath,
      destinationPath: this._config.source_mods_folder,
      modData: {
        ...this.form.value,
        modName: this.form.controls.name.value,
        character: (this.form.controls.character.value as any).name,
      },
    };

    try {
      await this.electronAPI.installMod(payload);
      this._notify.success('Mod instalado com sucesso');
      this._dialogRef.close(true);
    } catch (err) {
      this._notify.error('Erro ao instalar o mod');
      console.error(err);
    }
  }
}
