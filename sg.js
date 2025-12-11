// ***************************************************************
// ⚠️ 1. REEMPLAZA ESTE VALOR con el ID real de tu Google Sheet
// ***************************************************************
const SPREADSHEET_ID = "1w45ywL7Od23HfYqZDhrfbA7hgVjiRsxW4OxX4HPeRbY"; 

// Nombres de las pestañas
const HOJA_CATEGORIAS = "Categorias";
const HOJA_PRODUCTOS = "Productos";
const HOJA_COMPRAS = "Compras";
const HOJA_VENTAS = "Ventas";
const HOJA_RESUMEN = "resumen_diario";
const HOJA_USUARIOS = "Usuarios";

// Encabezados
const CATEGORIAS_HEADERS = ["id", "nombre"];
const PRODUCTOS_HEADERS = ["id", "nombre", "código", "categoría", "precio_compra", "precio_venta", "stock", "fecha_creado"];
const COMPRAS_HEADERS = ["id", "producto_id", "cantidad", "precio_compra", "fecha", "proveedor"];
const VENTAS_HEADERS = ["id", "producto_id", "cantidad", "precio_venta", "fecha", "cliente"];
const RESUMEN_HEADERS = ["fecha", "total_ventas", "total_compras", "ganancia", "productos_vendidos"];
const USUARIOS_HEADERS = ["usuario", "hash", "created"];
// Credenciales por defecto (se crearán automáticamente al inicializar la BD)
const DEFAULT_ADMIN_USER = "admin";
const DEFAULT_ADMIN_PASS = "admin";
// Clave admin fija (fallback) para crear usuarios si no está en Script Properties
const ADMIN_KEY_CONST = "Excol123**";

// --- FUNCIÓN CENTRAL PARA ACCEDER A LA HOJA ---
function getSpreadsheet() {
    return SpreadsheetApp.openById(SPREADSHEET_ID);
}

// 🔑 FUNCIÓN CORREGIDA: Generación de ID Único
function generateUniqueAppId() {
    return 'id-' + (new Date().getTime().toString(36) + Math.random().toString(36).substring(2, 9)).toUpperCase();
}

// ----------------------------------------------------------------------
// ENTRADA PRINCIPAL PARA SOLICITUDES GET
// ----------------------------------------------------------------------
function doGet(e) {
    const action = e.parameter.action;
    const query = e.parameter.query;
    const sheetName = e.parameter.sheetName;
    let result;

    try {
        if (action === "iniciar" || action === "resetear") {
            result = action === "iniciar" ? iniciarBaseDeDatos() : resetearBaseDeDatos();
        } else if (action === "getCategorias") {
            result = getCategorias();
        } else if (action === "buscarProducto") {
            result = buscarProducto(query); 
        } else if (action === "getInventario") {
            result = getInventario();
        } else if (action === "getResumenDiario") {
            result = getResumenDiario();
        } else if (action === "getData" && sheetName) {
            result = getData(sheetName);
        } else {
            result = { status: "error", message: `Acción GET '${action}' no válida o faltan parámetros.` };
        }
    } catch (error) {
        result = { status: "error", message: `Error en doGet: ${error.message}` };
    }

    return ContentService.createTextOutput(JSON.stringify(result))
           .setMimeType(ContentService.MimeType.JSON);
}

// ----------------------------------------------------------------------
// ENTRADA PRINCIPAL PARA SOLICITUDES POST
// ----------------------------------------------------------------------
function doPost(e) {
    try {
        if (!e.postData || !e.postData.contents) {
            return ContentService.createTextOutput(JSON.stringify({ 
                status: "error", 
                message: "No se recibieron datos en la solicitud POST." 
            })).setMimeType(ContentService.MimeType.JSON);
        }
        
        const requestData = JSON.parse(e.postData.contents);
        const action = requestData.action;

        let result;
        if (action === "agregarCategoria") {
            result = agregarCategoria(requestData);
        } else if (action === "agregarProducto") {
            result = agregarProducto(requestData);
        } else if (action === "registrarTransaccion") {
            result = registrarTransaccion(requestData);
        } else if (action === 'authLogin') {
            result = authLogin(requestData);
        } else if (action === 'createUserInternal') {
            result = createUserInternal(requestData);
        } else if (action === 'migrateUsersToHash') {
            result = migrateUsersToHash(requestData);
        } else {
            result = { status: "error", message: "Acción POST no reconocida." };
        }
        
        return ContentService.createTextOutput(JSON.stringify(result))
               .setMimeType(ContentService.MimeType.JSON);

    } catch (error) {
        return ContentService.createTextOutput(JSON.stringify({ 
            status: "error", 
            message: `Error al procesar la solicitud POST: ${error.message}` 
        })).setMimeType(ContentService.MimeType.JSON);
    }
}

