# Rede Studio

Aplicação web em React para documentação e modelagem visual de uma rede corporativa. O uso do Studio é restrito a usuários com conta: cada usuário mantém múltiplos projetos salvos, escolhe um pelo dashboard e edita sites, camadas, nós, links, VLANs, rotas, regras de firewall e protocolos de roteamento, com geração de relatório em PDF.

A apresentação em slides que existia como segundo produto está atualmente desativada (rota comentada) — o código permanece no repositório, mas não é acessível pela aplicação.

## Visão geral

O objetivo do projeto é centralizar a proposta de topologia, o inventário técnico e a documentação operacional em uma interface única, por projeto e por conta. A aplicação roda totalmente no cliente — ainda sem backend real: contas e projetos são simulados em `localStorage`, numa estrutura já pensada para trocar por chamadas ao `rede-studio-api` sem alterar componentes. Cada projeto persiste automaticamente e pode ser exportado para um relatório PDF paginado.

## Stack principal

- React 19
- TypeScript
- Vite 8
- Redux Toolkit
- React Router DOM
- Tailwind CSS
- GoJS
- jsPDF
- jspdf-autotable
- html2canvas

## Rotas da aplicação

Toda rota vive sob um prefixo de idioma (`:lang` = `pt`, `en` ou `es`), resolvido por `/` na primeira visita e lembrado depois:

- `/:lang` (deslogado): landing page de apresentação do produto, com Entrar/Criar conta — os dois abrem como modal por cima da própria landing, sem trocar de página.
- `/:lang/projects` (logado): dashboard com os projetos salvos do usuário e criação de projeto novo.
- `/:lang/studio/:projectId` (logado): editor técnico do projeto aberto — diagrama, tabelas operacionais e exportação PDF.
- `/:lang/slides`: desativada (rota comentada); o código de apresentação continua no repositório.

O roteamento é definido em [src/App.tsx](src/App.tsx) e inicializado em [src/main.tsx](src/main.tsx). As guardas de acesso (`RequireAuth`/`RequireGuest`/`LanguageLayout`) ficam em `src/app/routing/`.

## Principais capacidades

- Contas de usuário (mock, sem backend ainda) com múltiplos projetos por conta — um projeto pertence a um único dono.
- Dashboard de projetos: criar, renomear a qualquer momento e continuar de onde parou.
- Indicador de status de salvamento no Studio (salvando/salvo/aviso), com opção de forçar salvar na hora.
- Idioma selecionável pela URL, com seletor no cabeçalho e nas telas públicas.
- Menu do usuário (badge circular) com atalhos pra projetos, novo projeto, configurações de perfil e sair.
- Edição visual da topologia com sites, camadas e dispositivos.
- Tooltip de informações técnicas em nós, links, sites e redes lógicas no diagrama GoJS.
- Associação de VLANs aos elementos da rede.
- Geração derivada de rotas (Static, OSPF, BGP, VPN, Default, Direta) a partir do modelo.
- Regras de firewall / ACL com QoS e expansão de alocações por VLAN.
- Tabela de protocolos de roteamento com configuração inline de OSPF e BGP por roteador.
- Tech Profile dinâmico por tipo de equipamento — campos condicionais com lógica de normalização automática.
- Persistência local automática do estado de cada projeto.
- Geração de PDF técnico em nova aba com diagrama, tabelas e anexos.

## Arquitetura técnica

### Frontend

O frontend é uma SPA React inicializada com Vite. Toda rota vive sob um prefixo de idioma e é protegida por conta: deslogado só acessa a landing/login/registro, logado acessa dashboard e Studio (ver "Rotas da aplicação"). O shell autenticado (`AppShellLayout`) mantém o seletor de idioma e o menu do usuário.

### Estado global

Três slices do Redux Toolkit:

- `network`: domínio do projeto **atualmente aberto** no Studio (sites, nós, links, ACLs, VLANs, Tech Profile).
- `auth`: sessão mock do usuário logado.
- `projects`: lista de projetos do usuário logado e qual está ativo no Studio agora.

Arquivos-chave:

- [src/app/store.ts](src/app/store.ts): configuração da store e middleware de autosave por projeto (debounce 350 ms, grava no slot do projeto ativo).
- [src/features/network/networkSlice.ts](src/features/network/networkSlice.ts): reducers, estado inicial e normalização do domínio.
- [src/features/network/selectors.ts](src/features/network/selectors.ts): projeções derivadas para rotas, firewall, tabela de protocolos e árvore da legenda.
- [src/features/auth/authSlice.ts](src/features/auth/authSlice.ts) e [src/features/projects/projectsSlice.ts](src/features/projects/projectsSlice.ts): sessão mock e projetos do usuário.
- [src/services/routes/distributor.ts](src/services/routes/distributor.ts): distribuidor central das rotas de serviço, incluindo as novas `authRoutes`, `projectsRoutes` e `languageRoutes`.

### Persistência

Cada projeto persiste no seu próprio slot (não existe mais um documento único global). O estado é carregado ao abrir um projeto (`StudioProjectLoader`) e salvo automaticamente após alterações, com debounce de 350 ms, através de um middleware de autosave (não `store.subscribe`) — necessário pra não reagir às próprias actions de "salvo" em loop, e pra flushar o save pendente no projeto certo quando o usuário troca de projeto rapidamente.

Fluxo atual:

`store (middleware de autosave) -> servicesRoutes.projects.saveProjectSnapshot -> _core/projectsPersistence -> localStorage`

Em caso de falha de persistência (limite de tamanho por projeto), o slice registra um aviso em `meta.persistWarning`, visível no indicador de status de salvamento do Studio. `servicesRoutes.persistence`/`stateRoutes` (fluxo antigo de projeto único) e `src/features/network/persistence.ts` (fachada legada sobre eles) não são mais usados pela aplicação — sobrevivem só como código morto/histórico.

### Tech Profile

Cada tipo de equipamento possui um esquema de campos declarado em `src/features/network/constants/techProfiles.constants.ts`. Os campos suportam os tipos `text`, `number`, `boolean` e `select`. Campos condicionais usam `visibleWhen` (exibição por valor de outro campo) e `optionsWhen` (filtragem dinâmica de opções de select).

A normalização automática dos campos é executada em `normalizeTechProfile` (`src/features/network/utils/tech-profiles.ts`) a cada `updateNodeTechField`, garantindo consistência entre campos interdependentes — por exemplo:

- VPN IKEv1 + cifra AEAD → força troca para AES-CBC;
- Cifra AEAD → força `integrity = n-a`;
- Roteador com modo `static` → limpa campos OSPF e BGP;
- OSPF → garante `dead ≥ 4 × hello`.

Warnings de configuração inconsistente são gerados por `getTechProfileWarnings`.

### Sistema de roteamento

O tipo `RouteType` define as categorias de rota geradas automaticamente a partir da topologia:

| Tipo       | Condição                                                       |
| ---------- | -------------------------------------------------------------- |
| `Direta`   | Conexão dentro do mesmo site                                   |
| `Estática` | Conexão inter-site sem protocolo dinâmico                      |
| `Default`  | Link WAN sem BGP                                               |
| `VPN`      | Link kind `vpn` ou `ipsec`                                     |
| `BGP`      | Roteador com `routingMode = bgp` ou `mixed` em link inter-site |

A função `resolveRouteType` em `src/features/network/utils/route.ts` resolve o tipo considerando `linkKind`, `category` dos nós e o `routingMode` do Tech Profile do nó de origem.

### Tabela de protocolos de roteamento

O componente `RoutingProtocolTable` (`src/components/studio/RoutingProtocolTable.tsx`) exibe um painel abaixo do firewall com configuração inline de OSPF e BGP por roteador. Cada modo tem campos específicos:

- **Static** — sem campos extras; apenas indicação visual.
- **OSPF** — Área, intervalo Hello (s) e Dead (s); Dead é normalizado automaticamente para `≥ 4 × Hello`.
- **BGP** — ASN local, lista de neighbors (`ip/ASN-remoto` separados por vírgula com expansão em tabela), prefix-lists de entrada e saída (expansíveis), autenticação MD5.
- **Mixed** — todos os campos OSPF e BGP juntos (redistribuição entre protocolos).

Todos os campos são editáveis inline e despacham `updateNodeTechField` para o Redux, acionando a normalização automática. Warnings são exibidos diretamente na linha quando há configuração incompleta (ex.: BGP sem ASN ou sem neighbors).

O seletor `selectRoutingProtocolRows` (`src/features/network/selectors.ts`) projeta apenas os nós `router` da topologia, parseando os neighbors e montando o objeto `RoutingProtocolRow`.

