---
name: Rede Studio
description: Prancheta escura para projetar redes corporativas — sistema visual "Planta".
colors:
  accent: "#e8a33d"
  accent-ink: "#231404"
  accent-2: "#ff6b4a"
  accent-print: "#b5651d"
  ink: "#0a1220"
  ink-raised: "#0f1b2e"
  ink-raised-2: "#13223a"
  line: "#24354f"
  line-strong: "#35507a"
  chalk: "#eaf1fb"
  chalk-dim: "#8fa3c4"
  chalk-faint: "#7a8fb3"
  signal-up: "#3ddc84"
  signal-down: "#ff5470"
  signal-warn: "#fbbf24"
  route-direct: "#3ddc84"
  route-static: "#fbbf24"
  route-default: "#fb923c"
  route-vpn: "#a78bfa"
  route-bgp: "#60a5fa"
  tier-edge: "#60a5fa"
  tier-distribution: "#fbbf24"
  tier-access: "#3ddc84"
  tier-server: "#e879f9"
  tier-endpoint: "#8fa3c4"
  tier-dmz: "#fb923c"
  tier-management: "#a78bfa"
  tier-custom: "#7a8fb3"
  paper: "#f4f6fb"
  paper-ink: "#111b2c"
  paper-line: "#c9d3e3"
  paper-dim: "#5b6b85"
typography:
  display:
    fontFamily: "Archivo, Arial Black, sans-serif"
    fontSize: "clamp(2rem, 1.2rem + 3.6vw, 3.25rem)"
    fontWeight: 800
    lineHeight: 1.05
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Archivo, Arial Black, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.3
  heading:
    fontFamily: "Archivo, Arial Black, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 600
    lineHeight: 1.4
  wordmark:
    fontFamily: "Archivo, Arial Black, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    letterSpacing: "0.16em"
  body:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: "1.25rem"
  body-small:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
  micro:
    fontFamily: "Public Sans, -apple-system, BlinkMacSystemFont, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: "1rem"
  label:
    fontFamily: "IBM Plex Mono, Courier New, monospace"
    fontSize: "0.6875rem"
    fontWeight: 500
    lineHeight: "1rem"
    letterSpacing: "0.08em"
  data:
    fontFamily: "IBM Plex Mono, Courier New, monospace"
    fontSize: "0.75rem"
    fontWeight: 400
    lineHeight: "1rem"
    fontFeature: "tnum"
rounded:
  hair: "1px"
  sm: "2px"
  md: "6px"
  full: "9999px"
spacing:
  hair: "2px"
  xs: "4px"
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  2xl: "20px"
  3xl: "24px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "36px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.chalk}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "36px"
  button-secondary-hover:
    backgroundColor: "{colors.ink-raised-2}"
    textColor: "{colors.chalk}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.chalk-dim}"
    rounded: "{rounded.sm}"
    padding: "0 10px"
    height: "28px"
  button-ghost-hover:
    backgroundColor: "{colors.ink-raised-2}"
    textColor: "{colors.chalk}"
  button-danger:
    backgroundColor: "{colors.signal-down}"
    textColor: "{colors.ink}"
    rounded: "{rounded.sm}"
    padding: "0 16px"
    height: "36px"
  button-icon:
    textColor: "{colors.chalk-dim}"
    rounded: "{rounded.sm}"
    size: "28px"
  remove-button:
    textColor: "{colors.chalk-faint}"
    rounded: "{rounded.sm}"
    size: "24px"
  remove-button-hover:
    textColor: "{colors.signal-down}"
  field:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.chalk}"
    typography: "{typography.body}"
    rounded: "{rounded.sm}"
    padding: "0 12px"
    height: "36px"
  field-sm:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.chalk}"
    typography: "{typography.body-small}"
    rounded: "{rounded.sm}"
    padding: "0 8px"
    height: "28px"
  panel:
    backgroundColor: "{colors.ink-raised}"
    textColor: "{colors.chalk}"
    rounded: "{rounded.md}"
  panel-header:
    padding: "8px 12px"
  chip:
    backgroundColor: "{colors.ink-raised-2}"
    textColor: "{colors.chalk-dim}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    padding: "2px 6px"
  modal:
    backgroundColor: "{colors.ink-raised}"
    rounded: "{rounded.md}"
    padding: "24px"
    width: "384px"
  modal-md:
    width: "448px"
  tab:
    textColor: "{colors.chalk-dim}"
    typography: "{typography.body}"
    padding: "8px 12px"
  tab-active:
    textColor: "{colors.chalk}"
  language-switch:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.chalk-dim}"
    typography: "{typography.label}"
    rounded: "{rounded.sm}"
    height: "32px"
  language-switch-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.hair}"
  user-badge:
    textColor: "{colors.accent}"
    rounded: "{rounded.full}"
    size: "32px"
