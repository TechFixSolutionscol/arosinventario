
// ========== USER MANAGEMENT BACKEND FUNCTIONS ==========

function updateUserRole(data) {
    // data: { usuario, nuevoRol, adminKey }
    if (!data || !data.usuario || !data.nuevoRol || !data.adminKey) {
        return { status: 'error', message: 'Faltan parámetros.' };
    }

    // Validar admin key
    var adminKey = String(data.adminKey);
    var props = PropertiesService.getScriptProperties();
    var stored = props.getProperty('ADMIN_KEY');
    if (stored) {
        if (adminKey !== stored) return { status: 'error', message: 'Clave admin inválida.' };
    } else {
        if (adminKey !== ADMIN_KEY_CONST) return { status: 'error', message: 'Clave admin inválida.' };
    }

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
    var props = PropertiesService.getScriptProperties();
    var stored = props.getProperty('ADMIN_KEY');
    if (stored) {
        if (adminKey !== stored) return { status: 'error', message: 'Clave admin inválida.' };
    } else {
        if (adminKey !== ADMIN_KEY_CONST) return { status: 'error', message: 'Clave admin inválida.' };
    }

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
