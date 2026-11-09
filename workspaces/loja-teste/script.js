// ===== DADOS DOS PRODUTOS =====
const produtos = [
    {
        id: 1,
        nome: 'Maçã Vermelha',
        categoria: 'frutas',
        preco: 8.90,
        unidade: 'kg',
        imagem: 'https://img.freepik.com/fotos-gratis/vista-frontal-de-macas-vermelhas-frescas-frutas-maduras-e-maduras-na-mesa-branca-cor-de-frutas-planta-fresca-arvore-vermelha_140725-110195.jpg?w=1380&t=st=1678095719~exp=1678096319~hmac=28af244aa5c650ce30771ab51fdccf144bb918746838704a39e940524081a39d'
    },
    {
        id: 2,
        nome: 'Banana Prata',
        categoria: 'frutas',
        preco: 6.50,
        unidade: 'kg',
        imagem: 'https://carrefourbrfood.vtexassets.com/arquivos/ids/206749406-848-848/7889941.png?v=638989957880170000'
    },
    {
        id: 3,
        nome: 'Laranja Pêra',
        categoria: 'frutas',
        preco: 5.90,
        unidade: 'kg',
        imagem: 'https://carrefourbrfood.vtexassets.com/arquivos/ids/41575422/laranja-pera-promo-5kg-1.jpg?v=637834068950900000'
    },
    {
        id: 4,
        nome: 'Tomate Italiano',
        categoria: 'legumes',
        preco: 9.90,
        unidade: 'kg',
        imagem: 'https://images.recetasmexas.com/images/ingredients/1774524385508-tomate-rojo.webp'
    },
    {
        id: 5,
        nome: 'Alface Crespa',
        categoria: 'verduras',
        preco: 3.50,
        unidade: 'unidade',
        imagem: 'https://img.freepik.com/fotos-premium/folhas-de-alface-verde-frescas-isoladas-no-fundo-branco_461160-218.jpg'
    },
    {
        id: 6,
        nome: 'Cenoura Fresca',
        categoria: 'legumes',
        preco: 5.50,
        unidade: 'kg',
        imagem: 'https://img.freepik.com/fotos-gratis/cenouras-frescas-na-superficie-de-madeira-velha_2829-8416.jpg?w=1380&t=st=1692776625~exp=1692777225~hmac=b6d83784cde0fac14cad6b7d3bdda3c4e03c9e29c7e927488883c7b094b21232'
    },
    {
        id: 7,
        nome: 'Batata Inglesa',
        categoria: 'legumes',
        preco: 6.90,
        unidade: 'kg',
        imagem: 'https://obahortifruti.vtexassets.com/arquivos/ids/11480785-630-630'
    },
    {
        id: 8,
        nome: 'Banana Nanica',
        categoria: 'frutas',
        preco: 5.90,
        unidade: 'kg',
        imagem: 'https://http2.mlstatic.com/D_NQ_NP_963998-MLA74650253440_022024-O.webp'
    },
    {
        id: 9,
        nome: 'Alface Americana',
        categoria: 'verduras',
        preco: 4.90,
        unidade: 'unidade',
        imagem: 'https://png.pngtree.com/png-clipart/20250617/original/pngtree-plump-boston-lettuce-head-vibrant-green-leaves-healthy-and-fresh-perfect-png-image_21202059.png'
    }
];

// ===== ESTADO DO CARRINHO =====
let carrinho = [];
let filtroAtivo = 'todos';

// ===== ELEMENTOS DO DOM =====
const productsGrid = document.getElementById('productsGrid');
const cartBtn = document.getElementById('cartBtn');
const cartSidebar = document.getElementById('cartSidebar');
const cartOverlay = document.getElementById('cartOverlay');
const closeCart = document.getElementById('closeCart');
const cartItems = document.getElementById('cartItems');
const cartCount = document.getElementById('cartCount');
const cartTotal = document.getElementById('cartTotal');
const checkoutBtn = document.getElementById('checkoutBtn');
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');
const filterBtns = document.querySelectorAll('.filter-btn');

// ===== RENDERIZAR PRODUTOS =====
function renderProdutos() {
    const produtosFiltrados = filtroAtivo === 'todos'
        ? produtos
        : produtos.filter(p => p.categoria === filtroAtivo);

    productsGrid.innerHTML = produtosFiltrados.map(produto => `
        <article class="product-card" data-id="${produto.id}">
            <div class="product-image">
                <img src="${produto.imagem}" alt="${produto.nome}" loading="lazy" onerror="this.src='https://via.placeholder.com/300x220?text=Produto'">
                <span class="product-category">${produto.categoria}</span>
            </div>
            <div class="product-info">
                <h3 class="product-name">${produto.nome}</h3>
                <p class="product-unit">Por ${produto.unidade}</p>
                <div class="product-footer">
                    <span class="product-price">R$ ${produto.preco.toFixed(2).replace('.', ',')}</span>
                    <button class="add-to-cart" onclick="adicionarAoCarrinho(${produto.id})" aria-label="Adicionar ${produto.nome} ao carrinho">
                        +
                    </button>
                </div>
            </div>
        </article>
    `).join('');
}

