# agents.md — ZZZ Mod Manager (zzz-mm)

Este arquivo serve como **contexto operacional** para agentes (humanos/IA) trabalharem no projeto com segurança e rapidez.

## Visão geral do produto

- **Projeto**: ZZZ Mod Manager (Ava’s ZZZ Mod Manager)
- **Plataforma**: Desktop (Windows principalmente) via **Electron**
- **UI**: **Angular 17+** (standalone components + signals)
- **Objetivo**: Gerenciar mods locais de *Zenless Zone Zero* (scan, agrupamento por agente, preview, importação de `.zip`/`.rar`, presets via symlink, operações seguras de filesystem)

## Stack e runtime

- **Renderer (UI)**: Angular + Angular Material + RxJS
- **Main (Electron)**: Node.js APIs (`fs`, `path`, `os`, `https`)
- **Bridge seguro**: `preload.js` + `contextBridge` + `ipcRenderer.invoke`
- **IPC channels**: `zzz-mm/shared/ipc.channels.js`
- **Empacotamento**: `electron-builder` (`zzz-mm/electron-builder.json`)
- **Dev workflow**: `concurrently` + `ng serve` + `electron .` + `webpack --watch` para gerar o preload bundle

## Layout do repositório

Raiz do repo:

- `README.md`: descrição e comandos básicos
- `agents.md`: este documento
- `zzz-mm/`: aplicação (git root efetivo do app)

Dentro de `zzz-mm/` (alto nível):

- `src/`: Angular app (renderer)
- `electron/`: handlers IPC + serviços do processo main
- `shared/`: constantes/contratos compartilhados (ex.: canais IPC)
- `utils/`: utilitários Node (ex.: sanitização, extração de arquivos)
- `constants/`: mapas/constantes (ex.: keymaps)
- `main.js`: entrypoint Electron (cria `BrowserWindow` e registra IPC)
- `preload.js`: define `window.electronAPI` (bridge do renderer para o main)
- `webpack.config.js`: bundle do preload em `dist/preload.bundle.js`
- `angular.json`, `tsconfig*.json`, `eslint.config.mjs`, `.prettierrc`

## Comandos principais

Execute **na pasta `zzz-mm/`**.

- `npm install`
- `npm run electron:dev`
  - Roda:
    - `webpack --watch` (gera `dist/preload.bundle.js`)
    - `ng serve` (Angular em `http://localhost:4200`)
    - `electron .` (carrega o Angular)
- `npm run electron:dist`
  - Build produção (Angular) + bundle preload + `electron-builder`

## Fluxo de arquitetura (importantíssimo)

### 1) Electron main

Arquivo: `zzz-mm/main.js`

- Cria `BrowserWindow` com:
  - `contextIsolation: true`
  - `nodeIntegration: false`
  - `preload: dist/preload.bundle.js`
- Registra handlers IPC via `registerIpcHandlers(ipcMain, services, app)`

### 2) Preload (bridge seguro)

Arquivo: `zzz-mm/preload.js`

- Expõe `window.electronAPI` com métodos que chamam `ipcRenderer.invoke(channel, payload)`.
- Dispara evento `electron-ready` no `DOMContentLoaded`.

### 3) Contrato de canais IPC

Arquivo: `zzz-mm/shared/ipc.channels.js`

- Fonte de verdade dos nomes dos canais.
- **Regra**: ao criar um novo endpoint IPC:
  - adicionar o canal em `shared/ipc.channels.js`
  - expor no `preload.js`
  - implementar handler em `electron/ipc/*.handlers.js`
  - (opcional) adicionar tipagem no `ElectronAPI` em `src/app/services/electron-bridge.service.ts`

### 4) IPC handlers

Arquivo: `zzz-mm/electron/ipc/index.js`

- Registra módulos:
  - `mod.handlers.js` (scan keys, install, update, preview)
  - `fs.handlers.js` (read/write json, folder size, delete)
  - `config.handlers.js` (config em `app.getPath('userData')`)
  - `system.handlers.js` (dialog, abrir pasta, quit, versão)
  - `preset.handlers.js` (presets e aplicação via symlink)
  - `symlink.handlers.js`, `image.handlers.js`, `sync-ini.handlers.js` (existem, ver pasta)

### 5) Renderer (Angular)

Entry: `zzz-mm/src/main.ts` → `bootstrapApplication(AppComponent, appConfig)`

- `AppComponent` usa wrapper `ModManagerWrapperComponent`.
- `app.routes.ts` está vazio (UI parece ser composta mais por módulos/componentes do que por rotas).

## Domínios e dados

### Estrutura de mod

No disco (padrão, em `source_mods_folder`):

```
MyMod/
├── mod.json
├── preview.png|jpg (opcional)
└── mod files...
```

Modelo TS: `src/app/models/agent.model.ts`

- `ModJson` possui, entre outros:
  - `character` (string)
  - `modName`
  - `url`
  - `hotkeys: ModHotkey[]`
  - `active: boolean`
  - `localInstalledAt`, `localUpdatedAt`

### Indexação de mods

Arquivo: `src/app/services/mod-index.service.ts`

