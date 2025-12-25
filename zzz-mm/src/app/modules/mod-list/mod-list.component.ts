import {
  ChangeDetectorRef,
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { AgentMod, ZZZAgent } from '../../models/agent.model';
import { CommonModule } from '@angular/common';
import { MainService } from '../../services/main.service';
import { Subject, takeUntil } from 'rxjs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { ModDetailsComponent } from './mod-details/mod-details.component';
import { ConfigService } from '../../services/config.service';
import { ConfigDialogComponent } from '../config-dialog/config-dialog.component';
import { MatButtonModule } from '@angular/material/button';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ModManagerService } from '../../services/mod-manager.service';
import { AddModComponent } from '../add-mod/add-mod.component';
import { AgentNamePipe } from '../../shared/agent-name.pipe';

@Component({
  selector: 'app-mod-list',
  templateUrl: './mod-list.component.html',
  styleUrl: './mod-list.component.scss',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    AgentNamePipe,
    MatTooltipModule,
  ],
})
export class ModListComponent implements OnInit, OnDestroy {
  private _mainService = inject(MainService);
  private _onDestroy = new Subject<void>();
  private _dialog = inject(MatDialog);
  private _cdr = inject(ChangeDetectorRef);
  private _configService = inject(ConfigService);
  private _modManagerService = inject(ModManagerService);

  public selectedAgent = signal<ZZZAgent | null>(null);
  public enableShuffleMod = computed(() => {
    const selectedAgent = this.selectedAgent();
    if (!selectedAgent) return false;
    const mods = selectedAgent.mods;
    if (!mods?.length) return false;

    return mods.length > 1;
  });
  public blur = signal<boolean>(false);

  ngOnDestroy(): void {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

  ngOnInit(): void {
    this._mainService.agentSelected
      .pipe(takeUntil(this._onDestroy))
      .subscribe((agent) => {
        this.selectedAgent.set(agent);
        this._cdr.markForCheck();
      });

    this._configService.configReady.subscribe({
      next: (config) => {
        this.blur.set(config.blur);
      },
    });
  }

  public openDetailsDialog(mod: AgentMod): void {
    this._dialog.open(ModDetailsComponent, {
      width: '40vw',
      height: '100%',
      position: {
        right: '0',
        top: '0',
      },
      data: {
        mod: mod,
      },
    });
  }

  public toggleBlur(): void {
    this.blur.set(!this.blur());
    this._configService.updateConfig({ blur: this.blur() });
  }

  public openConfigDialog(): void {
    this._dialog.open(ConfigDialogComponent, {
      width: '40vw',
      height: '100%',
      hasBackdrop: true,
      disableClose: true,
      position: {
        right: '0',
        top: '0',
      },
    });
  }

  public async handleActivateMod(mod: AgentMod) {
    await this._modManagerService.handleActivateMod(mod);
    if (this._configService.config.disable_others) {
      const modIndex = this.selectedAgent()?.mods?.findIndex(
        (_mod) => _mod.folderName === mod.folderName
      );
      if (modIndex && modIndex < 0) return;

      const toDisable = this.selectedAgent()?.mods?.filter(
        (_, i) => i !== modIndex
      );
      if (!toDisable?.length) return;

      for (const disableMod of toDisable) {
        if (!disableMod) continue;
        await this.handleDisableMod(disableMod);
      }
    }
  }

  public async handleDisableMod(mod: AgentMod) {
    await this._modManagerService.handleRemoveMod(mod);
  }

  public handleAddNewMod() {
    this._dialog
      .open(AddModComponent, {
        width: '40vw',
        data: {
          selectedAgent: this.selectedAgent(),
          mode: 'install',
        },
      })
      .afterClosed()
      .subscribe({
        next: (value: boolean) => {
          if (value) this._configService.refreshMods();
        },
      });
  }

  public handleRefreshMods() {
    this._configService.refreshMods().subscribe();
  }

  toggleMod(mod: AgentMod) {
    if (mod.json?.active) {
      this.handleDisableMod(mod);
    } else {
      this.handleActivateMod(mod);
    }
  }

  public async pickRandomMod(): Promise<void> {
    const agentMods = this.selectedAgent()?.mods;
    if (!agentMods?.length) return;

    const randomIndex = Math.floor(Math.random() * agentMods.length);
    const randomMod = agentMods[randomIndex];

    if (randomMod.json?.active) return;
    //Enable random mod
    await this.handleActivateMod(randomMod);
    const toRemove = agentMods.filter((mod, i) => i !== randomIndex);
    //Disable all other mods
    for (const mod of toRemove) {
      if (!mod) continue;
      await this.handleDisableMod(mod);
    }
  }
}
