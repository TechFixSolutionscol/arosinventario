// ***************************************************************
// ⚠️ 1. REEMPLAZA ESTE VALOR con el ID real de tu Google Sheet
// ***************************************************************
const SPREADSHEET_ID = "1uExfNbKUU-gMZP0lu96mXwbPE8sYSI-C1w6FF2iFQZw";

// Nombres de las pestañas
const HOJA_CATEGORIAS = "Categorias";
const HOJA_PRODUCTOS = "Productos";
const HOJA_COMPRAS = "Compras";
const HOJA_VENTAS = "Ventas";
const HOJA_PROVEEDORES = "Proveedores";
const HOJA_CLIENTES = "Clientes";
const HOJA_RESUMEN = "resumen_diario";
const HOJA_USUARIOS = "Usuarios";

// Encabezados
const CATEGORIAS_HEADERS = ["id", "nombre"];
const PRODUCTOS_HEADERS = ["id", "nombre", "código", "categoría", "tipo", "precio_compra", "precio_venta", "stock", "fecha_creado", "imagen_url"];
const COMPRAS_HEADERS = ["id", "producto_id", "cantidad", "precio_compra", "fecha", "proveedor", "pedido_id"];
const VENTAS_HEADERS = ["id", "producto_id", "cantidad", "precio_venta", "fecha", "cliente", "pedido_id"];
const PROVEEDORES_HEADERS = ["id", "tipo_contacto", "identificacion", "nombre", "email", "telefono", "direccion"];
const CLIENTES_HEADERS = ["id", "tipo_contacto", "identificacion", "nombre", "email", "telefono", "direccion"];
const RESUMEN_HEADERS = ["fecha", "total_ventas", "total_compras", "ganancia", "productos_vendidos"];
const USUARIOS_HEADERS = ["usuario", "hash", "rol", "created"];

// Pedidos (encabezados de órdenes)
const HOJA_PEDIDOS = "Pedidos";
const PEDIDOS_HEADERS = ["id", "tipo", "estado", "contacto", "fecha", "notas", "metodo_pago",
    "descuento", "total", "usuario", "fecha_creacion", "fecha_actualizado",
    "estado_pago", "total_pagado"];

// Chatter / Log de actividad
const HOJA_LOG = "Log";
const LOG_HEADERS = ["id", "referencia_id", "modulo", "tipo", "mensaje", "usuario", "fecha"];

// Pagos / Cartera (abonos a pedidos)
const HOJA_PAGOS = "Pagos";
const PAGOS_HEADERS = ["id", "pedido_id", "tipo_pedido", "fecha", "monto",
    "metodo_pago", "referencia", "notas", "usuario", "fecha_registro"];

// ***************************************************************
// 📁 DRIVE: Carpeta destino para imágenes de productos
// Reemplaza el valor con el ID de tu carpeta en Google Drive
// (Abre la carpeta en drive.google.com y copia el ID de la URL)
// ***************************************************************
const DRIVE_FOLDER_ID = '142BlCYNyjU_P3y8sw9g25CLTW_J9Sljr'; // ← Reemplazar

/**
 * Sube una imagen en base64 a la carpeta de Drive y retorna la URL pública.
 * Requiere que el Servicio Avanzado "Drive API v3" esté habilitado en el proyecto.
 */
function subirImagenADrive(base64Data, mimeType, fileName) {
    try {
        const bytes = Utilities.base64Decode(base64Data);
        const blob = Utilities.newBlob(bytes, mimeType, fileName);
        const file = Drive.Files.create(
            { name: fileName, parents: [DRIVE_FOLDER_ID] },
            blob,
            { fields: 'id' }
        );
        // Hacer público (lectura)
        Drive.Permissions.create(
            { role: 'reader', type: 'anyone' },
            file.id
        );
        return 'https://drive.google.com/thumbnail?id=' + file.id + '&sz=w400-h400';
    } catch (e) {
        Logger.log('Error subiendo imagen a Drive: ' + e.message);
        return ''; // No interrumpir el guardado si falla la imagen
    }
}

// Credenciales por defecto (se crearán automáticamente al inicializar la BD)
const DEFAULT_ADMIN_USER = "admin";
const DEFAULT_ADMIN_PASS = "admin";
// Clave admin se lee exclusivamente de Script Properties (no hardcodeada)
// Para configurar: en Apps Script Editor > Proyecto > Propiedades > Script Properties > agregar ADMIN_KEY
function getAdminKey() {
    var props = PropertiesService.getScriptProperties();
    return props.getProperty('ADMIN_KEY') || '';
}

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
        } else if (action === "getPedidos") {
            result = getPedidos(e.parameter);
        } else if (action === "getDetallePedido") {
            result = getDetallePedido(e.parameter);
        } else if (action === "getChatter") {
            result = getChatter(e.parameter);
        } else if (action === "getPagosPedido") {
            result = getPagosPedido(e.parameter);
        } else if (action === "getData" && sheetName) {
            result = getData(sheetName);
        } else if (action === "getEmpresa") {
            result = getEmpresa();
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
        } else if (action === "editarCategoria") {
            result = editarCategoria(requestData);
        } else if (action === "eliminarCategoria") {
            result = eliminarCategoria(requestData);
        } else if (action === "agregarProducto") {
            result = agregarProducto(requestData);
        } else if (action === "editarProducto") {
            result = editarProducto(requestData);
        } else if (action === "archivarProducto") {
            result = archivarProducto(requestData);
        } else if (action === "registrarTransaccion") {
            result = registrarTransaccion(requestData);
        } else if (action === 'authLogin') {
            result = authLogin(requestData);
        } else if (action === 'createUserInternal') {
            result = createUserInternal(requestData);
        } else if (action === 'migrateUsersToHash') {
            result = migrateUsersToHash(requestData);
        } else if (action === 'registrarTransaccionBatch') {
            result = registrarTransaccionBatch(requestData);
        } else if (action === 'crearPedido') {
            result = crearPedido(requestData);
        } else if (action === 'actualizarPedido') {
            result = actualizarPedido(requestData);
        } else if (action === 'confirmarPedido') {
            result = confirmarPedido(requestData);
        } else if (action === 'completarPedido') {
            result = completarPedido(requestData);
        } else if (action === 'cancelarPedido') {
            result = cancelarPedido(requestData);
        } else if (action === 'agregarRegistroGenerico') {
            result = agregarRegistroGenerico(requestData);
        } else if (action === 'editarContacto') {
            result = editarContacto(requestData);
        } else if (action === 'eliminarContacto') {
            result = eliminarContacto(requestData);
        } else if (action === 'updateUserRole') {
            result = updateUserRole(requestData);
        } else if (action === 'deleteUser') {
            result = deleteUser(requestData);
        } else if (action === 'getNextOrderId') {
            result = getNextOrderId(requestData);
        } else if (action === 'cambiarPassword') {
            result = cambiarPassword(requestData);
        } else if (action === 'resetPassword') {
            result = resetPassword(requestData);
        } else if (action === 'addChatMessage') {
            result = addChatMessage(requestData);
        } else if (action === 'enviarCorreoPedido') {
            result = enviarCorreoPedido(requestData);
        } else if (action === 'registrarPago') {
            result = registrarPago(requestData);
        } else if (action === 'anularPago') {
            result = anularPago(requestData);
        } else if (action === 'guardarEmpresa') {
            result = guardarEmpresa(requestData);
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

/**
 * Agrega un registro genérico a una hoja específica.
 * @param {Object} requestData - Contiene sheetName (nombre de la hoja) y data (objeto con los campos).
 */
function agregarRegistroGenerico(requestData) {
    const sheetName = requestData.sheetName;
    const data = requestData.data;

    if (!sheetName) return { status: "error", message: "Falta el nombre de la hoja (sheetName)." };
    if (!data) return { status: "error", message: "Falta el objeto de datos (data)." };

    const ss = getSpreadsheet();
    const sheet = ss.getSheetByName(sheetName);

    if (!sheet) return { status: "error", message: `La pestaña '${sheetName}' no existe. Inicie la Base de Datos.` };

    try {
        const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
        const newId = generateUniqueAppId();

        const newRow = headers.map(header => {
            const h = header.toLowerCase();
            if (h === 'id') return newId;
            if (h === 'fecha' || h === 'fecha_creado' || h === 'created') return new Date();
            // Buscar en data (ignora mayúsculas/minúsculas en las llaves del objeto)
            const key = Object.keys(data).find(k => k.toLowerCase() === h);
            return key ? data[key] : "";
        });

        sheet.appendRow(newRow);
        return {
            status: "success",
            message: `Registro agregado exitosamente a '${sheetName}'.`,
            id: newId,
            data: data
        };
    } catch (e) {
        return { status: "error", message: `Error al agregar registro: ${e.message}` };
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

function editarCategoria(data) {
    if (!data || !data.id || !data.nombre) {
        return { status: 'error', message: 'Faltan parámetros: id y nombre.' };
    }
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(HOJA_CATEGORIAS);
    if (!sheet) return { status: 'error', message: 'Hoja de categorías no encontrada.' };
    var values = sheet.getDataRange().getValues();
    var targetId = String(data.id).trim();
    for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim() === targetId) {
            sheet.getRange(i + 1, 2).setValue(String(data.nombre).trim());
            return { status: 'success', message: 'Categoría actualizada correctamente.' };
        }
    }
    return { status: 'error', message: 'Categoría no encontrada.' };
}

function eliminarCategoria(data) {
    if (!data || !data.id) {
        return { status: 'error', message: 'Falta el ID de la categoría.' };
    }
    var ss = getSpreadsheet();
    var targetId = String(data.id).trim();
    var catSheet = ss.getSheetByName(HOJA_CATEGORIAS);
    if (!catSheet) return { status: 'error', message: 'Hoja de categorías no encontrada.' };
    var catValues = catSheet.getDataRange().getValues();
    var catName = '';
    var catRow = -1;
    for (var j = 1; j < catValues.length; j++) {
        if (String(catValues[j][0]).trim() === targetId) {
            catName = String(catValues[j][1]);
            catRow = j + 1;
            break;
        }
    }
    if (catRow === -1) return { status: 'error', message: 'Categoría no encontrada.' };
    // Verificar productos asociados
    var productsSheet = ss.getSheetByName(HOJA_PRODUCTOS);
    if (productsSheet) {
        var prodValues = productsSheet.getDataRange().getValues();
        var headers = prodValues[0];
        var catIdx = -1;
        for (var h = 0; h < headers.length; h++) {
            if (String(headers[h]).toLowerCase().indexOf('categor') !== -1) { catIdx = h; break; }
        }
        if (catIdx !== -1) {
            for (var i = 1; i < prodValues.length; i++) {
                if (String(prodValues[i][catIdx]).toLowerCase() === catName.toLowerCase()) {
                    return { status: 'error', message: 'No se puede eliminar: hay productos asociados a esta categoría. Reasigne los productos primero.' };
                }
            }
        }
    }
    catSheet.deleteRow(catRow);
    return { status: 'success', message: 'Categoría \'' + catName + '\' eliminada correctamente.' };
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
    const tipo = data.tipo || "Inventariable";
    const stock = tipo === "Servicio" ? 0 : parseInt(data.stock || 0);

    // Subir imagen a Drive si viene en base64
    let imagen_url = data.imagen_url || '';
    if (data.imagen_base64 && data.imagen_mime && data.imagen_nombre) {
        imagen_url = subirImagenADrive(data.imagen_base64, data.imagen_mime, data.imagen_nombre);
    }

    const newRow = [
        newId,
        data.nombre,
        data.codigo,
        data.categoria,
        tipo,
        parseFloat(data.precio_compra),
        parseFloat(data.precio_venta),
        stock,
        new Date(),
        imagen_url
    ];

    try {
        sheet.appendRow(newRow);
        return { status: "success", message: `Producto '${data.nombre}' registrado con éxito. ID: ${newId}` };
    } catch (e) {
        return { status: "error", message: `Error al escribir producto: ${e.message}` };
    }
}

function editarProducto(data) {
    if (!data || !data.id) return { status: 'error', message: 'Falta el ID del producto.' };
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(HOJA_PRODUCTOS);
    if (!sheet) return { status: 'error', message: 'Hoja de productos no encontrada.' };
    var values = sheet.getDataRange().getValues();
    var headers = values[0];
    var targetId = String(data.id).trim();

    // Encontrar índice de columna imagen_url dinámicamente
    var imagenColIndex = headers.findIndex(function (h) { return String(h).toLowerCase() === 'imagen_url'; });

    for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim() === targetId) {
            var row = i + 1;
            if (data.nombre !== undefined) sheet.getRange(row, 2).setValue(data.nombre);
            if (data.codigo !== undefined) sheet.getRange(row, 3).setValue(data.codigo);
            if (data.categoria !== undefined) sheet.getRange(row, 4).setValue(data.categoria);
            if (data.tipo !== undefined) sheet.getRange(row, 5).setValue(data.tipo);
            if (data.precio_compra !== undefined) sheet.getRange(row, 6).setValue(parseFloat(data.precio_compra));
            if (data.precio_venta !== undefined) sheet.getRange(row, 7).setValue(parseFloat(data.precio_venta));
            if (data.stock !== undefined) sheet.getRange(row, 8).setValue(parseInt(data.stock));

            // Manejar imagen
            if (imagenColIndex !== -1) {
                var nueva_url = data.imagen_url || '';
                // Si viene nueva imagen en base64, subirla a Drive
                if (data.imagen_base64 && data.imagen_mime && data.imagen_nombre) {
                    nueva_url = subirImagenADrive(data.imagen_base64, data.imagen_mime, data.imagen_nombre);
                }
                sheet.getRange(row, imagenColIndex + 1).setValue(nueva_url);
            }

            return { status: 'success', message: 'Producto actualizado correctamente.' };
        }
    }
    return { status: 'error', message: 'Producto no encontrado.' };
}

