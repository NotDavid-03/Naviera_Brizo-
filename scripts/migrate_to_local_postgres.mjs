import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from '../packages/db/node_modules/postgres/src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const localDbUrl = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/brizo';
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const sql = postgres(localDbUrl, { max: 5 });

async function fetchFromSupabase(table) {
    try {
        const res = await fetch(`${supabaseUrl}/${table}?select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        if (!res.ok) {
            console.warn(`[Supabase] Tabla ${table} retorno status ${res.status}`);
            return [];
        }
        return await res.json();
    } catch (e) {
        console.error(`[Supabase] Error al consultar ${table}:`, e.message);
        return [];
    }
}

async function runMigration() {
    console.log('[Migracion] Conectando a PostgreSQL local en localhost:5432/brizo...');
    
    // 1. Aplicar schema.sql
    const schemaSql = fs.readFileSync(path.join(rootDir, 'packages', 'db', 'schema.sql'), 'utf8');
    await sql.unsafe(schemaSql);
    console.log('[Migracion] Tablas y esquema relacional creados con exito en PostgreSQL local.');

    // 2. Extraer usuarios de Supabase
    console.log('[Migracion] Descargando usuarios desde Supabase...');
    const usuarios = await fetchFromSupabase('usuarios');
    console.log(`[Migracion] Se obtuvieron ${usuarios.length} usuarios de Supabase.`);

    for (const u of usuarios) {
        await sql`
            INSERT INTO usuarios (id, username, password_hash, nombre, correo, rol, portal_permitido, saldo, saldo_disponible, created_at)
            VALUES (${u.id}, ${u.username}, ${u.password_hash}, ${u.nombre}, ${u.correo}, ${u.rol}, ${u.portal_permitido}, ${u.saldo || 3500}, ${u.saldo_disponible || 3500}, ${u.created_at || new Date()})
            ON CONFLICT (username) DO UPDATE SET
                password_hash = EXCLUDED.password_hash,
                nombre = EXCLUDED.nombre,
                rol = EXCLUDED.rol,
                portal_permitido = EXCLUDED.portal_permitido,
                saldo = EXCLUDED.saldo,
                saldo_disponible = EXCLUDED.saldo_disponible;
        `;
    }
    console.log('[Migracion] Todos los usuarios migrados a la base de datos local.');

    // 3. Extraer contenedores
    console.log('[Migracion] Descargando contenedores desde Supabase...');
    const contenedores = await fetchFromSupabase('contenedores');
    for (const c of contenedores) {
        await sql`
            INSERT INTO contenedores (id, buque_id, tipo, capacidad_teu, peso_max_ton, volumen_m3, especificaciones, base, created_at)
            VALUES (${c.id}, 'EMERALD-ACE', ${c.tipo}, ${c.capacidad_teu || 1}, ${c.peso_max_ton || 28}, ${c.volumen_m3 || 33.2}, ${c.especificaciones || 'Carga general'}, ${c.base || 1000}, ${c.created_at || new Date()})
            ON CONFLICT (id) DO UPDATE SET
                tipo = EXCLUDED.tipo,
                capacidad_teu = EXCLUDED.capacidad_teu,
                peso_max_ton = EXCLUDED.peso_max_ton,
                volumen_m3 = EXCLUDED.volumen_m3,
                especificaciones = EXCLUDED.especificaciones,
                base = EXCLUDED.base;
        `;
    }
    console.log(`[Migracion] ${contenedores.length} contenedores migrados.`);

    // 4. Extraer buques
    const buques = await fetchFromSupabase('buques');
    for (const b of buques) {
        await sql`
            INSERT INTO buques (id, nombre, estado, fase_embarque, viaje_codigo, duracion_subasta_min, duracion_aduanas_min)
            VALUES (${b.id}, ${b.nombre}, ${b.estado || 'Atracado'}, ${b.fase_embarque || 'CREADO'}, ${b.viaje_codigo || 'VIAJE-001'}, ${b.duracion_subasta_min || 5}, ${b.duracion_aduanas_min || 3})
            ON CONFLICT (id) DO UPDATE SET
                nombre = EXCLUDED.nombre,
                estado = EXCLUDED.estado,
                fase_embarque = EXCLUDED.fase_embarque,
                viaje_codigo = EXCLUDED.viaje_codigo;
        `;
    }

    // 5. Extraer pujas
    const pujas = await fetchFromSupabase('pujas');
    for (const p of pujas) {
        await sql`
            INSERT INTO pujas (id, contenedor_id, cliente_nombre, contenido_declarado, puerto_destino, monto, estado, viaje_codigo, created_at)
            VALUES (${p.id}, ${p.contenedor_id}, ${p.cliente_nombre}, ${p.contenido_declarado}, ${p.puerto_destino || 'Puerto de Rotterdam'}, ${p.monto}, ${p.estado || 'activa'}, ${p.viaje_codigo || 'VIAJE-001'}, ${p.created_at || new Date()})
            ON CONFLICT (id) DO NOTHING;
        `;
    }
    console.log(`[Migracion] ${pujas.length} posturas previas migradas.`);

    // 6. Validar conteos locales finales
    const [cUsers] = await sql`SELECT count(*) as total FROM usuarios`;
    const [cConts] = await sql`SELECT count(*) as total FROM contenedores`;
    const [cBuques] = await sql`SELECT count(*) as total FROM buques`;
    const [cPujas] = await sql`SELECT count(*) as total FROM pujas`;

    console.log('\n================================================================');
    console.log('         MIGRACION A POSTGRESQL LOCAL EXITOSA');
    console.log('================================================================');
    console.log(`- Usuarios en BD Local:     ${cUsers.total}`);
    console.log(`- Contenedores en BD Local: ${cConts.total}`);
    console.log(`- Buques en BD Local:       ${cBuques.total}`);
    console.log(`- Pujas en BD Local:        ${cPujas.total}`);
    console.log('================================================================\n');

    await sql.end();
    process.exit(0);
}

runMigration().catch(err => {
    console.error('[Error Migracion]:', err);
    process.exit(1);
});
