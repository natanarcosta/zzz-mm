export interface ZZZAgent {
  name: string;
  id: number;
  mods?: Array<AgentMode>;
}

export interface AgentMode {
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
  hotkeys: Array<{ description: string; key: string }>;
  active: boolean;
}
