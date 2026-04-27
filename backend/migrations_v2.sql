-- ============================================================
-- Mordev POS — Migración v2 (SaaS Escalable)
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ¡SOLO AGREGA columnas y tablas nuevas! No destruye datos.
-- ============================================================

-- ============================================================
-- 1. TABLA: vendedores (socios comerciales con comisión)
-- ============================================================
CREATE TABLE IF NOT EXISTS vendedores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    email TEXT UNIQUE,
    codigo_referido TEXT UNIQUE NOT NULL,
    comision_porcentaje NUMERIC(5,4) DEFAULT 0.20,
    datos_pago JSONB DEFAULT '{"tipo": "nequi", "numero": ""}',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. TABLA: negocios — Añadir columnas nuevas
-- ============================================================
ALTER TABLE negocios
    ADD COLUMN IF NOT EXISTS vendedor_id UUID REFERENCES vendedores(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS categoria TEXT DEFAULT 'general'
        CHECK (categoria IN ('mascotas', 'carros', 'comida', 'tecnologia', 'general')),
    ADD COLUMN IF NOT EXISTS color_hex TEXT DEFAULT '#00C8FF',
    ADD COLUMN IF NOT EXISTS icono_slug TEXT DEFAULT 'storefront';

-- ============================================================
-- 3. TABLA: password_reset_tokens (recuperación de contraseña)
-- ============================================================
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id BIGSERIAL PRIMARY KEY,
    email TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NOT NULL,
    usado BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas rápidas por token
CREATE INDEX IF NOT EXISTS idx_reset_tokens_hash ON password_reset_tokens(token_hash);
-- Índice para limpiar tokens expirados fácilmente
CREATE INDEX IF NOT EXISTS idx_reset_tokens_expires ON password_reset_tokens(expires_at);

-- ============================================================
-- 4. VISTA: liquidacion_vendedores
-- Calcula comisiones del mes actual basadas en mensualidad COP 60.000
-- ============================================================
CREATE OR REPLACE VIEW liquidacion_vendedores AS
SELECT
    v.id                                                        AS vendedor_id,
    v.nombre                                                    AS nombre_vendedor,
    v.codigo_referido,
    v.email                                                     AS email_vendedor,
    v.datos_pago,
    v.comision_porcentaje,
    COUNT(n.id)                                                 AS negocios_activos_mes,
    COUNT(n.id) * 60000                                         AS ingresos_brutos_mes,
    ROUND((COUNT(n.id) * 60000 * v.comision_porcentaje)::numeric, 0) AS comision_a_pagar,
    TO_CHAR(DATE_TRUNC('month', NOW()), 'Month YYYY')           AS mes_liquidacion
FROM vendedores v
LEFT JOIN negocios n
    ON n.vendedor_id = v.id
    AND DATE_TRUNC('month', n.created_at) = DATE_TRUNC('month', NOW())
WHERE v.activo = TRUE
GROUP BY
    v.id, v.nombre, v.codigo_referido, v.email,
    v.datos_pago, v.comision_porcentaje;

-- ============================================================
-- 5. DATOS DE PRUEBA — Vendedor demo (opcional, borra si no quieres)
-- ============================================================
-- INSERT INTO vendedores (nombre, email, codigo_referido, datos_pago)
-- VALUES ('Demo Vendedor', 'vendedor@mordev.co', 'MORDEV2026',
--         '{"tipo": "nequi", "numero": "3001234567"}')
-- ON CONFLICT (codigo_referido) DO NOTHING;

-- ============================================================
-- FIN DE LA MIGRACIÓN v2
-- Verifica con: SELECT * FROM vendedores; SELECT * FROM liquidacion_vendedores;
-- ============================================================
