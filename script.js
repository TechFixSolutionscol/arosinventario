
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyf_32xSTYhEmw49O4YW_PoZav2TNsVNARP-G015r6fR6NTxebpncQJVf7ID5aYNP0diw/exec';
let cachedData = {
    productos: [],
    proveedores: [],
    clientes: [],
    categorias: []
};
let productDataCache = {};
let currentOrders = { co: [], v: [] };
let resumenFinancieroChart, tendenciasChart;

// Formateador de moneda COP
const formatCOP = (val) => {
    return new Intl.NumberFormat('es-CO', {
        style: 'currency',
        currency: 'COP',
        minimumFractionDigits: 0
    }).format(val);
};

// Sistema de Toasts
const showToast = (message, type = 'info') => {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `status-message ${type}`;
    toast.style.display = 'block';
    toast.style.margin = '0';
    toast.style.minWidth = '250px';
    toast.style.boxShadow = '0 10px 30px rgba(0,0,0,0.15)';
    toast.style.animation = 'slideIn 0.3s ease forwards';

    const icon = type === 'success' ? 'check' : type === 'error' ? 'times' : type === 'warning' ? 'exclamation-triangle' : 'info';
    toast.innerHTML = `<i class="fas fa-${icon}-circle"></i> ${message}`;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

// Estilos para animaciones de toast
const toastStyle = document.createElement('style');
toastStyle.innerHTML = `
    @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
    @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
`;
document.head.appendChild(toastStyle);

document.addEventListener('DOMContentLoaded', async () => {
    setupNavigation();
    await loadInitialData();
    setupForms();
});

function setupNavigation() {
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    const sections = document.querySelectorAll('.main-content .content-section');

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-section');

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            sections.forEach(section => {
                if (section.id === targetId) {
                    section.classList.add('active');
                    if (targetId === 'dashboard') {
                        handleLoadDashboard();
                    } else if (targetId === 'inventario') {
                        document.getElementById('cargarInventarioBtn').click();
                    }
                } else {
                    section.classList.remove('active');
                }
            });
        });
    });
}

async function loadInitialData() {
    try {
        // Cargar Categorías
        try {
            const catRes = await fetch(`${SCRIPT_URL}?action=getCategorias`);
            const catData = await catRes.json();
            if (catData.status === 'success') {
                cachedData.categorias = catData.data;
                populateCategories(catData.data);
            } else {
                console.warn("Categorías no cargadas:", catData.message);
            }
        } catch (e) {
            console.error("Error al cargar categorías:", e);
        }

        // Cargar Productos
        try {
            const prodRes = await fetch(`${SCRIPT_URL}?action=getInventario`);
            const prodData = await prodRes.json();
            if (prodData.status === 'success' && Array.isArray(prodData.data)) {
                cachedData.productos = prodData.data;
                productDataCache = {}; // Limpiar y re-poblar
                prodData.data.forEach(p => productDataCache[p.id] = p);
                console.log(`${prodData.data.length} productos cargados.`);
                // Poblar tabla de inventario si el elemento existe
                if (document.getElementById('inventarioTableBody')) {
                    renderInventarioTable(prodData.data);
                }
            } else {
                console.error("Error en datos de productos:", prodData.message);
                displayStatus('statusProducto', 'warning', `No hay productos: ${prodData.message}`);
            }
        } catch (e) {
            console.error("Error al cargar productos:", e);
            displayStatus('statusProducto', 'error', "Error de conexión al cargar productos.");
        }

        // Cargar Contactos (independiente)
        await Promise.allSettled([
            loadContactos('Proveedores'),
            loadContactos('Clientes')
        ]);

        refreshProductSelects();

    } catch (error) {
        console.error("Error crítico en loadInitialData:", error);
    }
}

function refreshProductSelects() {
    const selects = document.querySelectorAll('.item-product');
    const options = '<option value="">Seleccionar Producto...</option>' +
        cachedData.productos.map(p => `<option value="${p.id}">${p.nombre} (Cód: ${p.código})</option>`).join('');

    selects.forEach(sel => {
        const currentVal = sel.value;
        sel.innerHTML = options;
        sel.value = currentVal;
    });
}

async function loadContactos(type) {
    const listId = type === 'Proveedores' ? 'listaProveedores' : 'listaClientes';
    const selectId = type === 'Proveedores' ? 'co_proveedor' : 'v_cliente';
    const listEl = document.getElementById(listId);
    const selectEl = document.getElementById(selectId);

    try {
        const response = await fetch(`${SCRIPT_URL}?action=getData&sheetName=${type}`);
        const data = await response.json();

        if (data.status === 'success') {
            const contacts = data.data;
            if (type === 'Proveedores') cachedData.proveedores = contacts;
            else cachedData.clientes = contacts;

            listEl.innerHTML = contacts.map(c => `<li><b>${c.nombre}</b> ${c.telefono ? `- ${c.telefono}` : ''}</li>`).join('') || `<li>No hay ${type.toLowerCase()}.</li>`;

            if (selectEl) {
                selectEl.innerHTML = '<option value="">Seleccionar</option>' +
                    contacts.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
            }
        }
    } catch (e) {
        console.error(`Error cargando ${type}:`, e);
    }
}

