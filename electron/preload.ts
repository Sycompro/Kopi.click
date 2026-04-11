import { contextBridge, ipcRenderer } from 'electron';

/**
 * Preload script — Bridge seguro entre renderer y main process.
 */
contextBridge.exposeInMainWorld('kopi', {
    // Certificados
    certificates: {
        generate: (data: { empresaId: string; empresaNombre: string; validYears?: number }) =>
            ipcRenderer.invoke('certificates:generate', data),
        exportZip: (data: { empresaId: string; empresaNombre: string; validYears?: number }) =>
            ipcRenderer.invoke('certificates:exportZip', data),
    },

    // Impresoras
    printers: {
        list: () => ipcRenderer.invoke('printers:list'),
        test: (printerName: string) => ipcRenderer.invoke('printers:test', printerName),
    },

    // Servidor
    server: {
        status: () => ipcRenderer.invoke('server:status'),
        onConnection: (callback: (data: any) => void) =>
            ipcRenderer.on('server:connection', (_event, data) => callback(data)),
        onDisconnection: (callback: (data: any) => void) =>
            ipcRenderer.on('server:disconnection', (_event, data) => callback(data)),
        onMessage: (callback: (data: any) => void) =>
            ipcRenderer.on('server:message', (_event, data) => callback(data)),
        onStarted: (callback: (data: any) => void) =>
            ipcRenderer.on('server:started', (_event, data) => callback(data)),
        lookupRuc: (ruc: string) => ipcRenderer.invoke('server:lookupRuc', ruc),
        log: (msg: string) => ipcRenderer.send('server:log', msg),
    },

    // Ventana
    window: {
        minimize: () => ipcRenderer.send('window:minimize'),
        maximize: () => ipcRenderer.send('window:maximize'),
        close: () => ipcRenderer.send('window:close'),
        openExternal: (url: string) => ipcRenderer.send('window:openExternal', url),
    },
});
