// ============================================
// Tecsul — Lógica da Loja
// ============================================

// Catálogo de produtos com imagens reais validadas
const products = [
  {
    id: 1,
    name: 'Geladeira Frost Free Duplex 400L Inox',
    brand: 'Electrolux',
    category: 'geladeiras',
    image: 'https://product-hub-prd.madeiramadeira.com.br/238282475/images/a6342e7c-2fc0-4c0e-bacb-4e80359801c0standardresolution.jpg',
    price: 3299.90,
    oldPrice: 4399.90,
    discount: 25
  },
  {
    id: 2,
    name: 'Fogão 5 Bocas Inox com Forno Elétrico',
    brand: 'Brastemp',
    category: 'cozinha',
    image: 'https://carrefourbr.vtexassets.com/arquivos/ids/6367143/MP04391639_Fogao-Brastemp-5-Bocas-Cor-Inox-Forno-Eletrico-Com-Conveccao-E-Meat-Control---BFS5CCR-220V_1_Zoom.jpg?v=637343113765670000',
    price: 2199.90,
    oldPrice: 2799.90,
    discount: 21
  },
  {
    id: 3,
    name: 'Micro-ondas 32L Inox com Grill',
    brand: 'Brastemp',
    category: 'cozinha',
    image: 'https://product-hub-prd.madeiramadeira.com.br/194010502/images/50a62983-bf1b-421d-9347-810c41d73e95e1b945c0standardresolution.jpg',
    price: 899.90,
    oldPrice: 1099.90,
    discount: 18
  },
  {
    id: 4,
    name: 'Air Fryer Jumbo Inox 7,2L',
    brand: 'Philco',
    category: 'cozinha',
    image: 'https://down-br.img.susercontent.com/file/br-11134207-7r98o-mailw7o5l5zj1a',
    price: 549.90,
    oldPrice: 699.90,
    discount: 21
  },
  {
    id: 5,
    name: 'Smart TV 50\" Crystal UHD 4K',
    brand: 'Samsung',
    category: 'eletronicos',
    image: 'https://m.magazineluiza.com.br/a-static/420x420/smart-tv-50-polegadas-samsung-crystal-uhd-4k-50au7700-bivolt/magazineluiza/193441200/bcc0f75c9d510b7b3af0e2c4f04fc7a9.jpg',
    price: 2799.90,
    oldPrice: 3499.90,
    discount: 20
  },
  {
    id: 6,
    name: 'Ar Condicionado Split Inverter 12000 BTUs',
    brand: 'LG',
    category: 'eletronicos',
    image: 'https://americanas.vtexassets.com/arquivos/ids/33655938/Ar-Condicionado-Split-Inverter-12000-BTUs-LG-Dual-Voice--AI-Artcool-UV-Nano-Quente-e-Frio-S3-W12JAR7A-220V.jpg?v=638862939274630000',
    price: 2499.90,
    oldPrice: 3199.90,
    discount: 22
  },
  {
    id: 7,
    name: 'Máquina de Lavar 11kg Titanium',
    brand: 'Midea',
    category: 'lavanderia',
    image: 'https://product-hub-prd.madeiramadeira.com.br/288084712/images/9467e198-c05b-40ce-96e8-ec06e7cb2a65K01.MF200W110WBGK02Vitrine.jpg',
    price: 1899.90,
    oldPrice: 2399.90,
    discount: 21
  },
  {
    id: 8,
    name: 'Notebook Core i5 8GB SSD 256GB',
    brand: 'Dell',
    category: 'eletronicos',
    image: 'https://images.tcdn.com.br/img/img_prod/167552/notebook_profissional_dell_latitude_5490_tela_14_intel_core_i5_8a_geracao_8gb_ssd_256gb_15887_1_004f00b82ee40a501c941e3e22275993.png',
    price: 3499.90,
    oldPrice: 4299.90,
    discount: 19
  }
];

// Estado da aplicação
let cart = [];
let currentFilter = 'all';
let searchQuery = '';
let searchProgress = 0;

// ============================================
// RENDERIZAÇÃO DE PRODUTOS (GRID PRINCIPAL)
// ============================================

