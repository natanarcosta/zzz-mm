import { Injectable } from '@angular/core';
import { AgentMod } from '../models/agent.model';

@Injectable({ providedIn: 'root' })
export class ModCacheService {
  private cache = new Map<string, AgentMod>();

  get(key: string): AgentMod | undefined {
    return this.cache.get(key);
  }

  set(key: string, mod: AgentMod): void {
    this.cache.set(key, mod);
  }

  clear(): void {
    this.cache.clear();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }
}
