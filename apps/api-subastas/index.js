import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';

const fastify = Fastify({ logger: true });

fastify.register(cors);
fastify.register(websocket);

const puerto = {
  buque: 'Emerald Ace',
  contenedores: [
    { id: 'REF-001', tipo: 'Carga Refrigerada', base: 1000 },
    { id: 'SEC-002', tipo: 'Carga Seca', base: 500 },
    { id: 'PEL-003', tipo: 'Carga Peligrosa', base: 1500 }
  ]
};

// Memoria de pujas individuales (fracciones de contenedor)
let pujasActivas = [];

fastify.get('/api/buque', async () => puerto);
// Nuevo endpoint que devuelve solo las pujas activas al Auditor
fastify.get('/api/pujas', async () => pujasActivas.filter(p => p.estado === 'activa'));
// Nuevo endpoint para el Administrador: devuelve TODO el historial
fastify.get('/api/todas-las-pujas', async () => pujasActivas);

fastify.register(async function (fastify) {
  fastify.get('/subasta-en-vivo', { websocket: true }, (socket, req) => {
    socket.on('message', message => {
      const data = JSON.parse(message);
      // Generar un ID único para esta puja/fracción
      const pujaId = 'PJ-' + Math.floor(Math.random() * 10000);
      
      const nuevaPuja = {
        id: pujaId,
        contenedorId: data.contenedorId,
        monto: data.monto,
        estado: 'activa',
        timestamp: new Date().toLocaleTimeString()
      };
      pujasActivas.push(nuevaPuja);
      
      // Notificar a todos
      fastify.websocketServer.clients.forEach(client => {
        if (client.readyState === 1) {
          client.send(JSON.stringify({ 
            mensaje: `Oferta aceptada (#${pujaId})`, 
            monto: data.monto,
            contenedorId: data.contenedorId,
            alerta: false
          }));
        }
      });
    });
  });
});

// Webhook de Aduanas actualizado para bloquear una puja específica
fastify.post('/webhook/aduanas', async (request, reply) => {
  const { pujaId, motivo } = request.body;
  
  // Buscar la puja y cambiar su estado
  const puja = pujasActivas.find(p => p.id === pujaId);
  let contenedorAfectado = 'Desconocido';
  let montoAfectado = '0';
  
  if (puja) {
    puja.estado = 'bloqueada';
    contenedorAfectado = puja.contenedorId;
    montoAfectado = puja.monto;
  }

  fastify.websocketServer.clients.forEach(client => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ 
        mensaje: `RETENCIÓN ADUANERA: ${motivo}`, 
        monto: `OFERTA $${montoAfectado} ANULADA`,
        contenedorId: `Espacio en ${contenedorAfectado} (Puja #${pujaId})`,
        alerta: true
      }));
    }
  });

  return { status: 'Puja bloqueada individualmente' };
});

fastify.listen({ port: 3001 }, (err, address) => {
  if (err) { fastify.log.error(err); process.exit(1); }
  console.log(`[Brizo] Motor corriendo en ${address}`);
});