-- =============================================
-- Migration: Bank Reconciliation (Sepay)
-- Đã chạy: 2026-03-29
-- FK: orders.id = INTEGER, customers.id = INTEGER, payment_records.id = UUID
-- =============================================

-- 1. Bảng tài khoản ngân hàng
CREATE TABLE IF NOT EXISTS bank_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  bin TEXT NOT NULL,                       -- Mã BIN ngân hàng (VietQR)
  is_default BOOLEAN DEFAULT false,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_accounts_default
  ON bank_accounts (is_default) WHERE is_default = true;

-- 2. Bảng giao dịch ngân hàng (Sepay webhook)
CREATE TABLE IF NOT EXISTS bank_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_code TEXT UNIQUE NOT NULL,
  gateway TEXT,
  account_number TEXT,
  amount NUMERIC NOT NULL,
  content TEXT,
  description TEXT,
  transaction_date TIMESTAMPTZ,
  transfer_type TEXT DEFAULT 'in',
  code TEXT,
  raw_data JSONB,

  parsed_order_code TEXT,
  matched_order_id INTEGER REFERENCES orders(id),
  payment_record_id UUID REFERENCES payment_records(id),
  match_status TEXT NOT NULL DEFAULT 'pending',
  match_note TEXT,
  matched_by TEXT,
  matched_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bank_txn_order ON bank_transactions(matched_order_id);
CREATE INDEX IF NOT EXISTS idx_bank_txn_status ON bank_transactions(match_status);
CREATE INDEX IF NOT EXISTS idx_bank_txn_date ON bank_transactions(transaction_date DESC);

-- 3. Thêm paid_amount vào orders
ALTER TABLE orders ADD COLUMN IF NOT EXISTS paid_amount NUMERIC DEFAULT 0;

-- 4. Mở rộng customer_credits (bảng đã tồn tại)
ALTER TABLE customer_credits ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'cancelled_order';
ALTER TABLE customer_credits ADD COLUMN IF NOT EXISTS source_transaction_id UUID REFERENCES bank_transactions(id);
ALTER TABLE customer_credits ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'available';
ALTER TABLE customer_credits ADD COLUMN IF NOT EXISTS created_by TEXT;

-- 5. Seed tài khoản VP Bank mặc định
INSERT INTO bank_accounts (bank_name, account_number, account_name, bin, is_default)
SELECT 'VPBank', '___CẦN_CẬP_NHẬT___', '___CẦN_CẬP_NHẬT___', '970432', true
WHERE NOT EXISTS (SELECT 1 FROM bank_accounts LIMIT 1);