async function handleContactPost(e, action) {
    e.preventDefault();
    const form = e.target;
    const type = action.includes('Proveedor') ? 'Proveedores' : 'Clientes';
    const prefix = action.includes('Proveedor') ? 'pr' : 'cl';

    const contactData = {
        action: 'agregarRegistroGenerico',
        sheetName: type,
        data: {
            id: generateId(),
            nombre: document.getElementById(`c_nombre_${prefix}`).value,
            telefono: document.getElementById(`c_telefono_${prefix}`).value
        }
    };

    displayStatus('statusContactos', 'info', 'Guardando contacto...');

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(contactData),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const data = await response.json();

        if (data.status === 'success') {
            showToast('Contacto guardado.', 'success');
            form.reset();
            loadContactos(type);
        } else {
            displayStatus('statusContactos', 'error', data.message);
        }
    } catch (error) {
        displayStatus('statusContactos', 'error', 'Error de conexión.');
    }
}

function generateId() {
    return 'C' + Math.random().toString(36).substr(2, 9).toUpperCase();
}

function populateCategories(categories) {
    const selectProducto = document.getElementById('p_categoria');
    if (selectProducto) {
        selectProducto.innerHTML = '<option value="" disabled selected>Seleccione una categoría</option>' +
            categories.map(cat => `<option value="${cat.nombre}">${cat.nombre}</option>`).join('');
    }

    if (categories.length === 0) {
        document.getElementById('listaCategorias').innerHTML = '<li>No hay categorías.</li>';
        return;
    }

    const listHtml = categories.map(cat => {
        const name = cat.nombre || `(ID ${cat.id})`;
        return `<li>ID: ${cat.id} | Nombre: ${name}</li>`;
    }).join('');

    document.getElementById('listaCategorias').innerHTML = listHtml;
}

function setupForms() {
    // Configuración
    document.getElementById('iniciarDBBtn').addEventListener('click', () => handleConfigAction('iniciar'));
    document.getElementById('resetDBBtn').addEventListener('click', () => {
        if (window.confirm("¡ADVERTENCIA! ¿Deseas RESETEAR TODA la base de datos? Esto es irreversible.")) {
            handleConfigAction('resetear');
        }
    });

    // User Management Section
    document.getElementById('newUserForm').addEventListener('submit', handleCreateUser);
    document.getElementById('refreshUsersBtn').addEventListener('click', loadUsers);

    // Dashboard Buttons
    const dashUpdateBtn = document.getElementById('cargarDatosGraficosBtn');
    if (dashUpdateBtn) {
        dashUpdateBtn.addEventListener('click', handleLoadDashboard);
    }
    const dashCalcBtn = document.getElementById('calcularResumenBtn');
    if (dashCalcBtn) {
        dashCalcBtn.addEventListener('click', calcularResumenFinanciero);
    }

    // Contactos
    document.getElementById('proveedorForm').addEventListener('submit', (e) => handleContactPost(e, 'agregarProveedor'));
    document.getElementById('clienteForm').addEventListener('submit', (e) => handleContactPost(e, 'agregarCliente'));

    // Categorías y Productos
    document.getElementById('categoriaForm').addEventListener('submit', (e) => handlePostAction(e, 'agregarCategoria', 'statusCategoria'));
    document.getElementById('productoForm').addEventListener('submit', (e) => handlePostAction(e, 'agregarProducto', 'statusProducto'));

    // Product Type Toggle for Stock Field
    const tipoSelect = document.getElementById('p_tipo');
    const stockGroup = document.getElementById('p_stock_group');
    const stockInput = document.getElementById('p_stock');

    if (tipoSelect && stockGroup && stockInput) {
        tipoSelect.addEventListener('change', (e) => {
            if (e.target.value === 'Servicio') {
                stockGroup.style.display = 'none';
                stockInput.value = '0';
                stockInput.removeAttribute('required');
            } else {
                stockGroup.style.display = '';
                stockInput.setAttribute('required', 'required');
            }
        });
    }

    // Order Actions
    document.getElementById('co_add_line').addEventListener('click', () => addOrderLine('co'));
    document.getElementById('v_add_line').addEventListener('click', () => addOrderLine('v'));
    document.getElementById('co_submit_btn').addEventListener('click', () => submitBatchOrder('co'));
    document.getElementById('v_submit_btn').addEventListener('click', () => submitBatchOrder('v'));

    const refreshInvBtn = document.getElementById('cargarInventarioBtn');
    if (refreshInvBtn) {
        refreshInvBtn.addEventListener('click', () => loadInventario());
    }

    const resVentasBtn = document.getElementById('resumenVentasBtn');
    if (resVentasBtn) {
        resVentasBtn.addEventListener('click', () => loadSummary('Ventas'));
    }
    const resComprasBtn = document.getElementById('resumenComprasBtn');
    if (resComprasBtn) {
        resComprasBtn.addEventListener('click', () => loadSummary('Compras'));
    }

    // Export Actions
    const exportInvBtn = document.getElementById('exportInventarioBtn');
    if (exportInvBtn) {
        exportInvBtn.addEventListener('click', () => exportTableToExcel('inventarioTable', 'Inventario_TechFix'));
    }
    const exportResBtn = document.getElementById('exportResumenBtn');
    if (exportResBtn) {
        exportResBtn.addEventListener('click', () => exportTableToExcel('resumenTable', 'Reporte_TechFix'));
    }

    // IVA Toggles
    document.getElementById('co_apply_iva').addEventListener('change', () => calculateOrderTotals('co'));
    document.getElementById('v_apply_iva').addEventListener('change', () => calculateOrderTotals('v'));

    // Set default dates and initial Order IDs
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('co_fecha').value = today;
    document.getElementById('v_fecha').value = today;

    resetOrder('co');
    resetOrder('v');

    // Init smart search for Inventory search bar
    const invSearch = document.getElementById('searchInventario');
    const invDropdown = invSearch.parentElement.nextElementSibling;
    initSmartSearch(invSearch, invDropdown, 'Productos', (item) => {
        invSearch.value = item.nombre;
        filterTable('inventarioTable', item.nombre);
    });

    // Init search for Reports (Simple filter)
    const resSearch = document.getElementById('searchResumen');
    if (resSearch) {
        resSearch.addEventListener('input', (e) => {
            filterTable('resumenTable', e.target.value);
        });
    }
}

