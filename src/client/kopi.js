/**
 * Kopi.js — Librería cliente para impresión directa desde el navegador.
 * 
 * Drop-in replacement de qz-tray.js con API compatible.
 * Conecta al servidor WebSocket de Kopi para impresión USB/WiFi.
 * 
 * Uso:
 *   kopi.websocket.connect().then(() => {
 *     return kopi.printers.find("Epson");
 *   }).then(printer => {
 *     var config = kopi.configs.create(printer);
 *     return kopi.print(config, [data]);
 *   });
 * 
 * @version 1.0.0
 * @license MIT
 */
var kopi = (function () {
    'use strict';

    // ─── Estado interno ───────────────────────────────────────
    var _ws = null;
    var _connected = false;
    var _promises = {};
    var _certPromise = null;
    var _signPromise = null;
    var _signAlgorithm = 'SHA512';
    var _config = {
        host: '127.0.0.1',
        port: 8182,
        secure: false,
        retries: 0,
        delay: 0
    };
    var _eventListeners = {};
    var _reconnectTimer = null;
    var _uid = 0;

    // ─── Utilidades ───────────────────────────────────────────

    function generateUID() {
        return 'kopi-' + (++_uid) + '-' + Date.now().toString(36);
    }

    function sendMessage(call, params) {
        return new Promise(function (resolve, reject) {
            if (!_ws || _ws.readyState !== WebSocket.OPEN) {
                reject(new Error('No conectado al servidor Kopi'));
                return;
            }

            var uid = generateUID();
            _promises[uid] = { resolve: resolve, reject: reject, timestamp: Date.now() };

            var message = JSON.stringify({
                uid: uid,
                call: call,
                params: params || {}
            });

            _ws.send(message);

            // Timeout de 30 segundos
            setTimeout(function () {
                if (_promises[uid]) {
                    _promises[uid].reject(new Error('Timeout en la respuesta del servidor'));
                    delete _promises[uid];
                }
            }, 30000);
        });
    }

    function handleMessage(event) {
        try {
            var response = JSON.parse(event.data);
            var promise = _promises[response.uid];

            if (promise) {
                if (response.error) {
                    promise.reject(new Error(response.error));
                } else {
                    promise.resolve(response.result);
                }
                delete _promises[response.uid];
            }

            // Emitir evento genérico
            emit('message', response);
        } catch (e) {
            console.error('[Kopi] Error parseando mensaje:', e);
        }
    }

    function emit(event, data) {
        var listeners = _eventListeners[event] || [];
        for (var i = 0; i < listeners.length; i++) {
            try {
                listeners[i](data);
            } catch (e) {
                console.error('[Kopi] Error en listener:', e);
            }
        }
    }

    // ─── API Pública ──────────────────────────────────────────

    var api = {};

    // ═══ WebSocket ═══════════════════════════════════════════

    api.websocket = {
        /**
         * Conecta al servidor Kopi.
         * @param {Object} options - { host, port, retries, delay }
         * @returns {Promise}
         */
        connect: function (options) {
            return new Promise(function (resolve, reject) {
                if (_ws && (_ws.readyState === WebSocket.CONNECTING || _ws.readyState === WebSocket.OPEN)) {
                    console.warn('[Kopi] Ya existe una conexión activa o en proceso a ' + url);
                    resolve();
                    return;
                }

                var opts = Object.assign({}, _config, options || {});
                var protocol = opts.secure ? 'wss' : 'ws';
                var url = protocol + '://' + opts.host + ':' + opts.port;
                var attempts = 0;
                var maxRetries = opts.retries || 0;

                function tryConnect() {
                    // Detección inteligente de host para móviles
                    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
                    var currentHost = opts.host;

                    // Si estamos en un móvil y el host es localhost o 127.0.0.1, hay un error conceptual
                    if (isMobile && (currentHost === 'localhost' || currentHost === '127.0.0.1')) {
                        console.warn('[Kopi] 📱 Estás en un dispositivo móvil. Localhost no funcionará. Asegúrate de configurar la IP de tu PC.');
                    }

                    try {
                        _ws = new WebSocket(url);
                    } catch (e) {
                        console.error('[Kopi] Error instanciando WebSocket:', e);
                        if (attempts < maxRetries) {
                            attempts++;
                            setTimeout(tryConnect, (opts.delay || 1) * 1000);
                        } else {
                            reject(new Error('No se pudo conectar a Kopi en ' + url));
                        }
                        return;
                    }

                    _ws.onopen = function () {
                        _connected = true;
                        console.log('[Kopi] ✅ Conectado a ' + url);
                        emit('connect', {});

                        // Enviar certificado si hay uno configurado
                        if (_certPromise) {
                            _certPromise(function (certData) {
                                sendMessage('security.setCertificate', { certificate: certData })
                                    .then(function (result) {
                                        emit('certificateSet', result);
                                    })
                                    .catch(function (err) {
                                        console.warn('[Kopi] Error estableciendo certificado:', err);
                                    });
                            }, function (err) {
                                console.warn('[Kopi] Error obteniendo certificado:', err);
                            });
                        }

                        // Enviar ping de conexión
                        sendMessage('websocket.connect').then(function (result) {
                            resolve(result);
                        }).catch(reject);
                    };

                    _ws.onmessage = handleMessage;

                    _ws.onclose = function (event) {
                        _connected = false;
                        console.log('[Kopi] ❌ Desconectado (código: ' + event.code + ')');
                        emit('disconnect', { code: event.code, reason: event.reason });
                    };

                    _ws.onerror = function (error) {
                        emit('error', error);
                        if (!_connected) {
                            if (attempts < maxRetries) {
                                attempts++;
                                console.log('[Kopi] Reintentando conexión (' + attempts + '/' + maxRetries + ')...');
                                setTimeout(tryConnect, (opts.delay || 1) * 1000);
                            } else {
                                reject(new Error('No se pudo conectar a Kopi en ' + url + ' tras ' + maxRetries + ' intentos'));
                            }
                        }
                    };
                }

                tryConnect();
            });
        },

        /**
         * Desconecta del servidor Kopi.
         * @returns {Promise}
         */
        disconnect: function () {
            return new Promise(function (resolve) {
                if (_ws) {
                    _ws.onclose = function () {
                        _connected = false;
                        _ws = null;
                        resolve();
                    };
                    _ws.close();
                } else {
                    resolve();
                }
            });
        },

        /**
         * Verifica si está conectado.
         * @returns {boolean}
         */
        isActive: function () {
            return _connected && _ws && _ws.readyState === WebSocket.OPEN;
        },

        /**
         * Obtiene información de la conexión.
         * @returns {Promise}
         */
        getNetworkInfo: function () {
            return sendMessage('websocket.getNetworkInfo');
        }
    };

    // ═══ Security ════════════════════════════════════════════

    api.security = {
        /**
         * Configura la promesa que provee el certificado digital.
         * Compatible con qz.security.setCertificatePromise().
         * 
         * @param {Function} promiseFactory - function(resolve, reject)
         */
        setCertificatePromise: function (promiseFactory) {
            _certPromise = promiseFactory;
        },

        /**
         * Configura la promesa que firma los mensajes.
         * Compatible con qz.security.setSignaturePromise().
         * 
         * @param {Function} promiseFactory - function(toSign) -> function(resolve, reject)
         */
        setSignaturePromise: function (promiseFactory) {
            _signPromise = promiseFactory;
        },

        /**
         * Establece el algoritmo de firma (default: SHA512).
         * @param {string} algorithm
         */
        setSignatureAlgorithm: function (algorithm) {
            _signAlgorithm = algorithm || 'SHA512';
        },

        /**
         * Obtiene el algoritmo de firma actual.
         * @returns {string}
         */
        getSignatureAlgorithm: function () {
            return _signAlgorithm;
        }
    };

    // ═══ Printers ════════════════════════════════════════════

    api.printers = {
        /**
         * Busca impresoras. Si no se pasa query, lista todas.
         * Compatible con qz.printers.find().
         * 
         * @param {string} [query] - Filtro por nombre
         * @returns {Promise<string|Array>}
         */
        find: function (query) {
            if (!_connected && _ws && _ws.readyState === WebSocket.CONNECTING) {
                // Esperar un momento si está conectando (evita el error sendData inicial)
                return new Promise(function (resolve, reject) {
                    var checkCounter = 0;
                    var interval = setInterval(function () {
                        if (_connected) {
                            clearInterval(interval);
                            resolve(sendMessage('printers.find', { query: query || null }));
                        }
                        if (++checkCounter > 50) { // 5 segundos max
                            clearInterval(interval);
                            reject(new Error('Tiempo de espera de conexión agotado para buscar impresoras'));
                        }
                    }, 100);
                });
            }
            return sendMessage('printers.find', { query: query || null });
        },

        /**
         * Obtiene detalles de una impresora.
         * @param {string} name
         * @returns {Promise<Object>}
         */
        detail: function (name) {
            return sendMessage('printers.detail', { name: name });
        },

        /**
         * Obtiene la impresora predeterminada.
         * @returns {Promise<string>}
         */
        getDefault: function () {
            return sendMessage('printers.getDefault');
        }
    };

    // ═══ Configs ═════════════════════════════════════════════

    api.configs = {
        /**
         * Crea una configuración de impresora.
         * Compatible con qz.configs.create().
         * 
         * @param {string|Object} printer - Nombre o config
         * @param {Object} [options] - Opciones adicionales
         * @returns {Object} Config para usar en print()
         */
        create: function (printer, options) {
            var config = {
                printer: typeof printer === 'string' ? printer : (printer.name || printer),
                copies: 1
            };

            if (options) {
                if (options.copies) config.copies = options.copies;
                if (options.encoding) config.encoding = options.encoding;
                if (options.colorType) config.colorType = options.colorType;
            }

            return config;
        }
    };

    // ═══ Print ═══════════════════════════════════════════════

    /**
     * Imprime datos a una impresora.
     * Compatible con qz.print().
     * 
     * @param {Object} config - Creado con kopi.configs.create()
     * @param {Array} data - Array de datos raw (string, objeto)
     * @returns {Promise}
     */
    api.print = function (config, data) {
        return sendMessage('print', {
            config: config,
            data: data
        });
    };

    /**
     * Obtiene la versión del API/Servidor.
     * Compatible con qz.api.getVersion() y qz.getVersion().
     * @returns {Promise<string>}
     */
    api.getVersion = function () {
        if (api.websocket.isActive()) {
            return sendMessage('getVersion');
        }
        return Promise.resolve(api.version);
    };

    // Alias para compatibilidad con qz.api.*
    api.api = {
        getVersion: api.getVersion
    };

    // ═══ Events ══════════════════════════════════════════════

    api.on = function (event, callback) {
        if (!_eventListeners[event]) _eventListeners[event] = [];
        _eventListeners[event].push(callback);
        return api;
    };

    api.off = function (event, callback) {
        if (_eventListeners[event]) {
            _eventListeners[event] = _eventListeners[event].filter(function (cb) {
                return cb !== callback;
            });
        }
        return api;
    };

    // ═══ Versión ═════════════════════════════════════════════

    api.version = '2.2.4'; // Reportamos versión compatible con QZ SDK 2.x
    api.app = 'QZ Tray';   // Reportamos identidad compatible

    // Exponer WebSocket interno para compatibilidad directa
    Object.defineProperty(api.websocket, 'connection', {
        get: function () {
            if (_ws) {
                // Agregar método sendData si no existe (algunos facturadores lo usan)
                if (typeof _ws.sendData !== 'function') {
                    _ws.sendData = function (data) { _ws.send(data); };
                }
                return _ws;
            }
            return null;
        }
    });

    return api;
})();

// Asignar a window.qz para que las apps que buscan qz funcionen automáticamente
if (typeof window !== 'undefined') {
    if (typeof window.qz === 'undefined') {
        window.qz = kopi;
    }
}

// Exportar para Node.js / módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = kopi;
}
