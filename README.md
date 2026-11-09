# Kinpaku — Ateliê de Eletrodomésticos

Loja de eletrodomésticos em HTML, CSS e JavaScript puros, construída sob três
referências de design deliberadas:

- **Impeccable (Neo Kinpaku)** — superfícies escuras minerais, acento *kinpaku*
gold, linhas finas de calibração nos cantos, voz geométrica sans.
- **Emil Kowalski Skills** — spring animations, botões responsivos, detalhes
invisíveis que se acumulam. *"Taste is trained, unseen details compound,
beauty is leverage."*
- **Taste Skill (Anti-Slop)** — regras explícitas do que **não** fazer: sem
*eyebrows* decorativos, sem monospace fora de código, sem numeração de índice
estilizada, sem gradientes, sem sombras em repouso, sem *glass/blur*, sem
emojis, sem *gradient blobs*. Leis do craft: 2–3 tamanhos de tipo, uma grid,
um *ground* + um *ink* + um *accent*, uma imagem dominante vence seis pequenas.

## Estrutura

```
index.html   marcação semântica, sem dependências de framework
css/styles.css  tokens, layout, componentes, responsivo
js/script.js    estado da sacola, filtros, reveal, toast
```

## Paleta (tokens em `:root`)

| Token          | Uso                               | Hex       |
|----------------|-----------------------------------|-----------|
| `--ground`     | fundo mineral profundo            | `#0a0908` |
| `--surface`    | elevação discreta                 | `#121010` |
| `--ink`        | texto principal                   | `#ece7dd` |
| `--ink-muted`  | texto secundário                  | `#8a8378` |
| `--accent`     | kinpaku gold                      | `#c9a961` |
| `--border`     | linhas finas de calibração        | `#262220` |

## Tipografia

- **Display / títulos**: *Instrument Serif* (serifa de contraste, itálico para
  ênfase em ouro).
- **Corpo / UI**: *Inter* com `ss01`, `cv01`, `kern` ativados.
- Escala modular reduzida: caption (12), body (15), lead (17), h3 (24), h2 (36),
  h1 (60), display (84).

## Interações

- **Spring easing**: `cubic-bezier(0.34, 1.56, 0.64, 1)` em botões, contadores
  e feedback tátil.
- **Reveal on scroll** via `IntersectionObserver`, sem bibliotecas.
- **Toast** de confirmação com animação de entrada spring.
- **Marquee** infinito em CSS puro para a faixa de benefícios.
- **Filtros** de catálogo com *stagger* na reaparição dos cards.

## Imagens reais

Todas as imagens de produto são URLs diretas de varejistas e fabricantes
(Midea, Samsung, Philco, Oster, KitchenAid, Samsung Bespoke AI). Nenhuma
imagem de stock genérica, nenhum *placeholder*.

## Como rodar

Abra `index.html` diretamente no navegador — não há build, não há dependências.

```bash
# ou sirva localmente
python3 -m http.server 8080
# acesse http://localhost:8080
```

## Princípios seguidos

1. **Uma imagem dominante** — o *hero* ocupa 1.15fr do grid e carrega a foto
   da linha Bespoke AI em 4:5.
2. **Uma grid** — grid CSS de 12 colunas implícitas via `fr`, consistente em
   todo o site.
3. **Um ground, um ink, um accent** — preto mineral, off-white quente, ouro.
4. **Sem sombras em repouso** — elevação é comunicada por borda + mudança de
   superfície, nunca por *box-shadow*.
5. **Sem glass/blur decorativo** — o único *backdrop-filter* é `saturate(1.2)`
   no header, por função, não por estética.
6. **Linhas finas de calibração** — quatro cantos em `position: fixed`,
   referência visual ao sistema Impeccable.
7. **Tipografia com intenção** — serif para títulos (calor editorial), sans
   para UI (precisão técnica). Nada de *display font* decorativa.

## Licença

Uso livre para estudo e portfólio.
