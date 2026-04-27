-- ============================================================
-- MORDEV POS — Migraciones SQL
-- Ejecuta esto en el editor SQL de Supabase (en orden)
-- ============================================================

-- ── 1. Tabla de Vendedores/Socios ────────────────────────────
CREATE TABLE IF NOT EXISTS vendedores (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre              TEXT NOT NULL,
    codigo_referido     TEXT UNIQUE NOT NULL,
    comision_porcentaje NUMERIC(5,4) DEFAULT 0.20,
    datos_pago          JSONB,           -- ej: {"tipo":"Nequi","numero":"3001234567"}
    created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 2. Actualizar tabla negocios ─────────────────────────────
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS vendedor_id  UUID REFERENCES vendedores(id) ON DELETE SET NULL;
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS categoria    TEXT DEFAULT 'general';
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS color_hex    TEXT DEFAULT '#00C8FF';
ALTER TABLE negocios ADD COLUMN IF NOT EXISTS icono_slug   TEXT DEFAULT 'storefront';

-- ── 3. Campos reset-password en users ────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token            TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS reset_token_expires_at TIMESTAMPTZ;

-- ── 4. Fix índice UNIQUE parcial de barcode ───────────────────
-- (Permite múltiples productos sin barcode; solo bloquea duplicados reales)
DROP INDEX IF EXISTS products_id_negocio_barcode_key;
CREATE UNIQUE INDEX IF NOT EXISTS products_barcode_partial_unique
    ON products(id_negocio, barcode)
    WHERE barcode IS NOT NULL AND barcode <> '';

-- ── 5. Vista: Liquidación de Vendedores (mes actual) ─────────
CREATE OR REPLACE VIEW liquidacion_vendedores AS
SELECT
    v.id                                                AS vendedor_id,
    v.nombre                                            AS vendedor_nombre,
    v.codigo_referido,
    v.comision_porcentaje,
    v.datos_pago,
    COUNT(n.id)                                         AS negocios_activos,
    COUNT(n.id) * 60000                                 AS total_mensualidades,
    ROUND(COUNT(n.id) * 60000 * v.comision_porcentaje)  AS comision_calculada,
    DATE_TRUNC('month', NOW())                          AS mes
FROM vendedores v
LEFT JOIN negocios n
    ON  n.vendedor_id     = v.id
    AND n.licencia_activa = TRUE
    AND n.fecha_vencimiento > NOW()
GROUP BY v.id, v.nombre, v.codigo_referido, v.comision_porcentaje, v.datos_pago;
