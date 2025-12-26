import { computed, inject, Injectable, signal } from '@angular/core';
import { AgentMod, AgentWithMods, ZZZAgent } from '../models/agent.model';
import { BehaviorSubject } from 'rxjs';
import rawAgents from '../../assets/character-data.json';
import { ModIndexService } from './mod-index.service';

interface CharacterDataFile {
  agents: {
    name: string;
    id: number;
  }[];
}

@Injectable({
  providedIn: 'root',
})
export class MainService {
  private _selectedAgent = signal<ZZZAgent | null>(null);
  private _agents = signal<ZZZAgent[]>([]);
  private _modIndex = inject(ModIndexService);

  public agentSelected = new BehaviorSubject<ZZZAgent | null>(null);
  public agents$ = new BehaviorSubject<Array<ZZZAgent>>([]);

  agentsWithMods = computed<AgentWithMods[]>(() => {
    const agents = this._agents();
    const modsByAgent = this._modIndex.modsByAgent();

    return agents.map((agent) => {
      const key = agent.name.toLowerCase().replaceAll(' ', '-');
      return {
        agent,
        mods: modsByAgent.get(key) ?? [],
      };
    });
  });

  constructor() {
    this.agentsInit();
  }

  agentsInit() {
    const agents = (rawAgents as CharacterDataFile).agents;

    this._agents.set(
      agents.map((a) => ({
        name: a.name,
        id: a.id,
        mods: [],
      })),
    );

    this.agents$.next(this._agents());
  }

  selectAgent(agent: ZZZAgent | null): void {
    this._selectedAgent.set(agent);
    this.agentSelected.next(this._selectedAgent());
  }

  updateAgentMod(mod: AgentMod): void {
    const agentId = this._selectedAgent()?.id;
    if (!agentId) return;

    const agent = this._agents().find((a) => a.id === agentId);
    if (!agent) return;

    const agentWithMods = this._modIndex.modsByAgent().get(agent.name);

    const targetMod = agentWithMods?.find((m) => m.id === mod.id);
    if (!targetMod) return;

    targetMod.json = mod.json;

    this.selectAgent(agent);
  }
}
