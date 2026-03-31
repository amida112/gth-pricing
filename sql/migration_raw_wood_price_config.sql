-- Migration: Raw Wood Price Config (formula-based pricing per wood type)
-- Bảng giá NL theo công thức riêng từng loại gỗ

CREATE TABLE IF NOT EXISTS raw_wood_price_config (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  raw_wood_type_id    UUID NOT NULL UNIQUE REFERENCES raw_wood_types(id) ON DELETE CASCADE,
  formula_type        TEXT NOT NULL CHECK (formula_type IN ('base_plus_measure','quality_matrix','volume_tier','flat')),
  -- base_plus_measure: Gỗ hộp, Tần bì, Teak, Sồi đỏ (base + coeff × size)
  -- quality_matrix:    Óc chó (base per quality + coeff × size + size_tier + modifiers)
  -- volume_tier:       Thông (base + order-level size/volume adjustments)
  -- flat:              Beech (giá cố định)

  base_price          NUMERIC,                    -- Giá cơ sở (tr/m³)
  measure_variable    TEXT,                        -- 'diameter' | 'width'
  measure_coefficient NUMERIC DEFAULT 0.1,         -- tr per cm (VD: 0.1 = mỗi cm kính +0.1tr)

  quality_config      JSONB,
  -- base_plus_measure: {"thường":{"surcharge":0},"cắt lạng":{"surcharge":3.0}}
  -- quality_matrix:    {"1SC":{"base":8.0},"2SC":{"base":6.5},"3SC":{"base":5.0}}

  size_tiers          JSONB,
  -- [{"min":30,"max":50,"adj":0.5,"label":"Cấp 2"}]

  volume_discounts    JSONB,
  -- [{"min_m3":10,"adj":-0.2,"label":">10 khối"}]

  sale_modifiers      JSONB,
  -- [{"name":"shape","label":"Hình dáng","options":[{"value":"thẳng","adj":0.5}]}]

  preview_sizes       JSONB,                      -- [30,40,50,60,70] — các mốc mẫu hiển thị bảng tham khảo

  ton_to_m3_ratio     NUMERIC,                    -- Quy đổi tấn→m³ (VD: 1.0, 0.85)

  notes               TEXT,
  updated_by          TEXT,
  updated_at          TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rwpc_type ON raw_wood_price_config(raw_wood_type_id);
