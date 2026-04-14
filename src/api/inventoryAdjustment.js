import sb from './client';

// ===== INVENTORY ADJUSTMENTS (CÂN KHO / ĐIỀU CHỈNH TỒN) =====

const mapRow = (r) => ({
  id: r.id,
  bundleId: r.bundle_id,
  type: r.type,
  oldBoards: r.old_boards,
  newBoards: r.new_boards,
  oldVolume: r.old_volume != null ? parseFloat(r.old_volume) : null,
  newVolume: r.new_volume != null ? parseFloat(r.new_volume) : null,
  reason: r.reason,
  status: r.status,
  requestedBy: r.requested_by,
  requestedAt: r.requested_at,
  approvedBy: r.approved_by,
  approvedAt: r.approved_at,
  rejectionReason: r.rejection_reason,
  createdAt: r.created_at,
});

/** Lấy tất cả phiếu điều chỉnh (mới nhất trước) */
export async function fetchInventoryAdjustments() {
  const { data, error } = await sb.from('inventory_adjustments')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(error.message);
  return (data || []).map(mapRow);
}

/** Lấy phiếu điều chỉnh theo bundle */
export async function fetchAdjustmentsByBundle(bundleId) {
  const { data, error } = await sb.from('inventory_adjustments')
    .select('*')
    .eq('bundle_id', bundleId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapRow);
}

/** Đếm phiếu pending */
export async function fetchPendingAdjustmentsCount() {
  const { count, error } = await sb.from('inventory_adjustments')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) return 0;
  return count || 0;
}

/**
 * Kho tạo phiếu điều chỉnh.
 * Ràng buộc: tấm lệch ≤ 2%, volume lệch ≤ 5%
 */
export async function requestAdjustment({ bundleId, type, newBoards, newVolume, reason, requestedBy }) {
  // Lấy bundle hiện tại
  const { data: b, error: bErr } = await sb.from('wood_bundles')
    .select('board_count, remaining_boards, volume, remaining_volume')
    .eq('id', bundleId).single();
  if (bErr || !b) return { error: 'Không tìm thấy kiện: ' + (bErr?.message || '') };

  const oldBoards = b.remaining_boards;
  const oldVolume = parseFloat(b.remaining_volume);

  // Validate ràng buộc
  if (newBoards != null && b.board_count > 0) {
    const boardDiffPct = Math.abs(newBoards - oldBoards) / b.board_count * 100;
    if (boardDiffPct > 2) return { error: `Chênh lệch tấm (${boardDiffPct.toFixed(1)}%) vượt ngưỡng 2%` };
  }
  if (newVolume != null && b.volume > 0) {
    const volDiffPct = Math.abs(newVolume - oldVolume) / b.volume * 100;
    if (volDiffPct > 5) return { error: `Chênh lệch KL (${volDiffPct.toFixed(1)}%) vượt ngưỡng 5%` };
  }

  const row = {
    bundle_id: bundleId,
    type: type || 'adjust',
    old_boards: oldBoards,
    new_boards: newBoards != null ? newBoards : oldBoards,
    old_volume: oldVolume,
    new_volume: newVolume != null ? parseFloat(parseFloat(newVolume).toFixed(4)) : oldVolume,
    reason,
    status: 'pending',
    requested_by: requestedBy || null,
  };

  const { data, error } = await sb.from('inventory_adjustments').insert(row).select().single();
  if (error) return { error: error.message };
  return { success: true, item: mapRow(data) };
}

/** Sếp duyệt phiếu → apply vào bundle */
export async function approveAdjustment(id, approvedBy) {
  // Lấy phiếu
  const { data: adj, error: aErr } = await sb.from('inventory_adjustments')
    .select('*').eq('id', id).single();
  if (aErr || !adj) return { error: 'Không tìm thấy phiếu' };
  if (adj.status !== 'pending') return { error: 'Phiếu đã xử lý' };

  const now = new Date().toISOString();

  // Apply vào bundle
  const newBoards = adj.new_boards;
  const newVol = parseFloat(adj.new_volume);
  const isClosed = adj.type === 'close_bundle' || newBoards <= 0;

  const bundleUpdate = {
    remaining_boards: isClosed ? 0 : newBoards,
    remaining_volume: isClosed ? 0 : newVol,
    status: isClosed ? 'Đã bán' : (newBoards < (await getBoardCount(adj.bundle_id)) ? 'Kiện lẻ' : 'Kiện nguyên'),
  };

  const { error: bErr } = await sb.from('wood_bundles').update(bundleUpdate).eq('id', adj.bundle_id);
  if (bErr) return { error: 'Lỗi cập nhật kiện: ' + bErr.message };

  // Cập nhật phiếu
  const { error } = await sb.from('inventory_adjustments').update({
    status: 'approved', approved_by: approvedBy, approved_at: now, updated_at: now,
  }).eq('id', id);
  if (error) return { error: error.message };

  return { success: true };
}

