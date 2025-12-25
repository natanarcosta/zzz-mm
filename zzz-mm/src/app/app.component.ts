import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ModManagerWrapperComponent } from './modules/mod-manager-wrapper/mod-manager-wrapper.component';
import { ElectronBridgeService } from './services/electron-bridge.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ModManagerWrapperComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
})
export class AppComponent {
  title = 'zzz-mm';
  private _electronBridge = inject(ElectronBridgeService);

  handleCloseApp() {
    this._electronBridge.quitApp();
  }
}