function createDropdownFor(input) {
    const container = input.parentElement;
    container.classList.add('search-container');
    const dropdown = document.createElement('div');
    dropdown.className = 'smart-dropdown';
    container.appendChild(dropdown);
    return dropdown;
}

function initSmartSearch(inputEl, dropdownEl, type, onSelect) {
    inputEl.addEventListener('input', async (e) => {
        const query = e.target.value;
        if (query.length < 2) {
            dropdownEl.style.display = 'none';
            return;
        }

        try {
            const action = type === 'Productos' ? 'buscarProducto' : 'getData';
            const url = type === 'Productos'
                ? `${SCRIPT_URL}?action=${action}&query=${encodeURIComponent(query)}`
                : `${SCRIPT_URL}?action=${action}&sheetName=${type}`;

            const response = await fetch(url);
            const data = await response.json();

            if (data.status === 'success') {
                let results = data.data;
                if (type !== 'Productos') {
                    results = results.filter(it => it.nombre.toLowerCase().includes(query.toLowerCase()));
                }

                if (results.length > 0) {
                    dropdownEl.innerHTML = results.map(item => `
                        <div class="dropdown-item" data-id="${item.id || ''}" data-nombre="${item.nombre}">
                            <div class="item-main">
                                <span class="item-title">${item.nombre} ${item.id ? `(${item.id})` : ''}</span>
                                <span class="item-sub">${type === 'Productos' ? `Cód: ${item.código} | Cat: ${item.categoría}` : `Tel: ${item.telefono || 'N/A'}`}</span>
                            </div>
                            ${type === 'Productos' ? `<span class="item-badge" style="background:${item.stock < 5 ? '#ff4d4d' : '#2ec4b6'}; color:white">Stock: ${item.stock}</span>` : ''}
                        </div>
                    `).join('');
                    dropdownEl.style.display = 'block';

                    dropdownEl.querySelectorAll('.dropdown-item').forEach(el => {
                        el.addEventListener('click', () => {
                            const itemName = el.getAttribute('data-nombre');
                            inputEl.value = itemName;
                            dropdownEl.style.display = 'none';

                            if (onSelect) {
                                const selectedItem = results.find(r => r.nombre === itemName);
                                onSelect(selectedItem);
                            }
                        });
                    });
                } else {
                    dropdownEl.style.display = 'none';
                }
            }
        } catch (err) {
            console.error("Search error:", err);
        }
    });

    // Close on click outside
    // Close on click outside
    document.addEventListener('click', (e) => {
        if (dropdownEl && !inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
            dropdownEl.style.display = 'none';
        }
    });
}

async function resetOrder(prefix) {
    currentOrders[prefix] = [];
    const idEl = document.getElementById(`${prefix}_order_id`);

    // Placeholder while fetching
    idEl.innerText = '...';

    try {
        const type = prefix === 'co' ? 'Compras' : 'Ventas';
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'getNextOrderId', type: type })
        });
        const data = await response.json();

        if (data.status === 'success') {
            idEl.innerText = data.nextId;
        } else {
            idEl.innerText = (prefix === 'co' ? 'P-' : 'V-') + Math.floor(Math.random() * 90000 + 10000); // Fallback
            console.warn('Fallback ID random:', data.message);
        }
    } catch (e) {
        console.error('Error fetching ID:', e);
        idEl.innerText = (prefix === 'co' ? 'P-' : 'V-') + Math.floor(Math.random() * 90000 + 10000); // Fallback
    }

    document.getElementById(`${prefix}_items_body`).innerHTML = '';
    calculateOrderTotals(prefix);
    // Add one empty line by default
    addOrderLine(prefix);
}

