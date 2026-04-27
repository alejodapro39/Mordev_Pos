-- ============================================================
-- Mordev POS — RESET COMPLETO DE BASE DE DATOS (v2 SaaS)
-- ⚠️  PELIGRO: Esto borra TODOS los datos existentes.
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- ── PASO 1: ELIMINAR VISTA (depende de tablas) ────────────────
DROP VIEW IF EXISTS liquidacion_vendedores;

-- ── PASO 2: ELIMINAR TABLAS (orden inverso a FK) ─────────────
DROP TABLE IF EXISTS password_reset_tokens   CASCADE;
DROP TABLE IF EXISTS draft_invoice_items     CASCADE;
DROP TABLE IF EXISTS draft_invoices          CASCADE;
DROP TABLE IF EXISTS sales                   CASCADE;
DROP TABLE IF EXISTS invoices                CASCADE;
DROP TABLE IF EXISTS pagos_historial         CASCADE;
DROP TABLE IF EXISTS customers               CASCADE;
DROP TABLE IF EXISTS products                CASCADE;
DROP TABLE IF EXISTS app_settings            CASCADE;
DROP TABLE IF EXISTS users                   CASCADE;
DROP TABLE IF EXISTS negocios                CASCADE;
DROP TABLE IF EXISTS vendedores              CASCADE;
-- Tablas del schema viejo (mono-tenant), por si existen
DROP TABLE IF EXISTS configuracion           CASCADE;

-- ── PASO 3: CREAR TABLAS ──────────────────────────────────────

