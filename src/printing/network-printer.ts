import net from 'net';

/**
 * NetworkPrinter — Impresión directa vía TCP/IP a impresoras WiFi/Ethernet.
 * Conecta directamente al puerto 9100 (estándar RAW) de la impresora
 * y envía datos sin procesamiento — ideal para ESC/POS y ZPL.
 */
export class NetworkPrinter {

    /**
     * Envía datos raw a una impresora de red.
     * 
     * @param ip - Dirección IP de la impresora (ej: "192.168.1.100")
     * @param data - Datos raw como Buffer o string
     * @param port - Puerto TCP (default: 9100 = puerto RAW estándar)
     * @param timeout - Timeout en ms (default: 10000)
     */
    async printRaw(
        ip: string,
        data: Buffer | string,
        port: number = 9100,
        timeout: number = 10000
    ): Promise<void> {
        const buffer = typeof data === 'string' ? Buffer.from(data, 'binary') : data;

        return new Promise((resolve, reject) => {
            const socket = new net.Socket();
            let completed = false;

            const done = (err?: Error) => {
                if (completed) return;
                completed = true;
                socket.destroy();
                if (err) reject(err);
                else resolve();
            };

            socket.setTimeout(timeout);

            socket.on('connect', () => {
                console.log(`[Kopi] Conectado a impresora ${ip}:${port}`);
                socket.write(buffer, (err) => {
                    if (err) {
                        done(new Error(`Error escribiendo datos: ${err.message}`));
                    } else {
                        // Dar tiempo a que la impresora procese
                        setTimeout(() => {
                            console.log(`[Kopi] Datos enviados a ${ip}:${port} (${buffer.length} bytes)`);
                            done();
                        }, 500);
                    }
                });
            });

            socket.on('timeout', () => {
                done(new Error(`Timeout conectando a ${ip}:${port}`));
            });

            socket.on('error', (err) => {
                done(new Error(`Error de red con ${ip}:${port}: ${err.message}`));
            });

            socket.connect(port, ip);
        });
    }

    /**
     * Verifica si una impresora de red está accesible.
     */
    async ping(ip: string, port: number = 9100, timeout: number = 3000): Promise<boolean> {
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
