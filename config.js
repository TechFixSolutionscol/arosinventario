/**
 * config.js - Configuración centralizada de FixOps
 * Todas las constantes compartidas entre módulos van aquí.
 */
const APP_CONFIG = {
    // URL del Web App de Google Apps Script
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbyf_32xSTYhEmw49O4YW_PoZav2TNsVNARP-G015r6fR6NTxebpncQJVf7ID5aYNP0diw/exec',

    // Configuración de impuestos
    IVA_DEFAULT: 0.19,

    // Configuración de inventario
    STOCK_MINIMO_DEFAULT: 5,

    // Nombre de la aplicación
    APP_NAME: 'FixOps',

    // Roles disponibles
    ROLES: ['Admin', 'Vendedor', 'Bodeguero'],

    // Permisos de visibilidad de secciones por rol
    // Cada rol lista las secciones (data-section) que puede ver
    ROLE_PERMISSIONS: {
        'Admin': ['dashboard', 'inventario', 'productos', 'categorias', 'compras', 'ventas', 'pos', 'resumenes', 'contactos', 'usuarios', 'configuracion'],
        'Vendedor': ['dashboard', 'inventario', 'ventas', 'pos', 'contactos', 'resumenes'],
        'Bodeguero': ['dashboard', 'inventario', 'productos', 'categorias', 'compras', 'contactos']
    }
};