---

# Design System: Rede Studio

## Overview

**Creative North Star: "A Prancheta do Engenheiro de Redes"**

Planta é a mesa de desenho de quem projeta infraestrutura: um fundo azul-tinta quase preto, riscado por uma grade técnica de 42px, sobre o qual tudo é traço fino, papel elevado e uma única cor de caneta, o âmbar. O sistema é escuro por natureza (não existe tema claro) e trata o usuário como engenheiro: densidade alta, números tabulares, rótulos em monoespaçada e cor reservada para o que carrega significado (estado, tipo de rota, camada).

A densidade muda por território. Landing, autenticação e dashboard respiram (padding de 20–24px, corpo 14px, títulos em Archivo); o Studio é instrumento, com corpo de 12px, meta de 11px, painéis com borda de 1px e tabelas técnicas que rolam dentro de si mesmas. A profundidade vem de camadas tonais de tinta, não de sombra; sombra existe só em duas intensidades, para o que flutua.

A identidade se ancora no logotipo "Nó & Malha" (um nó central âmbar ligado a dois nós com contorno cobre) e na grade de prancheta. Sem gradiente, sem brilho, sem desfoque decorativo.

**Key Characteristics:**
- Escuro sempre: superfícies em três degraus de tinta azulada.
- Um acento (âmbar), uma cor de marca secundária (cobre) só no logotipo.
- Cor semântica por papel: `signal-*` estado, `route-*` tipo de rota, `tier-*` identidade de camada.
- Tipografia em três vozes: Archivo (títulos), Public Sans (corpo), IBM Plex Mono (rótulos, dados).
- Cantos quase retos (2px) em controles, 6px em painéis e modais.
- Desktop-first no Studio; Landing e auth funcionam em 390px.

## Colors

Tinta azul-noite em camadas, giz azulado para texto e um âmbar de caneta técnica como única voz de ação.

### Primary
- **Âmbar de Prancheta** (accent): CTA primário, aba ativa, idioma ativo, foco visível (contorno de 2px), borda de campo em foco, cursor de texto, seleção de texto (a 32%), o wordmark e o destaque da frase do hero. É a cor que diz "aqui você age".
- **Tinta sob Âmbar** (accent-ink): texto e ícone sobre fundo âmbar. Nunca usar branco sobre âmbar.

### Secondary
- **Cobre do Logotipo** (accent-2): só os nós inferiores do BrandMark. Não é cor de interface.

### Tertiary
- **Cobre de Impressão** (accent-print): o acento do relatório PDF (cabeçalhos de tabela, faixas), escolhido para papel claro onde o âmbar perde contraste.

### Neutral
- **Tinta** (ink): fundo da página, fundo de campos de formulário, scrim do modal (a 80%), base da grade de prancheta.
- **Tinta Elevada** (ink-raised): painéis, cards de projeto, modais, menus, tooltips do diagrama.
- **Tinta Elevada 2** (ink-raised-2): aninhado dentro de painel, hover de botão e de linha de tabela, fundo de chip, esqueleto de carregamento.
- **Traço** (line): toda borda de 1px, divisores, grade da prancheta (a 40%), polegar de scrollbar.
- **Traço Forte** (line-strong): hover de borda em card, borda de aba em hover, contornos que precisam se separar de `line`.
- **Giz** (chalk): texto primário, títulos.
- **Giz Apagado** (chalk-dim): texto secundário, rótulos de campo, botões ghost em repouso.
- **Giz Discreto** (chalk-faint): meta, placeholders, cabeçalho de tabela, rodapé. É o piso de contraste para texto (≥4.5:1 sobre ink-raised-2).

