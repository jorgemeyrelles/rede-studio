# 🖼️ Guia: Baixando e Preparando Imagens dos Equipamentos - Slide 16

## Resumo

O slide 16 (Equipamentos Recomendados) está **100% pronto**, mas faltam as imagens PNG dos equipamentos. Este guia explica como obter e preparar as imagens.

## Especificação das Imagens

- **Tamanho**: 400 × 300 pixels (proporção 4:3)
- **Formato**: PNG com fundo transparente
- **Qualidade**: 72 DPI
- **Tamanho máximo**: 200 KB por arquivo

## Equipamentos e Links

### 🔵 CISCO

#### 1. Catalyst 8300-2N1S-4T2X (Roteador - Matriz)

- **Link direto**: https://www.cisco.com/c/dam/en/us/products/collateral/networking/sdwan-routers/8000-secure-routers/c8300-series-ds.pdf
- **Página do produto**: https://www.cisco.com/c/en/us/products/collateral/networking/sdwan-routers/8000-secure-routers/8300-series-secure-routers-ds.html
- **Arquivo**: `catalyst-8300.png`
- **Onde procurar**: Image Google → "Cisco Catalyst 8300" → Imagens oficiais

#### 2. Firepower 2100 Series (Firewall - Matriz)

- **Página**: https://www.cisco.com/c/en/us/products/security/firewalls/firepower-2100-series/index.html
- **Datasheet**: https://www.cisco.com/c/dam/en/us/products/collateral/security/firewalls/firepower-2100-series/datasheet-c78-740776.pdf
- **Arquivo**: `firepower-2100.png`
- **Onde procurar**: Image Google → "Cisco Firepower 2100" → Imagens técnicas

#### 3. Catalyst 3650-48TS-L (Switch - Matriz)

- **Página**: https://www.cisco.com/c/en/us/products/switches/catalyst-3650-series/index.html
- **Datasheet**: https://www.cisco.com/c/dam/en/us/products/collateral/switches/catalyst-3650-series/datasheet-c78-729483.pdf
- **Arquivo**: `catalyst-3650.png`
- **Onde procurar**: Image Google → "Cisco Catalyst 3650" → Imagens do aparelho

#### 4. Catalyst 9120AXE (Access Point - Matriz)

- **Página**: https://www.cisco.com/c/en/us/products/wireless/wireless-access-points/catalyst-9120-series/index.html
- **Datasheet**: https://www.cisco.com/c/dam/en/us/products/collateral/wireless/access-points/catalyst-9120-series/datasheet-c78-742541.pdf
- **Arquivo**: `catalyst-9120.png`
- **Onde procurar**: Image Google → "Cisco Catalyst 9120" → Imagens do equipamento

### 🔴 FORTINET

#### 1. FortiGate 100F (Roteador/Firewall - Matriz)

- **Página**: https://www.fortinet.com/products/firewalls/fortigate-100f
- **Datasheet**: https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/FortiGate_100F.pdf
- **Arquivo**: `fortigate-100f.png`
- **Onde procurar**: Image Google → "FortiGate 100F" → Imagens técnicas

#### 2. FortiGate 40F (Roteador/Firewall - Filial)

- **Página**: https://www.fortinet.com/products/firewalls/fortigate-40f
- **Datasheet**: https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/FortiGate_40F.pdf
- **Arquivo**: `fortigate-40f.png`
- **Onde procurar**: Image Google → "FortiGate 40F" → Imagens do aparelho

#### 3. FortiGate 200F (Firewall - Matriz alternativa)

- **Página**: https://www.fortinet.com/products/firewalls/fortigate-200f
- **Datasheet**: https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/FortiGate_200F.pdf
- **Arquivo**: `fortigate-200f.png`
- **Onde procurar**: Image Google → "FortiGate 200F" → Imagens técnicas

#### 4. FortiSwitch 248F (Switch - Matriz)

- **Página**: https://www.fortinet.com/products/switches/fortiswitch-248f
- **Datasheet**: https://www.fortinet.com/content/dam/fortinet/assets/data-sheets/FortiSwitch_248F.pdf
- **Arquivo**: `fortiswitch-248f.png`
- **Onde procurar**: Image Google → "FortiSwitch 248F" → Imagens do equipamento

## Passo a Passo: Baixar e Preparar

### Opção 1: Usando Pesquisa no Google (Recomendado)

1. Acesse: https://images.google.com
2. Busque por: `"Cisco Catalyst 8300"` (com aspas)
3. Procure por imagens:
   - ✅ Com fundo transparente (PNG)
   - ✅ Alta resolução (2000+ pixels)
   - ✅ Visão lateral ou frontal clara
