import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { sql } from '../packages/db/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 50 Clientes Comerciales con usuarios simples y contraseñas tipo 'Asur345' o 'delta453' (sin simbolos)
const clientesNuevos = [
    { username: 'asur', pass: 'Asur345', nombre: 'Agroexportadora del Sur S.A.', sector: 'Productos Agricolas y Frutas' },
    { username: 'delta', pass: 'delta453', nombre: 'Delta Logistica y Carga Maritima', sector: 'Consolidacion y Fletes' },
    { username: 'atlantis', pass: 'Atlantis920', nombre: 'Importadora del Atlantico S.A.', sector: 'Carga General y Manufactura' },
    { username: 'caribe', pass: 'caribe714', nombre: 'Logistica Maritima del Caribe Ltda.', sector: 'Consolidacion de Carga' },
    { username: 'farma', pass: 'Farma628', nombre: 'Distribuidora Farmaceutica Central', sector: 'Farmaceuticos y Medicamentos' },
    { username: 'express', pass: 'express519', nombre: 'Cargas y Consolidados Express', sector: 'Paqueteria y Carga Ligera' },
    { username: 'maya', pass: 'Maya832', nombre: 'Cafe Maya Exportadores S.A.', sector: 'Cafe Especial y Granos' },
    { username: 'pacifico', pass: 'pacifico405', nombre: 'Granos y Harinas del Pacifico', sector: 'Granos a Granel y Harinas' },
    { username: 'textil', pass: 'Textil187', nombre: 'Textilera Panamericana S.A.', sector: 'Textiles y Confecciones' },
    { username: 'almacen', pass: 'almacen692', nombre: 'Almacenes Generales y Logistica', sector: 'Mercancia en Transito' },
    { username: 'quimica', pass: 'Quimica341', nombre: 'Quimicos Industriales de Occidente', sector: 'Sustancias Quimicas IMO' },
    { username: 'frigor', pass: 'frigor850', nombre: 'Frigorificos del Norte S.A.', sector: 'Carnicos y Mariscos Congelados' },
    { username: 'aceros', pass: 'Aceros276', nombre: 'Comercializadora de Aceros y Perfiles', sector: 'Materiales de Construccion' },
    { username: 'electro', pass: 'electro943', nombre: 'Importadora Electronica Siglo XXI', sector: 'Tecnologia y Electrodomesticos' },
    { username: 'valle', pass: 'Valle312', nombre: 'Bebidas y Concentrados del Valle', sector: 'Liquidos y Concentrados' },
    { username: 'tropico', pass: 'tropico681', nombre: 'Exportadora Bananera del Tropico', sector: 'Fruta Fresca Refrigerada' },
    { username: 'motores', pass: 'Motores524', nombre: 'Autopartes y Motores de Centroamerica', sector: 'Repuestos Automotrices' },
    { username: 'fertil', pass: 'fertil739', nombre: 'Fertilizantes y Nutrientes del Agro', sector: 'Quimicos Agricolas IMO' },
    { username: 'resinas', pass: 'Resinas460', nombre: 'Plasticos y Polimeros Modernos', sector: 'Resinas y Plasticos Industriales' },
    { username: 'maderas', pass: 'maderas815', nombre: 'Maderera y Tableros Ecologicos', sector: 'Madera y Derivados' },
    { username: 'avicola', pass: 'Avicola298', nombre: 'Distribuidora Avicola del Altiplano', sector: 'Productos Avicolas Refrigerados' },
    { username: 'papel', pass: 'papel562', nombre: 'Papelera y Cartones del Istmo', sector: 'Papel y Embalajes' },
    { username: 'maquinas', pass: 'Maquinas903', nombre: 'Maquinaria y Equipos Industriales', sector: 'Maquinaria Sobredimensionada' },
    { username: 'caucho', pass: 'caucho374', nombre: 'Importadora de Neumaticos y Hules', sector: 'Neumaticos y Caucho' },
    { username: 'consorcio', pass: 'Consorcio648', nombre: 'Consorcio Alimenticio del Puerto', sector: 'Alimentos Procesados y Enlatados' },
    { username: 'cristal', pass: 'cristal159', nombre: 'Vidrios y Cristales Templados', sector: 'Carga Fragil y Cristales' },
    { username: 'pinturas', pass: 'Pinturas827', nombre: 'Pinturas y Recubrimientos Tecnicos', sector: 'Quimicos Inflamables IMO' },
    { username: 'flores', pass: 'flores436', nombre: 'Exportadora de Flores Exoticas', sector: 'Flores de Corte Reefer' },
    { username: 'calzado', pass: 'Calzado705', nombre: 'Calzado y Cueros del Continente', sector: 'Calzado y Marroquineria' },
    { username: 'belleza', pass: 'belleza914', nombre: 'Cosmeticos y Belleza Natural', sector: 'Cosmetica y Cuidado Personal' },
    { username: 'medica', pass: 'Medica382', nombre: 'Equipos Medicos y Hospitalarios', sector: 'Instrumental Medico y Quirurgico' },
    { username: 'ferre', pass: 'Ferre651', nombre: 'Ferreteria Industrial del Puerto', sector: 'Herramientas y Tornilleria' },
    { username: 'metales', pass: 'metales240', nombre: 'Metales y Reciclajes Sostenibles', sector: 'Metales y Chatarras Industriales' },
    { username: 'marazul', pass: 'MarAzul893', nombre: 'Pesquera del Mar Azul S.A.', sector: 'Mariscos Congelados Reefer' },
    { username: 'azucar', pass: 'azucar572', nombre: 'Azucarera y Alcoholes del Pacifico', sector: 'Azucar y Alcohol Industrial' },
    { username: 'tabaco', pass: 'Tabaco164', nombre: 'Tabacalera Continental', sector: 'Tabaco y Manufactura' },
    { username: 'cables', pass: 'cables839', nombre: 'Materiales Electricos y Conductores', sector: 'Conductores y Transformadores' },
    { username: 'suminav', pass: 'Suminav427', nombre: 'Suministros Navales e Industriales', sector: 'Repuestos y Suministros Maritimos' },
    { username: 'aguas', pass: 'aguas760', nombre: 'Embotelladora de Aguas Termales', sector: 'Bebidas Embotelladas' },
    { username: 'harinas', pass: 'Harinas318', nombre: 'Harinas y Levaduras de America', sector: 'Materias Primas Panaderas' },
    { username: 'citricos', pass: 'citricos952', nombre: 'Exportadora Citricola San Antonio', sector: 'Citricos Frescos Reefer' },
    { username: 'lubri', pass: 'Lubri604', nombre: 'Lubricantes y Grasas del Golfo', sector: 'Aceites y Lubricantes Cisterna' },
    { username: 'minerales', pass: 'minerales283', nombre: 'Minerales y Derivados del Caribe', sector: 'Minerales en Granel' },
    { username: 'pisos', pass: 'Pisos846', nombre: 'Ceramicas y Azulejos del Centro', sector: 'Pisos y Ceramicas' },
    { username: 'lacteos', pass: 'lacteos471', nombre: 'Lacteos y Quesos de Montana', sector: 'Productos Lacteos Reefer' },
    { username: 'modas', pass: 'Modas593', nombre: 'Confecciones y Disenos Globales', sector: 'Prendas de Vestir de Exportacion' },
    { username: 'cerveza', pass: 'cerveza128', nombre: 'Cerveceria Artesanal de la Costa', sector: 'Bebidas Alcoholicas Embaladas' },
    { username: 'sensores', pass: 'Sensores764', nombre: 'Instrumentacion y Control Automatico', sector: 'Sensores y Paneles Electronicos' },
    { username: 'seguridad', pass: 'seguridad395', nombre: 'Seguridad Industrial y Proteccion', sector: 'EPP y Proteccion Personal' },
    { username: 'fletes', pass: 'Fletes819', nombre: 'Logistica y Fletes Multimodal S.A.', sector: 'Carga General y Trinquete' }
];

