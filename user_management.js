/**
 * user_management.js - Gestión de Usuarios con Modales
 * Reemplaza todos los window.prompt() por modales HTML interactivos.
 */

const SCRIPT_URL_UM = APP_CONFIG.SCRIPT_URL;

// ========== UTILIDADES DE MODALES ==========

function openModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
    const modal = document.getElementById(id);
    modal.style.display = 'none';
    // Limpiar inputs del modal
    modal.querySelectorAll('input').forEach(i => i.value = '');
    modal.querySelectorAll('.status-message').forEach(s => { s.style.display = 'none'; s.innerHTML = ''; });
}

// Cerrar modal al hacer clic fuera
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-overlay')) {
        e.target.style.display = 'none';
    }
});

// ========== INDICADORES DE FORTALEZA ==========

function updatePasswordStrength(password, targetId) {
    const bar = document.getElementById(targetId);
    if (!bar) return;

    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/\d/.test(password)) strength++;
    if (/[^a-zA-Z0-9]/.test(password)) strength++;

    const colors = ['#ff4444', '#ff8800', '#ffcc00', '#88cc00', '#00cc44'];
    const widths = ['20%', '40%', '60%', '80%', '100%'];
    const labels = ['Muy débil', 'Débil', 'Regular', 'Buena', 'Fuerte'];

    const idx = Math.min(strength, 4);
    bar.style.width = password.length > 0 ? widths[idx] : '0%';
    bar.style.backgroundColor = password.length > 0 ? colors[idx] : 'transparent';
    bar.title = password.length > 0 ? labels[idx] : '';
}

// Conectar indicadores de fortaleza
document.addEventListener('DOMContentLoaded', () => {
    const nuPw = document.getElementById('nu_password');
    if (nuPw) {
        nuPw.addEventListener('input', () => updatePasswordStrength(nuPw.value, 'nu_password_strength'));
    }
    const modalPw = document.getElementById('modal_pw_new');
    if (modalPw) {
        modalPw.addEventListener('input', () => updatePasswordStrength(modalPw.value, 'modal_pw_strength'));
    }
});

// ========== CARGAR USUARIOS ==========

