-- Migration: Nghiệm thu gỗ kiện NK (sawn wood bundle inspection)
-- Chạy trên cả staging (tscddgjkelnmlitzcxyg) và production (kpwyzwttmlzyojuxihto)

-- 1. Bảng nghiệm thu kiện gỗ xẻ NK
CREATE TABLE IF NOT EXISTS sawn_inspections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  container_id BIGINT NOT NULL REFERENCES containers(id) ON DELETE CASCADE,
  container_item_id BIGINT REFERENCES container_items(id) ON DELETE SET NULL,

  -- Dữ liệu packing list NCC
  supplier_bundle_code TEXT NOT NULL,
  supplier_boards INTEGER,
  supplier_volume NUMERIC,
  supplier_length TEXT,
  supplier_thickness TEXT,
  supplier_width TEXT,
  supplier_quality TEXT,
  supplier_ncc TEXT,
  wood_id TEXT,

  -- Dữ liệu nghiệm thu thực tế
  inspected_boards INTEGER,
  inspected_length TEXT,
  inspection_notes TEXT,
  images TEXT[],

  -- Trạng thái: pending → inspected → approved / hold → imported
  status TEXT DEFAULT 'pending',
  inspected_by TEXT,
  inspected_at TIMESTAMPTZ,
  approved_by TEXT,
  approved_at TIMESTAMPTZ,

  -- Link sang bundle sau khi nhập kho
  bundle_id INTEGER REFERENCES wood_bundles(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),

  -- Mã kiện không trùng trong cùng container
  UNIQUE(container_id, supplier_bundle_code)
);

-- Index cho query thường dùng
CREATE INDEX IF NOT EXISTS idx_sawn_insp_container ON sawn_inspections(container_id);
CREATE INDEX IF NOT EXISTS idx_sawn_insp_status ON sawn_inspections(status);
CREATE INDEX IF NOT EXISTS idx_sawn_insp_bundle ON sawn_inspections(bundle_id);

-- 2. Bổ sung cột vào wood_bundles
ALTER TABLE wood_bundles ADD COLUMN IF NOT EXISTS supplier_boards INTEGER;
ALTER TABLE wood_bundles ADD COLUMN IF NOT EXISTS supplier_volume NUMERIC;
ALTER TABLE wood_bundles ADD COLUMN IF NOT EXISTS inspection_id UUID REFERENCES sawn_inspections(id) ON DELETE SET NULL;

-- 3. RLS
ALTER TABLE sawn_inspections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "sawn_inspections_all" ON sawn_inspections FOR ALL USING (true) WITH CHECK (true);