async function getBoardCount(bundleId) {
  const { data } = await sb.from('wood_bundles').select('board_count').eq('id', bundleId).single();
  return data?.board_count || 0;
}

/** Sếp từ chối phiếu */
export async function rejectAdjustment(id, approvedBy, rejectionReason) {
  const { error } = await sb.from('inventory_adjustments').update({
    status: 'rejected',
    approved_by: approvedBy,
    approved_at: new Date().toISOString(),
    rejection_reason: rejectionReason || null,
    updated_at: new Date().toISOString(),
  }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

/** Xóa phiếu pending */
export async function deleteAdjustment(id) {
  const { error } = await sb.from('inventory_adjustments').delete().eq('id', id).eq('status', 'pending');
  return error ? { error: error.message } : { success: true };
}

/**
 * Báo cáo kiện bán lẻ hết trong tuần (thứ 2 → CN)
 * Trả về danh sách kiện có status='Đã bán' && remaining_boards=0 && updated_at trong tuần
 */
export async function fetchWeeklyClosedBundles(weekStart, weekEnd) {
  const { data, error } = await sb.from('wood_bundles')
    .select('id, bundle_code, wood_id, board_count, volume, remaining_boards, remaining_volume, supplier_boards, supplier_volume, status, updated_at')
    .eq('status', 'Đã bán')
    .gte('updated_at', weekStart)
    .lte('updated_at', weekEnd)
    .order('updated_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id,
    bundleCode: r.bundle_code,
    woodId: r.wood_id,
    boardCount: r.board_count,
    volume: parseFloat(r.volume) || 0,
    remainingBoards: r.remaining_boards,
    remainingVolume: parseFloat(r.remaining_volume) || 0,
    supplierBoards: r.supplier_boards,
    supplierVolume: r.supplier_volume != null ? parseFloat(r.supplier_volume) : null,
    status: r.status,
    updatedAt: r.updated_at,
  }));
}

/**
 * Lấy tổng số tấm/volume thực bán từ các đơn hàng cho 1 bundle
 */
export async function fetchBundleSalesHistory(bundleId) {
  const { data, error } = await sb.from('order_items')
    .select('id, order_id, board_count, volume, orders(created_at)')
    .eq('bundle_id', bundleId);
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id,
    orderId: r.order_id,
    boardCount: r.board_count || 0,
    volume: parseFloat(r.volume) || 0,
    createdAt: r.orders?.created_at,
  })).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
}

/**
 * Lấy lịch sử bán hàng đầy đủ cho 1 bundle (bao gồm kiện soạn lẻ cùng mã).
 * Tách query: order_items → lấy order_ids → fetch orders + customers riêng.
 */
export async function fetchBundleSalesHistoryFull(bundleId, bundleCode) {
  // Query 1: order_items cho bundle này
  const { data: d1, error: e1 } = await sb.from('order_items')
    .select('id, order_id, bundle_id, bundle_code, board_count, volume, unit_price, amount')
    .eq('bundle_id', bundleId);
  if (e1) throw new Error(e1.message);

  // Query 2: order_items cho kiện soạn lẻ cùng mã
  let d2 = [];
  if (bundleCode) {
    const { data, error } = await sb.from('order_items')
      .select('id, order_id, bundle_id, bundle_code, board_count, volume, unit_price, amount')
      .like('bundle_code', `${bundleCode}%`)
      .neq('bundle_id', bundleId);
    if (!error) d2 = data || [];
  }

  const allItems = [...(d1 || []), ...d2];
  if (!allItems.length) return [];

  // Fetch orders + customers cho các order_ids liên quan
  const orderIds = [...new Set(allItems.map(r => r.order_id).filter(Boolean))];
  const { data: orders } = await sb.from('orders')
    .select('id, order_code, status, payment_status, total_amount, created_at, sales_by, customer_id, customers(name, salutation, customer_type)')
    .in('id', orderIds);
  const orderMap = {};
  (orders || []).forEach(o => { orderMap[o.id] = o; });

  return allItems.map(r => {
    const o = orderMap[r.order_id];
    const c = o?.customers;
    const isSibling = r.bundle_id !== bundleId;
    return {
      id: r.id,
      orderId: r.order_id,
      bundleId: r.bundle_id,
      bundleCode: r.bundle_code,
      orderCode: o?.order_code || '',
      customerName: c ? `${c.salutation ? c.salutation + ' ' : ''}${c.name}` : '',
      boardCount: r.board_count || 0,
      volume: parseFloat(r.volume) || 0,
      unitPrice: r.unit_price || 0,
      amount: r.amount || 0,
      orderStatus: o?.status || '',
      paymentStatus: o?.payment_status || '',
      totalAmount: o?.total_amount || 0,
      salesBy: o?.sales_by || '',
      createdAt: o?.created_at,
      isSibling,
    };
  }).filter(x => x.orderStatus !== 'Đã hủy')
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
