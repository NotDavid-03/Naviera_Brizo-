// Brizo Logistics - Configuracion Global de Conectividad (Local y Despliegue Web)
(function () {
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

    // Deteccion de protocolo seguro (HTTPS -> WSS)
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const httpProto = window.location.protocol;

    // Valores por defecto
    const defaultApiSubastas = isLocalhost ? 'http://localhost:3001' : `${httpProto}//${window.location.hostname}:3001`;
    const defaultWsSubastas = isLocalhost ? 'ws://localhost:3001/subasta-en-vivo' : `${wsProto}//${window.location.hostname}:3001/subasta-en-vivo`;
    const defaultApiAduanas = isLocalhost ? 'http://localhost:3002' : `${httpProto}//${window.location.hostname}:3002`;

    window.BRIZO_CONFIG = {
        apiSubastas: localStorage.getItem('BRIZO_API_SUBASTAS') || defaultApiSubastas,
        wsSubastas: localStorage.getItem('BRIZO_WS_SUBASTAS') || defaultWsSubastas,
        apiAduanas: localStorage.getItem('BRIZO_API_ADUANAS') || defaultApiAduanas,
        
        // Metodo para actualizar endpoints en despliegues en la nube (Vercel, Render, Railway, etc.)
        configurarEndpoints: function (apiSubastas, wsSubastas, apiAduanas) {
            if (apiSubastas) localStorage.setItem('BRIZO_API_SUBASTAS', apiSubastas);
            if (wsSubastas) localStorage.setItem('BRIZO_WS_SUBASTAS', wsSubastas);
            if (apiAduanas) localStorage.setItem('BRIZO_API_ADUANAS', apiAduanas);
            window.location.reload();
        },
        
        restablecerEndpoints: function () {
            localStorage.removeItem('BRIZO_API_SUBASTAS');
            localStorage.removeItem('BRIZO_WS_SUBASTAS');
            localStorage.removeItem('BRIZO_API_ADUANAS');
            window.location.reload();
        }
    };
})();