function archivarProducto(data) {
    if (!data || !data.id) return { status: 'error', message: 'Falta el ID del producto.' };
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(HOJA_PRODUCTOS);
    if (!sheet) return { status: 'error', message: 'Hoja de productos no encontrada.' };
    var values = sheet.getDataRange().getValues();
    var targetId = String(data.id).trim();
    for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim() === targetId) {
            sheet.deleteRow(i + 1);
            return { status: 'success', message: 'Producto eliminado correctamente.' };
        }
    }
    return { status: 'error', message: 'Producto no encontrado.' };
}

// ----------------------------------------------------------------------
// FUNCIONES DE CONTACTOS (Proveedores/Clientes)
// ----------------------------------------------------------------------
function agregarRegistroGenerico(data) {
    if (!data || !data.sheetName || !data.data) {
        return { status: 'error', message: 'Faltan parámetros (sheetName, data).' };
    }
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(data.sheetName);
    if (!sheet) return { status: 'error', message: 'Hoja ' + data.sheetName + ' no encontrada.' };

    // ["id", "tipo_contacto", "identificacion", "nombre", "email", "telefono", "direccion"]
    var newId = data.data.id || generateUniqueAppId();
    var row = [
        newId,
        data.data.tipo_contacto || '',
        data.data.identificacion || '',
        data.data.nombre || '',
        data.data.email || '',
        data.data.telefono || '',
        data.data.direccion || ''
    ];

    try {
        sheet.appendRow(row);
        return { status: 'success', message: 'Registro agregado correctamente.' };
    } catch (e) {
        return { status: 'error', message: 'Error: ' + e.message };
    }
}

function editarContacto(data) {
    if (!data || !data.sheetName || !data.id) {
        return { status: 'error', message: 'Faltan parámetros (sheetName, id).' };
    }
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(data.sheetName);
    if (!sheet) return { status: 'error', message: 'Hoja no encontrada.' };
    var values = sheet.getDataRange().getValues();
    var targetId = String(data.id).trim();
    for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim() === targetId) {
            var row = i + 1;
            if (data.tipo_contacto !== undefined) sheet.getRange(row, 2).setValue(data.tipo_contacto);
            if (data.identificacion !== undefined) sheet.getRange(row, 3).setValue(data.identificacion);
            if (data.nombre !== undefined) sheet.getRange(row, 4).setValue(data.nombre);
            if (data.email !== undefined) sheet.getRange(row, 5).setValue(data.email);
            if (data.telefono !== undefined) sheet.getRange(row, 6).setValue(data.telefono);
            if (data.direccion !== undefined) sheet.getRange(row, 7).setValue(data.direccion);
            return { status: 'success', message: 'Contacto actualizado.' };
        }
    }
    return { status: 'error', message: 'Contacto no encontrado.' };
}

function eliminarContacto(data) {
    if (!data || !data.sheetName || !data.id) {
        return { status: 'error', message: 'Faltan parámetros (sheetName, id).' };
    }
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(data.sheetName);
    if (!sheet) return { status: 'error', message: 'Hoja no encontrada.' };
    var values = sheet.getDataRange().getValues();
    var targetId = String(data.id).trim();
    for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim() === targetId) {
            sheet.deleteRow(i + 1);
            return { status: 'success', message: 'Contacto eliminado.' };
        }
    }
    return { status: 'error', message: 'Contacto no encontrado.' };
}

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
    const tipoColIndex = 4;  // Nueva columna 'tipo'
    const stockColIndex = 7;  // Ajustado por nueva columna
    const precioCompraColIndex = 5;
    const precioVentaColIndex = 6;

    const productoTipo = rowData[tipoColIndex] || "Inventariable";
    const cantidad = parseInt(data.cantidad);
    const precioTransaccion = parseFloat(data.precio);

    let stockActual = parseFloat(rowData[stockColIndex]) || 0;
    let nuevoStock = stockActual;

    // 3. Validar y actualizar stock solo para productos inventariables
    if (productoTipo === "Inventariable") {
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
    }
    // Para servicios, no se modifica el stock

    // 4. Escribir nueva transacción
    const transaccionId = generateUniqueAppId();
    const fechaTransaccion = data.fecha ? new Date(data.fecha) : new Date();
    // Ajustar para evitar desfase de zona horaria si viene de input date
    if (data.fecha) fechaTransaccion.setMinutes(fechaTransaccion.getMinutes() + fechaTransaccion.getTimezoneOffset());

    const newRow = [
        transaccionId,
        data.producto_id,
        cantidad,
        precioTransaccion,
        fechaTransaccion,
        data.extra_data || ''
    ];

    try {
        sheet.appendRow(newRow);
    } catch (e) {
        return { status: "error", message: `Error al registrar transacción: ${e.message}` };
    }

    // 5. Actualizar stock del producto solo si es inventariable
    if (productoTipo === "Inventariable") {
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
    } else {
        // Para servicios, solo confirmar la transacción sin actualizar stock
        return {
            status: "success",
            message: `${isCompra ? 'Compra' : 'Venta'} de servicio registrada exitosamente.`
        };
    }
}

/**
 * Registra múltiples transacciones en un solo lote (Batch).
 */
function registrarTransaccionBatch(data) {
    const items = data.items;
    let successCount = 0;
    let errors = [];

    for (let item of items) {
        const transData = {
            type: data.type,
            producto_id: item.producto_id,
            cantidad: item.cantidad,
            precio: item.precio,
            fecha: data.fecha,
            extra_data: `Pedido: ${data.order_id} | ${data.extra_data || ''}`
        };

        const res = registrarTransaccion(transData);
        if (res.status === 'success') {
            successCount++;
        } else {
            errors.push(`${item.producto_id}: ${res.message}`);
        }
    }

    if (errors.length === 0) {
        return { status: "success", message: `Pedido ${data.order_id} completado. ${successCount} artículos registrados.` };
    } else {
        return {
            status: "partial",
            message: `Registrados ${successCount}/${items.length} artículos. Errores: ${errors.join(", ")}`
        };
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
    return bytes.map(function (b) {
        var v = (b < 0) ? b + 256 : b;
        return (v.toString(16).length === 1 ? '0' : '') + v.toString(16);
    }).join('');
}

function hashPasswordAppsScript(password) {
    try {
        var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password, Utilities.Charset.UTF_8);
        return bytesToHex(raw);
    } catch (e) {
        throw new Error('Error al generar hash: ' + e.message);
    }
}

function authLogin(data) {
    if (!data || !data.usuario || !data.password) return { status: 'error', message: 'Faltan credenciales.' };
    var usuario = String(data.usuario).trim();
    var password = String(data.password);

    var check = getData(HOJA_USUARIOS);
    if (check.status !== 'success') return { status: 'error', message: 'No hay usuarios configurados.' };
    var users = check.data;

    for (var i = 0; i < users.length; i++) {
        if (String(users[i].usuario).toLowerCase() === usuario.toLowerCase()) {
            var storedHash = String(users[i].hash || '');
            var userRol = String(users[i].rol || 'Vendedor'); // Default a Vendedor si no tiene rol
            var incomingHash = hashPasswordAppsScript(password);

            // Solo aceptar autenticación por hash SHA-256
            if (storedHash === incomingHash || storedHash.trim() === incomingHash) {
                return { status: 'success', message: 'Autenticación correcta', usuario: usuario, rol: userRol };
            }

            return { status: 'error', message: 'Credenciales inválidas' };
        }
    }
    return { status: 'error', message: 'Usuario no encontrado' };
}

