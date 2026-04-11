import sb from './client';

function mapTxn(r) {
  return {
    id: r.id,
    referenceCode: r.reference_code,
    gateway: r.gateway || '',
    accountNumber: r.account_number || '',
    amount: parseFloat(r.amount) || 0,
    content: r.content || '',
    description: r.description || '',
    transactionDate: r.transaction_date,
    transferType: r.transfer_type || 'in',
    code: r.code || '',
    rawData: r.raw_data,
    parsedOrderCode: r.parsed_order_code || '',
    matchedOrderId: r.matched_order_id,
    paymentRecordId: r.payment_record_id,
    matchStatus: r.match_status || 'pending',
    matchNote: r.match_note || '',
    matchedBy: r.matched_by || '',
    matchedAt: r.matched_at,
    createdAt: r.created_at,
    // joined
    orderCode: r.orders?.order_code || '',
    customerName: r.orders?.customers?.name || '',
  };
}

export async function fetchBankTransactions({ from, to, status } = {}) {
  let q = sb.from('bank_transactions')
    .select('*, orders(order_code, customers(name))')
    .order('transaction_date', { ascending: false });
  if (from) q = q.gte('transaction_date', from);
  if (to) q = q.lte('transaction_date', to);
  if (status && status !== 'all') q = q.eq('match_status', status);
  const { data, error } = await q.limit(500);
  if (error) throw new Error(error.message);
  return (data || []).map(mapTxn);
}

export async function fetchTransactionStats(dateFrom, dateTo) {
  const { data, error } = await sb.from('bank_transactions')
    .select('match_status, amount')
    .eq('transfer_type', 'in')
    .gte('transaction_date', dateFrom)
    .lte('transaction_date', dateTo);
  if (error) return { total: 0, matched: 0, unmatched: 0, overpaid: 0, totalAmount: 0 };
  const rows = data || [];
  return {
    total: rows.length,
    matched: rows.filter(r => r.match_status === 'matched' || r.match_status === 'partial' || r.match_status === 'manual').length,
    unmatched: rows.filter(r => r.match_status === 'unmatched').length,
    overpaid: rows.filter(r => r.match_status === 'overpaid').length,
    totalAmount: rows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0),
  };
}

