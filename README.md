# Rede Studio

Aplicação web em React para documentação e modelagem visual de uma rede corporativa. O projeto reúne dois produtos no mesmo frontend:

- uma apresentação navegável em slides para contexto executivo e técnico;
- um Studio interativo para modelagem de sites, camadas, nós, links, VLANs, rotas, regras de firewall, protocolos de roteamento e geração de relatório em PDF.

## Visão geral

O objetivo do projeto é centralizar a proposta de topologia, o inventário técnico e a documentação operacional em uma interface única. A aplicação roda totalmente no cliente, persiste o estado localmente e permite exportar o desenho atual para um relatório PDF paginado.

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

- `/slides`: apresentação linear com as seções do projeto de rede.
- `/studio`: editor técnico com diagrama, tabelas operacionais e exportação PDF.

O roteamento é definido em [src/App.tsx](src/App.tsx) e inicializado em [src/main.tsx](src/main.tsx).

## Principais capacidades

- Navegação entre apresentação e Studio no mesmo shell de aplicação.
- Alternância de idioma no Studio.
- Edição visual da topologia com sites, camadas e dispositivos.
- Tooltip de informações técnicas em nós, links, sites e redes lógicas no diagrama GoJS.
- Associação de VLANs aos elementos da rede.
- Geração derivada de rotas (Static, OSPF, BGP, VPN, Default, Direta) a partir do modelo.
- Regras de firewall / ACL com QoS e expansão de alocações por VLAN.
- Tabela de protocolos de roteamento com configuração inline de OSPF e BGP por roteador.
- Tech Profile dinâmico por tipo de equipamento — campos condicionais com lógica de normalização automática.
- Persistência local automática do estado do projeto.
- Geração de PDF técnico em nova aba com diagrama, tabelas e anexos.

## Arquitetura técnica

### Frontend

O frontend é uma SPA React inicializada com Vite. A navegação principal separa claramente o modo de apresentação do modo de edição. O shell global mantém o seletor de idioma do Studio e expõe as rotas de alto nível.

### Estado global

O estado do domínio fica centralizado no slice `network` do Redux Toolkit.

Arquivos-chave:

- [src/app/store.ts](src/app/store.ts): configuração da store, hidratação inicial e persistência com debounce.
- [src/features/network/networkSlice.ts](src/features/network/networkSlice.ts): reducers, estado inicial e normalização do domínio.
- [src/features/network/selectors.ts](src/features/network/selectors.ts): projeções derivadas para rotas, firewall, tabela de protocolos e árvore da legenda.
- [src/services/routes/distributor.ts](src/services/routes/distributor.ts): distribuidor central das rotas de serviço (state, topology, addressing, security, qos, catalog, vpn, sessions).
- [src/services/routes/persistenceRoutes.ts](src/services/routes/persistenceRoutes.ts): contrato de compatibilidade para persistência (`loadNetworkState`, `saveNetworkState`, `clearNetworkState`).
- [src/features/network/persistence.ts](src/features/network/persistence.ts): fachada legada apontando para `servicesRoutes.persistence`.

### Persistência

O estado é carregado na inicialização da aplicação e salvo automaticamente após alterações, com debounce de 350 ms. O acesso ao localStorage acontece via camada de serviços, usando o distribuidor de rotas em `src/services/routes`.

Fluxo oficial:

`store/components -> servicesRoutes.persistence -> stateRoutes -> services/_core/statePersistence -> localStorage`

Em caso de falha de persistência, o slice registra um aviso em `meta.persistWarning` para feedback na interface.

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

- A aplicação é client-side only; não há backend no repositório atual.
- A exportação PDF depende do estado já carregado no navegador.
- Como a persistência é local, o projeto salvo é específico do navegador/dispositivo em uso.
- O diretório `slides/` representa a narrativa da apresentação e pode evoluir independentemente do Studio.
- Inputs do tipo `number` têm spinners de browser e incremento por teclado desativados globalmente via CSS e `keydown` handler em `App.tsx`.

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
