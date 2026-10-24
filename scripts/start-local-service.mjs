import { spawn } from 'child_process';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

function getLocalIp() {
    const interfaces = os.networkInterfaces();
    let fallback = '127.0.0.1';

    for (const name of Object.keys(interfaces)) {
        // Ignorar adaptadores virtuales tipicos de WSL / Hyper-V / Docker
        const lowerName = name.toLowerCase();
        if (lowerName.includes('vethernet') || lowerName.includes('wsl') || lowerName.includes('docker')) {
            continue;
        }

        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                if (iface.address.startsWith('192.168.') || iface.address.startsWith('10.')) {
                    return iface.address;
                }
                fallback = iface.address;
            }
        }
    }
    return fallback;
}

const localIp = getLocalIp();
const processes = [];

function startProcess(name, relativeScriptPath) {
    console.log(`[Servicio] Iniciando ${name}...`);
    // Usamos ruta relativa con cwd fijado en la raiz para evitar problemas con espacios en Windows
    const proc = spawn(process.execPath, [relativeScriptPath], {
        cwd: rootDir,
        stdio: 'inherit'
    });

    proc.on('error', (err) => {
        console.error(`[Error] Fallo al iniciar ${name}:`, err.message);
    });

    processes.push({ name, proc });
    return proc;
}

// Iniciar los 3 microservicios con rutas relativas robustas
startProcess('api-subastas (Puerto 3001)', path.join('apps', 'api-subastas', 'index.js'));
startProcess('api-aduanas (Puerto 3002)', path.join('apps', 'api-aduanas', 'index.js'));
startProcess('gateway-frontend (Puerto 3000)', path.join('apps', 'frontend', 'server.js'));

setTimeout(() => {
    console.log('\n================================================================');
    console.log('             BRIZO LOGISTICS - SERVICIO LOCAL ACTIVO');
    console.log('================================================================');
    console.log('1. Acceso Local (en esta computadora):');
    console.log('   http://localhost:3000/index.html\n');
    console.log('2. Acceso en la MISMA RED WI-FI / LAN (otros celulares/laptops):');
    console.log(`   http://${localIp}:3000/index.html\n`);
    console.log('3. Acceso desde CUALQUIER LUGAR DEL MUNDO (Internet sin abrir puertos):');
    console.log('   Abre OTRA ventana de terminal y ejecuta este comando para');
    console.log('   generar tu enlace publico mundial instantaneo:');
    console.log('   > npx localtunnel --port 3000');
    console.log('   o bien con Cloudflare:');
    console.log('   > npx untun tunnel 3000');
    console.log('================================================================\n');
    console.log('[Info] Presiona Ctrl + C en cualquier momento para apagar el servicio.\n');
}, 1500);

let isShuttingDown = false;
function shutdown() {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\n[Servicio] Apagando todos los microservicios de Brizo...');
    processes.forEach(({ name, proc }) => {
        try {
            proc.kill();
        } catch (e) {
            // Ignorar
        }
    });
    process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
