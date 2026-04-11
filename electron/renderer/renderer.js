/**
 * Kopi v1.4.3 — Global Trust Bridge (ESM)
 */

// Captura de errores global para depuración
window.onerror = function (msg, url, line, col, error) {
    const errorMsg = `[ERROR] ${msg} en ${line}:${col}`;
    console.error(errorMsg);

    // Mostrar en UI
    const text = document.getElementById('port-status');
    if (text) {
        text.innerText = 'ERROR DE CARGA';
        text.style.color = '#ff4444';
    }
    const lanEl = document.getElementById('lan-ip');
    if (lanEl) {
        lanEl.innerText = msg;
        lanEl.style.color = '#f87171';
    }

    if (window.kopi?.server?.log) {
        window.kopi.server.log(errorMsg + (error?.stack ? '\n' + error.stack : ''));
    }
    return false;
};

const state = {
    activeSection: 'dashboard',
    serverInfo: null,
    printers: [],
    logs: [],
    lastUpdate: 0
};

/**
 * Muestra una notificación premium tipo Toast.
 */
function showNotification(title, message, type = 'info') {
    const container = document.getElementById('notifications');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    // Iconos temáticos
    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            <div class="toast-message">${message}</div>
        </div>
    `;

    container.appendChild(toast);

    // Auto-eliminar con animación
    setTimeout(() => {
        toast.classList.add('removing');
        setTimeout(() => toast.remove(), 400);
    }, 6000);
}

// ─── Initializer ──────────────────────────────────────
async function init() {
    // Esperar a que el puente esté listo si es necesario
    if (!window.kopi) {
        console.warn('[Kopi] El puente no está listo, reintentando...');
        setTimeout(init, 100);
        return;
    }

    setupNavigation();
    setupWindowControls();
    startPolling();
    render();

    // Escuchar eventos de confianza (Movido aquí para seguridad)
    window.kopi.server.onTrusted((isTrusted) => {
        if (isTrusted) {
            showNotification('Seguridad Verificada', 'El certificado raíz de Kopi ha sido instalado y verificado por el sistema.', 'success');
            const shield = document.getElementById('security-shield');
            if (shield) shield.innerHTML = '🛡️ <span style="color: #4ade80">Verificado</span>';
        }
    });

    // Escuchar errores del servidor
    window.kopi.server.onError?.((error) => {
        console.error('[Kopi] Error del servidor:', error);
        showNotification('Error del Servidor', error.message || 'Error desconocido al iniciar el servidor', 'error');
        addLog(`ERROR: ${error.message}`, 'error');
        
        const dot = document.getElementById('port-dot');
        const text = document.getElementById('port-status');
        if (dot) dot.className = 'dot offline';
        if (text) {
            text.innerText = 'ERROR';
            text.style.color = '#ff4444';
        }
    });

    addLog('Confianza Industrial v1.4.0 Activa.', 'success');
}

// ─── Core Logic ───────────────────────────────────────
async function startPolling() {
    const update = async () => {
        try {
            // Ejecutar en paralelo para evitar que un cuelgue en impresoras bloquee el estado del servidor
            const results = await Promise.allSettled([
                window.kopi.server.info(),
                window.kopi.printers.list()
            ]);

            if (results[0].status === 'fulfilled') {
                state.serverInfo = results[0].value;
            }
            if (results[1].status === 'fulfilled') {
                state.printers = results[1].value;
            }

            state.lastUpdate = Date.now();
            updateStatusUI();

            // Auto-render si estamos en una vista que depende de estos datos
            if (state.activeSection === 'dashboard' || state.activeSection === 'printers') {
                render();
            }
        } catch (e) {
            console.error('Polling error', e);
        }
    };

    // Primera carga inmediata
    update();
    // Loop
    setInterval(update, 3000); // Polling cada 3s para respuesta rápida
}

function updateStatusUI() {
    const dot = document.getElementById('port-dot');
    const text = document.getElementById('port-status');
    const label = document.getElementById('port-label');
    const lanEl = document.getElementById('lan-ip');

    if (state.serverInfo?.running) {
        if (dot) dot.className = 'dot online';
        if (text) text.innerText = 'Activo';
        if (label) label.innerText = 'MOTOR EN LÍNEA';

        if (lanEl && state.serverInfo?.allIPs) {
            // Mostrar la IP principal pero permitir ver las demás si hay varias
            const mainIP = state.serverInfo.localIP;
            lanEl.innerText = `wss://${mainIP}:${state.serverInfo.port}`;
            lanEl.title = `Otras IPs detectadas: ${state.serverInfo.allIPs.join(', ')}`;
        }
    } else {
        if (dot) dot.className = 'dot offline';
        if (text) text.innerText = 'Detenido';
        if (label) label.innerText = 'MOTOR FUERA DE LÍNEA';
        if (lanEl) lanEl.innerText = 'Esperando servidor...';
    }
}

