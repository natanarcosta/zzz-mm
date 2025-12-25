import { Injectable } from '@angular/core';
import { AgentMod } from '../models/agent.model';

@Injectable({ providedIn: 'root' })
export class ModCacheService {
  private _cache = new Map<string, AgentMod>();

  get(key: string): AgentMod | undefined {
    return this._cache.get(key);
  }

  set(key: string, mod: AgentMod): void {
    this._cache.set(key, mod);
  }

  clear(): void {
    this._cache.clear();
  }

  delete(key: string): void {
    this._cache.delete(key);
  }

  get keys() {
    return this._cache.keys();
  }
}
