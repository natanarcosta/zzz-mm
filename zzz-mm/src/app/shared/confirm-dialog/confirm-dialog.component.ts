import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import {
  MAT_DIALOG_DATA,
  MatDialogModule,
  MatDialogRef,
} from '@angular/material/dialog';

@Component({
  selector: 'app-confirm-dialog',
  template: `
    <main style="padding: 24px; display: flex; gap: 16px; flex-direction: column; width: 400px; max-width: 90vw; border-radius: 14px; color: #ffffff">
      <h1 style="border: auto; text-align: center">{{ data?.title || 'Confirmation' }}</h1>
      <span>{{ data?.message || 'Confirm the action?' }}</span>
      <div style="display: flex; justify-content: space-between;  ">
        <button mat-flat-button color="warn" (click)="closeDialog()">
          Cancel
        </button>
        <button mat-flat-button color="primary" (click)="onConfirm()">
          Confirm
        </button>
      </div>
    </main>
  `,
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, MatButtonModule, MatDialogModule],
})
export class ConfirmDialogComponent {
  private _ref = inject(MatDialogRef<ConfirmDialogComponent>);
  public data?: { title?: string; message?: string } = inject(MAT_DIALOG_DATA);

  closeDialog(): void {
    this._ref.close();
  }

  onConfirm() {
    this._ref.close(true);
  }
}
