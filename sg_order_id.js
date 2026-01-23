
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
