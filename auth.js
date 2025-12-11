// auth.js - maneja registro/login usando LocalStorage y hash SHA-256
(function(){
    'use strict';

    // Helper: convertir ArrayBuffer a hex
    function toHex(buffer){
        return Array.from(new Uint8Array(buffer)).map(b=>b.toString(16).padStart(2,'0')).join('');
    }

    async function hashPassword(password){
        const enc = new TextEncoder();
        const data = enc.encode(password);
        const hash = await crypto.subtle.digest('SHA-256', data);
        return toHex(hash);
    }

    function getUsers(){
        try{
            const raw = localStorage.getItem('inv_users');
            return raw ? JSON.parse(raw) : {};
        }catch(e){return {}};
    }

    function saveUsers(users){
        localStorage.setItem('inv_users', JSON.stringify(users));
    }

    // Registro público DESHABILITADO: creación de usuarios solo mediante funciones internas seguras.
    async function register(username, password){
        throw new Error('Registro público deshabilitado. Use funciones internas de administración.');
    }

    // Crear usuario internamente (requiere clave admin almacenada en localStorage under 'inv_admin_key')
    async function createUserInternal(username, password, adminKey){
        username = String(username).trim();
        if(!username) throw new Error('Usuario inválido');
        if(typeof password !== 'string' || password.length < 4) throw new Error('Contraseña muy corta (mín 4 caracteres)');

        const storedKey = localStorage.getItem('inv_admin_key');
        if(!storedKey) throw new Error('Clave admin no configurada. Configure "inv_admin_key" en localStorage para habilitar creación interna.');
        if(adminKey !== storedKey) throw new Error('Clave admin inválida.');

        const users = getUsers();
        if(users[username]) throw new Error('El usuario ya existe');

        const hashed = await hashPassword(password);
        users[username] = { hash: hashed, created: new Date().toISOString() };
        saveUsers(users);
        return true;
    }

    // Intentar autenticación contra el servidor Apps Script; si falla la red, usar respaldo local
    async function login(username, password){
        username = String(username).trim();

        // URL del Web App (coincide con SCRIPT_URL en script.js)
        const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwYg0MptACyrUfnDQNmC5Z6r5VLtB7i4kQ9WRtSFdOn-WxTy7JBZPbO5EwoUkCXgPmt/exec';

        // Primero intentar autenticación remota
        try{
            const resp = await fetch(SCRIPT_URL, {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify({ action: 'authLogin', usuario: username, password: password })
            });

            const data = await resp.json();
            if(data && data.status === 'success'){
                localStorage.setItem('inv_current_user', username);
                return true;
            }
            // Si el servidor responde con error de credenciales, lanzar
            if(data && data.status === 'error'){
                throw new Error(data.message || 'Credenciales inválidas');
            }
        }catch(serverErr){
            // Si hay fallo de red/servidor, intentamos respaldo local
            console.warn('Auth servidor falló:', serverErr && serverErr.message);
            const users = getUsers();
            const entry = users[username];
            if(!entry) throw new Error('Usuario no encontrado (y servidor no disponible)');
            const hashed = await hashPassword(password);
            if(hashed !== entry.hash) throw new Error('Contraseña incorrecta (y servidor no disponible)');
            localStorage.setItem('inv_current_user', username);
            return true;
        }

        // Si llegamos aquí, no fue posible autenticar
        throw new Error('Autenticación fallida');
    }

    function logout(){
        localStorage.removeItem('inv_current_user');
    }

    function currentUser(){
        return localStorage.getItem('inv_current_user') || null;
    }

    // Exponer funciones globales mínimas
    window.InvAuth = { register, createUserInternal, login, logout, currentUser, getUsers };

    // UI wiring for login.html if present
    document.addEventListener('DOMContentLoaded', () => {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const showLoginBtn = document.getElementById('showLoginBtn');
        const showRegisterBtn = document.getElementById('showRegisterBtn');

        function show(el){ el.classList.remove('hidden'); }
        function hide(el){ el.classList.add('hidden'); }

        if(showLoginBtn && showRegisterBtn){
            showLoginBtn.addEventListener('click', ()=>{ show(loginForm); hide(registerForm); });
            showRegisterBtn.addEventListener('click', ()=>{ show(registerForm); hide(loginForm); });
        }

        if(registerForm){
            registerForm.addEventListener('submit', async (e)=>{
                e.preventDefault();
                const u = document.getElementById('reg_user').value;
                const p = document.getElementById('reg_pass').value;
                const p2 = document.getElementById('reg_pass2').value;
                const msg = document.getElementById('regMessage');
                try{
                    msg.className = 'status-message info';
                    msg.innerText = 'Registrando...';
                    if(p !== p2) throw new Error('Las contraseñas no coinciden');
                    await register(u,p);
                    msg.className = 'status-message success';
                    msg.innerText = 'Cuenta creada. Ahora puedes iniciar sesión.';
                    registerForm.reset();
                }catch(err){
                    msg.className = 'status-message error';
                    msg.innerText = err.message || 'Error';
                }
            });
        }

        if(loginForm){
            loginForm.addEventListener('submit', async (e)=>{
                e.preventDefault();
                const u = document.getElementById('login_user').value;
                const p = document.getElementById('login_pass').value;
                const msg = document.getElementById('loginMessage');
                try{
                    msg.className = 'status-message info';
                    msg.innerText = 'Validando...';
                    await login(u,p);
                    msg.className = 'status-message success';
                    msg.innerText = 'Acceso correcto. Redirigiendo...';
                    setTimeout(()=>{ window.location.href = 'index.html'; }, 600);
                }catch(err){
                    msg.className = 'status-message error';
                    msg.innerText = err.message || 'Error';
                }
            });
        }
    });

})();