### Studio

O Studio é composto por painéis especializados e um diagrama central:

- [src/pages/StudioPage.tsx](src/pages/StudioPage.tsx): composição da página, modais de reset/impressão e orquestração da exportação PDF.
- [src/components/studio/NetworkDiagram.tsx](src/components/studio/NetworkDiagram.tsx): renderização e exportação da topologia com GoJS; tooltips de site, link e rede lógica; substituição completa de modelo com preservação de viewport.
- [src/components/studio/StudioToolbar.tsx](src/components/studio/StudioToolbar.tsx): ações de criação e manipulação do modelo.
- [src/components/studio/RouteFirewallPanel.tsx](src/components/studio/RouteFirewallPanel.tsx): tabelas de rotas, firewall/ACL e protocolos de roteamento.
- [src/components/studio/RoutingProtocolTable.tsx](src/components/studio/RoutingProtocolTable.tsx): tabela de configuração inline de OSPF/BGP por roteador.
- [src/components/studio/LinkInspectorTooltip.tsx](src/components/studio/LinkInspectorTooltip.tsx): tooltip portal para inspeção de links — fundo 100% opaco.
- [src/components/studio/SiteVlanPanel.tsx](src/components/studio/SiteVlanPanel.tsx): cadastro e visualização de VLANs por site.
- [src/components/studio/LegendPanel.tsx](src/components/studio/LegendPanel.tsx): árvore de navegação e leitura do modelo.

### Diagrama GoJS

O diagrama usa substituição completa de modelo (`diagram.model = model`) para garantir consistência entre o estado Redux e a representação visual. A viewport (escala e posição) é preservada entre atualizações de dados e restaurada após a substituição do modelo. O `fitAndCenter` só é acionado na primeira renderização ou em resposta a um incremento explícito de `fitCenterRequest`.

Templates de grupo suportam três tipos: `site`, `layer` e `network`. O grupo `network` inclui um botão de informação (ⓘ) que abre um tooltip com detalhes do bloco de endereços, família, contagem de hosts, VLANs e camadas associadas.

### Exportação PDF

O relatório técnico é gerado no cliente a partir do estado atual da store. O pipeline combina:

- GoJS para exportar a imagem do diagrama;
- jsPDF para montagem do documento;
- jspdf-autotable para tabelas técnicas paginadas;
- html2canvas como fallback para captura visual quando necessário.

O gerador está em [src/components/studio/utils/pdfReport.ts](src/components/studio/utils/pdfReport.ts).

## Fluxo de dados

1. O usuário altera o modelo de rede no Studio.
2. O slice `network` atualiza sites, layers, nodes, links, ACLs e VLANs.
3. `normalizeTechProfile` é executado automaticamente a cada `updateNodeTechField`.
4. Os selectors derivam tabelas de rotas, firewall e protocolos de roteamento a partir das conexões e atributos dos nós.
5. A store salva o estado localmente com debounce.
6. Na exportação, a página do Studio coleta o snapshot atual e aciona o gerador do PDF.

## Estrutura resumida

```text
src/
  app/
    store.ts
  services/
    _core/
    routes/
    topology/
    addressing/
    security/
    qos/
    catalog/
    vpn/
    sessions/
  components/
    studio/
      constants/
      types/
      utils/
      LinkInspectorTooltip.tsx
      NetworkDiagram.tsx
      RouteFirewallPanel.tsx
      RoutingProtocolTable.tsx
      SiteVlanPanel.tsx
      StudioToolbar.tsx
  features/
    network/
      constants/
        techProfiles.constants.ts
      types/
        selectors.ts        (RouteType, RoutingProtocolRow, ...)
      utils/
        route.ts            (resolveRouteType)
        tech-profiles.ts    (normalizeTechProfile, getTechProfileWarnings)
      networkSlice.ts
      selectors.ts
      persistence.ts
  pages/
    SlidesPage.tsx
    StudioPage.tsx
  slides/
    S01Capa/
    ...
    S16EquipamentosRecomendados/
```

## Como executar localmente

### Pré-requisitos

- Node.js 20 ou superior
- npm 10 ou superior

### Instalação

```bash
npm install
```

### Ambiente de desenvolvimento

```bash
npm run dev
```

### Build de produção

```bash
npm run build
```

### Preview local do build

```bash
npm run preview
```

## Saída de build

