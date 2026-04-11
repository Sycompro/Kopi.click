import { useEffect, useState } from 'react';

/**
 * useKopi - Hook Industrial para la comunicación con el motor Kopi
 */
export function useKopi() {
    const [serverInfo, setServerInfo] = useState<any>(null);
    const [printers, setPrinters] = useState<any[]>([]);

    useEffect(() => {
        const updateInfo = async () => {
            if (window.kopi) {
                const info = await window.kopi.server.info();
                setServerInfo(info);
            }
        };

        const updatePrinters = async () => {
            if (window.kopi) {
                const list = await window.kopi.printers.list();
                setPrinters(list);
            }
        };

        updateInfo();
        updatePrinters();

        const interval = setInterval(updateInfo, 5000);

        // Listeners de eventos
        if (window.kopi) {
            window.kopi.server.onConnection(() => updateInfo());
            window.kopi.server.onDisconnection(() => updateInfo());
        }

        return () => clearInterval(interval);
    }, []);

    const lookupRuc = async (ruc: string) => {
        return await window.kopi.server.lookupRuc(ruc);
    };

    const generateCert = async (id: string, nombre: string, years: number) => {
        return await window.kopi.certs.generate(id, nombre, years);
    };

    const exportCertZip = async (id: string, nombre: string) => {
        return await window.kopi.certs.exportZip(id, nombre);
    };

    const testPrint = async (printer: string) => {
        return await window.kopi.printers.test(printer);
    };

    const minimize = () => window.kopi.window.minimize();
    const maximize = () => window.kopi.window.maximize();
    const close = () => window.kopi.window.close();

    return {
        serverInfo,
        printers,
        lookupRuc,
        generateCert,
        exportCertZip,
        testPrint,
        refreshPrinters: async () => {
            const list = await window.kopi.printers.list();
            setPrinters(list);
        },
        controls: { minimize, maximize, close }
    };
}

// Extender Window para TypeScript
declare global {
    interface Window {
        kopi: any;
    }
}
