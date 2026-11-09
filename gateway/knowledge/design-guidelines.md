# Design Guidelines Consolidados

Princípios de design extraídos de repositórios de referência para evitar interfaces genéricas com "cara de IA".

## 1. Impeccable (Neo Kinpaku)

### Filosofia
- Dark lacquer interface com gold leaf e geometria técnica precisa
- Superfícies escuras minerais e lacquer, nunca preto puro
- Kinpaku gold como acento primário
- Verdigris patina como acento secundário para estado e contraste
- Voz geométrica sans com wordmark amplamente rastreado
- Linhas finas de calibração, geometria de circuito e costuras douradas como estrutura funcional
- Rádios pequenos, bordas contidas, quase nenhuma sombra decorativa

### Paleta de Cores (OKLCH)
- **Lacquer Black** (oklch(7% 0.006 95)): Ground padrão da página
- **Kinpaku Gold** (oklch(84% 0.19 80.46)): Acento primário, CTAs, estado ativo
- **Verdigris Patina** (oklch(70% 0.12 188)): Acento secundário, estados melhorados
- **Champagne** (oklch(91% 0 0)): Headlines, texto brilhante
- **Text Warm** (oklch(88% 0 0)): Body copy
- **Muted Text** (oklch(72% 0 0)): Metadados, captions

### Tipografia
- **Display**: Alumni Sans, weight 100, clamp(3.4rem, 6.5vw, 5.6rem)
- **Headline**: Alumni Sans, weight 300, clamp(2.6rem, 4vw, 3.4rem)
- **Title**: Albert Sans, weight 500, 1.125rem
- **Body**: Albert Sans, weight 400, 1rem, line-height 1.8
- **Mono**: SFMono-Regular, 0.6875rem, letter-spacing 0.22em

### Regras de Design
- **Hairline First**: Use bordas de 1px antes de adicionar sombra
- **No Glass**: Sem blur/glass decorativo
- **Texture Budget**: Texturas apenas em momentos de marca
- **OKLCH Only**: Novas cores declaradas em OKLCH

## 2. Emil Kowalski Design Engineering

### Filosofia Central
- **Taste is trained, not innate**: Bom gosto é instinto treinado, não preferência pessoal
- **Unseen details compound**: Detalhes invisíveis criam interfaces que as pessoas amam sem saber por quê
- **Beauty is leverage**: Beleza é subutilizada em software, use como diferencial

### Framework de Decisão de Animação

#### 1. Deve animar?
| Frequência | Decisão |
|------------|---------|
| 100+ vezes/dia (atalhos, command palette) | **Nunca animar** |
| Dezenas de vezes/dia (hover, navegação) | Remover ou reduzir drasticamente |
| Ocasional (modais, drawers, toasts) | Animação padrão |
| Raro/primeira vez (onboarding, celebrações) | Pode adicionar delight |

#### 2. Qual o propósito?
- **Feedback**: Confirmando que a interface ouviu o usuário
- **Consistência espacial**: Mostrando de onde algo veio ou foi
- **Indicação de estado**: Tornando mudança de estado legível
- **Prevenção de mudanças bruscas**: Pontando conteúdo que teleportaria
- **Explicação**: Demonstrando como algo funciona (apenas marketing/onboarding)
- **Delight**: Permitido APENAS no nível raro/primeira vez

#### 3. Qual easing?
| Situação | Easing |
|----------|--------|
| Entrando ou saindo | `ease-out` |
| Movendo/morfando na tela | `ease-in-out` |
| Hover/mudança de cor | `ease` |
| Movimento constante (marquee, progress) | `linear` |
| Padrão | `ease-out` |

**NUNCA use `ease-in` em UI**: Começa devagar, atrasando o momento exato que o usuário está observando.

#### 4. Qual duração?
| Elemento | Duração |
|----------|---------|
| Feedback de botão | 100-160ms |
| Tooltips, pequenos popovers | 125-200ms |
| Dropdowns, selects | 150-250ms |
| Modais, drawers | 200-500ms |
| Marketing/explicativo | Pode ser maior |