O artefato gerado pelo Vite é publicado na pasta `dist/`.

## Observações técnicas

- A aplicação é client-side only; não há backend no repositório atual — contas e projetos são simulados em `localStorage`, prontos pra trocar por chamadas reais ao `rede-studio-api`.
- A exportação PDF depende do estado já carregado no navegador.
- Como a persistência é local, os projetos salvos são específicos do navegador/dispositivo em uso — não há sincronização entre dispositivos nem entre abas.
- O diretório `slides/` representa a narrativa da apresentação; a rota está desativada no momento (ver "Rotas da aplicação"), mas o código continua no repositório e pode evoluir independentemente do Studio se for reativado.
- Inputs do tipo `number` têm spinners de browser e incremento por teclado desativados globalmente via CSS e `keydown` handler em `App.tsx`.
- Senhas de usuário ficam em texto puro no mock local (sem hashing) — decisão deliberada, já que sem servidor um hash client-side não protegeria nada de verdade; será substituído quando o backend real entrar.

## Histórico de incrementos recentes (setembro de 2026)

| Incremento | Descrição |
| --- | --- |
| Contas de usuário (mock) | Registro/login/logout simulados em `localStorage` (`authSlice`, `authRoutes`); Studio e dashboard exigem sessão |
| Múltiplos projetos por usuário | `projectsSlice`/`projectsRoutes`: um usuário tem N projetos, cada um com snapshot próprio; autosave por projeto ativo via middleware |
| Rotas por idioma | Toda rota vive sob `/:lang` (`pt`/`en`/`es`); `AppLanguage` centralizado em `src/types/i18n.ts` |
| Landing + Login/Registro em modal | Página inicial pra deslogados; login/registro abrem como modal sobre a landing, sem trocar de página |
| Dashboard de projetos | Lista de projetos, criação com nome padrão sugerido, renomear a qualquer momento pelo card |
| Indicador de save no Studio | Botão de status (salvando/salvo/aviso) no container "Proposta DEV - Studio", com save manual imediato |
| Menu do usuário | Badge circular no header: Meus projetos, Novo projeto, Configurações (nome + idioma), Sair |
| `/slides` desativado | Rota comentada — código de apresentação permanece no repositório sem acesso |
| Migração de projeto legado | Dado salvo antes de existir conta é migrado automaticamente pro primeiro usuário que logar/registrar no navegador |

## Histórico de incrementos recentes (abril de 2026)

| Incremento                         | Descrição                                                                                                                                                                    |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NETWORKINFOBTN                     | Botão ⓘ nas redes lógicas do diagrama GoJS abre tooltip com bloco de endereço, família, hosts, VLANs e camadas                                                               |
| LinkInspectorTooltip               | Fundo do tooltip de link ajustado para 100% opaco (`bg-[#060d19]`)                                                                                                           |
| GoJS viewport preserve             | Substituição completa de modelo preserva escala e posição; `fitAndCenter` apenas na primeira renderização ou por evento explícito                                            |
| Number inputs UX                   | Spinners removidos via CSS; incremento por `ArrowUp`/`ArrowDown` bloqueado globalmente                                                                                       |
| VPN encryptionSuite                | Campo alterado de `text` para `select` dinâmico com `optionsWhen`: IKEv1 restringe a cifras não-AEAD; cifra AEAD força `integrity = n-a`; WireGuard fixa `chacha20-poly1305` |
| Tabela de protocolos de roteamento | Nova seção abaixo do firewall — OSPF (área, hello, dead), BGP (ASN, neighbors, prefix-list in/out, MD5), Mixed; edição inline com dispatch Redux e normalização automática   |
| RouteType BGP                      | `resolveRouteType` detecta `routingMode bgp/mixed` em links inter-site e retorna `'BGP'`; tabela de rotas exibe o tipo com cor violeta                                       |

## Documentação complementar

- [GUIA_EQUIPAMENTOS_IMAGENS.md](GUIA_EQUIPAMENTOS_IMAGENS.md)
- [apresentacao-rede-corporativa-pptx.html](apresentacao-rede-corporativa-pptx.html)

## Próximos incrementos recomendados

- adicionar screenshots do Studio e da apresentação no README;
- documentar o formato persistido do estado da rede;
- publicar convenções de nomenclatura para sites, nós, VLANs e links;
- adicionar pipeline CI para validar build e lint antes de publicação.
