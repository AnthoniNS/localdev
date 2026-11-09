/* ==========================================================================
   Kinpaku — Interactions
   Spring animations, reveal on scroll, cart state, filters.
   ========================================================================== */

const products = [
  {
    id: 'bes-ai-2026',
    category: 'cozinha',
    categoryLabel: 'Cozinha integrada',
    ref: 'BES-2026-AI',
    name: 'Bespoke AI — Refrigerador integrado',
    desc: 'Painéis permutáveis em acabamento mineral. Compressor inverter com assinatura harmônica calibrada.',
    price: 'R$ 14.890',
    priceNum: 14890,
    image: 'https://img.global.news.samsung.com/br/wp-content/uploads/2026/02/Samsung-Digital-Appliances-Bespoke-AI-and-Dacor-Kitchen-Appliances-KBIS-2026_dl1-1.jpg',
    tag: 'Novo',
  },
  {
    id: 'midea-ai-12k',
    category: 'clima',
    categoryLabel: 'Clima',
    ref: 'MID-AI-12K',
    name: 'Airvolution AI — 12.000 BTU',
    desc: 'Split hi-wall inverter. 38dB em operação contínua. Filtragem HEPA de três estágios.',
    price: 'R$ 4.290',
    priceNum: 4290,
    image: 'https://norterefrigeracao.fbitsstatic.net/img/p/ar-condicionado-12000-btus-split-hi-wall-inverter-ai-airvolution-midea-220v-171060/357588-1.jpg?w=1000&h=1000&v=202604160857',
    tag: 'Edição 04',
  },
  {
    id: 'samsung-12k',
    category: 'clima',
    categoryLabel: 'Clima',
    ref: 'SAM-WIND-12',
    name: 'WindFree — 12.000 BTU',
    desc: 'Difusão micro-perfurada sem fluxo direto. Compressor digital inverter de oito polos.',
    price: 'R$ 4.790',
    priceNum: 4790,
    image: 'https://novomundo.fbitsstatic.net/img/p/ar-condicionado-split-samsung-inverter-frio-12000-btus-branco-ar12hvspbsn-151724/338911-2.jpg?v=202610311206',
  },
  {
    id: 'oster-oven-14',
    category: 'cozinha',
    categoryLabel: 'Cozinha',
    ref: 'OST-OF-14L',
    name: 'Oven Fryer 14L — Digital Touch',
    desc: 'Convecção real em 38dB. Vidro triplo com superfície externa a 42°C máx. 1700W.',
    price: 'R$ 2.490',
    priceNum: 2490,
    image: 'https://jcsbrasil.vteximg.com.br/arquivos/ids/242224-1000-1000/01.png?v=639178215693000000',
    tag: 'Destaque',
  },
  {
    id: 'kitchenaid-k150',
    category: 'cozinha',
    categoryLabel: 'Cozinha',
    ref: 'KA-K150-BK',
    name: 'KitchenAid K150 — 650W',
    desc: 'Jarro de vidro borossilicato com contra-peso. Motor de indução silencioso. Intellispeed adaptativo.',
    price: 'R$ 1.890',
    priceNum: 1890,
    image: 'https://media.adeo.com/mkp/83d46d1d7caaa51c4a3cd746bccaa6f6/media.jpg?width=3000&height=3000&format=jpg&quality=80&fit=bounds',
  },
  {
    id: 'philco-inv-12k',
    category: 'clima',
    categoryLabel: 'Clima',
    ref: 'PHL-INV-12',
    name: 'Philco Inverter — 12.000 BTU',
    desc: 'Hi-wall com aletas douradas anticorrosivas. Modo noturno com curva térmica de oito horas.',
    price: 'R$ 3.490',
    priceNum: 3490,
    image: 'https://www.dufrio.com.br/upload/produto/imagem/b_ar-condicionado-split-inverter-12000-btus-philco-frio-pac12000ifm15-220v-1413.webp',
  },
];

const state = {
  cart: [],
  filter: 'all',
};

/* ---------- Render ---------- */
const grid = document.querySelector('[data-product-grid]');

function formatPrice(n) {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 0 });
}

