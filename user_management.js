// ========== USER MANAGEMENT FUNCTIONS ==========

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '<tr><td colspan="4">Cargando usuarios...</td></tr>';

    try {
        const response = await fetch(`${SCRIPT_URL}?action=getData&sheetName=Usuarios`);
        const data = await response.json();

        if (data.status === 'success' && data.data && data.data.length > 0) {
            tbody.innerHTML = data.data.map(user => {
                const rolBadge = getRolBadge(user.rol || 'Vendedor');
                const fecha = user.created ? new Date(user.created).toLocaleDateString() : 'N/A';

                return `
                    <tr>
                        <td><strong>${user.usuario}</strong></td>
                        <td>${rolBadge}</td>
                        <td>${fecha}</td>
                        <td>
                            <button class="btn-icon" onclick="editUserRole('${user.usuario}')" title="Editar Rol">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn-icon danger" onclick="deleteUser('${user.usuario}')" title="Eliminar Usuario">
                                <i class="fas fa-trash"></i>
                            </button>
                        </td>
                    </tr>
                `;
            }).join('');
            showToast(`${data.data.length} usuarios cargados`, 'success');
        } else {
            tbody.innerHTML = '<tr><td colspan="4">No hay usuarios registrados</td></tr>';
        }
    } catch (error) {
        tbody.innerHTML = '<tr><td colspan="4">Error al cargar usuarios</td></tr>';
        showToast('Error al cargar usuarios: ' + error.message, 'error');
    }
}

function getRolBadge(rol) {
    const badges = {
        'Admin': '<span style="background: #dc3545; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: 600;">Admin</span>',
        'Vendedor': '<span style="background: #28a745; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: 600;">Vendedor</span>',
        'Bodeguero': '<span style="background: #007bff; color: white; padding: 4px 12px; border-radius: 12px; font-size: 0.85em; font-weight: 600;">Bodeguero</span>'
    };
    return badges[rol] || badges['Vendedor'];
}

async function handleCreateUser(e) {
    e.preventDefault();

    const usuario = document.getElementById('nu_username').value.trim();
    const password = document.getElementById('nu_password').value;
    const rol = document.getElementById('nu_rol').value;

    if (!usuario || !password) {
        displayStatus('statusNewUser', 'error', 'Usuario y contraseña son requeridos');
        return;
    }

    // Solicitar clave admin
    const adminKey = window.prompt('Ingrese la clave de administrador para autorizar la creación:');
    if (!adminKey) {
        displayStatus('statusNewUser', 'warning', 'Operación cancelada');
        return;
    }

    displayStatus('statusNewUser', 'info', 'Creando usuario...');

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'createUserInternal',
                usuario,
                password,
                rol,
                adminKey
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            displayStatus('statusNewUser', 'success', data.message);
            document.getElementById('newUserForm').reset();
            loadUsers(); // Recargar tabla
            showToast(`Usuario '${usuario}' creado exitosamente`, 'success');
        } else {
            displayStatus('statusNewUser', 'error', data.message || 'Error al crear usuario');
        }
    } catch (error) {
        displayStatus('statusNewUser', 'error', 'Error de conexión: ' + error.message);
    }
}

async function editUserRole(usuario) {
    const nuevoRol = window.prompt(`Cambiar rol de '${usuario}' a:\n1. Admin\n2. Vendedor\n3. Bodeguero\n\nIngrese el nombre del rol:`);
    if (!nuevoRol) return;

    const rolesValidos = ['Admin', 'Vendedor', 'Bodeguero'];
    const rolCapitalizado = nuevoRol.charAt(0).toUpperCase() + nuevoRol.slice(1).toLowerCase();

    if (!rolesValidos.includes(rolCapitalizado)) {
        showToast('Rol inválido. Use: Admin, Vendedor o Bodeguero', 'error');
        return;
    }

    const adminKey = window.prompt('Ingrese clave de administrador:');
    if (!adminKey) return;

    showToast('Actualizando rol...', 'info');

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'updateUserRole',
                usuario,
                nuevoRol: rolCapitalizado,
                adminKey
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            showToast(data.message, 'success');
            loadUsers();
        } else {
            showToast(data.message || 'Error al actualizar rol', 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}

async function deleteUser(usuario) {
    if (!confirm(`¿Está seguro de eliminar al usuario '${usuario}'?\n\nEsta acción no se puede deshacer.`)) {
        return;
    }

    const adminKey = window.prompt('Ingrese clave de administrador para confirmar:');
    if (!adminKey) return;

    showToast('Eliminando usuario...', 'info');

    try {
        const response = await fetch(SCRIPT_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
                action: 'deleteUser',
                usuario,
                adminKey
            })
        });

        const data = await response.json();

        if (data.status === 'success') {
            showToast(data.message, 'success');
            loadUsers();
        } else {
            showToast(data.message || 'Error al eliminar usuario', 'error');
        }
    } catch (error) {
        showToast('Error: ' + error.message, 'error');
    }
}
