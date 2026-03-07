// pos.js - Lógica dinámica para el Point of Sale (POS)

let posData = {
    productos: [],
    categorias: [],
    carrito: [],
    filtroCategoria: null,
    busqueda: ''
};

// Utilidades
const formatCOP = (valor) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(valor);
};

const showToast = (msg, icon = 'info') => {
    Swal.fire({
        text: msg,
        icon: icon,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        background: '#1a0b2e',
        color: '#fff'
    });
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Mostrar info usuario actual
    const username = window.InvAuth.currentUser();
    const role = window.InvAuth.currentUserRole();
    if (username) {
        document.getElementById('pos_user_name').textContent = username;
        document.getElementById('pos_user_role').textContent = role;
    }

    // Eventos
    document.getElementById('btn_logout').addEventListener('click', () => {
        window.InvAuth.logout();
        window.location.href = 'login.html';
    });

    document.getElementById('btn_back').addEventListener('click', () => {
        window.location.href = 'index.html';
    });

    document.getElementById('search_input').addEventListener('input', (e) => {
        posData.busqueda = e.target.value.toLowerCase();
        renderProducts();
    });

    document.getElementById('btn_process_payment').addEventListener('click', processPayment);
    document.getElementById('btn_clear_cart').addEventListener('click', clearCart);

    // Cargar Datos
    await loadPosData();
});

async function loadPosData() {
    try {
        Swal.fire({
            title: 'Cargando...',
            text: 'Obteniendo inventario',
            allowOutsideClick: false,
            didOpen: () => Swal.showLoading(),
            background: '#1a0b2e',
            color: '#fff'
        });

        const [resCat, resProd, resClientes] = await Promise.all([
            fetch(`${APP_CONFIG.SCRIPT_URL}?action=getCategorias`),
            fetch(`${APP_CONFIG.SCRIPT_URL}?action=getInventario`),
            fetch(`${APP_CONFIG.SCRIPT_URL}?action=getData&sheetName=Clientes`)
        ]);

        const dataCat = await resCat.json();
        if (dataCat.status === 'success') posData.categorias = dataCat.data;

        const dataProd = await resProd.json();
        if (dataProd.status === 'success')
            posData.productos = dataProd.data.filter(p => p.stock > 0 || p.tipo === 'Servicio');

        const dataClientes = await resClientes.json();
        if (dataClientes.status === 'success') {
            const dl = document.getElementById('cobro_clientes_list');
            if (dl) {
                dl.innerHTML = dataClientes.data
                    .map(c => `<option value="${c.nombre || c.Nombre || ''}">`)
                    .join('');
            }
        }

        Swal.close();
        renderCategories();
        renderProducts();

    } catch (e) {
        Swal.close();
        showToast('Error cargando datos: ' + e.message, 'error');
    }
}

function renderCategories() {
    const container = document.getElementById('categories_container');

    // Botón "All Items"
    let html = `<button onclick="setCategoryFilter(null)" class="px-5 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all uppercase italic ${posData.filtroCategoria === null ? 'bg-secondary text-background-dark font-black glow-cyan' : 'bg-background-dark text-secondary border border-secondary/30 hover:bg-secondary/10 hover:border-secondary'}">All Items</button>`;

    posData.categorias.forEach(cat => {
        const isActive = posData.filtroCategoria === cat.nombre;
        const classes = isActive
            ? 'bg-secondary text-background-dark font-black glow-cyan'
            : 'bg-background-dark text-secondary border border-secondary/30 hover:bg-secondary/10 hover:border-secondary';

        html += `<button onclick="setCategoryFilter('${cat.nombre}')" class="px-5 py-2 rounded-lg font-bold text-sm whitespace-nowrap transition-all uppercase italic ${classes}">${cat.nombre}</button>`;
    });

    container.innerHTML = html;
}

window.setCategoryFilter = function (catName) {
    posData.filtroCategoria = catName;
    renderCategories();
    renderProducts();
}

