import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Capacitor } from '@capacitor/core';

type View = 'dashboard' | 'pos' | 'logs' | 'config' | 'printers';

// ─── Flat Icon Components ─────────────────────────────────────
const Icon = ({ children, bg, color, size = 36 }: { children: React.ReactNode; bg: string; color: string; size?: number }) => (
    <div style={{
        width: size, height: size, borderRadius: size * 0.28,
        background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0
    }}>
        <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            {children}
        </svg>
    </div>
);

const IconGlobe = ({ bg = 'var(--primary-glow)', color = 'var(--primary)', size = 36 }) => (
    <Icon bg={bg} color={color} size={size}><circle cx="12" cy="12" r="10" /><path d="M2 12h20" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10A15.3 15.3 0 0 1 12 2z" /></Icon>
);

const IconMonitor = ({ bg = 'var(--accent-purple-bg)', color = 'var(--accent-purple)', size = 36 }) => (
    <Icon bg={bg} color={color} size={size}><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="8" y1="21" x2="16" y2="21" /><line x1="12" y1="17" x2="12" y2="21" /></Icon>
);

const IconPrinter = ({ bg = 'var(--accent-cyan-bg)', color = 'var(--accent-cyan)', size = 36 }) => (
    <Icon bg={bg} color={color} size={size}><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></Icon>
);

const IconSettings = ({ bg = 'rgba(100,116,139,0.08)', color = '#64748b', size = 36 }) => (
    <Icon bg={bg} color={color} size={size}><circle cx="12" cy="12" r="3" /><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" /></Icon>
);

const IconChart = ({ bg = 'var(--primary-glow)', color = 'var(--primary)', size = 36 }) => (
    <Icon bg={bg} color={color} size={size}><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></Icon>
);

const IconTerminal = ({ bg = 'var(--accent-green-bg)', color = 'var(--accent-green)', size = 36 }) => (
    <Icon bg={bg} color={color} size={size}><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></Icon>
);

const IconLog = ({ bg = 'var(--accent-amber-bg)', color = 'var(--accent-amber)', size = 36 }) => (
    <Icon bg={bg} color={color} size={size}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></Icon>
);

const IconWifi = ({ bg = 'var(--accent-green-bg)', color = 'var(--accent-green)', size = 36 }) => (
    <Icon bg={bg} color={color} size={size}><path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></Icon>
);

const IconWifiOff = ({ bg = 'var(--accent-red-bg)', color = 'var(--accent-red)', size = 36 }) => (
    <Icon bg={bg} color={color} size={size}><line x1="1" y1="1" x2="23" y2="23" /><path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" /><path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" /><path d="M10.71 5.05A16 16 0 0 1 22.56 9" /><path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" /></Icon>
);

const IconLink = ({ bg = 'var(--primary-glow)', color = 'var(--primary)', size = 36 }) => (
    <Icon bg={bg} color={color} size={size}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" /><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" /></Icon>
);

const IconTrash = ({ bg = 'var(--accent-red-bg)', color = 'var(--accent-red)', size = 36 }) => (
    <Icon bg={bg} color={color} size={size}><polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /></Icon>
);

const IconPlug = ({ bg = 'var(--accent-red-bg)', color = 'var(--accent-red)', size = 36 }) => (
    <Icon bg={bg} color={color} size={size}><path d="M12 2v6" /><path d="M7 4v4" /><path d="M17 4v4" /><rect x="5" y="8" width="14" height="6" rx="2" /><path d="M9 14v4a3 3 0 0 0 6 0v-4" /></Icon>
);

const IconRocket = ({ bg = 'var(--primary-glow)', color = 'var(--primary)', size = 36 }) => (
    <Icon bg={bg} color={color} size={size}><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09z" /><path d="M12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2z" /><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0" /><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5" /></Icon>
);