function addOrderLine(prefix) {
    const tbody = document.getElementById(`${prefix}_items_body`);
    const rowIndex = tbody.children.length;
    const row = document.createElement('tr');
    row.innerHTML = `
        <td>
            <select class="item-product" style="width:100%;">
                <option value="">Seleccionar Producto...</option>
                ${cachedData.productos.map(p => `<option value="${p.id}">${p.nombre} (Cód: ${p.código})</option>`).join('')}
            </select>
            <input type="hidden" class="item-id">
        </td>
        <td><input type="number" class="item-qty" value="1" min="1" style="width:70px;"></td>
        <td><input type="number" class="item-price" step="0.01" style="width:110px;"></td>
        <td class="item-subtotal">$0</td>
        <td><i class="fas fa-trash remove-line" style="cursor:pointer; color:var(--danger-color);"></i></td>
    `;

    tbody.appendChild(row);

    const productSelect = row.querySelector('.item-product');
    const qtyInput = row.querySelector('.item-qty');
    const priceInput = row.querySelector('.item-price');
    const removeBtn = row.querySelector('.remove-line');

    productSelect.addEventListener('change', (e) => {
        const id = e.target.value;
        const idInput = row.querySelector('.item-id');
        idInput.value = id;

        const product = productDataCache[id];
        if (product) {
            priceInput.value = prefix === 'co' ? product.precio_compra : product.precio_venta;
            calculateOrderTotals(prefix);
        }
    });

    qtyInput.addEventListener('input', () => calculateOrderTotals(prefix));
    priceInput.addEventListener('input', () => calculateOrderTotals(prefix));
    removeBtn.addEventListener('click', () => {
        row.remove();
        calculateOrderTotals(prefix);
    });
}


function calculateOrderTotals(prefix) {
    const tbody = document.getElementById(`${prefix}_items_body`);
    let subtotalGeneral = 0;

    Array.from(tbody.rows).forEach(row => {
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const subtotalLine = qty * price;

        row.querySelector('.item-subtotal').innerText = formatCOP(subtotalLine);
        subtotalGeneral += subtotalLine;
    });

    const applyIva = document.getElementById(`${prefix}_apply_iva`).checked;
    const iva = applyIva ? subtotalGeneral * 0.19 : 0;
    const total = subtotalGeneral + iva;

    document.getElementById(`${prefix}_base_imponible`).innerText = formatCOP(subtotalGeneral);
    document.getElementById(`${prefix}_iva`).innerText = formatCOP(iva);
    document.getElementById(`${prefix}_total`).innerText = formatCOP(total);
}

async function submitBatchOrder(prefix) {
    const statusDivId = prefix === 'co' ? 'statusCompra' : 'statusVenta';
    const contact = document.getElementById(`${prefix}_${prefix === 'co' ? 'proveedor' : 'cliente'}`).value;
    const fecha = document.getElementById(`${prefix}_fecha`).value;
    const orderId = document.getElementById(`${prefix}_order_id`).innerText;

    const items = [];
    const rows = document.getElementById(`${prefix}_items_body`).rows;

    for (let row of rows) {
        const pId = row.querySelector('.item-id').value;
        const qty = row.querySelector('.item-qty').value;
        const price = row.querySelector('.item-price').value;
        if (pId && qty > 0) {
            items.push({ producto_id: pId, cantidad: qty, precio: price });
        }
    }

    if (items.length === 0) {
        showToast("Debe agregar al menos un producto.", "error");
        return;
    }

    const submitBtn = document.getElementById(`${prefix}_submit_btn`);
    submitBtn.disabled = true;
    displayStatus(statusDivId, 'info', "Procesando pedido...");

    const batchData = {
        action: 'registrarTransaccionBatch',
        type: prefix === 'co' ? 'compra' : 'venta',
        fecha: fecha,
        extra_data: contact,
        order_id: orderId,
        items: items
    };

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(batchData),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const data = await response.json();

        if (data.status === 'success') {
            showToast(data.message, 'success');
            resetOrder(prefix);
            document.getElementById(`${prefix}_${prefix === 'co' ? 'proveedor' : 'cliente'}`).value = '';
        } else {
            displayStatus(statusDivId, 'error', data.message);
        }
    } catch (e) {
        displayStatus(statusDivId, 'error', "Error de conexión.");
    } finally {
        submitBtn.disabled = false;
    }
}

