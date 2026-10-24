import http from 'http';
import fs from 'fs';
import path from 'path';
import net from 'net';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3000;
const PORT_SUBASTAS = process.env.PORT_SUBASTAS || 3001;
const PORT_ADUANAS = process.env.PORT_ADUANAS || 3002;

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
};

function proxyHttpRequest(req, res, targetPort) {
    const options = {
        hostname: '127.0.0.1',
        port: targetPort,
        path: req.url,
        method: req.method,
        headers: {
            ...req.headers,
            host: `127.0.0.1:${targetPort}`
        }
    };

    const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
    });

    proxyReq.on('error', (err) => {
        console.error(`[Gateway] Error al conectar con microservicio en puerto ${targetPort}:`, err.message);
        res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ 
            error: true, 
            mensaje: `Microservicio interno en puerto ${targetPort} no disponible o iniciando.` 
        }));
    });

    req.pipe(proxyReq, { end: true });
}

const server = http.createServer((req, res) => {
    const rawUrl = req.url || '/';
    const reqPath = rawUrl.split('?')[0];

    // 1. Enrutar peticiones de API y Webhooks hacia api-subastas (Puerto 3001)
    if (reqPath.startsWith('/api/') || reqPath.startsWith('/webhook/')) {
        proxyHttpRequest(req, res, PORT_SUBASTAS);
        return;
    }

    // 2. Enrutar acciones de SAT / Aduanas hacia api-aduanas (Puerto 3002)
    if (reqPath.startsWith('/emitir-bloqueo') || reqPath.startsWith('/emitir-liberacion')) {
        proxyHttpRequest(req, res, PORT_ADUANAS);
        return;
    }

    // 3. Servir archivos estaticos del Frontend
    let fileRelative = reqPath;
    if (fileRelative === '/' || fileRelative === '') {
        fileRelative = '/index.html';
    }

    const safePath = path.normalize(fileRelative).replace(/^(\.\.[\/\\])+/, '');
    const filePath = path.join(__dirname, safePath);

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('404 Not Found');
            return;
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        res.writeHead(200, {
            'Content-Type': contentType,
            'Access-Control-Allow-Origin': '*'
        });
        res.end(data);
    });
});

// 4. Puerta de Enlace para WebSockets: reenvia la conexion en vivo hacia api-subastas (3001)
server.on('upgrade', (req, clientSocket, head) => {
    const targetSocket = net.connect(PORT_SUBASTAS, '127.0.0.1', () => {
        targetSocket.write(`${req.method} ${req.url} HTTP/1.1\r\n`);
        for (const [key, val] of Object.entries(req.headers)) {
            if (Array.isArray(val)) {
                val.forEach(v => targetSocket.write(`${key}: ${v}\r\n`));
            } else {
                targetSocket.write(`${key}: ${val}\r\n`);
            }
        }
        targetSocket.write('\r\n');
        if (head && head.length) {
            targetSocket.write(head);
        }

        targetSocket.pipe(clientSocket);
        clientSocket.pipe(targetSocket);
    });

    targetSocket.on('error', (err) => {
        console.error('[Gateway WS] Error conectando socket al motor de subastas:', err.message);
        clientSocket.destroy();
    });

    clientSocket.on('error', () => {
        targetSocket.destroy();
    });
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`[Gateway Brizo] Servidor unificado escuchando en puerto ${PORT}`);
    console.log(`[Gateway Brizo] Frontend, API REST y WebSockets accesibles en http://localhost:${PORT}/index.html`);
});