const IconCopy = ({ size = 16, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
);

const IconCheck = ({ size = 16, color = 'var(--accent-green)' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

// ─── Main App ─────────────────────────────────────────────────
const App: React.FC = () => {
    const [view, setView] = useState<View>('dashboard');
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [logs, setLogs] = useState<string[]>([]);
    const [isCopied, setIsCopied] = useState(false);
    const [injectionActive, setInjectionActive] = useState(false);

    // Configuración
    const [sedeId, setSedeId] = useState(localStorage.getItem('kopi_sede_id') || '');
    const [token, setToken] = useState(localStorage.getItem('kopi_token') || '');
    const [railwayUrl, setRailwayUrl] = useState(() => {
        return localStorage.getItem('kopi_railway_url') || 'wss://broker-websocket-production.up.railway.app';
    });

    // Estado de conexiones
    const [railwayConnected, setRailwayConnected] = useState(false);
    const [pcConnected, setPcConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isReconnecting, setIsReconnecting] = useState(false);
    const [connectError, setConnectError] = useState('');
    const [permissionStatus, setPermissionStatus] = useState<string>('unknown');
    
    // Estado de impresoras
    const [printers, setPrinters] = useState<string[]>([]);
    const [pcInfo, setPcInfo] = useState<{ruc: string; nombre: string; ips: string[]} | null>(null);

    // Refs para evitar re-renders durante escritura
    const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const statusIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const logsIntervalRef = useRef<NodeJS.Timeout | null>(null);

    // Guardar configuración con debounce SIN causar re-render
    useEffect(() => {
        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }
        saveTimeoutRef.current = setTimeout(() => {
            localStorage.setItem('kopi_sede_id', sedeId);
            localStorage.setItem('kopi_token', token);
            localStorage.setItem('kopi_railway_url', railwayUrl);
        }, 500);
        
        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [sedeId, token, railwayUrl]);

    // Conectar automáticamente SOLO al iniciar la app (una vez)
    useEffect(() => {
        // Pequeño delay para asegurar que Capacitor/Electron esté listo
        const timer = setTimeout(() => {
            const savedSedeId = localStorage.getItem('kopi_sede_id');
            const savedToken = localStorage.getItem('kopi_token');
            const savedRailwayUrl = localStorage.getItem('kopi_railway_url');
            
            if (savedSedeId && savedToken && savedRailwayUrl) {
                console.log('[KOPI-APP] Producción: Auto-conectando...');
                (async () => {
                    try {
                        // Detectar si estamos en Electron o Capacitor
                        if ((window as any).kopi?.railway) {
                            // Electron
                            await (window as any).kopi.railway.connect({
                                brokerUrl: savedRailwayUrl.trim(),
                                sedeId: savedSedeId.trim(),
                                token: savedToken.trim(),
                                ruc: '00000000000'
                            });
                        } else {
                            // Capacitor (Android)
                            await (Capacitor as any).Plugins.Kopi.connectRailway({
                                railwayUrl: savedRailwayUrl.trim(),
                                sedeId: savedSedeId.trim(),
                                token: savedToken.trim()
                            });
                        }
                    } catch (e) {
                        console.error('[KOPI-APP] Error auto-conectando:', e);
                    }
                })();
            }
        }, 500);
        return () => clearTimeout(timer);
    }, []); // Ahora sí es seguro el array vacío porque lee directamente de localStorage

    // Verificar estado periódicamente SOLO cuando NO estamos en config view
    useEffect(() => {
        // No ejecutar el polling si estamos en la vista de configuración
        if (view === 'config') {
            if (statusIntervalRef.current) {
                clearInterval(statusIntervalRef.current);
                statusIntervalRef.current = null;
            }
            return;
        }

        const checkStatus = async () => {
            try {
                let result;
                // Detectar si estamos en Electron o Capacitor
                if ((window as any).kopi?.railway) {
                    // Electron
                    const status = await (window as any).kopi.railway.status();
                    result = {
                        railwayConnected: status.connected,
                        pcConnected: false // En Electron, el PC es local
                    };
                } else {
                    // Capacitor (Android)
                    result = await (Capacitor as any).Plugins.Kopi.getStatus();
                }
                
                if (result.railwayConnected !== undefined) {
                    setRailwayConnected(prev => {
                        if (prev !== result.railwayConnected) return result.railwayConnected;
                        return prev;
                    });
                }
                if (result.pcConnected !== undefined) {
                    setPcConnected(prev => {
                        if (prev !== result.pcConnected) return result.pcConnected;
                        return prev;
                    });
                }
            } catch (e) {
                console.error('[KOPI-APP] Error obteniendo estado:', e);
            }
        };
        
        checkStatus();
        statusIntervalRef.current = setInterval(checkStatus, 3000);
        
        return () => {
            if (statusIntervalRef.current) {
                clearInterval(statusIntervalRef.current);
                statusIntervalRef.current = null;
            }
        };
    }, [view]);

    // Handlers memoizados para evitar re-renders
    const handleSedeIdChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setSedeId(e.target.value);
    }, []);

    const handleTokenChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setToken(e.target.value);
    }, []);

    const handleRailwayUrlChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        setRailwayUrl(e.target.value);
    }, []);

    const connectToRailway = async () => {
        if (isConnecting) return;
        if (!sedeId.trim() || !token.trim() || !railwayUrl.trim()) {
            setConnectError("Todos los campos son obligatorios.");
            return;
        }

        setConnectError('');
        setIsConnecting(true);
        setIsReconnecting(false);
        try {
            // Detectar si estamos en Electron o Capacitor
            if ((window as any).kopi?.railway) {
                // Electron
                const result = await (window as any).kopi.railway.connect({
                    brokerUrl: railwayUrl.trim(),
                    sedeId: sedeId.trim(),
                    token: token.trim(),
                    ruc: '00000000000' // Opcional
                });
                
                if (!result.success) {
                    throw new Error(result.error || 'Error desconocido');
                }
            } else {
                // Capacitor (Android)
                await (Capacitor as any).Plugins.Kopi.connectRailway({
                    railwayUrl: railwayUrl.trim(),
                    sedeId: sedeId.trim(),
                    token: token.trim()
                });
            }
        } catch (e) {
            console.error('[KOPI-APP] Error:', e);
            setIsConnecting(false);
            setConnectError("Error interno al conectar.");
        }
    };

    const handleRequestPermission = async () => {
        try {
            if (Capacitor.isNativePlatform()) {
                const result = await (Capacitor as any).Plugins.Kopi.requestNotificationPermission();
                setPermissionStatus(result.status);
                if (result.status === 'granted') {
                    alert('¡Permisos concedidos! El servicio ahora es estable.');
                } else {
                    alert('Permisos denegados. La App podría cerrarse inesperadamente.');
                }
            }
        } catch (e) {
            console.error('Error solicitando permisos:', e);
        }
    };

    useEffect(() => {
        const handleConnectionStatus = (event: any) => {
            const { railway, pc } = (event as any).detail;
            // Solo actualizar si el valor realmente cambió
            setRailwayConnected(prev => prev !== railway ? railway : prev);
            setPcConnected(prev => prev !== pc ? pc : prev);
        };
        const handleConnectionError = (event: any) => {
            const newError = (event as any).detail.error || "Error de conexión";
            setConnectError(prev => prev !== newError ? newError : prev);
            setIsConnecting(prev => prev ? false : prev);
            setIsReconnecting(prev => prev ? false : prev);
        };
        const handleConnectionSuccess = () => {
            setIsConnecting(prev => prev ? false : prev);
            setIsReconnecting(prev => prev ? false : prev);
            setConnectError(prev => prev ? '' : prev);
        };
        const handleReconnecting = () => {
            setIsReconnecting(prev => !prev ? true : prev);
            setIsConnecting(prev => prev ? false : prev);
            setConnectError(prev => prev ? '' : prev);
        };
        const handleDisconnected = () => {
            setIsReconnecting(prev => prev ? false : prev);
            setIsConnecting(prev => prev ? false : prev);
            setPcConnected(false);
            setPrinters([]);
            setPcInfo(null);
        };
        const handlePcInfo = (event: any) => {
            const data = (event as any).detail;
            console.log('[KOPI-APP] PC Info recibida:', data);
            if (data.ruc && data.nombre) {
                setPcInfo({
                    ruc: data.ruc,
                    nombre: data.nombre,
                    ips: data.ips || []
                });
            }
            if (data.printers && Array.isArray(data.printers)) {
                setPrinters(data.printers);
            }
        };
        
        window.addEventListener('kopiConnectionStatus', handleConnectionStatus);
        window.addEventListener('kopiConnectionError', handleConnectionError);
        window.addEventListener('kopiConnectionSuccess', handleConnectionSuccess);
        window.addEventListener('kopiReconnecting', handleReconnecting);
        window.addEventListener('kopiDisconnected', handleDisconnected);
        window.addEventListener('kopiPcInfo', handlePcInfo);
        return () => {
            window.removeEventListener('kopiConnectionStatus', handleConnectionStatus);
            window.removeEventListener('kopiConnectionError', handleConnectionError);
            window.removeEventListener('kopiConnectionSuccess', handleConnectionSuccess);
            window.removeEventListener('kopiReconnecting', handleReconnecting);
            window.removeEventListener('kopiDisconnected', handleDisconnected);
            window.removeEventListener('kopiPcInfo', handlePcInfo);
        };
    }, []);

    // Obtener logs SOLO en dashboard y logs view, NO en config
    useEffect(() => {
        if (logsIntervalRef.current) {
            clearInterval(logsIntervalRef.current);
            logsIntervalRef.current = null;
        }

        if (view === 'logs' || view === 'dashboard') {
            const fetchLogs = async () => {
                try {
                    const result = await (Capacitor as any).Plugins.Kopi.getLogs();
                    setLogs(result.logs || []);
                } catch (e) {
                    console.error("Error fetching logs", e);
                }
            };
            
            fetchLogs();
            logsIntervalRef.current = setInterval(fetchLogs, 2000);
        }
        
        return () => {
            if (logsIntervalRef.current) {
                clearInterval(logsIntervalRef.current);
                logsIntervalRef.current = null;
            }
        };
    }, [view]);

    useEffect(() => {
        if (view === 'pos') {
            setInjectionActive(true);
            let injectionCount = 0;
            const maxInjections = 20;

            const tryInject = setInterval(async () => {
                try {
                    await (Capacitor as any).Plugins.Kopi.injectScriptInWebView({
                        url: 'https://mozo.pe/app'
                    });
                    injectionCount++;
                    if (injectionCount >= maxInjections) {
                        clearInterval(tryInject);
                        const maintainInject = setInterval(async () => {
                            try {
                                await (Capacitor as any).Plugins.Kopi.injectScriptInWebView({
                                    url: 'https://mozo.pe/app'
                                });
                            } catch (e) { }
                        }, 2000);
                        return () => clearInterval(maintainInject);
                    }
                } catch (e) { }
            }, 300);

            return () => {
                setInjectionActive(false);
                clearInterval(tryInject);
            };
        }
    }, [view]);

    const copyLogs = () => {
        const text = logs.join('\n');
        navigator.clipboard.writeText(text).then(() => {
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        });
    };

    // ─── Sidebar Navigation ──────────────────────────────────
    const NavItem = ({ label, icon, id }: { label: string; icon: React.ReactNode; id: View }) => (
        <div
            className={`nav-item ${view === id ? 'active' : ''}`}
            onClick={() => { setView(id); setIsSidebarOpen(false); }}
        >
            {icon}
            <span>{label}</span>
        </div>
    );

    const Sidebar = React.memo(({ 
        isOpen, 
        onClose, 
        currentView, 
        onViewChange, 
        railwayConnected, 
        sedeId 
    }: { 
        isOpen: boolean; 
        onClose: () => void; 
        currentView: View; 
        onViewChange: (view: View) => void; 
        railwayConnected: boolean; 
        sedeId: string;
    }) => (
        <>
            {isOpen && (
                <div
                    onClick={onClose}
                    style={{
                        position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                        background: 'rgba(0,0,0,0.3)', zIndex: 99,
                    }}
                />
            )}
            <div style={{
                position: 'fixed', top: 0, left: isOpen ? 0 : '-270px',
                width: '270px', height: '100%', background: 'var(--bg-sidebar)',
                zIndex: 100, transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                padding: '20px 14px', display: 'flex', flexDirection: 'column',
                boxShadow: isOpen ? '4px 0 24px rgba(0,0,0,0.15)' : 'none'
            }}>
                {/* Logo */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '36px', padding: '4px 8px' }}>
                    <div style={{
                        width: 38, height: 38, borderRadius: 10,
                        background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" />
                        </svg>
                    </div>
                    <div>
                        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#fff', letterSpacing: '1px' }}>KOPI MOZO</h2>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-sidebar-muted)', fontWeight: 500, letterSpacing: '0.5px' }}>Android Client v3.0</span>
                    </div>
                </div>

                <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-sidebar-muted)', textTransform: 'uppercase', letterSpacing: '1.2px', padding: '0 16px', marginBottom: 8 }}>
                    Menú
                </div>

                <div style={{ flex: 1 }}>
                    <div className={`nav-item ${currentView === 'dashboard' ? 'active' : ''}`} onClick={() => { onViewChange('dashboard'); onClose(); }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>
                        <span>Panel Principal</span>
                    </div>
                    <div className={`nav-item ${currentView === 'printers' ? 'active' : ''}`} onClick={() => { onViewChange('printers'); onClose(); }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 6 2 18 2 18 9" /><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="8" /></svg>
                        <span>Impresoras</span>
                    </div>
                    <div className={`nav-item ${currentView === 'pos' ? 'active' : ''}`} onClick={() => { onViewChange('pos'); onClose(); }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" /></svg>
                        <span>Terminal POS</span>
                    </div>
                    <div className={`nav-item ${currentView === 'logs' ? 'active' : ''}`} onClick={() => { onViewChange('logs'); onClose(); }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>
                        <span>Registro de Eventos</span>
                    </div>
                    <div className={`nav-item ${currentView === 'config' ? 'active' : ''}`} onClick={() => { onViewChange('config'); onClose(); }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
                        <span>Configuración</span>
                    </div>
                </div>

                {/* Status footer */}
                <div style={{
                    padding: '14px', background: 'rgba(255,255,255,0.06)',
                    borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <span style={{ fontSize: '0.6rem', color: 'var(--text-sidebar-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px' }}>Red</span>
                        <div style={{
                            width: 8, height: 8, borderRadius: '50%',
                            background: railwayConnected ? '#22c55e' : '#ef4444',
                            boxShadow: railwayConnected ? '0 0 6px rgba(34,197,94,0.6)' : 'none'
                        }} />
                    </div>
                    <span style={{ fontSize: '0.78rem', fontWeight: 600, color: '#fff' }}>{sedeId || 'Sin configurar'}</span>
                </div>
            </div>
        </>
    ));

    // ─── Header ──────────────────────────────────────────────
    const Header = React.memo(({ 
        currentView, 
        onMenuClick, 
        railwayConnected 
    }: { 
        currentView: View; 
        onMenuClick: () => void; 
        railwayConnected: boolean;
    }) => {
        const viewTitles: Record<View, string> = {
            dashboard: 'Panel Principal',
            printers: 'Impresoras',
            pos: 'Terminal POS',
            logs: 'Registro de Eventos',
            config: 'Configuración'
        };

        return (
            <div style={{
                height: 56, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 20px', background: '#ffffff',
                borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 10,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                    <button
                        onClick={onMenuClick}
                        style={{
                            background: 'none', border: 'none', color: 'var(--text-main)',
                            fontSize: '1.3rem', cursor: 'pointer', padding: 4, display: 'flex',
                            width: 36, height: 36, alignItems: 'center', justifyContent: 'center',
                            borderRadius: 8
                        }}
                    >
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="15" y2="12" /><line x1="3" y1="18" x2="18" y2="18" /></svg>
                    </button>
                    <h1 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-main)' }}>
                        {viewTitles[currentView]}
                    </h1>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                        {railwayConnected ? 'En línea' : 'Offline'}
                    </span>
                    {/* ELIMINADA LA ANIMACIÓN PULSE QUE CAUSABA PARPADEO */}
                    <div style={{
                        width: 10, height: 10, borderRadius: '50%',
                        background: railwayConnected ? 'var(--accent-green)' : 'var(--accent-red)',
                    }} />
                </div>
            </div>
        );
    });

    // ─── Dashboard View ──────────────────────────────────────
    const DashboardView = () => (
        <div className="fade-in" style={{ padding: 16 }}>
            {/* Status Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div className="glass-card" style={{ padding: '16px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        {railwayConnected
                            ? <IconWifi bg="var(--accent-green-bg)" color="var(--accent-green)" size={34} />
                            : <IconWifiOff bg="var(--accent-red-bg)" color="var(--accent-red)" size={34} />
                        }
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>Broker Cloud</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: railwayConnected ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {railwayConnected ? 'Conectado' : 'Desconectado'}
                    </div>
                </div>

                <div className="glass-card" style={{ padding: '16px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                        <IconMonitor bg={pcConnected ? 'var(--accent-green-bg)' : 'var(--accent-red-bg)'} color={pcConnected ? 'var(--accent-green)' : 'var(--accent-red)'} size={34} />
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>PC Bridge</span>
                    </div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem', color: pcConnected ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                        {pcConnected ? 'En Línea' : 'Offline'}
                    </div>
                </div>
            </div>

            {/* Injection Status */}
            <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <IconPrinter bg={injectionActive ? 'var(--accent-green-bg)' : 'var(--accent-amber-bg)'} color={injectionActive ? 'var(--accent-green)' : 'var(--accent-amber)'} size={32} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>Motor de Impresión</span>
                    </div>
                    <span className={`badge ${injectionActive ? 'badge-success' : 'badge-warning'}`}>
                        {injectionActive ? 'Activo' : 'Inactivo'}
                    </span>
                </div>
                <div style={{ height: 5, background: 'var(--bg-deep)', borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{
                        width: injectionActive ? '100%' : '8%', height: '100%',
                        background: injectionActive
                            ? 'linear-gradient(90deg, var(--accent-green), #34d399)'
                            : 'var(--accent-amber)',
                        borderRadius: 3,
                        transition: 'width 0.8s ease'
                    }} />
                </div>
                <p style={{ margin: '10px 0 0 0', fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                    El motor de inyección permite que Mozo.pe detecte las impresoras del PC de forma transparente.
                </p>
            </div>

            {/* Recent Logs Mini */}
            <div className="glass-card" style={{ padding: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <IconLog size={28} />
                        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Actividad Reciente</span>
                    </div>
                    <button onClick={() => setView('logs')} style={{
                        background: 'none', border: 'none', color: 'var(--primary)', fontSize: '0.75rem',
                        fontWeight: 600, cursor: 'pointer', padding: '4px 0'
                    }}>Ver todo</button>
                </div>
                <div style={{ maxHeight: 110, overflow: 'hidden' }}>
                    {logs.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '16px 0', fontSize: '0.78rem' }}>
                            Sin actividad reciente
                        </div>
                    ) : (
                        logs.slice(-4).reverse().map((log, i) => (
                            <div key={i} style={{
                                padding: '6px 0', fontSize: '0.7rem',
                                color: i === 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                                borderBottom: i < 3 ? '1px solid var(--border-light)' : 'none',
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                            }}>
                                {log}
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* POS Button */}
            <button className="btn-primary" onClick={() => setView('pos')} style={{ padding: 15, fontSize: '0.95rem', borderRadius: 12 }}>
                <IconRocket bg="transparent" color="#ffffff" size={24} />
                Abrir Terminal POS
            </button>
        </div>
    );

    // ─── POS View ────────────────────────────────────────────
    const POSView = () => {
        useEffect(() => {
            localStorage.setItem('kopi_view', 'pos');
            window.location.href = "https://mozo.pe/app";
        }, []);

        return (
            <div style={{
                width: '100%', height: '100vh', background: '#ffffff',
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 16
            }}>
                <div style={{
                    width: 56, height: 56, borderRadius: '50%',
                    background: 'var(--primary-glow)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                    <svg className="spinner" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--primary)" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                </div>
                <div style={{ fontWeight: 600, color: 'var(--text-main)', fontSize: '1rem' }}>Cargando Terminal...</div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Conectando con Mozo.pe</div>
            </div>
        );
    };

    // ─── Logs View ───────────────────────────────────────────
    const LogsView = () => (
        <div className="fade-in" style={{ padding: 16, height: 'calc(100vh - 56px)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                    {logs.length} eventos registrados
                </span>
                <button onClick={copyLogs} className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {isCopied ? <><IconCheck size={14} /> Copiado</> : <><IconCopy size={14} /> Copiar</>}
                </button>
            </div>
            <div style={{
                flex: 1, background: '#ffffff', borderRadius: 'var(--radius)', padding: 14,
                overflowY: 'auto', border: '1px solid var(--border)',
                fontFamily: 'ui-monospace, "Cascadia Code", Menlo, Monaco, Consolas, monospace'
            }}>
                {logs.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', paddingTop: 60 }}>
                        <IconLog bg="var(--bg-deep)" color="var(--text-muted)" size={48} />
                        <div style={{ marginTop: 12, fontSize: '0.85rem' }}>Esperando actividad del sistema...</div>
                    </div>
                ) : (
                    logs.slice().reverse().map((log, i) => (
                        <div key={i} style={{
                            padding: '8px 0', borderBottom: '1px solid var(--border-light)',
                            fontSize: '0.72rem', color: i === 0 ? 'var(--text-main)' : 'var(--text-muted)',
                            display: 'flex', gap: 8, alignItems: 'flex-start'
                        }}>
                            <div style={{
                                width: 6, height: 6, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                                background: i === 0 ? 'var(--primary)' : 'var(--border)'
                            }} />
                            <span style={{ wordBreak: 'break-all', lineHeight: 1.5 }}>{log}</span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );

    // ─── Printers View ──────────────────────────────────────
    const PrintersView = () => (
        <div className="fade-in" style={{ padding: 16 }}>
            {/* PC Connection Status */}
            <div className="glass-card" style={{
                padding: 16, marginBottom: 16,
                borderLeft: `4px solid ${pcConnected ? 'var(--accent-green)' : 'var(--accent-red)'}`,
                borderRadius: 'var(--radius)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <IconMonitor 
                        bg={pcConnected ? 'var(--accent-green-bg)' : 'var(--accent-red-bg)'} 
                        color={pcConnected ? 'var(--accent-green)' : 'var(--accent-red)'} 
                        size={40} 
                    />
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: pcConnected ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {pcConnected ? 'PC Conectado' : 'PC Desconectado'}
                        </h3>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                            {pcConnected ? 'Listo para imprimir' : 'Esperando conexión del PC'}
                        </p>
                    </div>
                    {pcConnected && (
                        <div style={{
                            width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-green)', flexShrink: 0
                        }} />
                    )}
                </div>

                {pcInfo && (
                    <div style={{
                        marginTop: 12, padding: '10px 12px',
                        background: 'var(--bg-deep)', borderRadius: 'var(--radius-sm)',
                    }}>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 4 }}>Información del PC</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>{pcInfo.nombre}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>RUC: {pcInfo.ruc}</div>
                        {pcInfo.ips && pcInfo.ips.length > 0 && (
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
                                IP: {pcInfo.ips[0]}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Printers List */}
            <div className="glass-card" style={{ padding: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                    <IconPrinter size={30} />
                    <div>
                        <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Impresoras Disponibles</h3>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                            {printers.length} impresora{printers.length !== 1 ? 's' : ''} detectada{printers.length !== 1 ? 's' : ''}
                        </p>
                    </div>
                </div>

                {!pcConnected ? (
                    <div style={{
                        textAlign: 'center', padding: '40px 20px',
                        background: 'var(--bg-deep)', borderRadius: 'var(--radius)',
                        border: '2px dashed var(--border)'
                    }}>
                        <IconMonitor bg="var(--bg-deep)" color="var(--text-muted)" size={48} />
                        <div style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            PC no conectado
                        </div>
                        <div style={{ marginTop: 6, fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Conecta el PC a través de Railway para ver las impresoras disponibles
                        </div>
                    </div>
                ) : printers.length === 0 ? (
                    <div style={{
                        textAlign: 'center', padding: '40px 20px',
                        background: 'var(--accent-amber-bg)', borderRadius: 'var(--radius)',
                        border: '1px solid var(--accent-amber-light)'
                    }}>
                        <IconPrinter bg="transparent" color="var(--accent-amber)" size={48} />
                        <div style={{ marginTop: 12, fontSize: '0.85rem', color: 'var(--accent-amber)', fontWeight: 500 }}>
                            No se detectaron impresoras
                        </div>
                        <div style={{ marginTop: 6, fontSize: '0.73rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                            Asegúrate de que las impresoras estén encendidas y conectadas al PC
                        </div>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {printers.map((printer, index) => (
                            <div key={index} style={{
                                padding: '14px 16px',
                                background: 'var(--bg-deep)',
                                borderRadius: 'var(--radius)',
                                border: '1px solid var(--border)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 12
                            }}>
                                <IconPrinter bg="var(--accent-cyan-bg)" color="var(--accent-cyan)" size={36} />
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-main)' }}>
                                        {printer}
                                    </div>
                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 2 }}>
                                        Lista para imprimir
                                    </div>
                                </div>
                                <div style={{
                                    padding: '4px 10px',
                                    background: 'var(--accent-green-bg)',
                                    color: 'var(--accent-green)',
                                    borderRadius: 'var(--radius-sm)',
                                    fontSize: '0.7rem',
                                    fontWeight: 600
                                }}>
                                    Activa
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );

    // ─── Config View ─────────────────────────────────────────
    // Componente memoizado para evitar re-renders del formulario
    const ConfigForm = React.memo(({ 
        sedeId, 
        token, 
        railwayUrl, 
        onSedeIdChange, 
        onTokenChange, 
        onRailwayUrlChange,
        railwayConnected,
        isConnecting,
        isReconnecting,
        connectError,
        onConnect,
        onDisconnect,
        onPermissionRequest,
        permissionStatus
    }: {
        sedeId: string;
        token: string;
        railwayUrl: string;
        onSedeIdChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
        onTokenChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
        onRailwayUrlChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
        railwayConnected: boolean;
        isConnecting: boolean;
        isReconnecting: boolean;
        connectError: string;
        onConnect: () => void;
        onDisconnect: () => void;
        onPermissionRequest: () => void;
        permissionStatus: string;
    }) => (
        <div className="glass-card" style={{ padding: '20px 18px', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <IconLink size={30} />
                <h3 style={{ margin: 0, fontSize: '0.95rem' }}>Credenciales de Conexión</h3>
            </div>

            <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    ID de Sede
                </label>
                <input
                    className="compact-input"
                    type="text"
                    inputMode="text"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={sedeId}
                    onChange={onSedeIdChange}
                    placeholder="Ej: 130945"
                    disabled={railwayConnected}
                />
            </div>

            <div style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Access Token
                </label>
                <input
                    type="password"
                    className="compact-input"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={token}
                    onChange={onTokenChange}
                    placeholder="Ingrese ID de Sede del PC Maestro"
                    disabled={railwayConnected}
                />
            </div>

            <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Dirección del Broker
                </label>
                <input
                    type="url"
                    className="compact-input"
                    inputMode="url"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                    value={railwayUrl}
                    onChange={onRailwayUrlChange}
                    disabled={railwayConnected}
                />
            </div>

            {connectError && (
                <div style={{
                    marginTop: 12, marginBottom: 16, padding: '10px 12px',
                    background: 'var(--accent-red-bg)', border: '1px solid var(--accent-red)',
                    borderRadius: 'var(--radius-sm)', fontSize: '0.73rem', color: 'var(--accent-red)',
                    display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>
                    {connectError}
                </div>
            )}

            {railwayConnected || isReconnecting || isConnecting ? (
                <button className="btn-danger" onClick={onDisconnect}>
                    <IconPlug bg="transparent" color="var(--accent-red)" size={22} />
                    {railwayConnected ? 'Desconectar' : 'Cancelar Conexión'}
                </button>
            ) : (
                <button
                    className="btn-primary"
                    onClick={onConnect}
                    disabled={isConnecting || !sedeId || !token || !railwayUrl}
                >
                    {isConnecting ? (
                        <>
                            <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                            Conectando...
                        </>
                    ) : (
                        <>
                            <IconRocket bg="transparent" color="#ffffff" size={22} />
                            Conectar a Railway
                        </>
                    )}
                </button>
            )}

            {!sedeId || !token || !railwayUrl ? (
                <div style={{
                    marginTop: 12, padding: '10px 12px',
                    background: 'var(--accent-amber-bg)', border: '1px solid var(--accent-amber-light)',
                    borderRadius: 'var(--radius-sm)', fontSize: '0.73rem', color: 'var(--accent-amber)',
                    display: 'flex', alignItems: 'center', gap: 8, fontWeight: 500
                }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
                    Complete todos los campos para conectar
                </div>
            ) : null}

            {/* Nueva sección de permisos */}
            <div style={{ marginTop: 24, padding: '16px 0 0 0', borderTop: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <IconGlobe size={28} bg="var(--accent-purple-bg)" color="var(--accent-purple)" />
                    <h4 style={{ margin: 0, fontSize: '0.85rem' }}>Permisos de Android 15</h4>
                </div>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginBottom: 14, lineHeight: 1.4 }}>
                    Para que la App no se cierre en segundo plano, debe autorizar las notificaciones de sistema.
                </p>
                <button 
                    className={permissionStatus === 'granted' ? 'btn-secondary' : 'btn-primary'}
                    onClick={onPermissionRequest}
                    style={{ background: permissionStatus === 'granted' ? '#f1f5f9' : undefined, color: permissionStatus === 'granted' ? '#64748b' : undefined }}
                >
                    {permissionStatus === 'granted' ? (
                        <>
                            <IconCheck size={18} color="#22c55e" />
                            Permisos Concedidos
                        </>
                    ) : (
                        <>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" /></svg>
                            Autorizar Notificaciones
                        </>
                    )}
                </button>
            </div>
        </div>
    ));

    const handleDisconnect = useCallback(async () => {
        const msg = railwayConnected 
            ? '¿Desea desconectar la sesión activa?' 
            : '¿Desea cancelar el intento de conexión y detener la reconexión automática?';
            
        if (confirm(msg)) {
            try {
                await (Capacitor as any).Plugins.Kopi.disconnectRailway();
                setRailwayConnected(false);
                setPcConnected(false);
                setIsReconnecting(false);
                setIsConnecting(false);
                setConnectError('');
            } catch (e) {
                console.error('[KOPI-APP] Error desconectando:', e);
            }
        }
    }, [railwayConnected]);

    const ConfigView = () => (
        <div className="fade-in" style={{ padding: 16 }}>
            {/* Connection Status Banner */}
            <div className="glass-card" style={{
                padding: 16, marginBottom: 16,
                borderLeft: `4px solid ${railwayConnected ? 'var(--accent-green)' : isReconnecting ? 'var(--accent-amber)' : 'var(--accent-red)'}`,
                borderRadius: 'var(--radius)'
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {railwayConnected
                        ? <IconWifi bg="var(--accent-green-bg)" color="var(--accent-green)" size={40} />
                        : isReconnecting
                        ? <IconWifi bg="var(--accent-amber-bg)" color="var(--accent-amber)" size={40} />
                        : <IconWifiOff bg="var(--accent-red-bg)" color="var(--accent-red)" size={40} />
                    }
                    <div style={{ flex: 1 }}>
                        <h3 style={{ margin: 0, fontSize: '1rem', color: railwayConnected ? 'var(--accent-green)' : isReconnecting ? 'var(--accent-amber)' : 'var(--accent-red)' }}>
                            {railwayConnected ? 'Conectado a Railway' : isReconnecting ? 'Reconectando...' : 'Sin Conexión'}
                        </h3>
                        <p style={{ margin: '3px 0 0 0', fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                            {railwayConnected ? `Sede ${sedeId} • Broker activo` : isReconnecting ? 'Intentando reconectar al broker' : 'Configure las credenciales y conecte'}
                        </p>
                    </div>
                    {railwayConnected && (
                        <div className="status-pulse-green" style={{
                            width: 10, height: 10, borderRadius: '50%', background: 'var(--accent-green)', flexShrink: 0
                        }} />
                    )}
                    {isReconnecting && (
                        <svg className="spinner" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent-amber)" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                    )}
                </div>

                {pcConnected && (
                    <div style={{
                        marginTop: 12, padding: '10px 12px',
                        background: 'var(--accent-green-bg)', borderRadius: 'var(--radius-sm)',
                        display: 'flex', alignItems: 'center', gap: 10
                    }}>
                        <IconMonitor bg="var(--accent-green-light)" color="var(--accent-green)" size={30} />
                        <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--accent-green)' }}>PC Conectado</div>
                            <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>Listo para enviar impresiones</div>
                        </div>
                    </div>
                )}
            </div>

            {/* Configuration Form */}
            <ConfigForm
                sedeId={sedeId}
                token={token}
                railwayUrl={railwayUrl}
                onSedeIdChange={handleSedeIdChange}
                onTokenChange={handleTokenChange}
                onRailwayUrlChange={handleRailwayUrlChange}
                railwayConnected={railwayConnected}
                isConnecting={isConnecting}
                isReconnecting={isReconnecting}
                connectError={connectError}
                onConnect={connectToRailway}
                onDisconnect={handleDisconnect}
                onPermissionRequest={handleRequestPermission}
                permissionStatus={permissionStatus}
            />

            {/* Danger Zone */}
            <div className="glass-card" style={{
                padding: 16,
                borderLeft: '4px solid var(--accent-red)',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                    <IconTrash size={30} />
                    <div>
                        <h4 style={{ margin: 0, color: 'var(--accent-red)', fontSize: '0.85rem' }}>Zona de Peligro</h4>
                        <p style={{ margin: '2px 0 0 0', fontSize: '0.68rem', color: 'var(--text-muted)' }}>Elimina toda la configuración local</p>
                    </div>
                </div>
                <button className="btn-danger" onClick={() => {
                    if (confirm('¿Confirmas la limpieza total del dispositivo?')) {
                        localStorage.clear();
                        window.location.reload();
                    }
                }}>
                    Borrar Caché y Datos
                </button>
            </div>
        </div>
    );

    // ─── Main Layout ─────────────────────────────────────────
    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', width: '100vw', background: 'var(--bg-deep)' }}>
            <Sidebar 
                isOpen={isSidebarOpen}
                onClose={() => setIsSidebarOpen(false)}
                currentView={view}
                onViewChange={setView}
                railwayConnected={railwayConnected}
                sedeId={sedeId}
            />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                <Header 
                    currentView={view}
                    onMenuClick={() => setIsSidebarOpen(true)}
                    railwayConnected={railwayConnected}
                />
                <div style={{ flex: 1, overflowY: 'auto' }}>
                    {view === 'dashboard' && <DashboardView />}
                    {view === 'printers' && <PrintersView />}
                    {view === 'pos' && <POSView />}
                    {view === 'logs' && <LogsView />}
                    {view === 'config' && <ConfigView />}
                </div>
            </div>
        </div>
    );
};

export default App;
