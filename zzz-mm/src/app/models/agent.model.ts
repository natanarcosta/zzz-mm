export interface ZZZAgent {
  name: string;
  id: number;
  mods?: Array<AgentMod>;
}

export interface AgentMod {
  folderName: string;
  previewPath?: string;
  json?: ModJson;
  id?: number;
  name?: string;
}

export interface ModJson {
  character: string;
  modName: string;
  description?: string;
  preview: string;
  url: string;
  hotkeys: Array<ModHotkey>;
  active: boolean;
  updatedAt?: string;

  localInstalledAt: string;
  localUpdatedAt: string;

  remoteUpdatedAt?: string;
}

export interface ModHotkey {
  description: string;
  key: string;
  source?: string;
}