function renderProducts() {
    const container = document.getElementById('products_container');

    let filtered = posData.productos;
    if (posData.filtroCategoria) {
        filtered = filtered.filter(p => p.categoría === posData.filtroCategoria || p.categoria === posData.filtroCategoria);
    }
    if (posData.busqueda) {
        filtered = filtered.filter(p =>
            p.nombre.toLowerCase().includes(posData.busqueda) ||
            (p.código && p.código.toLowerCase().includes(posData.busqueda))
        );
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="col-span-full text-center p-10 text-slate-500 italic">No se encontraron productos.</div>`;
        return;
    }

    container.innerHTML = filtered.map(p => {
        const bgImg = p.imagen_url ? `url('${p.imagen_url}')` : 'linear-gradient(45deg, #1a0b2e, #0d0221)';
        const isLowStock = p.tipo !== 'Servicio' && p.stock < 5;
        const stockBadge = p.tipo === 'Servicio'
            ? `<div class="absolute top-3 left-3 px-2 py-1 rounded bg-secondary/20 text-secondary border border-secondary/50 text-[10px] font-black uppercase tracking-widest backdrop-blur-md">Servicio</div>`
            : `<div class="absolute top-3 left-3 px-2 py-1 rounded ${isLowStock ? 'bg-rose-500/20 text-rose-500 border border-rose-500/50' : 'bg-secondary/20 text-secondary border border-secondary/50'} text-[10px] font-black uppercase tracking-widest backdrop-blur-md">Stock: ${p.stock}</div>`;

        return `
        <div class="bg-panel-dark/60 rounded-xl border border-primary/20 overflow-hidden flex flex-col group hover:border-primary/60 hover:glow-magenta transition-all duration-300 transform hover:-translate-y-1">
            <div class="h-40 relative overflow-hidden glitch-filter">
                <div class="absolute inset-0 bg-slate-800 transition-transform group-hover:scale-110" style="background-image: ${bgImg}; background-size: cover; background-position: center;"></div>
                ${stockBadge}
            </div>
            <div class="p-4 flex-1 flex flex-col">
                <h3 class="font-bold text-sm mb-1 text-white group-hover:text-primary transition-colors line-clamp-2">${p.nombre}</h3>
                <p class="text-xs text-slate-500 mb-4 font-medium italic">${p.código || 'Sin código'}</p>
                <div class="mt-auto flex items-center justify-between">
                    <span class="text-lg font-black text-secondary">${formatCOP(p.precio_venta)}</span>
                    <button onclick="addToCart('${p.id}')" class="size-9 rounded-lg bg-primary/20 text-primary flex items-center justify-center border border-primary/40 hover:bg-primary hover:text-white transition-all glow-magenta active:scale-95">
                        <span class="material-symbols-outlined">add_shopping_cart</span>
                    </button>
                </div>
            </div>
        </div>
        `;
    }).join('');
}

window.addToCart = function (productId) {
    const product = posData.productos.find(p => p.id === productId);
    if (!product) return;

    const existing = posData.carrito.find(item => item.id === productId);

    if (existing) {
        if (product.tipo !== 'Servicio' && existing.cantidad >= product.stock) {
            showToast('Stock insuficiente', 'warning');
            return;
        }
        existing.cantidad++;
    } else {
        if (product.tipo !== 'Servicio' && product.stock <= 0) {
            showToast('Producto agotado', 'warning');
            return;
        }
        posData.carrito.push({
            ...product,
            cantidad: 1
        });
    }

    renderCart();
    // Sonido opcional
    // new Audio('data:audio/wav;base64,...').play().catch(e=>{});
}

window.updateCartQty = function (productId, delta) {
    const itemIndex = posData.carrito.findIndex(item => item.id === productId);
    if (itemIndex > -1) {
        const item = posData.carrito[itemIndex];
        const product = posData.productos.find(p => p.id === productId);

        const newQty = item.cantidad + delta;
        if (newQty <= 0) {
            posData.carrito.splice(itemIndex, 1);
        } else if (product && product.tipo !== 'Servicio' && newQty > product.stock) {
            showToast('Stock insuficiente', 'warning');
        } else {
            item.cantidad = newQty;
        }
        renderCart();
    }
}

function renderCart() {
    const container = document.getElementById('cart_items_container');

    if (posData.carrito.length === 0) {
        container.innerHTML = `<div class="text-center p-10 text-slate-500 italic border border-dashed border-primary/20 rounded-xl">🛒 Carrito vacío</div>`;
        document.getElementById('cart_subtotal').textContent = '$0';
        document.getElementById('cart_tax').textContent = '$0';
        document.getElementById('cart_total').textContent = '$0';
        return;
    }

    let subtotal = 0;

    container.innerHTML = posData.carrito.map(item => {
        const lineTotal = item.cantidad * item.precio_venta;
        subtotal += lineTotal;
        const bgImg = item.imagen_url ? `url('${item.imagen_url}')` : 'linear-gradient(45deg, #1a0b2e, #0d0221)';

        return `
        <div class="flex gap-4 p-3 rounded-xl bg-background-dark/60 border border-primary/10 hover:border-primary/40 transition-colors">
            <div class="size-12 rounded-lg bg-slate-800 flex-shrink-0 glitch-filter border border-primary/20" style="background-image: ${bgImg}; background-size: cover; background-position:center;"></div>
            <div class="flex-1">
                <div class="flex justify-between items-start">
                    <h4 class="text-sm font-bold text-white line-clamp-1">${item.nombre}</h4>
                    <span class="text-sm font-black text-secondary whitespace-nowrap ml-2">${formatCOP(lineTotal)}</span>
                </div>
                <div class="mt-2 flex items-center justify-between">
                    <div class="flex items-center gap-3">
                        <button onclick="updateCartQty('${item.id}', -1)" class="size-6 rounded border border-primary/40 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all glow-magenta active:scale-95">
                            <span class="material-symbols-outlined text-sm">remove</span>
                        </button>
                        <span class="text-sm font-black text-white px-2 w-4 text-center">${item.cantidad}</span>
                        <button onclick="updateCartQty('${item.id}', 1)" class="size-6 rounded border border-primary/40 flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-all glow-magenta active:scale-95">
                            <span class="material-symbols-outlined text-sm">add</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
    }).join('');

    const tax = 0; // Podrías calcular IVA aquí si está activado
    const total = subtotal + tax;

    document.getElementById('cart_subtotal').textContent = formatCOP(subtotal);
    document.getElementById('cart_tax').textContent = formatCOP(tax);
    document.getElementById('cart_total').textContent = formatCOP(total);
}

