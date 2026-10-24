# Brizo Logistics - Plataforma de Subastas Maritimas y Fiscalizacion Aduanera SAT

Sistema integral para la gestion de subastas de fletes de contenedores, despacho maritimo y fiscalizacion aduanera independiente, con sincronizacion en tiempo real y persistencia en Supabase PostgreSQL.

---

## 1. Arquitectura del Sistema

El proyecto esta organizado bajo una arquitectura modular (monorepo) compuesta por tres microservicios principales:

- **Frontend (`apps/frontend/`):**
  - Interfaces web responsivas desarrolladas en HTML5 y Tailwind CSS.
  - Portales independientes segun perfil de usuario:
    - `index.html`: Portal central de autenticacion con control de acceso por roles.
    - `cliente.html`: Subasta de espacios, seleccion de puerto de desembarque, declaracion de carga y monitoreo exclusivo por contenedor.
    - `agente.html`: Consola del Agente Portuario para gestion de la flota (20 contenedores ISO), apertura/cierre de subastas, temporizadores y autorizacion de zarpe.
    - `auditor.html`: Modulo independiente del Auditor Fiscal SAT para emision y levantamiento de retenciones aduaneras.
    - `admin.html`: Torre de Control para supervision integral del ciclo de viaje y trazabilidad de ofertas.
  - `config.js`: Configuracion dinamica de endpoints y WebSockets adaptable a entornos locales y despliegues en la nube.
  - `server.js`: Servidor HTTP nativo Node.js para servir los portales estaticos.

- **Motor de Subastas y WebSocket (`apps/api-subastas/`):**
  - Servidor Fastify en puerto `3001` con canal WebSocket (`/subasta-en-vivo`).
  - Maquina de estados estricta para el ciclo del embarque (`CREADO` -> `SUBASTA_ABIERTA` -> `SUBASTA_CERRADA` -> `ZARPE_AUTORIZADO`).
  - Validaciones de negocio: precios base minimos por contenedor, verificacion de presupuesto del consignatario y cobro diferido hasta el cierre de subasta.

- **Modulo Aduanero Independiente SAT (`apps/api-aduanas/`):**
  - Servicio Fastify en puerto `3002` que opera con total separacion del modulo administrativo de la naviera.
  - Notifica ordenes de retencion preventiva y dictamenes favorables de liberacion hacia el motor de subastas.

- **Capa de Persistencia (`packages/db/`):**
  - Conector nativo PostgreSQL con soporte para Supabase (`postgres.js`).
  - Esquema relacional con tablas: `usuarios`, `buques`, `contenedores`, `pujas` y `bloqueos`.

---

## 2. Flujo Operativo Oficial

1. **Apertura de Subasta:** El Agente Portuario define los temporizadores de subasta y aduanas y abre el embarque.
2. **Recepcion de Posturas:** Los clientes seleccionan un contenedor del catalogo (20 unidades estandar con nomenclatura ISO y ficha tecnica en sistema metrico), eligen el puerto de desembarque (Rotterdam, Manzanillo o Long Beach), declaran el contenido e ingresan su oferta sin sobrepasar su presupuesto asignado.
3. **Cierre de Subasta y Adjudicacion:** Al culminar el plazo o por orden del agente, la subasta se cierra y el sistema debita el saldo de los ganadores de cada contenedor adjudicado.
4. **Fiscalizacion Aduanera SAT:** La autoridad fiscal examina manifiestos y declaraciones; puede retener ofertas sospechosas o levantar retenciones tras inspeccion fisica.
5. **Autorizacion de Zarpe:** El agente valida que el plazo aduanero haya concluido y autoriza el zarpe del buque. Si existen cargas retenidas no liberadas, quedan varadas en muelle.
6. **Supervision y Auditoria:** La administracion general y auditoria mantienen visibilidad en tiempo real de todo el proceso sin intervenir en las facultades aduaneras.

---

## 3. Requisitos Previos

- Node.js >= 20
- pnpm >= 9 (o npm / yarn)
- Cuenta o instancia activa de Supabase / PostgreSQL

---

## 4. Variables de Entorno

Crear un archivo `.env` en la raiz del proyecto basado en `.env.example`:

```env
# Configuracion Supabase / PostgreSQL
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
DATABASE_URL=postgresql://postgres:your-password@db.your-project-id.supabase.co:5432/postgres

# Puertos
PORT_SUBASTAS=3001
PORT_ADUANAS=3002
PORT_FRONTEND=3000
```

---

## 5. Ejecucion en Entorno Local

Instalar dependencias:
```bash
pnpm install
```

Iniciar los microservicios:

- **Modo Servicio Unificado (Recomendado para local y acceso externo):**
  ```bash
  pnpm start:service
  ```
  Inicia simultaneamente el motor de subastas, el modulo aduanero SAT y la puerta de enlace en el puerto `3000`.

- **O bien, iniciar cada microservicio por separado:**
  - Motor de Subastas: `pnpm start:subastas` (Puerto 3001)
  - Modulo Aduanero SAT: `pnpm start:aduanas` (Puerto 3002)
  - Servidor Frontend: `pnpm start:frontend` (Puerto 3000)

Acceso al portal: `http://localhost:3000/index.html`

### Conectar a Usuarios Externos (Internet sin abrir puertos)
Con el servicio activo (`pnpm start:service`), ejecuta en otra terminal:
```bash
npx localtunnel --port 3000
# o bien
npx untun tunnel 3000
```
Comparte el enlace HTTPS resultante con los usuarios remotos.

El directorio de credenciales para pruebas se encuentra documentado en `ACCESOS_USUARIOS.txt`.

---

## 6. Guia de Despliegue en la Web

### Opcion A: Despliegue en Plataformas PaaS (Render / Railway / Fly.io)

1. **Subastas y WebSocket (`apps/api-subastas`):**
   - Comando de inicio: `node apps/api-subastas/index.js`
   - Configurar variables: `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `PORT=3001` (o la asignada por la plataforma).
2. **Modulo Aduanas SAT (`apps/api-aduanas`):**
   - Comando de inicio: `node apps/api-aduanas/index.js`
   - Configurar variable: `SUBASTAS_URL` apuntando a la URL publica de la API de subastas.
3. **Frontend (`apps/frontend`):**
   - Puede desplegarse como servicio web estatico (Vercel, Netlify, Cloudflare Pages o GitHub Pages).
   - Para enlazar con la API remota, configure las variables en `apps/frontend/config.js` o mediante `BRIZO_CONFIG.configurarEndpoints(apiUrl, wsUrl, aduanasUrl)`.

### Opcion B: Despliegue en un Unico Servidor VPS (Docker / PM2)

Con PM2 en un servidor Linux:
```bash
pm2 start apps/api-subastas/index.js --name "brizo-subastas"
pm2 start apps/api-aduanas/index.js --name "brizo-aduanas"
pm2 start apps/frontend/server.js --name "brizo-frontend"
```

---

## 7. Licencia y Cumplimiento

Brizo Logistics &copy; 2026. Todos los derechos reservados. Desarrollado bajo estandares internacionales de fletes maritimos y fiscalizacion portuaria.