-- ============================================================
-- A. VENDEDORES (socios que venden el software Mordev POS)
-- ============================================================
CREATE TABLE vendedores (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              TEXT NOT NULL,
    email               TEXT UNIQUE,
    codigo_referido     TEXT UNIQUE NOT NULL,
    comision_porcentaje NUMERIC(5,4) DEFAULT 0.20,
    datos_pago          JSONB DEFAULT '{"tipo":"nequi","numero":""}',
    activo              BOOLEAN DEFAULT TRUE,
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- B. NEGOCIOS (Tenants del SaaS — cada cliente es un negocio)
-- ============================================================
CREATE TABLE negocios (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre_negocio    TEXT NOT NULL,
    email             TEXT UNIQUE NOT NULL,
    licencia_activa   BOOLEAN DEFAULT TRUE,
    fecha_vencimiento TIMESTAMPTZ,
    -- Vendedor que trajo este negocio (puede ser NULL)
    vendedor_id       UUID REFERENCES vendedores(id) ON DELETE SET NULL,
    -- Design Tokens / Tema visual
    categoria         TEXT DEFAULT 'general'
                          CHECK (categoria IN ('mascotas','carros','comida','tecnologia','general')),
    color_hex         TEXT DEFAULT '#00C8FF',
    icono_slug        TEXT DEFAULT 'storefront',
    created_at        TIMESTAMPTZ DEFAULT NOW(),
    updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- C. USERS (operarios/admin de CADA negocio)
-- ============================================================
CREATE TABLE users (
    id            BIGSERIAL PRIMARY KEY,
    id_negocio    UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    username      TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL CHECK (role IN ('admin','vendedor')),
    avatar_path   TEXT DEFAULT '',
    created_at    TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (id_negocio, username)
);

-- ============================================================
-- D. PRODUCTOS (inventario por negocio)
-- ============================================================
CREATE TABLE products (
    id             BIGSERIAL PRIMARY KEY,
    id_negocio     UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    name           TEXT NOT NULL,
    reference      TEXT DEFAULT '',
    unit           TEXT DEFAULT '',
    category       TEXT DEFAULT '',
    purchase_price NUMERIC(12,2) DEFAULT 0,
    sale_price     NUMERIC(12,2) DEFAULT 0,
    price          NUMERIC(12,2) DEFAULT 0,
    stock          NUMERIC(12,3) DEFAULT 0,
    image_path     TEXT DEFAULT '',
    is_bulk        BOOLEAN DEFAULT FALSE,
    barcode        TEXT DEFAULT '',
    created_at     TIMESTAMPTZ DEFAULT NOW(),
    updated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- E. CLIENTES (por negocio)
-- ============================================================
CREATE TABLE customers (
    id         BIGSERIAL PRIMARY KEY,
    id_negocio UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    name       TEXT NOT NULL,
    address    TEXT,
    phone      TEXT,
    nid        TEXT,
    placa      TEXT,
    vehiculo   TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (id_negocio, nid)
);

-- ============================================================
-- F. FACTURAS / INVOICES (por negocio)
-- ============================================================
CREATE TABLE invoices (
    id               BIGSERIAL PRIMARY KEY,
    id_negocio       UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    customer_id      BIGINT REFERENCES customers(id) ON DELETE SET NULL,
    customer_name    TEXT,
    customer_address TEXT,
    customer_phone   TEXT,
    customer_nid     TEXT,
    customer_placa   TEXT,
    customer_vehiculo TEXT,
    subtotal         NUMERIC(12,2) NOT NULL,
    abonos           NUMERIC(12,2) DEFAULT 0,
    saldo            NUMERIC(12,2) NOT NULL,
    total            NUMERIC(12,2) NOT NULL,
    payment_method   TEXT,
    seller_id        BIGINT REFERENCES users(id) ON DELETE SET NULL,
    seller_name      TEXT,
    date             TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- G. VENTAS / SALES (detalle de productos por factura)
-- ============================================================
CREATE TABLE sales (
    id                  BIGSERIAL PRIMARY KEY,
    id_negocio          UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    invoice_id          BIGINT REFERENCES invoices(id) ON DELETE CASCADE,
    product_id          BIGINT REFERENCES products(id) ON DELETE SET NULL,
    product_name        TEXT NOT NULL,
    product_reference   TEXT DEFAULT '',
    quantity            NUMERIC(12,3) NOT NULL,
    unit_price          NUMERIC(12,2) NOT NULL,
    purchase_unit_price NUMERIC(12,2) DEFAULT 0,
    total               NUMERIC(12,2) NOT NULL,
    seller_id           BIGINT REFERENCES users(id) ON DELETE SET NULL,
    seller_name         TEXT NOT NULL,
    date                TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- H. BORRADORES / DRAFT INVOICES (facturas abiertas)
-- ============================================================
CREATE TABLE draft_invoices (
    id               BIGSERIAL PRIMARY KEY,
    id_negocio       UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    customer_id      BIGINT,
    customer_name    TEXT,
    customer_address TEXT,
    customer_phone   TEXT,
    customer_nid     TEXT,
    customer_placa   TEXT,
    customer_vehiculo TEXT,
    subtotal         NUMERIC(12,2),
    abonos           NUMERIC(12,2),
    saldo            NUMERIC(12,2),
    total            NUMERIC(12,2),
    payment_method   TEXT,
    seller_id        BIGINT,
    date             TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE draft_invoice_items (
    id           BIGSERIAL PRIMARY KEY,
    draft_id     BIGINT NOT NULL REFERENCES draft_invoices(id) ON DELETE CASCADE,
    product_id   BIGINT,
    product_name TEXT,
    quantity     NUMERIC(12,3),
    unit_price   NUMERIC(12,2),
    total        NUMERIC(12,2)
);

-- ============================================================
-- I. AJUSTES DE LA APP (configuración por negocio)
-- ============================================================
CREATE TABLE app_settings (
    id_negocio UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    key        TEXT NOT NULL,
    value      TEXT,
    PRIMARY KEY (id_negocio, key)
);

-- ============================================================
-- J. HISTORIAL DE PAGOS DE LICENCIA (Mercado Pago)
-- ============================================================
CREATE TABLE pagos_historial (
    id               BIGSERIAL PRIMARY KEY,
    id_negocio       UUID NOT NULL REFERENCES negocios(id) ON DELETE CASCADE,
    payment_id       TEXT UNIQUE NOT NULL,
    status           TEXT NOT NULL,
    monto            NUMERIC(12,2),
    dias_acumulados  INTEGER DEFAULT 30,
    fecha_pago       TIMESTAMPTZ DEFAULT NOW(),
    payload_raw      JSONB
);

-- ============================================================
-- K. TOKENS RESET DE CONTRASEÑA (seguridad, 3 min de vida)
-- ============================================================
CREATE TABLE password_reset_tokens (
    id         BIGSERIAL PRIMARY KEY,
    email      TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    usado      BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_prt_hash    ON password_reset_tokens(token_hash);
CREATE INDEX idx_prt_expires ON password_reset_tokens(expires_at);

-- ============================================================
-- L. VISTA: LIQUIDACIÓN VENDEDORES
-- (Comisiones mensuales de socios que venden el software)
-- ============================================================
CREATE OR REPLACE VIEW liquidacion_vendedores AS
SELECT
    v.id                                                            AS vendedor_id,
    v.nombre                                                        AS nombre_vendedor,
    v.codigo_referido,
    v.email                                                         AS email_vendedor,
    v.datos_pago,
    v.comision_porcentaje,
    COUNT(n.id)                                                     AS negocios_activos_mes,
    COUNT(n.id) * 60000                                             AS ingresos_brutos_mes,
    ROUND((COUNT(n.id) * 60000 * v.comision_porcentaje)::NUMERIC, 0) AS comision_a_pagar,
    TO_CHAR(DATE_TRUNC('month', NOW()), 'Month YYYY')               AS mes_liquidacion
FROM vendedores v
LEFT JOIN negocios n
       ON n.vendedor_id = v.id
      AND DATE_TRUNC('month', n.created_at) = DATE_TRUNC('month', NOW())
WHERE v.activo = TRUE
GROUP BY v.id, v.nombre, v.codigo_referido, v.email, v.datos_pago, v.comision_porcentaje;

-- ── PASO 4: ÍNDICES DE RENDIMIENTO ───────────────────────────
CREATE INDEX idx_users_negocio     ON users(id_negocio);
CREATE INDEX idx_products_negocio  ON products(id_negocio);
CREATE INDEX idx_customers_negocio ON customers(id_negocio);
CREATE INDEX idx_invoices_negocio  ON invoices(id_negocio);
CREATE INDEX idx_invoices_date     ON invoices(date);
CREATE INDEX idx_sales_negocio     ON sales(id_negocio);
CREATE INDEX idx_sales_date        ON sales(date);
CREATE INDEX idx_drafts_negocio    ON draft_invoices(id_negocio);
CREATE INDEX idx_settings_negocio  ON app_settings(id_negocio);

-- ── PASO 5: DESHABILITAR RLS ─────────────────────────────────
-- El backend usa Service Role Key que bypasea RLS de todas formas,
-- pero lo deshabilitamos explícitamente para evitar errores.
ALTER TABLE vendedores              DISABLE ROW LEVEL SECURITY;
ALTER TABLE negocios                DISABLE ROW LEVEL SECURITY;
ALTER TABLE users                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE products                DISABLE ROW LEVEL SECURITY;
ALTER TABLE customers               DISABLE ROW LEVEL SECURITY;
ALTER TABLE invoices                DISABLE ROW LEVEL SECURITY;
ALTER TABLE sales                   DISABLE ROW LEVEL SECURITY;
ALTER TABLE draft_invoices          DISABLE ROW LEVEL SECURITY;
ALTER TABLE draft_invoice_items     DISABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings            DISABLE ROW LEVEL SECURITY;
ALTER TABLE pagos_historial         DISABLE ROW LEVEL SECURITY;
ALTER TABLE password_reset_tokens   DISABLE ROW LEVEL SECURITY;

-- ── PASO 6: VENDEDOR DEMO (borra este bloque si no lo quieres) ─
-- INSERT INTO vendedores (nombre, email, codigo_referido, datos_pago)
-- VALUES ('Socio Demo', 'socio@mordev.co', 'MORDEV2026',
--         '{"tipo":"nequi","numero":"3001234567"}')
-- ON CONFLICT (codigo_referido) DO NOTHING;

-- ============================================================
-- ✅ FIN DEL RESET
-- Verifica con:
--   SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';
--   SELECT * FROM liquidacion_vendedores;
-- ============================================================
