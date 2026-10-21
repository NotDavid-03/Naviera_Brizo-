# Brizo Logistics — contexto del proyecto

## 1. Propósito de este documento

Este documento describe el estado actual del repositorio para que una persona o una IA pueda entender la idea, la arquitectura, los datos, los flujos y las limitaciones antes de continuar el desarrollo. Se basa en el código presente, no en funcionalidades futuras o supuestas.

## 2. Idea central

Brizo Logistics es un prototipo de plataforma logística marítima para publicar espacios de carga de un buque y recibir ofertas de clientes en tiempo real. Incluye una demostración de coordinación entre:

1. **Cliente:** consulta el buque y sus espacios, envía una oferta y ve notificaciones en vivo.
2. **Agente operativo:** consulta la información del buque y el manifiesto de espacios habilitados.
3. **Auditor/Aduanas:** consulta ofertas activas y puede solicitar la retención selectiva de una oferta.
4. **Administrador:** consulta todas las ofertas y presenta métricas e historial.

La característica demostrada más importante es que Aduanas puede bloquear una oferta individual sin detener todas las ofertas ni el contenedor completo. La solución actual es una maqueta funcional local, no un sistema listo para operación logística real.

## 3. Estado y alcance

- La lógica de servidor está implementada en dos servicios Node.js con Fastify.
- Las interfaces son cuatro archivos HTML independientes con JavaScript en línea y Tailwind CSS cargado desde CDN.
- El estado de las ofertas vive solamente en memoria dentro del proceso de subastas. Reiniciar ese proceso borra el historial.
- No hay base de datos, autenticación, usuarios, permisos, pagos, documentación aduanera persistida, cierre formal de subastas ni asignación de ganadores.
- No se observan pruebas automatizadas implementadas para estos servicios.
- El `README.md` actual contiene información del starter genérico de Turborepo y no explica Brizo. Este documento sirve como contexto específico del proyecto.

## 4. Arquitectura del repositorio

```text
brizo-logistics/
├── apps/
│   ├── api-subastas/       # API principal, WebSocket y estado temporal de ofertas
│   ├── api-aduanas/        # API de auditoría que envía solicitudes de bloqueo
│   └── frontend/           # Interfaces estáticas HTML por rol
├── packages/
│   ├── db/                 # No contiene implementación de base de datos en el estado inspeccionado
│   ├── ui/                 # Componentes React de ejemplo, no conectados a las pantallas HTML
│   ├── eslint-config/      # Configuración compartida de ESLint
│   └── typescript-config/  # Configuraciones compartidas de TypeScript
├── package.json            # Scripts generales y herramientas del monorepo
├── pnpm-workspace.yaml
├── turbo.json
└── CONTEXTO_PROYECTO.md
```

El repositorio conserva una estructura de monorepo con pnpm y Turborepo, pero las interfaces de Brizo no son aplicaciones Next.js: son páginas HTML estáticas. Los paquetes compartidos de UI/configuración parecen proceder de una plantilla y no forman parte del flujo actual de subastas.

### Tecnologías observadas

- Node.js (el `package.json` raíz declara `>=24`).
- pnpm (`pnpm@11.25.0` declarado en el manifiesto raíz).
- Fastify para las APIs.
- `@fastify/websocket` para las ofertas en vivo.
- `@fastify/cors` habilitado en ambas APIs.
- HTML, JavaScript del navegador y Tailwind CSS vía CDN.
- Turborepo como orquestador de tareas del monorepo.

## 5. Servicios y responsabilidades

### 5.1 API de subastas — `apps/api-subastas/index.js`

Es el servidor principal y escucha en el puerto **3001**.

#### Datos de buque iniciales

El objeto `puerto` contiene:

| Campo | Valor actual |
|---|---|
| Buque | `Emerald Ace` |
| `REF-001` | Carga Refrigerada; base `1000` |
| `SEC-002` | Carga Seca; base `500` |
| `PEL-003` | Carga Peligrosa; base `1500` |

Estos valores están codificados directamente en memoria; no se cargan de configuración ni de una base de datos.

#### Endpoints y canal en vivo

| Método y ruta | Función |
|---|---|
| `GET /api/buque` | Devuelve el nombre del buque y el arreglo de contenedores/espacios. |
| `GET /api/pujas` | Devuelve solo las ofertas cuyo estado sea `activa`. Lo usa Auditoría. |
| `GET /api/todas-las-pujas` | Devuelve todas las ofertas, incluidas las bloqueadas. Lo usa Administración. |
| WebSocket `/subasta-en-vivo` | Recibe ofertas y difunde a todos los clientes conectados las nuevas ofertas y las alertas de Aduanas. |
| `POST /webhook/aduanas` | Busca una oferta por ID, la marca `bloqueada` si existe y difunde una alerta a los clientes conectados. |

#### Cómo se procesa una oferta

El navegador envía por WebSocket un objeto parecido a:

```json
{
  "contenedorId": "REF-001",
  "monto": "1200"
}
```

