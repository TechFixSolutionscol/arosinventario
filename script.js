
const SCRIPT_URL = APP_CONFIG.SCRIPT_URL;
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
    setupPipelineFilters();
    setupChatterEvents();
    // Cargar listas de compras y ventas en paralelo
    loadOrdersByType('compra');
    loadOrdersByType('venta');
});



function setupNavigation() {
    const navLinks = document.querySelectorAll('.sidebar-nav a');
    const sections = document.querySelectorAll('.main-content .content-section');
    const breadcrumb = document.getElementById('breadcrumbCurrent');

    // Mapa de labels para breadcrumb
    const sectionLabels = {
        dashboard: 'Dashboard', inventario: 'Inventario', productos: 'Registrar Producto',
        categorias: 'Categorías', compras: 'Compras', ventas: 'Ventas',
        pedidos: 'Historial de Pedidos', resumenes: 'Resúmenes',
        contactos: 'Contactos', usuarios: 'Usuarios', configuracion: 'Configuración'
    };

    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetId = link.getAttribute('data-section');

            navLinks.forEach(l => l.classList.remove('active'));
            link.classList.add('active');

            if (breadcrumb) breadcrumb.textContent = sectionLabels[targetId] || targetId;

            sections.forEach(section => {
                if (section.id === targetId) {
                    section.classList.add('active');
                    if (targetId === 'dashboard') handleLoadDashboard();
                    else if (targetId === 'inventario') { const btn = document.getElementById('cargarInventarioBtn'); if (btn) btn.click(); }
                    else if (targetId === 'pedidos') loadPedidos();
                    else if (targetId === 'compras') loadOrdersByType('compra');
                    else if (targetId === 'ventas') loadOrdersByType('venta');
                } else {
                    section.classList.remove('active');
                }
            });
        });
    });

    // ---- SIDEBAR COLAPSABLE ----
    const sidebar = document.getElementById('mainSidebar');
    const topbar = document.getElementById('mainTopbar');
    const mainContent = document.querySelector('.main-content');
    const toggleBtn = document.getElementById('sidebarToggleBtn');

    const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
    if (isCollapsed) {
        sidebar?.classList.add('collapsed');
        topbar?.classList.add('sidebar-collapsed');
        mainContent?.classList.add('sidebar-collapsed');
    }

    toggleBtn?.addEventListener('click', () => {
        const collapsed = sidebar.classList.toggle('collapsed');
        topbar?.classList.toggle('sidebar-collapsed', collapsed);
        mainContent?.classList.toggle('sidebar-collapsed', collapsed);
        localStorage.setItem('sidebar_collapsed', collapsed);
    });

    // ---- DARK MODE ----
    const darkBtn = document.getElementById('darkModeBtn');
    const isDark = localStorage.getItem('dark_mode') === 'true';
    if (isDark) {
        document.body.classList.add('dark-mode');
        if (darkBtn) darkBtn.innerHTML = '<i class="fas fa-sun"></i>';
    }
    darkBtn?.addEventListener('click', () => {
        const dark = document.body.classList.toggle('dark-mode');
        darkBtn.innerHTML = dark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        localStorage.setItem('dark_mode', dark);
    });

    // ---- USUARIO EN TOPBAR ----
    try {
        const u = window.InvAuth?.currentUser?.();
        if (u) {
            const label = document.getElementById('currentUserLabel');
            const avatar = document.getElementById('userAvatarInitials');
            const name = u.usuario || u.nombre || 'U';
            if (label) label.textContent = name;
            if (avatar) avatar.textContent = name.charAt(0).toUpperCase();
        }
    } catch (e) { }
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
    const tbodyId = type === 'Proveedores' ? 'tablaProveedores' : 'tablaClientes';
    const selectId = type === 'Proveedores' ? 'co_proveedor' : 'v_cliente';
    const tbodyEl = document.getElementById(tbodyId);
    const selectEl = document.getElementById(selectId);

    try {
        const response = await fetch(`${SCRIPT_URL}?action=getData&sheetName=${type}`);
        const data = await response.json();

        if (data.status === 'success') {
            const contacts = data.data;
            if (type === 'Proveedores') cachedData.proveedores = contacts;
            else cachedData.clientes = contacts;

            if (tbodyEl) { // Actually kanban container
                if (contacts.length === 0) {
                    tbodyEl.innerHTML = `<div style="padding:20px; color:#666;">No hay ${type.toLowerCase()}.</div>`;
                } else {
                    tbodyEl.innerHTML = contacts.map(c => {
                        const safeName = String(c.nombre || '').replace(/'/g, "\\'");
                        const safePhone = String(c.telefono || '').replace(/'/g, "\\'");
                        const safeEmail = String(c.email || '').replace(/'/g, "\\'");
                        const safeDir = String(c.direccion || '').replace(/'/g, "\\'");
                        const safeTipo = String(c.tipo_contacto || '').replace(/'/g, "\\'");
                        const safeIdent = String(c.identificacion || '').replace(/'/g, "\\'");

                        // Generar color basado en la primera letra
                        const primeraLetra = (c.nombre || 'A').charAt(0).toUpperCase();
                        const colors = ['#3498db', '#e74c3c', '#2ecc71', '#f39c12', '#9b59b6', '#1abc9c', '#34495e', '#d35400', '#c0392b'];
                        const charCode = primeraLetra.charCodeAt(0);
                        const bgColor = colors[charCode % colors.length];

                        return `
                        <div class="kanban-card">
                            <div class="kanban-avatar" style="background-color: ${bgColor};">
                                ${primeraLetra}
                            </div>
                            <div class="kanban-details">
                                <strong>${c.nombre || '(Sin Nombre)'}</strong>
                                <div class="k-info" title="Tipo"><i class="fas ${c.tipo_contacto === 'Empresa' ? 'fa-building' : 'fa-user'}"></i> ${c.tipo_contacto || 'Persona'}</div>
                                <div class="k-info" title="NIT/C.C."><i class="fas fa-id-card"></i> ${c.identificacion || 'N/A'}</div>
                                <div class="k-info" title="Email"><i class="fas fa-envelope"></i> ${c.email || 'N/A'}</div>
                                <div class="k-info" title="Teléfono"><i class="fas fa-phone"></i> ${c.telefono || 'N/A'}</div>
                                <div class="k-info" title="Dirección"><i class="fas fa-map-marker-alt"></i> ${c.direccion || 'N/A'}</div>
                            </div>
                            <div class="kanban-actions">
                                <button class="btn-icon" title="Editar" onclick="openEditContactModal('${c.id}', '${type}', '${safeName}', '${safePhone}', '${safeEmail}', '${safeDir}', '${safeTipo}', '${safeIdent}')"><i class="fas fa-pen"></i></button>
                                <button class="btn-icon danger" title="Eliminar" onclick="deleteContactConfirm('${c.id}', '${type}', '${safeName}')"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>`;
                    }).join('');
                }
            }

            if (selectEl) {
                selectEl.innerHTML = '<option value="">Seleccionar</option>' +
                    contacts.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
            }
        }
    } catch (e) {
        console.error(`Error cargando ${type}:`, e);
    }
}

// ========== CRUD CONTACTOS ==========

function openEditContactModal(id, sheetName, nombre, telefono, email, direccion, tipo_contacto, identificacion) {
    document.getElementById('modal_contact_id').value = id;
    document.getElementById('modal_contact_sheet').value = sheetName;

    // Set radios for 'tipo_contacto'
    const radios = document.getElementsByName('modal_contact_tipo');
    const checkedValue = tipo_contacto || 'Persona';
    for (let r of radios) { r.checked = (r.value === checkedValue); }

    document.getElementById('modal_contact_identificacion').value = identificacion || '';
    document.getElementById('modal_contact_nombre').value = nombre || '';
    document.getElementById('modal_contact_email').value = email || '';
    document.getElementById('modal_contact_telefono').value = telefono || '';
    document.getElementById('modal_contact_direccion').value = direccion || '';

    document.getElementById('modal_contact_title').textContent = 'Editar ' + (sheetName === 'Proveedores' ? 'Proveedor' : 'Cliente');
    document.getElementById('modal_contact_status').style.display = 'none';
    openModal('modalEditContact');

    document.getElementById('modal_contact_save').onclick = async () => {
        let selectedTipo = '';
        for (let r of document.getElementsByName('modal_contact_tipo')) {
            if (r.checked) selectedTipo = r.value;
        }

        const nuevoTipo = selectedTipo;
        const nuevaIdent = document.getElementById('modal_contact_identificacion').value.trim();
        const nuevoNombre = document.getElementById('modal_contact_nombre').value.trim();
        const nuevoEmail = document.getElementById('modal_contact_email').value.trim();
        const nuevoTelefono = document.getElementById('modal_contact_telefono').value.trim();
        const nuevaDir = document.getElementById('modal_contact_direccion').value.trim();
        const statusEl = document.getElementById('modal_contact_status');

        if (!nuevoNombre) {
            statusEl.style.display = 'block';
            statusEl.className = 'status-message error';
            statusEl.innerHTML = '<i class="fas fa-times-circle"></i> El nombre no puede estar vacío.';
            return;
        }

        try {
            const payload = {
                action: 'editarContacto',
                sheetName,
                id,
                tipo_contacto: nuevoTipo,
                identificacion: nuevaIdent,
                nombre: nuevoNombre,
                email: nuevoEmail,
                telefono: nuevoTelefono,
                direccion: nuevaDir
            };
            const res = await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.status === 'success') {
                showToast(data.message, 'success');
                closeModal('modalEditContact');
                loadContactos(sheetName);
            } else {
                statusEl.style.display = 'block';
                statusEl.className = 'status-message error';
                statusEl.innerHTML = `<i class="fas fa-times-circle"></i> ${data.message}`;
            }
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
    };
}

async function deleteContactConfirm(id, sheetName, nombre) {
    const tipo = sheetName === 'Proveedores' ? 'proveedor' : 'cliente';
    if (!confirm(`¿Eliminar el ${tipo} "${nombre}"?`)) return;

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'eliminarContacto', sheetName, id })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(data.message, 'success');
            loadContactos(sheetName);
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
}

async function handleContactPost(e, action) {
    e.preventDefault();
    const form = e.target;
    const type = action.includes('Proveedor') ? 'Proveedores' : 'Clientes';
    const prefix = action.includes('Proveedor') ? 'pr' : 'cl';

    let selectedTipo = '';
    for (let r of document.getElementsByName(`c_tipo_${prefix}`)) {
        if (r.checked) selectedTipo = r.value;
    }

    const contactData = {
        action: 'agregarRegistroGenerico',
        sheetName: type,
        data: {
            id: generateId(),
            tipo_contacto: selectedTipo,
            identificacion: document.getElementById(`c_identificacion_${prefix}`).value,
            nombre: document.getElementById(`c_nombre_${prefix}`).value,
            email: document.getElementById(`c_email_${prefix}`).value,
            telefono: document.getElementById(`c_telefono_${prefix}`).value,
            direccion: document.getElementById(`c_direccion_${prefix}`).value
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

    const tbody = document.getElementById('categoriasTableBody');
    if (!tbody) return;

    if (categories.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3">No hay categorías registradas.</td></tr>';
        return;
    }

    tbody.innerHTML = categories.map(cat => {
        const name = cat.nombre || `(Sin nombre)`;
        return `<tr>
            <td><small style="color:#888;">${cat.id}</small></td>
            <td>${name}</td>
            <td>
                <button class="btn-icon" title="Editar" onclick="openEditCategoryModal('${cat.id}', '${name.replace(/'/g, "\\'")}')"><i class="fas fa-pen"></i></button>
                <button class="btn-icon danger" title="Eliminar" onclick="deleteCategoryConfirm('${cat.id}', '${name.replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>`;
    }).join('');
}

// ========== CRUD CATEGORÍAS ==========

function openEditCategoryModal(id, nombre) {
    document.getElementById('modal_cat_id').value = id;
    document.getElementById('modal_cat_nombre').value = nombre;
    document.getElementById('modal_cat_status').style.display = 'none';
    openModal('modalEditCategory');

    document.getElementById('modal_cat_save').onclick = async () => {
        const nuevoNombre = document.getElementById('modal_cat_nombre').value.trim();
        const statusEl = document.getElementById('modal_cat_status');
        if (!nuevoNombre) {
            statusEl.style.display = 'block';
            statusEl.className = 'status-message error';
            statusEl.innerHTML = '<i class="fas fa-times-circle"></i> El nombre no puede estar vacío.';
            return;
        }
        try {
            const res = await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'editarCategoria', id, nombre: nuevoNombre })
            });
            const data = await res.json();
            if (data.status === 'success') {
                showToast(data.message, 'success');
                closeModal('modalEditCategory');
                loadInitialData();
            } else {
                statusEl.style.display = 'block';
                statusEl.className = 'status-message error';
                statusEl.innerHTML = `<i class="fas fa-times-circle"></i> ${data.message}`;
            }
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        }
    };
}

async function deleteCategoryConfirm(id, nombre) {
    if (!confirm(`¿Eliminar la categoría "${nombre}"?\n\nSi tiene productos asociados, no se podrá eliminar.`)) return;

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'eliminarCategoria', id })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(data.message, 'success');
            loadInitialData();
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) {
        showToast('Error: ' + e.message, 'error');
    }
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

    // Order Actions (legacy form — ahora en modales, verificar existencia)
    const coAddLine = document.getElementById('co_add_line');
    if (coAddLine) coAddLine.addEventListener('click', () => addOrderLine('co'));
    const vAddLine = document.getElementById('v_add_line');
    if (vAddLine) vAddLine.addEventListener('click', () => addOrderLine('v'));
    const coDraftBtn = document.getElementById('co_draft_btn');
    if (coDraftBtn) coDraftBtn.addEventListener('click', () => submitPedido('co', 'borrador'));
    const coSubmitBtn = document.getElementById('co_submit_btn');
    if (coSubmitBtn) coSubmitBtn.addEventListener('click', () => submitPedido('co', 'confirmar'));
    const vDraftBtn = document.getElementById('v_draft_btn');
    if (vDraftBtn) vDraftBtn.addEventListener('click', () => submitPedido('v', 'borrador'));
    const vSubmitBtn = document.getElementById('v_submit_btn');
    if (vSubmitBtn) vSubmitBtn.addEventListener('click', () => submitPedido('v', 'confirmar'));

    const coDesc = document.getElementById('co_descuento');
    if (coDesc) coDesc.addEventListener('input', () => calculateOrderTotals('co'));
    const vDesc = document.getElementById('v_descuento');
    if (vDesc) vDesc.addEventListener('input', () => calculateOrderTotals('v'));

    // Pedidos Actions
    const cargarPedidosBtn = document.getElementById('cargarPedidosBtn');
    if (cargarPedidosBtn) cargarPedidosBtn.addEventListener('click', loadPedidos);
    const filtroTipo = document.getElementById('filtroTipoPedido');
    if (filtroTipo) filtroTipo.addEventListener('change', () => { if (window.pedidosData) renderPedidosTable(window.pedidosData); });
    const filtroEstado = document.getElementById('filtroEstadoPedido');
    if (filtroEstado) filtroEstado.addEventListener('change', () => { if (window.pedidosData) renderPedidosTable(window.pedidosData); });
    const searchPed = document.getElementById('searchPedidos');
    if (searchPed) searchPed.addEventListener('input', () => { if (window.pedidosData) renderPedidosTable(window.pedidosData); });

    const refreshInvBtn = document.getElementById('cargarInventarioBtn');
    if (refreshInvBtn) refreshInvBtn.addEventListener('click', () => loadInventario());

    const cargarDashboardBtn = document.getElementById('cargarDatosGraficosBtn');
    if (cargarDashboardBtn) cargarDashboardBtn.addEventListener('click', () => handleLoadDashboard());

    const resVentasBtn = document.getElementById('resumenVentasBtn');
    if (resVentasBtn) resVentasBtn.addEventListener('click', () => loadSummary('Ventas'));
    const resComprasBtn = document.getElementById('resumenComprasBtn');
    if (resComprasBtn) resComprasBtn.addEventListener('click', () => loadSummary('Compras'));

    // Export Actions
    const exportInvBtn = document.getElementById('exportInventarioBtn');
    if (exportInvBtn) exportInvBtn.addEventListener('click', () => exportTableToExcel('inventarioTable', 'Inventario_TechFix'));
    const exportResBtn = document.getElementById('exportResumenBtn');
    if (exportResBtn) exportResBtn.addEventListener('click', () => exportTableToExcel('resumenTable', 'Reporte_TechFix'));

    // IVA Toggles (legacy form)
    const coIva = document.getElementById('co_apply_iva');
    if (coIva) coIva.addEventListener('change', () => calculateOrderTotals('co'));
    const vIva = document.getElementById('v_apply_iva');
    if (vIva) vIva.addEventListener('change', () => calculateOrderTotals('v'));

    // Set default dates (legacy form, si existen)
    const today = new Date().toISOString().split('T')[0];
    const coFecha = document.getElementById('co_fecha');
    if (coFecha) coFecha.value = today;
    const vFecha = document.getElementById('v_fecha');
    if (vFecha) vFecha.value = today;

    const coReset = document.getElementById('co_order_id');
    if (coReset) resetOrder('co');
    const vReset = document.getElementById('v_order_id');
    if (vReset) resetOrder('v');

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

    const descuentoInput = document.getElementById(`${prefix}_descuento`);
    const descuentoPct = descuentoInput ? (parseFloat(descuentoInput.value) || 0) : 0;
    const descuentoVal = subtotalGeneral * (descuentoPct / 100);
    const subtotalConDescuento = subtotalGeneral - descuentoVal;

    const iva = applyIva ? subtotalConDescuento * 0.19 : 0;
    const total = subtotalConDescuento + iva;

    document.getElementById(`${prefix}_base_imponible`).innerText = formatCOP(subtotalGeneral);

    const descuentoRow = document.getElementById(`${prefix}_descuento_row`);
    if (descuentoRow) {
        if (descuentoPct > 0) {
            descuentoRow.style.display = 'flex';
            document.getElementById(`${prefix}_descuento_val`).innerText = '-' + formatCOP(descuentoVal);
        } else {
            descuentoRow.style.display = 'none';
        }
    }

    document.getElementById(`${prefix}_iva`).innerText = formatCOP(iva);
    document.getElementById(`${prefix}_total`).innerText = formatCOP(total);
}

