-- ============================================================
-- Migration: Module Cài đặt & Quản trị
-- Bảng: permission_groups, group_permissions, audit_logs
-- Cập nhật: users (thêm cột)
-- ============================================================

-- 1. BẢNG NHÓM QUYỀN (Permission Groups)
CREATE TABLE IF NOT EXISTS permission_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT UNIQUE NOT NULL,              -- 'admin', 'kho', 'banhang', 'ketoan', 'custom_xxx'
  name TEXT NOT NULL,                     -- 'Quản trị viên', 'Thủ kho'...
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '🔐',                 -- emoji icon
  color TEXT DEFAULT '#666',              -- hex color cho badge
  is_system BOOLEAN DEFAULT false,        -- nhóm gốc không xóa được
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed 4 nhóm quyền mặc định
INSERT INTO permission_groups (code, name, description, icon, color, is_system) VALUES
  ('admin',   'Quản trị viên', 'Toàn quyền quản lý hệ thống',         '🔑', '#327F27', true),
  ('banhang', 'Bán hàng',      'Quản lý đơn hàng, khách hàng',         '🛒', '#7C5CBF', true),
  ('kho',     'Thủ kho',       'Quản lý kho, nhập hàng, xẻ gỗ, sấy',   '🏪', '#F26522', true),
  ('ketoan',  'Kế toán',       'Đối soát thanh toán, xem đơn hàng',     '📊', '#2980B9', true)
ON CONFLICT (code) DO NOTHING;

-- 2. BẢNG PHÂN QUYỀN CHI TIẾT (Group Permissions)
CREATE TABLE IF NOT EXISTS group_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES permission_groups(id) ON DELETE CASCADE,
  permission_key TEXT NOT NULL,           -- 'sales.create', 'warehouse.edit', 'pricing.see_cost'
  granted BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, permission_key)
);

-- 3. CẬP NHẬT BẢNG USERS (thêm cột mới)
ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS permission_group_id UUID REFERENCES permission_groups(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_ip TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS notes TEXT;

-- 4. BẢNG NHẬT KÝ HỆ THỐNG (Audit Logs)
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID,                           -- nullable (user hệ thống)
  username TEXT NOT NULL,
  module TEXT NOT NULL,                   -- 'sales', 'warehouse', 'pricing', 'auth'...
  action TEXT NOT NULL,                   -- 'create', 'update', 'delete', 'login', 'logout'
  description TEXT NOT NULL,              -- 'Tạo đơn hàng DH-20260330-001'
  entity_type TEXT,                       -- 'order', 'bundle', 'user'
  entity_id TEXT,                         -- ID của record bị ảnh hưởng
  old_data JSONB,                         -- snapshot dữ liệu trước thay đổi
  new_data JSONB,                         -- snapshot dữ liệu sau thay đổi
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Indexes cho audit_logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_username ON audit_logs(username);
CREATE INDEX IF NOT EXISTS idx_audit_logs_module ON audit_logs(module);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- 5. RLS Policies (nếu cần)
-- Cho phép đọc/ghi từ authenticated users (anon key đang dùng)
ALTER TABLE permission_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy cho phép tất cả thao tác (vì auth là client-side)
CREATE POLICY "Allow all on permission_groups" ON permission_groups FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on group_permissions" ON group_permissions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on audit_logs" ON audit_logs FOR ALL USING (true) WITH CHECK (true);

-- 6. Seed quyền mặc định cho 4 nhóm gốc
-- Admin: full quyền
INSERT INTO group_permissions (group_id, permission_key, granted)
SELECT pg.id, perm.key, true
FROM permission_groups pg
CROSS JOIN (VALUES
  ('pricing.view'), ('pricing.edit'), ('pricing.see_cost'), ('pricing.view_log'),
  ('sales.view'), ('sales.create'), ('sales.edit'), ('sales.delete'), ('sales.approve_price'), ('sales.record_payment'), ('sales.export'),
  ('customers.view'), ('customers.create'), ('customers.edit'), ('customers.delete'), ('customers.view_debt'),
  ('warehouse.view'), ('warehouse.create'), ('warehouse.edit'), ('warehouse.delete'), ('warehouse.change_status'),
  ('raw_wood.view'), ('raw_wood.create'), ('raw_wood.edit'), ('raw_wood.delete'), ('raw_wood.pricing'), ('raw_wood.sell'),
  ('sawing.view'), ('sawing.create'), ('sawing.edit'), ('sawing.delete'),
  ('kiln.view'), ('kiln.create'), ('kiln.edit'), ('kiln.delete'),
  ('suppliers.view'), ('suppliers.create'), ('suppliers.edit'), ('suppliers.delete'),
  ('containers.view'), ('containers.create'), ('containers.edit'), ('containers.delete'), ('containers.inspect'),
  ('shipments.view'), ('shipments.create'), ('shipments.edit'), ('shipments.delete'),
  ('carriers.view'), ('carriers.create'), ('carriers.edit'), ('carriers.delete'),
  ('reconciliation.view'), ('reconciliation.match'), ('reconciliation.refund'),
  ('config.wood_types'), ('config.attributes'), ('config.wood_config'), ('config.sku'),
  ('admin.users'), ('admin.groups'), ('admin.permissions'), ('admin.logs'),
  ('dashboard.view')
) AS perm(key)
WHERE pg.code = 'admin'
ON CONFLICT (group_id, permission_key) DO NOTHING;

-- Bán hàng
INSERT INTO group_permissions (group_id, permission_key, granted)
SELECT pg.id, perm.key, true
FROM permission_groups pg
CROSS JOIN (VALUES
  ('pricing.view'),
  ('sales.view'), ('sales.create'), ('sales.edit'), ('sales.record_payment'), ('sales.export'),
  ('customers.view'), ('customers.create'), ('customers.edit'), ('customers.view_debt'),
  ('carriers.view'), ('carriers.create'),
  ('raw_wood.sell'),
  ('dashboard.view')
) AS perm(key)
WHERE pg.code = 'banhang'
ON CONFLICT (group_id, permission_key) DO NOTHING;

-- Thủ kho
INSERT INTO group_permissions (group_id, permission_key, granted)
SELECT pg.id, perm.key, true
FROM permission_groups pg
CROSS JOIN (VALUES
  ('warehouse.view'), ('warehouse.create'), ('warehouse.edit'), ('warehouse.change_status'),
  ('raw_wood.view'), ('raw_wood.create'), ('raw_wood.edit'),
  ('sawing.view'), ('sawing.create'), ('sawing.edit'),
  ('kiln.view'), ('kiln.create'), ('kiln.edit'),
  ('suppliers.view'), ('suppliers.create'),
  ('containers.view'), ('containers.create'), ('containers.edit'), ('containers.inspect'),
  ('shipments.view'), ('shipments.create'), ('shipments.edit'),
  ('sales.view'),
  ('dashboard.view')
) AS perm(key)
WHERE pg.code = 'kho'
ON CONFLICT (group_id, permission_key) DO NOTHING;

-- Kế toán
INSERT INTO group_permissions (group_id, permission_key, granted)
SELECT pg.id, perm.key, true
FROM permission_groups pg
CROSS JOIN (VALUES
  ('reconciliation.view'), ('reconciliation.match'),
  ('sales.view'), ('sales.record_payment'),
  ('customers.view'), ('customers.view_debt'),
  ('dashboard.view')
) AS perm(key)
WHERE pg.code = 'ketoan'
ON CONFLICT (group_id, permission_key) DO NOTHING;