**Regra**: Animações de UI devem ficar abaixo de 300ms.

### Curvas Customizadas (CSS)
```css
--ease-out: cubic-bezier(0.23, 1, 0.32, 1);
--ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
--ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

### Princípios de Componentes
- **Botões responsivos**: `transform: scale(0.97)` em `:active`
- **Nunca animar de scale(0)**: Começar de `scale(0.95)` + `opacity: 0`
- **Popovers origin-aware**: Escalar a partir do trigger, não do centro
- **Tooltips**: Pular delay em hovers subsequentes
- **Transições CSS sobre keyframes**: Para UI interrompível

### Spring Animations
- **Quando usar**: Drag com momentum, elementos "vivos", gestos interrompíveis
- **Configuração Apple**: `{ type: "spring", duration: 0.5, bounce: 0.2 }`
- **Vantagem**: Mantêm velocidade quando interrompidos

## 3. Apple Design Principles

### Princípios Fundamentais

#### 1. Response - Matar latência
- Responder em pointer-down, não em release
- Feedback contínuo DURANTE a interação, não apenas no final
- Vigiar cada latência: debounces, timers artificiais, delay de ~300ms

#### 2. Direct Manipulation - Tracking 1:1
- Conteúdo deve mover junto com o toque
- Respeitar offset de onde o usuário agarrou
- Usar Pointer Events com `setPointerCapture`

#### 3. Interruptibility - Princípio mais importante
- Toda animação deve ser interrompível e redirecionável
- Animar a partir do valor de apresentação (atual), nunca do alvo
- Evitar CSS transitions/keyframes para gestos (usar springs)

#### 4. Behavior over Animation - Usar springs
- Animação pré-scriptada não responde a novo input
- Spring pode - novo input apenas muda o target
- **Damping ratio**: Controla overshoot (1.0 = sem bounce)
- **Response**: Quão rápido alcança o target (não é "duration")

#### 5. Velocity Handoff
- Animação deve continuar na velocidade exata do dedo
- Passar velocidade de release como velocidade inicial do spring

#### 6. Momentum Projection
- Não snap para boundary mais próximo do ponto de release
- Usar velocidade para projetar posição de repouso
- Snap para target mais próximo do ponto projetado

#### 7. Spatial Consistency
- Entrar e sair pelo mesmo caminho
- Ancorar interações à sua fonte
- `transform-origin` no trigger para menus/popovers

### Materiais & Profundidade
- Usar materiais translúcidos como camada funcional flutuante
- `backdrop-filter: blur()` + fundo semi-transparente
- Peso do material codifica hierarquia
- Superfícies maiores = blur mais forte + sombra mais profunda

### Tipografia Apple
- **Tracking específico por tamanho**: Texto grande quer tracking negativo, texto pequeno quer positivo
- **Leading tracking inversamente**: Apertado em headings grandes, solto em body
- **Hierarquia de peso + tamanho + leading como conjunto**
- **Respeitar configuração de tamanho de texto do usuário**

## 4. Taste Skill (Anti-Slop)

### Filosofia
Substituir padrões genéricos de IA com decisões deliberadas:
1. **Script deals directions**: Escolher entre direções pesquisadas, não inventar
2. **Ideia vem do sujeito**: Conceito retirado do próprio projeto, não do estilo
3. **House style sem ornamentos**: Regras medidas em browser real
4. **Olhar o que fez**: Screenshots em 3 widths, rubrica, corrigir, olhar novamente

### House Rules (Nunca Fazer)
- ❌ Headlines com mais de 2 linhas em qualquer width
- ❌ Eyebrows (labels pequenos acima de headings)
- ❌ Monospace fora de blocos de código reais
- ❌ Numeração de índice (01/02/03)
- ❌ Regras finas (hairlines, 1px outlined boxes)
- ❌ Gradientes (backgrounds, botões, texto)
- ❌ Sombras em coisas em repouso
- ❌ Paleta assistente (yellow-cream com terracotta)
- ❌ Labels uppercase tiny letter-spaced
- ❌ Icon-topped feature cards
- ❌ Glass (backdrop blur panels, floating pill navigation)
- ❌ Emoji, gradient blobs, decorative shapes
- ❌ Styled accent word em headline (italic, serif, colored)
- ❌ Mais de 2 typefaces

### Leis do Craft

#### Tipo
- 2-3 tamanhos fazem o trabalho visível: um muito grande, um pequeno, nada no meio
- Display type: tracking -0.02 a -0.05em, leading 0.85-1.05
- Texto: 16-20px, leading 1.45-1.6, 45-75 caracteres por linha
- Máximo 5 tamanhos por página
- Alinhado à esquerda por padrão

#### Espaço
- Uma grid, um par de margens apertadas (16-32px), usado em todo lugar
- Assimetria dentro da grid, nunca no frame
- Gap entre seções claramente maior que gap interno: 120-240px em desktop
- Cada seção com composição diferente dos vizinhos

#### Cor
- Um ground, um ink, um accent
- Texto corrido no ink completo
- Superfícies separadas por pequeno step de tom, nunca por linha ou sombra
- Seção pode mudar cor do campo inteiro

#### Imagery
- Uma imagem dominante vence seis pequenas
- Mesmos crop ratios, mesmo tratamento
- Nenhuma imagem é melhor que placeholder, ícone ou forma abstrata
- Toda imagem encontrada deve ser creditada

#### Componentes
- Botões: flat, uma cor de fill, square-cornered ou fully round
- Navegação: wordmark, 3-5 plain links, uma action
- Footer é um close projetado, não um sitemap

### Processo de Build
1. **Tokens**: Cores e roles de tipo como CSS custom properties
2. **Hero**: Exatamente como blueprint descreve, em desktop e phone
3. **Cada seção do blueprint**: Com conteúdo do projeto
4. **Imagery**: Própria > Gerada > Real de coleções abertas > Desenhada em código
5. **Live thing**: Uma coisa interativa feita do sujeito
6. **Scroll scenes**: Quando sheet deals them
7. **Fullness**: Cada screen como poster: uma coisa dominante + conteúdo
8. **Frame**: Um par de margens externas iguais em todo width
9. **States e semântica**: Links e botões reais, focus visível, alt text

### Motion Layer (Obrigatório)
1. **Signature move**: Um, bem feito
2. **Entrance para partes de cada seção**: Heading, texto, imagem, staggered 60-90ms
3. **Feedback em todo controle**: Press, hover, focus
4. **Uma imagem em movimento**: Clip encontrado, slow scale, scroll-linked move

## 5. Performance Cheatsheet

| Problema | Solução |
|----------|---------|
| Animação stutters | Animar `transform`/`opacity`, não `width`/`top` |
| Lista longa scroll devagar | Virtualizar - renderizar apenas o visível |
| Blur causa problemas de perf | Manter `blur()` animado abaixo de 20px |
| Motion `x`/`y` drops frames | Upgrade para motion 14.2+ ou usar string `transform` |
| Propriedades aleatórias animam | Não fazer `transition: all`, listar propriedades exatas |
| React re-renderiza todo frame | Escrever em `ref.current.style`, não state |
| Element shift 1px ao iniciar motion | `will-change: transform` (apenas quando ver) |

## 6. UI Cheatsheet

| Problema | Solução |
|----------|---------|
| Timestamps antigos leem "340 days ago" | Trocar para data absoluta após uma semana |
| Números jitter quando mudam | `font-variant-numeric: tabular-nums` |
| Headings grandes parecem estranhos | Tracking mais apertado como `-0.02em` |
| Body text parece estranho | Cap linha em ~65 caracteres com `max-width: 65ch` |
| Botão parece não responsivo | `transform: scale(0.97)` em `:active` |
| Avatar espremido em oval | `flex-shrink: 0` no avatar |
| Gradient fade tem borda visível | Usar gradient eased: color stops extras ao longo de ease curve |
| Transition ainda parece estranha | Adicionar `filter: blur(2px)` durante transition |
| Dropdown parece lento | `ease-out` abaixo de 300ms, nunca `ease-in` |
| Popover cresce do lugar errado | `transform-origin` no trigger (modais ficam centralizados) |
| Count lê "1 members" | Pluralizar com `Intl.PluralRules` |

## 7. Animation Recipes

### Button Press
```css
.button {
  transition: transform 160ms var(--ease-out);
}
.button:active {
  transform: scale(0.97);
}
```

### Dropdown/Popover
```css
.popover {
  transform-origin: var(--transform-origin);
  transition: opacity 200ms var(--ease-out), transform 200ms var(--ease-out);
}
.popover[data-starting-style],
.popover[data-ending-style] {
  opacity: 0;
  transform: scale(0.95);
}
```

### Tooltip
```css
.tooltip {
  transform-origin: var(--transform-origin);
  transition: transform 125ms var(--ease-out), opacity 125ms var(--ease-out);
}
.tooltip[data-starting-style],
.tooltip[data-ending-style] {
  opacity: 0;
  transform: scale(0.97);
}
.tooltip[data-instant] {
  transition-duration: 0ms;
}
```

### Modal
```css
.modal {
  transform-origin: center;
  transition: opacity 250ms var(--ease-out), transform 250ms var(--ease-out);
}
.modal[data-starting-style],
.modal[data-ending-style] {
  opacity: 0;
  transform: scale(0.96);
}
```

### Drawer/Sheet
```css
.drawer {
  transform: translateY(0);
  transition: transform 500ms var(--ease-drawer);
}
.drawer[data-closed] {
  transform: translateY(100%);
}
```

### Toast
```css
.toast {
  opacity: 1;
  transform: translateY(0);
  transition: opacity 400ms ease, transform 400ms ease;
}
.toast@starting-style {
  opacity: 0;
  transform: translateY(100%);
}
```

### Stagger Group Entrance
```css
.item {
  opacity: 0;
  transform: translateY(8px);
  animation: fadeIn 300ms var(--ease-out) forwards;
}
.item:nth-child(2) { animation-delay: 50ms; }
.item:nth-child(3) { animation-delay: 100ms; }
.item:nth-child(4) { animation-delay: 150ms; }