async function submitPedido(prefix, actionType) {
    const statusDivId = prefix === 'co' ? 'statusCompra' : 'statusVenta';
    const contact = document.getElementById(`${prefix}_${prefix === 'co' ? 'proveedor' : 'cliente'}`).value;
    const fecha = document.getElementById(`${prefix}_fecha`).value;
    const orderId = document.getElementById(`${prefix}_order_id`).innerText;

    const notasEl = document.getElementById(`${prefix}_notas`);
    const metodoPagoEl = document.getElementById(`${prefix}_metodo_pago`);
    const descuentoEl = document.getElementById(`${prefix}_descuento`);
    const totalEl = document.getElementById(`${prefix}_total`);

    const notas = notasEl ? notasEl.value : '';
    const metodo_pago = metodoPagoEl ? metodoPagoEl.value : '';
    const descuento = descuentoEl ? parseFloat(descuentoEl.value) || 0 : 0;
    const totalText = totalEl ? totalEl.innerText.replace(/[^\d.\-]/g, '') : '0';
    const total = parseFloat(totalText) || 0;

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

    let usuario = '';
    const currentUser = localStorage.getItem('currentUser');
    if (currentUser) {
        try { usuario = JSON.parse(currentUser).usuario; } catch (e) { }
    }

    const clickBtn = document.getElementById(`${prefix}_${actionType === 'borrador' ? 'draft' : 'submit'}_btn`);
    if (clickBtn) clickBtn.disabled = true;
    displayStatus(statusDivId, 'info', "Procesando pedido...");

    const batchData = {
        action: 'crearPedido',
        tipo: prefix === 'co' ? 'compra' : 'venta',
        contacto: contact,
        fecha: fecha,
        notas: notas,
        metodo_pago: metodo_pago,
        descuento: descuento,
        total: total,
        usuario: usuario,
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
            const pedidoId = data.pedidoId || orderId;

            if (actionType === 'confirmar') {
                displayStatus(statusDivId, 'info', "Confirmando e inventariando...");
                const confirmData = { action: 'confirmarPedido', pedidoId: pedidoId };
                const confirmRes = await fetch(SCRIPT_URL, {
                    method: 'POST',
                    body: JSON.stringify(confirmData),
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' }
                });
                const confirmJson = await confirmRes.json();

                if (confirmJson.status === 'success') {
                    showToast(`Pedido ${pedidoId} confirmado exitosamente`, 'success');
                    displayStatus(statusDivId, 'success', confirmJson.message);
                } else {
                    showToast(`Error al confirmar pedido: ${confirmJson.message}`, 'error');
                    displayStatus(statusDivId, 'error', confirmJson.message);
                }
            } else {
                showToast(`Pedido ${pedidoId} guardado en borrador`, 'success');
                displayStatus(statusDivId, 'success', data.message);
            }

            resetOrder(prefix);
            const contactSelect = document.getElementById(`${prefix}_${prefix === 'co' ? 'proveedor' : 'cliente'}`);
            if (contactSelect) contactSelect.value = '';
            if (notasEl) notasEl.value = '';
            if (metodoPagoEl) metodoPagoEl.value = '';
            if (descuentoEl) descuentoEl.value = 0;
        } else {
            displayStatus(statusDivId, 'error', data.message);
        }
    } catch (e) {
        displayStatus(statusDivId, 'error', "Error de conexión.");
    } finally {
        if (clickBtn) clickBtn.disabled = false;
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
    displayStatus('statusDashboard', 'info', 'Cargando datos del dashboard...');
    try {
        const fetchFechas = await fetch(`${SCRIPT_URL}?action=getPedidos`);
        const jsonFechas = await fetchFechas.json();

        if (jsonFechas.status === 'success' && jsonFechas.data) {
            calcularResumenAvanzado(jsonFechas.data);
            renderChartsFromPedidos(jsonFechas.data);
            displayStatus('statusDashboard', 'success', 'Dashboard actualizado correctamente.');
        } else {
            throw new Error(jsonFechas.message || 'Error desconocido.');
        }
    } catch (error) {
        displayStatus('statusDashboard', 'error', `Error al cargar dashboard: ${error.message}`);
    }
}

function calcularResumenAvanzado(pedidos) {
    const startObj = document.getElementById('dash_fecha_inicio');
    const endObj = document.getElementById('dash_fecha_fin');
    const startDate = startObj && startObj.value ? new Date(startObj.value + 'T00:00:00') : null;
    const endDate = endObj && endObj.value ? new Date(endObj.value + 'T23:59:59') : null;

    let filterPedidos = pedidos;
    if (startDate || endDate) {
        filterPedidos = pedidos.filter(p => {
            if (!p.fecha) return false;
            const fp = new Date(p.fecha);
            if (startDate && fp < startDate) return false;
            if (endDate && fp > endDate) return false;
            return true;
        });
    }

    // Calcular KPIs
    let totalVentas = 0;
    let totalCompras = 0;
    let transacciones = 0;
    let totalIvaEstimado = 0;

    filterPedidos.forEach(p => {
        // Solo contar los que no están cancelados y los que no sean borradores 
        // (o si prefieres, solo confirmados/completados)
        if (p.estado && (p.estado.toLowerCase() === 'cancelado' || p.estado.toLowerCase() === 'borrador')) return;

        const valTotal = parseFloat(p.total) || 0;
        if (p.tipo && p.tipo.toLowerCase() === 'venta') {
            totalVentas += valTotal;
            transacciones++;

            // Estimación muy básica del IVA asumiendo que el total lo tiene incluido si la base imponible difiere. 
            // Para ser exactos, habría que guardar el IVA explícitamente en la BD.
            // Para este KPI lo calcularemos como si todo tuviera 19% IVA dentro del Total.
            // Base = Total / 1.19 -> IVA = Total - Base
            let ivaLocal = valTotal - (valTotal / 1.19);
            totalIvaEstimado += ivaLocal;
        } else if (p.tipo && p.tipo.toLowerCase() === 'compra') {
            totalCompras += valTotal;
        }
    });

    const ganancias = totalVentas - totalCompras;
    const ticketPromedio = transacciones > 0 ? (totalVentas / transacciones) : 0;

    document.getElementById('totalVentas').textContent = formatCOP(totalVentas);
    document.getElementById('totalCompras').textContent = formatCOP(totalCompras);
    document.getElementById('totalGanancias').textContent = formatCOP(ganancias);

    const gananciasEl = document.getElementById('totalGanancias');
    if (ganancias > 0) gananciasEl.style.color = 'var(--secondary-color)';
    else if (ganancias < 0) gananciasEl.style.color = 'var(--danger-color)';
    else gananciasEl.style.color = '#666';

    const kpiTransacciones = document.getElementById('kpiTransacciones');
    if (kpiTransacciones) kpiTransacciones.textContent = transacciones.toString();

    const kpiTicketPromedio = document.getElementById('kpiTicketPromedio');
    if (kpiTicketPromedio) kpiTicketPromedio.textContent = formatCOP(ticketPromedio);

    const kpiTotalIva = document.getElementById('kpiTotalIva');
    if (kpiTotalIva) kpiTotalIva.textContent = formatCOP(totalIvaEstimado);
}