El backend genera un ID de la forma `PJ-` seguido por un entero aleatorio entre 0 y 9999 y guarda una oferta con esta forma:

```json
{
  "id": "PJ-1234",
  "contenedorId": "REF-001",
  "monto": "1200",
  "estado": "activa",
  "timestamp": "hora local del servidor"
}
```

`monto` normalmente llega como texto porque la interfaz envía el valor del campo HTML directamente. El servidor agrega la oferta a `pujasActivas` y transmite a todos los WebSockets abiertos un mensaje con `mensaje`, `monto`, `contenedorId` y `alerta: false`.

El webhook recibe `{ "pujaId": "...", "motivo": "..." }`. Si encuentra el ID, cambia el estado de esa oferta de `activa` a `bloqueada`. Luego transmite a todos los clientes un mensaje con `alerta: true`, el motivo, el espacio asociado y el monto anulado. Si el ID no existe, aun así transmite la alerta indicando contenedor `Desconocido` y monto `0`.

### 5.2 API de Aduanas — `apps/api-aduanas/index.js`

Escucha en el puerto **3002**. Su endpoint principal es `POST /emitir-bloqueo`. La interfaz envía:

```json
{
  "pujaId": "PJ-1234",
  "motivo": "Documentación incompleta"
}
```

El servicio reenvía esos datos a `http://localhost:3001/webhook/aduanas`. Si la llamada lanza un error de red, lo imprime en consola, pero la respuesta HTTP de Aduanas sigue teniendo forma de éxito:

```json
{
  "exito": true,
  "mensaje": "La oferta/espacio ... ha sido bloqueada exitosamente."
}
```

Por tanto, el mensaje de éxito actual no confirma que el servicio de subastas haya recibido o aplicado el bloqueo. El código tampoco comprueba el código HTTP devuelto por el webhook.

### 5.3 Interfaces HTML

| Archivo | Rol y comportamiento actual |
|---|---|
| `apps/frontend/cliente.html` | Carga buque/espacios desde `GET /api/buque`; abre el WebSocket; permite enviar el espacio y monto; agrega ofertas y alertas recibidas a una terminal visual. |
| `apps/frontend/agente.html` | Consulta `GET /api/buque` y presenta nombre del buque, espacios y montos base. Los controles para programar salida y publicar eventos son visuales; no están conectados a una acción de servidor. |
| `apps/frontend/auditor.html` | Consulta `GET /api/pujas`, permite elegir una oferta activa, escribe un motivo opcional y llama `POST /emitir-bloqueo` en Aduanas. Luego muestra el mensaje recibido y vuelve a cargar la lista. |
| `apps/frontend/admin.html` | Consulta `GET /api/todas-las-pujas`, dibuja el historial, calcula total de ofertas y bloqueadas, y actualiza cada cinco segundos. Los indicadores de estado de los servicios son texto estático, no verificaciones de salud. |

Las páginas usan direcciones `localhost` fijas, por lo que están pensadas para ejecutarse localmente. Tailwind se descarga desde CDN; se necesita conectividad externa para esa hoja de estilos.

## 6. Modelo de datos actual

No existe todavía un esquema persistido. El modelo de oferta está implícito en el objeto JavaScript guardado en memoria:

| Campo | Uso |
|---|---|
| `id` | Identificador generado al recibir la oferta, formato `PJ-<número>`. |
| `contenedorId` | Identificador del espacio elegido, por ejemplo `REF-001`. |
| `monto` | Valor ofertado; el navegador actualmente lo envía como texto. |
| `estado` | En el flujo actual, `activa` o `bloqueada`. |
| `timestamp` | Hora local formateada en el servidor. |

Los espacios del buque tienen `id`, `tipo` y `base`. No hay relaciones almacenadas entre cliente, oferta, embarque, documentos, pagos o subasta.

## 7. Flujos principales

### Oferta normal

1. Cliente carga el buque y sus espacios desde la API de subastas.
2. Cliente selecciona un espacio e introduce un monto.
3. La página envía ambos valores por WebSocket.
4. El backend crea una oferta `activa` y la guarda en el arreglo en memoria.
5. El backend difunde la oferta a todos los clientes conectados.
6. La interfaz del cliente la muestra en su registro en vivo; Administración puede verla al consultar el endpoint de historial.

### Retención aduanera

1. Auditoría consulta las ofertas `activas`.
2. Un auditor selecciona una oferta y proporciona un motivo.
3. La página envía la solicitud a la API de Aduanas en el puerto 3002.
4. Aduanas reenvía la solicitud a la API de subastas en el puerto 3001.
5. Subastas cambia a `bloqueada` la oferta coincidente y emite una alerta por WebSocket.
6. Auditoría vuelve a consultar las ofertas activas; la oferta bloqueada ya no debería aparecer en esa lista.
7. Administración puede verla en el historial total mientras el proceso de subastas siga activo.

## 8. Cómo ejecutar localmente

