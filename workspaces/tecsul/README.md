# Tecsul — Loja de Eletrodomésticos e Eletrônicos

Site moderno de e-commerce inspirado no layout do Carrefour, seguindo as diretrizes de design do **Emil Kowalski** (Design Engineering Skills) e **Taste Skill** (anti-slop).

## Princípios aplicados

- **Sem gradientes, sem glass, sem blobs, sem emojis**
- **Sombras apenas em interação** (hover/press) — nunca em repouso
- **Uma grid, margens apertadas** — espaçamento em múltiplos de 4px
- **Paleta restrita**: um ground (branco), um ink (azul-escuro), um accent (azul Tecsul #0057b8)
- **Tipografia**: 3 tamanhos hierárquicos, tracking negativo em títulos
- **Imagem dominante** no hero — uma grande vence várias pequenas
- **Animações com easing spring** (`cubic-bezier(0.22, 1, 0.36, 1)`)
- **Botões responsivos** com `scale(0.97)` no `:active`
- **Carrinho lateral** com animação e funcionalidade completa
- **Busca em tempo real** com renderização filtrada
- **Toast de feedback** para ações do usuário

## Melhorias nesta versão

### Hero
- **Imagem dominante** — geladeira Electrolux em destaque com tag de desconto
- **Tipografia forte** — heading de 4xl com tracking negativo
- **CTA duplo** — botão primário e secundário para conversão e exploração

### Cards de produtos
- **Badge de desconto** — vermelho no canto superior esquerdo
- **Preço antigo riscado** — para destacar a oferta
- **Preço atual em destaque** — fonte grande e preta
- **Parcelamento 12x** — visível logo abaixo do preço
- **Botão de ação** — preenchido, ocupando 100% da largura do card

### Categorias
- **Ícones SVG** — ilustrações personalizadas para cada categoria
- **Dots coloridos** — para visualização rápida
- **Hover effects** — borda azul ao passar o mouse

### Benefícios
- **4 benefícios destacados** — com ícones SVG
- **Fundo suave** — cor de ground-soft para separar da página

### Newsletter
- **Formulário integrado** — com ícone de e-mail SVG
- **Promoção clara** — "10% de desconto na primeira compra"

### Footer
- **4 colunas organizadas** — Institucional, Atendimento, Pagamento + Sobre + CNPJ
- **Links com hover** — transição suave para cor branca

### Carrinho lateral
- **Abertura suave** — animação translateX com easing spring
- **Remoção individual** — cada item tem botão de remover
- **Cálculo automático** — total atualizado em tempo real
- **Cartão fechado** — quando vazio

### Toast
- **Posicionamento centralizado** — abaixo da tela
- **Animação de entrada** — translateY + fade
- **Auto-desfazer** — 3.5s para desaparecer

## Estrutura

```
tecsul/
├── index.html   # Estrutura semântica completa
├── style.css    # Design system + componentes
├── script.js    # Catálogo, carrinho, busca, toast
└── README.md
```

## Funcionalidades

- **Catálogo completo** com 8 produtos reais (imagens validadas de varejistas brasileiros)
- **Carrinho lateral** com animação spring, remoção individual, cálculo de total
- **Busca em tempo real** por nome, marca ou categoria
- **Filtro por categoria** via navegação superior ou cards de categoria
- **Cálculo automático** de desconto e parcelamento 12x
- **Toast de feedback** para todas as ações principais
- **Totalmente responsivo** (desktop, tablet, mobile)
- **Acessibilidade**: `aria-label`, `role="search"`, `aria-live="polite"` no toast

## Como usar

Abra `index.html` diretamente no navegador — não requer build ou servidor.

## Imagens

Todas as imagens são de produtos reais hospedadas em CDNs de varejistas brasileiros (MadeiraMadeira, Carrefour, Magalu, Americanas, Shopee, etc.) e foram validadas via `web_fetch`.

## Tecnologias

- HTML5 semântico
- CSS3 com custom properties (CSS variables)
- JavaScript vanilla (ES6+)
- Inter font family do Google Fonts
- SVGs inline (ícones e ilustrações)
- Canvas (renderização dinâmica de ícones SVG)