function renderChartsFromPedidos(pedidos) {
    const startObj = document.getElementById('dash_fecha_inicio');
    const endObj = document.getElementById('dash_fecha_fin');
    const startDate = startObj && startObj.value ? new Date(startObj.value + 'T00:00:00') : null;
    const endDate = endObj && endObj.value ? new Date(endObj.value + 'T23:59:59') : null;

    let filterPedidos = pedidos;
    if (startDate || endDate) {
        filterPedidos = pedidos.filter(p => {
            if (!p.fecha) return false;
            const fp = new Date(p.fecha);
            if (startDate && fp < startDate) return false;
            if (endDate && fp > endDate) return false;
            return true;
        });
    }

    const ventasPorFecha = {};
    const comprasPorFecha = {};

    filterPedidos.forEach(p => {
        if (p.estado && (p.estado.toLowerCase() === 'cancelado' || p.estado.toLowerCase() === 'borrador')) return;

        if (p.fecha) {
            const fechaStr = new Date(p.fecha).toLocaleDateString();
            const valTotal = parseFloat(p.total) || 0;

            if (p.tipo && p.tipo.toLowerCase() === 'venta') {
                ventasPorFecha[fechaStr] = (ventasPorFecha[fechaStr] || 0) + valTotal;
            } else if (p.tipo && p.tipo.toLowerCase() === 'compra') {
                comprasPorFecha[fechaStr] = (comprasPorFecha[fechaStr] || 0) + valTotal;
            }
        }
    });

    const todasFechas = [...new Set([...Object.keys(ventasPorFecha), ...Object.keys(comprasPorFecha)])];
    // Ordenar fechas asumiendo formato local (podría fallar si es dd/mm/yyyy puro vs mm/dd/yyyy en JS, 
    // pero para gráficos simplificados funcionará)
    todasFechas.sort((a, b) => {
        let da = a.split('/'); let db = b.split('/');
        // Assuming DD/MM/YYYY
        return new Date(da[2], da[1] - 1, da[0]) - new Date(db[2], db[1] - 1, db[0]);
    });

    const datosResumen = todasFechas.map(fecha => ({
        fecha: fecha,
        total_ventas: ventasPorFecha[fecha] || 0,
        total_compras: comprasPorFecha[fecha] || 0,
        ganancia: (ventasPorFecha[fecha] || 0) - (comprasPorFecha[fecha] || 0)
    }));

    renderCharts(datosResumen);
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
        if (input.id && (input.id.startsWith('p_') || input.id.startsWith('c_'))) {
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
                <td><small style="color:#888;">${p.id}</small></td>
                <td>${p.nombre}</td>
                <td>${p.código || p.codigo || ''}</td>
                <td>${p.categoría || p.categoria || ''}</td>
                <td><span style="padding: 4px 8px; border-radius: 6px; font-size: 0.85em; background: ${tipo === 'Servicio' ? '#e3f2fd' : '#f1f8e9'}; color: ${tipo === 'Servicio' ? '#1976d2' : '#558b2f'};">${tipo}</span></td>
                <td ${stockStyle}>${stockDisplay}</td>
                <td>${formatCOP(p.precio_venta)}</td>
                <td>
                    <button class="btn-icon" title="Editar" onclick="openEditProductModal('${p.id}')"><i class="fas fa-pen"></i></button>
                    <button class="btn-icon danger" title="Eliminar" onclick="deleteProductConfirm('${p.id}', '${(p.nombre || '').replace(/'/g, "\\'")}')"><i class="fas fa-trash"></i></button>
                </td>
            </tr>
        `;
    }).join('');
}

// ========== CRUD PRODUCTOS ==========

function openEditProductModal(id) {
    const product = productDataCache[id];
    if (!product) { showToast('Producto no encontrado en cache. Refresca el inventario.', 'error'); return; }

    document.getElementById('modal_prod_id').value = id;
    document.getElementById('modal_prod_nombre').value = product.nombre || '';
    document.getElementById('modal_prod_codigo').value = product.código || product.codigo || '';
    document.getElementById('modal_prod_tipo').value = product.tipo || 'Inventariable';
    document.getElementById('modal_prod_pcompra').value = product.precio_compra || 0;
    document.getElementById('modal_prod_pventa').value = product.precio_venta || 0;
    document.getElementById('modal_prod_stock').value = product.stock || 0;
    document.getElementById('modal_prod_status').style.display = 'none';

    // Poblar select de categorías
    const catSelect = document.getElementById('modal_prod_categoria');
    const currentCat = product.categoría || product.categoria || '';
    catSelect.innerHTML = cachedData.categorias.map(c =>
        `<option value="${c.nombre}" ${c.nombre === currentCat ? 'selected' : ''}>${c.nombre}</option>`
    ).join('');

    // Mostrar/ocultar stock según tipo
    const stockGroup = document.getElementById('modal_prod_stock_group');
    stockGroup.style.display = (product.tipo === 'Servicio') ? 'none' : 'block';
    document.getElementById('modal_prod_tipo').onchange = (e) => {
        stockGroup.style.display = (e.target.value === 'Servicio') ? 'none' : 'block';
    };

    openModal('modalEditProduct');

    document.getElementById('modal_prod_save').onclick = async () => {
        const statusEl = document.getElementById('modal_prod_status');
        const saveBtn = document.getElementById('modal_prod_save');
        saveBtn.disabled = true;

        const payload = {
            action: 'editarProducto',
            id,
            nombre: document.getElementById('modal_prod_nombre').value.trim(),
            codigo: document.getElementById('modal_prod_codigo').value.trim(),
            categoria: document.getElementById('modal_prod_categoria').value,
            tipo: document.getElementById('modal_prod_tipo').value,
            precio_compra: document.getElementById('modal_prod_pcompra').value,
            precio_venta: document.getElementById('modal_prod_pventa').value,
            stock: document.getElementById('modal_prod_stock').value
        };

        try {
            const res = await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.status === 'success') {
                showToast(data.message, 'success');
                closeModal('modalEditProduct');
                loadInitialData();
            } else {
                statusEl.style.display = 'block';
                statusEl.className = 'status-message error';
                statusEl.innerHTML = `<i class="fas fa-times-circle"></i> ${data.message}`;
            }
        } catch (e) {
            showToast('Error: ' + e.message, 'error');
        } finally {
            saveBtn.disabled = false;
        }
    };
}

async function deleteProductConfirm(id, nombre) {
    if (!confirm(`¿Eliminar el producto "${nombre}"?\n\nSi tiene ventas asociadas no se recomienda eliminar, es mejor archivarlo.`)) return;

    fetch(SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action: 'archivarProducto', id })
    })
        .then(r => r.json())
        .then(data => {
            if (data.status === 'success') {
                showToast(data.message, 'success');
                loadInventario();
            } else {
                showToast(data.message, 'error');
            }
        })
        .catch(e => showToast('Error: ' + e.message, 'error'));
}
// ========== VISTA LISTA ESTILO ODOO ==========

async function loadOrdersByType(tipo) {
    const isCompra = tipo === 'compra';
    const tbodyId = isCompra ? 'comprasTableBody' : 'ventasTableBody';
    const statusId = isCompra ? 'statusCompraLista' : 'statusVentaLista';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    displayStatus(statusId, 'info', 'Cargando órdenes...');
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:20px;"><i class="fas fa-spinner fa-spin"></i> Cargando...</td></tr>`;
    try {
        const res = await fetch(`${SCRIPT_URL}?action=getPedidos&tipo=${tipo}`);
        const data = await res.json();
        if (data.status === 'success') {
            window.pedidosData = window.pedidosData || [];
            window.pedidosData = window.pedidosData.filter(p => String(p.tipo).toLowerCase() !== tipo).concat(data.data);
            renderOrdersListTable(data.data, tipo);
            displayStatus(statusId, 'success', `${data.data.length} órdenes cargadas.`);
        } else {
            displayStatus(statusId, 'error', data.message);
            tbody.innerHTML = `<tr><td colspan="6" style="color:red;text-align:center;">${data.message}</td></tr>`;
        }
    } catch (e) {
        displayStatus(statusId, 'error', 'Error de conexión.');
        tbody.innerHTML = `<tr><td colspan="6" style="color:red;text-align:center;">Error de conexión.</td></tr>`;
    }
}

function renderOrdersListTable(pedidos, tipo, estadoFilter) {
    const isCompra = tipo === 'compra';
    const tbodyId = isCompra ? 'comprasTableBody' : 'ventasTableBody';
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;
    const filtered = estadoFilter ? pedidos.filter(p => String(p.estado).toLowerCase() === estadoFilter) : pedidos;
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:30px;color:#aaa;"><i class="fas fa-inbox fa-2x"></i><br>No hay órdenes${estadoFilter ? ' con estado "' + estadoFilter + '"' : ''}.</td></tr>`;
        return;
    }
    tbody.innerHTML = filtered.map(p => {
        const estado = String(p.estado || 'borrador').toLowerCase();
        const fecha = p.fecha ? new Date(p.fecha).toLocaleDateString('es-CO') : '—';
        const total = formatCOP(parseFloat(p.total) || 0);
        const safeTipo = (p.tipo || '').replace(/'/g, "\\'");
        return `<tr onclick="openOrderDetails('${p.id}','${safeTipo}')">
            <td><strong style="color:var(--primary-color);">${p.id}</strong></td>
            <td>${p.contacto || '—'}</td>
            <td>${fecha}</td>
            <td>${p.metodo_pago || '—'}</td>
            <td style="text-align:right;font-weight:600;">${total}</td>
            <td style="text-align:center;"><span class="status-badge badge-${estado}">${estado}</span></td>
        </tr>`;
    }).join('');
}

function setupPipelineFilters() {
    document.querySelectorAll('.pipeline-filter-btn').forEach(btn => {
        btn.addEventListener('click', function () {
            const prefix = this.dataset.prefix;
            const filter = this.dataset.filter;
            const tipo = prefix === 'co' ? 'compra' : 'venta';
            document.querySelectorAll(`[data-prefix="${prefix}"]`).forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            const allData = (window.pedidosData || []).filter(p => String(p.tipo).toLowerCase() === tipo);
            renderOrdersListTable(allData, tipo, filter);
        });
    });
    ['searchCompras', 'searchVentas'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('input', function () {
            const tipo = id === 'searchCompras' ? 'compra' : 'venta';
            const q = this.value.toLowerCase();
            const all = (window.pedidosData || []).filter(p => String(p.tipo).toLowerCase() === tipo);
            const filtered = q ? all.filter(p => `${p.id} ${p.contacto} ${p.estado} ${p.metodo_pago}`.toLowerCase().includes(q)) : all;
            renderOrdersListTable(filtered, tipo);
        });
    });
}

// ========== MODAL: NUEVO PEDIDO ==========
let newOrdTipo = 'compra';