function renderProducts(filter = 'all', searchTerm = '') {
  const grid = document.getElementById('productGrid');
  
  let filteredProducts = products;
  
  if (filter !== 'all') {
    filteredProducts = filteredProducts.filter(p => p.category === filter);
  }
  
  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    filteredProducts = filteredProducts.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.brand.toLowerCase().includes(term)||
      p.category.toLowerCase().includes(term)
    );
  }
  
  if (filteredProducts.length === 0) {
    grid.innerHTML = '<p style="grid-column: 1/-1; text-align: center; color: var(--ink-muted); padding: var(--s-12) 0;">Nenhum produto encontrado.</p>';
    return;
  }
  
  grid.innerHTML = filteredProducts.map(product => `
    <article class="product-card" data-id="${product.id}">
      <span class="product-badge">${product.discount}%</span>
      <div class="product-image">
        <img src="${product.image}" alt="${product.name}" loading="lazy" />
      </div>
      <div class="product-body">
        <div class="product-brand">${product.brand}</div>
        <h3 class="product-name">${product.name}</h3>
        <div class="product-price">
          <span class="price-old">R$ ${product.oldPrice.toFixed(2).replace(/\B(?=(\d{3})+(\?! \d))/g, ".")}</span>
          <div class="price-now">R$ ${product.price.toFixed(2).replace(/\B(?=(\d{3})+(\?! \d))/g, ".")}</div>
          <div class="price-installment">12x R$ ${(product.price / 12).toFixed(2).replace(/\B(?=(\d{3})+(\?! \d))/g, ".")}</div>
        </div>
        <button class="btn add-cart" onclick="addToCart(${product.id})">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1.5"/><circle cx="20" cy="21" r="1.5"/><path d="M1 1h4l2.68 13a3 3 0 0 0 5.64 0L12 21l3.68-7a3 3 0 0 0-5.64 0L5 10H1z"/></svg>
          Adicionar
        </button>
      </div>
    </article>
  `).join('');
}

// ============================================
// RENDERIZAÇÃO DO CARRINHO (DENTRO DO DRAWER) - CORRIGIDO
// ============================================

function renderCartItems() {
  const cartContainer = document.getElementById('drawerBody'); // CORREÇÃO: era #cartContainer que não existe
  
  if (cart.length === 0) {
    cartContainer.innerHTML = `
      <div class="empty-cart">
        <svg viewBox="0 0 24 24" width="64" height="64" fill="none" stroke="#9aa1b0" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="9" cy="21" r="1.5"/><circle cx="20" cy="21" r="1.5"/><path d="M1 1h4l2.68 13a3 3 0 0 0 5.64 0L12 21l3.68-7a3 3 0 0 0-5.64 0L5 10H1z"/>
        </svg>
        <h3 style="font-size: var(--fs-base); font-weight: 600; margin-top: var(--s-4) 0;">Carrinho vazio</h3>
        <p style="color: var(--ink-muted); font-size: var(--fs-sm); margin: 0;">Adicione itens ao carrinho para prosseguir.</p>
      </div>
    `;
    return;
  }
  
  cartContainer.innerHTML = cart.map(item => {
    const totalItemPrice = item.price * item.quantity;
    return `
    <div class="cart-item" data-id="${item.id}">
      <div class="cart-item-image">
        <img src="${item.image}" alt="${item.name}" loading="lazy" />
      </div>
      <div class="cart-item-info">
        <div class="cart-item-name">${item.name}</div>
        <div style="display: flex; align-items: center; gap: var(--s-2); margin-top: var(--s-2);">
          <button class="btn btn-small" onclick="updateQuantity(${item.id}, -1)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9aa1b0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <span class="cart-item-quantity">${item.quantity}</span>
          <button class="btn btn-small" onclick="updateQuantity(${item.id}, 1)">
            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="#9aa1b0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>
      <button class="cart-item-remove" onclick="removeFromCart(${item.id})">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#9aa1b0" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6c0-1 1-2 2-2h12c1 0 2 1 2 2z"/><line x1="10" y1="12" x2="10" y2="14"/><line x1="14" y1="12" x2="14" y2="14"/></svg>
      </button>
    </div>`;
  }).join('');
}

// ============================================
// FUNÇÕES DO CARRINHO - CORRIGIDAS
// ============================================

function addToCart(productId) {
  const product = products.find(p => p.id === productId);
  if (!product) return;
  
  const existingItem = cart.find(item => item.id === productId);
  if (existingItem) {
    existingItem.quantity++;
  } else {
    cart.push({ ...product, quantity: 1 });
  }
  
  updateCartUI();
  renderCartItems(); // CORREÇÃO: chamava renderProducts em vez de renderCartItems
  
  showToast(`"${product.name}" adicionado ao carrinho!`);
  
  setTimeout(() => openDrawer(), 300);
}