function clearCart() {
    if (posData.carrito.length === 0) return;
    Swal.fire({
        title: '¿Vaciar carrito?',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ff00ff',
        cancelButtonColor: '#0d0221',
        confirmButtonText: 'Sí, vaciar',
        background: '#1a0b2e',
        color: '#fff'
    }).then((result) => {
        if (result.isConfirmed) {
            posData.carrito = [];
            renderCart();
        }
    });
}

function processPayment() {
    if (posData.carrito.length === 0) {
        showToast('El carrito está vacío', 'warning');
        return;
    }
    openCobroModal();
}

function openCobroModal() {
    const total = posData.carrito.reduce((s, i) => s + i.precio_venta * i.cantidad, 0);
    const metodo = document.querySelector('.btn-pay-method.active')?.dataset.method || 'Efectivo';

    document.getElementById('cobro_total_display').textContent = formatCOP(total);
    document.getElementById('cobro_recibido').value = '';
    document.getElementById('cobro_cambio').textContent = formatCOP(0);
    document.getElementById('cobro_cliente').value = '';
    document.getElementById('cobro_notas').value = '';

    // Mostrar/ocultar sección de efectivo/cambio
    const efectivoSection = document.getElementById('cobro_efectivo_section');
    efectivoSection.style.display = metodo === 'Efectivo' ? 'block' : 'none';

    // Atajos rápidos de billetes (redondeos útiles)
    const shortcuts = document.getElementById('cobro_shortcuts');
    const billetes = [20000, 50000, 100000, 200000].filter(b => b >= total * 0.8);
    shortcuts.innerHTML = billetes.slice(0, 4).map(b =>
        `<button onclick="document.getElementById('cobro_recibido').value=${b};calcularCambio()" 
            class="py-2 rounded-lg bg-primary/10 border border-primary/30 text-primary text-xs font-black hover:bg-primary/20 transition-all">
            ${formatCOP(b)}
        </button>`
    ).join('');

    document.getElementById('modal_cobro').style.display = 'flex';
    setTimeout(() => document.getElementById('cobro_recibido').focus(), 100);
}

function calcularCambio() {
    const total = posData.carrito.reduce((s, i) => s + i.precio_venta * i.cantidad, 0);
    const recibido = parseFloat(document.getElementById('cobro_recibido').value) || 0;
    const cambio = recibido - total;
    const el = document.getElementById('cobro_cambio');
    el.textContent = formatCOP(Math.max(0, cambio));
    el.className = cambio >= 0
        ? 'text-2xl font-black text-green-400'
        : 'text-2xl font-black text-rose-400';
}