function openNewOrderModal(tipo) {
    newOrdTipo = tipo;
    const isCompra = tipo === 'compra';
    document.getElementById('newOrd_title').innerHTML = `<i class="fas fa-plus-circle"></i> Nueva Orden de ${isCompra ? 'Compra' : 'Venta'}`;
    document.getElementById('newOrd_contact_label').textContent = isCompra ? 'Proveedor:' : 'Cliente:';
    const contactos = isCompra ? (cachedData.proveedores || []) : (cachedData.clientes || []);
    const sel = document.getElementById('newOrd_contacto');
    sel.innerHTML = '<option value="">Seleccionar</option>' + contactos.map(c => `<option value="${c.nombre}">${c.nombre}</option>`).join('');
    document.getElementById('newOrd_fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('newOrd_metodo_pago').value = '';
    document.getElementById('newOrd_descuento').value = 0;
    document.getElementById('newOrd_notas').value = '';
    document.getElementById('newOrd_apply_iva').checked = false; // IVA desactivado por defecto
    const statusEl = document.getElementById('newOrd_status');
    if (statusEl) statusEl.style.display = 'none';
    document.getElementById('newOrd_items_body').innerHTML = '';
    newOrdAddLine();
    newOrdCalcTotals();
    document.getElementById('newOrd_add_line').onclick = newOrdAddLine;
    document.getElementById('newOrd_descuento').oninput = newOrdCalcTotals;
    document.getElementById('newOrd_apply_iva').onchange = newOrdCalcTotals;
    document.getElementById('newOrd_draft_btn').onclick = () => newOrdSubmit('borrador');
    document.getElementById('newOrd_confirm_btn').onclick = () => newOrdSubmit('confirmar');

    // Botón de cotización: solo visible para ventas
    const emailBtn = document.getElementById('newOrd_email_btn');
    if (emailBtn) emailBtn.style.display = isCompra ? 'none' : 'inline-flex';

    newOrdLastPedidoId = null; // Resetear borrador anterior
    openModal('modalNewOrder');
}


function newOrdAddLine() {
    const tbody = document.getElementById('newOrd_items_body');
    const isCompra = newOrdTipo === 'compra';
    const row = document.createElement('tr');
    const productOptions = (cachedData.productos || []).map(p =>
        `<option value="${p.id}">${p.nombre} (${p['código'] || p.codigo || ''})</option>`).join('');
    row.innerHTML = `
        <td><select class="nord-product" style="width:100%;"><option value="">Seleccionar...</option>${productOptions}</select>
        <input type="hidden" class="nord-prod-id"></td>
        <td><input type="number" class="nord-qty" value="1" min="1" style="width:70px;"></td>
        <td><input type="number" class="nord-price" value="0" step="0.01" style="width:110px;"></td>
        <td class="nord-subtotal">$0</td>
        <td><i class="fas fa-trash" style="cursor:pointer;color:#dc3545;" onclick="this.closest('tr').remove();newOrdCalcTotals();"></i></td>`;
    tbody.appendChild(row);
    const sel = row.querySelector('.nord-product');
    const hidId = row.querySelector('.nord-prod-id');
    const qtyEl = row.querySelector('.nord-qty');
    const prEl = row.querySelector('.nord-price');
    sel.addEventListener('change', () => {
        hidId.value = sel.value;
        const prod = productDataCache[sel.value];
        if (prod) { prEl.value = isCompra ? (prod.precio_compra || 0) : (prod.precio_venta || 0); newOrdCalcTotals(); }
    });
    qtyEl.addEventListener('input', newOrdCalcTotals);
    prEl.addEventListener('input', newOrdCalcTotals);
    newOrdCalcTotals();
}

function newOrdCalcTotals() {
    let subtotal = 0;
    document.querySelectorAll('#newOrd_items_body tr').forEach(row => {
        const q = parseFloat(row.querySelector('.nord-qty')?.value) || 0;
        const p = parseFloat(row.querySelector('.nord-price')?.value) || 0;
        const s = q * p;
        const subEl = row.querySelector('.nord-subtotal');
        if (subEl) subEl.textContent = formatCOP(s);
        subtotal += s;
    });
    const desc = parseFloat(document.getElementById('newOrd_descuento').value) || 0;
    const descVal = subtotal * (desc / 100);
    const afterDesc = subtotal - descVal;
    const applyIva = document.getElementById('newOrd_apply_iva').checked;
    const iva = applyIva ? afterDesc * 0.19 : 0;
    const total = afterDesc + iva;
    document.getElementById('newOrd_base').textContent = formatCOP(subtotal);
    document.getElementById('newOrd_iva').textContent = formatCOP(iva);
    document.getElementById('newOrd_total').textContent = formatCOP(total);
    const descRow = document.getElementById('newOrd_desc_row');
    if (desc > 0) { descRow.style.display = ''; document.getElementById('newOrd_desc_val').textContent = '-' + formatCOP(descVal); }
    else descRow.style.display = 'none';
    return total;
}

async function newOrdSubmit(mode) {
    const statusEl = document.getElementById('newOrd_status');
    const total = newOrdCalcTotals();
    const items = [];
    document.querySelectorAll('#newOrd_items_body tr').forEach(row => {
        const id = row.querySelector('.nord-prod-id')?.value;
        const qty = parseInt(row.querySelector('.nord-qty')?.value) || 0;
        const precio = parseFloat(row.querySelector('.nord-price')?.value) || 0;
        if (id && qty > 0) items.push({ producto_id: id, cantidad: qty, precio });
    });
    if (items.length === 0) {
        statusEl.style.display = 'block'; statusEl.className = 'status-message error';
        statusEl.textContent = 'Agrega al menos un producto válido.'; return;
    }
    let usuario = '';
    try { usuario = JSON.parse(localStorage.getItem('currentUser') || '{}').usuario || ''; } catch (e) { }
    const isUpdate = !!newOrdLastPedidoId;
    const payload = {
        action: isUpdate ? 'actualizarPedido' : 'crearPedido',
        pedidoId: isUpdate ? newOrdLastPedidoId : undefined,
        tipo: newOrdTipo,
        contacto: document.getElementById('newOrd_contacto').value,
        fecha: document.getElementById('newOrd_fecha').value,
        metodo_pago: document.getElementById('newOrd_metodo_pago').value,
        notas: document.getElementById('newOrd_notas').value,
        descuento: parseFloat(document.getElementById('newOrd_descuento').value) || 0,
        total, usuario, items
    };
    statusEl.style.display = 'block'; statusEl.className = 'status-message info';
    statusEl.textContent = 'Guardando...';
    document.getElementById('newOrd_draft_btn').disabled = true;
    document.getElementById('newOrd_confirm_btn').disabled = true;
    try {
        const res = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload) });
        const data = await res.json();
        if (data.status === 'success') {
            const pedidoId = data.pedidoId;
            if (mode === 'confirmar') {
                const res2 = await fetch(SCRIPT_URL, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'confirmarPedido', pedidoId }) });
                const data2 = await res2.json();
                showToast(data2.status === 'success' ? `Pedido ${pedidoId} confirmado.` : data2.message, data2.status === 'success' ? 'success' : 'warning');
                closeModal('modalNewOrder');
                loadOrdersByType(newOrdTipo);
                loadPedidos();
            } else {
                // Borrador guardado: mantener el modal abierto para poder enviar la cotización
                newOrdLastPedidoId = pedidoId;
                showToast(`Borrador ${pedidoId} guardado.`, 'success');
                statusEl.className = 'status-message success';
                statusEl.textContent = `✓ Borrador ${pedidoId} guardado. Puedes enviarlo como cotización o cerrar.`;
                // Mostrar botón de email si es venta
                if (newOrdTipo === 'venta') {
                    const eb = document.getElementById('newOrd_email_btn');
                    if (eb) eb.style.display = 'inline-flex';
                }
                loadOrdersByType(newOrdTipo);
                loadPedidos();
            }

        } else {
            statusEl.className = 'status-message error'; statusEl.textContent = data.message;
        }
    } catch (e) {
        statusEl.className = 'status-message error'; statusEl.textContent = 'Error: ' + e.message;
    } finally {
        document.getElementById('newOrd_draft_btn').disabled = false;
        document.getElementById('newOrd_confirm_btn').disabled = false;
    }
}

// ========== SISTEMA CHATTER / LOG DE ACTIVIDAD ==========

let chatterCurrentRef = null; // ID del pedido actualmente abierto en el modal

async function loadChatter(referenciaId) {
    chatterCurrentRef = referenciaId;
    const feed = document.getElementById('chatter_feed');
    if (!feed) return;

    feed.innerHTML = `<div style="text-align:center;color:#aaa;padding:16px;"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>`;

    // Actualizar avatar del usuario en el chatter
    try {
        const u = window.InvAuth?.currentUser?.();
        const avatar = document.getElementById('chatter_user_avatar');
        if (u && avatar) avatar.textContent = (u.usuario || 'U').charAt(0).toUpperCase();
    } catch (e) { }

    try {
        const res = await fetch(`${SCRIPT_URL}?action=getChatter&referenciaId=${encodeURIComponent(referenciaId)}`);
        const data = await res.json();

        if (data.status === 'success') {
            renderChatterFeed(data.data || []);
        } else {
            feed.innerHTML = `<div style="text-align:center;color:#e74c3c;padding:16px;">Error al cargar el historial.</div>`;
        }
    } catch (e) {
        feed.innerHTML = `<div style="text-align:center;color:#e74c3c;padding:16px;">Error de conexión.</div>`;
    }
}

function renderChatterFeed(events) {
    const feed = document.getElementById('chatter_feed');
    if (!feed) return;

    if (events.length === 0) {
        feed.innerHTML = `
            <div style="text-align:center;color:#aaa;padding:24px;font-size:0.85rem;">
                <i class="fas fa-history" style="font-size:1.8rem;display:block;margin-bottom:10px;opacity:0.4;"></i>
                Sin actividad registrada todavía.
            </div>`;
        return;
    }

    const typeConfig = {
        sistema: { icon: 'fa-robot', color: '#64748b', bg: '#f1f5f9', label: 'Sistema' },
        cambio_estado: { icon: 'fa-arrow-right', color: '#1d4ed8', bg: '#dbeafe', label: 'Estado' },
        nota: { icon: 'fa-comment', color: '#7c3aed', bg: '#ede9fe', label: 'Nota' },
        confirmacion: { icon: 'fa-check-circle', color: '#065f46', bg: '#dcfce7', label: 'Confirmado' },
        completado: { icon: 'fa-check-double', color: '#065f46', bg: '#d1fae5', label: 'Completado' },
        cancelado: { icon: 'fa-times-circle', color: '#991b1b', bg: '#fee2e2', label: 'Cancelado' },
    };

    feed.innerHTML = events.map(ev => {
        const t = typeConfig[ev.tipo] || typeConfig.nota;
        const fecha = ev.fecha ? new Date(ev.fecha).toLocaleString('es-CO', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }) : '';
        return `
            <div style="display:flex;gap:12px;align-items:flex-start;animation:fadeIn 0.3s ease;">
                <div style="width:34px;height:34px;border-radius:50%;background:${t.bg};color:${t.color};
                            display:flex;align-items:center;justify-content:center;font-size:0.85rem;flex-shrink:0;border:2px solid ${t.color}22;">
                    <i class="fas ${t.icon}"></i>
                </div>
                <div style="flex:1;background:var(--card-bg,#fff);border:1px solid var(--border,#e2e8f0);
                            border-radius:10px;padding:10px 14px;">
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                        <div style="display:flex;align-items:center;gap:8px;">
                            <strong style="font-size:0.82rem;color:var(--text,#1e293b);">${ev.usuario || 'Sistema'}</strong>
                            <span style="font-size:0.72rem;padding:2px 8px;border-radius:20px;background:${t.bg};color:${t.color};font-weight:600;">
                                ${t.label}
                            </span>
                        </div>
                        <span style="font-size:0.75rem;color:#94a3b8;">${fecha}</span>
                    </div>
                    <p style="font-size:0.875rem;color:var(--text-muted,#64748b);margin:0;line-height:1.5;">${ev.mensaje}</p>
                </div>
            </div>`;
    }).join('');

    // Scroll al fondo
    feed.scrollTop = feed.scrollHeight;
}

async function sendChatNote() {
    if (!chatterCurrentRef) return;
    const input = document.getElementById('chatter_input');
    const msg = (input?.value || '').trim();
    if (!msg) { showToast('Escribe un mensaje antes de enviar.', 'warning'); return; }

    const sendBtn = document.getElementById('chatter_send_btn');
    if (sendBtn) { sendBtn.disabled = true; sendBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>'; }

    let usuario = '';
    try { usuario = window.InvAuth?.currentUser?.()?.usuario || 'Usuario'; } catch (e) { }

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'addChatMessage',
                referenciaId: chatterCurrentRef,
                modulo: 'pedido',
                tipo: 'nota',
                mensaje: msg,
                usuario
            })
        });
        const data = await res.json();
        if (data.status === 'success') {
            input.value = '';
            loadChatter(chatterCurrentRef);
        } else {
            showToast('Error al enviar: ' + data.message, 'error');
        }
    } catch (e) {
        showToast('Error de conexión.', 'error');
    } finally {
        if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar nota'; }
    }
}

/**
 * Registra un evento de sistema en el chatter (cambios de estado, confirmación, etc.)
 * Se llama internamente desde mordSave, mordChangeState, etc.
 */
async function logSystemEvent(referenciaId, tipo, mensaje) {
    let usuario = '';
    try { usuario = window.InvAuth?.currentUser?.()?.usuario || 'Sistema'; } catch (e) { }
    try {
        await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'addChatMessage',
                referenciaId,
                modulo: 'pedido',
                tipo,
                mensaje,
                usuario
            })
        });
    } catch (e) { /* silencioso */ }
}

