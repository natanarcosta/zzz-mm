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
import { ModIndexService } from '../../services/mod-index.service';
import { PresetService } from '../../services/preset.service';
import { MatSelectModule } from '@angular/material/select';
import { PresetCreateDialogComponent } from './preset-create/preset-create-dialog.component';
import { ConfirmDialogComponent } from '../../shared/confirm-dialog/confirm-dialog.component';

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
    MatSelectModule,
  ],
})
export class ModListComponent implements OnInit, OnDestroy {
  private _mainService = inject(MainService);
  private _onDestroy = new Subject<void>();
  private _dialog = inject(MatDialog);
  private _cdr = inject(ChangeDetectorRef);
  private _configService = inject(ConfigService);
  private _modManagerService = inject(ModManagerService);
  private _modIndexService = inject(ModIndexService);
  public presetService = inject(PresetService);

  public selectedAgent = signal<ZZZAgent | null>(null);
  public enableShuffleMod = computed(() => {
    const selectedAgent = this.selectedAgent();
    if (!selectedAgent) return false;
    const mods = this.selectedAgentMods();
    if (!mods?.length) return false;

    return mods.length > 1;
  });
  public blur = signal<boolean>(false);

  selectedAgentMods = computed(() => {
    const agent = this.selectedAgent();
    if (!agent) return;

    return this._modIndexService.modsByAgent().get(agent.name);
  });

  ngOnDestroy(): void {
    this._onDestroy.next();
    this._onDestroy.complete();
  }

  ngOnInit(): void {
    this.presetService.load();
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

  onPresetChange(id: string) {
    this.presetService.setActivePreset(id);
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
      const modIndex = this.selectedAgentMods()?.findIndex(
        (_mod) => _mod.folderName === mod.folderName,
      );
      if (modIndex && modIndex < 0) return;

      const toDisable = this.selectedAgentMods()?.filter(
        (_, i) => i !== modIndex,
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
        hasBackdrop: true,
        disableClose: true,
        data: {
          selectedAgent: this.selectedAgent(),
          mode: 'install',
        },
      })
      .afterClosed()
      .subscribe({
        next: (value: boolean) => {
          if (value) this._modIndexService.refresh();
        },
      });
  }

  public handleRefreshMods() {
    this._modIndexService.refresh();
  }

  async toggleMod(mod: AgentMod) {
    const enabled = this.presetService.isModEnabled(mod.folderName);
    const willEnable = !enabled;

    const allowedMultipleMods = [0, 1];
    const skip = allowedMultipleMods.includes(this.selectedAgent()!.id);

    // If enabling and config says disable others, turn off others for this agent
    if (willEnable && this._configService.config.disable_others && !skip) {
      const mods = this.selectedAgentMods() ?? [];
      const changes = mods.map((m) => ({
        modId: m.folderName,
        enabled: m.folderName === mod.folderName,
      }));
      await this.presetService.updateModsBatch(changes);
    } else {
      await this.presetService.updateMod(mod.folderName, willEnable);
    }
  }

  public async pickRandomMod(): Promise<void> {
    const agentMods = this.selectedAgentMods();
    if (!agentMods?.length) return;

    const randomIndex = Math.floor(Math.random() * agentMods.length);
    const randomMod = agentMods[randomIndex];

    // Skip if already active
    if (this.presetService.isModEnabled(randomMod.folderName)) return;

    // Enable picked and disable others in the same agent in batch
    const changes = agentMods.map((m, i) => ({
      modId: m.folderName,
      enabled: i === randomIndex,
    }));
    await this.presetService.updateModsBatch(changes);
  }
}
