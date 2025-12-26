import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { ZZZAgent } from '../../models/agent.model';
import { MainService } from '../../services/main.service';
import { NavbarTypeEnum } from '../../models/enums';
import { ConfigService } from '../../services/config.service';
import { AgentNamePipe } from '../../shared/agent-name.pipe';
import { ModIndexService } from '../../services/mod-index.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, AgentNamePipe],
})
export class NavbarComponent {
  private _mainService = inject(MainService);
  private _configService = inject(ConfigService);
  private _modIndex = inject(ModIndexService);

  agents = signal<ZZZAgent[]>([]);
  selectedAgent = signal<ZZZAgent | null>(null);
  navbarStyle = signal<NavbarTypeEnum>(NavbarTypeEnum.LIST);
  navbarTypeEnum = NavbarTypeEnum;

  agentsWithMods = computed(() => {
    const modsByAgent = this._modIndex.modsByAgent();
    return this.agents().map((agent) => ({
      agent,
      hasMods: (modsByAgent.get(agent.name) ?? []).length > 0,
    }));
  });

  hasAnyMods = computed(() => {
    for (const mods of this._modIndex.modsByAgent().values()) {
      if (mods.length > 0) return true;
    }
    return false;
  });

  constructor() {
    this._configService.configReady.subscribe((config) =>
      this.navbarStyle.set(config.navbar_type),
    );

    this._mainService.agents$.subscribe((agents) => this.agents.set(agents));

    this._mainService.agentSelected.subscribe((agent) =>
      this.selectedAgent.set(agent),
    );
  }

  handleSelectAgent(agent: ZZZAgent): void {
    if (this.selectedAgent()?.id === agent.id) {
      this._mainService.selectAgent(null);
      return;
    }
    this._mainService.selectAgent(agent);
  }
}
