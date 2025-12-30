1. Aplicação é um mod manager para Zenless Zone Zero, feito em electron e angular.
2. Utiliza TypeScript, Angular para o frontend e Electron para o ambiente desktop.
3. Arquitetura baseada em ipc handlers e services do lado electron, fazendo injeção de dependências com main.js e preload.js. No angular, tudo é exposto pela electron-bridge.service que expõe os serviços do lado electron para os components.
4. Estrutura de pastas seguindo padrões do Angular e Electron com separação clara entre lógica de negócio e integração com o sistema operacional.
5. Utiliza padrões de desenvolvimento moderno com TypeScript, Angular Modules e Electron IPC para comunicação segura entre renderer e main processes, seguindo boas práticas de segurança e isolamento de processos.
6. Implementa validação e sanitização de dados para prevenir vulnerabilidades de injeção e manipulação de dados na comunicação entre processos.
7. No contexto dos mods, pastas e arquivos, podém existir caractéres especiais e caracteres de outros idiomas, como Chinês e Japonês, levar isso em consideração quando relevante.
8. Usar inglês para nomes de arquivos, pastas, variáveis, comentários e strings na UI.