// ----------------------------------------------------------------------
// FUNCIONES DE GESTIÓN DE CATEGORÍAS
// ----------------------------------------------------------------------
function getCategorias() {
    return getData(HOJA_CATEGORIAS);
}

function agregarCategoria(data) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(HOJA_CATEGORIAS);

    if (!sheet) {
        return { status: "error", message: `La pestaña '${HOJA_CATEGORIAS}' no existe. Inicie la Base de Datos.` };
    }

    const newId = generateUniqueAppId();
    
    const newRow = [
        newId,
        data.nombre
    ];

    try {
        sheet.appendRow(newRow);
        return { status: "success", message: `Categoría '${data.nombre}' agregada (ID: ${newId}).` };
    } catch (e) {
        return { status: "error", message: `Error al escribir categoría: ${e.message}` };
    }
}

// ----------------------------------------------------------------------
// FUNCIONES DE GESTIÓN DE PRODUCTOS Y BÚSQUEDA
// ----------------------------------------------------------------------
function getInventario() {
    return getData(HOJA_PRODUCTOS);
}

function buscarProducto(query) {
    const data = getData(HOJA_PRODUCTOS);

    if (data.status !== 'success') return data;
    
    const products = data.data;
    const lowerQuery = query.toLowerCase().trim();

    if (lowerQuery.length === 0) {
        return { status: "warning", message: "Especifique un ID, Código o Nombre para buscar." };
    }

    // Filtra productos por ID, Código, o Nombre - CONVERSIÓN SEGURA A STRING
    const results = products.filter(p => {
        // Convertir todos los valores a string de forma segura
        const idStr = String(p.id || '');
        const codigoStr = String(p.código || '');
        const nombreStr = String(p.nombre || '');

        return idStr.toLowerCase().includes(lowerQuery) ||
               codigoStr.toLowerCase().includes(lowerQuery) ||
               nombreStr.toLowerCase().includes(lowerQuery);
    });

    if (results.length > 0) {
        return { status: "success", data: results, message: `${results.length} coincidencias encontradas.` };
    } else {
        return { status: "warning", message: "Producto no encontrado." };
    }
}

function agregarProducto(data) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(HOJA_PRODUCTOS);

    if (!sheet) {
        return { status: "error", message: `La pestaña '${HOJA_PRODUCTOS}' no existe. Inicie la Base de Datos.` };
    }
    
    const newId = generateUniqueAppId();

    const newRow = [
        newId,
        data.nombre,
        data.codigo,
        data.categoria,
        parseFloat(data.precio_compra),
        parseFloat(data.precio_venta),
        parseInt(data.stock),
        new Date()
    ];

    try {
        sheet.appendRow(newRow);
        return { status: "success", message: `Producto '${data.nombre}' registrado con éxito. ID: ${newId}` };
    } catch (e) {
        return { status: "error", message: `Error al escribir producto: ${e.message}` };
    }
}