function createUserInternal(data) {
    // data.usuario, data.password, data.adminKey, data.rol (opcional)
    if (!data || !data.usuario || !data.password || !data.adminKey) return { status: 'error', message: 'Faltan parámetros.' };
    var adminKey = String(data.adminKey);
    var storedKey = getAdminKey();
    if (!storedKey) return { status: 'error', message: 'ADMIN_KEY no configurada en Script Properties. Configure la clave admin.' };
    if (adminKey !== storedKey) return { status: 'error', message: 'Clave admin inválida.' };

    // Validar fortaleza de contraseña
    var password = String(data.password);
    if (password.length < 6) return { status: 'error', message: 'La contraseña debe tener al menos 6 caracteres.' };
    if (!/\d/.test(password)) return { status: 'error', message: 'La contraseña debe contener al menos un número.' };

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(HOJA_USUARIOS);
    if (!sheet) return { status: 'error', message: `La pestaña '${HOJA_USUARIOS}' no existe. Inicie la Base de Datos.` };

    // Validar rol
    var rol = data.rol ? String(data.rol).trim() : 'Vendedor';
    var rolesValidos = ['Admin', 'Vendedor', 'Bodeguero'];
    if (rolesValidos.indexOf(rol) === -1) {
        return { status: 'error', message: 'Rol inválido. Roles permitidos: Admin, Vendedor, Bodeguero.' };
    }

    // validar existencia
    var existing = getData(HOJA_USUARIOS);
    var usuario = String(data.usuario).trim();
    if (existing.status === 'success') {
        var arr = existing.data;
        for (var i = 0; i < arr.length; i++) {
            if (String(arr[i].usuario).toLowerCase() === usuario.toLowerCase()) {
                return { status: 'error', message: 'El usuario ya existe.' };
            }
        }
    }

    var hashed = hashPasswordAppsScript(String(data.password));
    try {
        sheet.appendRow([usuario, hashed, rol, new Date()]);
        return { status: 'success', message: `Usuario '${usuario}' creado correctamente con rol: ${rol}.` };
    } catch (e) {
        return { status: 'error', message: 'Error al crear usuario: ' + e.message };
    }
}

/**
 * Migrar contraseñas en claro en la hoja `Usuarios` a hashes SHA-256.
 * Requiere objeto { adminKey: '...' } con la clave guardada en Script Properties (ADMIN_KEY).
 */
function migrateUsersToHash(data) {
    if (!data || !data.adminKey) return { status: 'error', message: 'Falta adminKey.' };
    var storedKey = getAdminKey();
    if (!storedKey) return { status: 'error', message: 'ADMIN_KEY no configurada.' };
    if (String(data.adminKey) !== storedKey) return { status: 'error', message: 'Clave admin inválida.' };

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(HOJA_USUARIOS);
    if (!sheet) return { status: 'error', message: `La pestaña '${HOJA_USUARIOS}' no existe.` };

    var range = sheet.getDataRange().getValues();
    // encabezados en la fila 1
    if (range.length < 2) return { status: 'success', message: 'No hay usuarios para migrar.' };

    var converted = 0;
    var hexRegex = /^[a-f0-9]{64}$/i;

    // iterar filas desde la segunda (índice 1)
    for (var i = 1; i < range.length; i++) {
        var row = range[i];
        var usuario = String(row[0] || '').trim();
        var storedVal = String(row[1] || '');
        if (!usuario) continue;
        // si está vacío o ya parece un hash, saltar
        if (!storedVal) continue;
        if (hexRegex.test(storedVal.trim())) continue;

        // convertir: storedVal se interpreta como contraseña en claro -> calcular hash
        try {
            var hashed = hashPasswordAppsScript(storedVal);
            sheet.getRange(i + 1, 2).setValue(hashed); // columna B (índice 2)
            converted++;
        } catch (e) {
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

    if (sheet.getLastRow() === 0) {
        sheet.clearContents();
        sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
        sheet.setFrozenRows(1);
    } else {
        var currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
        if (currentHeaders.join('').trim() === '') {
            sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
            sheet.setFrozenRows(1);
        }
    }

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
    msg.push(createOrResetSheet(ss, HOJA_PROVEEDORES, PROVEEDORES_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_CLIENTES, CLIENTES_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_PEDIDOS, PEDIDOS_HEADERS));

    // Añadir usuario admin por defecto si la hoja está vacía (sólo encabezados)
    try {
        var sheetUsers = ss.getSheetByName(HOJA_USUARIOS);
        if (sheetUsers && sheetUsers.getLastRow() < 2) {
            var hashed = hashPasswordAppsScript(String(DEFAULT_ADMIN_PASS));
            sheetUsers.appendRow([String(DEFAULT_ADMIN_USER), hashed, 'Admin', new Date()]);
            msg.push(`Usuario por defecto '${DEFAULT_ADMIN_USER}' creado con rol Admin.`);
        }
    } catch (e) {
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
    msg.push(createOrResetSheet(ss, HOJA_PROVEEDORES, PROVEEDORES_HEADERS));
    msg.push(createOrResetSheet(ss, HOJA_CLIENTES, CLIENTES_HEADERS));

    // Añadir usuario admin por defecto si la hoja está vacía (sólo encabezados)
    try {
        var sheetUsers2 = ss.getSheetByName(HOJA_USUARIOS);
        if (sheetUsers2 && sheetUsers2.getLastRow() < 2) {
            var hashed2 = hashPasswordAppsScript(String(DEFAULT_ADMIN_PASS));
            sheetUsers2.appendRow([String(DEFAULT_ADMIN_USER), hashed2, 'Admin', new Date()]);
            msg.push(`Usuario por defecto '${DEFAULT_ADMIN_USER}' creado con rol Admin.`);
        }
    } catch (e) {
        msg.push(`No fue posible crear usuario admin: ${e.message}`);
    }

    return { status: "success", message: `Base de datos reseteada completamente: ${msg.join(" ")}` };
}

// ========== USER MANAGEMENT FUNCTIONS ==========

function updateUserRole(data) {
    // data: { usuario, nuevoRol, adminKey }
    if (!data || !data.usuario || !data.nuevoRol || !data.adminKey) {
        return { status: 'error', message: 'Faltan parámetros.' };
    }

    // Validar admin key
    var adminKey = String(data.adminKey);
    var storedKey = getAdminKey();
    if (!storedKey) return { status: 'error', message: 'ADMIN_KEY no configurada.' };
    if (adminKey !== storedKey) return { status: 'error', message: 'Clave admin inválida.' };

    // Validar rol
    var nuevoRol = String(data.nuevoRol).trim();
    var rolesValidos = ['Admin', 'Vendedor', 'Bodeguero'];
    if (rolesValidos.indexOf(nuevoRol) === -1) {
        return { status: 'error', message: 'Rol inválido. Roles permitidos: Admin, Vendedor, Bodeguero.' };
    }

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(HOJA_USUARIOS);
    if (!sheet) return { status: 'error', message: `La pestaña '${HOJA_USUARIOS}' no existe.` };

    var data_range = sheet.getDataRange();
    var values = data_range.getValues();
    var usuario = String(data.usuario).trim().toLowerCase();

    // Buscar usuario y actualizar rol
    for (var i = 1; i < values.length; i++) { // Empezar en 1 para saltar headers
        if (String(values[i][0]).toLowerCase() === usuario) {
            // Actualizar rol (columna 2, índice 2)
            sheet.getRange(i + 1, 3).setValue(nuevoRol);
            return { status: 'success', message: `Rol de '${data.usuario}' actualizado a '${nuevoRol}'.` };
        }
    }

    return { status: 'error', message: 'Usuario no encontrado.' };
}

function deleteUser(data) {
    // data: { usuario, adminKey }
    if (!data || !data.usuario || !data.adminKey) {
        return { status: 'error', message: 'Faltan parámetros.' };
    }

    // Validar admin key
    var adminKey = String(data.adminKey);
    var storedKey = getAdminKey();
    if (!storedKey) return { status: 'error', message: 'ADMIN_KEY no configurada.' };
    if (adminKey !== storedKey) return { status: 'error', message: 'Clave admin inválida.' };

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(HOJA_USUARIOS);
    if (!sheet) return { status: 'error', message: `La pestaña '${HOJA_USUARIOS}' no existe.` };

    var data_range = sheet.getDataRange();
    var values = data_range.getValues();
    var usuario = String(data.usuario).trim().toLowerCase();

    // Contar admins
    var adminCount = 0;
    var targetRow = -1;

    for (var i = 1; i < values.length; i++) {
        if (String(values[i][2]) === 'Admin') adminCount++;
        if (String(values[i][0]).toLowerCase() === usuario) {
            targetRow = i + 1; // +1 porque getRange es 1-indexed
        }
    }

    if (targetRow === -1) {
        return { status: 'error', message: 'Usuario no encontrado.' };
    }

    // Verificar que no sea el último admin
    var targetUserRol = String(values[targetRow - 1][2]);
    if (targetUserRol === 'Admin' && adminCount <= 1) {
        return { status: 'error', message: 'No se puede eliminar el último administrador del sistema.' };
    }

    // Eliminar fila
    sheet.deleteRow(targetRow);
    return { status: 'success', message: `Usuario '${data.usuario}' eliminado correctamente.` };
}

// ========== ORDER ID MANAGEMENT ==========

function getNextOrderId(data) {
    // data.type: 'Ventas' or 'Compras'
    if (!data || !data.type) return { status: 'error', message: 'Tipo no especificado.' };

    var sheetName = data.type === 'Ventas' ? HOJA_VENTAS : HOJA_COMPRAS;
    var prefix = data.type === 'Ventas' ? 'V-' : 'P-';

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(sheetName);
    if (!sheet) return { status: 'error', message: `Hoja ${sheetName} no encontrada.` };

    var lastRow = sheet.getLastRow();
    if (lastRow < 2) {
        return { status: 'success', nextId: prefix + '1' };
    }

    // Obtener columna de IDs (columna 1)
    var ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
    var maxId = 0;

    for (var i = 0; i < ids.length; i++) {
        var idStr = String(ids[i][0]);
        // Intentar extraer número del formato PREFIJO-NUMERO o simplemente NUMERO
        // Ejemplo: V-123 -> 123, P-45 -> 45
        var num = parseInt(idStr.replace(/[^0-9]/g, ''), 10);
        if (!isNaN(num) && num > maxId) {
            maxId = num;
        }
    }

    return { status: 'success', nextId: prefix + (maxId + 1) };
}

// ========== PASSWORD MANAGEMENT ==========

/**
 * Cambio de contraseña por el propio usuario.
 * Requiere: { usuario, passwordActual, passwordNueva }
 */
function cambiarPassword(data) {
    if (!data || !data.usuario || !data.passwordActual || !data.passwordNueva) {
        return { status: 'error', message: 'Faltan parámetros: usuario, passwordActual, passwordNueva.' };
    }

    var password = String(data.passwordNueva);
    if (password.length < 6) return { status: 'error', message: 'La contraseña nueva debe tener al menos 6 caracteres.' };
    if (!/\d/.test(password)) return { status: 'error', message: 'La contraseña nueva debe contener al menos un número.' };

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(HOJA_USUARIOS);
    if (!sheet) return { status: 'error', message: 'Hoja de usuarios no encontrada.' };

    var values = sheet.getDataRange().getValues();
    var usuario = String(data.usuario).trim().toLowerCase();
    var hashActual = hashPasswordAppsScript(String(data.passwordActual));

    for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]).toLowerCase() === usuario) {
            var storedHash = String(values[i][1]);
            if (storedHash !== hashActual && storedHash.trim() !== hashActual) {
                return { status: 'error', message: 'La contraseña actual es incorrecta.' };
            }
            var nuevoHash = hashPasswordAppsScript(String(data.passwordNueva));
            sheet.getRange(i + 1, 2).setValue(nuevoHash);
            return { status: 'success', message: 'Contraseña actualizada correctamente.' };
        }
    }
    return { status: 'error', message: 'Usuario no encontrado.' };
}

