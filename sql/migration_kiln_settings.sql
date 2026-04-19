-- Migration: Bảng cấu hình lò sấy (giá sấy, ...)
-- Staging: tscddgjkelnmlitzcxyg

CREATE TABLE IF NOT EXISTS kiln_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);

INSERT INTO kiln_settings (key, value) VALUES ('drying_price', '70000')
ON CONFLICT (key) DO NOTHING;

COMMENT ON TABLE kiln_settings IS 'Cấu hình lò sấy: giá sấy (đ/m³/ngày), etc.';