// ----------------------------------------------------------------------
// FUNCIONES DE GESTIÓN DE TRANSACCIONES (COMPRAS/VENTAS)
// ----------------------------------------------------------------------
function registrarTransaccion(data) {
    const ss = getSpreadsheet();
    const action = data.type; // 'compra' o 'venta'
    const isCompra = action === "compra";
    const sheetName = isCompra ? HOJA_COMPRAS : HOJA_VENTAS;
    const sheet = ss.getSheetByName(sheetName);
    const sheetProductos = ss.getSheetByName(HOJA_PRODUCTOS);

    if (!sheet || !sheetProductos) {
        return { status: "error", message: `Una o más pestañas necesarias no existen. Inicie la Base de Datos.` };
    }

    // 1. Validar producto y obtener fila actual
    const { rowData, rowIndex } = findProductRow(sheetProductos, data.producto_id);
    
    if (rowIndex === -1) {
        return { status: "error", message: `Producto ID ${data.producto_id} no encontrado en inventario.` };
    }
    
    // 2. Obtener datos actuales del producto
    const stockColIndex = 6;
    const precioCompraColIndex = 4;
    const precioVentaColIndex = 5;
    
    const cantidad = parseInt(data.cantidad);
    const precioTransaccion = parseFloat(data.precio);
    
    let stockActual = parseFloat(rowData[stockColIndex]) || 0;
    let nuevoStock;

    // 3. Validar stock para ventas
    if (!isCompra) {
        if (stockActual < cantidad) {
            return { 
                status: "warning", 
                message: `Stock insuficiente. Solo hay ${stockActual} unidades disponibles para la venta de ${cantidad} unidades.` 
            };
        }
        nuevoStock = stockActual - cantidad;
    } else {
        nuevoStock = stockActual + cantidad;
    }

    // 4. Escribir nueva transacción
    const transaccionId = generateUniqueAppId(); 
    const newRow = [
        transaccionId,
        data.producto_id,
        cantidad,
        precioTransaccion,
        new Date(),
        data.extra_data || ''
    ];

    try {
        sheet.appendRow(newRow);
    } catch (e) {
        return { status: "error", message: `Error al registrar transacción: ${e.message}` };
    }

    // 5. Actualizar stock del producto
    try {
        sheetProductos.getRange(rowIndex + 1, stockColIndex + 1).setValue(nuevoStock);
        
        // 6. Actualizar precio si es diferente
        if (isCompra) {
            const precioActualCompra = parseFloat(rowData[precioCompraColIndex]) || 0;
            if (precioTransaccion !== precioActualCompra) {
                sheetProductos.getRange(rowIndex + 1, precioCompraColIndex + 1).setValue(precioTransaccion);
            }
        } else {
            const precioActualVenta = parseFloat(rowData[precioVentaColIndex]) || 0;
            if (precioTransaccion !== precioActualVenta) {
                sheetProductos.getRange(rowIndex + 1, precioVentaColIndex + 1).setValue(precioTransaccion);
            }
        }

        return { 
            status: "success", 
            message: `${isCompra ? 'Compra' : 'Venta'} registrada exitosamente. Stock actualizado: ${nuevoStock} unidades.` 
        };

    } catch (e) {
        // Si falla la actualización, revertir la transacción
        sheet.deleteRow(sheet.getLastRow());
        return { status: "error", message: `Error al actualizar inventario: ${e.message}` };
    }
}

// ----------------------------------------------------------------------
// FUNCIÓN PARA OBTENER RESUMEN DIARIO
// ----------------------------------------------------------------------
function getResumenDiario() {
    return getData(HOJA_RESUMEN);
}

// ----------------------------------------------------------------------
// FUNCIONES DE UTILIDAD GENERAL
// ----------------------------------------------------------------------
function getData(sheetName) {
    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet || sheet.getLastRow() < 2) {
        return { status: "error", message: `Pestaña '${sheetName}' vacía o no existe.` };
    }

    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const rows = data.slice(1);

    const mappedData = rows.map(row => {
        let entry = {};
        headers.forEach((header, index) => {
            let value = row[index];
            
            // Manejar valores vacíos
            if (value === '' || value === null || value === undefined) {
                value = '';
            }
            // Si es número, mantenerlo como número
            else if (typeof value === 'number') {
                value = value;
            }
            // Si es string que representa número, convertirlo a número
            else if (typeof value === 'string' && !isNaN(value) && value.trim() !== '') {
                // Para códigos, mantener como string si tiene letras
                if (header === 'código' && /[a-zA-Z]/.test(value)) {
                    value = value; // Mantener como string
                } else {
                    value = parseFloat(value);
                }
            }
            // Si es fecha, dejarla como está
            else if (value instanceof Date) {
                // Mantener como Date
            }
            // Para cualquier otro caso, asegurar que sea string
            else {
                value = String(value);
            }
            
            entry[header] = value;
        });
        return entry;
    });

    // Filtrar filas completamente vacías
    const filteredData = mappedData.filter(entry => {
        return Object.values(entry).some(value => value !== '' && value !== null);
    });

    return { status: "success", data: filteredData };
}

// --------------------- AUTENTICACIÓN (Apps Script) ---------------------
function bytesToHex(bytes) {
    return bytes.map(function(b){
        var v = (b < 0) ? b + 256 : b;
        return (v.toString(16).length === 1 ? '0' : '') + v.toString(16);
    }).join('');
}

function hashPasswordAppsScript(password){
    try{
        var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
        return bytesToHex(raw);
    }catch(e){
        throw new Error('Error al generar hash: ' + e.message);
    }
}

