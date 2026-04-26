// ===========================
// STATE
// ===========================
let currentUser = null;
let products = [];
let cart = [];
let selectedProductImage = null;
let weeklyChart = null;
let monthlyChart = null;
let currentDraftId = null;

// Hardware & Config State
let scalePollingInterval = null;
let barcodeBuffer = "";
let lastKeyTime = Date.now();
let invoiceConfig = {
    businessName: 'PawStore Canino',
    businessNid: '900.123.456-7',
    businessAddress: 'Calle de los Perros #123',
    businessPhone: '300 000 0000',
    businessFooter: '¡Gracias por tu compra! Amamos a tus mascotas.'
};

// ===========================
// API HELPERS
// ===========================
async function api(url, options = {}) {
    const config = {
        headers: { 'Content-Type': 'application/json' },
        ...options,
    };
    const response = await fetch(url, config);
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data.error || 'Error en la solicitud');
    }
    return data;
}

// ===========================
// TOAST NOTIFICATIONS
// ===========================
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const toastMsg = document.getElementById('toastMsg');
    const toastIcon = document.getElementById('toastIcon');

    toastMsg.textContent = message;
    toast.className = `toast ${type}`;
    toastIcon.textContent = type === 'success' ? 'check_circle' : 'error';
    toast.style.display = 'flex';

    setTimeout(() => {
        toast.style.display = 'none';
    }, 3500);
}

// ===========================
// AUTH
// ===========================
async function handleLogin(event) {
    event.preventDefault();
    const username = document.getElementById('loginUsername').value.trim();
    const password = document.getElementById('loginPassword').value;
    const errorEl = document.getElementById('loginError');

    try {
        const data = await api('/api/login', {
            method: 'POST',
            body: JSON.stringify({ username, password }),
        });

        currentUser = data.user;
        errorEl.style.display = 'none';
        showApp();
    } catch (err) {
        errorEl.textContent = err.message;
        errorEl.style.display = 'block';
    }
    return false;
}

async function handleLogout() {
    try {
        await api('/api/logout', { method: 'POST' });
    } catch (e) { /* ignore */ }
    currentUser = null;
    cart = [];
    document.getElementById('mainApp').style.display = 'none';
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('loginUsername').value = '';
    document.getElementById('loginPassword').value = '';
}

async function checkSession() {
    // Primero verificar bloqueo del sistema

    try {
        const data = await api('/api/me');
        currentUser = data;
        showApp();
    } catch (e) {
        // Not logged in
    }
}

// ===========================
// APP INIT
// ===========================
function showApp() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('mainApp').style.display = 'flex';

    // Set user info
    document.getElementById('userName').textContent = currentUser.username;
    document.getElementById('userRole').textContent = currentUser.role === 'admin' ? 'Administrador' : 'Vendedor';

    // Set avatar
    const avatarEl = document.getElementById('userAvatar');
    if (currentUser.avatar_path) {
        avatarEl.innerHTML = `<img src="${currentUser.avatar_path}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
    } else {
        avatarEl.textContent = currentUser.username.charAt(0).toUpperCase();
    }

    // License and 5-day warning
    if (currentUser.license) {
        const lic = currentUser.license;
        const badge = document.getElementById('licenseBadgeText');
        const badgeIcon = document.getElementById('licenseBadge').querySelector('.material-icons-round');

        if (!lic.activa) {
            badge.textContent = "Licencia Vencida";
            badge.style.color = "#ff4444";
            badgeIcon.textContent = "error";
            badgeIcon.style.color = "#ff4444";
            // Bloquear visualmente si se desea (o dejar que la API rechace todo)
            document.getElementById('lockMessage').textContent = "Su licencia ha expirado. Comuníquese con el administrador para renovarla.";
            document.getElementById('lockScreen').style.display = 'flex';
        } else {
            badge.textContent = `${lic.dias_restantes} días restantes`;
            if (lic.dias_restantes <= 5) {
                badge.style.color = "#ffaa00";
                badgeIcon.style.color = "#ffaa00";
                badgeIcon.textContent = "warning";
                showToast(`¡Aviso! Tu licencia expira en ${lic.dias_restantes} días.`, 'error');
            } else {
                badge.style.color = "#a0b0c8";
                badgeIcon.style.color = "#00c8ff";
                badgeIcon.textContent = "verified";
            }
        }
    }

    // Show/hide admin-only elements
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
        el.style.display = currentUser.role === 'admin' ? '' : 'none';
    });

    switchView('sales');

    // PawStore: Init Hardware & Config
    initBarcodeScanner();
    loadInvoiceConfig();
    if (currentUser.role === 'admin') {
        refreshScalePorts();
    }
}

// ===========================
// NAVIGATION
// ===========================
function switchView(viewName) {
    // Update active nav
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.toggle('active', item.dataset.view === viewName);
    });

    // Activar en Mobile Nav
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        const onclickAttr = item.getAttribute('onclick');
        item.classList.toggle('active', onclickAttr && onclickAttr.includes(`'${viewName}'`));
    });

    // Cerrar sidebar en móvil al cambiar vista
    if (window.innerWidth <= 992) {
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.remove('active');
    }

    // Show view
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const view = document.getElementById(`view-${viewName}`);
    if (view) view.classList.add('active');

    // Load data
    switch (viewName) {
        case 'dashboard': loadDashboard(); break;
        case 'products': loadProducts(); break;
        case 'sales': loadSaleProducts(); break;
        case 'history': loadHistory(); break;
        case 'users': loadUsers(); break;
        case 'drafts': loadDrafts(); break;
        case 'settings': loadSettings(); break;
        case 'reports': /* nothing to load initially */ break;
    }
}

function toggleSidebar() {
    const sidebar = document.querySelector('.sidebar');
    if (sidebar) sidebar.classList.toggle('active');
}

function toggleMobileCart() {
    const cart = document.querySelector('.sale-cart');
    if (cart) cart.classList.toggle('active');
}

// ===========================
// DASHBOARD
// ===========================
async function loadDashboard() {
    try {
        const [prods, sales] = await Promise.all([
            api('/api/products'),
            api('/api/sales'),
        ]);

        products = prods;
        const totalSales = sales.reduce((s, v) => s + v.total, 0);
        // FIX: Ensure stock is treated as a number
        const lowStock = prods.filter(p => parseInt(p.stock) <= 5).length;

        document.getElementById('statProducts').textContent = prods.length;
        document.getElementById('statSales').textContent = formatPrice(totalSales);
        document.getElementById('statTransactions').textContent = sales.length;
        document.getElementById('statLowStock').textContent = lowStock;

        // Render charts
        renderDashboardCharts(sales);

        // Recent sales
        const tbody = document.getElementById('recentSalesBody');
        tbody.innerHTML = sales.slice(0, 10).map(s => `
            <tr>
                <td>${escapeHtml(s.product_name)}</td>
                <td>${s.quantity}</td>
                <td>${formatPrice(s.total)}</td>
                <td>${escapeHtml(s.seller_name)}</td>
                <td>${formatDate(s.date)}</td>
            </tr>
        `).join('');

        if (sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:32px;">No hay ventas registradas</td></tr>';
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ===========================
// PRODUCTS
// ===========================
async function loadProducts() {
    try {
        products = await api('/api/products');
        renderProducts(products);
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderProducts(list) {
    const tbody = document.getElementById('productsBody');
    const isAdmin = currentUser && currentUser.role === 'admin';

    tbody.innerHTML = list.map(p => {
        const imgCell = p.image_path
            ? `<img src="${p.image_path}" alt="${escapeHtml(p.name)}" class="product-thumb">`
            : `<div class="product-thumb-placeholder"><span class="material-icons-round">inventory_2</span></div>`;
        return `
        <tr>
            <td>${p.id}</td>
            <td>${imgCell}</td>
            <td><strong>${escapeHtml(p.name)}</strong></td>
            <td>${escapeHtml(p.reference || '—')}</td>
            <td>${escapeHtml(p.unit || '—')}</td>
            <td>${escapeHtml(p.category || '—')}</td>
            <td>${formatPrice(p.purchase_price)}</td>
            <td><strong>${formatPrice(p.sale_price || p.price)}</strong></td>
            <td class="${p.stock <= 5 ? 'stock-low' : 'stock-ok'}">${p.stock}</td>
            ${isAdmin ? `
            <td>
                <div class="actions-cell">
                    <button class="btn btn-sm btn-secondary" onclick="editProduct(${p.id})">
                        <span class="material-icons-round" style="font-size:16px;">edit</span>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteProduct(${p.id})">
                        <span class="material-icons-round" style="font-size:16px;">delete</span>
                    </button>
                </div>
            </td>` : ''}
        </tr>
    `;
    }).join('');

    if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="${isAdmin ? 7 : 6}" style="text-align:center;color:var(--text-muted);padding:32px;">No hay productos</td></tr>`;
    }
}

