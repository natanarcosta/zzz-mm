import { Component, inject } from '@angular/core';
import { MatDialogRef } from '@angular/material/dialog';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';

@Component({
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatInputModule],
  template: `
    <main style="padding:16px">
      <h2>Create preset</h2>

      <mat-form-field appearance="outline" style="width: 100%">
        <mat-label>Preset name</mat-label>
        <input matInput [(ngModel)]="name" />
      </mat-form-field>

      <div style="display:flex; gap:8px; justify-content:flex-end">
        <button mat-button (click)="close()">Cancel</button>
        <button
          mat-raised-button
          color="primary"
          [disabled]="!name"
          (click)="confirm()"
        >
          Create
        </button>
      </div>
    </main>
  `,
})
export class PresetCreateDialogComponent {
  name = '';
  private dialogRef = inject(MatDialogRef<PresetCreateDialogComponent>);

  close() {
    this.dialogRef.close();
  }

  confirm() {
    this.dialogRef.close(this.name.trim());
  }
}
