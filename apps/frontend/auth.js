/**
 * auth.js - Sistema de Autenticación y Primera Línea de Seguridad
 * Conectado con PostgreSQL / Supabase
 * Separación estricta entre Naviera Brizo y Autoridad Aduanera
 * Brizo Logistics Platform
 */

const USUARIOS_SISTEMA = {
    // 1 Usuario Cliente (Comercial)
    'cliente': {
        pass: 'cliente123',
        rol: 'CLIENTE',
        nombre: 'Importadora del Atlántico S.A.',
        correo: 'contacto@atlantico-logistics.com',
        redirect: 'cliente.html',
        portalPermitido: 'CLIENTE'
    },
    // 2 Usuarios Internos Brizo Logistics
    'admin': {
        pass: 'admin123',
        rol: 'ADMIN',
        nombre: 'Superintendente General',
        correo: 'admin@brizo-logistics.com',
        redirect: 'admin.html',
        portalPermitido: 'ADMIN'
    },
    'agente': {
        pass: 'agente123',
        rol: 'AGENTE',
        nombre: 'Agente de Despacho Portuario',
        correo: 'operaciones@brizo-logistics.com',
        redirect: 'agente.html',
        portalPermitido: 'ADMIN'
    },
    // 1 Usuario Externo e Independiente (Autoridad Aduanera / SAT)
    'auditor': {
        pass: 'auditor123',
        rol: 'AUDITOR',
        nombre: 'Inspector Aduanero (Control SAT)',
        correo: 'auditoria.sat@brizo-logistics.com',
        redirect: 'auditor.html',
        portalPermitido: 'ADUANAS' // Portal independiente de Aduanas
    }
};

const SESSION_KEY = 'brizo_active_session';

/**
 * Intenta autenticar un usuario verificando contra la API conectada a Supabase
 * o usando la validación local de contingencia.
 */
async function autenticarUsuario(portalSeleccionado, username, password) {
    const usuarioKey = (username || '').trim().toLowerCase();

    // 1. Intentar autenticar contra el backend conectado a Supabase
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        const apiBase = (window.BRIZO_CONFIG && window.BRIZO_CONFIG.apiSubastas) || 'http://localhost:3001';

        const res = await fetch(`${apiBase}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: usuarioKey,
                password: password,
                portal: portalSeleccionado
            }),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (res.ok) {
            const data = await res.json();
            if (data.exito && data.sesion) {
                const sesion = {
                    ...data.sesion,
                    redirect: obtenerRedireccionPorRol(data.sesion.rol)
                };
                sessionStorage.setItem(SESSION_KEY, JSON.stringify(sesion));
                return {
                    exito: true,
                    sesion: sesion,
                    redirect: sesion.redirect
                };
            }
        } else {
            const errData = await res.json().catch(() => ({}));
            if (errData.mensaje) {
                return { exito: false, mensaje: errData.mensaje };
            }
        }
    } catch (e) {
        console.warn('Backend Supabase no disponible, validando localmente...');
    }

    // 2. Validación de respaldo local (Primera línea de seguridad)
    const usuario = USUARIOS_SISTEMA[usuarioKey];

    if (!usuario) {
        return {
            exito: false,
            mensaje: 'El usuario ingresado no existe en el sistema.'
        };
    }

    if (usuario.pass !== password) {
        return {
            exito: false,
            mensaje: 'Contraseña incorrecta. Por favor verifique sus credenciales.'
        };
    }

    // Validación estricta de portal independiente
    if (portalSeleccionado === 'CLIENTE' && usuario.portalPermitido !== 'CLIENTE') {
        return {
            exito: false,
            mensaje: 'Esta cuenta no pertenece a Clientes. Utilice el portal correspondiente.'
        };
    }

    if (portalSeleccionado === 'ADMIN' && usuario.portalPermitido !== 'ADMIN') {
        return {
            exito: false,
            mensaje: 'Esta cuenta no pertenece al personal interno de Brizo.'
        };
    }

    if (portalSeleccionado === 'ADUANAS' && usuario.portalPermitido !== 'ADUANAS') {
        return {
            exito: false,
            mensaje: 'Acceso denegado: Este portal es de uso exclusivo de la Autoridad Aduanera / SAT.'
        };
    }

    const sesion = {
        username: usuarioKey,
        nombre: usuario.nombre,
        rol: usuario.rol,
        correo: usuario.correo,
        portalPermitido: usuario.portalPermitido,
        redirect: usuario.redirect,
        token: 'BRZ-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
        iniciadoEn: new Date().toISOString()
    };

    sessionStorage.setItem(SESSION_KEY, JSON.stringify(sesion));

    return {
        exito: true,
        sesion: sesion,
        redirect: usuario.redirect
    };
}

function obtenerRedireccionPorRol(rol) {
    switch (rol) {
        case 'CLIENTE': return 'cliente.html';
        case 'ADMIN': return 'admin.html';
        case 'AGENTE': return 'agente.html';
        case 'AUDITOR': return 'auditor.html';
        default: return 'cliente.html';
    }
}

function obtenerSesionActiva() {
    try {
        const raw = sessionStorage.getItem(SESSION_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

function cerrarSesion() {
    sessionStorage.removeItem(SESSION_KEY);
    window.location.href = 'index.html';
}

/**
 * Protege la página actual verificando que el usuario tenga sesión y rol autorizado
 */
function protegerRuta(rolesPermitidos) {
    const sesion = obtenerSesionActiva();

    if (!sesion) {
        window.location.replace('index.html?alerta=no_autenticado');
        return null;
    }

    if (rolesPermitidos && rolesPermitidos.length > 0 && !rolesPermitidos.includes(sesion.rol)) {
        alert(`Acceso denegado: Su rol (${sesion.rol}) no tiene autorización para acceder a esta área.`);
        window.location.replace(sesion.redirect || 'index.html');
        return null;
    }

    return sesion;
}