function renderProducts() {
  grid.innerHTML = products
    .map(
      (p, i) => `
    <li class="product" data-id="${p.id}" data-category="${p.category}" style="transition-delay: ${i * 60}ms">
      <div class="product__media">
        <img src="${p.image}" alt="${p.name}" loading="lazy" />
        ${p.tag ? `<span class="product__tag">${p.tag}</span>` : ''}
        <span class="product__ref">${p.ref}</span>
      </div>
      <div class="product__body">
        <span class="product__category">${p.categoryLabel}</span>
        <h3 class="product__name">${p.name}</h3>
        <p class="product__desc">${p.desc}</p>
        <div class="product__footer">
          <div class="product__price">
            <span class="product__price-label">A partir de</span>
            <span class="product__price-value">${p.price}</span>
          </div>
          <button class="product__add" data-add="${p.id}" aria-label="Adicionar ${p.name} à sacola">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
              <path d="M12 5v14M5 12h14"/>
            </svg>
          </button>
        </div>
      </div>
    </li>
  `
    )
    .join('');

  // Reveal products with stagger
  requestAnimationFrame(() => {
    document.querySelectorAll('.product').forEach((el, i) => {
      setTimeout(() => el.setAttribute('data-visible', ''), i * 60);
    });
  });
}

/* ---------- Filters ---------- */
function applyFilter(category) {
  state.filter = category;
  document.querySelectorAll('.filter').forEach((f) => {
    if (f.dataset.filter === category) f.setAttribute('data-active', '');
    else f.removeAttribute('data-active');
  });
  document.querySelectorAll('.product').forEach((el) => {
    const match = category === 'all' || el.dataset.category === category;
    if (match) el.removeAttribute('data-hidden');
    else el.setAttribute('data-hidden', '');
  });
}

document.querySelectorAll('.filter').forEach((btn) => {
  btn.addEventListener('click', () => applyFilter(btn.dataset.filter));
});

/* ---------- Cart ---------- */
const cartCountEl = document.querySelector('[data-cart-count]');

function updateCartCount() {
  const count = state.cart.reduce((sum, item) => sum + item.qty, 0);
  cartCountEl.textContent = count;
  if (count > 0) cartCountEl.setAttribute('data-visible', '');
  else cartCountEl.removeAttribute('data-visible');

  const cartBtn = document.querySelector('.cart');
  cartBtn.setAttribute('aria-label', `Sacola — ${count} ${count === 1 ? 'item' : 'itens'}`);
}

function addToCart(id) {
  const product = products.find((p) => p.id === id);
  if (!product) return;
  const existing = state.cart.find((i) => i.id === id);
  if (existing) existing.qty += 1;
  else state.cart.push({ id, qty: 1, name: product.name, price: product.priceNum });
  updateCartCount();
  showToast(`${product.name.split('—')[0].trim()} adicionado`);
}

/* ---------- Toast ---------- */
const toast = document.querySelector('[data-toast]');
const toastMsg = document.querySelector('[data-toast-msg]');
let toastTimer;

function showToast(msg) {
  toastMsg.textContent = msg;
  toast.setAttribute('data-visible', '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.removeAttribute('data-visible'), 2400);
}

/* ---------- Delegated click on grid ---------- */
grid.addEventListener('click', (e) => {
  const addBtn = e.target.closest('[data-add]');
  if (addBtn) {
    addToCart(addBtn.dataset.add);
    // Spring feedback on the button
    addBtn.animate(
      [
        { transform: 'scale(1)' },
        { transform: 'scale(0.82)' },
        { transform: 'scale(1.08)' },
        { transform: 'scale(1)' },
      ],
      { duration: 420, easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)' }
    );
  }
});

/* ---------- Header scroll state ---------- */
const header = document.querySelector('[data-header]');
let lastScroll = 0;
const onScroll = () => {
  const y = window.scrollY;
  if (y > 8) header.setAttribute('data-scrolled', '');
  else header.removeAttribute('data-scrolled');
  lastScroll = y;
};
window.addEventListener('scroll', onScroll, { passive: true });

/* ---------- Reveal on scroll ---------- */
const io = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        io.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12, rootMargin: '0px 0px -60px 0px' }
);

document.querySelectorAll('.process__item, .journal__card, .feature__visual, .feature__copy').forEach((el) => {
  el.setAttribute('data-reveal', '');
  io.observe(el);
});

/* ---------- Smooth anchor scroll with offset ---------- */
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    const top = target.getBoundingClientRect().top + window.scrollY - 80;
    window.scrollTo({ top, behavior: 'smooth' });
  });
});

/* ---------- Init ---------- */
renderProducts();
updateCartCount();
onScroll();