4. Clique em "Imagem grande" para baixar

### Opção 2: Datasheets Oficiais

1. Abra o link do datasheet PDF
2. Use Print Screen ou screenshot da imagem do produto
3. Cole no Paint ou Photoshop
4. Recorte apenas o equipamento

### Opção 3: Usar Ferramentas Online

#### Remover Fundo

1. Acesse: https://remove.bg
2. Faça upload da imagem
3. Clique em "Remove Background"
4. Baixe em PNG

#### Redimensionar

1. Acesse: https://www.pixelied.com/resize-image
2. Faça upload
3. Configure: 400×300 pixels
4. Baixe em PNG

#### Tudo em Um

1. Acesse: https://ezgif.com/resize
2. Faça upload
3. Configure tamanho e formato
4. Redimensione e baixe

## Passo a Passo: Salvar nos Diretórios Corretos

### Para Imagens Cisco:

```
seu-projeto/public/images/equipamentos/cisco/
├── catalyst-8300.png
├── firepower-2100.png
├── catalyst-3650.png
└── catalyst-9120.png
```

### Para Imagens Fortinet:

```
seu-projeto/public/images/equipamentos/fortinet/
├── fortigate-100f.png
├── fortigate-40f.png
├── fortigate-200f.png
└── fortiswitch-248f.png
```

## Passo a Passo: Redimensionar com ImageMagick (CLI)

Se tiver ImageMagick instalado, use no terminal:

```bash
# Para Cisco
cd public/images/equipamentos/cisco
for img in *.png; do
  convert "$img" -resize 400x300 -background transparent -gravity center \
    -extent 400x300 "resized_$img"
done

# Para Fortinet
cd ../fortinet
for img in *.png; do
  convert "$img" -resize 400x300 -background transparent -gravity center \
    -extent 400x300 "resized_$img"
done
```

## Passo a Passo: Redimensionar com Photoshop

1. **Abra a imagem** em Photoshop
2. **Imagem → Tamanho da Imagem**:
   - Largura: 400 pixels
   - Altura: 300 pixels
   - Manter proporção: DESLIGADO
3. **Selecione → Tudo** (Ctrl+A)
4. **Editar → Copiar**
5. **Arquivo → Novo**:
   - Largura: 400 px
   - Altura: 300 px
   - Conteúdo: Transparente
6. **Editar → Colar** (Ctrl+V)
7. **Camada → Mesclado para Baixo**
8. **Arquivo → Exportar como → PNG**

## Passo a Passo: Redimensionar com GIMP (Gratuito)

1. **Abra a imagem** em GIMP
2. **Imagem → Escala de Imagem**:
   - Largura: 400 pixels
   - Altura: 300 pixels
   - Clique no ícone de corrente para desbloquear proporção
3. **Camada → Transparência → Adicionar Máscara Alfa**
4. **Arquivo → Exportar Como → PNG**

## Verificação Final

Após salvar as imagens, teste:

1. Abra o navegador
2. Vá para http://localhost:5173 (ou porta do seu projeto)
3. Navegue até o slide 16
4. Veja se as imagens aparecem nos cards

**Se não aparecer nada:**

- Verifique os nomes dos arquivos (devem ser exatos)
- Verifique os caminhos em `constants/equipments.constants.ts`
- Verifique se está na pasta correta (`public/images/equipamentos/`)
- Recarregue a página (Ctrl+R ou Cmd+R)

## Alternativa: Usar Imagens Placeholder

Se não conseguir encontrar as imagens oficiais, pode usar:

1. **Ícones simples** (DrawIO, Figma)
2. **Placeholders cinzas** (para manter layout)
3. **Descrição textual** (nome + modelo)

## Resumo do Slide 16

| Aspecto              | Status                       |
| -------------------- | ---------------------------- |
| Estrutura            | ✅ Completa                  |
| Componentes          | ✅ Implementados             |
| Dados                | ✅ Preenchidos               |
| Tipos TypeScript     | ✅ Definidos                 |
| Diretórios           | ✅ Criados                   |
| Imagens              | ⏳ **PENDENTE** (guia acima) |
| Integração (App.tsx) | ✅ Completa                  |
| Pagination           | ✅ Atualizada                |
| Navegação            | ✅ Funcional                 |

## Próximas Ações

1. ✅ Estrutura criada
2. ✅ Código implementado
3. ⏳ **Baixar e preparar imagens** (este guia)
4. ⏳ Salvar em `/public/images/equipamentos/`
5. ⏳ Testar no navegador
6. ⏳ Validar layout e responsividade
