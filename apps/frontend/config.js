// Brizo Logistics - Configuracion Global de Conectividad (Local, LAN y Tuneles Web)
(function () {
    const wsProto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';

    // Al unificar el frontend y los proxies en el mismo host/puerto (3000):
    // Todo funciona de forma transparente tanto en localhost, como en LAN (192.168.x.x) y en tuneles publicos
    const defaultApiSubastas = window.location.origin;
    const defaultWsSubastas = `${wsProto}//${window.location.host}/subasta-en-vivo`;
    const defaultApiAduanas = window.location.origin;

    window.BRIZO_CONFIG = {
        apiSubastas: localStorage.getItem('BRIZO_API_SUBASTAS') || defaultApiSubastas,
        wsSubastas: localStorage.getItem('BRIZO_WS_SUBASTAS') || defaultWsSubastas,
        apiAduanas: localStorage.getItem('BRIZO_API_ADUANAS') || defaultApiAduanas,
        
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