function authLogin(data){
    if(!data || !data.usuario || !data.password) return { status: 'error', message: 'Faltan credenciales.' };
    var usuario = String(data.usuario).trim();
    var password = String(data.password);

    var check = getData(HOJA_USUARIOS);
    if(check.status !== 'success') return { status: 'error', message: 'No hay usuarios configurados.' };
    var users = check.data;

    for(var i=0;i<users.length;i++){
        if(String(users[i].usuario).toLowerCase() === usuario.toLowerCase()){
            var storedHash = String(users[i].hash || '');
            var incomingHash = hashPasswordAppsScript(password);

            // Aceptar si la celda contiene el hash SHA-256 o la contraseña en claro
            if(storedHash === incomingHash) {
                return { status: 'success', message: 'Autenticación correcta', user: usuario };
            }

            // También permitir autenticación si el valor almacenado coincide exactamente con la contraseña enviada
            if(storedHash === password) {
                return { status: 'success', message: 'Autenticación correcta (contraseña en claro)', user: usuario };
            }

            // Intentar comparar con trim y sin mayúsculas por si el valor fue guardado con espacios
            if(storedHash.trim() === incomingHash || storedHash.trim() === password.trim()) {
                return { status: 'success', message: 'Autenticación correcta', user: usuario };
            }

            return { status: 'error', message: 'Credenciales inválidas' };
        }
    }
    return { status: 'error', message: 'Usuario no encontrado' };
}

function createUserInternal(data){
    // data.usuario, data.password, data.adminKey
    if(!data || !data.usuario || !data.password || !data.adminKey) return { status: 'error', message: 'Faltan parámetros.' };
    var adminKey = String(data.adminKey);
    var props = PropertiesService.getScriptProperties();
    var stored = props.getProperty('ADMIN_KEY');
    // Si existe ADMIN_KEY en Properties, usarla; si no, permitir la constante ADMIN_KEY_CONST
    if(stored) {
        if(adminKey !== stored) return { status: 'error', message: 'Clave admin inválida.' };
    } else {
        if(adminKey !== ADMIN_KEY_CONST) return { status: 'error', message: 'Clave admin inválida.' };
    }

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(HOJA_USUARIOS);
    if(!sheet) return { status: 'error', message: `La pestaña '${HOJA_USUARIOS}' no existe. Inicie la Base de Datos.` };

    // validar existencia
    var existing = getData(HOJA_USUARIOS);
    var usuario = String(data.usuario).trim();
    if(existing.status === 'success'){
        var arr = existing.data;
        for(var i=0;i<arr.length;i++){
            if(String(arr[i].usuario).toLowerCase() === usuario.toLowerCase()){
                return { status: 'error', message: 'El usuario ya existe.' };
            }
        }
    }

    var hashed = hashPasswordAppsScript(String(data.password));
    try{
        sheet.appendRow([usuario, hashed, new Date()]);
        return { status: 'success', message: 'Usuario creado correctamente.' };
    }catch(e){
        return { status: 'error', message: 'Error al crear usuario: ' + e.message };
    }
}

/**
 * Migrar contraseñas en claro en la hoja `Usuarios` a hashes SHA-256.
 * Requiere objeto { adminKey: '...' } con la clave guardada en Script Properties (ADMIN_KEY).
 */
function migrateUsersToHash(data){
    if(!data || !data.adminKey) return { status: 'error', message: 'Falta adminKey.' };
    var props = PropertiesService.getScriptProperties();
    var stored = props.getProperty('ADMIN_KEY');
    // permitir clave desde Properties o usar la constante ADMIN_KEY_CONST si no está configurada
    if(stored) {
        if(String(data.adminKey) !== stored) return { status: 'error', message: 'Clave admin inválida.' };
    } else {
        if(String(data.adminKey) !== ADMIN_KEY_CONST) return { status: 'error', message: 'Clave admin inválida.' };
    }

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(HOJA_USUARIOS);
    if(!sheet) return { status: 'error', message: `La pestaña '${HOJA_USUARIOS}' no existe.` };

    var range = sheet.getDataRange().getValues();
    // encabezados en la fila 1
    if(range.length < 2) return { status: 'success', message: 'No hay usuarios para migrar.' };

    var converted = 0;
    var hexRegex = /^[a-f0-9]{64}$/i;

    // iterar filas desde la segunda (índice 1)
    for(var i = 1; i < range.length; i++){
        var row = range[i];
        var usuario = String(row[0] || '').trim();
        var storedVal = String(row[1] || '');
        if(!usuario) continue;
        // si está vacío o ya parece un hash, saltar
        if(!storedVal) continue;
        if(hexRegex.test(storedVal.trim())) continue;

        // convertir: storedVal se interpreta como contraseña en claro -> calcular hash
        try{
            var hashed = hashPasswordAppsScript(storedVal);
            sheet.getRange(i+1, 2).setValue(hashed); // columna B (índice 2)
            converted++;
        }catch(e){
            // registrar y continuar
            // no usar Logger aquí para no romper la ejecución
        }
    }

    return { status: 'success', message: `Migración completa. ${converted} contraseñas convertidas a hash.` };
}