// ===== EJECUTAR LA VENTA (llamado desde el botón Confirmar del modal) =====
async function ejecutarVenta() {
    const total = posData.carrito.reduce((s, i) => s + i.precio_venta * i.cantidad, 0);
    const metodo = document.querySelector('.btn-pay-method.active')?.dataset.method || 'Efectivo';
    const cliente = document.getElementById('cobro_cliente').value.trim() || 'Consumidor Final';
    const notas = document.getElementById('cobro_notas').value.trim() || 'Venta rápida desde POS';
    const recibido = parseFloat(document.getElementById('cobro_recibido').value) || total;
    const usuario = window.InvAuth.currentUser() || 'Sistema POS';

    // Validar que alcanza el dinero en efectivo
    if (metodo === 'Efectivo' && recibido < total) {
        showToast('El monto recibido es menor al total', 'warning');
        return;
    }

    const btnConfirmar = document.getElementById('btn_confirmar_cobro');
    btnConfirmar.disabled = true;
    btnConfirmar.innerHTML = '<span class="material-symbols-outlined animate-spin font-black">autorenew</span> Procesando...';

    const items = posData.carrito.map(item => ({
        producto_id: item.id,
        cantidad: item.cantidad,
        precio: item.precio_venta
    }));

    const batchData = {
        action: 'crearPedido',
        tipo: 'venta',
        contacto: cliente,
        fecha: new Date().toISOString().split('T')[0],
        notas: notas,
        metodo_pago: metodo,
        descuento: 0,
        total: total,
        usuario: usuario,
        items: items
    };

    try {
        const response = await fetch(APP_CONFIG.SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(batchData),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const data = await response.json();

        if (data.status === 'success') {
            const pedidoId = data.pedidoId;

            await fetch(APP_CONFIG.SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'confirmarPedido', pedidoId }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });

            await fetch(APP_CONFIG.SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({
                    action: 'registrarPago',
                    pedidoId,
                    fecha: new Date().toISOString().split('T')[0],
                    monto: total,
                    metodoPago: metodo,
                    referencia: 'Pago en Caja POS',
                    notas: notas,
                    forzarPagado: true,
                    usuario
                }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });

            await fetch(APP_CONFIG.SCRIPT_URL, {
                method: 'POST',
                body: JSON.stringify({ action: 'completarPedido', pedidoId }),
                headers: { 'Content-Type': 'text/plain;charset=utf-8' }
            });

            // Cerrar modal
            document.getElementById('modal_cobro').style.display = 'none';

            // Imprimir tirilla
            imprimirTirilla({
                pedidoId,
                cliente,
                metodo,
                recibido: metodo === 'Efectivo' ? recibido : total,
                total,
                notas,
                usuario,
                items: posData.carrito
            });

            posData.carrito = [];
            renderCart();
            loadPosData();

        } else {
            showToast('Error: ' + data.message, 'error');
        }
    } catch (e) {
        showToast('Error de conexión: ' + e.message, 'error');
    } finally {
        btnConfirmar.disabled = false;
        btnConfirmar.innerHTML = '<span class="material-symbols-outlined font-black">check_circle</span> Confirmar Venta';
    }
}

