import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import postgres from 'postgres';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Buscar .env en la raíz del proyecto
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
    console.error('ERROR: No se encontró DATABASE_URL en el archivo .env');
    process.exit(1);
}

console.log('Conectando a Supabase PostgreSQL...');

// Asegurarse de quitar corchetes si quedaron del placeholder
const cleanUrl = dbUrl.replace(/\[([^\]]+)\]/, '$1');

const sql = postgres(cleanUrl, {
    ssl: 'require',
    connect_timeout: 15
});

async function migrar() {
    try {
        console.log('Verificando conexión...');
        const ver = await sql`SELECT version(), current_database()`;
        console.log('[OK] Conectado exitosamente a:', ver[0].current_database);

        const schemaFile = path.join(__dirname, 'schema.sql');
        const sqlSchema = fs.readFileSync(schemaFile, 'utf8');

        console.log('Ejecutando creacion de tablas y datos iniciales...');
        await sql.unsafe(sqlSchema);

        console.log('[OK] Tablas creadas: usuarios, buques, contenedores, pujas, bloqueos.');
        
        const usuarios = await sql`SELECT username, rol, nombre FROM usuarios`;
        console.log('\n--- Usuarios cargados en Supabase ---');
        usuarios.forEach(u => console.log(`- [${u.rol}] ${u.username} -> ${u.nombre}`));

        const buque = await sql`SELECT * FROM buques`;
        const contenedores = await sql`SELECT * FROM contenedores`;
        console.log(`\n[OK] Buque: ${buque[0].nombre}`);
        console.log(`[OK] Espacios configurados: ${contenedores.length}`);

        console.log('\n[OK] Migracion completada con exito!');
    } catch (err) {
        console.error('Error durante la migración:', err);
    } finally {
        await sql.end();
    }
}

migrar();