### Semânticas
- **Sinal** (signal-up / signal-down / signal-warn): estado (ok, erro/destrutivo, atenção). Aplicados como texto puro, ou como fundo a 10–15% com borda a 40–60% para faixas e badges.
- **Rota** (route-direct / static / default / vpn / bgp): o tipo de rota derivado (Direta, Estática, Default, VPN, BGP), em tabelas, badges e seções do inspetor.
- **Camada** (tier-edge … tier-custom): cor de identidade, não de estado, para camadas e finalidades de rede (legenda, badges de tier, borda de rede a 50%). Reaproveitam matizes de rota onde o significado é próximo.

### Impressão
- **Papel** (paper / paper-ink / paper-line / paper-dim): paleta clara exclusiva do relatório PDF. Não aparece na interface.

### Named Rules
**The One Pen Rule.** O âmbar é a única cor de ação. Um `btn-primary` por contexto; seleção e foco também falam âmbar, e nada mais compete com ele.

**The Meaning-or-Neutral Rule.** Cor só entra quando carrega significado (estado, rota, camada). Dado neutro (protocolo, porta, tipo) vai em chip neutro: `ink-raised-2` com giz apagado.

**The Token-Only Rule.** Nenhuma paleta utilitária genérica (`slate-*`, `sky-*`...) e nenhum hex arbitrário em componente. Tudo resolve para as custom properties de `src/styles/global.css`. Isso vale também para o canvas do GoJS: ele lê os mesmos tokens via `src/components/studio/utils/diagramTheme.ts` (`getDiagramTheme()`).

**The Role-Color Rule (diagrama).** No diagrama, a borda do nó diz o PAPEL do equipamento, não o tipo (o ícone já diz o tipo). Cinco famílias: perímetro (router, firewall, modem, WAN, IDS/IPS, proxy) → `tier-edge`; comutação (switch, load balancer, AP) → `tier-distribution`; serviços (server, NAS, DNS, DHCP) → `tier-server`; túneis (VPN, IPsec, WireGuard, MPLS, GRE, SD-WAN) → `route-vpn`; endpoints → `tier-endpoint`. Vermelho nunca identifica equipamento — é erro/deny. Sites: o primeiro em âmbar, depois `tier-edge`, `tier-management`, `tier-access`. Links usam `route-*`/`signal-*` (LAN `route-bgp`, WAN `route-default`, VPN `route-vpn` tracejado, stateless `signal-warn`).

## Typography

**Display Font:** Archivo (com Arial Black)
**Body Font:** Public Sans (com -apple-system, BlinkMacSystemFont)
**Label/Mono Font:** IBM Plex Mono (com Courier New)

**Character:** Archivo dá aos títulos peso de placa técnica, largo e firme; Public Sans é corpo neutro e legível em densidade; IBM Plex Mono é a voz do instrumento, usada em rótulos, valores de endereço, portas e cabeçalhos de tabela.

