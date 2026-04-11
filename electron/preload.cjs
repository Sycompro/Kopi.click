const { contextBridge, ipcRenderer } = require('electron');

/**
 * Preload script — Aero-Pro Bridge v1.1.4
 * Sincronizado con Renderer Aero-Pro Compact.
 */

// Parche Global para compatibilidad con QZ Tray SDK - Inyección en el Main World
// Esto asegura que cualquier WebSocket creado por librerías externas (como el facturador)
// tenga el método sendData disponible inmediatamente desde su creación.
if (typeof document !== 'undefined') {
    const script = document.createElement('script');
    script.textContent = `
        (function() {
            if (window.WebSocket && !window.WebSocket.prototype.sendData) {
                window.WebSocket.prototype.sendData = function(data) {
                    if (this.readyState === 1) { // OPEN
                        this.send(typeof data === 'string' ? data : JSON.stringify(data));
                    }
                };
                console.log('[Kopi] Protocol Patch: WebSocket.prototype.sendData inyectado con éxito.');
            }
        })();
    `;
    (document.head || document.documentElement).appendChild(script);
    script.remove();
}

contextBridge.exposeInMainWorld('kopi', {
    // Certificados (Nomenclatura corta)
    certs: {
        generate: (id, nombre, years) => ipcRenderer.invoke('certificates:generate', { empresaId: id, empresaNombre: nombre, validYears: years }),
        exportZip: (id, nombre) => ipcRenderer.invoke('certificates:exportZip', { empresaId: id, empresaNombre: nombre }),
    },

    // Impresoras
    printers: {
        list: () => ipcRenderer.invoke('printers:list'),
        test: (name) => ipcRenderer.invoke('printers:test', name),
    },

    // Servidor / Dashboard (Incluye .info para compatibilidad)
    server: {
        info: () => ipcRenderer.invoke('server:status'),
        status: () => ipcRenderer.invoke('server:status'),
        lookupRuc: (ruc) => ipcRenderer.invoke('server:lookupRuc', ruc),
        log: (msg) => ipcRenderer.send('server:log', msg),

        // Callbacks de eventos
        onConnection: (cb) => ipcRenderer.on('server:connection', (_e, d) => cb(d)),
        onDisconnection: (cb) => ipcRenderer.on('server:disconnection', (_e, d) => cb(d)),
        onMessage: (cb) => ipcRenderer.on('server:message', (_e, d) => cb(d)),
        onStarted: (cb) => ipcRenderer.on('server:started', (_e, d) => cb(d)),
        onTrusted: (cb) => ipcRenderer.on('server:trusted', (_e, d) => cb(d)),
        onError: (cb) => ipcRenderer.on('server:error', (_e, d) => cb(d)),
    },

    // Ventana (Controles nativos)
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close: () => ipcRenderer.send('window:close'),
        openExternal: (url) => ipcRenderer.send('window:openExternal', url),
    }
});