// ===== FILTROS =====
filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        filtroAtivo = btn.dataset.filter;
        renderProdutos();
    });
});

// ===== CARRINHO =====
function adicionarAoCarrinho(id) {
    const produto = produtos.find(p => p.id === id);
    if (!produto) return;

    const itemExistente = carrinho.find(item => item.id === id);

    if (itemExistente) {
        itemExistente.quantidade += 1;
    } else {
        carrinho.push({
            ...produto,
            quantidade: 1
        });
    }

    atualizarCarrinho();
    mostrarToast(`${produto.nome} adicionado ao carrinho!`);
}

function removerDoCarrinho(id) {
    carrinho = carrinho.filter(item => item.id !== id);
    atualizarCarrinho();
}

function alterarQuantidade(id, delta) {
    const item = carrinho.find(i => i.id === id);
    if (!item) return;

    item.quantidade += delta;
    if (item.quantidade <= 0) {
        removerDoCarrinho(id);
        return;
    }
    atualizarCarrinho();
}

function atualizarCarrinho() {
    // Atualiza contador
    const totalItens = carrinho.reduce((acc, item) => acc + item.quantidade, 0);
    cartCount.textContent = totalItens;

    // Anima o contador
    cartCount.style.transform = 'scale(1.3)';
    setTimeout(() => cartCount.style.transform = 'scale(1)', 200);

    // Atualiza total
    const total = carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    cartTotal.textContent = `R$ ${total.toFixed(2).replace('.', ',')}`;

    // Renderiza itens
    if (carrinho.length === 0) {
        cartItems.innerHTML = `
            <div class="cart-empty">
                <span>🧺</span>
                <p>Seu carrinho está vazio</p>
                <small>Adicione produtos fresquinhos!</small>
            </div>
        `;
        return;
    }

    cartItems.innerHTML = carrinho.map(item => `
        <div class="cart-item">
            <div class="cart-item-image">
                <img src="${item.imagem}" alt="${item.nome}">
            </div>
            <div class="cart-item-info">
                <div class="cart-item-name">${item.nome}</div>
                <div class="cart-item-price">R$ ${(item.preco * item.quantidade).toFixed(2).replace('.', ',')}</div>
                <div class="cart-item-controls">
                    <button class="qty-btn" onclick="alterarQuantidade(${item.id}, -1)" aria-label="Diminuir">−</button>
                    <span class="qty-value">${item.quantidade}</span>
                    <button class="qty-btn" onclick="alterarQuantidade(${item.id}, 1)" aria-label="Aumentar">+</button>
                </div>
            </div>
            <button class="remove-item" onclick="removerDoCarrinho(${item.id})" aria-label="Remover ${item.nome}">
                🗑️
            </button>
        </div>
    `).join('');
}

// ===== ABRIR/FECHAR CARRINHO =====
function abrirCarrinho() {
    cartSidebar.classList.add('active');
    cartOverlay.classList.add('active');
    document.body.style.overflow = 'hidden';
}

function fecharCarrinho() {
    cartSidebar.classList.remove('active');
    cartOverlay.classList.remove('active');
    document.body.style.overflow = '';
}

cartBtn.addEventListener('click', abrirCarrinho);
closeCart.addEventListener('click', fecharCarrinho);
cartOverlay.addEventListener('click', fecharCarrinho);

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') fecharCarrinho();
});

// ===== CHECKOUT =====
checkoutBtn.addEventListener('click', () => {
    if (carrinho.length === 0) {
        mostrarToast('Adicione produtos ao carrinho primeiro!', 'aviso');
        return;
    }

    const total = carrinho.reduce((acc, item) => acc + (item.preco * item.quantidade), 0);
    const itensTexto = carrinho.map(i => `• ${i.quantidade}x ${i.nome}`).join('\n');

    alert(
        `🛒 Pedido Finalizado!\n\n${itensTexto}\n\n💰 Total: R$ ${total.toFixed(2).replace('.', ',')}\n\nObrigado por comprar na Quitanda do Zé! 🍊`
    );

    carrinho = [];
    atualizarCarrinho();
    fecharCarrinho();
});

// ===== TOAST =====
function mostrarToast(mensagem) {
    toastMessage.textContent = mensagem;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2500);
}

// ===== INICIALIZAÇÃO =====
document.addEventListener('DOMContentLoaded', () => {
    renderProdutos();
    atualizarCarrinho();
});

// Expõe funções globalmente para uso nos onclick
window.adicionarAoCarrinho = adicionarAoCarrinho;
window.removerDoCarrinho = removerDoCarrinho;
window.alterarQuantidade = alterarQuantidade;