function filterProducts() {
    const q = document.getElementById('productSearch').value.toLowerCase();
    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.category && p.category.toLowerCase().includes(q))
    );
    renderProducts(filtered);
}

function showProductModal(product = null) {
    document.getElementById('productModal').style.display = 'flex';
    document.getElementById('productModalTitle').textContent = product ? 'Editar Producto' : 'Agregar Producto';
    document.getElementById('productId').value = product ? product.id : '';
    document.getElementById('productName').value = product ? product.name : '';
    document.getElementById('productCategory').value = product ? product.category || '' : '';
    document.getElementById('productPrice').value = product ? product.price || product.sale_price : '';
    document.getElementById('productStock').value = product ? product.stock : '';
    document.getElementById('productReference').value = product ? product.reference || '' : '';
    document.getElementById('productUnit').value = product ? product.unit || '' : '';
    document.getElementById('productPurchasePrice').value = product ? product.purchase_price : '';
    document.getElementById('productSalePrice').value = product ? product.sale_price : '';
    document.getElementById('productIsBulk').checked = product ? !!product.is_bulk : false;

    // Update Label based on bulk status
    const label = document.getElementById('lblProductSalePrice');
    if (label) {
        label.textContent = (product && product.is_bulk) ? 'P. Venta (POR KILO)' : 'P. Venta (COP)';
    }

    // Reset image state
    selectedProductImage = null;
    document.getElementById('productImageInput').value = '';

    if (product && product.image_path) {
        document.getElementById('productImagePreview').style.display = 'flex';
        document.getElementById('productImagePlaceholder').style.display = 'none';
        document.getElementById('productImagePreviewImg').src = product.image_path;
    } else {
        document.getElementById('productImagePreview').style.display = 'none';
        document.getElementById('productImagePlaceholder').style.display = 'flex';
        document.getElementById('productImagePreviewImg').src = '';
    }

    // Set Initial Type
    setProductType(product && product.is_bulk ? 'bulk' : 'stock');
}

/**
 * Switch UI between Bulk and Stock mode
 */
function setProductType(type) {
    const isBulk = type === 'bulk';
    document.getElementById('productIsBulk').checked = isBulk;

    // Toggle buttons
    document.getElementById('btnTypeBulk').classList.toggle('active', isBulk);
    document.getElementById('btnTypeStock').classList.toggle('active', !isBulk);

    // Hide/Show extra fields
    document.getElementById('extraFieldsStock').style.display = isBulk ? 'none' : 'block';

    // Update Labels
    const saleLabel = document.getElementById('lblProductSalePrice');
    const stockLabel = document.getElementById('lblProductStock');

    if (isBulk) {
        saleLabel.innerHTML = '<span class="material-icons-round">payments</span> P. Venta (POR KILO)';
        stockLabel.innerHTML = '<span class="material-icons-round">inventory</span> Cuántos Kilos hay';
    } else {
        saleLabel.innerHTML = '<span class="material-icons-round">payments</span> P. Venta (COP)';
        stockLabel.innerHTML = '<span class="material-icons-round">inventory</span> Cuánto hay (Stock)';
    }
}

function closeProductModal() {
    document.getElementById('productModal').style.display = 'none';
}

async function saveProduct(event) {
    event.preventDefault();
    const id = document.getElementById('productId').value;

    const formData = new FormData();
    formData.append('name', document.getElementById('productName').value);
    formData.append('category', document.getElementById('productCategory').value);
    formData.append('price', parseFloat(document.getElementById('productSalePrice').value));
    formData.append('stock', parseInt(document.getElementById('productStock').value));
    formData.append('reference', document.getElementById('productReference').value);
    formData.append('unit', document.getElementById('productUnit').value);
    formData.append('purchase_price', parseFloat(document.getElementById('productPurchasePrice').value || 0));
    formData.append('sale_price', parseFloat(document.getElementById('productSalePrice').value));
    formData.append('barcode', document.getElementById('productBarcode').value);
    formData.append('is_bulk', document.getElementById('productIsBulk').checked ? 1 : 0);

    if (selectedProductImage) {
        formData.append('image', selectedProductImage);
    }

    try {
        if (id) {
            const response = await fetch(`/api/products/${id}`, { method: 'PUT', body: formData });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error al actualizar');
            showToast('Producto actualizado correctamente');
        } else {
            const response = await fetch('/api/products', { method: 'POST', body: formData });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Error al crear');
            showToast('Producto agregado correctamente');
        }
        closeProductModal();
        loadProducts();
    } catch (err) {
        showToast(err.message, 'error');
    }
    return false;
}

function previewProductImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    selectedProductImage = file;
    const reader = new FileReader();
    reader.onload = function (e) {
        document.getElementById('productImagePreviewImg').src = e.target.result;
        document.getElementById('productImagePreview').style.display = 'flex';
        document.getElementById('productImagePlaceholder').style.display = 'none';
    };
    reader.readAsDataURL(file);
}

function removeProductImage() {
    selectedProductImage = null;
    document.getElementById('productImageInput').value = '';
    document.getElementById('productImagePreviewImg').src = '';
    document.getElementById('productImagePreview').style.display = 'none';
    document.getElementById('productImagePlaceholder').style.display = 'flex';
}

function editProduct(id) {
    const product = products.find(p => p.id === id);
    if (product) showProductModal(product);
}

async function deleteProduct(id) {
    if (!confirm('¿Estás seguro de eliminar este producto?')) return;
    try {
        await api(`/api/products/${id}`, { method: 'DELETE' });
        showToast('Producto eliminado');
        loadProducts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ===========================
// SALES
// ===========================
async function loadSaleProducts() {
    try {
        products = await api('/api/products');
        renderSaleProducts(products);
        renderCart();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function renderSaleProducts(list) {
    const grid = document.getElementById('saleProductGrid');
    grid.innerHTML = list.map(p => {
        const cartItem = cart.find(item => item.product_id === p.id);
        const qtyInCart = cartItem ? cartItem.quantity : 0;

        const imgHtml = p.image_path
            ? `<div class="sale-product-img"><img src="${p.image_path}" alt="${escapeHtml(p.name)}"></div>`
            : `<div class="sale-product-img sale-product-img-placeholder"><span class="material-icons-round">inventory_2</span></div>`;

        return `
        <div class="product-card ${p.stock <= 0 ? 'out-of-stock' : ''}">
            ${imgHtml}
            <h4>${escapeHtml(p.name)}</h4>
            <p class="product-category">${escapeHtml(p.reference ? p.reference + ' - ' : '')}${escapeHtml(p.unit || 'Sin unidad')}</p>
            <div class="product-meta">
                <span class="product-price">${formatPrice(p.sale_price || p.price)}</span>
                <span class="product-stock ${p.stock <= 5 ? 'stock-low' : ''}">${p.stock > 0 ? `Stock: ${p.stock}` : 'Agotado'}</span>
            </div>
            <div class="card-qty-control">
                <button class="qty-btn-grid" onclick="updateCartQty(${p.id}, -1)" ${qtyInCart === 0 ? 'disabled' : ''}>
                    <span class="material-icons-round">remove</span>
                </button>
                <span class="card-qty-val">${qtyInCart}</span>
                <button class="qty-btn-grid" onclick="${p.is_bulk ? `openScaleModalById(${p.id})` : `addToCart(${p.id})`}" ${p.stock <= qtyInCart ? 'disabled' : ''}>
                    <span class="material-icons-round">add</span>
                </button>
            </div>
        </div>
    `;
    }).join('');
}

function filterSaleProducts() {
    const term = document.getElementById('saleProductSearch').value.toLowerCase();
    const filtered = products.filter(p =>
        p.name.toLowerCase().includes(term) ||
        (p.reference && p.reference.toLowerCase().includes(term))
    );
    renderSaleProducts(filtered);
}

function addToCart(productId, quantity = 1) {
    const product = products.find(p => p.id === productId);
    if (!product) return;

    if (product.stock <= 0) {
        showToast('Producto agotado', 'error');
        return;
    }

    const itemIndex = cart.findIndex(item => item.product_id === productId);
    if (itemIndex > -1) {
        const newQty = cart[itemIndex].quantity + quantity;
        if (newQty > product.stock) {
            showToast('Stock insuficiente', 'error');
            return;
        }
        cart[itemIndex].quantity = newQty;
    } else {
        if (quantity > product.stock) {
            showToast('Stock insuficiente', 'error');
            return;
        }
        cart.push({
            product_id: product.id,
            name: product.name,
            price: product.sale_price || product.price,
            quantity: quantity,
            max_stock: product.stock,
            is_bulk: !!product.is_bulk
        });
    }

    renderCart();
    renderSaleProducts(products); // Update grid to show new qty

    // Trigger cart pulse animation
    const cartPanel = document.querySelector('.sale-cart');
    if (cartPanel) {
        cartPanel.classList.remove('cart-pulse');
        void cartPanel.offsetWidth; // Trigger reflow
        cartPanel.classList.add('cart-pulse');
        setTimeout(() => cartPanel.classList.remove('cart-pulse'), 600);
    }

    showToast('Producto añadido');
}

function updateCartQty(productId, delta) {
    const item = cart.find(c => c.product_id === productId);
    if (!item) {
        if (delta > 0) addToCart(productId);
        return;
    }

    item.quantity += delta;
    if (item.quantity <= 0) {
        cart = cart.filter(c => c.product_id !== productId);
    } else if (item.quantity > item.max_stock) {
        item.quantity = item.max_stock;
        showToast(`Stock máximo: ${item.max_stock}`, 'error');
    }

    renderCart();
    renderSaleProducts(products); // Update grid to show new qty
}

function removeFromCart(productId) {
    cart = cart.filter(c => c.product_id !== productId);
    renderCart();
    renderSaleProducts(products); // Update grid to show new qty
}

function renderCart() {
    const container = document.getElementById('cartItems');
    const totalEl = document.getElementById('cartTotal');
    const completeBtn = document.getElementById('completeSaleBtn');

    if (cart.length === 0) {
        container.innerHTML = '<p class="empty-cart">El carrito está vacío</p>';
        totalEl.textContent = 'COP 0';
        completeBtn.disabled = true;
        return;
    }

    completeBtn.disabled = false;
    let total = 0;

    container.innerHTML = cart.map(item => {
        const subtotal = item.price * item.quantity;
        total += subtotal;
        return `
        <div class="cart-item">
            <div class="cart-item-info">
                <h4>${escapeHtml(item.name)}</h4>
                <p>${formatPrice(item.price)} c/u</p>
            </div>
            <div class="cart-item-actions">
                <div class="qty-control">
                    <button class="qty-btn" onclick="updateCartQty(${item.product_id}, -1)" title="Quitar uno">
                        <span class="material-icons-round">remove</span>
                    </button>
                    <span class="qty-val">${item.quantity}</span>
                    <button class="qty-btn" onclick="updateCartQty(${item.product_id}, 1)" title="Agregar uno" ${item.quantity >= item.max_stock ? 'disabled' : ''}>
                        <span class="material-icons-round">add</span>
                    </button>
                </div>
                <button class="btn-remove-item" onclick="removeFromCart(${item.product_id})" title="Eliminar">
                    <span class="material-icons-round">delete</span>
                </button>
            </div>
            <div class="cart-item-price">
                ${formatPrice(subtotal)}
            </div>
        </div>`;
    }).join('');

    totalEl.textContent = formatPrice(total);

    // Mobile Badge
    const mobileBadge = document.getElementById('mobileCartBadge');
    if (mobileBadge) {
        mobileBadge.textContent = cart.length;
        mobileBadge.style.display = cart.length > 0 ? 'flex' : 'none';
    }
}

async function searchCustomerByNid() {
    const nid = document.getElementById('customerNid').value.trim();
    const fields = ['customerName', 'customerAddress', 'customerPhone'];
    const badge = document.getElementById('customerStatusBadge');

    if (!nid) {
        fields.forEach(f => {
            const el = document.getElementById(f);
            if (el) el.value = '';
        });
        if (badge) {
            badge.className = 'customer-status-badge badge-new';
            badge.innerHTML = '<span class="badge-dot"></span> Cliente nuevo';
        }
        return;
    }

    try {
        const customer = await api(`/api/customers/by-nid/${nid}`);
        document.getElementById('customerName').value = customer.name;
        document.getElementById('customerAddress').value = customer.address || '';
        document.getElementById('customerPhone').value = customer.phone || '';



        // Update status badge to found
        if (badge) {
            badge.className = 'customer-status-badge badge-found';
            badge.innerHTML = '<span class="badge-dot"></span> Cliente encontrado';
        }

        // Visual feedback on inputs
        fields.concat('customerNid').forEach(id => {
            const el = document.getElementById(id);
            el.style.borderColor = 'var(--accent-green)';
            setTimeout(() => el.style.borderColor = '', 2000);
        });

        showToast('Cliente encontrado: ' + customer.name);
    } catch (err) {
        // Not found, mark as new
        if (badge) {
            badge.className = 'customer-status-badge badge-new';
            badge.innerHTML = '<span class="badge-dot"></span> Cliente nuevo';
        }
        console.log('Cliente no encontrado, se creará nuevo');
    }
}

function selectPayMethod(btn) {
    // Deactivate all buttons
    document.querySelectorAll('.pay-method-btn').forEach(b => b.classList.remove('active'));
    // Activate clicked
    btn.classList.add('active');
    // Sync hidden select
    const method = btn.getAttribute('data-method');
    const select = document.getElementById('salePaymentMethod');
    if (select) select.value = method;
}

function calculateSaleBalance() {
    // Abono/Saldo fields removed from UI — no-op
}

async function completeSale() {
    if (cart.length === 0) return;

    const btn = document.getElementById('completeSaleBtn');
    if (!btn) return;

    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round">hourglass_top</span> Procesando...';

    try {
        const totalText = document.getElementById('cartTotal').textContent;
        const total = parseFloat(totalText.replace(/[^\d]/g, '')) || 0;

        const saleData = {
            draft_id: currentDraftId,
            items: cart.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.price
            })),
            customer: {
                nid: document.getElementById('customerNid')?.value.trim() || '',
                name: document.getElementById('customerName')?.value.trim() || '',
                address: document.getElementById('customerAddress')?.value.trim() || '',
                phone: document.getElementById('customerPhone')?.value.trim() || '',
                vehiculo: '', // Removed for PawStore
                placa: ''      // Removed for PawStore
            },
            payment: {
                subtotal: total,
                abonos: 0, // Fields removed for PawStore
                saldo: 0,  // Fields removed for PawStore
                total: total,
                payment_method: document.getElementById('salePaymentMethod')?.value || 'Contado'
            }
        };

        const result = await api('/api/invoices', {
            method: 'POST',
            body: JSON.stringify(saleData),
        });

        showToast('Venta realizada con éxito');

        // Print HTML invoice
        printHTMLInvoice(result.invoice_id);

        // Reset
        cart = [];
        currentDraftId = null;
        renderCart();
        loadSaleProducts();

        // Reset customer info
        if (document.getElementById('customerNid')) {
            document.getElementById('customerNid').value = '';
            searchCustomerByNid();
        }

    } catch (err) {
        showToast('Error al procesar la venta: ' + err.message, 'error');
        console.error('Sale Error:', err);
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<span class="material-icons-round">check_circle</span> Finalizar Venta';
        }
    }
}