// 4 Agentes Portuarios / Oficiales de Despacho
const agentesNuevos = [
    { username: 'agente1', pass: 'Muelle482', nombre: 'Cap. Roberto Mendez - Muelle Norte', cargo: 'Agente de Atraque y Muelle Norte' },
    { username: 'agente2', pass: 'torre719', nombre: 'Lic. Claudia Morales - Torre de Control', cargo: 'Oficial de Control de Trafico y Bahias' },
    { username: 'agente3', pass: 'Zarpe365', nombre: 'Ing. Fernando Castillo - Despacho Buque', cargo: 'Agente Despachador de Turno' },
    { username: 'agente4', pass: 'bahia904', nombre: 'Cap. Sofia Valverde - Coordinacion Flota', cargo: 'Oficial de Estiba y Asignacion' }
];

// 3 Auditores Fiscales de Aduanas / SAT
const auditoresNuevos = [
    { username: 'sat1', pass: 'Sat528', nombre: 'Lic. Alejandro Samayoa - SAT Inspector Fiscal I', cargo: 'Auditor Fiscal de Aduanas Maritimas' },
    { username: 'sat2', pass: 'aduanas841', nombre: 'Dra. Patricia Noriega - SAT Analista de Manifiestos', cargo: 'Auditora de Dictamenes y Aforo' },
    { username: 'sat3', pass: 'Fiscal693', nombre: 'Lic. Marco Vinicio Ramos - SAT Supervision Aduanera', cargo: 'Supervisor de Intervencion Fiscal' }
];