/**
 * Reset de contraseña por un administrador.
 * Requiere: { usuario, passwordNueva, adminKey }
 */
function resetPassword(data) {
    if (!data || !data.usuario || !data.passwordNueva || !data.adminKey) {
        return { status: 'error', message: 'Faltan parámetros.' };
    }

    var storedKey = getAdminKey();
    if (!storedKey) return { status: 'error', message: 'ADMIN_KEY no configurada.' };
    if (String(data.adminKey) !== storedKey) return { status: 'error', message: 'Clave admin inválida.' };

    var password = String(data.passwordNueva);
    if (password.length < 6) return { status: 'error', message: 'La contraseña nueva debe tener al menos 6 caracteres.' };
    if (!/\d/.test(password)) return { status: 'error', message: 'La contraseña nueva debe contener al menos un número.' };

    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(HOJA_USUARIOS);
    if (!sheet) return { status: 'error', message: 'Hoja de usuarios no encontrada.' };

    var values = sheet.getDataRange().getValues();
    var usuario = String(data.usuario).trim().toLowerCase();

    for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]).toLowerCase() === usuario) {
            var nuevoHash = hashPasswordAppsScript(password);
            sheet.getRange(i + 1, 2).setValue(nuevoHash);
            return { status: 'success', message: 'Contraseña de \'' + data.usuario + '\' reseteada correctamente.' };
        }
    }
    return { status: 'error', message: 'Usuario no encontrado.' };
}

// ======================================================================
// GESTIÓN DE PEDIDOS (Estados: borrador → confirmado → completado)
// ======================================================================

function getPedidos(params) {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(HOJA_PEDIDOS);
    if (!sheet) return { status: 'error', message: 'Hoja de Pedidos no encontrada. Inicialice la BD.' };
    var data = sheet.getDataRange().getValues();
    if (data.length < 2) return { status: 'success', data: [] };
    var headers = data[0];
    var result = [];
    for (var i = 1; i < data.length; i++) {
        var row = {};
        for (var j = 0; j < headers.length; j++) {
            row[headers[j]] = data[i][j];
        }
        // Filtrar por tipo si se proporciona
        if (params && params.tipo && String(row.tipo).toLowerCase() !== String(params.tipo).toLowerCase()) continue;
        // Filtrar por estado
        if (params && params.estado && String(row.estado).toLowerCase() !== String(params.estado).toLowerCase()) continue;
        result.push(row);
    }
    // Ordenar por fecha más reciente
    result.sort(function (a, b) { return new Date(b.fecha_creacion) - new Date(a.fecha_creacion); });
    return { status: 'success', data: result };
}

function getDetallePedido(params) {
    if (!params || !params.pedidoId || !params.tipo) {
        return { status: 'error', message: 'Faltan parámetros: pedidoId o tipo.' };
    }
    var isCompra = String(params.tipo).toLowerCase() === 'compra';
    var sheetName = isCompra ? HOJA_COMPRAS : HOJA_VENTAS;
    var ss = getSpreadsheet();
    var detailSheet = ss.getSheetByName(sheetName);
    if (!detailSheet) return { status: 'error', message: 'Hoja de detalles no encontrada.' };

    var data = detailSheet.getDataRange().getValues();
    if (data.length < 2) return { status: 'success', data: [] };

    var headers = data[0];
    var result = [];
    var targetId = String(params.pedidoId).trim();

    for (var i = 1; i < data.length; i++) {
        var rowIdCol = data[i].length > 6 ? String(data[i][6]).trim() : '';
        if (rowIdCol === targetId) {
            var rowObj = {};
            for (var j = 0; j < headers.length; j++) {
                rowObj[headers[j]] = data[i][j];
            }
            result.push(rowObj);
        }
    }
    return { status: 'success', data: result };
}

/**
 * Crea un pedido en estado borrador (sin afectar inventario).
 * data: { tipo, contacto, fecha, notas, metodo_pago, descuento, total, usuario, items: [...] }
 */
function crearPedido(data) {
    if (!data || !data.tipo || !data.items || data.items.length === 0) {
        return { status: 'error', message: 'Faltan datos del pedido o no tiene productos.' };
    }
    var ss = getSpreadsheet();
    var pedidosSheet = ss.getSheetByName(HOJA_PEDIDOS);
    if (!pedidosSheet) return { status: 'error', message: 'Hoja de Pedidos no encontrada. Inicialice la BD.' };

    var prefix = data.tipo === 'compra' ? 'P-' : 'V-';
    // Generar ID secuencial
    var lastRow = pedidosSheet.getLastRow();
    var nextNum = 1;
    if (lastRow >= 2) {
        var ids = pedidosSheet.getRange(2, 1, lastRow - 1, 1).getValues();
        for (var i = 0; i < ids.length; i++) {
            var num = parseInt(String(ids[i][0]).replace(/[^0-9]/g, ''), 10);
            if (!isNaN(num) && num >= nextNum) nextNum = num + 1;
        }
    }
    var pedidoId = prefix + nextNum;
    var now = new Date();

    // Guardar encabezado del pedido
    pedidosSheet.appendRow([
        pedidoId,
        data.tipo,
        'borrador',
        data.contacto || '',
        data.fecha ? new Date(data.fecha) : now,
        data.notas || '',
        data.metodo_pago || '',
        parseFloat(data.descuento || 0),
        parseFloat(data.total || 0),
        data.usuario || '',
        now,
        now
    ]);

    // Guardar líneas de detalle en la hoja de Compras/Ventas (sin afectar stock aún)
    var isCompra = data.tipo === 'compra';
    var detailSheet = ss.getSheetByName(isCompra ? HOJA_COMPRAS : HOJA_VENTAS);
    if (detailSheet) {
        for (var j = 0; j < data.items.length; j++) {
            var item = data.items[j];
            var fechaTx = data.fecha ? new Date(data.fecha) : now;
            detailSheet.appendRow([
                generateUniqueAppId(),
                item.producto_id,
                parseInt(item.cantidad),
                parseFloat(item.precio),
                fechaTx,
                data.contacto || '',
                pedidoId
            ]);
        }
    }

    return { status: 'success', message: 'Pedido ' + pedidoId + ' creado como borrador.', pedidoId: pedidoId };
}

/**
 * Actualiza un pedido en estado borrador.
 */
function actualizarPedido(data) {
    if (!data || !data.pedidoId || !data.tipo || !data.items || data.items.length === 0) {
        return { status: 'error', message: 'Faltan datos del pedido o no tiene productos.' };
    }
    var ss = getSpreadsheet();
    var pedidosSheet = ss.getSheetByName(HOJA_PEDIDOS);
    if (!pedidosSheet) return { status: 'error', message: 'Hoja de Pedidos no encontrada.' };

    var values = pedidosSheet.getDataRange().getValues();
    var targetId = String(data.pedidoId).trim();
    var pedidoRow = -1;

    for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim() === targetId) {
            pedidoRow = i + 1;
            var estadoActual = String(values[i][2]);
            if (estadoActual !== 'borrador') {
                return { status: 'error', message: 'Solo se pueden actualizar pedidos en estado borrador.' };
            }
            break;
        }
    }

    if (pedidoRow === -1) return { status: 'error', message: 'Pedido no encontrado.' };

    var now = new Date();
    // Actualizar encabezado
    pedidosSheet.getRange(pedidoRow, 4).setValue(data.contacto || '');
    if (data.fecha) pedidosSheet.getRange(pedidoRow, 5).setValue(new Date(data.fecha));
    pedidosSheet.getRange(pedidoRow, 6).setValue(data.notas || '');
    pedidosSheet.getRange(pedidoRow, 7).setValue(data.metodo_pago || '');
    pedidosSheet.getRange(pedidoRow, 8).setValue(parseFloat(data.descuento || 0));
    pedidosSheet.getRange(pedidoRow, 9).setValue(parseFloat(data.total || 0));
    if (data.usuario) pedidosSheet.getRange(pedidoRow, 10).setValue(data.usuario);
    pedidosSheet.getRange(pedidoRow, 12).setValue(now);

    // Reemplazar detalles
    var isCompra = data.tipo === 'compra';
    var detailSheet = ss.getSheetByName(isCompra ? HOJA_COMPRAS : HOJA_VENTAS);
    if (detailSheet) {
        var detailValues = detailSheet.getDataRange().getValues();
        // Borrar actuales interando de abajo hacia arriba
        for (var i = detailValues.length - 1; i >= 1; i--) {
            var rowIdCol = detailValues[i].length > 6 ? String(detailValues[i][6]).trim() : '';
            if (rowIdCol === targetId) {
                detailSheet.deleteRow(i + 1);
            }
        }

        // Insertar nuevos
        for (var j = 0; j < data.items.length; j++) {
            var item = data.items[j];
            var fechaTx = data.fecha ? new Date(data.fecha) : now;
            detailSheet.appendRow([
                generateUniqueAppId(),
                item.producto_id,
                parseInt(item.cantidad),
                parseFloat(item.precio),
                fechaTx,
                data.contacto || '',
                targetId
            ]);
        }
    }

    return { status: 'success', message: 'Pedido ' + targetId + ' actualizado correctamente.', pedidoId: targetId };
}

/**
 * Confirma un pedido borrador → actualiza stock.
 */