@keyframes fadeIn {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

### Hold to Confirm
```css
.overlay {
  clip-path: inset(0 100% 0 0);
  transition: clip-path 200ms var(--ease-out);
}
.button:active .overlay {
  clip-path: inset(0 0 0 0);
  transition: clip-path 2s linear;
}
.button:active {
  transform: scale(0.97);
}
```

### Drag to Dismiss
```js
const timeTaken = Date.now() - dragStartTime.current;
const velocity = Math.abs(swipeAmount) / timeTaken;

if (Math.abs(swipeAmount) >= SWIPE_THRESHOLD || velocity > 0.11) {
  dismiss();
}

// Set transform diretamente no elemento
element.style.transform = `translateY(${distance}px)`;

// Spring para settle
{ type: "spring", duration: 0.5, bounce: 0.2 }
```

## 8. Checklist de Revisão

| Issue | Fix |
|-------|-----|
| `transition: all` | Especificar propriedades exatas |
| `scale(0)` entry animation | Começar de `scale(0.95)` com `opacity: 0` |
| `ease-in` em UI element | Trocar para `ease-out` ou curva custom |
| `transform-origin: center` em popover | Definir para localização do trigger |
| Animação em keyboard action | Remover animação completamente |
| Duração > 300ms em UI element | Reduzir para 150-250ms |
| Hover animation sem media query | Adicionar `@media (hover: hover) and (pointer: fine)` |
| Keyframes em elemento triggered rapidamente | Usar CSS transitions para interrupção |
| Motion `x`/`y` props under load | Upgrade para 14.2+ ou usar string `transform` |
| Mesma velocidade enter/exit | Fazer exit mais rápido que enter |
| Elementos aparecem todos juntos | Adicionar stagger delay (30-80ms) |

## Fontes

- **Impeccable**: https://github.com/pbakaus/impeccable
- **Emil Kowalski Skills**: https://github.com/emilkowalski/skills
- **Taste Skill**: https://github.com/leonxlnx/taste-skill
