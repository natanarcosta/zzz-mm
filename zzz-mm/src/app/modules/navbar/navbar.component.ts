import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { ZZZAgent } from '../../models/agent.model';
import { MainService } from '../../services/main.service';
import { NavbarTypeEnum } from '../../models/enums';
import { ConfigService } from '../../services/config.service';
import { AgentNamePipe } from '../../shared/agent-name.pipe';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  standalone: true,
  imports: [CommonModule, NgOptimizedImage, AgentNamePipe],
})
export class NavbarComponent implements OnInit {
  public agents = signal<Array<ZZZAgent>>([]);
  public selectedAgent = signal<ZZZAgent | null>(null);
  public navbarStyle = signal('');
  public navbarTypeEnum = NavbarTypeEnum;
  public noMods = effect(() => {
    return this.agents().some((a) => a.mods?.length);
  });

  private _mainService = inject(MainService);
  private _configService = inject(ConfigService);

  ngOnInit(): void {
    this._configService.configReady.subscribe((config) =>
      this.navbarStyle.set(config.navbar_type),
    );

    this._mainService.agents$.subscribe((_agents) => {
      this.agents.set(_agents);
    });

    this._mainService.agentSelected.subscribe((agent) =>
      this.selectedAgent.set(agent),
    );
  }

  public handleSelectAgent(agent: ZZZAgent): void {
    if (this.selectedAgent()?.id === agent.id) {
      this._mainService.selectAgent(null);
      return;
    }

    this._mainService.selectAgent(agent);
  }
}
