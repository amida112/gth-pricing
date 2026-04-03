import sb from './client';

// ===== CREDIT REFUNDS (Hoàn tiền) =====

function mapRefund(r) {
  return {
    id: r.id,
    creditId: r.credit_id,
    customerId: r.customer_id,
    orderId: r.order_id,
    amount: parseFloat(r.amount) || 0,
    status: r.status || 'pending',
    reason: r.reason || '',
    requestedBy: r.requested_by || '',
    approvedBy: r.approved_by || '',
    approvedAt: r.approved_at || null,
    completedBy: r.completed_by || '',
    completedAt: r.completed_at || null,
    method: r.method || '',
    rejectReason: r.reject_reason || '',
    notes: r.notes || '',
    createdAt: r.created_at,
  };
}

export async function fetchPendingRefunds() {
  const { data, error } = await sb.from('credit_refunds')
    .select('*, customers(name, phone1)')
    .eq('status', 'pending')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ ...mapRefund(r), customerName: r.customers?.name || '', customerPhone: r.customers?.phone1 || '' }));
}

export async function fetchRefundsByOrder(orderId) {
  const { data, error } = await sb.from('credit_refunds')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return (data || []).map(mapRefund);
}

export async function requestRefund({ creditId, customerId, orderId, amount, reason, requestedBy }) {
  const { data, error } = await sb.from('credit_refunds').insert({
    credit_id: creditId, customer_id: customerId, order_id: orderId,
    amount, reason, requested_by: requestedBy, status: 'pending',
  }).select().single();
  if (error) return { error: error.message };
  return { success: true, id: data.id };
}

export async function approveRefund(refundId, { approvedBy, method, notes }) {
  // Duyệt + hoàn tiền trong 1 bước
  const { data: refund, error: re } = await sb.from('credit_refunds')
    .select('credit_id, amount, status')
    .eq('id', refundId).single();
  if (re || !refund) return { error: re?.message || 'Không tìm thấy yêu cầu' };
  if (refund.status !== 'pending') return { error: 'Yêu cầu đã được xử lý' };

  // Trừ credit remaining
  const { data: credit } = await sb.from('customer_credits')
    .select('remaining').eq('id', refund.credit_id).single();
  if (credit) {
    const newRemaining = Math.max(0, (parseFloat(credit.remaining) || 0) - refund.amount);
    await sb.from('customer_credits').update({ remaining: newRemaining, ...(newRemaining <= 0 ? { status: 'used' } : {}) }).eq('id', refund.credit_id);
  }

  const { error } = await sb.from('credit_refunds').update({
    status: 'completed', approved_by: approvedBy, approved_at: new Date().toISOString(),
    completed_by: approvedBy, completed_at: new Date().toISOString(),
    method: method || null, notes: notes || null,
  }).eq('id', refundId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function rejectRefund(refundId, { approvedBy, rejectReason }) {
  const { error } = await sb.from('credit_refunds').update({
    status: 'rejected', approved_by: approvedBy, approved_at: new Date().toISOString(),
    reject_reason: rejectReason || null,
  }).eq('id', refundId);
  if (error) return { error: error.message };
  return { success: true };
}

export async function fetchPendingRefundsCount() {
  const { count, error } = await sb.from('credit_refunds')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) return 0;
  return count || 0;
}
