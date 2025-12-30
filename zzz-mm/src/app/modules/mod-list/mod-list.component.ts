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
  private _presetService = inject(PresetService);

  public selectedAgent = signal<ZZZAgent | null>(null);
  public showAllActiveWhenEmpty = signal<boolean>(true);
  private _agentNameToId = signal<Map<string, number>>(new Map());
  public enableShuffleMod = computed(() => {
    const selectedAgent = this.selectedAgent();
    if (!selectedAgent) return false;
    const mods = this.selectedAgentMods();
    if (!mods?.length) return false;

    const eligible = mods.filter((m) => !m.json?.broken);
    return eligible.length > 1;
  });
  public blur = signal<boolean>(false);

  selectedAgentMods = computed(() => {
    const agent = this.selectedAgent();
    if (!agent) return;

    return this._modIndexService.modsByAgent().get(agent.name);
  });

  allActiveMods = computed<AgentMod[]>(() => {
    const map = this._modIndexService.modsByAgent();
    const list: AgentMod[] = [];
    for (const [, mods] of map.entries()) {
      for (const m of mods) {
        if (m.json?.active && !m.json?.broken) list.push(m);
      }
    }
    return list;
  });

  displayedMods = computed<AgentMod[] | undefined>(() => {
    const agent = this.selectedAgent();
    if (agent) return this.selectedAgentMods() ?? [];
    if (this.showAllActiveWhenEmpty()) return this.allActiveMods();
    return undefined;
  });

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

    this._mainService.agents$
      .pipe(takeUntil(this._onDestroy))
      .subscribe((agents) => {
        const map = new Map<string, number>();
        for (const a of agents) map.set(a.name, a.id);
        this._agentNameToId.set(map);
      });

    this._configService.configReady.subscribe({
      next: (config) => {
        this.blur.set(config.blur);
        this.showAllActiveWhenEmpty.set(config.show_all_active_when_empty);
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
    if (mod.json?.broken) return;
    const enabled = this._presetService.isModEnabled(mod.folderName);
    const willEnable = !enabled;

    // Determine mods for the same agent as 'mod'
    const agentKey = mod.json?.character?.toLowerCase().replaceAll(' ', '-');
    const sameAgentMods = agentKey
      ? (this._modIndexService.modsByAgent().get(agentKey) ?? [])
      : [];

    const allowedMultipleMods = [0, 1];
    const currentAgent = this.selectedAgent();
    const skip = currentAgent
      ? allowedMultipleMods.includes(currentAgent.id)
      : false;

    // If enabling and config says disable others, turn off others for this agent
    if (willEnable && this._configService.config.disable_others && !skip) {
      const mods = sameAgentMods ?? [];
      const changes = mods.map((m) => ({
        modId: m.folderName,
        enabled: m.folderName === mod.folderName,
      }));
      await this._presetService.updateModsBatch(changes);
    } else {
      await this._presetService.updateMod(mod.folderName, willEnable);
    }
  }

  public async pickRandomMod(): Promise<void> {
    const agentMods = this.selectedAgentMods();
    if (!agentMods?.length) return;

    const pool = agentMods.filter((m) => !m.json?.broken);
    if (!pool.length) return;

    const randomIndex = Math.floor(Math.random() * pool.length);
    const randomMod = pool[randomIndex];

    // Skip if already active
    if (this._presetService.isModEnabled(randomMod.folderName)) return;

    // Enable picked and disable others in the same agent in batch
    const changes = agentMods.map((m) => ({
      modId: m.folderName,
      enabled: m.folderName === randomMod.folderName,
    }));
    await this._presetService.updateModsBatch(changes);
  }

  public getPortraitForMod(mod: AgentMod): string | undefined {
    const character = mod.json?.character;
    if (!character) return undefined;
    const id = this._agentNameToId().get(character);
    if (typeof id === 'number') return `assets/char-portraits/${id}.png`;
    return undefined;
  }
}
