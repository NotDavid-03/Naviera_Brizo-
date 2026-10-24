import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cargar .env desde la raíz del proyecto
const envPath = path.resolve(__dirname, '../../.env');
if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#')) {
            const [key, ...values] = trimmed.split('=');
            if (key && values.length) {
                const val = values.join('=').replace(/^["']|["']$/g, '');
                if (!process.env[key.trim()]) {
                    process.env[key.trim()] = val;
                }
            }
        }
    });
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
    console.warn('[Brizo DB] Advertencia: DATABASE_URL no definida en .env');
}

const cleanUrl = (dbUrl || '').replace(/\[([^\]]+)\]/, '$1');

export const sql = postgres(cleanUrl, {
    ssl: 'require',
    connect_timeout: 10,
    max: 10
});

/**
 * Obtiene los datos del buque, fase operativa actual y contenedores con especificaciones
 */
export async function getBuqueConContenedores() {
    try {
        const buques = await sql`
            SELECT id, nombre, estado, 
                   COALESCE(fase_embarque, 'CREADO') AS "faseEmbarque",
                   COALESCE(viaje_codigo, 'VIAJE-001') AS "viajeCodigo",
                   COALESCE(duracion_subasta_min, 5) AS "duracionSubastaMin",
                   COALESCE(duracion_aduanas_min, 3) AS "duracionAduanasMin",
                   fin_subasta AS "finSubasta",
                   fin_aduanas AS "finAduanas",
                   subasta_iniciada_en AS "subastaIniciadaEn",
                   aduanas_iniciada_en AS "aduanasIniciadaEn"
            FROM buques 
            LIMIT 1
        `;
        const buque = buques[0] || { 
            id: 'EMERALD-ACE', 
            nombre: 'Emerald Ace', 
            estado: 'Atracado', 
            faseEmbarque: 'CREADO',
            viajeCodigo: 'VIAJE-001',
            duracionSubastaMin: 5,
            duracionAduanasMin: 3
        };
        
        const contenedores = await sql`
            SELECT id, tipo, 
                   COALESCE(capacidad_teu, 1) AS "capacidadTeu",
                   COALESCE(peso_max_ton, 28.0)::float AS "pesoMaxTon",
                   COALESCE(volumen_m3, 33.2)::float AS "volumenM3",
                   COALESCE(especificaciones, 'Carga general estandar') AS "especificaciones",
                   base::float
            FROM contenedores 
            ORDER BY id ASC
        `;
        
        return {
            id: buque.id,
            buque: buque.nombre,
            estado: buque.estado,
            faseEmbarque: buque.faseEmbarque,
            viajeCodigo: buque.viajeCodigo,
            duracionSubastaMin: buque.duracionSubastaMin,
            duracionAduanasMin: buque.duracionAduanasMin,
            finSubasta: buque.finSubasta,
            finAduanas: buque.finAduanas,
            subastaIniciadaEn: buque.subastaIniciadaEn,
            aduanasIniciadaEn: buque.aduanasIniciadaEn,
            contenedores: contenedores
        };
    } catch (err) {
        return await getBuqueConContenedoresREST();
    }
}