function confirmarPedido(data) {
    if (!data || !data.pedidoId) return { status: 'error', message: 'Falta pedidoId.' };
    var ss = getSpreadsheet();
    var pedidosSheet = ss.getSheetByName(HOJA_PEDIDOS);
    if (!pedidosSheet) return { status: 'error', message: 'Hoja de Pedidos no encontrada.' };

    var values = pedidosSheet.getDataRange().getValues();
    var targetId = String(data.pedidoId).trim();
    var pedidoRow = -1;
    var pedidoData = null;

    for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim() === targetId) {
            pedidoRow = i + 1;
            pedidoData = values[i];
            break;
        }
    }
    if (pedidoRow === -1) return { status: 'error', message: 'Pedido no encontrado.' };
    if (String(pedidoData[2]) !== 'borrador') return { status: 'error', message: 'Solo se pueden confirmar pedidos en estado borrador. Estado actual: ' + pedidoData[2] };

    var isCompra = String(pedidoData[1]) === 'compra';

    // Obtener líneas de detalle del pedido
    var detailSheet = ss.getSheetByName(isCompra ? HOJA_COMPRAS : HOJA_VENTAS);
    var prodSheet = ss.getSheetByName(HOJA_PRODUCTOS);
    if (!detailSheet || !prodSheet) return { status: 'error', message: 'Hojas requeridas no encontradas.' };

    var detailValues = detailSheet.getDataRange().getValues();
    var prodValues = prodSheet.getDataRange().getValues();
    var errors = [];

    // Para cada línea del pedido, actualizar stock
    for (var d = 1; d < detailValues.length; d++) {
        var pedidoIdCol = detailValues[d].length > 6 ? String(detailValues[d][6]).trim() : '';
        if (pedidoIdCol !== targetId) continue;

        var prodId = String(detailValues[d][1]).trim();
        var cantidad = parseInt(detailValues[d][2]) || 0;

        // Buscar producto
        for (var p = 1; p < prodValues.length; p++) {
            if (String(prodValues[p][0]).trim() === prodId) {
                var tipoProducto = prodValues[p][4] || 'Inventariable';
                if (tipoProducto === 'Inventariable') {
                    var stockActual = parseInt(prodValues[p][7]) || 0;
                    var nuevoStock;
                    if (isCompra) {
                        nuevoStock = stockActual + cantidad;
                    } else {
                        if (stockActual < cantidad) {
                            errors.push(prodValues[p][1] + ': stock insuficiente (' + stockActual + ' disponibles, ' + cantidad + ' requeridos)');
                            break;
                        }
                        nuevoStock = stockActual - cantidad;
                    }
                    prodSheet.getRange(p + 1, 8).setValue(nuevoStock);
                    prodValues[p][7] = nuevoStock; // actualizar cache local
                }
                break;
            }
        }
    }

    if (errors.length > 0) {
        return { status: 'error', message: 'No se pudo confirmar: ' + errors.join('; ') };
    }

    // Actualizar estado
    pedidosSheet.getRange(pedidoRow, 3).setValue('confirmado');
    pedidosSheet.getRange(pedidoRow, 12).setValue(new Date());
    return { status: 'success', message: 'Pedido ' + targetId + ' confirmado. Stock actualizado.' };
}

/**
 * Marca un pedido confirmado como completado.
 */
function completarPedido(data) {
    if (!data || !data.pedidoId) return { status: 'error', message: 'Falta pedidoId.' };
    var ss = getSpreadsheet();
    var pedidosSheet = ss.getSheetByName(HOJA_PEDIDOS);
    if (!pedidosSheet) return { status: 'error', message: 'Hoja no encontrada.' };
    var values = pedidosSheet.getDataRange().getValues();
    var targetId = String(data.pedidoId).trim();
    for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim() === targetId) {
            if (String(values[i][2]) !== 'confirmado') return { status: 'error', message: 'Solo se pueden completar pedidos confirmados.' };
            pedidosSheet.getRange(i + 1, 3).setValue('completado');
            pedidosSheet.getRange(i + 1, 12).setValue(new Date());
            return { status: 'success', message: 'Pedido ' + targetId + ' completado.' };
        }
    }
    return { status: 'error', message: 'Pedido no encontrado.' };
}

// ======================================================================
// SISTEMA CHATTER / LOG DE ACTIVIDAD
// ======================================================================

/**
 * Obtiene o crea la hoja Log y retorna su objeto.
 */
function getOrCreateLogSheet() {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(HOJA_LOG);
    if (!sheet) {
        sheet = ss.insertSheet(HOJA_LOG);
        sheet.appendRow(LOG_HEADERS);
        sheet.getRange(1, 1, 1, LOG_HEADERS.length)
            .setFontWeight('bold')
            .setBackground('#1a1a2e')
            .setFontColor('#ffffff');
        sheet.setFrozenRows(1);
    }
    return sheet;
}

/**
 * Agrega un mensaje/evento al log de actividad de un pedido.
 * @param {Object} data - { referenciaId, modulo, tipo, mensaje, usuario }
 *   - referenciaId: ID del pedido u otro objeto
 *   - modulo: "pedido" | "contacto" | ...
 *   - tipo: "nota" | "sistema" | "cambio_estado"
 *   - mensaje: texto libre
 *   - usuario: nombre del usuario que genera el evento
 */
function addChatMessage(data) {
    if (!data || !data.referenciaId || !data.mensaje) {
        return { status: 'error', message: 'Faltan parámetros: referenciaId o mensaje.' };
    }
    try {
        var sheet = getOrCreateLogSheet();
        var id = generateUniqueAppId();
        var fecha = new Date();
        sheet.appendRow([
            id,
            String(data.referenciaId).trim(),
            data.modulo || 'pedido',
            data.tipo || 'nota',
            String(data.mensaje).trim(),
            String(data.usuario || 'Sistema').trim(),
            fecha
        ]);
        return { status: 'success', logId: id, fecha: fecha.toISOString() };
    } catch (e) {
        return { status: 'error', message: 'Error al guardar el mensaje: ' + e.message };
    }
}

/**
 * Obtiene todos los mensajes/eventos del chatter para una referencia.
 * @param {Object} params - { referenciaId, modulo? }
 */
function getChatter(params) {
    if (!params || !params.referenciaId) {
        return { status: 'error', message: 'Falta referenciaId.' };
    }
    try {
        var sheet = getOrCreateLogSheet();
        var data = sheet.getDataRange().getValues();
        if (data.length < 2) return { status: 'success', data: [] };

        var headers = data[0];
        var targetId = String(params.referenciaId).trim();
        var modulo = params.modulo || null;
        var result = [];

        for (var i = 1; i < data.length; i++) {
            var row = {};
            for (var j = 0; j < headers.length; j++) {
                row[headers[j]] = data[i][j];
            }
            if (String(row.referencia_id).trim() !== targetId) continue;
            if (modulo && String(row.modulo).toLowerCase() !== modulo) continue;
            // Serializar fecha
            if (row.fecha instanceof Date) row.fecha = row.fecha.toISOString();
            result.push(row);
        }

        // Ordenar más reciente al final (cronológico)
        result.sort(function (a, b) { return new Date(a.fecha) - new Date(b.fecha); });
        return { status: 'success', data: result };
    } catch (e) {
        return { status: 'error', message: 'Error al obtener el log: ' + e.message };
    }
}
/**
 * Cancela un pedido. Si estaba confirmado, revierte stock.
 */
function cancelarPedido(data) {
    if (!data || !data.pedidoId) return { status: 'error', message: 'Falta pedidoId.' };
    var ss = getSpreadsheet();
    var pedidosSheet = ss.getSheetByName(HOJA_PEDIDOS);
    if (!pedidosSheet) return { status: 'error', message: 'Hoja no encontrada.' };
    var values = pedidosSheet.getDataRange().getValues();
    var targetId = String(data.pedidoId).trim();

    for (var i = 1; i < values.length; i++) {
        if (String(values[i][0]).trim() === targetId) {
            var estadoActual = String(values[i][2]);
            if (estadoActual === 'completado') return { status: 'error', message: 'No se puede cancelar un pedido ya completado.' };
            if (estadoActual === 'cancelado') return { status: 'error', message: 'Pedido ya está cancelado.' };

            // Si estaba confirmado, revertir stock
            if (estadoActual === 'confirmado') {
                var isCompra = String(values[i][1]) === 'compra';
                var detailSheet = ss.getSheetByName(isCompra ? HOJA_COMPRAS : HOJA_VENTAS);
                var prodSheet = ss.getSheetByName(HOJA_PRODUCTOS);
                if (detailSheet && prodSheet) {
                    var detailValues = detailSheet.getDataRange().getValues();
                    var prodValues = prodSheet.getDataRange().getValues();
                    for (var d = 1; d < detailValues.length; d++) {
                        var pedidoIdCol = detailValues[d].length > 6 ? String(detailValues[d][6]).trim() : '';
                        if (pedidoIdCol !== targetId) continue;
                        var prodId = String(detailValues[d][1]).trim();
                        var cantidad = parseInt(detailValues[d][2]) || 0;
                        for (var p = 1; p < prodValues.length; p++) {
                            if (String(prodValues[p][0]).trim() === prodId) {
                                var tipoProducto = prodValues[p][4] || 'Inventariable';
                                if (tipoProducto === 'Inventariable') {
                                    var stockActual = parseInt(prodValues[p][7]) || 0;
                                    // Revertir: compra restaba, venta sumaba
                                    var nuevoStock = isCompra ? stockActual - cantidad : stockActual + cantidad;
                                    prodSheet.getRange(p + 1, 8).setValue(Math.max(0, nuevoStock));
                                }
                                break;
                            }
                        }
                    }
                }
            }

            pedidosSheet.getRange(i + 1, 3).setValue('cancelado');
            pedidosSheet.getRange(i + 1, 12).setValue(new Date());
            return { status: 'success', message: 'Pedido ' + targetId + ' cancelado.' + (estadoActual === 'confirmado' ? ' Stock revertido.' : '') };
        }
    }
    return { status: 'error', message: 'Pedido no encontrado.' };
}

// ======================================================================
// ENVÍO DE CORREO — FACTURA / COTIZACIÓN (GmailApp)
// ======================================================================

/**
 * Envía por correo la factura o cotización de un pedido.
 * @param {Object} data { pedidoId, destinatario, asunto?, tipo, usuario? }
 */
