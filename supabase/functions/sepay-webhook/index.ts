// Supabase Edge Function: Sepay Webhook
// Nhận giao dịch ngân hàng từ Sepay → đối soát tự động với đơn hàng

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const SEPAY_API_KEY = Deno.env.get('SEPAY_API_KEY') || '';

// Tolerance: chênh lệch ±1000đ vẫn coi là đủ
const TOLERANCE = 1000;

function parseOrderCode(text: string): string | null {
  if (!text) return null;
  // Nội dung CK có thể bị ngân hàng chuẩn hóa:
  // "DH-20260329-001" → "DH 20260329 001" hoặc "DH20260329001"
  const m = text.match(/DH[- ]?(\d{8})[- ]?(\d{3})/i);
  return m ? `DH-${m[1]}-${m[2]}` : null;
}

Deno.serve(async (req: Request) => {
  // Chỉ chấp nhận POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ success: false, message: 'Method not allowed' }), { status: 405 });
  }

  // Verify API Key
  if (SEPAY_API_KEY) {
    const authHeader = req.headers.get('Authorization') || '';
    const key = authHeader.replace(/^Apikey\s+/i, '').trim();
    if (key !== SEPAY_API_KEY) {
      return new Response(JSON.stringify({ success: false, message: 'Unauthorized' }), { status: 401 });
    }
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ success: false, message: 'Invalid JSON' }), { status: 400 });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const {
    id: sepayId,
    gateway,
    transactionDate: rawTxnDate,
    accountNumber,
    transferType,
    transferAmount,
    accumulated,
    code,
    content,
    referenceCode,
    description,
  } = body;

  // Sepay gửi transactionDate dạng "2026-03-30 15:26:00" — giờ Việt Nam nhưng không có offset
  // Thêm +07:00 để Postgres hiểu đúng timezone
  const transactionDate = rawTxnDate && !rawTxnDate.includes('+') && !rawTxnDate.endsWith('Z')
    ? rawTxnDate.replace(' ', 'T') + '+07:00'
    : rawTxnDate || null;

  // Require referenceCode
  if (!referenceCode) {
    return new Response(JSON.stringify({ success: false, message: 'Missing referenceCode' }), { status: 400 });
  }

  // Chỉ xử lý tiền VÀO
  if (transferType !== 'in') {
    // Lưu GD tiền ra nhưng mark ignored
    await sb.from('bank_transactions').upsert({
      reference_code: referenceCode,
      gateway, account_number: accountNumber,
      amount: transferAmount || 0,
      content, description,
      transaction_date: transactionDate || new Date().toISOString(),
      transfer_type: transferType || 'out',
      code, raw_data: body,
      match_status: 'ignored',
      match_note: 'Giao dịch tiền ra',
    }, { onConflict: 'reference_code', ignoreDuplicates: true });
    return new Response(JSON.stringify({ success: true }));
  }

  // UPSERT — nếu đã tồn tại (Sepay retry) → skip
  const parsedCode = parseOrderCode(content || '') || parseOrderCode(description || '');
  const txnRow: any = {
    reference_code: referenceCode,
    gateway, account_number: accountNumber,
    amount: transferAmount || 0,
    content, description,
    transaction_date: transactionDate || new Date().toISOString(),
    transfer_type: 'in',
    code, raw_data: body,
    parsed_order_code: parsedCode,
    match_status: 'pending',
  };

  const { data: inserted, error: insertErr } = await sb.from('bank_transactions')
    .upsert(txnRow, { onConflict: 'reference_code', ignoreDuplicates: true })
    .select('id, match_status')
    .single();

  // Nếu đã tồn tại (duplicate) → return OK
  if (insertErr || !inserted) {
    return new Response(JSON.stringify({ success: true, message: 'Duplicate or insert error' }));
  }

  // Nếu match_status không phải pending (đã xử lý trước đó) → skip
  if (inserted.match_status !== 'pending') {
    return new Response(JSON.stringify({ success: true, message: 'Already processed' }));
  }

  const txnId = inserted.id;
  const amount = parseFloat(transferAmount) || 0;

  // Không parse được mã đơn → unmatched
  if (!parsedCode) {
    await sb.from('bank_transactions').update({
      match_status: 'unmatched',
      match_note: 'Không tìm thấy mã đơn hàng trong nội dung CK',
    }).eq('id', txnId);
    return new Response(JSON.stringify({ success: true, matchStatus: 'unmatched' }));
  }

  // Tìm đơn hàng
  const { data: order } = await sb.from('orders')
    .select('id, customer_id, total_amount, deposit, debt, paid_amount, payment_status')
    .eq('order_code', parsedCode)
    .single();

  if (!order) {
    await sb.from('bank_transactions').update({
      match_status: 'unmatched',
      match_note: `Mã ${parsedCode} không tồn tại trong hệ thống`,
    }).eq('id', txnId);
    return new Response(JSON.stringify({ success: true, matchStatus: 'unmatched' }));
  }

  // Đơn đã hủy → unmatched
  if (order.payment_status === 'Đã hủy') {
    await sb.from('bank_transactions').update({
      matched_order_id: order.id,
      match_status: 'unmatched',
      match_note: `Đơn ${parsedCode} đã hủy`,
    }).eq('id', txnId);
    return new Response(JSON.stringify({ success: true, matchStatus: 'unmatched' }));
  }

  // Tính remaining
  const deposit = parseFloat(order.deposit) || 0;
  const toPay = parseFloat(order.total_amount) - (parseFloat(order.debt) || 0);
  const paidSoFar = parseFloat(order.paid_amount) || 0;
  const remaining = Math.max(0, toPay - paidSoFar);

  // Đã thanh toán đủ rồi → overpaid
  if (remaining <= 0) {
    await sb.from('bank_transactions').update({
      matched_order_id: order.id,
      match_status: 'overpaid',
      match_note: `Đơn đã thanh toán đủ trước đó. GD ${amount.toLocaleString()}đ cần xử lý thủ công.`,
      matched_by: 'auto',
      matched_at: new Date().toISOString(),
    }).eq('id', txnId);
    // Tạo credit cho khách
    await sb.from('customer_credits').insert({
      customer_id: order.customer_id,
      amount,
      source_type: 'overpaid',
      source_order_id: order.id,
      source_transaction_id: txnId,
      status: 'available',
      remaining: amount,
      reason: `Dư ${amount.toLocaleString()}đ từ GD ${referenceCode} — đơn ${parsedCode} đã thanh toán đủ`,
      created_by: 'auto',
    });
    return new Response(JSON.stringify({ success: true, matchStatus: 'overpaid' }));
  }

  // Tạo payment_record
  const paymentAmount = Math.min(amount, remaining);
  const { data: pr, error: prErr } = await sb.from('payment_records').insert({
    order_id: order.id,
    customer_id: order.customer_id,
    amount: paymentAmount,
    method: 'Chuyển khoản',
    discount: 0, discount_status: 'none',
    paid_at: transactionDate || new Date().toISOString(),
    note: `Auto — Sepay ${referenceCode}`,
    paid_by: 'sepay',
  }).select('id').single();

  if (prErr || !pr) {
    await sb.from('bank_transactions').update({
      matched_order_id: order.id,
      match_status: 'unmatched',
      match_note: `Lỗi tạo payment: ${prErr?.message || 'unknown'}`,
    }).eq('id', txnId);
    return new Response(JSON.stringify({ success: true, matchStatus: 'error' }));
  }

  // Xác định trạng thái
  const newPaid = paidSoFar + paymentAmount;
  const fullyPaid = (remaining - amount) <= TOLERANCE;
  const isOverpaid = amount > remaining + TOLERANCE;

  let matchStatus = fullyPaid ? 'matched' : 'partial';
  if (isOverpaid) matchStatus = 'overpaid';

  // Update transaction
  await sb.from('bank_transactions').update({
    matched_order_id: order.id,
    payment_record_id: pr.id,
    match_status: matchStatus,
    matched_by: 'auto',
    matched_at: new Date().toISOString(),
    match_note: isOverpaid ? `Dư ${(amount - remaining).toLocaleString()}đ` : null,
  }).eq('id', txnId);

  // Update order
  const orderUpdates: any = { paid_amount: newPaid };
  if (fullyPaid || isOverpaid) {
    orderUpdates.payment_status = 'Đã thanh toán';
    orderUpdates.payment_date = new Date().toISOString();
    orderUpdates.status = 'Đã thanh toán';
  } else {
    orderUpdates.payment_status = (deposit > 0 && newPaid <= deposit) ? 'Đã đặt cọc' : 'Còn nợ';
  }
  await sb.from('orders').update(orderUpdates).eq('id', order.id);

  // Deduct bundles nếu fully paid
  if (fullyPaid || isOverpaid) {
    const { data: items } = await sb.from('order_items').select('bundle_id,board_count,volume').eq('order_id', order.id);
    for (const it of (items || [])) {
      if (!it.bundle_id) continue;
      const { data: b } = await sb.from('wood_bundles').select('remaining_boards,remaining_volume').eq('id', it.bundle_id).single();
      if (!b) continue;
      const newBoards = Math.max(0, (b.remaining_boards || 0) - (it.board_count || 0));
      const rawNewVol = parseFloat(b.remaining_volume || 0) - parseFloat(it.volume || 0);
      const isClosed = newBoards <= 0;
      await sb.from('wood_bundles').update({
        remaining_boards: newBoards,
        remaining_volume: isClosed ? 0 : parseFloat(rawNewVol.toFixed(4)),
        status: isClosed ? 'Đã bán' : 'Kiện lẻ',
        ...(isClosed ? { volume_adjustment: parseFloat(rawNewVol.toFixed(4)) } : {}),
      }).eq('id', it.bundle_id);
    }
  }

  // Tạo credit cho phần dư nếu overpaid
  if (isOverpaid) {
    const overAmount = amount - remaining;
    await sb.from('customer_credits').insert({
      customer_id: order.customer_id,
      amount: overAmount,
      source_type: 'overpaid',
      source_order_id: order.id,
      source_transaction_id: txnId,
      status: 'available',
      remaining: overAmount,
      reason: `Dư ${overAmount.toLocaleString()}đ từ GD ${referenceCode}`,
      created_by: 'auto',
    });
  }

  return new Response(JSON.stringify({
    success: true,
    matchStatus,
    orderCode: parsedCode,
    amount,
    remaining: Math.max(0, remaining - amount),
  }));
});