async function loadUsers() {
    const tbody = document.getElementById('usersTableBody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="4">Cargando...</td></tr>';

    try {
        const response = await fetch(`${SCRIPT_URL_UM}?action=getData&sheetName=Usuarios`);
        const data = await response.json();

        if (data.status === 'success' && data.data && data.data.length > 0) {
            const currentUser = window.InvAuth ? window.InvAuth.currentUser() : '';
            const currentRole = window.InvAuth ? window.InvAuth.currentUserRole() : '';
            const isAdmin = currentRole === 'Admin';

            tbody.innerHTML = data.data.map(user => {
                const rolBadge = user.rol === 'Admin'
                    ? '<span style="background:#e3f2fd; color:#1565c0; padding:3px 10px; border-radius:12px; font-size:0.85em; font-weight:600;">Admin</span>'
                    : user.rol === 'Bodeguero'
                        ? '<span style="background:#fff3e0; color:#ef6c00; padding:3px 10px; border-radius:12px; font-size:0.85em; font-weight:600;">Bodeguero</span>'
                        : '<span style="background:#e8f5e9; color:#2e7d32; padding:3px 10px; border-radius:12px; font-size:0.85em; font-weight:600;">Vendedor</span>';

                const isSelf = user.usuario && user.usuario.toLowerCase() === (currentUser || '').toLowerCase();

                // Acciones
                let actions = '';
                if (isAdmin) {
                    actions += `<button class="btn-icon" title="Cambiar Rol" onclick="openEditRoleModal('${user.usuario}', '${user.rol}')"><i class="fas fa-user-tag"></i></button> `;
                    actions += `<button class="btn-icon" title="Resetear Contraseña" onclick="openResetPasswordModal('${user.usuario}')"><i class="fas fa-key"></i></button> `;
                    if (!isSelf) {
                        actions += `<button class="btn-icon danger" title="Eliminar" onclick="openDeleteUserModal('${user.usuario}')"><i class="fas fa-trash"></i></button>`;
                    }
                }
                if (isSelf) {
                    actions += ` <button class="btn-icon" title="Cambiar Mi Contraseña" onclick="openChangePasswordModal('${user.usuario}')"><i class="fas fa-lock"></i></button>`;
                }

                const fecha = user.fecha_creacion ? new Date(user.fecha_creacion).toLocaleDateString() : 'N/A';

                return `<tr>
                    <td>${user.usuario} ${isSelf ? '<small style="color:#888;">(tú)</small>' : ''}</td>
                    <td>${rolBadge}</td>
                    <td>${fecha}</td>
                    <td>${actions}</td>
                </tr>`;
            }).join('');
        } else {
            tbody.innerHTML = '<tr><td colspan="4">No hay usuarios registrados.</td></tr>';
        }
    } catch (error) {
        tbody.innerHTML = `<tr><td colspan="4" style="color:var(--danger-color);">Error al cargar: ${error.message}</td></tr>`;
    }
}

// ========== CREAR USUARIO (con campo admin key en formulario) ==========

async function handleCreateUser(e) {
    e.preventDefault();

    const usuario = document.getElementById('nu_username').value.trim();
    const password = document.getElementById('nu_password').value;
    const password2 = document.getElementById('nu_password2').value;
    const rol = document.getElementById('nu_rol').value;
    const adminKey = document.getElementById('nu_adminkey').value;

    if (!usuario || !password) {
        displayStatus('statusNewUser', 'error', 'Usuario y contraseña son requeridos.');
        return;
    }
    if (password.length < 6) {
        displayStatus('statusNewUser', 'error', 'La contraseña debe tener al menos 6 caracteres.');
        return;
    }
    if (!/\d/.test(password)) {
        displayStatus('statusNewUser', 'error', 'La contraseña debe contener al menos un número.');
        return;
    }
    if (password !== password2) {
        displayStatus('statusNewUser', 'error', 'Las contraseñas no coinciden.');
        return;
    }
    if (!adminKey) {
        displayStatus('statusNewUser', 'error', 'Ingrese la clave de administrador.');
        return;
    }

    displayStatus('statusNewUser', 'info', 'Creando usuario...');

    try {
        const response = await fetch(SCRIPT_URL_UM, {
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
            document.getElementById('nu_password_strength').style.width = '0%';
            loadUsers();
            showToast(`Usuario '${usuario}' creado exitosamente`, 'success');
        } else {
            displayStatus('statusNewUser', 'error', data.message || 'Error al crear usuario');
        }
    } catch (error) {
        displayStatus('statusNewUser', 'error', 'Error de conexión: ' + error.message);
    }
}

// ========== MODAL: EDITAR ROL ==========

function openEditRoleModal(usuario, currentRole) {
    document.getElementById('modal_role_user').textContent = usuario;
    document.getElementById('modal_role_select').value = currentRole;
    document.getElementById('modal_role_adminkey').value = '';
    document.getElementById('modal_role_status').style.display = 'none';
    openModal('modalEditRole');

    // Configurar botón guardar
    const saveBtn = document.getElementById('modal_role_save');
    saveBtn.onclick = async () => {
        const nuevoRol = document.getElementById('modal_role_select').value;
        const adminKey = document.getElementById('modal_role_adminkey').value;

        if (!adminKey) {
            document.getElementById('modal_role_status').style.display = 'block';
            document.getElementById('modal_role_status').className = 'status-message error';
            document.getElementById('modal_role_status').innerHTML = '<i class="fas fa-times-circle"></i> Ingrese la clave admin.';
            return;
        }

        saveBtn.disabled = true;
        try {
            const response = await fetch(SCRIPT_URL_UM, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'updateUserRole', usuario, nuevoRol, adminKey })
            });
            const data = await response.json();

            if (data.status === 'success') {
                showToast(data.message, 'success');
                closeModal('modalEditRole');
                loadUsers();
            } else {
                document.getElementById('modal_role_status').style.display = 'block';
                document.getElementById('modal_role_status').className = 'status-message error';
                document.getElementById('modal_role_status').innerHTML = `<i class="fas fa-times-circle"></i> ${data.message}`;
            }
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        } finally {
            saveBtn.disabled = false;
        }
    };
}

// ========== MODAL: CAMBIAR CONTRASEÑA (propio usuario) ==========

function openChangePasswordModal(usuario) {
    document.getElementById('modal_pw_title').textContent = 'Cambiar Mi Contraseña';
    document.getElementById('modal_pw_user').textContent = usuario;
    document.getElementById('modal_pw_current_group').style.display = 'block';
    document.getElementById('modal_pw_adminkey_group').style.display = 'none';
    document.getElementById('modal_pw_status').style.display = 'none';
    document.getElementById('modal_pw_strength').style.width = '0%';
    openModal('modalPassword');

    const saveBtn = document.getElementById('modal_pw_save');
    saveBtn.onclick = async () => {
        const current = document.getElementById('modal_pw_current').value;
        const newPw = document.getElementById('modal_pw_new').value;
        const confirm = document.getElementById('modal_pw_confirm').value;
        const statusEl = document.getElementById('modal_pw_status');

        if (!current || !newPw || !confirm) {
            statusEl.style.display = 'block';
            statusEl.className = 'status-message error';
            statusEl.innerHTML = '<i class="fas fa-times-circle"></i> Todos los campos son requeridos.';
            return;
        }
        if (newPw.length < 6 || !/\d/.test(newPw)) {
            statusEl.style.display = 'block';
            statusEl.className = 'status-message error';
            statusEl.innerHTML = '<i class="fas fa-times-circle"></i> La nueva contraseña debe tener al menos 6 caracteres y 1 número.';
            return;
        }
        if (newPw !== confirm) {
            statusEl.style.display = 'block';
            statusEl.className = 'status-message error';
            statusEl.innerHTML = '<i class="fas fa-times-circle"></i> Las contraseñas no coinciden.';
            return;
        }

        saveBtn.disabled = true;
        try {
            const response = await fetch(SCRIPT_URL_UM, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'cambiarPassword', usuario, passwordActual: current, passwordNueva: newPw })
            });
            const data = await response.json();

            if (data.status === 'success') {
                showToast(data.message, 'success');
                closeModal('modalPassword');
            } else {
                statusEl.style.display = 'block';
                statusEl.className = 'status-message error';
                statusEl.innerHTML = `<i class="fas fa-times-circle"></i> ${data.message}`;
            }
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        } finally {
            saveBtn.disabled = false;
        }
    };
}

