# Rede SP-CWB

Aplicação web em React para documentação e modelagem visual de uma rede corporativa. O projeto reúne dois produtos no mesmo frontend:

- uma apresentação navegável em slides para contexto executivo e técnico;
- um Studio interativo para modelagem de sites, camadas, nós, links, VLANs, rotas, regras de firewall e geração de relatório em PDF.

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
- Associação de VLANs aos elementos da rede.
- Geração derivada de rotas e regras de firewall a partir do modelo.
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
- [src/features/network/selectors.ts](src/features/network/selectors.ts): projeções derivadas para rotas, firewall e árvore da legenda.
- [src/features/network/persistence.ts](src/features/network/persistence.ts): ponte para carregamento, salvamento e limpeza do estado persistido.

### Persistência

O estado é carregado na inicialização da aplicação e salvo automaticamente após alterações, com debounce de 350 ms. Em caso de falha de persistência, o slice registra um aviso em `meta.persistWarning` para feedback na interface.

### Studio

O Studio é composto por painéis especializados e um diagrama central:

- [src/pages/StudioPage.tsx](src/pages/StudioPage.tsx): composição da página, modais de reset/impressão e orquestração da exportação PDF.
- [src/components/studio/NetworkDiagram.tsx](src/components/studio/NetworkDiagram.tsx): renderização e exportação da topologia com GoJS.
- [src/components/studio/StudioToolbar.tsx](src/components/studio/StudioToolbar.tsx): ações de criação e manipulação do modelo.
- [src/components/studio/RouteFirewallPanel.tsx](src/components/studio/RouteFirewallPanel.tsx): tabelas de rotas e firewall.
- [src/components/studio/SiteVlanPanel.tsx](src/components/studio/SiteVlanPanel.tsx): cadastro e visualização de VLANs por site.
- [src/components/studio/LegendPanel.tsx](src/components/studio/LegendPanel.tsx): árvore de navegação e leitura do modelo.

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
3. Os selectors derivam tabelas de rotas e firewall a partir das conexões e atributos dos nós.
4. A store salva o estado localmente com debounce.
5. Na exportação, a página do Studio coleta o snapshot atual e aciona o gerador do PDF.

## Estrutura resumida

```text
src/
  app/
    store.ts
  components/
    studio/
      constants/
      types/
      utils/
      NetworkDiagram.tsx
      RouteFirewallPanel.tsx
      SiteVlanPanel.tsx
      StudioToolbar.tsx
  features/
    network/
      networkSlice.ts
      selectors.ts
      persistence.ts
      types.ts
      utils.ts
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

## Documentação complementar

- [GUIA_EQUIPAMENTOS_IMAGENS.md](GUIA_EQUIPAMENTOS_IMAGENS.md)
- [apresentacao-rede-corporativa-pptx.html](apresentacao-rede-corporativa-pptx.html)

## Próximos incrementos recomendados

- adicionar screenshots do Studio e da apresentação no README;
- documentar o formato persistido do estado da rede;
- publicar convenções de nomenclatura para sites, nós, VLANs e links;
- adicionar pipeline CI para validar build e lint antes de publicação.