### Hierarchy
- **Display** (800, clamp 2rem → 3.25rem, 1.05, -0.02em): só o hero da Landing.
- **Title** (700, 1.25rem, 1.3): h1 de página (dashboard), título de modal, título de seção da Landing.
- **Heading** (600, 0.9375rem, 1.4): título de painel, de card de projeto, de feature.
- **Body** (400, 0.875rem / 1.25rem): corpo de Landing, auth e dashboard; subtítulo do hero sobe para 1rem–1.125rem com `leading-relaxed`, máximo ~42rem de largura.
- **Body Small** (400, 0.75rem / 1rem): corpo do Studio, células de tabela, rótulos de campo (500), meta de card.
- **Micro** (0.6875rem / 1rem): o piso. Badges e anotações densas do Studio. Nada menor que 11px.
- **Label** (IBM Plex Mono 500, 0.6875rem, 0.08em, caixa-alta): rótulo de seção ou metadado que carrega dado (ex.: tipo de rede com ícone acima do nome do projeto, "Zoom 100%" no topo do diagrama). Cabeçalhos de tabela usam o mesmo papel com 0.06em.
- **Data** (IBM Plex Mono, 0.75rem, `tnum`): valores técnicos (portas, endereços, IDs). Toda tabela usa algarismos tabulares.
- **Wordmark** (Archivo 700, 0.75rem → 0.875rem, 0.16em, caixa-alta, âmbar): só o nome "Rede Studio" ao lado do BrandMark no header.

### Named Rules
**The Single Caps Rule.** Caixa-alta só no papel label (mono 11px), no cabeçalho de tabela e no wordmark. Nunca em botão, nunca em título.

**The 11px Floor Rule.** `text-2xs` (11px) é o menor tamanho do app. Precisa de menos? Reduza conteúdo, não fonte.

## Layout

Dois ritmos sobre a mesma grade de 4px.

- **Contêineres:** Landing e dashboard centralizam em 72rem (1152px) com padding lateral de 16px → 24px (`sm`). O shell logado e o Studio vão até 1600px com padding de 16px. O hero estreita para ~56rem.
- **Ritmo deslogado/dashboard:** seções com 64–96px verticais, cards com padding de 20px, grade de cards `auto-fill` com mínimo de 260px e gap de 16px, formulários com gap de 16–20px entre campos e 6px entre rótulo e campo.
- **Ritmo do Studio:** blocos empilhados com 12px entre si, painéis com cabeçalho de 8×12px, células de tabela com 6×8px, controles de 28px de altura.
- **Header:** 64px na Landing, 56px no app logado (fixo no topo, borda inferior de 1px).
- **Breakpoints:** só dois em uso. `sm` (640px) é o salto mobile → desktop fora do Studio; `lg` (1024px) abre o Studio de uma coluna para grade. Não introduzir `md`/`xl` sem necessidade.
- **Overflow:** tabelas largas rolam dentro de um wrapper com scrollbar temática, nunca a página.
- **Fundo prancheta:** a grade de 42px sobre tinta fica no wrapper de página (Landing e shell logado); faixas de conteúdo e header voltam a ink sólido por cima dela.

## Elevation & Depth

Profundidade é tonal: três degraus de tinta (ink → ink-raised → ink-raised-2) separados por traço de 1px. Painéis e cards em repouso são planos. Sombra aparece só no que flutua sobre outra coisa.

### Shadow Vocabulary
- **Painel flutuante** (`0 12px 28px rgba(0, 0, 0, 0.45)`): menu do usuário, tooltips/inspetores do diagrama, popovers.
- **Overlay** (`0 24px 48px rgba(0, 0, 0, 0.55)`): modais e a gaveta da legenda do Studio.

### Named Rules
**The Flat Desk Rule.** O que está pousado na prancheta não tem sombra. Card em hover ganha borda `line-strong`, não sombra.

**The One Blur Rule.** Desfoque existe só no scrim do Modal compartilhado (tinta a 80% + blur leve). Nenhum outro `backdrop-blur`, glow ou gradiente decorativo.

## Shapes

Geometria de desenho técnico: cantos quase retos e traço fino.

- **Controles** (botões, campos, chips, badges, abas de idioma, quadrados de ícone): 2px.
- **Contêineres** (painéis, cards, modais, menus, banners, estado vazio): 6px.
- **Círculo** só no avatar de iniciais do usuário.
- **Borda** sempre 1px em `line`; tracejada apenas no estado vazio do dashboard.
- **Ícones:** lucide-react, traço 1.75, 13–18px; decorativos levam `aria-hidden`, e o rótulo vem sempre em texto ao lado.