function handleDatalistSelect(val, prefix) {
    if (!val.includes('|')) return;
    const id = val.split('|')[0].trim();
    handleQueryFilter(id, prefix);
}

function filterTable(tableId, query) {
    const table = document.getElementById(tableId);
    if (!table) return;
    const rows = table.querySelectorAll('tbody tr');
    const lowerQuery = query.toLowerCase();

    rows.forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(lowerQuery) ? '' : 'none';
    });
}

// ================= DASHBOARD FUNCTIONS =================

async function handleLoadDashboard() {
    await calcularResumenFinanciero();
    await cargarDatosGraficos();
}

async function calcularResumenFinanciero() {
    displayStatus('statusDashboard', 'info', 'Calculando resumen financiero...');

    try {
        // Obtener datos de ventas y compras
        const [ventasResponse, comprasResponse] = await Promise.all([
            fetch(`${SCRIPT_URL}?action=getData&sheetName=Ventas`),
            fetch(`${SCRIPT_URL}?action=getData&sheetName=Compras`)
        ]);

        const ventasData = await ventasResponse.json();
        const comprasData = await comprasResponse.json();

        let totalVentas = 0;
        let totalCompras = 0;

        // Calcular total de ventas
        if (ventasData.status === 'success' && ventasData.data) {
            totalVentas = ventasData.data.reduce((sum, venta) => {
                return sum + (parseFloat(venta.cantidad) * parseFloat(venta.precio_venta));
            }, 0);
        }

        // Calcular total de compras
        if (comprasData.status === 'success' && comprasData.data) {
            totalCompras = comprasData.data.reduce((sum, compra) => {
                return sum + (parseFloat(compra.cantidad) * parseFloat(compra.precio_compra));
            }, 0);
        }

        const ganancias = totalVentas - totalCompras;

        // Actualizar estadísticas
        document.getElementById('totalVentas').textContent = formatCOP(totalVentas);
        document.getElementById('totalCompras').textContent = formatCOP(totalCompras);
        document.getElementById('totalGanancias').textContent = formatCOP(ganancias);
        document.getElementById('totalGastos').textContent = formatCOP(totalCompras);

        // Colores según ganancias
        const gananciasElement = document.getElementById('totalGanancias');
        if (ganancias > 0) {
            gananciasElement.style.color = 'var(--secondary-color)';
        } else if (ganancias < 0) {
            gananciasElement.style.color = 'var(--danger-color)';
        } else {
            gananciasElement.style.color = '#666';
        }

        displayStatus('statusDashboard', 'success', `Resumen calculado: Ventas: $${totalVentas.toFixed(2)} | Compras: $${totalCompras.toFixed(2)} | Ganancia: $${ganancias.toFixed(2)}`);

        return { totalVentas, totalCompras, ganancias };

    } catch (error) {
        displayStatus('statusDashboard', 'error', `Error al calcular resumen: ${error.message}`);
        return { totalVentas: 0, totalCompras: 0, ganancias: 0 };
    }
}

async function cargarDatosGraficos() {
    try {
        // Obtener datos para gráficos
        const resumenResponse = await fetch(`${SCRIPT_URL}?action=getResumenDiario`);
        const resumenData = await resumenResponse.json();

        if (resumenData.status === 'success' && resumenData.data && resumenData.data.length > 0) {
            renderCharts(resumenData.data);
        } else {
            // Si no hay datos en resumen_diario, usar datos de ventas/compras
            await renderChartsFromRawData();
        }

    } catch (error) {
        displayStatus('statusDashboard', 'error', `Error al cargar gráficos: ${error.message}`);
    }
}

async function renderChartsFromRawData() {
    try {
        const [ventasResponse, comprasResponse] = await Promise.all([
            fetch(`${SCRIPT_URL}?action=getData&sheetName=Ventas`),
            fetch(`${SCRIPT_URL}?action=getData&sheetName=Compras`)
        ]);

        const ventasData = await ventasResponse.json();
        const comprasData = await comprasResponse.json();

        // Agrupar por fecha
        const ventasPorFecha = {};
        const comprasPorFecha = {};

        if (ventasData.status === 'success' && ventasData.data) {
            ventasData.data.forEach(venta => {
                const fecha = new Date(venta.fecha).toLocaleDateString();
                const monto = parseFloat(venta.cantidad) * parseFloat(venta.precio_venta);
                ventasPorFecha[fecha] = (ventasPorFecha[fecha] || 0) + monto;
            });
        }

        if (comprasData.status === 'success' && comprasData.data) {
            comprasData.data.forEach(compra => {
                const fecha = new Date(compra.fecha).toLocaleDateString();
                const monto = parseFloat(compra.cantidad) * parseFloat(compra.precio_compra);
                comprasPorFecha[fecha] = (comprasPorFecha[fecha] || 0) + monto;
            });
        }

        // Combinar fechas
        const todasFechas = [...new Set([...Object.keys(ventasPorFecha), ...Object.keys(comprasPorFecha)])];
        todasFechas.sort((a, b) => new Date(a) - new Date(b));

        const datosResumen = todasFechas.map(fecha => ({
            fecha: fecha,
            total_ventas: ventasPorFecha[fecha] || 0,
            total_compras: comprasPorFecha[fecha] || 0,
            ganancia: (ventasPorFecha[fecha] || 0) - (comprasPorFecha[fecha] || 0)
        }));

        renderCharts(datosResumen);

    } catch (error) {
        console.error('Error al procesar datos para gráficos:', error);
        displayStatus('statusDashboard', 'warning', 'No hay datos suficientes para generar gráficos.');
    }
}

