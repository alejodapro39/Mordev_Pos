-- ============================================================
-- Mordev POS — Script SQL Completo para Supabase (MULTI-CLIENTE / SaaS)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ============================================================
-- 0. BORRADO TOTAL (RESET)
-- ¡PELIGRO! Esto eliminará todas las tablas y datos existentes.
-- ============================================================
DROP TABLE IF EXISTS draft_invoice_items CASCADE;
DROP TABLE IF EXISTS draft_invoices CASCADE;
DROP TABLE IF EXISTS sales CASCADE;
DROP TABLE IF EXISTS invoices CASCADE;
DROP TABLE IF EXISTS customers CASCADE;
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS users CASCADE;
DROP TABLE IF EXISTS pagos_historial CASCADE;
DROP TABLE IF EXISTS app_settings CASCADE;
DROP TABLE IF EXISTS configuracion CASCADE; -- Tabla vieja de licencias
DROP TABLE IF EXISTS negocios CASCADE;

-- 1. NEGOCIOS (Configuración y Licencia de cada Cliente)
CREATE TABLE IF NOT EXISTS negocios (
    id TEXT PRIMARY KEY,
    nombre_negocio TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    licencia_activa BOOLEAN DEFAULT TRUE,
    fecha_vencimiento TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. USUARIOS (Asociados a un Negocio)
CREATE TABLE IF NOT EXISTS users (
    id BIGSERIAL PRIMARY KEY,
    id_negocio TEXT REFERENCES negocios(id) ON DELETE CASCADE NOT NULL,
    username TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'vendedor')),
    avatar_path TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(id_negocio, username)
);

-- 3. PRODUCTOS (Inventario por Negocio)
CREATE TABLE IF NOT EXISTS products (
    id BIGSERIAL PRIMARY KEY,
    id_negocio TEXT REFERENCES negocios(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    reference TEXT DEFAULT '',
    unit TEXT DEFAULT '',
    category TEXT DEFAULT '',
    purchase_price NUMERIC(12,2) DEFAULT 0,
    sale_price NUMERIC(12,2) DEFAULT 0,
    price NUMERIC(12,2) DEFAULT 0,
    stock NUMERIC(12,3) DEFAULT 0,
    image_path TEXT DEFAULT '',
    is_bulk BOOLEAN DEFAULT FALSE,
    barcode TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(id_negocio, barcode)
);

-- 4. CLIENTES (Directorio por Negocio)
CREATE TABLE IF NOT EXISTS customers (
    id BIGSERIAL PRIMARY KEY,
    id_negocio TEXT REFERENCES negocios(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    address TEXT,
    phone TEXT,
    nid TEXT,
    placa TEXT,
    vehiculo TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(id_negocio, nid)
);

-- 5. FACTURAS (Ventas cerradas por Negocio)
CREATE TABLE IF NOT EXISTS invoices (
    id BIGSERIAL PRIMARY KEY,
    id_negocio TEXT REFERENCES negocios(id) ON DELETE CASCADE NOT NULL,
    customer_id BIGINT REFERENCES customers(id),
    customer_name TEXT,
    customer_address TEXT,
    customer_phone TEXT,
    customer_nid TEXT,
    customer_placa TEXT,
    customer_vehiculo TEXT,
    subtotal NUMERIC(12,2) NOT NULL,
    abonos NUMERIC(12,2) DEFAULT 0,
    saldo NUMERIC(12,2) NOT NULL,
    total NUMERIC(12,2) NOT NULL,
    payment_method TEXT,
    seller_id BIGINT REFERENCES users(id),
    seller_name TEXT,
    date TIMESTAMPTZ DEFAULT NOW()
);

-- 6. VENTAS (Detalle de productos por factura)
CREATE TABLE IF NOT EXISTS sales (
    id BIGSERIAL PRIMARY KEY,
    id_negocio TEXT REFERENCES negocios(id) ON DELETE CASCADE NOT NULL,
    invoice_id BIGINT REFERENCES invoices(id) ON DELETE CASCADE,
    product_id BIGINT REFERENCES products(id),
    product_name TEXT NOT NULL,
    product_reference TEXT DEFAULT '',
    quantity NUMERIC(12,3) NOT NULL,
    unit_price NUMERIC(12,2) NOT NULL,
    purchase_unit_price NUMERIC(12,2) DEFAULT 0,
    total NUMERIC(12,2) NOT NULL,
    seller_id BIGINT REFERENCES users(id),
    seller_name TEXT NOT NULL,
    date TIMESTAMPTZ DEFAULT NOW()
);

-- 7. BORRADORES (Cotizaciones o cuentas abiertas por Negocio)
CREATE TABLE IF NOT EXISTS draft_invoices (
    id BIGSERIAL PRIMARY KEY,
    id_negocio TEXT REFERENCES negocios(id) ON DELETE CASCADE NOT NULL,
    customer_id BIGINT,
    customer_name TEXT,
    customer_address TEXT,
    customer_phone TEXT,
    customer_nid TEXT,
    customer_placa TEXT,
    customer_vehiculo TEXT,
    subtotal NUMERIC(12,2),
    abonos NUMERIC(12,2),
    saldo NUMERIC(12,2),
    total NUMERIC(12,2),
    payment_method TEXT,
    seller_id BIGINT,
    date TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS draft_invoice_items (
    id BIGSERIAL PRIMARY KEY,
    draft_id BIGINT REFERENCES draft_invoices(id) ON DELETE CASCADE,
    product_id BIGINT,
    product_name TEXT,
    quantity NUMERIC(12,3),
    unit_price NUMERIC(12,2),
    total NUMERIC(12,2)
);

-- 8. AJUSTES DE LA APP (Configuración por Negocio)
CREATE TABLE IF NOT EXISTS app_settings (
    id_negocio TEXT REFERENCES negocios(id) ON DELETE CASCADE NOT NULL,
    key TEXT,
    value TEXT,
    PRIMARY KEY (id_negocio, key)
);

-- 9. HISTORIAL DE PAGOS DE LICENCIA
CREATE TABLE IF NOT EXISTS pagos_historial (
    id BIGSERIAL PRIMARY KEY,
    id_negocio TEXT REFERENCES negocios(id) ON DELETE CASCADE NOT NULL,
    payment_id TEXT UNIQUE NOT NULL,
    status TEXT NOT NULL,
    monto NUMERIC(12,2),
    dias_acumulados INTEGER DEFAULT 30,
    fecha_pago TIMESTAMPTZ DEFAULT NOW(),
    payload_raw JSONB
);

-- (Opcional) Creación de un super-admin para pruebas iniciales si lo necesitas
-- Nota: En un SaaS real, se registran vía el Frontend /register.