function setupChatterEvents() {
    const sendBtn = document.getElementById('chatter_send_btn');
    if (sendBtn) sendBtn.addEventListener('click', sendChatNote);

    const input = document.getElementById('chatter_input');
    if (input) {
        input.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.key === 'Enter') sendChatNote();
        });
        input.addEventListener('focus', () => {
            input.style.borderColor = 'var(--primary-color, #4361ee)';
            input.style.boxShadow = '0 0 0 3px rgba(67,97,238,0.12)';
        });
        input.addEventListener('blur', () => {
            input.style.borderColor = '';
            input.style.boxShadow = '';
        });
    }
}

// ========== SECCIÓN PEDIDOS ==========


async function loadPedidos() {
    displayStatus('statusPedidos', 'info', 'Cargando historial de pedidos...');
    const tbody = document.getElementById('pedidosTableBody');
    tbody.innerHTML = '<tr><td colspan="7">Cargando...</td></tr>';

    try {
        const res = await fetch(`${SCRIPT_URL}?action=getPedidos`);
        const data = await res.json();

        if (data.status === 'success') {
            window.pedidosData = data.data;
            renderPedidosTable(data.data);
            displayStatus('statusPedidos', 'success', `Se cargaron ${data.data.length} pedidos.`);
        } else {
            displayStatus('statusPedidos', 'error', data.message);
            tbody.innerHTML = `<tr><td colspan="7" style="color:red;">Error: ${data.message}</td></tr>`;
        }
    } catch (error) {
        displayStatus('statusPedidos', 'error', 'Error de conexión.');
        tbody.innerHTML = `<tr><td colspan="7" style="color:red;">Error de conexión.</td></tr>`;
    }
}

function renderPedidosTable(pedidos) {
    const tbody = document.getElementById('pedidosTableBody');

    const tipoFilter = document.getElementById('filtroTipoPedido').value.toLowerCase();
    const estadoFilter = document.getElementById('filtroEstadoPedido').value.toLowerCase();
    const searchFilter = document.getElementById('searchPedidos').value.toLowerCase();

    const filtrados = pedidos.filter(p => {
        const matchesTipo = !tipoFilter || String(p.tipo).toLowerCase() === tipoFilter;
        const matchesEstado = !estadoFilter || String(p.estado).toLowerCase() === estadoFilter;

        const searchString = `${p.id} ${p.contacto} ${p.tipo} ${p.estado}`.toLowerCase();
        const matchesSearch = !searchFilter || searchString.includes(searchFilter);

        return matchesTipo && matchesEstado && matchesSearch;
    });

    if (filtrados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7">No se encontraron pedidos.</td></tr>';
        return;
    }

    tbody.innerHTML = filtrados.map(p => {
        let badgeColor = '#6c757d'; // borrador
        if (String(p.estado).toLowerCase() === 'confirmado') badgeColor = '#007bff';
        if (String(p.estado).toLowerCase() === 'completado') badgeColor = '#28a745';
        if (String(p.estado).toLowerCase() === 'cancelado') badgeColor = '#dc3545';

        const fechaFormat = p.fecha ? new Date(p.fecha).toLocaleDateString() : 'N/A';
        const totalNum = parseFloat(p.total) || 0;
        const safeTipo = (p.tipo || '').replace(/'/g, "\\'");

        return `
            <tr style="cursor:pointer;" onclick="openOrderDetails('${p.id}', '${safeTipo}')">
                <td><strong>${p.id}</strong></td>
                <td><span style="text-transform:capitalize;">${p.tipo}</span></td>
                <td>${fechaFormat}</td>
                <td>${p.contacto || 'N/A'}</td>
                <td><span style="padding:4px 8px; border-radius:12px; font-size:0.85em; color:white; background:${badgeColor}; text-transform:capitalize;">${p.estado}</span></td>
                <td>${formatCOP(totalNum)}</td>
                <td><button class="btn secondary-btn" style="padding:5px 12px; font-size:0.8em;" onclick="event.stopPropagation(); openOrderDetails('${p.id}', '${safeTipo}')"><i class="fas fa-eye"></i> Ver</button></td>
            </tr>
        `;
    }).join('');
}

async function cambiarEstadoPedido(pedidoId, accion) {
    if (!confirm(`¿Estás seguro de que deseas ${accion} el pedido ${pedidoId}?`)) return;

    displayStatus('statusPedidos', 'info', `Procesando cambio de estado...`);

    let actionAPI = '';
    if (accion === 'confirmar') actionAPI = 'confirmarPedido';
    if (accion === 'completar') actionAPI = 'completarPedido';
    if (accion === 'cancelar') actionAPI = 'cancelarPedido';

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            body: JSON.stringify({ action: actionAPI, pedidoId: pedidoId }),
            headers: { 'Content-Type': 'text/plain;charset=utf-8' }
        });
        const data = await res.json();

        if (data.status === 'success') {
            showToast(data.message, 'success');
            loadPedidos();
        } else {
            showToast(data.message, 'error');
            displayStatus('statusPedidos', 'error', data.message);
        }
    } catch (e) {
        showToast("Error de conexión.", "error");
        displayStatus('statusPedidos', 'error', "Error de conexión.");
    }
}

// ========== DETALLE DE PEDIDO (MODAL ODOO-STYLE) ==========

let mordCurrentPedido = null; // Almacena el pedido actualmente abierto en el modal

async function openOrderDetails(pedidoId, tipo) {
    // Buscar pedido en cache o solicitar
    const pedido = (window.pedidosData || []).find(p => String(p.id) === String(pedidoId));
    if (!pedido) { showToast('Pedido no encontrado en la lista.', 'error'); return; }

    mordCurrentPedido = { ...pedido };
    const isCompra = String(tipo).toLowerCase() === 'compra';
    const estadoNorm = String(pedido.estado || 'borrador').toLowerCase();
    const esBorrador = estadoNorm === 'borrador';
    const isActive = estadoNorm !== 'cancelado';

    // Actualizar título y pipeline
    document.getElementById('modal_order_title').innerHTML = `<i class="fas fa-file-invoice"></i> Pedido de ${isCompra ? 'Compra' : 'Venta'}`;
    document.getElementById('modal_order_id_label').textContent = pedidoId;
    document.getElementById('modal_order_status').style.display = 'none';
    document.getElementById('mord_contact_label').textContent = isCompra ? 'Proveedor:' : 'Cliente:';

    // Poblar pipeline
    const steps = ['borrador', 'confirmado', 'completado'];
    const pipeIds = { 'borrador': 'pipe_borrador', 'confirmado': 'pipe_confirmado', 'completado': 'pipe_completado' };
    steps.forEach(s => {
        const el = document.getElementById(pipeIds[s]);
        el.className = 'pipeline-step';
        const idx = steps.indexOf(s);
        const curIdx = steps.indexOf(estadoNorm);
        if (estadoNorm === 'cancelado') {
            el.classList.add('cancelled');
        } else if (idx < curIdx) {
            el.classList.add('done');
        } else if (idx === curIdx) {
            el.classList.add('active');
        }
    });

    // Poblar select de contactos
    const contactos = isCompra ? (cachedData.proveedores || []) : (cachedData.clientes || []);
    const selectEl = document.getElementById('mord_contacto');
    selectEl.innerHTML = '<option value="">Seleccionar</option>' +
        contactos.map(c => `<option value="${c.nombre}" ${c.nombre === pedido.contacto ? 'selected' : ''}>${c.nombre}</option>`).join('');
    selectEl.disabled = !esBorrador;

    // Formatear fecha
    let fechaVal = '';
    if (pedido.fecha) {
        const d = new Date(pedido.fecha);
        if (!isNaN(d)) fechaVal = d.toISOString().split('T')[0];
    }
    document.getElementById('mord_fecha').value = fechaVal;
    document.getElementById('mord_fecha').disabled = !esBorrador;
    document.getElementById('mord_metodo_pago').value = pedido.metodo_pago || '';
    document.getElementById('mord_metodo_pago').disabled = !esBorrador;
    document.getElementById('mord_notas').value = pedido.notas || '';
    document.getElementById('mord_notas').disabled = !esBorrador;
    document.getElementById('mord_descuento').value = pedido.descuento || 0;
    document.getElementById('mord_descuento').disabled = !esBorrador;
    document.getElementById('mord_apply_iva').checked = false;
    document.getElementById('mord_apply_iva').disabled = !esBorrador;

    // Mostrar/ocultar botones de acciones
    document.getElementById('mord_save_btn').style.display = esBorrador ? '' : 'none';
    document.getElementById('mord_confirm_btn').style.display = esBorrador ? '' : 'none';
    document.getElementById('mord_complete_btn').style.display = estadoNorm === 'confirmado' ? '' : 'none';
    document.getElementById('mord_cancel_btn').style.display = (isActive && estadoNorm !== 'completado') ? '' : 'none';
    document.getElementById('mord_add_line_wrapper').style.display = esBorrador ? '' : 'none';

    // ── Total del pedido para el módulo de pagos ──────────────────────────
    pagoCurrentTotal = parseFloat(pedido.total) || 0;
    pagoCurrentSaldo = pagoCurrentTotal; // se actualizará al cargar pagos
    pagoCurrentPedidoId = pedidoId;

    // Cargar líneas de detalle
    const tbody = document.getElementById('mord_items_body');
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;"><i class="fas fa-spinner fa-spin"></i> Cargando productos...</td></tr>';
    openModal('modalOrderDetails');

    // ── Botones post-openModal (para no ser sobreescritos por animación) ──
    const emailBtn = document.getElementById('mord_email_btn');
    const pagoBtn = document.getElementById('mord_pago_btn');
    const pagoBanner = document.getElementById('mord_pago_banner');
    const pagosSection = document.getElementById('mord_pagos_section');

    // Email: visible siempre excepto cancelados
    if (emailBtn) emailBtn.style.display = estadoNorm !== 'cancelado' ? 'inline-flex' : 'none';

    // Pago: solo para confirmados o completados (no borradores ni cancelados)
    const permitesPago = (estadoNorm === 'confirmado' || estadoNorm === 'completado');
    if (pagoBtn) pagoBtn.style.display = permitesPago ? 'inline-flex' : 'none';

    // Ocultar banner y sección de pagos hasta que carguen
    if (pagoBanner) pagoBanner.style.display = permitesPago ? 'block' : 'none';
    if (pagosSection) pagosSection.style.display = 'none';

    try {
        const res = await fetch(`${SCRIPT_URL}?action=getDetallePedido&pedidoId=${encodeURIComponent(pedidoId)}&tipo=${tipo}`);
        const data = await res.json();
        if (data.status === 'success') {
            renderMordLines(data.data, isCompra, esBorrador);
        } else {
            tbody.innerHTML = `<tr><td colspan="5" style="color:red;">${data.message}</td></tr>`;
        }
    } catch (e) {
        tbody.innerHTML = '<tr><td colspan="5" style="color:red;">Error al cargar líneas.</td></tr>';
    }

    mordCalcTotals();

    // Cargar el chatter del pedido y los pagos
    loadChatter(pedidoId);
    if (permitesPago) loadPagosPedido(pedidoId);

    // Listeners para desc/iva
    document.getElementById('mord_descuento').oninput = mordCalcTotals;
    document.getElementById('mord_apply_iva').onchange = mordCalcTotals;

    // Botón Agregar Línea
    document.getElementById('mord_add_line').onclick = () => mordAddLine(isCompra);

    // Botón Guardar
    document.getElementById('mord_save_btn').onclick = () => mordSave(pedidoId, tipo, isCompra);

    // Botón Confirmar
    document.getElementById('mord_confirm_btn').onclick = async () => {
        if (!confirm(`¿Confirmar el pedido ${pedidoId}? Esto actualizará el inventario.`)) return;
        await mordSave(pedidoId, tipo, isCompra, 'confirmar');
    };

    // Botón Completar
    document.getElementById('mord_complete_btn').onclick = async () => {
        if (!confirm(`¿Completar el pedido ${pedidoId}?`)) return;
        const res = await fetch(SCRIPT_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'completarPedido', pedidoId })
        });
        const data = await res.json();
        if (data.status === 'success') {
            await logSystemEvent(pedidoId, 'completado', `Pedido marcado como Completado.`);
            showToast(data.message, 'success');
            closeModal('modalOrderDetails');
            loadOrdersByType(tipo); loadPedidos();
        } else { showToast(data.message, 'error'); }
    };

    // Botón Cancelar
    document.getElementById('mord_cancel_btn').onclick = async () => {
        if (!confirm(`¿Cancelar el pedido ${pedidoId}?`)) return;
        const res = await fetch(SCRIPT_URL, {
            method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'cancelarPedido', pedidoId })
        });
        const data = await res.json();
        if (data.status === 'success') {
            await logSystemEvent(pedidoId, 'cancelado', `Pedido cancelado.${data.message.includes('Stock') ? ' Stock revertido.' : ''}`);
            showToast(data.message, 'success');
            closeModal('modalOrderDetails');
            loadOrdersByType(tipo); loadPedidos();
        } else { showToast(data.message, 'error'); }
    };
}

