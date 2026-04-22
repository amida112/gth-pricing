-- Migration: Cân kho / Điều chỉnh tồn kho
-- Chạy trên cả staging (tscddgjkelnmlitzcxyg) và production (kpwyzwttmlzyojuxihto)

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bundle_id INTEGER NOT NULL REFERENCES wood_bundles(id) ON DELETE CASCADE,

  -- Loại điều chỉnh
  type TEXT NOT NULL DEFAULT 'adjust',  -- 'adjust' | 'close_bundle'

  -- Giá trị trước/sau
  old_boards INTEGER,
  new_boards INTEGER,
  old_volume NUMERIC,
  new_volume NUMERIC,

  -- Lý do & nội dung kiểm tra
  reason TEXT NOT NULL,

  -- Workflow: kho đề xuất → sếp duyệt
  status TEXT DEFAULT 'pending',  -- 'pending' | 'approved' | 'rejected'
  requested_by TEXT,
  requested_at TIMESTAMPTZ DEFAULT now(),
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  rejection_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_inv_adj_bundle ON inventory_adjustments(bundle_id);
CREATE INDEX IF NOT EXISTS idx_inv_adj_status ON inventory_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_inv_adj_requested ON inventory_adjustments(requested_at);

-- RLS
ALTER TABLE inventory_adjustments ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='inventory_adjustments' AND policyname='inv_adj_all') THEN
    CREATE POLICY "inv_adj_all" ON inventory_adjustments FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