function renderCharts(resumenData) {
    const labels = resumenData.map(row => {
        if (row.fecha instanceof Date) {
            return row.fecha.toLocaleDateString();
        }
        return row.fecha;
    });

    const ventas = resumenData.map(row => row.total_ventas || 0);
    const compras = resumenData.map(row => row.total_compras || 0);
    const ganancias = resumenData.map(row => row.ganancia || 0);

    // 1. Gráfico de Resumen Financiero
    const ctx1 = document.getElementById('resumenFinancieroChart').getContext('2d');
    if (resumenFinancieroChart) resumenFinancieroChart.destroy();
    resumenFinancieroChart = new Chart(ctx1, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ventas',
                    data: ventas,
                    backgroundColor: 'rgba(0, 123, 255, 0.7)',
                    borderColor: 'rgba(0, 123, 255, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Compras',
                    data: compras,
                    backgroundColor: 'rgba(23, 162, 184, 0.7)',
                    borderColor: 'rgba(23, 162, 184, 1)',
                    borderWidth: 1
                },
                {
                    label: 'Ganancias',
                    data: ganancias,
                    type: 'line',
                    fill: false,
                    backgroundColor: 'rgba(40, 167, 69, 0.7)',
                    borderColor: 'rgba(40, 167, 69, 1)',
                    borderWidth: 2,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Resumen Financiero - Ventas, Compras y Ganancias'
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Monto ($)'
                    }
                }
            }
        }
    });

    // 2. Gráfico de Tendencias
    const ctx2 = document.getElementById('tendenciasChart').getContext('2d');
    if (tendenciasChart) tendenciasChart.destroy();
    tendenciasChart = new Chart(ctx2, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Ventas Acumuladas',
                    data: ventas.reduce((acc, curr, i) => [...acc, (acc[i - 1] || 0) + curr], []),
                    borderColor: 'rgba(0, 123, 255, 1)',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    tension: 0.1,
                    fill: true
                },
                {
                    label: 'Compras Acumuladas',
                    data: compras.reduce((acc, curr, i) => [...acc, (acc[i - 1] || 0) + curr], []),
                    borderColor: 'rgba(23, 162, 184, 1)',
                    backgroundColor: 'rgba(23, 162, 184, 0.1)',
                    tension: 0.1,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Tendencias Acumuladas - Ventas vs Compras'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Monto Acumulado ($)'
                    }
                }
            }
        }
    });
}

// ================= REST OF THE FUNCTIONS (sin cambios) =================

