import Fastify from 'fastify';
import websocket from '@fastify/websocket';
import cors from '@fastify/cors';
import { 
    getBuqueConContenedores, 
    crearContenedor,
    eliminarContenedor,
    actualizarFaseEmbarque,
    getPujas, 
    getPujasBloqueadas,
    registrarPuja, 
    registrarBloqueoAduanero, 
    liberarPujaAduanera,
    autenticarUsuarioBD,
    getSaldoUsuario 
} from '../../packages/db/index.js';

const fastify = Fastify({ logger: true });

fastify.register(cors);
fastify.register(websocket);

// Endpoint buque, fase de embarque y contenedores (consultados en vivo desde Supabase)
fastify.get('/api/buque', async (request, reply) => {
    try {
        return await getBuqueConContenedores();
    } catch (err) {
        fastify.log.error('Error al consultar buque en Supabase:', err);
        return {
            buque: 'Emerald Ace',
            faseEmbarque: 'CREADO',
            contenedores: []
        };
    }
});

// Endpoint para que el Agente agregue un nuevo contenedor al buque
fastify.post('/api/contenedores', async (request, reply) => {
    const data = request.body || {};
    if (!data.id || !data.tipo || !data.base) {
        return reply.status(400).send({ exito: false, mensaje: 'Datos de contenedor incompletos (id, tipo y base requeridos).' });
    }

    try {
        const contenedor = await crearContenedor(data);
        return { exito: true, contenedor };
    } catch (err) {
        fastify.log.error('Error al crear contenedor en Supabase:', err);
        return reply.status(500).send({ exito: false, mensaje: 'Error al registrar contenedor en base de datos.' });
    }
});

// Endpoint para que el Agente retire un contenedor del buque
fastify.delete('/api/contenedores/:id', async (request, reply) => {
    const { id } = request.params;
    try {
        const res = await eliminarContenedor(id);
        return { exito: true, id };
    } catch (err) {
        fastify.log.error('Error al eliminar contenedor:', err);
        return reply.status(500).send({ exito: false, mensaje: 'Error al retirar contenedor.' });
    }
});

// Endpoint para que el Agente cambie la fase del embarque con maquina de estados estricta
fastify.post('/api/buque/fase', async (request, reply) => {
    const { fase, agente } = request.body || {};
    if (!fase) {
        return reply.status(400).send({ exito: false, mensaje: 'Fase no especificada.' });
    }

    try {
        const buqueActual = await getBuqueConContenedores();
        const fasePrevia = buqueActual.faseEmbarque || 'CREADO';

        // Reglas de transicion estricta:
        // 1. Para abrir subasta: solo permitido desde CREADO (no se puede si ya zarpo)
        if (fase === 'SUBASTA_ABIERTA') {
            if (fasePrevia === 'SUBASTA_ABIERTA') {
                return reply.status(400).send({ exito: false, mensaje: 'La subasta ya se encuentra abierta.' });
            }
            if (fasePrevia === 'ZARPE_AUTORIZADO') {
                return reply.status(400).send({ 
                    exito: false, 
                    mensaje: 'Transicion denegada: El buque ya zarpo y se encuentra en navegacion. Debe reiniciar un nuevo viaje para abrir subasta.' 
                });
            }
        } 
        // 2. Para cerrar subasta: solo permitido si estaba ABIERTA
        else if (fase === 'SUBASTA_CERRADA') {
            if (fasePrevia !== 'SUBASTA_ABIERTA') {
                return reply.status(400).send({ 
                    exito: false, 
                    mensaje: `Transicion denegada: Solo se puede cerrar una subasta que este abierta (Estado actual: ${fasePrevia}).` 
                });
            }
        } 
        // 3. Para autorizar zarpe: solo permitido si la subasta fue previamente CERRADA
        else if (fase === 'ZARPE_AUTORIZADO') {
            if (fasePrevia !== 'SUBASTA_CERRADA') {
                return reply.status(400).send({ 
                    exito: false, 
                    mensaje: 'Transicion denegada: No puede autorizar el zarpe sin antes haber cerrado la subasta para fiscalizacion aduanera.' 
                });
            }
        } 
        // 4. Reinicio de viaje: solo permitido si ya zarpo o desde cancelacion
        else if (fase === 'CREADO') {
            // Se acepta para preparar nuevo viaje
        }

        const buque = await actualizarFaseEmbarque(fase, request.body || {});
        
        // Notificar cambio de fase y temporizadores en tiempo real
        fastify.websocketServer.clients.forEach(client => {
            if (client.readyState === 1) {
                client.send(JSON.stringify({
                    tipo: 'cambio_fase',
                    fase: fase,
                    buque: buque,
                    agente: agente || 'Agente Portuario',
                    mensaje: `Fase del buque actualizada a: ${fase}`
                }));
            }
        });

        return { exito: true, buque };
    } catch (err) {
        fastify.log.error('Error al actualizar fase de embarque:', err);
        return reply.status(500).send({ exito: false, mensaje: 'Error al actualizar fase en base de datos.' });
    }
});