function enviarCorreoPedido(data) {
    if (!data || !data.pedidoId || !data.destinatario) {
        return { status: 'error', message: 'Faltan parámetros: pedidoId o destinatario.' };
    }

    // 1. Validar email
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.destinatario)) {
        return { status: 'error', message: 'El correo destinatario no es válido.' };
    }

    // 2. Obtener cabecera del pedido
    var ss = getSpreadsheet();
    var pedidosSheet = ss.getSheetByName(HOJA_PEDIDOS);
    if (!pedidosSheet) return { status: 'error', message: 'Hoja de Pedidos no encontrada.' };

    var pedidosData = pedidosSheet.getDataRange().getValues();
    var pedidosHdr = pedidosData[0];
    var pedido = null;
    var targetId = String(data.pedidoId).trim();

    for (var i = 1; i < pedidosData.length; i++) {
        if (String(pedidosData[i][0]).trim() === targetId) {
            pedido = {};
            for (var h = 0; h < pedidosHdr.length; h++) pedido[pedidosHdr[h]] = pedidosData[i][h];
            break;
        }
    }
    if (!pedido) return { status: 'error', message: 'Pedido ' + targetId + ' no encontrado.' };

    var isCompra = String(pedido.tipo).toLowerCase() === 'compra';
    var estado = String(pedido.estado || '').toLowerCase();
    var esCotizacion = estado === 'borrador';

    // 3. Obtener líneas de detalle
    var detailSheet = ss.getSheetByName(isCompra ? HOJA_COMPRAS : HOJA_VENTAS);
    var lines = [];

    if (detailSheet) {
        var detailData = detailSheet.getDataRange().getValues();
        var detailHdr = detailData[0];
        var prodSheet = ss.getSheetByName(HOJA_PRODUCTOS);
        var prodData = prodSheet ? prodSheet.getDataRange().getValues() : [];
        var prodHdrArr = prodData.length ? prodData[0] : [];
        var prodMap = {};
        for (var p = 1; p < prodData.length; p++) {
            var pr = {};
            for (var ph = 0; ph < prodHdrArr.length; ph++) pr[prodHdrArr[ph]] = prodData[p][ph];
            prodMap[String(pr.id)] = pr;
        }
        for (var d = 1; d < detailData.length; d++) {
            var lr = {};
            for (var lh = 0; lh < detailHdr.length; lh++) lr[detailHdr[lh]] = detailData[d][lh];
            if (String(lr.pedido_id || '').trim() !== targetId) continue;
            var pi = prodMap[String(lr.producto_id)] || {};
            lines.push({
                producto: pi.nombre || lr.producto_id || 'Producto',
                codigo: pi['código'] || pi.codigo || '',
                cantidad: parseInt(lr.cantidad) || 0,
                precio: parseFloat(isCompra ? lr.precio_compra : lr.precio_venta) || 0
            });
        }
    }

    // 4. Calcular totales
    var subtotal = lines.reduce(function (s, l) { return s + l.cantidad * l.precio; }, 0);
    var descPct = parseFloat(pedido.descuento) || 0;
    var descVal = subtotal * (descPct / 100);
    var afterDesc = subtotal - descVal;
    var ivaVal = afterDesc * 0.19;
    var totalFinal = parseFloat(pedido.total) || (afterDesc + ivaVal);

    // 5. Helpers de formato
    function fmtFecha(f) {
        if (!f) return '—';
        var dt = f instanceof Date ? f : new Date(f);
        if (isNaN(dt)) return String(f);
        return dt.toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' });
    }
    function fmtCOP(n) {
        return '$ ' + Number(n).toLocaleString('es-CO', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
    }

    // 6. Filas de la tabla HTML
    var filas = lines.map(function (l) {
        var sub = l.cantidad * l.precio;
        return '<tr>' +
            '<td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;color:#1e293b;">' +
            l.producto + (l.codigo ? '<br><small style="color:#94a3b8;font-size:0.78rem;">' + l.codigo + '</small>' : '') +
            '</td>' +
            '<td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:center;color:#1e293b;">' + l.cantidad + '</td>' +
            '<td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right;color:#1e293b;">' + fmtCOP(l.precio) + '</td>' +
            '<td style="padding:10px 14px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;color:#1e293b;">' + fmtCOP(sub) + '</td>' +
            '</tr>';
    }).join('') || '<tr><td colspan="4" style="padding:16px;text-align:center;color:#94a3b8;font-style:italic;">Sin líneas de detalle.</td></tr>';

    // 7. Tipo de documento y colores
    var tipoDoc = esCotizacion ? 'COTIZACI\u00D3N' : 'FACTURA';
    var docColor = esCotizacion ? '#f59e0b' : '#4361ee';
    var tipoText = isCompra ? 'Orden de Compra' : 'Orden de Venta';
    var estadoColors = {
        borrador: { bg: '#f1f5f9', color: '#475569' },
        confirmado: { bg: '#dbeafe', color: '#1d4ed8' },
        completado: { bg: '#dcfce7', color: '#166534' },
        cancelado: { bg: '#fee2e2', color: '#991b1b' }
    };
    var ec = estadoColors[estado] || estadoColors.borrador;

    // 8. Filas de totales
    var filasTotal =
        '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:0.875rem;color:#64748b;">' +
        '<span>Base Imponible</span><span>' + fmtCOP(subtotal) + '</span></div>' +
        (descPct > 0
            ? '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:0.875rem;color:#ef4444;">' +
            '<span>Descuento (' + descPct + '%)</span><span>- ' + fmtCOP(descVal) + '</span></div>'
            : '') +
        '<div style="display:flex;justify-content:space-between;padding:7px 0;border-bottom:1px solid #e2e8f0;font-size:0.875rem;color:#64748b;">' +
        '<span>IVA (19%)</span><span>' + fmtCOP(ivaVal) + '</span></div>' +
        '<div style="display:flex;justify-content:space-between;padding:10px 0 0;font-size:1.1rem;font-weight:800;color:#4361ee;">' +
        '<span>TOTAL</span><span>' + fmtCOP(totalFinal) + '</span></div>';

    // 9. HTML del correo
    var htmlBody =
        '<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">' +
        '<meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
        '<body style="margin:0;padding:0;background:#f0f2f8;font-family:\'Segoe UI\',Arial,sans-serif;">' +
        '<div style="max-width:680px;margin:32px auto;background:#ffffff;border-radius:16px;overflow:hidden;' +
        'box-shadow:0 8px 32px rgba(0,0,0,0.10);">' +

        // — Header —
        '<div style="background:linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%);padding:32px 36px;">' +
        '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td><div style="font-size:1.8rem;font-weight:800;color:#ffffff;letter-spacing:-0.5px;">' +
        'Fix<span style="color:#818cf8;">Ops</span></div>' +
        '<div style="font-size:0.8rem;color:rgba(255,255,255,0.5);margin-top:3px;">TechFix Solutions</div></td>' +
        '<td style="text-align:right;vertical-align:top;">' +
        '<div style="display:inline-block;background:' + docColor + ';color:#fff;font-size:0.72rem;font-weight:800;' +
        'letter-spacing:1.5px;padding:5px 14px;border-radius:20px;">' + tipoDoc + '</div>' +
        '<div style="font-size:1.25rem;font-weight:800;color:#fff;margin-top:6px;">' + targetId + '</div>' +
        '<div style="font-size:0.78rem;color:rgba(255,255,255,0.5);">' + tipoText + '</div>' +
        '</td></tr></table></div>' +

        // — Info cabecera —
        '<div style="padding:22px 36px;background:#f8fafc;border-bottom:1px solid #e2e8f0;">' +
        '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
        '<td style="width:33%;padding-right:12px;vertical-align:top;">' +
        '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:4px;">' + (isCompra ? 'Proveedor' : 'Cliente') + '</div>' +
        '<div style="font-size:0.95rem;font-weight:600;color:#1e293b;">' + (pedido.contacto || '—') + '</div></td>' +
        '<td style="width:33%;padding-right:12px;vertical-align:top;">' +
        '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:4px;">Fecha</div>' +
        '<div style="font-size:0.95rem;font-weight:600;color:#1e293b;">' + fmtFecha(pedido.fecha) + '</div></td>' +
        '<td style="width:33%;vertical-align:top;">' +
        '<div style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.5px;color:#94a3b8;margin-bottom:4px;">Estado</div>' +
        '<div style="display:inline-block;font-size:0.75rem;font-weight:700;padding:3px 10px;border-radius:20px;' +
        'background:' + ec.bg + ';color:' + ec.color + ';">' + estado.toUpperCase() + '</div></td>' +
        '</tr></table>' +
        (pedido.metodo_pago ? '<div style="margin-top:10px;font-size:0.82rem;color:#64748b;"><strong>Método de pago:</strong> ' + pedido.metodo_pago + '</div>' : '') +
        (pedido.notas ? '<div style="margin-top:5px;font-size:0.82rem;color:#64748b;"><strong>Notas:</strong> ' + String(pedido.notas) + '</div>' : '') +
        '</div>' +

        // — Tabla de productos —
        '<div style="padding:28px 36px;">' +
        '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:#f8fafc;">' +
        '<th style="padding:10px 14px;text-align:left;font-size:0.72rem;font-weight:700;text-transform:uppercase;' +
        'letter-spacing:0.5px;color:#64748b;border-bottom:2px solid #e2e8f0;">Producto</th>' +
        '<th style="padding:10px 14px;text-align:center;font-size:0.72rem;font-weight:700;text-transform:uppercase;' +
        'letter-spacing:0.5px;color:#64748b;border-bottom:2px solid #e2e8f0;">Cant.</th>' +
        '<th style="padding:10px 14px;text-align:right;font-size:0.72rem;font-weight:700;text-transform:uppercase;' +
        'letter-spacing:0.5px;color:#64748b;border-bottom:2px solid #e2e8f0;">Precio Unit.</th>' +
        '<th style="padding:10px 14px;text-align:right;font-size:0.72rem;font-weight:700;text-transform:uppercase;' +
        'letter-spacing:0.5px;color:#64748b;border-bottom:2px solid #e2e8f0;">Subtotal</th>' +
        '</tr></thead><tbody>' + filas + '</tbody></table>' +

        // — Totales —
        '<div style="margin-top:20px;display:flex;justify-content:flex-end;">' +
        '<div style="min-width:260px;background:#f8fafc;border-radius:12px;padding:18px 20px;border:1px solid #e2e8f0;">' +
        filasTotal + '</div></div>' +
        '</div>' +

        // — Footer —
        '<div style="background:#f8fafc;border-top:1px solid #e2e8f0;padding:18px 36px;text-align:center;">' +
        '<p style="font-size:0.78rem;color:#94a3b8;margin:0;">Generado automáticamente por <strong>FixOps</strong> &mdash; ' +
        '<a href="https://techfixsolutions.site" style="color:#4361ee;text-decoration:none;">techfixsolutions.site</a></p>' +
        '<p style="font-size:0.75rem;color:#cbd5e1;margin:5px 0 0;">' + fmtFecha(new Date()) + '</p>' +
        '</div></div></body></html>';

    // ── 10. Asunto ───────────────────────────────────────────────────
    var asunto = (data.asunto && data.asunto.trim())
        ? data.asunto.trim()
        : tipoDoc + ' ' + targetId + ' \u2014 ' + (pedido.contacto || 'FixOps') + ' (' + fmtFecha(pedido.fecha) + ')';

    // ── 11. Texto plano (fallback para clientes sin HTML) ────────────
    var textPlano = tipoDoc + ' No. ' + targetId + '\n' +
        tipoText + '\n' +
        (isCompra ? 'Proveedor' : 'Cliente') + ': ' + (pedido.contacto || '\u2014') + '\n' +
        'Fecha: ' + fmtFecha(pedido.fecha) + '\nEstado: ' + estado + '\nTotal: ' + fmtCOP(totalFinal) + '\n\n' +
        'Para mejor visualizaci\u00f3n, abra este mensaje en un cliente compatible con HTML.';

    // ── 12. Construir mensaje MIME multipart/alternative ─────────────
    //   Siguiendo: https://developers.google.com/apps-script/advanced/gmail
    //   Gmail.Users.Messages.send requiere el mensaje raw en base64url
    var remitente = Session.getActiveUser().getEmail();
    var boundary = 'fixops_' + Utilities.getUuid().replace(/-/g, '').substring(0, 20);

    var mimeLines = [
        'From: FixOps \u2014 TechFix Solutions <' + remitente + '>',
        'To: ' + String(data.destinatario).trim()
    ];
    if (data.cc && String(data.cc).trim()) {
        mimeLines.push('Cc: ' + String(data.cc).trim());
    }
    mimeLines = mimeLines.concat([
        'Subject: =?UTF-8?B?' + Utilities.base64Encode(asunto, Utilities.Charset.UTF_8) + '?=',
        'MIME-Version: 1.0',
        'Content-Type: multipart/alternative; boundary="' + boundary + '"',
        '',
        '--' + boundary,
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: quoted-printable',
        '',
        textPlano,
        '',
        '--' + boundary,
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        '',
        Utilities.base64Encode(htmlBody, Utilities.Charset.UTF_8),
        '',
        '--' + boundary + '--'
    ]);

    // Codificar raw message en base64url (URL-safe, sin padding)
    var rawMime = mimeLines.join('\r\n');
    var base64url = Utilities.base64EncodeWebSafe(rawMime, Utilities.Charset.UTF_8)
        .replace(/=+$/, '');

    // ── 13. Enviar con Gmail Advanced Service ────────────────────────
    //   IMPORTANTE: Habilitar en Apps Script > Servicios > Gmail API
    //   Referencia: Gmail.Users.Messages.send(message, userId)
    try {
        var response = Gmail.Users.Messages.send({ raw: base64url }, 'me');

        addChatMessage({
            referenciaId: targetId,
            modulo: 'pedido',
            tipo: 'sistema',
            mensaje: tipoDoc + ' enviada a <strong>' + data.destinatario + '</strong>.' +
                (response && response.id ? ' MessageId: ' + response.id : ''),
            usuario: data.usuario || 'Sistema'
        });

        return {
            status: 'success',
            message: tipoDoc + ' enviada exitosamente a ' + data.destinatario,
            messageId: response ? response.id : null
        };

    } catch (errAdvanced) {
        // Fallback: GmailApp b\u00e1sico (no requiere habilitar servicio avanzado)
        try {
            GmailApp.sendEmail(
                String(data.destinatario).trim(),
                asunto,
                textPlano,
                {
                    htmlBody: htmlBody,
                    name: 'FixOps \u2014 TechFix Solutions',
                    cc: (data.cc && data.cc.trim()) ? data.cc.trim() : ''
                }
            );

            addChatMessage({
                referenciaId: targetId,
                modulo: 'pedido',
                tipo: 'sistema',
                mensaje: tipoDoc + ' enviada a <strong>' + data.destinatario + '</strong> (v\u00eda GmailApp).',
                usuario: data.usuario || 'Sistema'
            });

            return {
                status: 'success',
                message: tipoDoc + ' enviada a ' + data.destinatario + ' (usando GmailApp).'
            };

        } catch (errBasic) {
            return {
                status: 'error',
                message: 'No se pudo enviar el correo. ' +
                    'Gmail API: ' + errAdvanced.message + '. ' +
                    'GmailApp: ' + errBasic.message + '. ' +
                    'Verifique permisos y que Gmail API est\u00e9 habilitado en los Servicios del script.'
            };
        }
    }
}