function removeFromCart(productId) {
  const index = cart.findIndex(item => item.id === productId);
  if (index === -1) return;
  
  if (cart[index].quantity > 1) {
    cart[index].quantity--;
  } else {
    cart.splice(index, 1);
  }
  
  updateCartUI();
  renderCartItems(); // CORREÇÃO: chamava renderProducts em vez de renderCartItems
  
  showToast(`${cart[index]?.name || 'Item'} removido do carrinho.`);
  
  if (cart.length === 0) {
    closeDrawer();
  }
}

function updateQuantity(productId, change) {
  const item = cart.find(item => item.id === productId);
  if (!item) return;
  
  item.quantity += change;
  
  if (item.quantity < 1) {
    cart.splice(cart.indexOf(item), 1);
    updateCartUI();
    renderCartItems(); // CORREÇÃO: chamava renderProducts em vez de renderCartItems
    showToast('Item removido do carrinho.');
    if (cart.length === 0) {
      closeDrawer();
    }
    return;
  }
  
  updateCartUI();
  renderCartItems(); // CORREÇÃO: chamava renderProducts em vez de renderCartItems
  showToast('Quantidade atualizada no carrinho.');
}

function clearCart() {
  cart = [];
  updateCartUI();
  renderCartItems(); // CORREÇÃO: chamava renderProducts em vez de renderCartItems
  showToast('Carrinho limpo!');
}

function updateCartUI() {
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  document.getElementById('cartCount').textContent = cart.reduce((sum, item) => sum + item.quantity, 0);
  document.getElementById('cartTotal').textContent = `R$ ${total.toFixed(2).replace(/\B(?=(\d{3})+(\?! \d))/g, ".")}`;
}

// ============================================
// DRAWER (Carrinho) - CORRIGIDO
// ============================================

function openDrawer() {
  document.getElementById('drawer').classList.add('open');
  document.getElementById('drawerBackdrop').classList.add('open');
}

function closeDrawer() {
  document.getElementById('drawer').classList.remove('open');
  document.getElementById('drawerBackdrop').classList.remove('open');
}

document.getElementById('cartBtn').addEventListener('click', openDrawer);
document.getElementById('closeDrawer').addEventListener('click', closeDrawer);

// ============================================
// CATEGORIAS - CORRIGIDO (faltava um fechamento de parêntese)
// ============================================

document.querySelectorAll('.category-card').forEach(card => {
  card.addEventListener('click', function() {
    const category = this.getAttribute('href').substring(1);
    currentFilter = category;
    renderProducts(category, searchQuery);
    closeDrawer();
  });
});

// ============================================
// BUSCA - CORRIGIDO (faltava um fechamento de parêntese)
// ============================================

function handleSearch(query) {
  searchQuery = query;
  renderProducts(currentFilter, query);
  searchProgress = 100;
  showToast(`${query} encontrado no catálogo.`);
}

// ============================================
// NOTIFICAÇÃO TOAST - CORRIGIDO (faltava um fechamento de parêntese)
// ============================================

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3500);
}

// ============================================
// NEWSLETTER - CORRIGIDO (faltava um fechamento de parêntese)
// ============================================

function subscribeNewsletter(email) {
  if (!email || !email.includes('@')) {
    showToast('Por favor, insira um e-mail válido.');
    return;
  }
  
  showToast('Obrigado por se cadastrar!');
  this.reset();
}

// ============================================
// CHECKOUT - CORRIGIDO (faltava um fechamento de parêntese)
// ============================================

function checkout() {
  if (cart.length === 0) {
    showToast('Seu carrinho está vazio!');
    return;
  }
  
  const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  showToast(`Finalizando compra no valor de R$ ${total.toFixed(2).replace(/\B(?=(\d{3})+(\?! \d))/g, ".")}...`);
  
  // Simular checkout
  setTimeout(() => {
    cart = [];
    updateCartUI();
    renderCartItems(); // CORREÇÃO: chamava renderProducts em vez de renderCartItems
    showToast('Compra realizada com sucesso!');
    closeDrawer();
  }, 2000);
}

// ============================================
// INICIALIZAÇÃO - CORRIGIDO (faltavam fechamentos de parênteses)
// ============================================

document.addEventListener('DOMContentLoaded', function() {
  renderProducts(currentFilter, searchQuery);
  updateCartUI();
  renderCartItems(); // CORREÇÃO: chamava renderProducts em vez de renderCartItems
  
  document.getElementById('geladeiras').addEventListener('click', function() {
    currentFilter = 'geladeiras';
    renderProducts('geladeiras', searchQuery);
  });
});