// ===========================
// DASHBOARD CHARTS
// ===========================
function renderDashboardCharts(sales) {
    if (!sales || sales.length === 0) return;

    // 1. Weekly Stats (by day of week)
    const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const weeklyData = [0, 0, 0, 0, 0, 0, 0];

    sales.forEach(s => {
        const d = new Date(s.date);
        // Only sales from last 30 days or current week depending on preference
        // For simplicity, let's group all available sales by weekday to show general trend
        weeklyData[d.getDay()] += s.total;
    });

    // 2. Monthly Stats
    const monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    const monthlyData = new Array(12).fill(0);
    const currentYear = new Date().getFullYear();

    sales.forEach(s => {
        const d = new Date(s.date);
        if (d.getFullYear() === currentYear) {
            monthlyData[d.getMonth()] += s.total;
        }
    });

    if (weeklyChart) weeklyChart.destroy();
    if (monthlyChart) monthlyChart.destroy();

    const chartOptions = {
        responsive: true,
        plugins: {
            legend: { display: false }
        },
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: (value) => 'COP ' + value.toLocaleString()
                }
            }
        }
    };

    weeklyChart = new Chart(document.getElementById('weeklyChart'), {
        type: 'bar',
        data: {
            labels: dayNames,
            datasets: [{
                label: 'Ventas',
                data: weeklyData,
                backgroundColor: 'rgba(79, 109, 245, 0.6)',
                borderColor: '#4f6df5',
                borderWidth: 1
            }]
        },
        options: chartOptions
    });

    monthlyChart = new Chart(document.getElementById('monthlyChart'), {
        type: 'line',
        data: {
            labels: monthNames,
            datasets: [{
                label: 'Ventas',
                data: monthlyData,
                backgroundColor: 'rgba(45, 212, 168, 0.2)',
                borderColor: '#2dd4a8',
                borderWidth: 2,
                fill: true,
                tension: 0.4
            }]
        },
        options: chartOptions
    });
}