function findProductRow(sheetProductos, productoId) {
    try {
        const data = sheetProductos.getDataRange().getValues();
        const idColIndex = 0;

        for (let i = 1; i < data.length; i++) {
            const rowId = String(data[i][idColIndex] || '');
            const searchId = String(productoId || '');
            
            if (rowId.toLowerCase() === searchId.toLowerCase()) {
                return { rowData: data[i], rowIndex: i };
            }
        }
        return { rowData: null, rowIndex: -1 };
    } catch (error) {
        console.error(`Error en findProductRow: ${error}`);
        return { rowData: null, rowIndex: -1 };
    }
}

// ----------------------------------------------------------------------
// FUNCIONES DE CONFIGURACIÓN DE BASE DE DATOS
// ----------------------------------------------------------------------
function createOrResetSheet(ss, name, headers) {
    let sheet = ss.getSheetByName(name);
    let action = "verificada";

    if (!sheet) {
        sheet = ss.insertSheet(name);
        action = "creada";
    }

    // Limpiar contenido y establecer encabezados
    sheet.clearContents();
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);

    return `Pestaña '${name}' ${action}.`;
}

function iniciarBaseDeDatos() {
    const ss = getSpreadsheet();
    let msg = [];

    msg.push(createOrResetSheet(ss, HOJA_CATEGORIAS, CATEGORIAS_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_PRODUCTOS, PRODUCTOS_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_COMPRAS, COMPRAS_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_VENTAS, VENTAS_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_RESUMEN, RESUMEN_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_USUARIOS, USUARIOS_HEADERS));

    // Añadir usuario admin por defecto si la hoja está vacía (sólo encabezados)
    try{
        var sheetUsers = ss.getSheetByName(HOJA_USUARIOS);
        if(sheetUsers && sheetUsers.getLastRow() < 2){
            var hashed = hashPasswordAppsScript(String(DEFAULT_ADMIN_PASS));
            sheetUsers.appendRow([String(DEFAULT_ADMIN_USER), hashed, new Date()]);
            msg.push(`Usuario por defecto '${DEFAULT_ADMIN_USER}' creado.`);
        }
    }catch(e){
        msg.push(`No fue posible crear usuario admin: ${e.message}`);
    }

    return { status: "success", message: `Base de datos inicializada: ${msg.join(" ")}` };
}

function resetearBaseDeDatos() {
    const ss = getSpreadsheet();
    let msg = [];

    // Se eliminan todas las pestañas excepto la primera ("Hoja 1")
    ss.getSheets().forEach(sheet => {
        const sheetName = sheet.getName();
        if (sheetName !== "Hoja 1") {
            ss.deleteSheet(sheet);
            msg.push(`Pestaña '${sheetName}' eliminada.`);
        }
    });

    // Se recrean las pestañas
    msg.push(createOrResetSheet(ss, HOJA_CATEGORIAS, CATEGORIAS_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_PRODUCTOS, PRODUCTOS_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_COMPRAS, COMPRAS_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_VENTAS, VENTAS_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_RESUMEN, RESUMEN_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_USUARIOS, USUARIOS_HEADERS));

    // Añadir usuario admin por defecto si la hoja está vacía (sólo encabezados)
    try{
        var sheetUsers2 = ss.getSheetByName(HOJA_USUARIOS);
        if(sheetUsers2 && sheetUsers2.getLastRow() < 2){
            var hashed2 = hashPasswordAppsScript(String(DEFAULT_ADMIN_PASS));
            sheetUsers2.appendRow([String(DEFAULT_ADMIN_USER), hashed2, new Date()]);
            msg.push(`Usuario por defecto '${DEFAULT_ADMIN_USER}' creado.`);
        }
    }catch(e){
        msg.push(`No fue posible crear usuario admin: ${e.message}`);
    }

    return { status: "success", message: `Base de datos reseteada completamente: ${msg.join(" ")}` };
}