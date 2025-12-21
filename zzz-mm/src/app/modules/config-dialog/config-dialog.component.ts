import { CommonModule } from '@angular/common';
import { ChangeDetectorRef, Component, inject, OnInit } from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { NotificationService } from '../../services/notifications.service';
import { AppConfigs, ConfigService } from '../../services/config.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

@Component({
  selector: 'app-config-dialog',
  standalone: true,
  templateUrl: './config-dialog.component.html',
  styleUrl: './config-dialog.component.scss',
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
export class ConfigDialogComponent implements OnInit {
  private _dialogRef = inject(MatDialogRef<ConfigDialogComponent>);
  private _notify = inject(NotificationService);
  private _configService = inject(ConfigService);
  private _config!: AppConfigs;
  private _cdr = inject(ChangeDetectorRef);

  public configsForm = new FormGroup({
    blur: new FormControl(),
    sourcePath: new FormControl(),
    linkPath: new FormControl(),
  });

  ngOnInit(): void {
    this._configService.configReady.subscribe({
      next: (config) => {
        this._config = config;

        this.configsForm.patchValue({
          blur: config.blur,
          sourcePath: config.source_mods_folder,
          linkPath: config.mod_links_folder,
        });
        this._cdr.markForCheck();
      },
    });
  }

  public closeDialog(): void {
    this._dialogRef.close();
  }
  public handleSaveConfig(): void {
    const config: AppConfigs = {
      blur: this.configsForm.controls.blur.value,
      source_mods_folder: this.configsForm.controls.sourcePath.value,
      mod_links_folder: this.configsForm.controls.linkPath.value,
    };
    this._configService.updateConfig({ ...config });
    this.closeDialog();
  }
}