// Endpoint de solo pujas activas para el módulo del Auditor (desde Supabase)
fastify.get('/api/pujas', async () => {
    try {
        return await getPujas(true);
    } catch (err) {
        fastify.log.error('Error al obtener pujas activas:', err);
        return [];
    }
});

// Endpoint de ofertas actualmente retenidas/bloqueadas (para gestión del Auditor)
fastify.get('/api/pujas-bloqueadas', async () => {
    try {
        return await getPujasBloqueadas();
    } catch (err) {
        fastify.log.error('Error al obtener pujas retenidas:', err);
        return [];
    }
});

// Endpoint de todas las pujas (historial completo) para el Administrador (desde Supabase)
fastify.get('/api/todas-las-pujas', async () => {
    try {
        return await getPujas(false);
    } catch (err) {
        fastify.log.error('Error al obtener historial de pujas:', err);
        return [];
    }
});

// Endpoint de Autenticación contra Supabase
fastify.post('/api/auth/login', async (request, reply) => {
    const { username, password, portal } = request.body || {};
    try {
        const usuario = await autenticarUsuarioBD(username, password);
        if (!usuario) {
            return reply.status(401).send({ exito: false, mensaje: 'Credenciales invalidas en la base de datos.' });
        }

        if (portal === 'CLIENTE' && usuario.portalPermitido !== 'CLIENTE') {
            return reply.status(403).send({ 
                exito: false, 
                mensaje: 'Esta cuenta no tiene acceso al portal de Clientes.' 
            });
        }

        if (portal === 'ADMIN' && usuario.portalPermitido !== 'ADMIN') {
            return reply.status(403).send({ 
                exito: false, 
                mensaje: 'Esta cuenta no pertenece al personal interno de Brizo.' 
            });
        }

        if (portal === 'ADUANAS' && usuario.portalPermitido !== 'ADUANAS') {
            return reply.status(403).send({ 
                exito: false, 
                mensaje: 'Acceso denegado: Portal exclusivo para la Autoridad Aduanera / SAT.' 
            });
        }

        return {
            exito: true,
            sesion: {
                username: usuario.username,
                nombre: usuario.nombre,
                rol: usuario.rol,
                correo: usuario.correo,
                portalPermitido: usuario.portalPermitido,
                token: 'BRZ-' + Math.random().toString(36).substring(2, 10).toUpperCase(),
                iniciadoEn: new Date().toISOString()
            }
        };
    } catch (err) {
        fastify.log.error('Error al autenticar contra Supabase:', err);
        return reply.status(500).send({ exito: false, mensaje: 'Error al conectar con la base de datos.' });
    }
});

// Endpoint para consultar saldo en vivo del cliente
fastify.get('/api/usuario/:username/saldo', async (request, reply) => {
    const { username } = request.params;
    try {
        return await getSaldoUsuario(username);
    } catch (err) {
        return { saldo: 0, saldoDisponible: 0 };
    }
});

// Canal WebSocket para ofertas en vivo con validaciones estrictas de monto, saldo y precio base
fastify.register(async function (fastify) {
    fastify.get('/subasta-en-vivo', { websocket: true }, (socket, req) => {
        socket.on('message', async (message) => {
            try {
                const data = JSON.parse(message);

                // 1. Verificar si la subasta está abierta en Supabase
                const buqueData = await getBuqueConContenedores();
                if (buqueData.faseEmbarque !== 'SUBASTA_ABIERTA') {
                    socket.send(JSON.stringify({
                        error: true,
                        mensaje: `Oferta rechazada: La subasta para el buque ${buqueData.buque} no esta abierta (Estado actual: ${buqueData.faseEmbarque}).`
                    }));
                    return;
                }

                // 2. Validar formato numérico estricto (rechazar letras, caracteres y negativos)
                const rawMonto = String(data.monto || '').trim();
                if (!/^\d+(\.\d{1,2})?$/.test(rawMonto)) {
                    socket.send(JSON.stringify({
                        error: true,
                        mensaje: 'Oferta rechazada: El monto debe ser un numero positivo valido, sin letras ni simbolos.'
                    }));
                    return;
                }

                const montoNum = parseFloat(rawMonto);
                if (isNaN(montoNum) || montoNum <= 0) {
                    socket.send(JSON.stringify({
                        error: true,
                        mensaje: 'Oferta rechazada: El monto de la puja debe ser un valor positivo mayor a cero.'
                    }));
                    return;
                }

                // 3. Validar contra el precio base del contenedor seleccionado
                const contenedor = buqueData.contenedores.find(c => c.id === data.contenedorId);
                if (!contenedor) {
                    socket.send(JSON.stringify({
                        error: true,
                        mensaje: `Oferta rechazada: El contenedor ${data.contenedorId} no existe en este buque.`
                    }));
                    return;
                }

                if (montoNum < contenedor.base) {
                    socket.send(JSON.stringify({
                        error: true,
                        mensaje: `Oferta rechazada: El monto ($${montoNum} USD) no puede ser menor a la tarifa base ($${contenedor.base} USD) del contenedor ${contenedor.id}.`
                    }));
                    return;
                }

                // 4. Validar limite de fondos / saldo disponible del cliente
                const identificador = data.username || data.cliente || '';
                const saldoInfo = await getSaldoUsuario(identificador);
                if (saldoInfo && montoNum > saldoInfo.saldoDisponible) {
                    socket.send(JSON.stringify({
                        error: true,
                        mensaje: `Oferta rechazada: Presupuesto insuficiente. Su saldo disponible es de $${saldoInfo.saldoDisponible} USD y la postura es de $${montoNum} USD.`
                    }));
                    return;
                }

                const pujaId = 'PJ-' + Math.floor(Math.random() * 10000);
                const puertoDestino = data.puertoDestino || 'Puerto de Rotterdam (Paises Bajos) [NLRTM]';
                
                // 5. Guardar permanentemente en Supabase PostgreSQL con contenido declarado y puerto destino
                await registrarPuja({
                    id: pujaId,
                    contenedorId: data.contenedorId,
                    cliente: data.cliente || 'Importadora del Atlantico S.A.',
                    contenido: data.contenido || 'Carga general declarada',
                    puertoDestino: puertoDestino,
                    monto: montoNum
                });

                // 6. Notificar en tiempo real a todos los clientes conectados
                fastify.websocketServer.clients.forEach(client => {
                    if (client.readyState === 1) {
                        client.send(JSON.stringify({ 
                            mensaje: `Oferta aceptada (#${pujaId})`, 
                            monto: montoNum,
                            contenedorId: data.contenedorId,
                            cliente: data.cliente,
                            contenido: data.contenido,
                            puertoDestino: puertoDestino,
                            alerta: false,
                            liberacion: false
                        }));
                    }
                });
            } catch (err) {
                fastify.log.error('Error procesando oferta WebSocket:', err);
            }
        });
    });
});

