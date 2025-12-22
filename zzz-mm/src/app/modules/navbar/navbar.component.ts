import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, effect, inject, OnInit, signal } from '@angular/core';
import { ZZZAgent } from '../../models/agent.model';
import { MainService } from '../../services/main.service';
import { NavbarType } from '../../models/enums';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  standalone: true,
  imports: [CommonModule, NgOptimizedImage],
})
export class NavbarComponent implements OnInit {
  public agents = signal<Array<ZZZAgent>>([]);
  public selectedAgent = signal<ZZZAgent | null>(null);
  public navbarStyle = signal('');
  public navbarTypeEnum = NavbarType;
  public noMods = effect(() => {
    return this.agents().some((a) => a.mods?.length);
  });

  private _mainService = inject(MainService);

  ngOnInit(): void {
    this.navbarStyle.set(NavbarType.LIST);
    // this.navbarStyle.set(NavbarType.GRID);

    this._mainService.agents$.subscribe((_agents) => {
      console.log('Agents');
      this.agents.set(_agents);
    });

    this._mainService.agentSelected.subscribe((agent) =>
      this.selectedAgent.set(agent)
    );
  }

  public handleSelectAgent(agent: ZZZAgent): void {
    if (this.selectedAgent()?.id === agent.id) return;

    this._mainService.selectAgent(agent);
  }
}
