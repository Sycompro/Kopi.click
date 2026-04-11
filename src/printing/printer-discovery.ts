import { exec } from 'child_process';
import { promisify } from 'util';
import net from 'net';

const execAsync = promisify(exec);

export interface PrinterInfo {
    name: string;
    displayName: string;
    driver: string;
    connectionType: 'usb' | 'network' | 'unknown';
    ipAddress?: string;
    port?: number;
    status: 'ready' | 'offline' | 'error' | 'unknown';
    isDefault: boolean;
}

/**
 * PrinterDiscovery — Detecta impresoras conectadas al sistema.
 * Soporta Windows (PowerShell/WMI) con extensibilidad para Android.
 */
export class PrinterDiscovery {

    /**
     * Lista todas las impresoras disponibles en el sistema.
     */
    async findAll(): Promise<PrinterInfo[]> {
        if (process.platform === 'win32') {
            return this.findWindows();
        }
        // Futuro: Linux (CUPS), Android
        console.warn('[Kopi] Plataforma no soportada para descubrimiento:', process.platform);
        return [];
    }

    /**
     * Busca impresoras cuyo nombre contenga el query.
     */
    async find(query: any): Promise<PrinterInfo[]> {
        const all = await this.findAll();

        // Normalizar query a string
        let q = '';
        if (typeof query === 'string') {
            q = query.toLowerCase();
        } else if (query && typeof query === 'object' && query.query) {
            q = String(query.query).toLowerCase();
        } else if (query) {
            q = String(query).toLowerCase();
        }

        if (!q) return all;

        return all.filter(p =>
            (p.name || '').toLowerCase().includes(q) ||
            (p.displayName || '').toLowerCase().includes(q)
        );
    }

    /**
     * Obtiene la impresora predeterminada del sistema.
     */
    async getDefault(): Promise<PrinterInfo | null> {
        const all = await this.findAll();
        return all.find(p => p.isDefault) || null;
    }

    /**
     * Descubre impresoras en Windows mediante PowerShell.
     */
    private async findWindows(): Promise<PrinterInfo[]> {
        try {
            const { stdout } = await execAsync(
                `powershell -NoProfile -Command "Get-Printer | Select-Object Name, DriverName, PortName, PrinterStatus, Type | ConvertTo-Json -Compress"`,
                { timeout: 10000 }
            );

            const raw = stdout.trim();
            if (!raw) return [];

            let printers = JSON.parse(raw);
            if (!Array.isArray(printers)) printers = [printers];

            // Obtener impresora default
            let defaultPrinter = '';
            try {
                const { stdout: defOut } = await execAsync(
                    `powershell -NoProfile -Command "(Get-CimInstance -ClassName Win32_Printer | Where-Object {$_.Default}).Name"`,
                    { timeout: 5000 }
                );
                defaultPrinter = defOut.trim();
            } catch { /* sin default */ }

            return printers.map((p: any) => {
                const connType = this.detectConnectionType(p.PortName || '');
                const ipInfo = this.extractIP(p.PortName || '');

                return {
                    name: p.Name,
                    displayName: p.Name,
                    driver: p.DriverName || 'Unknown',
                    connectionType: connType,
                    ipAddress: ipInfo.ip,
                    port: ipInfo.port,
                    status: this.mapStatus(p.PrinterStatus),
                    isDefault: p.Name === defaultPrinter,
                } as PrinterInfo;
            });
        } catch (err) {
            console.error('[Kopi] Error descubriendo impresoras:', err);
            return [];
        }
    }

    /**
     * Detecta el tipo de conexión basado en el nombre del puerto.
     */
    private detectConnectionType(portName: string): 'usb' | 'network' | 'unknown' {
        const upper = portName.toUpperCase();
        if (upper.startsWith('USB') || upper.startsWith('DOT4')) return 'usb';
        if (upper.includes('IP_') || upper.match(/\d+\.\d+\.\d+\.\d+/) || upper.startsWith('TCP')) return 'network';
        if (upper.startsWith('LPT') || upper.startsWith('COM')) return 'usb';
        return 'unknown';
    }

    /**
     * Extrae IP y puerto de un nombre de puerto de red.
     */
    private extractIP(portName: string): { ip?: string; port?: number } {
        const ipMatch = portName.match(/(\d+\.\d+\.\d+\.\d+)/);
        if (ipMatch) {
            const portMatch = portName.match(/:(\d+)/);
            return {
                ip: ipMatch[1],
                port: portMatch ? parseInt(portMatch[1]) : 9100,
            };
        }
        return {};
    }

    /**
     * Mapea el estado numérico de Windows a un estado legible.
     */
    private mapStatus(status: number): PrinterInfo['status'] {
        // Windows printer statuses: 0=Other, 1=Unknown, 2=Idle, 3=Printing, 4=WarmUp, 5=StoppedPrinting, 6=Offline, 7=Paused
        switch (status) {
            case 0: case 2: case 3: case 4: return 'ready';
            case 6: return 'offline';
            case 5: case 7: return 'error';
            default: return 'unknown';
        }
    }

    /**
     * Verifica si una impresora de red está accesible.
     */
    async checkNetworkPrinter(ip: string, port: number = 9100, timeout: number = 3000): Promise<boolean> {
        return new Promise((resolve) => {
            const socket = new net.Socket();
            socket.setTimeout(timeout);

            socket.on('connect', () => {
                socket.destroy();
                resolve(true);
            });

            socket.on('timeout', () => {
                socket.destroy();
                resolve(false);
            });

            socket.on('error', () => {
                socket.destroy();
                resolve(false);
            });

            socket.connect(port, ip);
        });
    }
}
