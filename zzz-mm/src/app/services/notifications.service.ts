import { Injectable } from '@angular/core';
import { MatSnackBar, MatSnackBarConfig } from '@angular/material/snack-bar';

@Injectable({
  providedIn: 'root',
})
export class NotificationService {
  private readonly duration = 2000;

  constructor(private snackBar: MatSnackBar) {}

  success(message: string, action = 'OK') {
    this.open(message, action, 'snackbar-success');
  }

  error(message: string, action = 'Fechar') {
    this.open(message, action, 'snackbar-error', 5000);
  }

  info(message: string, action = 'OK') {
    this.open(message, action, 'snackbar-info');
  }

  private open(
    message: string,
    action: string,
    panelClass: string,
    duration = this.duration
  ) {
    const config: MatSnackBarConfig = {
      duration,
      panelClass: [panelClass],
      horizontalPosition: 'center',
      verticalPosition: 'top',
    };

    this.snackBar.open(message, action, config);
  }
}
