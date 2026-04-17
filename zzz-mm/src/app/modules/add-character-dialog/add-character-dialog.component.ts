import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, signal } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import {
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ElectronBridgeService } from '../../services/electron-bridge.service';
import { NotificationService } from '../../services/notifications.service';
import { MainService } from '../../services/main.service';

@Component({
  selector: 'app-add-character-dialog',
  standalone: true,
  templateUrl: './add-character-dialog.component.html',
  styleUrl: './add-character-dialog.component.scss',
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
  ],
})
export class AddCharacterDialogComponent implements OnDestroy {
  private _dialogRef = inject(MatDialogRef<AddCharacterDialogComponent>);
  private _electronBridge = inject(ElectronBridgeService);
  private _notify = inject(NotificationService);
  private _mainService = inject(MainService);

  public isSaving = signal(false);
  private _imagePath = signal<string | null>(null);
  private _imagePreviewUrl = signal<string | null>(null);
  private _imageFileName = signal<string | null>(null);

  public form = new FormGroup({
    name: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required],
    }),
  });

  get imagePath(): string | null {
    return this._imagePath();
  }

  get imagePreviewUrl(): string | null {
    return this._imagePreviewUrl();
  }

  get imageFileName(): string | null {
    return this._imageFileName();
  }

  ngOnDestroy(): void {
    const url = this._imagePreviewUrl();
    if (url) URL.revokeObjectURL(url);
  }

  closeDialog(): void {
    this._dialogRef.close(false);
  }

  private normalizeName(name: string): string {
    return name
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '-');
  }

  handleFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const prevUrl = this._imagePreviewUrl();
    if (prevUrl) URL.revokeObjectURL(prevUrl);
    this._imagePreviewUrl.set(URL.createObjectURL(file));
    this._imageFileName.set(file.name);

    const api = this._electronBridge.api;
    const filePath = api?.getFilePath(file as any);
    if (!filePath) {
      this._notify.error('Could not read file path');
      return;
    }

    this._imagePath.set(filePath);
  }

  save(): void {
    const api = this._electronBridge.api;
    if (!api) {
      this._notify.error('Electron API unavailable');
      return;
    }

    if (!this.form.valid) return;

    const rawName = this.form.controls.name.value;
    const name = this.normalizeName(rawName);
    if (!name) {
      this._notify.error('Invalid name');
      return;
    }

    const imagePath = this._imagePath();
    if (!imagePath) {
      this._notify.error('Select an image');
      return;
    }

    this.isSaving.set(true);
    this._electronBridge
      .createCharacter({ name, sourceImagePath: imagePath })
      .subscribe({
        next: async (res) => {
          this.isSaving.set(false);
          if (!res.success) {
            this._notify.error(res.error ?? 'Failed to create character');
            return;
          }

          await this._mainService.refreshAgents();
          this._notify.success('Character created');
          this._dialogRef.close(true);
        },
        error: () => {
          this.isSaving.set(false);
          this._notify.error('Failed to create character');
        },
      });
  }
}
