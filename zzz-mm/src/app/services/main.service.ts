import { computed, inject, Injectable, signal } from '@angular/core';
import { AgentMod, AgentWithMods, ZZZAgent } from '../models/agent.model';
import { BehaviorSubject } from 'rxjs';
import rawAgents from '../../assets/character-data.json';
import { ModIndexService } from './mod-index.service';
import { ElectronBridgeService } from './electron-bridge.service';

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
  private _electronBridge = inject(ElectronBridgeService);

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
    this.refreshAgents();
  }

  private _agentDisplayNameForSort(agentName: string): string {
    switch (agentName) {
      case 'soldier-11':
        return 'Soldier 11';
      case 'npcs':
        return 'NPCs';
      case 'unknown':
        return 'Unknown';
      case 'ye-shunguang':
        return 'Xiaoguang';
      case 'zhu-yuan':
        return 'Zhu-Yuan';
      case 'pan-yinhu':
        return 'Pan-Yinhu';
      default:
        return agentName
          .replaceAll('-', ' ')
          .split(' ')
          .map((p) => (p ? p.charAt(0).toUpperCase() + p.slice(1) : p))
          .join(' ');
    }
  }

  private _agentSortComparator(a: ZZZAgent, b: ZZZAgent): number {
    const aIsSpecial = a.name === 'unknown' || a.name === 'npcs';
    const bIsSpecial = b.name === 'unknown' || b.name === 'npcs';

    if (aIsSpecial !== bIsSpecial) return aIsSpecial ? 1 : -1;

    if (aIsSpecial && bIsSpecial) {
      if (a.name === b.name) return 0;
      return a.name === 'unknown' ? -1 : 1;
    }

    const aKey = this._agentDisplayNameForSort(a.name);
    const bKey = this._agentDisplayNameForSort(b.name);

    return aKey.localeCompare(bKey, undefined, { numeric: true, sensitivity: 'base' });
  }

  async refreshAgents() {
    const agents = (rawAgents as CharacterDataFile).agents;

    const builtIn: ZZZAgent[] = agents.map((a) => ({
      name: a.name,
      id: a.id,
    }));

    const api = this._electronBridge.api;
    if (!api) {
      this._agents.set(builtIn);
      this.agents$.next(this._agents());
      return;
    }

    try {
      const res = await api.listCharacters();
      const customs = res.success && res.characters ? res.characters : [];

      const customAgents: ZZZAgent[] = [];

      for (const c of customs) {
        let portraitUrl: string | undefined = undefined;
        try {
          portraitUrl = await api.loadImage(c.portraitPath);
        } catch {
          portraitUrl = undefined;
        }

        customAgents.push({
          id: c.id,
          name: c.name,
          portraitUrl,
        });
      }

      const merged = [...builtIn, ...customAgents].sort((a, b) =>
        this._agentSortComparator(a, b),
      );
      this._agents.set(merged);
      this.agents$.next(this._agents());
    } catch (err) {
      console.error('CUSTOM_CHARACTER_LOAD_ERROR', err);
      this._agents.set(builtIn);
      this.agents$.next(this._agents());
    }
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
