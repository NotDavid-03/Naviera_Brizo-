import Fastify from 'fastify';
import cors from '@fastify/cors';

const fastify = Fastify({ logger: true });

// Habilitar CORS para permitir peticiones desde el navegador (Frontend del Auditor)
fastify.register(cors);

// Endpoint para el Auditor: Emitir bloqueo selectivo a una puja/fracción específica
fastify.post('/emitir-bloqueo', async (request, reply) => {
  const { pujaId, motivo } = request.body || { pujaId: 'PJ-000', motivo: 'Inspección' };
  
  console.log(`\n[ALERTA ROJA] Bloqueando fracción de carga. Puja ID: ${pujaId}`);
  console.log(`[MOTIVO]: ${motivo}`);
  
  // Disparar evento hacia el motor de subastas
  try {
    await fetch('http://localhost:3001/webhook/aduanas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pujaId, motivo })
    });
    console.log('-> Notificación de bloqueo selectivo enviada exitosamente a subastas.');
  } catch (error) {
    console.log('-> Error al notificar a subastas:', error.message);
  }

  return { 
    exito: true, 
    mensaje: `La oferta/espacio ${pujaId} ha sido bloqueada exitosamente.` 
  };
});

// Iniciar el servidor en el puerto 3002
fastify.listen({ port: 3002 }, (err, address) => {
  if (err) {
    fastify.log.error(err);
    process.exit(1);
  }
  console.log(`[Auditoría] Módulo aduanero corriendo en ${address}`);
});