async function handlePostAction(e, action, statusDivId) {
    e.preventDefault();
    const form = e.target;
    const submitBtn = e.submitter;
    submitBtn.disabled = true;
    displayStatus(statusDivId, 'info', `Procesando...`);

    const data = {};
    Array.from(form.elements).forEach(input => {
        if (input.id && input.id.startsWith('p_') || input.id.startsWith('c_')) {
            data[input.id.replace(/p_|c_/, '')] = input.value;
        }
    });
    data.action = action;

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(data),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const responseData = await response.json();

        if (responseData.status === 'success') {
            displayStatus(statusDivId, 'success', responseData.message);
            form.reset();
            if (action === 'agregarCategoria') {
                loadInitialData();
            }
        } else {
            displayStatus(statusDivId, 'error', responseData.message);
        }
    } catch (error) {
        displayStatus(statusDivId, 'error', `Error de conexión: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
    }
}

async function handleQueryFilter(query, prefix) {
    const detailDiv = document.getElementById(`${prefix}_product_details`);
    const submitBtn = document.getElementById(`${prefix}_submit_btn`);
    const idInput = document.getElementById(`${prefix}_producto_id`);

    detailDiv.classList.add('hidden');
    detailDiv.innerHTML = '';
    idInput.value = '';
    submitBtn.disabled = true;

    if (query.length < 2) return;

    try {
        const response = await fetch(`${SCRIPT_URL}?action=buscarProducto&query=${encodeURIComponent(query)}`);
        const data = await response.json();

        if (data.status === 'success' && data.data && data.data.length > 0) {
            const product = data.data[0];
            productDataCache[product.id] = product;
            updateProductDetails(product, detailDiv, prefix);
            idInput.value = product.id;
            submitBtn.disabled = false;
        } else {
            detailDiv.classList.remove('hidden');
            detailDiv.innerHTML = `<p style="color:var(--danger-color);"><i class="fas fa-exclamation-triangle"></i> ${data.message || 'No se encontraron productos.'}</p>`;
        }

    } catch (error) {
        detailDiv.classList.remove('hidden');
        detailDiv.innerHTML = `<p style="color:var(--danger-color);">Error de búsqueda: ${error.message}</p>`;
    }
}

function updateProductDetails(product, detailDiv, prefix) {
    detailDiv.classList.remove('hidden');

    const isCompra = prefix === 'co';
    const price = isCompra ? product.precio_compra : product.precio_venta;
    const priceLabel = isCompra ? 'Precio Compra Actual' : 'Precio Venta Actual';

    const stockStyle = product.stock < 5 ? 'style="font-weight:bold; color:var(--danger-color);"' : 'style="font-weight:bold; color:var(--secondary-color);"';

    detailDiv.innerHTML = `
                <p><b>ID:</b> ${product.id} | <b>Producto:</b> ${product.nombre} (Cód: ${product.código})</p>
                <p><b>Categoría:</b> ${product.categoría}</p>
                <p><b>Stock Actual:</b> <span ${stockStyle}>${product.stock}</span></p>
                <p><b>${priceLabel}:</b> ${formatCOP(price)}</p>
            `;

    document.getElementById(`${prefix}_precio_${isCompra ? 'compra' : 'venta'}`).value = parseFloat(price).toFixed(2);

    if (!isCompra && product.stock < 5) {
        detailDiv.innerHTML += `<p class="status-message warning" style="display:block; margin-top: 10px;">Stock bajo. Solo quedan ${product.stock} unidades.</p>`;
    }
}

async function handleTransactionPost(e, type) {
    e.preventDefault();
    const form = e.target;
    const prefix = type === 'compra' ? 'co' : 'v';
    const statusDivId = type === 'compra' ? 'statusCompra' : 'statusVenta';

    const submitBtn = document.getElementById(`${prefix}_submit_btn`);
    submitBtn.disabled = true;
    displayStatus(statusDivId, 'info', `Registrando ${type}...`);

    const productoId = document.getElementById(`${prefix}_producto_id`).value;

    if (!productoId) {
        displayStatus(statusDivId, 'error', `No hay producto seleccionado. Busque y seleccione uno.`);
        submitBtn.disabled = false;
        return;
    }

    const transaccionData = {
        action: 'registrarTransaccion',
        producto_id: productoId,
        fecha: document.getElementById(`${prefix}_fecha`).value,
        cantidad: document.getElementById(`${prefix}_cantidad`).value,
        precio: document.getElementById(`${prefix}_precio_${type === 'compra' ? 'compra' : 'venta'}`).value,
        type: type,
        extra_data: document.getElementById(`${prefix}_${type === 'compra' ? 'proveedor' : 'cliente'}`).value,
    };

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify(transaccionData),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const data = await response.json();

        if (data.status === 'success') {
            displayStatus(statusDivId, 'success', data.message);
            form.reset();
            delete productDataCache[productoId];
            document.getElementById(`${prefix}_product_details`).classList.add('hidden');
        } else {
            displayStatus(statusDivId, 'error', data.message);
        }
    } catch (error) {
        displayStatus(statusDivId, 'error', `Error de conexión: ${error.message}`);
    } finally {
        submitBtn.disabled = false;
    }
}

async function loadInventario() {
    displayStatus('statusInventario', 'info', 'Cargando datos de inventario...');
    const tableBody = document.getElementById('inventarioTableBody');
    if (tableBody) tableBody.innerHTML = '<tr><td colspan="6">Cargando...</td></tr>';

    try {
        const response = await fetch(`${SCRIPT_URL}?action=getInventario`);
        const data = await response.json();

        if (data.status === 'success' && data.data) {
            cachedData.productos = data.data;
            productDataCache = {};
            data.data.forEach(p => productDataCache[p.id] = p);

            renderInventarioTable(data.data);
            displayStatus('statusInventario', 'success', `Inventario cargado: ${data.data.length} productos.`);
        } else {
            displayStatus('statusInventario', 'warning', data.message || "No hay datos.");
            if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">No hay productos en inventario.</td></tr>';
        }
    } catch (error) {
        displayStatus('statusInventario', 'error', `Error al cargar inventario: ${error.message}`);
        if (tableBody) tableBody.innerHTML = '<tr><td colspan="7">Error al cargar datos.</td></tr>';
    }
}

function renderInventarioTable(productos) {
    const tableBody = document.getElementById('inventarioTableBody');
    if (!tableBody) return;

    tableBody.innerHTML = productos.map(p => {
        const tipo = p.tipo || "Inventariable";
        const stockDisplay = tipo === "Servicio" ? "N/A" : p.stock;
        const stockStyle = (tipo === "Inventariable" && p.stock < 5) ? 'style="color: var(--danger-color); font-weight: bold;"' : '';

        return `
            <tr>
                <td>${p.id}</td>
                <td>${p.nombre}</td>
                <td>${p.código}</td>
                <td>${p.categoría}</td>
                <td><span style="padding: 4px 8px; border-radius: 6px; font-size: 0.85em; background: ${tipo === 'Servicio' ? '#e3f2fd' : '#f1f8e9'}; color: ${tipo === 'Servicio' ? '#1976d2' : '#558b2f'};">${tipo}</span></td>
                <td ${stockStyle}>${stockDisplay}</td>
                <td>${formatCOP(p.precio_venta)}</td>
            </tr>
        `;
    }).join('');
}

async function loadSummary(type) {
    const sheetName = type === 'Ventas' ? 'Ventas' : 'Compras';
    displayStatus('statusResumen', 'info', `Cargando resumen de ${sheetName}...`);
    const table = document.getElementById('resumenTable');
    const tableHead = table.querySelector('thead');
    const tableBody = document.getElementById('resumenTableBody');
    table.classList.add('hidden');
    tableBody.innerHTML = '';

    try {
        const response = await fetch(`${SCRIPT_URL}?action=getData&sheetName=${sheetName}`);
        const data = await response.json();

        if (data.status === 'success' && data.data.length > 0) {
            showToast(`${data.data.length} ${sheetName} cargadas`, 'success');
            table.classList.remove('hidden');
            const searchBox = document.getElementById('searchResumenBox');
            if (searchBox) searchBox.classList.remove('hidden');

            const colKeys = Object.keys(data.data[0]);
            const headers = colKeys.map(h => `<th>${h.toUpperCase().replace('_', ' ')}</th>`).join('');
            tableHead.innerHTML = `<tr>${headers}</tr>`;

            tableBody.innerHTML = data.data.map(row => {
                const cells = colKeys.map(key => {
                    let value = row[key];
                    if (key === 'producto_id') {
                        const prod = productDataCache[value];
                        // Si existe el producto mostramos el nombre, si no, dejamos el ID
                        value = prod ? prod.nombre : value;
                    }

                    if (value instanceof Date) {
                        value = value.toLocaleDateString();
                    } else if (typeof value === 'number' && (key.toLowerCase().includes('precio') || key.toLowerCase().includes('total') || key.toLowerCase().includes('subtotal') || key.toLowerCase().includes('iva'))) {
                        value = formatCOP(value);
                    }
                    return `<td>${value}</td>`;
                }).join('');
                return `<tr>${cells}</tr>`;
            }).join('');

        } else {
            displayStatus('statusResumen', 'warning', `No hay datos en la pestaña ${sheetName}.`);
        }
    } catch (error) {
        displayStatus('statusResumen', 'error', `Error al cargar resumen: ${error.message}`);
    }
}

async function handleConfigAction(action) {
    const statusConfig = document.getElementById('statusConfig');
    setButtonState(true);
    displayStatus('statusConfig', 'info', `Procesando la acción de ${action}...`);

    try {
        const response = await fetch(`${SCRIPT_URL}?action=${action}`);
        const data = await response.json();

        if (data.status === 'success') {
            displayStatus('statusConfig', 'success', data.message);
            loadInitialData();
        } else {
            displayStatus('statusConfig', 'error', data.message);
        }
    } catch (error) {
        displayStatus('statusConfig', 'error', `Error de conexión: ${error.message}.`);
    } finally {
        setButtonState(false);
    }
}

function setButtonState(disabled) {
    document.getElementById('iniciarDBBtn').disabled = disabled;
    document.getElementById('resetDBBtn').disabled = disabled;
}

function displayStatus(elementId, type, message) {
    const el = document.getElementById(elementId);
    el.style.display = 'block';
    el.className = `status-message ${type}`;
    el.innerHTML = `<i class="fas fa-${type === 'success' ? 'check' : type === 'error' ? 'times' : type === 'warning' ? 'exclamation-triangle' : 'info'}-circle"></i> ${message}`;
}

// ================= EXPORT FUNCTIONS =================

function exportTableToExcel(tableId, fileName) {
    const table = document.getElementById(tableId);
    if (!table) {
        showToast("Tabla no encontrada para exportar", "error");
        return;
    }
    const wb = XLSX.utils.table_to_book(table, { sheet: "Sheet1" });
    const fullFileName = `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fullFileName);
    showToast(`Archivo generado: ${fullFileName}`, "success");
}

function exportDataToExcel(data, fileName, sheetName = "Sheet1") {
    if (!data || data.length === 0) {
        showToast("No hay datos para exportar", "error");
        return;
    }
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const fullFileName = `${fileName}_${new Date().toISOString().split('T')[0]}.xlsx`;
    XLSX.writeFile(wb, fullFileName);
    showToast(`Archivo generado: ${fullFileName}`, "success");
}