// ===========================
// HISTORY
// ===========================
async function loadHistory() {
    try {
        const sales = await api('/api/sales');
        const tbody = document.getElementById('historyBody');
        const isAdmin = currentUser && currentUser.role === 'admin';

        if (sales.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align:center;color:var(--text-muted);padding:32px;">No hay ventas registradas</td></tr>';
            return;
        }

        // Agrupar por invoice_id (si es null, tratar como individual)
        const groups = [];
        let currentGroup = null;

        sales.forEach(s => {
            if (s.invoice_id && currentGroup && currentGroup.invoice_id === s.invoice_id) {
                currentGroup.items.push(s);
            } else {
                currentGroup = {
                    invoice_id: s.invoice_id,
                    date: s.date,
                    seller_name: s.seller_name,
                    items: [s],
                    total: 0
                };
                groups.push(currentGroup);
            }
        });

        tbody.innerHTML = groups.map(g => {
            const rowCount = g.items.length;

            return g.items.map((item, i) => {
                const ref = item.product_reference ? ` <span style="color:var(--text-muted);font-size:0.8em;">— ${escapeHtml(item.product_reference)}</span>` : '';
                const deleteBtn = isAdmin ? `
                    <button class="btn-icon text-danger" onclick="deleteSale(${item.id}, '${escapeHtml(item.product_name)}', ${item.quantity})" title="Borrar este producto del registro" style="padding:0; margin-left:8px; opacity:0.6;">
                        <span class="material-icons-round" style="font-size:14px;">close</span>
                    </button>` : '';

                // Si es la primera fila del grupo, mostrar info de la factura
                if (i === 0) {
                    return `
                        <tr class="group-header" style="border-top: 2px solid var(--border-color);">
                            <td rowspan="${rowCount}" style="vertical-align: middle; background-color: var(--bg-item); text-align:center;">
                                <strong>#${g.invoice_id || 'Indiv.'}</strong>
                            </td>
                            <td>${escapeHtml(item.product_name)}${ref}</td>
                            <td style="text-align:center;">${item.quantity}</td>
                            <td style="text-align:right;">${formatPrice(item.unit_price)}</td>
                            <td style="text-align:right;">
                                <div style="display:flex; justify-content:flex-end; align-items:center;">
                                    <strong>${formatPrice(item.total)}</strong>
                                    ${deleteBtn}
                                </div>
                            </td>
                            <td rowspan="${rowCount}" style="vertical-align: middle; background-color: var(--bg-item); text-align:center;">${escapeHtml(g.seller_name)}</td>
                            <td rowspan="${rowCount}" style="vertical-align: middle; background-color: var(--bg-item); font-size: 0.85em; text-align:center;">${formatDate(g.date)}</td>
                            <td rowspan="${rowCount}" style="vertical-align: middle; background-color: var(--bg-item);">
                                <div class="actions-cell" style="justify-content:center;">
                                    ${g.invoice_id ? `
                                    <button class="btn btn-sm btn-primary" onclick="printHTMLInvoice(${g.invoice_id})" title="Reimprimir Factura">
                                        <span class="material-icons-round" style="font-size:16px;">print</span>
                                    </button>
                                    ${isAdmin ? `
                                    <button class="btn btn-sm btn-danger" onclick="deleteInvoice(${g.invoice_id})" title="ELIMINAR FACTURA COMPLETA" style="background-color:#d32f2f;">
                                        <span class="material-icons-round" style="font-size:16px;">delete_sweep</span>
                                    </button>` : ''}
                                    ` : `—`}
                                </div>
                            </td>
                        </tr>
                    `;
                } else {
                    // Filas subsiguientes del mismo grupo
                    return `
                        <tr>
                            <td>${escapeHtml(item.product_name)}${ref}</td>
                            <td style="text-align:center;">${item.quantity}</td>
                            <td style="text-align:right;">${formatPrice(item.unit_price)}</td>
                            <td style="text-align:right;">
                                <div style="display:flex; justify-content:flex-end; align-items:center;">
                                    <strong>${formatPrice(item.total)}</strong>
                                    ${deleteBtn}
                                </div>
                            </td>
                        </tr>
                    `;
                }
            }).join('');
        }).join('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteInvoice(invoiceId) {
    if (!confirm(`¿Eliminar la factura #${invoiceId} completa?\n\nSe restaurará el stock de todos los productos y se eliminarán los registros de venta asociados.`)) return;
    try {
        await api(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
        showToast(`Factura #${invoiceId} eliminada y stock restaurado.`);
        loadHistory();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteSale(saleId, productName, quantity) {
    if (!confirm(`¿Eliminar esta venta?\n\nProducto: ${productName}\nCantidad: ${quantity}\n\nSe restaurará el stock automáticamente.`)) return;
    try {
        await api(`/api/sales/${saleId}`, { method: 'DELETE' });
        showToast(`Venta eliminada. Stock de "${productName}" restaurado (+${quantity})`);
        loadHistory();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function exportInventoryExcel() {
    const a = document.createElement('a');
    a.href = '/api/products/export-excel';
    a.download = '';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    showToast('Descargando inventario en Excel...');
}

// ===========================
// DRAFTS (Facturas Abiertas)
// ===========================
async function loadDrafts() {
    try {
        const drafts = await api('/api/drafts');
        const tbody = document.getElementById('draftsBody');

        tbody.innerHTML = drafts.map(d => `
            <tr>
                <td>${d.id}</td>
                <td><strong>${escapeHtml(d.customer_name || 'Sin nombre')}</strong></td>
                <td>${escapeHtml(d.customer_nid || '—')}</td>
                <td><strong>${formatPrice(d.total)}</strong></td>
                <td>${escapeHtml(d.seller_name)}</td>
                <td>${formatDate(d.date)}</td>
                <td>
                    <div class="actions-cell">
                        <button class="btn btn-sm btn-primary" onclick="openDraft(${d.id})" title="Abrir/Completar">
                            <span class="material-icons-round" style="font-size:16px;">edit</span>
                        </button>
                        <button class="btn btn-sm btn-danger" onclick="deleteDraft(${d.id})" title="Eliminar">
                            <span class="material-icons-round" style="font-size:16px;">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');

        if (drafts.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align:center;color:var(--text-muted);padding:32px;">No hay facturas abiertas</td></tr>';
        }
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function saveAsDraft() {
    if (cart.length === 0) {
        showToast('El carrito está vacío', 'error');
        return;
    }

    const btn = document.getElementById('saveDraftBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="material-icons-round">hourglass_top</span> Guardando...';

    const totalText = document.getElementById('cartTotal').textContent;
    const total = parseFloat(totalText.replace(/[^\d]/g, '')) || 0;

    try {
        const draftData = {
            draft_id: currentDraftId,
            items: cart.map(item => ({
                product_id: item.product_id,
                quantity: item.quantity,
                unit_price: item.price,
                total: item.price * item.quantity
            })),
            customer: {
                nid: document.getElementById('customerNid').value.trim(),
                name: document.getElementById('customerName').value.trim(),
                address: document.getElementById('customerAddress').value.trim(),
                phone: document.getElementById('customerPhone').value.trim(),
                vehiculo: '',
                placa: ''
            },
            payment: {
                subtotal: total,
                total: total,
                payment_method: document.getElementById('salePaymentMethod').value
            }
        };

        const result = await api('/api/drafts', {
            method: 'POST',
            body: JSON.stringify(draftData),
        });

        currentDraftId = result.draft_id;
        showToast('Borrador guardado correctamente');
    } catch (err) {
        showToast(err.message, 'error');
    }

    btn.disabled = false;
    btn.innerHTML = '<span class="material-icons-round">save</span> Guardar Borrador';
}

async function openDraft(id) {
    try {
        const draft = await api(`/api/drafts/${id}`);

        // Load cart
        cart = draft.items.map(item => ({
            product_id: item.product_id,
            name: item.product_name,
            price: item.unit_price,
            quantity: item.quantity,
            max_stock: 9999 // Fallback
        }));

        // Try to update max_stock from current products list
        if (products && products.length > 0) {
            cart.forEach(item => {
                const p = products.find(p => p.id === item.product_id);
                if (p) item.max_stock = p.stock;
            });
        }

        // Load customer info
        document.getElementById('customerNid').value = draft.customer_nid || '';
        document.getElementById('customerName').value = draft.customer_name || '';
        document.getElementById('customerAddress').value = draft.customer_address || '';
        document.getElementById('customerPhone').value = draft.customer_phone || '';


        // Load payment method
        const payMethod = draft.payment_method || 'Contado';
        document.getElementById('salePaymentMethod').value = payMethod;
        document.querySelectorAll('.pay-method-btn').forEach(btn => {
            btn.classList.toggle('active', btn.getAttribute('data-method') === payMethod);
        });

        currentDraftId = draft.id;

        // Switch to sales view
        switchView('sales');

        showToast('Borrador cargado');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

async function deleteDraft(id) {
    if (!confirm('¿Estás seguro de eliminar este borrador?')) return;
    try {
        await api(`/api/drafts/${id}`, { method: 'DELETE' });
        showToast('Borrador eliminado');
        loadDrafts();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ===========================
// USERS (Admin)
// ===========================
async function loadUsers() {
    try {
        const users = await api('/api/users');
        const tbody = document.getElementById('usersBody');

        tbody.innerHTML = users.map(u => `
            <tr>
                <td>${u.id}</td>
                <td><strong>${escapeHtml(u.username)}</strong></td>
                <td><span class="badge badge-${u.role}">${u.role === 'admin' ? 'Administrador' : 'Vendedor'}</span></td>
                <td>${formatDate(u.created_at)}</td>
                <td>
                    ${u.username !== 'admin' ? `
                    <button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">
                        <span class="material-icons-round" style="font-size:16px;">delete</span>
                    </button>` : '<span style="color:var(--text-muted)">—</span>'}
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

function showUserModal() {
    document.getElementById('userModal').style.display = 'flex';
    document.getElementById('newUsername').value = '';
    document.getElementById('newPassword').value = '';
    document.getElementById('newRole').value = 'vendedor';
}

function closeUserModal() {
    document.getElementById('userModal').style.display = 'none';
}

async function saveUser(event) {
    event.preventDefault();
    const data = {
        username: document.getElementById('newUsername').value.trim(),
        password: document.getElementById('newPassword').value,
        role: document.getElementById('newRole').value,
    };

    try {
        await api('/api/users', { method: 'POST', body: JSON.stringify(data) });
        showToast('Usuario creado correctamente');
        closeUserModal();
        loadUsers();
    } catch (err) {
        showToast(err.message, 'error');
    }
    return false;
}

async function deleteUser(id) {
    if (!confirm('¿Estás seguro de eliminar este usuario?')) return;
    try {
        await api(`/api/users/${id}`, { method: 'DELETE' });
        showToast('Usuario eliminado');
        loadUsers();
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ===========================
// EXCEL IMPORT
// ===========================
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) uploadExcel(file);
}

function handleDrop(event) {
    event.preventDefault();
    event.target.closest('.upload-zone').classList.remove('dragover');
    const file = event.dataTransfer.files[0];
    if (file) uploadExcel(file);
}

async function uploadExcel(file) {
    const statusEl = document.getElementById('importStatus');
    statusEl.style.display = 'block';
    statusEl.className = 'import-status';
    statusEl.innerHTML = '<p>⏳ Procesando archivo...</p>';

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/products/import-excel', {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();

        if (data.error) {
            statusEl.className = 'import-status error';
            statusEl.innerHTML = `<p>❌ ${escapeHtml(data.error)}</p>`;
        } else {
            statusEl.className = 'import-status success';
            statusEl.innerHTML = `
                <h3>✅ Importación completada</h3>
                <p>Nuevos productos: <strong>${data.imported}</strong></p>
                <p>Productos actualizados: <strong>${data.updated}</strong></p>
                <p>Total procesados: <strong>${data.total}</strong></p>
                ${data.errors ? `<p style="color:var(--accent-orange);margin-top:8px;">⚠️ ${data.errors.length} errores encontrados</p>` : ''}
            `;
            showToast('Importación completada');
        }
    } catch (err) {
        statusEl.className = 'import-status error';
        statusEl.innerHTML = `<p>❌ Error: ${escapeHtml(err.message)}</p>`;
    }

    // Reset file input
    document.getElementById('excelFile').value = '';
}

// ===========================
// HELPERS
// ===========================
function getLocalDateStr(date = new Date()) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function formatPrice(amount) {
    return 'COP ' + Number(amount || 0).toLocaleString('es-CO', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    });
}

function escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    // Reemplazar espacio por T para asegurar compatibilidad ISO en navegadores si es necesario,
    // pero manteniendo el valor literal para evitar desfases de zona horaria si no tiene 'Z'
    let d;
    if (dateStr.includes(' ')) {
        // Formato: YYYY-MM-DD HH:MM:SS (Local del DB)
        const parts = dateStr.split(/[- :]/);
        // parts format: [YYYY, MM, DD, HH, MM, SS]
        d = new Date(parts[0], parts[1] - 1, parts[2], parts[3], parts[4], parts[5]);
    } else {
        d = new Date(dateStr);
    }

    return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

// ===========================
// PROFILE IMAGE UPLOAD
// ===========================
async function uploadProfileImage(event) {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch(`/api/users/${currentUser.id}/avatar`, {
            method: 'POST',
            body: formData,
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Error al subir imagen');

        currentUser.avatar_path = data.avatar_path;
        const avatarEl = document.getElementById('userAvatar');
        avatarEl.innerHTML = `<img src="${data.avatar_path}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        showToast('Foto de perfil actualizada');
    } catch (err) {
        showToast(err.message, 'error');
    }

    // Reset input
    event.target.value = '';
}

// ===========================
// REPORTS (Admin)
// ===========================
function toggleReportDates() {
    const period = document.getElementById('reportPeriod').value;
    const customDates = document.getElementById('customDates');
    customDates.style.display = period === 'custom' ? 'grid' : 'none';
}

function handleGenerateReport(event) {
    event.preventDefault();
    const period = document.getElementById('reportPeriod').value;
    const format = document.getElementById('reportFormat').value;

    let start, end;
    const now = new Date();
    const today = getLocalDateStr(now);

    switch (period) {
        case 'today':
            start = end = today;
            break;
        case 'yesterday':
            const yesterday = new Date(now);
            yesterday.setDate(now.getDate() - 1);
            start = end = yesterday.toISOString().split('T')[0];
            break;
        case 'this_week':
            const weekStart = new Date(now);
            weekStart.setDate(now.getDate() - now.getDay());
            start = weekStart.toISOString().split('T')[0];
            end = today;
            break;
        case 'this_month':
            start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
            end = today;
            break;
        case 'this_year':
            start = `${now.getFullYear()}-01-01`;
            end = today;
            break;
        case 'custom':
            start = document.getElementById('reportStartDate').value;
            end = document.getElementById('reportEndDate').value;
            if (!start || !end) {
                showToast('Por favor selecciona ambas fechas', 'error');
                return false;
            }
            break;
    }

    const url = `/api/reports/sales?start_date=${start}&end_date=${end}&format=${format}`;

    // Abrir en nueva pestaña para iniciar descarga
    window.open(url, '_blank');
    showToast('Generando reporte...');
    return false;
}



// ===========================
// PAWSTORE: BARCODE SCANNER
// ===========================
function initBarcodeScanner() {
    const hiddenInput = document.getElementById('barcodeScannerCapture');
    if (!hiddenInput) return;

    // Mantener foco en el input invisible siempre que no haya modales abiertos
    // y el usuario no esté enfocado en otro campo de entrada
    document.addEventListener('click', (e) => {
        const isFocusable = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
        const isInModal = !!document.querySelector('.modal[style*="flex"]');

        if (!isFocusable && !isInModal) {
            hiddenInput.focus();
        }
    });

    hiddenInput.addEventListener('keydown', (e) => {
        const currentTime = Date.now();
        if (currentTime - lastKeyTime > 100) {
            barcodeBuffer = "";
        }
        lastKeyTime = currentTime;

        if (e.key === 'Enter') {
            const barcode = barcodeBuffer.trim();
            if (barcode) {
                processBarcode(barcode);
            }
            barcodeBuffer = "";
            hiddenInput.value = "";
        } else if (e.key.length === 1) {
            barcodeBuffer += e.key;
        }
    });
}

async function processBarcode(barcode) {
    if (!barcode) return;
    try {
        const product = await api(`/api/products/barcode/${barcode}`);
        if (product.is_bulk) {
            openScaleModal(product);
        } else {
            addToCart(product.id);
            showToast(`Agregado: ${product.name}`);
        }
    } catch (err) {
        showToast('Producto no encontrado: ' + barcode, 'error');
    }
}

// ===========================
// PAWSTORE: WEIGHING SCALE
// ===========================
let currentScaleProduct = null;

function openScaleModalById(id) {
    const product = products.find(p => p.id === id);
    if (product) openScaleModal(product);
}

function openScaleModal(product) {
    currentScaleProduct = product;
    document.getElementById('scaleProductName').textContent = product.name;
    document.getElementById('scaleProductPriceLabel').textContent = formatPrice(product.sale_price || product.price);
    document.getElementById('scaleProductStockLabel').textContent = `${product.stock} kg`;
    document.getElementById('scaleWeight').textContent = "0.000";
    document.getElementById('manualWeight').value = "";
    document.getElementById('scalePriceCalc').textContent = formatPrice(0);
    document.getElementById('scaleModal').style.display = 'flex';

    startScalePolling();
}

function closeScaleModal() {
    stopScalePolling();
    document.getElementById('scaleModal').style.display = 'none';
}

function startScalePolling() {
    if (scalePollingInterval) clearInterval(scalePollingInterval);
    scalePollingInterval = setInterval(async () => {
        try {
            const res = await api('/api/scale/read');
            if (res.weight !== undefined) {
                const weight = parseFloat(res.weight);
                document.getElementById('scaleWeight').textContent = weight.toFixed(3);
                updateScalePrice(weight);
            }
        } catch (e) { }
    }, 500);
}

function stopScalePolling() {
    if (scalePollingInterval) {
        clearInterval(scalePollingInterval);
        scalePollingInterval = null;
    }
}

function updateScalePrice(weight) {
    if (!currentScaleProduct) return;
    const total = weight * (currentScaleProduct.sale_price || currentScaleProduct.price);
    document.getElementById('scalePriceCalc').innerHTML = `Total: <strong>${formatPrice(total)}</strong>`;
}

// Manual weight input listener
const manualWeightInput = document.getElementById('manualWeight');
if (manualWeightInput) {
    manualWeightInput.addEventListener('input', (e) => {
        const weight = parseFloat(e.target.value) || 0;
        document.getElementById('scaleWeight').textContent = weight.toFixed(3);
        updateScalePrice(weight);
        if (weight > 0) stopScalePolling();
    });
}

function confirmScaleWeight() {
    const weightText = document.getElementById('scaleWeight').textContent;
    const weight = parseFloat(weightText);

    if (weight <= 0) {
        showToast('El peso debe ser mayor a cero', 'error');
        return;
    }

    addToCart(currentScaleProduct.id, weight);
    showToast(`Agregado: ${weight.toFixed(3)}kg de ${currentScaleProduct.name}`);
    closeScaleModal();
}

async function refreshScalePorts() {
    const select = document.getElementById('scalePortSelect');
    if (!select) return;
    select.innerHTML = '<option value="">Cargando...</option>';
    try {
        const res = await api('/api/scale/ports');
        select.innerHTML = res.ports.length ? '' : '<option value="">No hay puertos detectados</option>';
        res.ports.forEach(p => {
            const opt = document.createElement('option');
            opt.value = p.port;
            opt.textContent = `${p.port} (${p.description})`;
            select.appendChild(opt);
        });

        const config = await api('/api/scale/config');
        if (config.port) select.value = config.port;
        document.getElementById('scaleBaudrateSelect').value = config.baudrate || '9600';
    } catch (e) {
        select.innerHTML = '<option value="">Error al cargar</option>';
    }
}

async function saveScaleConfig() {
    const data = {
        port: document.getElementById('scalePortSelect').value,
        baudrate: document.getElementById('scaleBaudrateSelect').value,
        protocol: 'generic'
    };
    try {
        await api('/api/scale/config', { method: 'POST', body: JSON.stringify(data) });
        showToast('Configuración de báscula guardada');
    } catch (err) {
        showToast(err.message, 'error');
    }
}

// ===========================
// PAWSTORE: HTML INVOICE
// ===========================
function loadInvoiceConfig() {
    const saved = localStorage.getItem('pawstore_invoice_cfg');
    if (saved) {
        invoiceConfig = JSON.parse(saved);
    }
}

function openInvoiceEditor() {
    document.getElementById('cfgBusinessName').value = invoiceConfig.businessName;
    document.getElementById('cfgBusinessNid').value = invoiceConfig.businessNid;
    document.getElementById('cfgBusinessAddress').value = invoiceConfig.businessAddress;
    document.getElementById('cfgBusinessPhone').value = invoiceConfig.businessPhone;
    document.getElementById('cfgBusinessFooter').value = invoiceConfig.businessFooter;
    document.getElementById('invoiceEditorModal').style.display = 'flex';
}

function closeInvoiceEditor() {
    document.getElementById('invoiceEditorModal').style.display = 'none';
}

function saveInvoiceConfig() {
    invoiceConfig = {
        businessName: document.getElementById('cfgBusinessName').value,
        businessNid: document.getElementById('cfgBusinessNid').value,
        businessAddress: document.getElementById('cfgBusinessAddress').value,
        businessPhone: document.getElementById('cfgBusinessPhone').value,
        businessFooter: document.getElementById('cfgBusinessFooter').value
    };
    localStorage.setItem('pawstore_invoice_cfg', JSON.stringify(invoiceConfig));
    showToast('Configuración de factura guardada localmente');
    closeInvoiceEditor();
}

async function printHTMLInvoice(invoiceId) {
    try {
        const inv = await api(`/api/invoices/${invoiceId}`);
        const printArea = document.getElementById('printInvoice');

        const date = formatDate(inv.date);
        const itemsHtml = inv.items.map(item => `
            <tr>
                <td style="padding:4px 0;">${item.product_name}</td>
                <td style="text-align:center; padding:4px 0;">${item.quantity}${item.is_bulk ? 'kg' : ''}</td>
                <td style="text-align:right; padding:4px 0;">${formatPrice(item.unit_price).replace('COP ', '')}</td>
                <td style="text-align:right; padding:4px 0;">${formatPrice(item.total).replace('COP ', '')}</td>
            </tr>
        `).join('');

        printArea.innerHTML = `
            <div style="font-family:'Courier New', monospace; font-size:12px; max-width:80mm; margin:0 auto; padding:10px; color:#000; background:#fff;">
                <div style="text-align:center; border-bottom:1px dashed #000; padding-bottom:10px; margin-bottom:10px;">
                    <h2 style="margin:0; font-size:16px;">${invoiceConfig.businessName}</h2>
                    <p style="margin:2px 0;">NIT: ${invoiceConfig.businessNid}</p>
                    <p style="margin:2px 0;">${invoiceConfig.businessAddress}</p>
                    <p style="margin:2px 0;">TEL: ${invoiceConfig.businessPhone}</p>
                </div>
                
                <div style="margin-bottom:10px;">
                    <p style="margin:2px 0;"><strong>FACTURA DE VENTA #${inv.id}</strong></p>
                    <p style="margin:2px 0;">Fecha: ${date}</p>
                    <p style="margin:2px 0;">Vendedor: ${inv.seller_name}</p>
                </div>
                
                <div style="border-bottom:1px dashed #000; margin-bottom:10px; padding-bottom:5px;">
                    <p style="margin:2px 0;"><strong>CLIENTE:</strong> ${inv.customer_name || 'Venta Mostrador'}</p>
                    ${inv.customer_nid ? `<p style="margin:2px 0;">NIT/CC: ${inv.customer_nid}</p>` : ''}
                </div>
                
                <table style="width:100%; border-collapse:collapse; margin-bottom:10px; font-size:11px;">
                    <thead style="border-bottom:1px dashed #000;">
                        <tr>
                            <th style="text-align:left; padding-bottom:5px;">Producto</th>
                            <th style="text-align:center; padding-bottom:5px;">Cant</th>
                            <th style="text-align:right; padding-bottom:5px;">P.Unit</th>
                            <th style="text-align:right; padding-bottom:5px;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                
                <div style="border-top:1px dashed #000; padding-top:5px; text-align:right;">
                    <p style="margin:2px 0;">SUBTOTAL: <strong>${formatPrice(inv.subtotal).replace('COP ', '$')}</strong></p>
                    ${inv.abonos > 0 ? `<p style="margin:2px 0;">ABONOS: <strong>${formatPrice(inv.abonos).replace('COP ', '$')}</strong></p>` : ''}
                    <p style="margin:5px 0; font-size:14px;"><strong>TOTAL: ${formatPrice(inv.total).replace('COP ', '$')}</strong></p>
                    ${inv.saldo > 0 ? `<p style="margin:2px 0; color:red;">SALDO: <strong>${formatPrice(inv.saldo).replace('COP ', '$')}</strong></p>` : ''}
                </div>
                
                <div style="text-align:center; margin-top:20px; border-top:1px dashed #000; padding-top:10px;">
                    <p style="margin:2px 0; font-style:italic;">${invoiceConfig.businessFooter}</p>
                    <p style="margin:20px 0 0 0; font-size:9px;">Desarrollado por Antigravity</p>
                </div>
            </div>
        `;

        setTimeout(() => {
            window.print();
        }, 500);

    } catch (err) {
        showToast('Error al generar factura: ' + err.message, 'error');
    }
}

// INIT
// ===========================
document.addEventListener('DOMContentLoaded', async () => {
    checkSession();
    initUI();
});

function initUI() {
    // Legacy toggle logic replaced by setProductType
}

// ===========================
// SETTINGS & SUBSCRIPTION
// ===========================
async function loadSettings() {
    try {
        const res = await fetch('/api/licencia/estado');
        const data = await res.json();

        const diasRestantesEl = document.getElementById('subsDiasRestantes');
        const vencimientoEl = document.getElementById('subsVencimiento');

        if (diasRestantesEl) diasRestantesEl.textContent = data.dias_restantes;
        if (vencimientoEl) {
            if (data.fecha_vencimiento) {
                const date = new Date(data.fecha_vencimiento);
                vencimientoEl.textContent = date.toLocaleDateString();
            } else {
                vencimientoEl.textContent = 'Indefinido';
            }
        }

        // Cargar puertos escala si existe la función
        if (typeof refreshScalePorts === 'function') refreshScalePorts();
    } catch (e) {
        console.error('Error loading settings:', e);
    }
}

async function createSubscriptionPreference() {
    try {
        showToast('Generando link de pago...', 'info');

        const res = await fetch('/api/create-preference', {
            method: 'POST'
        });

        const data = await res.json();

        if (data.error) {
            showToast(data.error, 'error');
            return;
        }

        if (data.init_point) {
            showToast('Redirigiendo a Mercado Pago...', 'success');
            window.location.href = data.init_point;
        } else {
            showToast('Error: No se recibió link de pago', 'error');
        }
    } catch (e) {
        console.error('Error en pago:', e);
        showToast('Error al conectar con el servidor', 'error');
    }
}