// ======================================================================
// MÓDULO DE PAGOS Y CARTERA (ABONOS ESTILO ODOO)
// ======================================================================

/**
 * Obtiene o crea la hoja de Pagos con sus encabezados.
 */
function getOrCreatePagosSheet() {
    var ss = getSpreadsheet();
    var sheet = ss.getSheetByName(HOJA_PAGOS);
    if (!sheet) {
        sheet = ss.insertSheet(HOJA_PAGOS);
        sheet.appendRow(PAGOS_HEADERS);
        sheet.setFrozenRows(1);
    }
    return sheet;
}

/**
 * Obtiene todos los pagos registrados para un pedido.
 * @param {Object} params { pedidoId }
 */
function getPagosPedido(params) {
    if (!params || !params.pedidoId) {
        return { status: 'error', message: 'Se requiere pedidoId.' };
    }
    var targetId = String(params.pedidoId).trim();
    var sheet = getOrCreatePagosSheet();
    var data = sheet.getDataRange().getValues();
    var headers = data[0];
    var pagos = [];

    // Helper para encontrar índice (case-insensitive)
    function getIdx(keys, fallback) {
        for (var i = 0; i < headers.length; i++) {
            var h = String(headers[i]).toLowerCase().trim();
            for (var k = 0; k < keys.length; k++) {
                if (h === keys[k]) return i;
            }
        }
        return fallback;
    }

    var pIdIndex = getIdx(['pedido_id', 'pedido id', 'pedido', 'id pedido'], 1);
    var montoIndex = getIdx(['monto', 'valor', 'total'], 4);
    var fechaIndex = getIdx(['fecha', 'fecha_pago', 'fecha pago'], 3);
    var metodoIndex = getIdx(['metodo_pago', 'método de pago', 'método', 'metodo'], 5);
    var refIndex = getIdx(['referencia', 'ref', 'comprobante'], 6);

    for (var i = 1; i < data.length; i++) {
        if (String(data[i][pIdIndex]).trim() === targetId) {
            var row = {};
            for (var h = 0; h < headers.length; h++) row[headers[h] || 'col_' + h] = data[i][h];

            // Garantizar claves mínimas para el frontend
            row.pedido_id = data[i][pIdIndex];
            row.monto = data[i][montoIndex];
            row.fecha = data[i][fechaIndex];
            row.metodo = data[i][metodoIndex];
            row.referencia = data[i][refIndex];

            if (row.fecha instanceof Date) row.fecha = row.fecha.toISOString().split('T')[0];
            if (row.fecha_registro instanceof Date) row.fecha_registro = row.fecha_registro.toISOString();
            pagos.push(row);
        }
    }

    // Ordenar por fecha ascendente
    pagos.sort(function (a, b) { return new Date(a.fecha) - new Date(b.fecha); });

    // Calcular resumen
    var totalPagado = pagos.reduce(function (s, p) { return s + (parseFloat(p.monto) || 0); }, 0);

    return {
        status: 'success',
        pagos: pagos,
        totalPagado: totalPagado,
        count: pagos.length
    };
}

/**
 * Registra un nuevo abono (pago) para un pedido.
 * Recalcula estado_pago y total_pagado en la hoja Pedidos.
 * @param {Object} data { pedidoId, fecha, monto, metodoPago, referencia?, notas?, usuario?, forzarPagado? }
 */