Desde la raíz, instalar dependencias con `pnpm install`. Luego, en terminales separadas:

```powershell
node apps/api-subastas/index.js
```

```powershell
node apps/api-aduanas/index.js
```

Servir los archivos HTML con un servidor de archivos estáticos local y abrir la página correspondiente. Usar un servidor HTTP local suele ser más apropiado que abrir directamente el archivo como `file://`, por las restricciones del navegador al hacer peticiones de red.

Los manifiestos de las APIs no definen scripts `dev`, `start` o pruebas reales. El script raíz `pnpm dev` invoca `turbo run dev`, pero las APIs actualmente no declaran una tarea `dev`; para el prototipo, ejecutar los comandos `node` anteriores es la ruta explícita.

## 9. Límites y decisiones pendientes

Estas observaciones describen el código actual y no son funciones implementadas:

- **Persistencia:** las ofertas se pierden al reiniciar Subastas y no se comparten entre réplicas.
- **Validación:** el servidor acepta mensajes WebSocket sin validar estructura, monto positivo, formato, existencia del espacio, moneda ni monto base.
- **Reglas de subasta:** no hay puja mínima aplicada, incremento mínimo, reloj/cierre, clasificación de ofertas, ganador ni reserva de espacio.
- **Identificadores:** el ID aleatorio de cuatro dígitos puede colisionar; no se gestiona ese caso.
- **Estados:** solo se implementa la transición a `bloqueada`; no se guarda quién bloqueó, cuándo, ni existe una transición explícita para liberar o adjudicar.
- **Errores y confirmación:** Aduanas puede comunicar éxito aunque Subastas esté apagada o no acepte la solicitud.
- **Resiliencia WebSocket:** el cliente no implementa reintento automático; la acción de ofertar no verifica que el socket siga abierto.
- **Seguridad:** no hay autenticación ni autorización por rol; CORS se registra sin una lista explícita de orígenes; no hay limitación de solicitudes ni auditoría persistente. Los valores de respuestas se interpolan en `innerHTML`, por lo que deben validarse/escaparse antes de admitir datos no confiables.
- **Despliegue:** las direcciones de API están fijas a `localhost`; no existe configuración por entorno ni documentación de despliegue de producción.
- **Operación del agente:** sus botones y campos son solo una maqueta visual.
- **Métricas de Administración:** los estados de los módulos son estáticos. Los contadores se basan en el endpoint en memoria, no en una fuente analítica persistente.
- **Pruebas:** los scripts `test` de las APIs son marcadores que terminan con error indicando que no hay pruebas configuradas.

## 10. Guía para quien continúe el proyecto

1. Mantener la distinción entre **lo que ya funciona en la maqueta** y las funciones que solo están representadas en la interfaz.
2. Antes de añadir persistencia, definir si el dominio real es subastar contenedores completos, espacios/fracciones o ambos; el texto de la interfaz habla de fracciones, pero el modelo actual solo almacena un `contenedorId` por oferta.
3. Definir reglas de oferta y estados de negocio antes de ampliar endpoints.
4. Al corregir confirmaciones de Aduanas, hacer que la respuesta refleje explícitamente si Subastas localizó y bloqueó la oferta; no presentar un fallo de red como éxito.
5. Centralizar las URLs de API para permitir ejecución fuera de `localhost`.
6. Agregar validación del lado servidor y pruebas del flujo normal, bloqueo, oferta inexistente y errores de conectividad.
7. Si se incorporan autenticación, persistencia o despliegue, actualizar este documento y el `README.md` para que reflejen la implementación real.

## 11. Resumen breve para copiar a otra IA

> Estoy trabajando en Brizo Logistics, un prototipo local de logística marítima con subastas de espacios de carga. El monorepo usa pnpm/Turborepo. `apps/api-subastas/index.js` es un servidor Fastify en el puerto 3001 con datos fijos del buque Emerald Ace, endpoints REST para buque e historial, y WebSocket `/subasta-en-vivo`. Las ofertas se guardan solo en un arreglo en memoria con `id`, `contenedorId`, `monto`, `estado` y `timestamp`; por ahora cualquier mensaje recibido se acepta sin reglas de subasta. `apps/api-aduanas/index.js` es otro Fastify en el puerto 3002: `POST /emitir-bloqueo` reenvía `{pujaId,motivo}` al webhook de Subastas, que cambia la oferta a `bloqueada` y emite una alerta. Hay cuatro páginas estáticas: `cliente.html` (ofertar en vivo), `agente.html` (consulta visual, acciones no conectadas), `auditor.html` (bloquear oferta activa) y `admin.html` (historial y métricas consultadas cada cinco segundos). No hay base de datos, usuarios/autenticación, autorización, cierre o adjudicación de subastas ni pruebas reales. Las páginas usan URLs `localhost` fijas. Al proponer cambios, no asumas que los elementos visuales equivalen a lógica ya implementada y conserva la comunicación existente entre WebSocket y webhook salvo que la tarea pida cambiarla.