// Kế toán match thủ công: gán GD unmatched cho đơn hàng
export async function manualMatchTransaction(txnId, orderId, matchedBy) {
  // 1. Lấy thông tin GD và đơn
  const [{ data: txn, error: te }, { data: order, error: oe }] = await Promise.all([
    sb.from('bank_transactions').select('*').eq('id', txnId).single(),
    sb.from('orders').select('id, order_code, customer_id, total_amount, deposit, debt, paid_amount').eq('id', orderId).single(),
  ]);
  if (te || !txn) return { error: 'Không tìm thấy giao dịch' };
  if (oe || !order) return { error: 'Không tìm thấy đơn hàng' };

  const toPay = parseFloat(order.total_amount) - (parseFloat(order.debt) || 0);
  const paidSoFar = parseFloat(order.paid_amount) || 0;
  const remaining = Math.max(0, toPay - paidSoFar);
  const txnAmount = parseFloat(txn.amount);

  // 2. Tạo payment_record
  const paymentAmount = Math.min(txnAmount, remaining > 0 ? remaining : txnAmount);
  const { data: pr, error: pe } = await sb.from('payment_records').insert({
    order_id: orderId, customer_id: order.customer_id,
    amount: paymentAmount, method: 'Chuyển khoản',
    discount: 0, discount_status: 'none',
    paid_at: txn.transaction_date || new Date().toISOString(),
    note: `Đối soát thủ công — GD ${txn.reference_code}`,
    paid_by: matchedBy || 'system',
  }).select('id').single();
  if (pe) return { error: pe.message };

  // 3. Xác định match_status
  let matchStatus = 'manual';
  const newPaid = paidSoFar + paymentAmount;
  const fullyPaid = newPaid >= toPay;

  if (txnAmount > remaining && remaining > 0) matchStatus = 'overpaid';

  // 4. Update bank_transactions
  await sb.from('bank_transactions').update({
    matched_order_id: orderId,
    payment_record_id: pr.id,
    parsed_order_code: order.order_code,
    match_status: matchStatus,
    matched_by: matchedBy || 'manual',
    matched_at: new Date().toISOString(),
  }).eq('id', txnId);

  // 5. Update order paid_amount + payment_status (không đổi status/order lifecycle)
  const orderUpdates = { paid_amount: newPaid };
  if (fullyPaid) {
    orderUpdates.payment_status = 'Đã thanh toán';
    orderUpdates.payment_date = new Date().toISOString();
  } else {
    const deposit = parseFloat(order.deposit) || 0;
    orderUpdates.payment_status = (deposit > 0 && newPaid <= deposit) ? 'Đã đặt cọc' : 'Còn nợ';
  }
  await sb.from('orders').update(orderUpdates).eq('id', orderId);

  // 6. Xử lý overpaid → tạo customer_credit
  if (txnAmount > remaining && remaining > 0) {
    const overAmount = txnAmount - remaining;
    await sb.from('customer_credits').insert({
      customer_id: order.customer_id,
      amount: overAmount,
      remaining: overAmount,
      source_type: 'overpaid',
      source_order_id: orderId,
      source_transaction_id: txnId,
      status: 'available',
      reason: `Dư ${overAmount.toLocaleString()}đ từ GD ${txn.reference_code}`,
      created_by: matchedBy || 'system',
    });
  }

  // 7. Deduct bundles nếu paid đủ
  if (fullyPaid) {
    const { data: items } = await sb.from('order_items').select('bundle_id,board_count,volume').eq('order_id', orderId);
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

  return { success: true, matchStatus, fullyPaid, paymentRecordId: pr.id };
}

// Bỏ qua GD (không liên quan)
export async function ignoreTransaction(txnId, note, matchedBy) {
  const { error } = await sb.from('bank_transactions').update({
    match_status: 'ignored',
    match_note: note || 'Bỏ qua',
    matched_by: matchedBy || 'manual',
    matched_at: new Date().toISOString(),
  }).eq('id', txnId);
  return error ? { error: error.message } : { success: true };
}

// Xử lý overpaid → hoàn tiền
export async function refundCredit(creditId, refundedBy) {
  const { error } = await sb.from('customer_credits').update({
    status: 'refunded',
    reason: `Đã hoàn tiền — ${refundedBy || ''}`,
  }).eq('id', creditId);
  return error ? { error: error.message } : { success: true };
}

// Phân bổ credit (tiền dư) vào đơn hàng nợ
export async function allocateCreditToOrder(creditId, orderId, amount, allocatedBy) {
  // 1. Lấy credit + order
  const [{ data: credit }, { data: order }] = await Promise.all([
    sb.from('customer_credits').select('*').eq('id', creditId).single(),
    sb.from('orders').select('id, customer_id, total_amount, debt, paid_amount').eq('id', orderId).single(),
  ]);
  if (!credit || credit.status !== 'available') return { error: 'Credit không khả dụng' };
  if (!order) return { error: 'Không tìm thấy đơn hàng' };
  const allocAmt = Math.min(parseFloat(amount), parseFloat(credit.remaining));
  if (allocAmt <= 0) return { error: 'Số tiền không hợp lệ' };

  // 2. Tạo payment_record cho đơn nợ
  const { error: pe } = await sb.from('payment_records').insert({
    order_id: orderId, customer_id: order.customer_id,
    amount: allocAmt, method: 'Tín dụng',
    discount: 0, discount_status: 'none',
    paid_at: new Date().toISOString(),
    note: `Phân bổ từ credit #${creditId}`,
    paid_by: allocatedBy || 'system',
  });
  if (pe) return { error: pe.message };

  // 3. Trừ credit
  const newRemaining = Math.max(0, parseFloat(credit.remaining) - allocAmt);
  await sb.from('customer_credits').update({
    remaining: newRemaining,
    status: newRemaining <= 0 ? 'used' : 'available',
  }).eq('id', creditId);

  // 4. Update order paid_amount + payment_status
  const newPaid = (parseFloat(order.paid_amount) || 0) + allocAmt;
  const toPay = parseFloat(order.total_amount) - (parseFloat(order.debt) || 0);
  const fullyPaid = newPaid >= toPay;
  const updates = { paid_amount: newPaid };
  if (fullyPaid) {
    updates.payment_status = 'Đã thanh toán';
    updates.payment_date = new Date().toISOString();
  } else {
    updates.payment_status = 'Còn nợ';
  }
  await sb.from('orders').update(updates).eq('id', orderId);

  return { success: true, fullyPaid, newRemaining };
}

// Lấy danh sách đơn hàng chưa thanh toán đủ (cho dialog match thủ công)
export async function fetchUnpaidOrders() {
  const { data, error } = await sb.from('orders')
    .select('id, order_code, customer_id, total_amount, deposit, debt, paid_amount, payment_status, status, customers(name)')
    .in('payment_status', ['Chưa thanh toán', 'Đã đặt cọc', 'Còn nợ'])
    .neq('status', 'Đã hủy')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) return [];
  return (data || []).map(r => ({
    id: r.id,
    orderCode: r.order_code,
    customerName: r.customers?.name || '',
    totalAmount: parseFloat(r.total_amount) || 0,
    deposit: parseFloat(r.deposit) || 0,
    debt: parseFloat(r.debt) || 0,
    paidAmount: parseFloat(r.paid_amount) || 0,
    remaining: Math.max(0, (parseFloat(r.total_amount) || 0) - (parseFloat(r.debt) || 0) - (parseFloat(r.paid_amount) || 0)),
    paymentStatus: r.payment_status,
  }));
}
