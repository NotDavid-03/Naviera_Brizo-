import Fastify from 'fastify';
import cors from '@fastify/cors';

const fastify = Fastify({ logger: true });

// URL del motor de subastas (configurable por variable de entorno para despliegue web)
const SUBASTAS_URL = process.env.SUBASTAS_URL || 'http://localhost:3001';

// Habilitar CORS para permitir peticiones desde el navegador (Frontend del Auditor)
fastify.register(cors);

// Endpoint para el Auditor: Emitir bloqueo selectivo a una puja especifica
fastify.post('/emitir-bloqueo', async (request, reply) => {
  const { pujaId, motivo, auditor } = request.body || { pujaId: 'PJ-000', motivo: 'Inspeccion preventiva' };
  
  console.log(`\n[CONTROL ADUANERO - ORDEN DE RETENCION] Puja ID: ${pujaId}`);
  console.log(`[MOTIVO]: ${motivo}`);
  
  try {
    const res = await fetch(`${SUBASTAS_URL}/webhook/aduanas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pujaId, motivo, auditor })
    });
    console.log('-> Notificacion de retencion enviada exitosamente a subastas.');
  } catch (error) {
    console.log('-> Error al notificar retencion a subastas:', error.message);
    return reply.status(500).send({ exito: false, mensaje: 'Error al comunicar con motor de subastas.' });
  }

  return { 
    exito: true, 
    mensaje: `La oferta ${pujaId} ha sido retenida y anulada preventivamente.` 
  };
});

// Endpoint para el Auditor: Levantar retención selectiva y reactivar la puja
fastify.post('/emitir-liberacion', async (request, reply) => {
  const { pujaId, justificacion, auditor } = request.body || { pujaId: 'PJ-000', justificacion: 'Inspeccion conforme' };
  
  console.log(`\n[CONTROL ADUANERO - DICTAMEN FAVORABLE] Levantando retencion. Puja ID: ${pujaId}`);
  console.log(`[DICTAMEN / JUSTIFICACION]: ${justificacion}`);
  
  try {
    const res = await fetch(`${SUBASTAS_URL}/webhook/aduanas/liberar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pujaId, justificacion, auditor })
    });
    console.log('-> Notificacion de levantamiento enviada exitosamente a subastas.');
  } catch (error) {
    console.log('-> Error al notificar levantamiento a subastas:', error.message);
    return reply.status(500).send({ exito: false, mensaje: 'Error al comunicar con motor de subastas.' });
  }

  return { 
    exito: true, 
    mensaje: `La oferta ${pujaId} ha sido liberada exitosamente y restablecida en la subasta.` 
  };
});

// Iniciar el servidor en el puerto 3002
fastify.listen({ port: 3002, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`[Auditoria] Modulo aduanero corriendo en ${address}`);
});