- Lê `config.source_mods_folder`.
- Para cada pasta:
  - tenta carregar `mod.json`
  - resolve preview (preferência por `preview.jpg`, senão imagem comum)
  - agrupa por agente: `character.toLowerCase().replaceAll(' ', '-')`
- Cache simples em memória (`ModCacheService`) usando chave `${folder}:${json.localUpdatedAt}`.

### Config

- Renderer: `src/app/services/config.service.ts`
- Main: `electron/ipc/config.handlers.js`

Config é persistida em:

- `app.getPath('userData')/config.json`

Campos relevantes (default):

- `source_mods_folder`
- `mod_links_folder`
- `user_ini_path`
- `disable_others`, `auto_fetch`, `blur`, etc.

### Presets

- IPC: `electron/ipc/preset.handlers.js`
- Service: `electron/services/preset.service.js`

Persistência:

- `userData/presets/*.json`
- `userData/presets/_active.json`

Aplicação do preset:

- Cria/remove symlinks (no Windows usa tipo `junction`) de `source_mods_folder/<mod>` para `mod_links_folder/<mod>`.
- Atualiza `mod.json.active` e `mod.json.localUpdatedAt` (para invalidar cache e refletir status).

## Como implementar features (receitas)

### A) Adicionar um novo método de filesystem no Electron

- **1. Defina o canal** em `shared/ipc.channels.js`.
- **2. Handler no main**: implemente em `electron/ipc/<algo>.handlers.js`.
  - Preferir `ipcMain.handle(...)` retornando objetos `{ success: boolean, ... }` para erros esperados.
  - Para falhas inesperadas, decida se quer `throw` (vai rejeitar no renderer) ou retornar `{ success:false }`.
- **3. Exponha no preload**: adicione função em `preload.js` chamando `ipcRenderer.invoke`.
- **4. Tipagem e wrapper**:
  - Atualize `ElectronAPI` em `src/app/services/electron-bridge.service.ts`.
  - Se for algo usado por vários lugares, crie método no `ElectronBridgeService` retornando `Observable` (padrão atual).
- **5. Consumo na UI**: use services (`ConfigService`, `ModIndexService`, etc.).

### B) Nova tela/componente na UI

- O app está em Angular standalone.
- Procure o “hub” UI em:
  - `src/app/modules/mod-manager-wrapper/` (wrapper principal)
  - componentes usados por ele
- Se decidir usar rotas:
  - atualizar `src/app/app.routes.ts`
  - garantir providers do router já estão em `app.config.ts`.

### C) Importação / instalação de mod (zip/rar)

- Lógica central: `electron/services/mod-install.service.js`
- Fluxo:
  - extrai archive para temp (`os.tmpdir()`)
  - normaliza pasta com `sanitizeFolderName`
  - copia recursivo
  - opcionalmente baixa preview via `https`
  - cria `mod.json` com hotkeys via `scanKeysForMod`
- Extração:
  - `utils/archive.js` (`adm-zip` + `unrar-promise`)

### D) Update de mod (merge de arquivos relevantes)

- `extractModUpdate` em `mod-install.service.js`:
  - detecta “best content dir” pelo número de arquivos relevantes
  - copia apenas extensões: `.ini`, `.dds`, `.ib`, `.buf`
  - faz backup em `.backup/<targetFolder>/<timestamp>`
  - tenta merge do bloco `[Constants]` em `.ini` quando o schema é compatível
  - atualiza `mod.json.localUpdatedAt`

### E) Hotkeys

- Service: `electron/services/key-scan.service.js`
- Busca `.ini` recursivamente (ignora `d3dx.ini` e `dxgi.ini`), identifica blocos com `key = ...` e variáveis `$...`.
- Normaliza teclas usando `constants/keymaps`.

## Convenções e invariantes

- **Segurança**: renderer não acessa `fs` direto; tudo via `window.electronAPI`.
- **Fonte de verdade de canais**: `shared/ipc.channels.js`.
- **Windows paths**: boa parte do código usa `\\` (string path). Preferir `path.join` no main quando possível.
- **Cache de indexação**: muda ao atualizar `mod.json.localUpdatedAt`.
- **Config como pré-requisito**: vários serviços só funcionam após `ConfigService.configReady`.

## Checklist rápido (antes de abrir PR)

- **Build dev**: `npm run electron:dev` abre sem erro.
- **IPC**: canais novos foram adicionados em todos os pontos (channels, preload, handler, tipagem).
- **Erros**: retornos `{ success:false, error }` em operações esperadas (I/O, parse, etc.).
- **Paths**: evitar concatenar manualmente no main; usar `path.join`.
- **Persistência**: confirmar `userData` (config/presets) continua compatível.

## Onde olhar primeiro quando algo quebrar

- **Electron não chama API**: `preload.js` / `dist/preload.bundle.js` / `webpack --watch`
- **IPC não responde**: `electron/ipc/*` e `shared/ipc.channels.js`
- **Mods não aparecem**: `ConfigService` (folders vazios) e `ModIndexService._indexMods()`
- **Presets não aplicam**: `electron/services/preset.service.js` (symlink / permissões)