function renderMordLines(lines, isCompra, editable) {
    const tbody = document.getElementById('mord_items_body');
    if (!lines || lines.length === 0) {
        if (editable) {
            tbody.innerHTML = '<tr><td colspan="5" style="color:#888;">Sin productos. Agregue uno.</td></tr>';
        } else {
            tbody.innerHTML = '<tr><td colspan="5" style="color:#888;">Sin líneas de detalle.</td></tr>';
        }
        return;
    }
    tbody.innerHTML = '';
    lines.forEach(line => {
        const prodId = line.producto_id;
        const qty = line.cantidad || line.cantidad;
        const precio = isCompra ? (line.precio_compra || line.precio_venta || '') : (line.precio_venta || line.precio_compra || '');
        const prodName = (productDataCache[prodId] || {}).nombre || prodId;
        mordAddLine(isCompra, prodId, prodName, Number(qty), Number(precio));
    });
    mordCalcTotals();
}

function mordAddLine(isCompra, prodId = '', prodName = '', qty = 1, precio = 0) {
    const tbody = document.getElementById('mord_items_body');
    // Eliminar el placeholder si existe
    if (tbody.querySelector('td[colspan]')) tbody.innerHTML = '';

    const row = document.createElement('tr');
    const esBorrador = document.getElementById('mord_save_btn').style.display !== 'none';

    const productOptions = cachedData.productos.map(p =>
        `<option value="${p.id}" ${p.id === prodId ? 'selected' : ''}>${p.nombre} (${p.código || p.codigo || ''})</option>`
    ).join('');

    if (esBorrador) {
        row.innerHTML = `
            <td>
                <select class="mord-item-product" style="width:100%;" ${!esBorrador ? 'disabled' : ''}>
                    <option value="">Seleccionar producto...</option>
                    ${productOptions}
                </select>
                <input type="hidden" class="mord-item-id" value="${prodId}">
            </td>
            <td><input type="number" class="mord-item-qty" value="${qty}" min="1" style="width:70px;" ${!esBorrador ? 'disabled' : ''}></td>
            <td><input type="number" class="mord-item-price" value="${precio}" step="0.01" style="width:110px;" ${!esBorrador ? 'disabled' : ''}></td>
            <td class="mord-item-subtotal">${formatCOP(qty * precio)}</td>
            <td><i class="fas fa-trash mord-remove-line" style="cursor:pointer; color:var(--danger-color);"></i></td>
        `;
    } else {
        // Modo solo lectura — incluye data-qty y data-price para que mordCalcTotals pueda leerlos
        row.innerHTML = `
            <td>${prodName || prodId}</td>
            <td data-qty="${qty}">${qty}</td>
            <td data-price="${precio}">${formatCOP(precio)}</td>
            <td>${formatCOP(qty * precio)}</td>
            <td></td>
        `;
        tbody.appendChild(row);
        mordCalcTotals();
        return;
    }

    tbody.appendChild(row);

    const sel = row.querySelector('.mord-item-product');
    const qtyEl = row.querySelector('.mord-item-qty');
    const priceEl = row.querySelector('.mord-item-price');
    const hiddenId = row.querySelector('.mord-item-id');
    const removeBtn = row.querySelector('.mord-remove-line');

    sel.addEventListener('change', () => {
        hiddenId.value = sel.value;
        const prod = productDataCache[sel.value];
        if (prod) {
            priceEl.value = isCompra ? prod.precio_compra : prod.precio_venta;
            mordCalcTotals();
        }
    });
    qtyEl.addEventListener('input', mordCalcTotals);
    priceEl.addEventListener('input', mordCalcTotals);
    removeBtn.addEventListener('click', () => { row.remove(); mordCalcTotals(); });

    mordCalcTotals();
}

function mordCalcTotals() {
    const rows = document.getElementById('mord_items_body').querySelectorAll('tr');
    let subtotal = 0;
    rows.forEach(row => {
        const qtyEl = row.querySelector('.mord-item-qty');
        const priceEl = row.querySelector('.mord-item-price');
        const subtotalEl = row.querySelector('.mord-item-subtotal');
        if (qtyEl && priceEl) {
            // Modo edición: leer desde inputs
            const line = (parseFloat(qtyEl.value) || 0) * (parseFloat(priceEl.value) || 0);
            if (subtotalEl) subtotalEl.textContent = formatCOP(line);
            subtotal += line;
        } else {
            // Modo lectura: leer desde data-attributes en los TD
            const qtyTd = row.querySelector('td[data-qty]');
            const priceTd = row.querySelector('td[data-price]');
            if (qtyTd && priceTd) {
                const line = (parseFloat(qtyTd.dataset.qty) || 0) * (parseFloat(priceTd.dataset.price) || 0);
                subtotal += line;
            }
        }
    });

    const descPct = parseFloat(document.getElementById('mord_descuento').value) || 0;
    const descVal = subtotal * (descPct / 100);
    const subtotalConDesc = subtotal - descVal;
    const applyIva = document.getElementById('mord_apply_iva').checked;
    const iva = applyIva ? subtotalConDesc * 0.19 : 0;
    const total = subtotalConDesc + iva;
    pagoCurrentTotal = total; // Mantener total actualizado para el módulo de pagos

    document.getElementById('mord_base_imponible').textContent = formatCOP(subtotal);
    document.getElementById('mord_iva').textContent = formatCOP(iva);
    document.getElementById('mord_total').textContent = formatCOP(total);

    const descRow = document.getElementById('mord_descuento_row');
    if (descPct > 0) {
        descRow.style.display = '';
        document.getElementById('mord_descuento_val').textContent = '-' + formatCOP(descVal);
    } else {
        descRow.style.display = 'none';
    }

    return total;
}

function mordGetItems(isCompra) {
    const rows = document.getElementById('mord_items_body').querySelectorAll('tr');
    const items = [];
    rows.forEach(row => {
        const hiddenId = row.querySelector('.mord-item-id');
        const qtyEl = row.querySelector('.mord-item-qty');
        const priceEl = row.querySelector('.mord-item-price');
        if (hiddenId && hiddenId.value && qtyEl && priceEl) {
            items.push({
                producto_id: hiddenId.value,
                cantidad: parseInt(qtyEl.value) || 1,
                precio: parseFloat(priceEl.value) || 0
            });
        }
    });
    return items;
}

async function mordSave(pedidoId, tipo, isCompra, suivant = null) {
    const statusEl = document.getElementById('modal_order_status');
    const total = mordCalcTotals();
    const items = mordGetItems(isCompra);

    if (items.length === 0) {
        statusEl.style.display = 'block';
        statusEl.className = 'status-message error';
        statusEl.textContent = 'Debe agregar al menos un producto.';
        return;
    }

    let usuario = '';
    try { usuario = JSON.parse(localStorage.getItem('currentUser') || '{}').usuario || ''; } catch (e) { }

    const payload = {
        action: 'actualizarPedido',
        pedidoId,
        tipo: isCompra ? 'compra' : 'venta',
        contacto: document.getElementById('mord_contacto').value,
        fecha: document.getElementById('mord_fecha').value,
        metodo_pago: document.getElementById('mord_metodo_pago').value,
        notas: document.getElementById('mord_notas').value,
        descuento: parseFloat(document.getElementById('mord_descuento').value) || 0,
        total,
        usuario,
        items
    };

    statusEl.style.display = 'block';
    statusEl.className = 'status-message info';
    statusEl.textContent = 'Guardando...';

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify(payload)
        });
        const data = await res.json();

        if (data.status === 'success') {
            if (suivant === 'confirmar') {
                // Log del guardado previo a confirmar
                await logSystemEvent(pedidoId, 'sistema', `Borrador actualizado antes de confirmar.`);
                // Confirmar el pedido directamente
                const res2 = await fetch(SCRIPT_URL, {
                    method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify({ action: 'confirmarPedido', pedidoId })
                });
                const data2 = await res2.json();
                if (data2.status === 'success') {
                    await logSystemEvent(pedidoId, 'cambio_estado', `Estado cambiado a Confirmado. Stock actualizado.`);
                    showToast(`Pedido ${pedidoId} confirmado exitosamente.`, 'success');
                    closeModal('modalOrderDetails');
                    loadOrdersByType(tipo); loadPedidos();
                } else {
                    statusEl.className = 'status-message error';
                    statusEl.textContent = data2.message;
                }
            } else {
                await logSystemEvent(pedidoId, 'sistema', `Borrador guardado. ${items.length} producto(s).`);
                statusEl.className = 'status-message success';
                statusEl.textContent = data.message;
                showToast(data.message, 'success');
                loadChatter(pedidoId); // Recargar chatter
                loadPedidos();
            }
        } else {
            statusEl.className = 'status-message error';
            statusEl.textContent = data.message;
        }
    } catch (e) {
        statusEl.className = 'status-message error';
        statusEl.textContent = 'Error de conexión: ' + e.message;
    }
}

async function mordChangeState(pedidoId, accion) {
    const statusEl = document.getElementById('modal_order_status');
    const actionAPI = accion === 'confirmar' ? 'confirmarPedido' : accion === 'completar' ? 'completarPedido' : 'cancelarPedido';

    statusEl.style.display = 'block';
    statusEl.className = 'status-message info';
    statusEl.textContent = 'Procesando...';

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: actionAPI, pedidoId })
        });
        const data = await res.json();

        if (data.status === 'success') {
            showToast(data.message, 'success');
            closeModal('modalOrderDetails');
            loadPedidos();
        } else {
            statusEl.className = 'status-message error';
            statusEl.textContent = data.message;
        }
    } catch (e) {
        statusEl.className = 'status-message error';
        statusEl.textContent = 'Error de conexión.';
    }
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

// ========== ENVÍO DE CORREO — FACTURA / COTIZACIÓN ==========

// Variables de contexto del email modal
let emailCurrentPedidoId = null;
let emailCurrentTipo = null;
let emailCurrentEstado = null;
let emailCurrentContacto = null;
let newOrdLastPedidoId = null; // ID del último borrador guardado desde nueva orden

/**
 * Abre el modal de envío de correo con los datos del pedido actual.
 * Se llama desde el botón "Enviar por Correo" en el modal de detalle.
 */
