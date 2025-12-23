import { CommonModule } from '@angular/common';
import {
  ChangeDetectorRef,
  Component,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  FormsModule,
  ReactiveFormsModule,
} from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AppConfigs, ConfigService } from '../../services/config.service';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ModManagerService } from '../../services/mod-manager.service';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { Subject, takeUntil } from 'rxjs';

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
    MatProgressBarModule,
    MatSelectModule,
  ],
})
export class ConfigDialogComponent implements OnInit, OnDestroy {
  private _dialogRef = inject(MatDialogRef<ConfigDialogComponent>);
  private _configService = inject(ConfigService);
  private _config!: AppConfigs;
  private _cdr = inject(ChangeDetectorRef);
  private _modManagerService = inject(ModManagerService);
  private _onDestroy = new Subject<void>();

  public symLinkSyncProgress = signal(0);

  public configsForm = new FormGroup({
    blur: new FormControl(),
    sourcePath: new FormControl(),
    linkPath: new FormControl(),
    navbarType: new FormControl(),
    autoFetch: new FormControl(),
  });

  ngOnDestroy(): void {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

  ngOnInit(): void {
    this._configService.configReady.subscribe({
      next: (config) => {
        this._config = config;

        this.configsForm.patchValue({
          blur: config.blur,
          sourcePath: config.source_mods_folder,
          linkPath: config.mod_links_folder,
          navbarType: config.navbar_type,
          autoFetch: config.auto_fetch,
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
      navbar_type: this.configsForm.controls.navbarType.value,
      auto_fetch: this.configsForm.controls.autoFetch.value,
    };
    this._configService.updateConfig({ ...config });
    this.closeDialog();
  }

  public handleSyncSymlinks(): void {
    this._modManagerService.syncSymLinks();
    this._modManagerService.symSyncProgress
      .pipe(takeUntil(this._onDestroy))
      .subscribe({
        next: (value) =>
          this.symLinkSyncProgress.set((value.current / value.total) * 100),
      });
  }

  public async handlePickFolder(input: 'target' | 'source'): Promise<void> {
    const control =
      input === 'source'
        ? this.configsForm.controls.sourcePath
        : this.configsForm.controls.linkPath;

    const chosenPath = await this._configService.pickFolder();
    if (!chosenPath) return;

    control.setValue(chosenPath);
  }
}
