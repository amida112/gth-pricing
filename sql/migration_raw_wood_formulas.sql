-- ================================================================
-- Migration: Công thức tính khối lượng gỗ tròn/hộp
-- Ngày: 2026-03-26
-- ================================================================

-- ── 1. Bảng công thức preset ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS raw_wood_formulas (
  id            uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text    NOT NULL UNIQUE,
  label         text    NOT NULL,
  measurement   text    NOT NULL
    CHECK (measurement IN ('diameter', 'circumference', 'weight', 'box')),
  coeff         decimal,          -- hệ số nhân (7854, 8, ...)
  exponent      integer,          -- chia 10^exponent
  length_adjust boolean DEFAULT false, -- trừ chiều dài nếu D≥5m
  rounding      text    DEFAULT 'ROUND'
    CHECK (rounding IN ('ROUND', 'ROUNDDOWN')),
  decimals      integer DEFAULT 3,
  description   text,
  sort_order    integer DEFAULT 0
);

ALTER TABLE raw_wood_formulas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rwf_all" ON raw_wood_formulas FOR ALL USING (true) WITH CHECK (true);

-- Seed: 4 công thức
INSERT INTO raw_wood_formulas
  (name, label, measurement, coeff, exponent, length_adjust, rounding, decimals, description, sort_order)
VALUES
  ('circumference_simple',
   'Vanh chuẩn  V²×D×8/10⁶',
   'circumference', 8, 6, false, 'ROUND', 3,
   'Phổ biến nhất. ROUND(V²×D×8/1000000, 3)', 1),

  ('circumference_adjusted',
   'Vanh trừ dài  D_adj×V²×8/10⁶',
   'circumference', 8, 6, true, 'ROUNDDOWN', 3,
   'Tần bì nghiệm thu. ROUNDDOWN(IF(D≥5,D-0.2,D-0.1)×V²×8/10⁶, 3)', 2),

  ('diameter_standard',
   'Kính NCC  K²×D×7854/10⁸',
   'diameter', 7854, 8, false, 'ROUND', 3,
   'NCC dùng kính. ROUND(K²×D×7854/10⁸, 3)', 3),

  ('weight_only',
   'Chỉ cân (kg/tấn)',
   'weight', null, null, false, 'ROUND', 3,
   'Nhập theo cân, không dùng công thức.', 4);

-- ── 2. Mở rộng raw_wood_types ─────────────────────────────────────
ALTER TABLE raw_wood_types
  ADD COLUMN IF NOT EXISTS supplier_formula_id   uuid
    REFERENCES raw_wood_formulas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS inspection_formula_id uuid
    REFERENCES raw_wood_formulas(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS unit_type             text DEFAULT 'volume'
    CHECK (unit_type IN ('volume', 'weight', 'both')),
  ADD COLUMN IF NOT EXISTS sale_unit             text DEFAULT 'volume'
    CHECK (sale_unit IN ('volume', 'weight'));

COMMENT ON COLUMN raw_wood_types.unit_type
  IS 'volume=đo kích thước | weight=cân kg/tấn | both=NCC cân, bán theo m³';
COMMENT ON COLUMN raw_wood_types.sale_unit
  IS 'volume=giá/m³ | weight=giá/tấn';

-- ── 3. Thêm weight_kg vào packing list & inspection ───────────────
ALTER TABLE raw_wood_packing_list
  ADD COLUMN IF NOT EXISTS weight_kg decimal(12, 3);

ALTER TABLE raw_wood_inspection
  ADD COLUMN IF NOT EXISTS weight_kg decimal(12, 3);

COMMENT ON COLUMN raw_wood_packing_list.weight_kg
  IS 'Khối lượng theo NCC (kg) — dùng khi unit_type=weight hoặc both';
COMMENT ON COLUMN raw_wood_inspection.weight_kg
  IS 'Khối lượng thực tế cân (kg) — dùng khi bán lẻ theo tấn';

-- ── Kiểm tra ─────────────────────────────────────────────────────
SELECT name, label, measurement, coeff, exponent, length_adjust, rounding
FROM raw_wood_formulas ORDER BY sort_order;