function openEmailModal() {
    try {
        // ── 1. Obtener el ID del pedido activo ───────────────────────
        emailCurrentPedidoId = chatterCurrentRef || null;
        if (!emailCurrentPedidoId) {
            showToast('No hay ningún pedido abierto para enviar.', 'warning');
            return;
        }

        // ── 2. Leer estado del pedido desde el pipeline visual ───────
        //    Buscamos el paso activo en el pipeline (tiene clase 'active')
        const pipelineSteps = ['borrador', 'confirmado', 'completado', 'cancelado'];
        let estadoDetectado = '';
        for (const s of pipelineSteps) {
            const el = document.getElementById('pipe_' + s);
            if (el && el.classList.contains('active')) { estadoDetectado = s; break; }
        }
        emailCurrentEstado = estadoDetectado;

        // ── 3. Determinar tipo (compra/venta) desde el título del modal
        //    El h3 con id modal_order_title contiene "Pedido de Compra/Venta"
        const titleEl = document.getElementById('modal_order_title');
        const titleText = titleEl ? titleEl.textContent.toLowerCase() : '';
        emailCurrentTipo = titleText.includes('compra') ? 'compra' : 'venta';

        // Fallback: leer el ID del pedido desde el label visible si chatterCurrentRef es null
        if (!emailCurrentPedidoId) {
            const idLabel = document.getElementById('modal_order_id_label');
            emailCurrentPedidoId = idLabel ? idLabel.textContent.trim() : null;
            if (!emailCurrentPedidoId) {
                showToast('No se pudo identificar el pedido. Intenta abrirlo de nuevo.', 'warning');
                return;
            }
        }


        // ── 4. Contacto desde el select (puede estar disabled) ───────
        const contactoEl = document.getElementById('mord_contacto');
        if (contactoEl) {
            const idx = contactoEl.selectedIndex;
            emailCurrentContacto = (idx >= 0 && contactoEl.options[idx])
                ? contactoEl.options[idx].text
                : contactoEl.value || '';
        } else {
            emailCurrentContacto = '';
        }

        // ── 5. Tipo de documento según estado ────────────────────────
        const esCotizacion = emailCurrentEstado === 'borrador';
        const tipoDoc = esCotizacion ? 'Cotización' : 'Factura';
        const tipoLabel = emailCurrentTipo === 'compra' ? 'Compra' : 'Venta';

        // ── 6. Actualizar preview del modal de correo ─────────────────
        const docType = document.getElementById('email_doc_type');
        const docRef = document.getElementById('email_doc_ref');
        if (docType) docType.textContent = `${tipoDoc} — Orden de ${tipoLabel}`;
        if (docRef) docRef.textContent = `Ref: ${emailCurrentPedidoId} · ${emailCurrentContacto || '—'}`;

        // ── 7. Limpiar campos ─────────────────────────────────────────
        const destEl = document.getElementById('email_destinatario');
        const ccEl = document.getElementById('email_cc');
        const asuntoEl = document.getElementById('email_asunto');
        const statusEl = document.getElementById('email_status');
        if (destEl) { destEl.value = ''; destEl.style.borderColor = ''; }
        if (ccEl) { ccEl.value = ''; ccEl.style.borderColor = ''; }
        if (asuntoEl) asuntoEl.value = '';
        if (statusEl) { statusEl.style.display = 'none'; statusEl.textContent = ''; }

        // ── 8. Mostrar modal de correo ────────────────────────────────
        // Moverlo al último hijo de body garantiza que siempre esté
        // sobre cualquier otro modal, sin depender de z-index ni stacking contexts.
        const modal = document.getElementById('modalEmail');
        if (!modal) { showToast('Error: modal de correo no encontrado.', 'error'); return; }
        document.body.appendChild(modal); // reubica al tope del DOM
        modal.style.zIndex = '9999';
        modal.style.display = 'flex';
        setTimeout(() => { if (destEl) destEl.focus(); }, 120);


    } catch (err) {
        showToast('Error al abrir el modal de correo: ' + err.message, 'error');
        console.error('[openEmailModal]', err);
    }
}


function closeEmailModal() {
    const modal = document.getElementById('modalEmail');
    if (modal) modal.style.display = 'none';
}

/**
 * Abre el modal de correo desde el formulario de nueva venta.
 * Usa el pedidoId del último borrador guardado (newOrdLastPedidoId).
 */
function openEmailModalFromNew() {
    if (!newOrdLastPedidoId) {
        showToast('Primero guarda el borrador para poder enviar la cotización.', 'warning');
        return;
    }

    // Configurar contexto del email
    emailCurrentPedidoId = newOrdLastPedidoId;
    emailCurrentTipo = 'venta';
    emailCurrentEstado = 'borrador';

    // Leer contacto del formulario activo
    const contactoEl = document.getElementById('newOrd_contacto');
    emailCurrentContacto = contactoEl ? (contactoEl.options[contactoEl.selectedIndex]?.text || '') : '';

    // Actualizar el preview en el modal de correo
    const docType = document.getElementById('email_doc_type');
    const docRef = document.getElementById('email_doc_ref');
    if (docType) docType.textContent = 'Cotización — Venta';
    if (docRef) docRef.textContent = `Ref: ${emailCurrentPedidoId} · ${emailCurrentContacto || '—'}`;

    // Limpiar campos anteriores
    const destEl = document.getElementById('email_destinatario');
    const ccEl = document.getElementById('email_cc');
    const asuntoEl = document.getElementById('email_asunto');
    const statusEl = document.getElementById('email_status');
    if (destEl) { destEl.value = ''; destEl.style.borderColor = ''; }
    if (ccEl) { ccEl.value = ''; ccEl.style.borderColor = ''; }
    if (asuntoEl) asuntoEl.value = '';
    if (statusEl) { statusEl.style.display = 'none'; }

    // Abrir modal de correo — moverlo al tope del DOM para garantizar que
    // aparezca encima de cualquier overlay activo
    const modal = document.getElementById('modalEmail');
    if (modal) {
        document.body.appendChild(modal);
        modal.style.zIndex = '9999';
        modal.style.display = 'flex';
        setTimeout(() => { if (destEl) destEl.focus(); }, 100);
    }
}

/**
 * Envía el correo llamando al backend GAS.
 */
async function submitSendEmail() {
    const destEl = document.getElementById('email_destinatario');
    const asuntoEl = document.getElementById('email_asunto');
    const statusEl = document.getElementById('email_status');
    const sendBtn = document.getElementById('email_send_btn');

    const destinatario = (destEl?.value || '').trim();
    if (!destinatario) {
        showEmailStatus('Escribe el correo del destinatario.', 'error');
        destEl?.focus();
        return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(destinatario)) {
        showEmailStatus('El correo no tiene un formato válido.', 'error');
        destEl?.focus();
        return;
    }
    if (!emailCurrentPedidoId) {
        showEmailStatus('No hay pedido seleccionado.', 'error');
        return;
    }

    // Deshabilitar botón y mostrar spinner
    if (sendBtn) { sendBtn.disabled = true; sendBtn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Enviando...'; }
    showEmailStatus('Generando y enviando...', 'info');

    let usuario = '';
    try { usuario = window.InvAuth?.currentUser?.()?.usuario || 'Usuario'; } catch (e) { }

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'enviarCorreoPedido',
                pedidoId: emailCurrentPedidoId,
                destinatario,
                cc: document.getElementById('email_cc')?.value?.trim() || '',
                asunto: asuntoEl?.value?.trim() || '',
                tipo: emailCurrentTipo,
                usuario
            })
        });
        const data = await res.json();

        if (data.status === 'success') {
            showEmailStatus('✓ ' + data.message, 'success');
            showToast(data.message, 'success');
            // Recargar chatter para ver el registro del envío
            if (chatterCurrentRef) loadChatter(chatterCurrentRef);
            // Cerrar modal tras 2s
            setTimeout(closeEmailModal, 2000);
        } else {
            showEmailStatus('✗ ' + data.message, 'error');
        }
    } catch (e) {
        showEmailStatus('Error de conexión: ' + e.message, 'error');
    } finally {
        if (sendBtn) { sendBtn.disabled = false; sendBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Enviar'; }
    }
}

function showEmailStatus(msg, type) {
    const el = document.getElementById('email_status');
    if (!el) return;
    const styles = {
        success: { bg: '#dcfce7', color: '#166534', border: '#22c55e' },
        error: { bg: '#fee2e2', color: '#991b1b', border: '#ef4444' },
        info: { bg: '#dbeafe', color: '#1e40af', border: '#3b82f6' }
    };
    const s = styles[type] || styles.info;
    el.style.display = 'block';
    el.style.background = s.bg;
    el.style.color = s.color;
    el.style.borderColor = s.border;
    el.textContent = msg;
}

// ========================================================
// MÓDULO DE PAGOS Y CARTERA (ABONOS ESTILO ODOO)
// ========================================================

let pagoCurrentPedidoId = null;
let pagoCurrentSaldo = 0;
let pagoCurrentTotal = 0;

/**
 * Abre el modal de registro de pago pre-rellenado con el saldo pendiente.
 * @param {number} [saldoOverride] — saldo a prellenar (opcional, por defecto usa pagoCurrentSaldo)
 */
function openPagoModal(saldoOverride) {
    if (!chatterCurrentRef) { showToast('No hay pedido abierto.', 'warning'); return; }

    pagoCurrentPedidoId = chatterCurrentRef;
    const saldo = saldoOverride !== undefined ? saldoOverride : pagoCurrentSaldo;

    // Preview del pedido
    const refEl = document.getElementById('modal_order_id_label');
    const titleEl = document.getElementById('modal_order_title');
    const contactoEl = document.getElementById('mord_contacto');
    const pedidoRef = refEl ? refEl.textContent.trim() : pagoCurrentPedidoId;
    const tipoPedido = titleEl ? (titleEl.textContent.toLowerCase().includes('compra') ? 'Compra' : 'Venta') : '';
    const contacto = contactoEl && contactoEl.selectedIndex >= 0
        ? (contactoEl.options[contactoEl.selectedIndex]?.text || '') : '';

    const docRef = document.getElementById('pago_doc_ref');
    const docCon = document.getElementById('pago_doc_contacto');
    const saldoL = document.getElementById('pago_saldo_label');
    if (docRef) docRef.textContent = `Pedido de ${tipoPedido} · ${pedidoRef}`;
    if (docCon) docCon.textContent = contacto;
    if (saldoL) saldoL.textContent = formatCOP(saldo);

    // Resetear formulario
    document.getElementById('pago_fecha').value = new Date().toISOString().split('T')[0];
    document.getElementById('pago_monto').value = Math.round(saldo);
    document.getElementById('pago_metodo').value = 'Efectivo';
    document.getElementById('pago_referencia').value = '';
    document.getElementById('pago_notas').value = '';
    document.getElementById('pago_forzar_pagado').checked = false;
    const stEl = document.getElementById('pago_status');
    if (stEl) { stEl.style.display = 'none'; stEl.textContent = ''; }

    // Mostrar modal encima de todo
    const modal = document.getElementById('modalPago');
    if (modal) {
        document.body.appendChild(modal);
        modal.style.display = 'flex';
        setTimeout(() => document.getElementById('pago_monto')?.focus(), 120);
    }
}

function closePagoModal() {
    const modal = document.getElementById('modalPago');
    if (modal) modal.style.display = 'none';
}

/**
 * Envía el pago al backend y actualiza el banner + la lista de pagos.
 */
async function submitPago() {
    const monto = parseFloat(document.getElementById('pago_monto').value);
    if (!monto || monto <= 0) {
        showPagoStatus('El monto debe ser mayor a cero.', 'error'); return;
    }
    if (!pagoCurrentPedidoId) {
        showPagoStatus('Error: pedido no identificado.', 'error'); return;
    }

    const btn = document.getElementById('pago_submit_btn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-circle-notch fa-spin"></i> Procesando...'; }
    showPagoStatus('Registrando pago...', 'info');

    let usuario = '';
    try { usuario = JSON.parse(localStorage.getItem('currentUser') || '{}').usuario || ''; } catch (e) { }

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'registrarPago',
                pedidoId: pagoCurrentPedidoId,
                fecha: document.getElementById('pago_fecha').value,
                monto,
                metodoPago: document.getElementById('pago_metodo').value,
                referencia: document.getElementById('pago_referencia').value,
                notas: document.getElementById('pago_notas').value,
                forzarPagado: document.getElementById('pago_forzar_pagado').checked,
                usuario
            })
        });
        const data = await res.json();

        if (data.status === 'success') {
            showPagoStatus('✓ ' + data.message, 'success');
            showToast(data.message, 'success');

            // 1. Actualizar estado pago en UI y GlobalData para evitar Race Conditions con la API de Sheets
            pagoCurrentSaldo = data.saldoPendiente !== undefined ? data.saldoPendiente : pagoCurrentSaldo;

            const newPago = {
                id: data.pagoId || 'PAG-TEMP',
                fecha: document.getElementById('pago_fecha').value,
                monto: monto,
                metodo_pago: document.getElementById('pago_metodo').value,
                metodo: document.getElementById('pago_metodo').value,
                referencia: document.getElementById('pago_referencia').value,
                notas: document.getElementById('pago_notas').value
            };
            if (!window.pagosDataGlobal) window.pagosDataGlobal = [];
            window.pagosDataGlobal.push(newPago);

            if (data.totalPagado !== undefined) {
                renderPagosBanner(data.estadoPago, data.totalPagado, pagoCurrentTotal);
                renderPagosHistory(window.pagosDataGlobal, pagoCurrentTotal, pagoCurrentPedidoId);
            }

            // Recargar únicamente el chatter, el pago lo actualizamos localmente
            // await loadPagosPedido(pagoCurrentPedidoId); // Deshabilitado para evitar race-condition con el backend
            if (chatterCurrentRef) loadChatter(chatterCurrentRef);

            // Cerrar modal tras 1.5s
            setTimeout(closePagoModal, 1500);
        } else {
            showPagoStatus('✗ ' + data.message, 'error');
        }
    } catch (e) {
        showPagoStatus('Error de conexión: ' + e.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-check"></i> Registrar Pago'; }
    }
}

