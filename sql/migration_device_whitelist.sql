-- Migration: Device Whitelist & Settings
-- Bảo mật thiết bị — chỉ cho phép đăng nhập từ thiết bị được duyệt

-- ===== DEVICE WHITELIST =====
CREATE TABLE IF NOT EXISTS device_whitelist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  device_name TEXT DEFAULT '',
  user_agent TEXT,
  ip_address TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | blocked
  approved_by TEXT,
  approved_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  notes TEXT DEFAULT '',
  UNIQUE(username, fingerprint)
);

CREATE INDEX IF NOT EXISTS idx_device_wl_username ON device_whitelist(username);
CREATE INDEX IF NOT EXISTS idx_device_wl_status ON device_whitelist(status);

ALTER TABLE device_whitelist ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on device_whitelist" ON device_whitelist FOR ALL USING (true) WITH CHECK (true);

-- ===== DEVICE SETTINGS =====
CREATE TABLE IF NOT EXISTS device_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now(),
  updated_by TEXT
);

INSERT INTO device_settings (key, value) VALUES
  ('device_restriction_enabled', 'false'),
  ('max_devices_per_user', '3')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE device_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all on device_settings" ON device_settings FOR ALL USING (true) WITH CHECK (true);
