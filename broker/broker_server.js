const WebSocket = require('ws');
const http = require('http');

/**
 * KOPI CLOUD BROKER
 * Permite la comunicación entre Tablets y PCs sin importar la red local.
 */

const port = process.env.PORT || 8080;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Mapa de sedes: key = sedeId, value = { pc: socket, tablets: [sockets] }
const sedes = new Map();

wss.on('connection', (ws) => {
    let currentSedeId = null;
    let currentRole = null;

    ws.on('message', (message) => {
        try {
            // Asegurar que el mensaje sea string (importante para Node.js 18+)
            const messageStr = message.toString();
            console.log(`[Broker] Recibido: ${messageStr}`);

            let data;
            try {
                data = JSON.parse(messageStr);
            } catch (parseErr) {
                console.error("[Broker] Error parsing JSON:", parseErr.message);
                ws.send(JSON.stringify({ error: 'JSON inválido', detail: parseErr.message }));
                return;
            }

            // 1. REGISTRO
            if (data.action === 'register') {
                const { sedeId, role, token } = data;
                if (!sedeId || !token) {
                    ws.send(JSON.stringify({ error: 'Falta sedeId o token' }));
                    return;
                }

                currentSedeId = sedeId;
                currentRole = role;

                if (!sedes.has(sedeId)) {
                    sedes.set(sedeId, { pc: null, tablets: new Set(), token: token });
                    console.log(`[Broker] Sede ${sedeId} CREADA con token protector.`);
                }

                const sede = sedes.get(sedeId);

                // Validar Token
                if (sede.token !== token) {
                    console.warn(`[Seguridad] Intento de acceso a ${sedeId} con token INVÁLIDO.`);
                    ws.send(JSON.stringify({ error: 'Token de seguridad inválido para esta sede' }));
                    ws.close();
                    return;
                }

                if (role === 'pc') {
                    if (sede.pc) sede.pc.close();
                    sede.pc = ws;
                    console.log(`[PC] Sede ${sedeId} autorizada.`);
                    
                    // Notificar a todas las tablets de esta sede que el PC está ONLINE
                    sede.tablets.forEach(tablet => {
                        if (tablet.readyState === WebSocket.OPEN) {
                            tablet.send(JSON.stringify({ action: 'pcStatus', connected: true }));
                        }
                    });
                } else {
                    sede.tablets.add(ws);
                    console.log(`[Tablet] Sede ${sedeId} autorizada.`);
                    
                    // Notificar al PC que una tablet se ha unido para que envíe manifest/impresoras
                    if (sede.pc && sede.pc.readyState === WebSocket.OPEN) {
                        sede.pc.send(JSON.stringify({ action: 'tablet_connected' }));
                    }
                    
                    // Informar a la tablet si el PC ya está ONLINE
                    const isPcOnline = !!(sede.pc && sede.pc.readyState === WebSocket.OPEN);
                    ws.send(JSON.stringify({ action: 'pcStatus', connected: isPcOnline }));
                }

                ws.send(JSON.stringify({ status: 'registered', sedeId, role }));
                return;
            }

            // 2. REENVÍO (FORWARD)
            if (data.action === 'forward') {
                console.log(`[Broker] FORWARD detectado - Role: ${currentRole}, SedeID: ${currentSedeId}`);
                const sede = sedes.get(currentSedeId);
                if (!sede) {
                    console.log(`[Broker] ERROR: Sede ${currentSedeId} no encontrada`);
                    return;
                }

                if (currentRole === 'tablet') {
                    console.log(`[Broker] Tablet → PC: Reenviando mensaje`);
                    console.log(`[Broker] PC conectado: ${sede.pc ? 'SÍ' : 'NO'}`);
                    console.log(`[Broker] PC readyState: ${sede.pc ? sede.pc.readyState : 'N/A'}`);
                    
                    // La tablet envía a la PC
                    if (sede.pc && sede.pc.readyState === WebSocket.OPEN) {
                        const forwardMsg = {
                            from: 'tablet',
                            payload: data.payload,
                            uid: data.uid
                        };
                        console.log(`[Broker] Enviando a PC: ${JSON.stringify(forwardMsg)}`);
                        sede.pc.send(JSON.stringify(forwardMsg));
                        console.log(`[Broker] ✅ Mensaje enviado a PC`);
                    } else {
                        console.log(`[Broker] ❌ PC fuera de línea`);
                        ws.send(JSON.stringify({ error: 'PC fuera de línea', uid: data.uid }));
                    }
                } else if (currentRole === 'pc') {
                    console.log(`[Broker] PC → Tablets: Reenviando mensaje a ${sede.tablets.size} tablets`);
                    
                    // La PC envía respuesta a las tablets (o a una específica si se guarda el UID)
                    // Por simplicidad, reenviamos a todas las tablets de esa sede
                    let sent = 0;
                    sede.tablets.forEach(tablet => {
                        if (tablet.readyState === WebSocket.OPEN) {
                            tablet.send(JSON.stringify({
                                from: 'pc',
                                payload: data.payload,
                                uid: data.uid
                            }));
                            sent++;
                        }
                    });
                    console.log(`[Broker] ✅ Mensaje enviado a ${sent} tablets`);
                }
                return;
            }

            // 3. HEARTBEAT/PING
            if (data.action === 'ping') {
                ws.send(JSON.stringify({ action: 'pong' }));
            }

        } catch (e) {
            console.error("Error procesando mensaje:", e);
        }
    });

    ws.on('close', () => {
        if (currentSedeId && sedes.has(currentSedeId)) {
            const sede = sedes.get(currentSedeId);
            if (currentRole === 'pc') {
                sede.pc = null;
                console.log(`[PC] Sede ${currentSedeId} desconectada.`);
                
                // Notificar a todas las tablets de esta sede que el PC está OFFLINE
                sede.tablets.forEach(tablet => {
                    if (tablet.readyState === WebSocket.OPEN) {
                        tablet.send(JSON.stringify({ action: 'pcStatus', connected: false }));
                    }
                });
            } else {
                sede.tablets.delete(ws);
                console.log(`[Tablet] Sede ${currentSedeId} desconectada.`);
            }
        }
    });
});

server.listen(port, () => {
    console.log(`Kopi Cloud Broker escuchando en puerto ${port}`);
});