## Components

### Buttons
Uma família, quatro variantes, dois tamanhos, um raio. Firmes e quietos.
- **Shape:** cantos de 2px, ícone e texto com gap de 8px, peso 600, sem caixa-alta.
- **Primary:** âmbar com texto em tinta. Um por contexto (Criar conta, Entrar, Criar projeto, Gerar PDF). Hover a 90% de opacidade.
- **Secondary:** transparente, borda `line`, texto giz; hover com borda `chalk-faint` e fundo `ink-raised-2`. Apoio e Cancelar.
- **Ghost:** sem borda, giz apagado; hover clareia para giz sobre `ink-raised-2`. Ações de baixa ênfase em cards, listas e barras.
- **Danger:** fundo `signal-down`, texto em tinta. Só na confirmação final de uma ação destrutiva.
- **Tamanhos:** md 36px (formulários, modais, dashboard; CTAs do hero sobem para 44px) e sm 28px (Studio). Ícone-só é um quadrado de 28px, sempre com `aria-label` e `title`.
- **Hover / Focus:** transição de cor em 150ms; foco é contorno âmbar de 2px a 2px de distância. Desabilitado: 50% e cursor bloqueado.
- **Remover item:** botão de 24px com X de 13px em giz discreto, que fica vermelho com fundo `signal-down` a 15% no hover. Sempre o componente compartilhado.

### Chips
- **Style:** fundo `ink-raised-2`, mono 11px peso 500 em giz apagado, 2×6px, cantos de 2px.
- **State:** chip neutro é dado. Quando a etiqueta carrega estado ou rota, o mesmo formato troca para a cor semântica a 15% com texto na cor plena.

### Cards / Containers
- **Corner Style:** 6px.
- **Background:** `ink-raised`; aninhados em `ink-raised-2`.
- **Shadow Strategy:** nenhuma em repouso (ver Elevation & Depth).
- **Border:** 1px `line`; hover de card de projeto vai a `line-strong`.
- **Internal Padding:** 20px em card de projeto; 8×12px no cabeçalho de painel do Studio, com título em Heading e divisor inferior.

### Inputs / Fields
- **Style:** fundo `ink` (mais fundo que o painel, como um vão), borda 1px `line`, cantos 2px, 36px (12px de padding) ou 28px no compacto. Placeholder em giz discreto. Valores técnicos em mono.
- **Focus:** borda vira âmbar (o contorno global também aparece no foco por teclado).
- **Error / Disabled:** mensagem de erro em 12px `signal-down` com `role="alert"` abaixo do formulário.
- **Seleção segmentada:** grupos `radiogroup` de opções em mono 12px, 32px de altura, cantos 2px.

### Navigation
- **Header:** tinta sólida com borda inferior; BrandMark de 28px + wordmark âmbar à esquerda; seletor de idioma e ações à direita. Na Landing, Entrar/Criar conta somem abaixo de 640px (o hero tem os mesmos CTAs).
- **Seletor de idioma:** controle segmentado PT/EN/ES de 32px, fundo ink e borda `line`; opção ativa em âmbar com texto em tinta.
- **Menu do usuário:** avatar circular de 32px com iniciais âmbar sobre âmbar a 15%; abre um menu de 224px em `ink-raised` com sombra de painel, itens separados por traço; "Sair" fica vermelho no hover.
- **Abas:** sublinhado de 2px. Ativa: borda âmbar, texto giz. Inativa: giz apagado, hover com sublinhado `line-strong`. Padrão WAI-ARIA com setas, Home e End.
- **Abas em domínios (Studio):** dois níveis, nenhum com mais de 3 itens. 1º nível é um seletor segmentado (Roteamento · Segurança · Endereçamento e ativos; ativo em `ink-raised-2`, não em âmbar, pra não competir com a ação primária); 2º nível são as sub-abas com sublinhado. A aba ativa é lembrada por projeto em `sessionStorage`.
- **Ações do projeto (Studio):** no header do projeto — medidor de save, "Gerar relatório PDF" (`btn-secondary`) e um menu "⋯" com as ações destrutivas ("Apagar conteúdo do projeto…"). Destrutivo nunca fica ao lado da ação mais usada.
- **Desfazer/refazer:** botões só-ícone na toolbar do Studio + Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z/Ctrl+Y (fora de campos de texto).