function registrarPago(data) {
    if (!data || !data.pedidoId || !data.monto) {
        return { status: 'error', message: 'Faltan parámetros: pedidoId o monto.' };
    }

    var monto = parseFloat(data.monto);
    if (isNaN(monto) || monto <= 0) {
        return { status: 'error', message: 'El monto debe ser un número positivo.' };
    }

    var targetId = String(data.pedidoId).trim();
    var ss = getSpreadsheet();

    // 1. Verificar que el pedido existe y está en estado válido para pagos
    var pedidosSheet = ss.getSheetByName(HOJA_PEDIDOS);
    if (!pedidosSheet) return { status: 'error', message: 'Hoja de Pedidos no encontrada.' };

    var pedidosData = pedidosSheet.getDataRange().getValues();
    var pedHdr = pedidosData[0];
    var pedRowIndex = -1;
    var pedido = null;

    for (var i = 1; i < pedidosData.length; i++) {
        if (String(pedidosData[i][0]).trim() === targetId) {
            pedRowIndex = i;
            pedido = {};
            for (var h = 0; h < pedHdr.length; h++) pedido[pedHdr[h]] = pedidosData[i][h];
            break;
        }
    }

    if (!pedido) return { status: 'error', message: 'Pedido ' + targetId + ' no encontrado.' };

    var estadoPedido = String(pedido.estado || '').toLowerCase();
    if (estadoPedido === 'borrador' || estadoPedido === 'cancelado') {
        return { status: 'error', message: 'Solo se pueden registrar pagos en pedidos confirmados o completados.' };
    }

    var totalPedido = parseFloat(pedido.total) || 0;

    // 2. Calcular total ya pagado (sumando todos los pagos anteriores)
    var pagosSheet = getOrCreatePagosSheet();
    var pagosData = pagosSheet.getDataRange().getValues();
    var pagosHdr = pagosData[0];
    var totalYaPagado = 0;

    function getIdxP(keys, fallback) {
        for (var i = 0; i < pagosHdr.length; i++) {
            var h = String(pagosHdr[i]).toLowerCase().trim();
            for (var k = 0; k < keys.length; k++) {
                if (h === keys[k]) return i;
            }
        }
        return fallback;
    }
    var idIndex = getIdxP(['id', 'codigo', 'código'], 0);
    var pIdIndex = getIdxP(['pedido_id', 'pedido id', 'pedido', 'id pedido'], 1);
    var tipoIndex = getIdxP(['tipo_pedido', 'tipo'], 2);
    var fechaIndex = getIdxP(['fecha', 'fecha_pago', 'fecha pago'], 3);
    var montoIndex = getIdxP(['monto', 'valor', 'total'], 4);
    var metodoIndex = getIdxP(['metodo_pago', 'método de pago', 'método', 'metodo'], 5);
    var refIndex = getIdxP(['referencia', 'ref', 'comprobante'], 6);
    var notaIndex = getIdxP(['notas', 'nota', 'observaciones'], 7);
    var usuIndex = getIdxP(['usuario', 'user'], 8);
    var fecRegIndex = getIdxP(['fecha_registro', 'fecha_creacion', 'created'], 9);

    for (var p = 1; p < pagosData.length; p++) {
        if (String(pagosData[p][pIdIndex]).trim() === targetId) {
            totalYaPagado += parseFloat(pagosData[p][montoIndex]) || 0;
        }
    }

    var saldoPendiente = totalPedido - totalYaPagado;
    if (saldoPendiente <= 0) {
        return { status: 'error', message: 'Este pedido ya está completamente pagado.' };
    }

    // Ajustar monto si supera el saldo
    if (monto > saldoPendiente + 0.01) {
        monto = saldoPendiente; // no permitir sobrepago
    }

    // 3. Generar ID de pago
    var pagoId = 'PAG-' + new Date().getTime().toString(36).toUpperCase();

    // 4. Insertar el pago usando los índices dinámicos
    var fechaPago = data.fecha ? new Date(data.fecha) : new Date();
    var newRow = new Array(pagosHdr.length);
    for (var idx = 0; idx < pagosHdr.length; idx++) newRow[idx] = ''; // rellenar vacíos

    if (idIndex < newRow.length) newRow[idIndex] = pagoId;
    if (pIdIndex < newRow.length) newRow[pIdIndex] = targetId;
    if (tipoIndex < newRow.length) newRow[tipoIndex] = String(pedido.tipo || '').toLowerCase();
    if (fechaIndex < newRow.length) newRow[fechaIndex] = fechaPago;
    if (montoIndex < newRow.length) newRow[montoIndex] = monto;
    if (metodoIndex < newRow.length) newRow[metodoIndex] = data.metodoPago || data.metodo_pago || 'Efectivo';
    if (refIndex < newRow.length) newRow[refIndex] = data.referencia || '';
    if (notaIndex < newRow.length) newRow[notaIndex] = data.notas || '';
    if (usuIndex < newRow.length) newRow[usuIndex] = data.usuario || 'Sistema';
    if (fecRegIndex < newRow.length) newRow[fecRegIndex] = new Date();

    pagosSheet.appendRow(newRow);

    // 5. Recalcular estado_pago y total_pagado en el pedido
    var nuevoTotalPagado = totalYaPagado + monto;
    var nuevoEstadoPago;

    if (data.forzarPagado || Math.abs(nuevoTotalPagado - totalPedido) < 1) {
        nuevoEstadoPago = 'pagado';
    } else if (nuevoTotalPagado >= totalPedido) {
        nuevoEstadoPago = 'pagado';
    } else {
        nuevoEstadoPago = 'parcial';
    }

    // Actualizar columnas estado_pago y total_pagado en la hoja Pedidos
    var colEstadoPago = pedHdr.indexOf('estado_pago');
    var colTotalPagado = pedHdr.indexOf('total_pagado');
    var colFechaUpd = pedHdr.indexOf('fecha_actualizado');

    if (colEstadoPago >= 0) {
        pedidosSheet.getRange(pedRowIndex + 1, colEstadoPago + 1).setValue(nuevoEstadoPago);
    }
    if (colTotalPagado >= 0) {
        pedidosSheet.getRange(pedRowIndex + 1, colTotalPagado + 1).setValue(nuevoTotalPagado);
    }
    if (colFechaUpd >= 0) {
        pedidosSheet.getRange(pedRowIndex + 1, colFechaUpd + 1).setValue(new Date());
    }

    // 6. Registrar en chatter
    var saldo = totalPedido - nuevoTotalPagado;
    var msgChatter = 'Pago registrado: <strong>$' + nuevoTotalPagado.toLocaleString('es-CO') +
        '</strong> de <strong>$' + totalPedido.toLocaleString('es-CO') + '</strong>' +
        ' (' + (data.metodoPago || 'Efectivo') + ').' +
        (nuevoEstadoPago === 'pagado'
            ? ' ✅ <strong>Pedido completamente pagado.</strong>'
            : ' Saldo pendiente: $' + saldo.toLocaleString('es-CO'));

    addChatMessage({
        referenciaId: targetId,
        modulo: 'pedido',
        tipo: 'pago',
        mensaje: msgChatter,
        usuario: data.usuario || 'Sistema'
    });

    return {
        status: 'success',
        pagoId: pagoId,
        totalPagado: nuevoTotalPagado,
        saldoPendiente: Math.max(0, totalPedido - nuevoTotalPagado),
        estadoPago: nuevoEstadoPago,
        message: 'Pago ' + pagoId + ' registrado correctamente.'
    };
}

/**
 * Anula un pago (abono) específico.
 * Recalcula el estado de pago del pedido.
 * @param {Object} data { pagoId, pedidoId, motivo?, usuario? }
 */
function anularPago(data) {
    if (!data || !data.pagoId || !data.pedidoId) {
        return { status: 'error', message: 'Faltan parámetros: pagoId o pedidoId.' };
    }

    var targetPagoId = String(data.pagoId).trim();
    var targetPedidoId = String(data.pedidoId).trim();
    var ss = getSpreadsheet();
    var pagosSheet = getOrCreatePagosSheet();
    var pagosData = pagosSheet.getDataRange().getValues();
    var pagosHdr = pagosData[0];

    function getIdxP(keys, fallback) {
        for (var i = 0; i < pagosHdr.length; i++) {
            var h = String(pagosHdr[i]).toLowerCase().trim();
            for (var k = 0; k < keys.length; k++) {
                if (h === keys[k]) return i;
            }
        }
        return fallback;
    }
    var idIndex = getIdxP(['id', 'codigo', 'código'], 0);
    var pIdIndex = getIdxP(['pedido_id', 'pedido id', 'pedido', 'id pedido'], 1);
    var montoIndex = getIdxP(['monto', 'valor', 'total'], 4);

    // Buscar el pago
    var pagoRowIndex = -1;
    var pagoMonto = 0;
    for (var p = 1; p < pagosData.length; p++) {
        if (String(pagosData[p][idIndex]).trim() === targetPagoId &&
            String(pagosData[p][pIdIndex]).trim() === targetPedidoId) {
            pagoRowIndex = p;
            pagoMonto = parseFloat(pagosData[p][montoIndex]) || 0;
            break;
        }
    }

    if (pagoRowIndex < 0) {
        return { status: 'error', message: 'Pago ' + targetPagoId + ' no encontrado.' };
    }

    // Eliminar la fila del pago (o marcarla como anulada)
    // Usamos eliminación directa para simplificar
    pagosSheet.deleteRow(pagoRowIndex + 1);

    // Recalcular estado_pago del pedido
    var pedidosSheet = ss.getSheetByName(HOJA_PEDIDOS);
    var pedidosData = pedidosSheet.getDataRange().getValues();
    var pedHdr = pedidosData[0];
    var pedRowIndex = -1;
    var totalPedido = 0;

    for (var i = 1; i < pedidosData.length; i++) {
        if (String(pedidosData[i][0]).trim() === targetPedidoId) {
            pedRowIndex = i;
            totalPedido = parseFloat(pedidosData[i][pedHdr.indexOf('total')]) || 0;
            break;
        }
    }

    if (pedRowIndex < 0) return { status: 'error', message: 'Pedido no encontrado para recalcular.' };

    // Sumar pagos restantes
    var nuevaPagosData = pagosSheet.getDataRange().getValues();
    var nuevoTotal = 0;
    for (var r = 1; r < nuevaPagosData.length; r++) {
        if (String(nuevaPagosData[r][pIdIndex]).trim() === targetPedidoId) {
            nuevoTotal += parseFloat(nuevaPagosData[r][montoIndex]) || 0;
        }
    }

    var nuevoEstado = nuevoTotal <= 0 ? 'sin_pago' : (nuevoTotal >= totalPedido ? 'pagado' : 'parcial');
    var colEstadoPago = pedHdr.indexOf('estado_pago');
    var colTotalPagado = pedHdr.indexOf('total_pagado');

    if (colEstadoPago >= 0) pedidosSheet.getRange(pedRowIndex + 1, colEstadoPago + 1).setValue(nuevoEstado);
    if (colTotalPagado >= 0) pedidosSheet.getRange(pedRowIndex + 1, colTotalPagado + 1).setValue(nuevoTotal);

    // Registrar en chatter
    addChatMessage({
        referenciaId: targetPedidoId,
        modulo: 'pedido',
        tipo: 'sistema',
        mensaje: 'Pago <strong>' + targetPagoId + '</strong> anulado.' +
            (data.motivo ? ' Motivo: ' + data.motivo : ''),
        usuario: data.usuario || 'Sistema'
    });

    return {
        status: 'success',
        estadoPago: nuevoEstado,
        totalPagado: nuevoTotal,
        message: 'Pago ' + targetPagoId + ' anulado.'
    };
}

// ============================================================
// CONFIGURACIÓN DE EMPRESA
// ============================================================

/**
 * Guarda los datos de la empresa en las Script Properties.
 * Si viene imagen en base64, la sube a Drive y guarda la URL.
 */
function guardarEmpresa(data) {
    try {
        var props = PropertiesService.getScriptProperties();

        // Si viene logo en base64, subirlo a Drive
        var logo_url = data.logo_url || props.getProperty('empresa_logo_url') || '';
        if (data.logo_base64 && data.logo_mime && data.logo_nombre) {
            logo_url = subirImagenADrive(data.logo_base64, data.logo_mime, data.logo_nombre);
        }

        var campos = {
            'empresa_nombre': data.nombre || '',
            'empresa_nit': data.nit || '',
            'empresa_telefono': data.telefono || '',
            'empresa_email': data.email || '',
            'empresa_direccion': data.direccion || '',
            'empresa_ciudad': data.ciudad || '',
            'empresa_web': data.web || '',
            'empresa_slogan': data.slogan || '',
            'empresa_logo_url': logo_url
        };

        props.setProperties(campos);

        return {
            status: 'success',
            message: 'Datos de empresa guardados correctamente.',
            logo_url: logo_url
        };
    } catch (e) {
        return { status: 'error', message: 'Error al guardar: ' + e.message };
    }
}

/**
 * Retorna los datos de la empresa almacenados en Script Properties.
 */
function getEmpresa() {
    try {
        var props = PropertiesService.getScriptProperties();
        return {
            status: 'success',
            data: {
                nombre: props.getProperty('empresa_nombre') || '',
                nit: props.getProperty('empresa_nit') || '',
                telefono: props.getProperty('empresa_telefono') || '',
                email: props.getProperty('empresa_email') || '',
                direccion: props.getProperty('empresa_direccion') || '',
                ciudad: props.getProperty('empresa_ciudad') || '',
                web: props.getProperty('empresa_web') || '',
                slogan: props.getProperty('empresa_slogan') || '',
                logo_url: props.getProperty('empresa_logo_url') || ''
            }
        };
    } catch (e) {
        return { status: 'error', message: 'Error al obtener datos: ' + e.message };
    }
}