// ===== IMPRESIÓN TIRILLA TÉRMICA =====
function imprimirTirilla({ pedidoId, cliente, metodo, recibido, total, notas, usuario, items }) {
    // Leer datos de empresa desde localStorage (guardados al configurar en index.html)
    let emp = {};
    try { emp = JSON.parse(localStorage.getItem('empresa_data') || '{}'); } catch (_) { }

    const empNombre = emp.nombre || APP_CONFIG.APP_NAME || 'FixOps';
    const empNit = emp.nit ? `NIT: ${emp.nit}` : '';
    const empDir = emp.direccion || '';
    const empCiudad = emp.ciudad || '';
    const empTel = emp.telefono ? `Tel: ${emp.telefono}` : '';
    const empEmail = emp.email || '';
    const empWeb = emp.web || '';
    const empSlogan = emp.slogan || '';
    const empLogo = emp.logo_url || '';

    const fecha = new Date().toLocaleString('es-CO');
    const cambio = metodo === 'Efectivo' ? Math.max(0, recibido - total) : 0;
    const linea = '--------------------------------';

    const itemsHtml = items.map(item => {
        const subtotal = item.precio_venta * item.cantidad;
        return `
            <div style="display:flex;justify-content:space-between;margin:2px 0;">
                <span style="flex:1;">${item.nombre.substring(0, 18)}</span>
                <span>${item.cantidad}x${formatCOP(item.precio_venta)}</span>
            </div>
            <div style="text-align:right;font-size:11px;">${formatCOP(subtotal)}</div>`;
    }).join('');

    const logoHtml = empLogo
        ? `<img src="${empLogo}" style="height:50px;max-width:120px;object-fit:contain;margin:4px auto;display:block;">`
        : '';

    const html = `
        <div style="width:80mm;padding:4mm;font-family:'Courier New',monospace;font-size:12px;color:#000;background:#fff;">
            ${logoHtml}
            <div style="text-align:center;font-weight:bold;font-size:15px;">${empNombre}</div>
            ${empSlogan ? `<div style="text-align:center;font-size:10px;font-style:italic;">${empSlogan}</div>` : ''}
            ${empNit ? `<div style="text-align:center;font-size:10px;">${empNit}</div>` : ''}
            ${empDir ? `<div style="text-align:center;font-size:10px;">${empDir}</div>` : ''}
            ${empCiudad ? `<div style="text-align:center;font-size:10px;">${empCiudad}</div>` : ''}
            ${empTel ? `<div style="text-align:center;font-size:10px;">${empTel}</div>` : ''}
            ${empEmail ? `<div style="text-align:center;font-size:10px;">${empEmail}</div>` : ''}
            ${empWeb ? `<div style="text-align:center;font-size:10px;">${empWeb}</div>` : ''}
            <div style="text-align:center;font-size:11px;margin:4px 0;">Comprobante de Venta</div>
            <div style="text-align:center;font-size:10px;">${fecha}</div>
            <div style="margin:4px 0;">${linea}</div>
            <div><b>Pedido:</b> ${pedidoId}</div>
            <div><b>Cliente:</b> ${cliente}</div>
            <div><b>Cajero:</b> ${usuario}</div>
            <div style="margin:4px 0;">${linea}</div>
            ${itemsHtml}
            <div style="margin:4px 0;">${linea}</div>
            <div style="display:flex;justify-content:space-between;"><b>TOTAL:</b><b>${formatCOP(total)}</b></div>
            <div style="display:flex;justify-content:space-between;"><span>Método:</span><span>${metodo}</span></div>
            ${metodo === 'Efectivo' ? `
            <div style="display:flex;justify-content:space-between;"><span>Recibido:</span><span>${formatCOP(recibido)}</span></div>
            <div style="display:flex;justify-content:space-between;"><b>Cambio:</b><b>${formatCOP(cambio)}</b></div>` : ''}
            ${notas && notas !== 'Venta rápida desde POS' ? `<div style="margin-top:4px;font-size:10px;"><i>Nota: ${notas}</i></div>` : ''}
            <div style="margin:4px 0;">${linea}</div>
            <div style="text-align:center;font-size:11px;">¡Gracias por su compra!</div>
            <br><br><br>
        </div>`;

    const ticketDiv = document.getElementById('ticket_print');
    ticketDiv.innerHTML = html;
    window.print();
}

// Lógica GUI para selección de método de pago
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.btn-pay-method').forEach(btn => {
        btn.addEventListener('click', function () {
            document.querySelectorAll('.btn-pay-method').forEach(b => {
                b.classList.remove('bg-primary/20', 'border-primary', 'text-primary', 'glow-magenta', 'active');
                b.classList.add('bg-background-dark', 'border-primary/30', 'text-slate-400');
            });
            this.classList.remove('bg-background-dark', 'border-primary/30', 'text-slate-400');
            this.classList.add('bg-primary/20', 'border-primary', 'text-primary', 'glow-magenta', 'active');
        });
    });

    // Evento para el cambio en efectivo
    const recibidoInput = document.getElementById('cobro_recibido');
    if (recibidoInput) recibidoInput.addEventListener('input', calcularCambio);

    // Botón confirmar cobro
    const btnConfirmar = document.getElementById('btn_confirmar_cobro');
    if (btnConfirmar) btnConfirmar.addEventListener('click', ejecutarVenta);
});

