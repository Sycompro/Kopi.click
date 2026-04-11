import { networkInterfaces } from 'os';

/**
 * Obtiene la IP local de la máquina en la red LAN.
 */
export function getLocalIP(): string | null {
    const interfaces = networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]!) {
            // Saltamos direcciones IPv6 y de loopback
            if (iface.family === 'IPv4' && !iface.internal) {
                return iface.address;
            }
        }
    }
    return null;
}
