import { CommonModule } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { PresetService } from '../../services/preset.service';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';
import { PresetCreateDialogComponent } from '../mod-list/preset-create/preset-create-dialog.component';
import { MatDialog } from '@angular/material/dialog';

@Component({
  selector: 'app-presets',
  templateUrl: './presets.components.html',
  styleUrl: './presets.component.scss',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatSelectModule],
})
export class PresetsComponent implements OnInit {
  private _dialog = inject(MatDialog);

  public presetService = inject(PresetService);

  ngOnInit(): void {
    this.presetService.load();
  }

  onPresetChange(id: string) {
    this.presetService.setActivePreset(id);
  }

  createPreset() {
    this._dialog
      .open(PresetCreateDialogComponent, {
        width: '320px',
        disableClose: true,
      })
      .afterClosed()
      .subscribe((name: string | undefined) => {
        if (!name) return;
        this.presetService.createPreset(name);
      });
  }

  onDeletePreset(id: string) {
    this._dialog
      .open(ConfirmDialogComponent, {
        data: {
          title: 'Delete the preset?',
          message: 'This action cannot be undone!',
        },
      })
      .afterClosed()
      .subscribe({
        next: (data) => {
          if (data) {
            this.presetService.deletePreset(id);
          }
        },
      });
  }
}
