-- ================================================================
-- Gán NCC ↔ Loại hàng hóa (tròn/hộp/kiện) + Loại gỗ
-- Quan hệ nhiều-nhiều
-- Ngày: 2026-03-25
-- ================================================================

CREATE TABLE IF NOT EXISTS supplier_wood_assignments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supplier_ncc_id  text NOT NULL,                                    -- suppliers.ncc_id
  product_type     text NOT NULL CHECK (product_type IN ('round', 'box', 'sawn')),
  raw_wood_type_id uuid REFERENCES raw_wood_types(id) ON DELETE CASCADE,  -- cho round/box
  sawn_wood_id     text,                                              -- cho kiện (wood_types.id)
  created_at       timestamptz DEFAULT now(),

  -- Không trùng lặp
  UNIQUE(supplier_ncc_id, product_type, raw_wood_type_id),
  UNIQUE(supplier_ncc_id, product_type, sawn_wood_id)
);

CREATE INDEX idx_swa_supplier ON supplier_wood_assignments(supplier_ncc_id);
CREATE INDEX idx_swa_product  ON supplier_wood_assignments(product_type);

ALTER TABLE supplier_wood_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "swa_all" ON supplier_wood_assignments FOR ALL USING (true) WITH CHECK (true);