### Modal
O diálogo compartilhado de todo o app. Painel `ink-raised` de 6px, padding de 24px, sombra overlay, largura 384px (ou 448px), altura máxima de 90vh com rolagem interna. Título em Title; fechar é um botão ghost só-ícone no canto. Nos modais de auth o cabeçalho centraliza com o BrandMark acima do título. Esc e clique fora fecham, salvo quando a operação não pode ser interrompida; o foco fica preso e volta ao gatilho.

### Painel Estrutura (assinatura)
Gaveta de 360px sobre o diagrama (fundo `ink` a 40%), cabeçalho fixo com título em Heading e dica em Small. Árvore Site → LAN → camada → componente com linhas de 32px e recuo de 16px por nível, guia vertical em `line`. Camada mostra o ponto `tier-*`; componente mostra o ícone com um ponto da família por papel. Ações aparecem no hover/foco: `+` (adicionar filho) e `⋯` (menu, com o destrutivo dentro). Dentro de cada LAN, o "esqueleto" de camadas na ordem do diagrama: as que faltam são linhas tracejadas que criam a camada com um clique. Clicar num componente o localiza no diagrama.

### Toast
Aviso efêmero, um por vez, centralizado embaixo: `ink-raised` com borda `line-strong` e sombra overlay, texto 14px, ação opcional em `btn-secondary btn-sm` e fechar só-ícone. `role="status"`, Esc dispensa, some sozinho em 10s. Usado para oferecer "Desfazer" depois de ação destrutiva reversível.

### Tabela técnica (assinatura)
O instrumento central do Studio. Corpo de 12px em giz apagado com algarismos tabulares; cabeçalho no papel label (mono 11px, caixa-alta, giz discreto); células de 6×8px com divisor em `line` a 55%; hover de linha em `ink-raised-2` a 60%; última linha sem divisor. Sempre dentro de um wrapper com rolagem horizontal própria.

### Inspetor do diagrama (assinatura)
Tooltip modal do GoJS em `ink-raised`, 6px, sombra de painel, 389–461px de largura, cabeçalho com ícone de 22px e título em 12px peso 800, linhas rótulo/valor em 11px e corpo com rolagem própria.

## Do's and Don'ts

### Do:
- **Do** combinar sempre botão + variante + tamanho; ícone-só com `aria-label` e `title`.
- **Do** usar o Modal compartilhado para todo diálogo e o botão compartilhado para remover itens.
- **Do** guardar cor para significado: `signal-*` estado, `route-*` rota, `tier-*` camada; chip neutro para o resto.
- **Do** envolver toda tabela técnica num contêiner com rolagem horizontal própria e scrollbar temática.
- **Do** manter texto em `chalk-faint` ou mais claro; é o piso de contraste.
- **Do** seguir "uma coluna → grade em `lg`" no Studio e `sm` fora dele.
- **Do** respeitar `prefers-reduced-motion` (já global) e o contorno de foco âmbar.

### Don't:
- **Don't** usar caixa-alta em botão ou título; caixa-alta é só do label mono, do `th` e do wordmark.
- **Don't** usar texto menor que 11px.
- **Don't** reintroduzir paletas utilitárias genéricas, hex arbitrário ou branco puro em componente.
- **Don't** pôr sombra em card ou painel em repouso, nem adicionar gradiente, glow ou blur fora do scrim do Modal.
- **Don't** usar emoji ou glifo Unicode como ícone; só lucide-react.
- **Don't** criar tema claro pontualmente; a paleta `paper-*` é só do PDF.
- **Don't** criar overlay de diálogo inline.