// ========== MODAL: RESETEAR CONTRASEÑA (admin sobre otro usuario) ==========

function openResetPasswordModal(usuario) {
    document.getElementById('modal_pw_title').textContent = 'Resetear Contraseña';
    document.getElementById('modal_pw_user').textContent = usuario;
    document.getElementById('modal_pw_current_group').style.display = 'none';
    document.getElementById('modal_pw_adminkey_group').style.display = 'block';
    document.getElementById('modal_pw_status').style.display = 'none';
    document.getElementById('modal_pw_strength').style.width = '0%';
    openModal('modalPassword');

    const saveBtn = document.getElementById('modal_pw_save');
    saveBtn.onclick = async () => {
        const adminKey = document.getElementById('modal_pw_adminkey').value;
        const newPw = document.getElementById('modal_pw_new').value;
        const confirm = document.getElementById('modal_pw_confirm').value;
        const statusEl = document.getElementById('modal_pw_status');

        if (!adminKey || !newPw || !confirm) {
            statusEl.style.display = 'block';
            statusEl.className = 'status-message error';
            statusEl.innerHTML = '<i class="fas fa-times-circle"></i> Todos los campos son requeridos.';
            return;
        }
        if (newPw !== confirm) {
            statusEl.style.display = 'block';
            statusEl.className = 'status-message error';
            statusEl.innerHTML = '<i class="fas fa-times-circle"></i> Las contraseñas no coinciden.';
            return;
        }

        saveBtn.disabled = true;
        try {
            const response = await fetch(SCRIPT_URL_UM, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'resetPassword', usuario, passwordNueva: newPw, adminKey })
            });
            const data = await response.json();

            if (data.status === 'success') {
                showToast(data.message, 'success');
                closeModal('modalPassword');
            } else {
                statusEl.style.display = 'block';
                statusEl.className = 'status-message error';
                statusEl.innerHTML = `<i class="fas fa-times-circle"></i> ${data.message}`;
            }
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        } finally {
            saveBtn.disabled = false;
        }
    };
}

// ========== MODAL: ELIMINAR USUARIO ==========

function openDeleteUserModal(usuario) {
    document.getElementById('modal_del_user').textContent = usuario;
    document.getElementById('modal_del_adminkey').value = '';
    document.getElementById('modal_del_status').style.display = 'none';
    openModal('modalDeleteUser');

    const confirmBtn = document.getElementById('modal_del_confirm');
    confirmBtn.onclick = async () => {
        const adminKey = document.getElementById('modal_del_adminkey').value;
        const statusEl = document.getElementById('modal_del_status');

        if (!adminKey) {
            statusEl.style.display = 'block';
            statusEl.className = 'status-message error';
            statusEl.innerHTML = '<i class="fas fa-times-circle"></i> Ingrese la clave admin.';
            return;
        }

        confirmBtn.disabled = true;
        try {
            const response = await fetch(SCRIPT_URL_UM, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'deleteUser', usuario, adminKey })
            });
            const data = await response.json();

            if (data.status === 'success') {
                showToast(data.message, 'success');
                closeModal('modalDeleteUser');
                loadUsers();
            } else {
                statusEl.style.display = 'block';
                statusEl.className = 'status-message error';
                statusEl.innerHTML = `<i class="fas fa-times-circle"></i> ${data.message}`;
            }
        } catch (error) {
            showToast('Error: ' + error.message, 'error');
        } finally {
            confirmBtn.disabled = false;
        }
    };
}

// ========== INICIALIZACIÓN ==========

document.addEventListener('DOMContentLoaded', () => {
    const newUserForm = document.getElementById('newUserForm');
    if (newUserForm) {
        newUserForm.addEventListener('submit', handleCreateUser);
    }

    const refreshBtn = document.getElementById('refreshUsersBtn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadUsers);
    }
});