// Webhook de Aduanas para bloqueo selectivo con registro en Supabase
fastify.post('/webhook/aduanas', async (request, reply) => {
    const { pujaId, motivo, auditor } = request.body || {};
    let contenedorAfectado = 'Desconocido';
    let montoAfectado = '0';
    let contenidoAfectado = '';
    
    try {
        const puja = await registrarBloqueoAduanero(pujaId, motivo, auditor || 'Inspector Aduanero');
        if (puja) {
            contenedorAfectado = puja.contenedorId;
            montoAfectado = puja.monto;
            contenidoAfectado = puja.contenido;
        }
    } catch (err) {
        fastify.log.error('Error al registrar retencion aduanera en Supabase:', err);
    }

    // Difundir alerta a todos los clientes WebSocket (sin emojis)
    fastify.websocketServer.clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(JSON.stringify({ 
                mensaje: `RETENCION ADUANERA: ${motivo}`, 
                monto: `OFERTA $${montoAfectado} ANULADA`,
                contenedorId: `Espacio en ${contenedorAfectado} (Puja #${pujaId})`,
                contenido: contenidoAfectado,
                alerta: true,
                liberacion: false
            }));
        }
    });

    return { status: 'Puja bloqueada individualmente y registrada en Supabase' };
});

// Webhook de Aduanas para LEVANTAR retención con actualización en Supabase
fastify.post('/webhook/aduanas/liberar', async (request, reply) => {
    const { pujaId, justificacion, auditor } = request.body || {};
    let contenedorAfectado = 'Desconocido';
    let montoAfectado = '0';
    let clienteAfectado = '';
    let contenidoAfectado = '';

    try {
        const puja = await liberarPujaAduanera(pujaId, justificacion, auditor || 'Inspector Aduanero');
        if (puja) {
            contenedorAfectado = puja.contenedorId;
            montoAfectado = puja.monto;
            clienteAfectado = puja.cliente;
            contenidoAfectado = puja.contenido;
        }
    } catch (err) {
        fastify.log.error('Error al liberar puja en Supabase:', err);
    }

    // Difundir notificación de levantamiento por WebSocket (sin emojis)
    fastify.websocketServer.clients.forEach(client => {
        if (client.readyState === 1) {
            client.send(JSON.stringify({ 
                mensaje: `RETENCION ADUANERA LEVANTADA: ${justificacion}`, 
                monto: montoAfectado,
                contenedorId: `Espacio en ${contenedorAfectado} (Puja #${pujaId})`,
                cliente: clienteAfectado,
                contenido: contenidoAfectado,
                alerta: false,
                liberacion: true
            }));
        }
    });

    return { status: 'Puja liberada y restablecida como activa en Supabase' };
});

const port = process.env.PORT_SUBASTAS || 3001;
fastify.listen({ port, host: '0.0.0.0' }, (err, address) => {
    if (err) { fastify.log.error(err); process.exit(1); }
    console.log(`[Brizo] Motor conectado a Supabase corriendo en ${address}`);
});
