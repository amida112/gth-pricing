-- Migration: Raw Wood Pricing (formula + per-piece + per-container)
-- Đã chạy: 2026-03-29

CREATE TABLE IF NOT EXISTS raw_wood_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_wood_type_id UUID REFERENCES raw_wood_types(id) ON DELETE CASCADE,
  quality TEXT,
  size_min NUMERIC,
  size_max NUMERIC,
  unit_price NUMERIC NOT NULL,
  price_unit TEXT DEFAULT 'm3',
  notes TEXT,
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_rwp_type ON raw_wood_pricing(raw_wood_type_id);

ALTER TABLE raw_wood_inspection ADD COLUMN IF NOT EXISTS sale_unit_price NUMERIC;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS sale_unit_price NUMERIC;
ALTER TABLE containers ADD COLUMN IF NOT EXISTS sale_notes TEXT;