async function getBuqueConContenedoresREST() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    try {
        const [resBuque, resConts] = await Promise.all([
            fetch(`${supabaseUrl}/rest/v1/buques?id=eq.EMERALD-ACE`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }).then(r => r.json()),
            fetch(`${supabaseUrl}/rest/v1/contenedores?select=*&order=id.asc`, { headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` } }).then(r => r.json())
        ]);
        const buque = (resBuque && resBuque[0]) || { id: 'EMERALD-ACE', nombre: 'Emerald Ace', estado: 'Atracado', fase_embarque: 'CREADO' };
        const contenedores = (resConts || []).map(c => ({
            id: c.id,
            tipo: c.tipo,
            capacidadTeu: c.capacidad_teu || 1,
            pesoMaxTon: Number(c.peso_max_ton || 28),
            volumenM3: Number(c.volumen_m3 || 33.2),
            especificaciones: c.especificaciones || 'Carga general estandar',
            base: Number(c.base || 1000)
        }));
        return {
            id: buque.id,
            buque: buque.nombre,
            estado: buque.estado,
            faseEmbarque: buque.fase_embarque || 'CREADO',
            viajeCodigo: buque.viaje_codigo || 'VIAJE-001',
            duracionSubastaMin: buque.duracion_subasta_min || 5,
            duracionAduanasMin: buque.duracion_aduanas_min || 3,
            finSubasta: buque.fin_subasta,
            finAduanas: buque.fin_aduanas,
            subastaIniciadaEn: buque.subasta_iniciada_en,
            aduanasIniciadaEn: buque.aduanas_iniciada_en,
            contenedores
        };
    } catch (e) {
        return {
            id: 'EMERALD-ACE',
            buque: 'Emerald Ace',
            estado: 'Atracado',
            faseEmbarque: 'CREADO',
            viajeCodigo: 'VIAJE-001',
            duracionSubastaMin: 5,
            duracionAduanasMin: 3,
            contenedores: []
        };
    }
}

/**
 * Agrega un nuevo contenedor al buque (gestionado por el Agente Portuario)
 */
export async function crearContenedor({ id, tipo, capacidadTeu, pesoMaxTon, volumenM3, especificaciones, base }) {
    const rows = await sql`
        INSERT INTO contenedores (id, buque_id, tipo, capacidad_teu, peso_max_ton, volumen_m3, especificaciones, base)
        VALUES (${id}, 'EMERALD-ACE', ${tipo}, ${capacidadTeu || 1}, ${pesoMaxTon || 28.0}, ${volumenM3 || 33.2}, ${especificaciones || 'Carga general'}, ${base})
        RETURNING id, tipo, capacidad_teu AS "capacidadTeu", peso_max_ton::float AS "pesoMaxTon", volumen_m3::float AS "volumenM3", especificaciones, base::float
    `;
    return rows[0];
}

/**
 * Elimina o retira un contenedor del buque (gestionado por el Agente Portuario)
 */
export async function eliminarContenedor(id) {
    const rows = await sql`
        DELETE FROM contenedores
        WHERE id = ${id}
        RETURNING id
    `;
    return rows[0] || null;
}

/**
 * Actualiza la fase del embarque, temporizadores y ciclo de viaje
 */
export async function actualizarFaseEmbarque(nuevaFase, params = {}, buqueId = 'EMERALD-ACE') {
    if (nuevaFase === 'SUBASTA_ABIERTA') {
        const duracionSubastaMin = Math.max(1, parseInt(params.duracionSubastaMin, 10) || 5);
        const duracionAduanasMin = Math.max(1, parseInt(params.duracionAduanasMin, 10) || 3);
        const subastaIniciadaEn = new Date();
        const finSubasta = new Date(Date.now() + duracionSubastaMin * 60 * 1000);

        const rows = await sql`
            UPDATE buques
            SET fase_embarque = 'SUBASTA_ABIERTA',
                duracion_subasta_min = ${duracionSubastaMin},
                duracion_aduanas_min = ${duracionAduanasMin},
                subasta_iniciada_en = ${subastaIniciadaEn},
                fin_subasta = ${finSubasta},
                fin_aduanas = NULL
            WHERE id = ${buqueId} OR id = 'EMERALD-ACE'
            RETURNING id, nombre, estado, fase_embarque AS "faseEmbarque", viaje_codigo AS "viajeCodigo",
                      duracion_subasta_min AS "duracionSubastaMin", duracion_aduanas_min AS "duracionAduanasMin",
                      fin_subasta AS "finSubasta", fin_aduanas AS "finAduanas"
        `;
        return rows[0];
    } else if (nuevaFase === 'SUBASTA_CERRADA') {
        const bActual = await sql`SELECT duracion_aduanas_min, viaje_codigo FROM buques WHERE id = ${buqueId} OR id = 'EMERALD-ACE' LIMIT 1`;
        const durAduanas = Math.max(1, bActual[0]?.duracion_aduanas_min || 3);
        const viajeActual = bActual[0]?.viaje_codigo || 'VIAJE-001';
        const aduanasIniciadaEn = new Date();
        const finAduanas = new Date(Date.now() + durAduanas * 60 * 1000);

        // Cobro oficial de adjudicacion: El dinero no se cobra hasta cerrar la subasta
        // Para cada contenedor con ofertas activas en este viaje, se cobra el monto al mejor postor
        const ganadores = await sql`
            SELECT DISTINCT ON (contenedor_id) id, cliente_nombre, monto::float, contenedor_id
            FROM pujas
            WHERE viaje_codigo = ${viajeActual} AND estado = 'activa'
            ORDER BY contenedor_id, monto DESC
        `;

        for (const g of ganadores) {
            await sql`
                UPDATE usuarios
                SET saldo = GREATEST(0, saldo - ${g.monto}),
                    saldo_disponible = GREATEST(0, saldo_disponible - ${g.monto})
                WHERE LOWER(nombre) = LOWER(${g.cliente_nombre}) 
                   OR LOWER(username) = LOWER(${g.cliente_nombre});
            `;
        }

        const rows = await sql`
            UPDATE buques
            SET fase_embarque = 'SUBASTA_CERRADA',
                aduanas_iniciada_en = ${aduanasIniciadaEn},
                fin_aduanas = ${finAduanas}
            WHERE id = ${buqueId} OR id = 'EMERALD-ACE'
            RETURNING id, nombre, estado, fase_embarque AS "faseEmbarque", viaje_codigo AS "viajeCodigo",
                      duracion_subasta_min AS "duracionSubastaMin", duracion_aduanas_min AS "duracionAduanasMin",
                      fin_subasta AS "finSubasta", fin_aduanas AS "finAduanas"
        `;
        return rows[0];
    } else if (nuevaFase === 'ZARPE_AUTORIZADO') {
        const rows = await sql`
            UPDATE buques
            SET fase_embarque = 'ZARPE_AUTORIZADO'
            WHERE id = ${buqueId} OR id = 'EMERALD-ACE'
            RETURNING id, nombre, estado, fase_embarque AS "faseEmbarque", viaje_codigo AS "viajeCodigo"
        `;
        return rows[0];
    } else if (nuevaFase === 'CREADO') {
        // Al preparar siguiente viaje, incrementamos el codigo de viaje para aislar historiales
        const bActual = await sql`SELECT viaje_codigo FROM buques WHERE id = ${buqueId} OR id = 'EMERALD-ACE' LIMIT 1`;
        const codActual = bActual[0]?.viaje_codigo || 'VIAJE-001';
        const match = codActual.match(/VIAJE-(\d+)/);
        const nuevoNum = match ? parseInt(match[1], 10) + 1 : 2;
        const nuevoViajeCodigo = 'VIAJE-' + String(nuevoNum).padStart(3, '0');

        const rows = await sql`
            UPDATE buques
            SET fase_embarque = 'CREADO',
                viaje_codigo = ${nuevoViajeCodigo},
                fin_subasta = NULL,
                fin_aduanas = NULL,
                subasta_iniciada_en = NULL,
                aduanas_iniciada_en = NULL
            WHERE id = ${buqueId} OR id = 'EMERALD-ACE'
            RETURNING id, nombre, estado, fase_embarque AS "faseEmbarque", viaje_codigo AS "viajeCodigo"
        `;
        return rows[0];
    }

    const rows = await sql`
        UPDATE buques
        SET fase_embarque = ${nuevaFase}
        WHERE id = ${buqueId} OR id = 'EMERALD-ACE'
        RETURNING id, nombre, estado, fase_embarque AS "faseEmbarque", viaje_codigo AS "viajeCodigo"
    `;
    return rows[0];
}

/**
 * Obtiene las ofertas del viaje en curso incluyendo la declaracion de contenido
 */
export async function getPujas(soloActivas = false) {
    // 1. Obtener el viaje_codigo activo del buque
    const buques = await sql`SELECT COALESCE(viaje_codigo, 'VIAJE-001') AS "viajeCodigo" FROM buques LIMIT 1`;
    const viajeActual = buques[0]?.viajeCodigo || 'VIAJE-001';

    if (soloActivas) {
        const rows = await sql`
            SELECT id, contenedor_id AS "contenedorId", cliente_nombre AS "cliente",
                   COALESCE(contenido_declarado, 'Carga general') AS "contenido",
                   COALESCE(puerto_destino, 'Puerto de Rotterdam (Paises Bajos) [NLRTM]') AS "puertoDestino",
                   monto::float, estado, viaje_codigo AS "viajeCodigo", created_at AS "timestamp"
            FROM pujas
            WHERE viaje_codigo = ${viajeActual} AND estado = 'activa'
            ORDER BY created_at DESC
        `;
        return rows.map(r => ({ ...r, timestamp: new Date(r.timestamp).toLocaleTimeString() }));
    }

    const rows = await sql`
        SELECT id, contenedor_id AS "contenedorId", cliente_nombre AS "cliente",
               COALESCE(contenido_declarado, 'Carga general') AS "contenido",
               COALESCE(puerto_destino, 'Puerto de Rotterdam (Paises Bajos) [NLRTM]') AS "puertoDestino",
               monto::float, estado, viaje_codigo AS "viajeCodigo", created_at AS "timestamp"
        FROM pujas
        WHERE viaje_codigo = ${viajeActual}
        ORDER BY created_at DESC
    `;
    return rows.map(r => ({ ...r, timestamp: new Date(r.timestamp).toLocaleTimeString() }));
}

/**
 * Obtiene las ofertas que estan actualmente retenidas para el viaje en curso
 */
export async function getPujasBloqueadas() {
    const buques = await sql`SELECT COALESCE(viaje_codigo, 'VIAJE-001') AS "viajeCodigo" FROM buques LIMIT 1`;
    const viajeActual = buques[0]?.viajeCodigo || 'VIAJE-001';

    const rows = await sql`
        SELECT p.id, p.contenedor_id AS "contenedorId", p.cliente_nombre AS "cliente",
               COALESCE(p.contenido_declarado, 'Carga general') AS "contenido",
               COALESCE(p.puerto_destino, 'Puerto de Rotterdam (Paises Bajos) [NLRTM]') AS "puertoDestino",
               p.monto::float, p.estado, p.viaje_codigo AS "viajeCodigo",
               b.motivo AS "ultimoMotivo", b.created_at AS "fechaBloqueo"
        FROM pujas p
        LEFT JOIN LATERAL (
            SELECT motivo, created_at
            FROM bloqueos
            WHERE puja_id = p.id
            ORDER BY created_at DESC
            LIMIT 1
        ) b ON true
        WHERE p.estado = 'bloqueada' AND p.viaje_codigo = ${viajeActual}
        ORDER BY p.created_at DESC
    `;
    return rows.map(r => ({
        ...r,
        fechaBloqueo: r.fechaBloqueo ? new Date(r.fechaBloqueo).toLocaleTimeString() : 'N/A'
    }));
}

/**
 * Registra una nueva puja en Supabase vinculada al viaje en curso y puerto de destino
 */
export async function registrarPuja({ id, contenedorId, cliente, contenido, monto, puertoDestino }) {
    const buques = await sql`SELECT COALESCE(viaje_codigo, 'VIAJE-001') AS "viajeCodigo" FROM buques LIMIT 1`;
    const viajeActual = buques[0]?.viajeCodigo || 'VIAJE-001';
    const destinoFinal = puertoDestino || 'Puerto de Rotterdam (Paises Bajos) [NLRTM]';

    const rows = await sql`
        INSERT INTO pujas (id, contenedor_id, cliente_nombre, contenido_declarado, puerto_destino, monto, estado, viaje_codigo)
        VALUES (${id}, ${contenedorId}, ${cliente || 'Cliente Anonimo'}, ${contenido || 'Carga general declarada'}, ${destinoFinal}, ${monto}, 'activa', ${viajeActual})
        RETURNING id, contenedor_id AS "contenedorId", cliente_nombre AS "cliente", contenido_declarado AS "contenido", puerto_destino AS "puertoDestino", monto::float, estado, viaje_codigo AS "viajeCodigo", created_at
    `;
    return rows[0];
}

/**
 * Registra un bloqueo aduanero y actualiza el estado de la puja
 */
export async function registrarBloqueoAduanero(pujaId, motivo, auditor = 'Inspector Aduanero') {
    const pujasActualizadas = await sql`
        UPDATE pujas
        SET estado = 'bloqueada'
        WHERE id = ${pujaId}
        RETURNING id, contenedor_id AS "contenedorId", monto::float, cliente_nombre AS "cliente", contenido_declarado AS "contenido", puerto_destino AS "puertoDestino"
    `;

    await sql`
        INSERT INTO bloqueos (puja_id, motivo, auditor)
        VALUES (${pujaId}, ${'RETENCION: ' + (motivo || 'Inspeccion preventiva')}, ${auditor})
    `;

    return pujasActualizadas[0] || null;
}

/**
 * Levanta una retención aduanera y restablece la puja a estado 'activa'
 */
export async function liberarPujaAduanera(pujaId, justificacion, auditor = 'Inspector Aduanero') {
    const pujasActualizadas = await sql`
        UPDATE pujas
        SET estado = 'activa'
        WHERE id = ${pujaId}
        RETURNING id, contenedor_id AS "contenedorId", monto::float, cliente_nombre AS "cliente", contenido_declarado AS "contenido", puerto_destino AS "puertoDestino"
    `;

    await sql`
        INSERT INTO bloqueos (puja_id, motivo, auditor)
        VALUES (${pujaId}, ${'LIBERACION / RETENCION LEVANTADA: ' + (justificacion || 'Inspeccion conforme')}, ${auditor})
    `;

    return pujasActualizadas[0] || null;
}

/**
 * Valida credenciales de usuario desde la tabla usuarios
 */
export async function autenticarUsuarioBD(username, password) {
    try {
        const rows = await sql`
            SELECT id, username, password_hash, nombre, correo, rol, portal_permitido,
                   COALESCE(saldo, 3500.00)::float AS "saldo",
                   COALESCE(saldo_disponible, 3500.00)::float AS "saldoDisponible"
            FROM usuarios
            WHERE LOWER(username) = LOWER(${username})
            LIMIT 1
        `;

        if (rows.length === 0) return null;
        const u = rows[0];
        if (u.password_hash !== password) return null;

        return {
            id: u.id,
            username: u.username,
            nombre: u.nombre,
            correo: u.correo,
            rol: u.rol,
            portalPermitido: u.portal_permitido,
            saldo: u.saldo,
            saldoDisponible: u.saldoDisponible
        };
    } catch (err) {
        return await autenticarUsuarioREST(username, password);
    }
}

async function autenticarUsuarioREST(username, password) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return null;
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/usuarios?username=ilike.${encodeURIComponent(username)}&limit=1`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        const data = await res.json();
        if (!data || data.length === 0) return null;
        const u = data[0];
        if (u.password_hash !== password) return null;
        return {
            id: u.id,
            username: u.username,
            nombre: u.nombre,
            correo: u.correo,
            rol: u.rol,
            portalPermitido: u.portal_permitido,
            saldo: u.saldo !== undefined ? Number(u.saldo) : 3500,
            saldoDisponible: u.saldo_disponible !== undefined ? Number(u.saldo_disponible) : 3500
        };
    } catch (e) {
        return null;
    }
}

/**
 * Consulta el saldo actual y disponible de un usuario
 */
export async function getSaldoUsuario(identificador) {
    try {
        const rows = await sql`
            SELECT COALESCE(saldo, 3500.00)::float AS "saldo", 
                   COALESCE(saldo_disponible, 3500.00)::float AS "saldoDisponible"
            FROM usuarios
            WHERE LOWER(username) = LOWER(${identificador}) OR LOWER(nombre) = LOWER(${identificador})
            LIMIT 1
        `;
        return rows[0] || { saldo: 3500, saldoDisponible: 3500 };
    } catch (err) {
        return await getSaldoUsuarioREST(identificador);
    }
}

async function getSaldoUsuarioREST(identificador) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return { saldo: 3500, saldoDisponible: 3500 };
    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/usuarios?or=(username.ilike.${encodeURIComponent(identificador)},nombre.ilike.${encodeURIComponent(identificador)})&limit=1`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        const data = await res.json();
        if (data && data.length > 0) {
            return {
                saldo: Number(data[0].saldo || 3500),
                saldoDisponible: Number(data[0].saldo_disponible || 3500)
            };
        }
    } catch (e) {
        // fallback
    }
    return { saldo: 3500, saldoDisponible: 3500 };
}
