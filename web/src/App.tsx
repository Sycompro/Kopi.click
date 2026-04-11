import React, { useState } from 'react';
import Sidebar from './components/Sidebar';
import Dashboard from './components/Dashboard';
import CertificateManager from './components/CertificateManager';
import PrinterList from './components/PrinterList';
import AuditLog from './components/AuditLog';
import { useKopi } from './hooks/useKopi';
import './App.css';
import { Minus, Square, X } from 'lucide-react';

function App() {
    const [activeSection, setActiveSection] = useState('dashboard');
    const {
        serverInfo,
        printers,
        lookupRuc,
        generateCert,
        exportCertZip,
        testPrint,
        refreshPrinters,
        controls
    } = useKopi();

    const renderSection = () => {
        switch (activeSection) {
            case 'dashboard': return <Dashboard serverInfo={serverInfo} printerCount={printers.length} />;
            case 'certificates': return <CertificateManager lookupRuc={lookupRuc} generateCert={generateCert} exportCertZip={exportCertZip} />;
            case 'printers': return <PrinterList printers={printers} refreshPrinters={refreshPrinters} testPrint={testPrint} />;
            case 'logs': return <AuditLog />;
            default: return <Dashboard serverInfo={serverInfo} printerCount={printers.length} />;
        }
    };

    return (
        <>
            <header className="titlebar">
                <div className="titlebar-brand">
                    <div className="logo-box">K</div>
                    <span className="brand-name">Kopi Control</span>
                    <span className="brand-version">v1.2.0 PRO</span>
                </div>
                <div className="window-controls">
                    <button className="ctrl-btn" onClick={controls.minimize}><Minus size={14} /></button>
                    <button className="ctrl-btn" onClick={controls.maximize}><Square size={12} /></button>
                    <button className="ctrl-btn close" onClick={controls.close}><X size={14} /></button>
                </div>
            </header>

            <div className="main-wrapper">
                <Sidebar
                    activeSection={activeSection}
                    setActiveSection={setActiveSection}
                    serverActive={serverInfo?.running || false}
                />
                <main style={{ flex: 1, overflow: 'hidden', display: 'flex' }}>
                    {renderSection()}
                </main>
            </div>
        </>
    );
}

export default App;