function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            state.activeSection = btn.dataset.section;
            render();
        };
    });
}

function setupWindowControls() {
    document.getElementById('btn-minimize').onclick = () => window.kopi.window.minimize();
    document.getElementById('btn-maximize').onclick = () => window.kopi.window.maximize();
    document.getElementById('btn-close').onclick = () => window.kopi.window.close();
}

// ─── Render Engine ────────────────────────────────────
function render() {
    const container = document.getElementById('view-port');
    if (!container) return;

    let html = '';

    switch (state.activeSection) {
        case 'dashboard':
            html = renderDashboard();
            break;
        case 'certificates':
            html = renderCertificates();
            break;
        case 'printers':
            html = renderPrinters();
            break;
        case 'logs':
            html = renderLogs();
            break;
    }

    container.innerHTML = html;
    bindViewEvents();

    if (window.lucide) {
        window.lucide.createIcons();
    }
}

function renderDashboard() {
    return `
        <div class="page animate-fade">
            <div class="page-header">
                <h1>Panel Industrial</h1>
                <p>Gestión de infraestructura v1.3.0 PRO</p>
            </div>
            
            <div class="stats-row">
                <div class="stat-card">
                    <div class="stat-label">SESIONES ACTIVAS</div>
                    <div class="stat-value">${state.serverInfo?.connections || 0}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">IMPRESORAS</div>
                    <div class="stat-value">${state.printers.length}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">ESTADO</div>
                    <div class="stat-value ${state.serverInfo?.running ? 'text-success' : 'text-danger'}">${state.serverInfo?.running ? 'LIVE' : 'DOWN'}</div>
                </div>
                <div class="stat-card">
                    <div class="stat-label">ACCESO LAN</div>
                    <div class="stat-value" style="font-size:13px;color:var(--primary);">${state.serverInfo?.localIP ? `wss://${state.serverInfo.localIP}:${state.serverInfo.port}` : 'Detectando...'}</div>
                </div>
            </div>

            <div class="card">
                <div class="card-header">Conexiones Activas</div>
                <div class="card-body">
                    ${renderConnectionsTable()}
                </div>
            </div>
        </div>
    `;
}

function renderConnectionsTable() {
    if (!state.serverInfo?.clients?.length) return '<div class="empty">Esperando tráfico del navegador...</div>';

    return `
        <table class="table">
            <thead>
                <tr><th>CLIENTE ID</th><th>IP</th><th>CONECTADO</th><th>ESTADO</th></tr>
            </thead>
            <tbody>
                ${state.serverInfo.clients.map(c => `
                    <tr>
                        <td><b>${c.id}</b></td>
                        <td>${c.ip}</td>
                        <td>${new Date(c.connectedAt).toLocaleTimeString()}</td>
                        <td><span class="dot online"></span> Activo</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderCertificates() {
    return `
        <div class="page animate-fade">
            <div class="page-header">
                <h1>Seguridad & Firma</h1>
                <p>Motor de cifrado industrial RSA 2048</p>
            </div>
            <div class="card">
                <div class="card-header">Emisión de Certificados</div>
                <div class="card-body">
                    <div class="form-group">
                        <label>RUC DE LA EMPRESA</label>
                        <div class="flex-row">
                            <input class="input" id="ruc-input" placeholder="Ej: 206...">
                            <button class="btn primary btn-inline" id="btn-lookup">VALIDAR SUNAT</button>
                        </div>
                    </div>
                    <div class="grid-row">
                        <div class="form-group"><label>IDENTIFICADOR</label><input class="input" id="emp-id"></div>
                        <div class="form-group"><label>AÑOS</label><input class="input" type="number" id="emp-years" value="5"></div>
                    </div>
                    <div class="form-group"><label>NOMBRE COMERCIAL / RAZÓN SOCIAL</label><input class="input" id="emp-nombre"></div>
                    <div class="flex-row">
                        <button class="btn primary" id="btn-generate-cert">GENERAR FIRMA DIGITAL</button>
                        <button class="btn secondary" id="btn-export">EXTRACCION ZIP</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderPrinters() {
    return `
        <div class="page animate-fade">
            <div class="page-header">
                <h1>Hardware & Motor</h1>
                <p>Configuración de periféricos de salida</p>
            </div>
            <div class="card">
                <div class="card-header">
                    DISPOSITIVOS REGISTRADOS
                    <button class="btn secondary btn-sm" id="btn-refresh-printers">REESCANEAR</button>
                </div>
                <div class="card-body">
                    ${renderPrintersTable()}
                </div>
            </div>
        </div>
    `;
}

function renderPrintersTable() {
    if (!state.printers.length) return '<div class="empty">No se detectaron impresoras USB o de Red compatibles.</div>';
    return `
        <table class="table">
            <thead><tr><th>EQUIPO</th><th>CONEXIÓN</th><th>CONTROL</th></tr></thead>
            <tbody>
                ${state.printers.map(p => `
                    <tr>
                        <td><b>${p.name}</b></td>
                        <td><span class="dot online"></span> ${p.connectionType || 'USB'}</td>
                        <td><button class="btn primary btn-sm btn-test" data-printer="${p.name}">ENVIAR PRUEBA</button></td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function renderLogs() {
    return `
        <div class="page animate-fade">
            <div class="page-header"><h1>Audit Console</h1></div>
            <div class="card">
                <div class="card-header">LOGS DEL SISTEMA <button class="btn ghost btn-sm" id="btn-clear-logs">PURGAR</button></div>
                <div class="log-console">
                    ${state.logs.map(log => `<div class="log-line"><span class="log-t">[${log.time}]</span> <span class="log-m ${log.type}">${log.msg}</span></div>`).join('')}
                </div>
            </div>
        </div>
    `;
}

// ─── Event Binding ────────────────────────────────────
function bindViewEvents() {
    if (state.activeSection === 'certificates') {
        const btnLookup = document.getElementById('btn-lookup');
        if (btnLookup) btnLookup.onclick = async () => {
            const ruc = document.getElementById('ruc-input').value;
            addLog(`Consultando RUC ${ruc}...`);
            const res = await window.kopi.server.lookupRuc(ruc);
            if (res?.nombre) {
                document.getElementById('emp-id').value = ruc;
                document.getElementById('emp-nombre').value = res.nombre;
                addLog(`RUC validado: ${res.nombre}`, 'success');
            } else {
                addLog(`RUC no encontrado o error de API.`, 'error');
            }
        };

        const btnGen = document.getElementById('btn-generate-cert');
        if (btnGen) btnGen.onclick = async () => {
            const id = document.getElementById('emp-id').value;
            const nom = document.getElementById('emp-nombre').value;
            const yrs = document.getElementById('emp-years').value;
            if (!id || !nom) return showNotification('Datos Incompletos', 'Por favor complete todos los datos de la empresa.', 'warning');

            addLog(`Generando firma rsa-2048 para ${nom}...`);
            const result = await window.kopi.certs.generate(id, nom, parseInt(yrs));
            addLog(`Firma digital generada con éxito en: ${result.folder}`, 'success');
            showNotification('¡Firma Generada!', `Los archivos se guardaron en la carpeta KOPI_FIRMAS de tu Escritorio.`, 'success');
        };

        const btnExp = document.getElementById('btn-export');
        if (btnExp) btnExp.onclick = async () => {
            const id = document.getElementById('emp-id').value;
            const nom = document.getElementById('emp-nombre').value;
            await window.kopi.certs.exportZip(id, nom);
            addLog(`Exportación ZIP solicitada para ${id}`);
        };
    }

    if (state.activeSection === 'printers') {
        const btnRefresh = document.getElementById('btn-refresh-printers');
        if (btnRefresh) btnRefresh.onclick = () => {
            addLog('Reescaneando hardware...');
            window.kopi.printers.list().then(list => {
                state.printers = list;
                render();
                addLog(`Escaneo completo: ${list.length} dispositivos.`, 'success');
            });
        };

        document.querySelectorAll('.btn-test').forEach(btn => {
            btn.onclick = async () => {
                const printerName = btn.dataset.printer;
                addLog(`Enviando socket de prueba a: ${printerName}...`);
                try {
                    const result = await window.kopi.printers.test(printerName);
                    if (result.success) {
                        addLog(`Prueba exitosa en ${printerName}`, 'success');
                        alert('Prueba de impresión enviada con éxito.');
                    } else {
                        addLog(`Fallo en impresión: ${result.error}`, 'error');
                        alert('Error: ' + result.error);
                    }
                } catch (e) {
                    addLog(`Error fatal IPC: ${e.message}`, 'error');
                }
            };
        });
    }

    if (state.activeSection === 'logs') {
        const btnClear = document.getElementById('btn-clear-logs');
        if (btnClear) btnClear.onclick = () => {
            state.logs = [];
            render();
        };
    }
}

function addLog(msg, type = 'info') {
    state.logs.unshift({ time: new Date().toLocaleTimeString(), msg, type });
    if (state.logs.length > 100) state.logs.pop();
}

// Start
console.log('[Kopi] Renderer script running...');
init();
