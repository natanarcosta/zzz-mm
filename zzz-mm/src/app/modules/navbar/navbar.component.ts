import { CommonModule, NgOptimizedImage } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ZZZAgent } from '../../models/agent.model';
import { MainService } from '../../services/main.service';

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
  private _mainService = inject(MainService);

  ngOnInit(): void {
    this._mainService.agents$.subscribe((_agents) => {
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