// 3 Administradores Generales de Brizo Naviera
const administradoresNuevos = [
    { username: 'admin1', pass: 'Brizo617', nombre: 'Direccion de Operaciones Flota', cargo: 'Administrador General de Operaciones' },
    { username: 'admin2', pass: 'naviera835', nombre: 'Superintendencia de Sistemas y Logistica', cargo: 'Administrador de Plataforma y Logistica' },
    { username: 'admin3', pass: 'Puerto249', nombre: 'Gerencia General Naviera Brizo', cargo: 'Director Ejecutivo Brizo Logistics' }
];

async function regenerarUsuarios() {
    console.log('[Brizo] Regenerando usuarios con nombres simples y claves alfanumericas sin simbolos...');

    const listaTotal = [];

    // 1. Clientes (50)
    clientesNuevos.forEach(c => {
        listaTotal.push({
            username: c.username,
            password_hash: c.pass,
            nombre: c.nombre,
            correo: `${c.username}@brizoclientes.com`,
            rol: 'CLIENTE',
            portal_permitido: 'CLIENTE',
            detalle: c.sector
        });
    });

    // 2. Agentes (4)
    agentesNuevos.forEach(a => {
        listaTotal.push({
            username: a.username,
            password_hash: a.pass,
            nombre: a.nombre,
            correo: `${a.username}@brizonaviera.com`,
            rol: 'AGENTE',
            portal_permitido: 'ADMIN',
            detalle: a.cargo
        });
    });

    // 3. Auditores SAT (3)
    auditoresNuevos.forEach(s => {
        listaTotal.push({
            username: s.username,
            password_hash: s.pass,
            nombre: s.nombre,
            correo: `${s.username}@sat.gob.gt`,
            rol: 'AUDITOR',
            portal_permitido: 'ADUANAS',
            detalle: s.cargo
        });
    });

    // 4. Administradores (3)
    administradoresNuevos.forEach(ad => {
        listaTotal.push({
            username: ad.username,
            password_hash: ad.pass,
            nombre: ad.nombre,
            correo: `${ad.username}@brizonaviera.com`,
            rol: 'ADMIN',
            portal_permitido: 'ADMIN',
            detalle: ad.cargo
        });
    });

    try {
        // Eliminar las cuentas antiguas creadas en el lote anterior (cliente01..cliente50, etc.)
        await sql`
            DELETE FROM usuarios 
            WHERE username ~ '^cliente[0-9]{2}$' 
               OR username ~ '^agente[0-9]{2}$' 
               OR username ~ '^auditor[0-9]{2}$' 
               OR username ~ '^admin[0-9]{2}$';
        `;
        console.log('[Brizo] Lote anterior numerado eliminado de Supabase.');

        // Insertar o actualizar los 60 nuevos usuarios simplificados
        for (const u of listaTotal) {
            await sql`
                INSERT INTO usuarios (username, password_hash, nombre, correo, rol, portal_permitido)
                VALUES (${u.username}, ${u.password_hash}, ${u.nombre}, ${u.correo}, ${u.rol}, ${u.portal_permitido})
                ON CONFLICT (username) DO UPDATE SET
                    password_hash = EXCLUDED.password_hash,
                    nombre = EXCLUDED.nombre,
                    correo = EXCLUDED.correo,
                    rol = EXCLUDED.rol,
                    portal_permitido = EXCLUDED.portal_permitido;
            `;
        }
        console.log(`[Brizo] Se registraron ${listaTotal.length} usuarios con claves simplificadas en Supabase.`);

        // Actualizar tambien las 4 cuentas base maestras sin simbolos
        await sql`UPDATE usuarios SET password_hash = 'Cliente123' WHERE username = 'cliente'`;
        await sql`UPDATE usuarios SET password_hash = 'Admin123' WHERE username = 'admin'`;
        await sql`UPDATE usuarios SET password_hash = 'Agente123' WHERE username = 'agente'`;
        await sql`UPDATE usuarios SET password_hash = 'Auditor123' WHERE username = 'auditor'`;

        // Generar archivo ACCESOS_USUARIOS.txt actualizado
        const txtPath = path.resolve(__dirname, '../ACCESOS_USUARIOS.txt');

        let txt = '================================================================================\n';
        txt += '                    BRIZO LOGISTICS - DIRECTORIO OFICIAL DE ACCESOS\n';
        txt += '             Plataforma de Subastas Maritimas y Fiscalizacion Aduanera SAT\n';
        txt += '================================================================================\n';
        txt += `Ultima actualizacion: ${new Date().toISOString()}\n`;
        txt += `Total de cuentas simplificadas: ${listaTotal.length}\n`;
        txt += 'Formato de claves: Alfanumerico simple (letras y numeros, sin simbolos especiales)\n';
        txt += '================================================================================\n\n';

        // 1. SECCION CLIENTES
        txt = txt + '--------------------------------------------------------------------------------\n';
        txt = txt + 'PORTAL: CLIENTES (URL: http://localhost:3000/index.html -> Portal Clientes)\n';
        txt = txt + 'Total: 50 cuentas | Rol: CLIENTE | Acceso: cliente.html\n';
        txt = txt + '--------------------------------------------------------------------------------\n';
        txt = txt + String('USUARIO').padEnd(16) + String('CONTRASENA').padEnd(18) + String('EMPRESA / RAZON SOCIAL').padEnd(42) + 'SECTOR / MERCANCIA\n';
        txt = txt + '-'.repeat(105) + '\n';

        listaTotal.filter(u => u.rol === 'CLIENTE').forEach(u => {
            txt = txt + String(u.username).padEnd(16) + 
                        String(u.password_hash).padEnd(18) + 
                        String(u.nombre).padEnd(42) + 
                        u.detalle + '\n';
        });

        // 2. SECCION AGENTES DE DESPACHO
        txt = txt + '\n--------------------------------------------------------------------------------\n';
        txt = txt + 'PORTAL: BRIZO NAVIERA (URL: http://localhost:3000/index.html -> Brizo Naviera)\n';
        txt = txt + 'Total: 4 cuentas | Rol: AGENTE | Acceso: agente.html\n';
        txt = txt + 'Funciones: Apertura/Cierre de Subasta, Gestion de Contenedores, Autorizacion de Zarpe\n';
        txt = txt + '--------------------------------------------------------------------------------\n';
        txt = txt + String('USUARIO').padEnd(16) + String('CONTRASENA').padEnd(18) + String('OFICIAL DE OPERACIONES').padEnd(42) + 'CARGO / SECTOR\n';
        txt = txt + '-'.repeat(105) + '\n';

        listaTotal.filter(u => u.rol === 'AGENTE').forEach(u => {
            txt = txt + String(u.username).padEnd(16) + 
                        String(u.password_hash).padEnd(18) + 
                        String(u.nombre).padEnd(42) + 
                        u.detalle + '\n';
        });

        // 3. SECCION AUDITORES SAT
        txt = txt + '\n--------------------------------------------------------------------------------\n';
        txt = txt + 'PORTAL: ADUANAS / SAT (URL: http://localhost:3000/index.html -> Aduanas / SAT)\n';
        txt = txt + 'Total: 3 cuentas | Rol: AUDITOR | Acceso: auditor.html\n';
        txt = txt + 'Funciones: Fiscalizacion de Contenido Declarado, Emision y Levantamiento de Retenciones\n';
        txt = txt + '--------------------------------------------------------------------------------\n';
        txt = txt + String('USUARIO').padEnd(16) + String('CONTRASENA').padEnd(18) + String('OFICIAL FISCAL SAT').padEnd(42) + 'PUESTO / FUNCION\n';
        txt = txt + '-'.repeat(105) + '\n';

        listaTotal.filter(u => u.rol === 'AUDITOR').forEach(u => {
            txt = txt + String(u.username).padEnd(16) + 
                        String(u.password_hash).padEnd(18) + 
                        String(u.nombre).padEnd(42) + 
                        u.detalle + '\n';
        });

        // 4. SECCION ADMINISTRADORES
        txt = txt + '\n--------------------------------------------------------------------------------\n';
        txt = txt + 'PORTAL: BRIZO NAVIERA - ADMIN (URL: http://localhost:3000/index.html -> Brizo Naviera)\n';
        txt = txt + 'Total: 3 cuentas | Rol: ADMIN | Acceso: admin.html\n';
        txt = txt + 'Funciones: Torre de Control General, Supervision de Subastas en Vivo y Trazabilidad\n';
        txt = txt + '--------------------------------------------------------------------------------\n';
        txt = txt + String('USUARIO').padEnd(16) + String('CONTRASENA').padEnd(18) + String('ADMINISTRADOR').padEnd(42) + 'AREA\n';
        txt = txt + '-'.repeat(105) + '\n';

        listaTotal.filter(u => u.rol === 'ADMIN').forEach(u => {
            txt = txt + String(u.username).padEnd(16) + 
                        String(u.password_hash).padEnd(18) + 
                        String(u.nombre).padEnd(42) + 
                        u.detalle + '\n';
        });

        txt = txt + '\n================================================================================\n';
        txt = txt + 'FIN DEL DIRECTORIO DE ACCESOS\n';
        txt = txt + '================================================================================\n';

        fs.writeFileSync(txtPath, txt, 'utf8');
        console.log(`[Brizo] Directorio de accesos actualizado guardado en: ${txtPath}`);

    } catch (err) {
        console.error('[Brizo] Error al regenerar usuarios:', err);
    } finally {
        await sql.end();
    }
}

regenerarUsuarios();
