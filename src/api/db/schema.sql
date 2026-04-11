-- ═══════════════════════════════════════════════════════
-- Kopi — Schema de Base de Datos (Railway PostgreSQL)
-- ═══════════════════════════════════════════════════════

-- Empresas registradas
CREATE TABLE IF NOT EXISTS empresas (
    id SERIAL PRIMARY KEY,
    ruc VARCHAR(20) UNIQUE NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Certificados digitales por empresa
CREATE TABLE IF NOT EXISTS certificates (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    digital_certificate TEXT NOT NULL,
    private_key TEXT NOT NULL,
    ca_certificate TEXT NOT NULL,
    algorithm VARCHAR(20) DEFAULT 'SHA512',
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Dispositivos Kopi registrados
CREATE TABLE IF NOT EXISTS devices (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    device_name VARCHAR(255) NOT NULL,
    platform VARCHAR(20) NOT NULL CHECK (platform IN ('windows', 'android', 'linux', 'macos')),
    device_id VARCHAR(255),
    last_seen TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Configuración de impresoras por dispositivo
CREATE TABLE IF NOT EXISTS printer_configs (
    id SERIAL PRIMARY KEY,
    device_id INTEGER REFERENCES devices(id) ON DELETE CASCADE,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    printer_name VARCHAR(255) NOT NULL,
    connection_type VARCHAR(20) NOT NULL CHECK (connection_type IN ('usb', 'network', 'bluetooth')),
    ip_address VARCHAR(50),
    port INTEGER DEFAULT 9100,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Log de impresiones
CREATE TABLE IF NOT EXISTS print_logs (
    id SERIAL PRIMARY KEY,
    empresa_id INTEGER NOT NULL REFERENCES empresas(id) ON DELETE CASCADE,
    device_id INTEGER REFERENCES devices(id),
    printer_name VARCHAR(255),
    connection_type VARCHAR(20),
    bytes_sent INTEGER DEFAULT 0,
    success BOOLEAN DEFAULT true,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_certificates_empresa ON certificates(empresa_id);
CREATE INDEX IF NOT EXISTS idx_certificates_active ON certificates(empresa_id, is_active);
CREATE INDEX IF NOT EXISTS idx_devices_empresa ON devices(empresa_id);
CREATE INDEX IF NOT EXISTS idx_print_logs_empresa ON print_logs(empresa_id);
CREATE INDEX IF NOT EXISTS idx_print_logs_date ON print_logs(created_at);
