-- ================================================================
-- Migration: Tạo bảng payment_records để theo dõi thu tiền từng đơn
-- An toàn khi chạy lại nhiều lần (idempotent)
-- Chạy trong Supabase SQL Editor
-- ================================================================

-- 1. Tạo bảng nếu chưa có
CREATE TABLE IF NOT EXISTS payment_records (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id         INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  customer_id      INTEGER,
  amount           NUMERIC(15,0) NOT NULL,
  method           TEXT NOT NULL DEFAULT 'Tiền mặt',
  paid_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  note             TEXT,
  paid_by          TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Thêm cột discount nếu chưa có (an toàn khi chạy lại)
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS discount        NUMERIC(15,0) NOT NULL DEFAULT 0;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS discount_note   TEXT;
ALTER TABLE payment_records ADD COLUMN IF NOT EXISTS discount_status TEXT NOT NULL DEFAULT 'none';

-- 3. Index
CREATE INDEX IF NOT EXISTS idx_payment_records_order_id    ON payment_records(order_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_customer_id ON payment_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_records_paid_at     ON payment_records(paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_records_disc_status ON payment_records(discount_status);

-- 4. Backfill: tạo payment_record cho các đơn đã thanh toán (tùy chọn)
-- INSERT INTO payment_records (order_id, customer_id, amount, method, paid_at, note)
-- SELECT o.id, o.customer_id,
--   (o.total_amount - COALESCE(o.deposit,0) - COALESCE(o.debt,0)),
--   'Tiền mặt', COALESCE(o.payment_date, o.created_at), 'Backfill từ đơn cũ'
-- FROM orders o
-- WHERE o.payment_status = 'Đã thanh toán'
--   AND NOT EXISTS (SELECT 1 FROM payment_records pr WHERE pr.order_id = o.id);