function showPagoStatus(msg, type) {
    const el = document.getElementById('pago_status');
    if (!el) return;
    const s = {
        success: { bg: '#dcfce7', color: '#166534', border: '#22c55e' },
        error: { bg: '#fee2e2', color: '#991b1b', border: '#ef4444' },
        info: { bg: '#dbeafe', color: '#1e40af', border: '#3b82f6' }
    }[type] || {};
    el.style.display = 'block';
    el.style.background = s.bg;
    el.style.color = s.color;
    el.style.borderColor = s.border;
    el.textContent = msg;
}

/**
 * Carga los pagos de un pedido y renderiza el banner + lista de abonos.
 */
async function loadPagosPedido(pedidoId) {
    if (!pedidoId) return;
    try {
        const res = await fetch(`${SCRIPT_URL}?action=getPagosPedido&pedidoId=${encodeURIComponent(pedidoId)}`);
        const data = await res.json();
        if (data.status !== 'success') return;

        // Fallback: Compute totalPagado from array if backend doesn't send it directly
        let computedTotalPagado = 0;
        if (data.pagos && Array.isArray(data.pagos)) {
            computedTotalPagado = data.pagos.reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0);
        }

        const totalPedido = pagoCurrentTotal || 0;
        const totalPagado = data.totalPagado !== undefined ? data.totalPagado : computedTotalPagado;
        const saldo = Math.max(0, totalPedido - totalPagado);
        pagoCurrentSaldo = saldo;

        // Inferir estado de pago
        let estadoPago = 'sin_pago';
        if (totalPagado >= totalPedido && totalPedido > 0) estadoPago = 'pagado';
        else if (totalPagado > 0) estadoPago = 'parcial';

        renderPagosBanner(estadoPago, totalPagado, totalPedido);
        renderPagosHistory(data.pagos || [], totalPedido, pedidoId);

        // Guardar pagos globalmente para uso en otros lados (ej. PDF)
        window.pagosDataGlobal = data.pagos || [];

    } catch (e) { console.warn('[loadPagosPedido]', e); }
}

/**
 * Renderiza el banner de estado de pago con barra de progreso.
 */
function renderPagosBanner(estadoPago, totalPagado, total) {
    const banner = document.getElementById('mord_pago_banner');
    const badge = document.getElementById('mord_estado_pago_badge');
    const resumen = document.getElementById('mord_pago_resumen');
    const saldoEl = document.getElementById('mord_pago_saldo');
    const progress = document.getElementById('mord_pago_progress');
    if (!banner) return;

    const pct = total > 0 ? Math.min(100, (totalPagado / total) * 100) : 0;

    const cfg = {
        sin_pago: { label: 'Sin Pago', bg: '#fee2e2', color: '#991b1b', bar: '#ef4444' },
        parcial: { label: 'Pago Parcial', bg: '#fef3c7', color: '#92400e', bar: '#f59e0b' },
        pagado: { label: 'Pagado', bg: '#dcfce7', color: '#166534', bar: '#22c55e' }
    };
    const c = cfg[estadoPago] || cfg.sin_pago;

    badge.textContent = c.label;
    badge.style.background = c.bg;
    badge.style.color = c.color;
    resumen.textContent = `${formatCOP(totalPagado)} de ${formatCOP(total)}`;
    const saldo = Math.max(0, total - totalPagado);
    saldoEl.textContent = saldo > 0 ? `Saldo: ${formatCOP(saldo)}` : '✅ Pagado completo';
    saldoEl.style.color = estadoPago === 'pagado' ? '#22c55e' : '#0ea5e9';
    if (progress) {
        progress.style.background = `linear-gradient(90deg, #0ea5e9, ${c.bar})`;
        progress.style.width = pct + '%';
    }

    banner.style.display = 'block';
}

/**
 * Renderiza la lista de pagos registrados dentro del modal.
 */
function renderPagosHistory(pagos, total, pedidoId) {
    const section = document.getElementById('mord_pagos_section');
    const list = document.getElementById('mord_pagos_list');
    const countBdg = document.getElementById('mord_pagos_count');
    if (!section || !list) return;

    if (!pagos || pagos.length === 0) {
        section.style.display = 'none';
        return;
    }

    section.style.display = 'block';
    if (countBdg) countBdg.textContent = pagos.length;

    const metodosIcons = {
        'Efectivo': '💵', 'Transferencia': '🏦', 'Cheque': '📝',
        'PSE': '💻', 'Tarjeta Crédito': '💳', 'Tarjeta Débito': '💳', 'Otro': '🔄'
    };

    list.innerHTML = pagos.map(p => {
        const monto = parseFloat(p.monto) || 0;
        const fecha = p.fecha ? new Date(p.fecha).toLocaleDateString('es-CO',
            { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
        const icon = metodosIcons[p.metodo_pago] || '💰';
        return `
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;
                    background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;">
            <div style="display:flex;align-items:center;gap:10px;">
                <span style="font-size:1.1rem;">${icon}</span>
                <div>
                    <div style="font-size:0.82rem;font-weight:700;color:#1e293b;">
                        ${p.id} — ${p.metodo_pago || '—'}
                        ${p.referencia ? `<span style="font-weight:400;color:#64748b;">· ${p.referencia}</span>` : ''}
                    </div>
                    <div style="font-size:0.75rem;color:#94a3b8;">${fecha} · ${p.usuario || ''}</div>
                    ${p.notas ? `<div style="font-size:0.75rem;color:#64748b;margin-top:2px;">${p.notas}</div>` : ''}
                </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
                <span style="font-weight:800;font-size:0.95rem;color:#0ea5e9;">${formatCOP(monto)}</span>
                <button onclick="anularPagoFrontend('${p.id}','${pedidoId}')"
                    title="Anular este pago"
                    style="background:none;border:1.5px solid #fca5a5;border-radius:6px;padding:3px 8px;
                           cursor:pointer;color:#ef4444;font-size:0.72rem;font-weight:700;
                           transition:all 0.2s;" onmouseover="this.style.background='#fee2e2'"
                    onmouseout="this.style.background='none'">
                    Anular
                </button>
            </div>
        </div>`;
    }).join('');
}

/**
 * Anula un pago tras confirmación del usuario.
 */
async function anularPagoFrontend(pagoId, pedidoId) {
    if (!confirm(`¿Anular el pago ${pagoId}? Esta acción recalculará el saldo pendiente.`)) return;

    let usuario = '';
    try { usuario = JSON.parse(localStorage.getItem('currentUser') || '{}').usuario || ''; } catch (e) { }

    try {
        const res = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({ action: 'anularPago', pagoId, pedidoId, usuario })
        });
        const data = await res.json();
        if (data.status === 'success') {
            showToast(`Pago ${pagoId} anulado.`, 'success');
            if (data.totalPagado !== undefined) {
                renderPagosBanner(data.estadoPago, data.totalPagado, pagoCurrentTotal);
                pagoCurrentSaldo = Math.max(0, pagoCurrentTotal - data.totalPagado);

                // Actualizar array manual eliminando el pago anulado
                if (window.pagosDataGlobal) {
                    window.pagosDataGlobal = window.pagosDataGlobal.filter(p => p.id !== pagoId);
                    renderPagosHistory(window.pagosDataGlobal, pagoCurrentTotal, pedidoId);
                }
            }
            // await loadPagosPedido(pedidoId); // Deshabilitado temporalmente para evitar race condition
            if (chatterCurrentRef) loadChatter(chatterCurrentRef);
        } else {
            showToast(data.message, 'error');
        }
    } catch (e) { showToast('Error: ' + e.message, 'error'); }

}

function printReceipt() {
    if (!currentPedidoData) return;
    const calc = calculateOrderTotals(currentPedidoData);
    let html = `
    <html><head><title>Recibo - ${currentPedidoData.id}</title>
    <style>
        body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #333; margin: 0; padding: 40px; }
        .header { border-bottom: 2px solid #eee; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; }
        .title { font-size: 24px; color: #1e293b; font-weight: bold; margin: 0; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 40px; margin-bottom: 40px; }
        .label { font-size: 11px; text-transform: uppercase; color: #64748b; margin-bottom: 4px; }
        .val { font-size: 14px; font-weight: 600; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
        th { text-align: left; padding: 10px; border-bottom: 2px solid #333; font-size: 12px; text-transform: uppercase; }
        td { padding: 12px 10px; border-bottom: 1px solid #eee; font-size: 14px; }
        .text-right { text-align: right; }
        .totals { width: 300px; margin-left: auto; border: 1px solid #eee; padding: 20px; border-radius: 8px; }
        .t-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 14px; }
        .t-row.grand { font-size: 18px; font-weight: bold; margin-top: 15px; padding-top: 15px; border-top: 2px solid #333; }
        .pagos-list { margin-top: 50px; }
        .pagos-list h4 { margin-bottom: 15px; font-size: 14px; color: #64748b; text-transform: uppercase; border-bottom: 1px solid #eee; padding-bottom: 10px;}
        .pago-item { display:flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px dashed #eee; font-size: 13.5px; }
    </style></head><body>
    <div class="header">
        <div><h1 class="title">TechFix Solutions</h1><div style="color:#64748b; margin-top:10px; font-size:14px;">Nit: 900.000.000-1<br>Bogotá, Colombia</div></div>
        <div style="text-align:right;"><div class="title" style="color:#0ea5e9;">${currentPedidoData.tipo === 'venta' ? 'Factura de Venta' : 'Cotización'}</div><div style="font-size:18px; color:#64748b; margin-top:5px;"># ${currentPedidoData.id}</div></div>
    </div>
    <div class="info-grid">
        <div><div class="label">Cliente</div><div class="val" style="font-size:16px;">${currentPedidoData.contacto || 'Cliente Mostrador'}</div></div>
        <div><div class="label">Fecha</div><div class="val">${new Date(currentPedidoData.fecha).toLocaleDateString()}</div></div>
    </div>
    <table><thead><tr><th>Descripción</th><th class="text-right">Cantidad</th><th class="text-right">Precio Unitario</th><th class="text-right">Subtotal</th></tr></thead><tbody>`;

    let items = [];
    try { items = typeof currentPedidoData.items === 'string' ? JSON.parse(currentPedidoData.items) : currentPedidoData.items; } catch (e) { }
    items.forEach(it => {
        html += `<tr><td>${it.nombre}</td><td class="text-right">${parseFloat(it.cantidad)}</td><td class="text-right">${formatCOP(it.precio)}</td><td class="text-right">${formatCOP(it.cantidad * it.precio)}</td></tr>`;
    });

    html += `</tbody></table>
            <div class="totals"><div class="t-row"><span>Base Imponible</span><span>${formatCOP(calc.base)}</span></div>
                ${calc.descuento > 0 ? `<div class="t-row" style="color:#ef4444;"><span>Descuento</span><span>-${formatCOP(calc.descuento)}</span></div>` : ''}
                ${calc.iva > 0 ? `<div class="t-row"><span>IVA (19%)</span><span>${formatCOP(calc.iva)}</span></div>` : ''}
                <div class="t-row grand"><span>Total</span><span>${formatCOP(calc.total)}</span></div>
            </div>`;

    if (window.pagosDataGlobal && window.pagosDataGlobal.length > 0) {
        html += `<div class="pagos-list"><h4>Abonos Registrados</h4>`;
        let pagado = 0;
        window.pagosDataGlobal.forEach(p => {
            pagado += parseFloat(p.monto);
            html += `<div class="pago-item"><span>${new Date(p.fecha).toLocaleDateString()} — ${p.metodo} ${p.referencia ? '(' + p.referencia + ')' : ''}</span>
                <span style="font-weight:600; color:#10b981;">-${formatCOP(p.monto)}</span></div>`;
        });
        html += `<div style="display:flex; justify-content:space-between; margin-top:20px; padding:15px; background:#f0f9ff; border-radius:8px; border:1px solid #bae6fd;">
            <span style="font-size:14px; font-weight:bold; color:#0284c7;">IMPORTE ADEUDADO</span>
            <span style="font-size:18px; font-weight:800; color:#0ea5e9;">${formatCOP(Math.max(0, calc.total - pagado))}</span>
        </div></div>`;
    }
    html += `</body></html>`;

    // Inyectarlo en la vista para impresión nativa (nueva ventana)
    const printWin = window.open('', '_blank');
    if (printWin) {
        printWin.document.write(html);
        printWin.document.close();
        printWin.focus();
        setTimeout(() => { printWin.print(); }, 250);
    } else {
        showToast('El navegador bloqueó la ventana emergente de impresión', 'warning');
    }
}