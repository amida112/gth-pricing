import sb from './client';

function mapWithdrawal(r) {
  return {
    id: r.id,
    containerId: r.container_id,
    type: r.type,
    pieceCount: r.piece_count || 0,
    weightKg: r.weight_kg != null ? parseFloat(r.weight_kg) : null,
    unit: r.unit || 'ton',
    unitPrice: r.unit_price != null ? parseFloat(r.unit_price) : null,
    amount: r.amount != null ? parseFloat(r.amount) : null,
    orderId: r.order_id || null,
    sawingBatchId: r.sawing_batch_id || null,
    notes: r.notes || '',
    createdBy: r.created_by || '',
    createdAt: r.created_at,
  };
}

// Fetch withdrawals cho 1 container
export async function fetchWithdrawals(containerId) {
  const { data, error } = await sb.from('raw_wood_withdrawals')
    .select('*')
    .eq('container_id', containerId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapWithdrawal);
}

// Tạo withdrawal (bán lẻ theo cân)
export async function createSaleWithdrawal({ containerId, pieceCount, weightKg, unit, unitPrice, amount, orderId, notes, createdBy }) {
  // 1. Insert withdrawal
  const { data, error } = await sb.from('raw_wood_withdrawals').insert({
    container_id: containerId,
    type: 'sale',
    piece_count: pieceCount || 0,
    weight_kg: weightKg || 0,
    unit: unit || 'ton',
    unit_price: unitPrice || 0,
    amount: amount || 0,
    order_id: orderId || null,
    notes: notes || null,
    created_by: createdBy || null,
  }).select().single();
  if (error) return { error: error.message };

  // 2. Giảm remaining trên container
  const weightTon = (weightKg || 0) / 1000;
  await sb.rpc('decrement_container_remaining', {
    p_container_id: containerId,
    p_pieces: pieceCount || 0,
    p_volume: weightTon,
  }).catch(() => {
    // Fallback nếu RPC chưa tồn tại: update trực tiếp
    return updateContainerRemaining(containerId, -(pieceCount || 0), -weightTon);
  });

  return { success: true, withdrawal: mapWithdrawal(data) };
}

// Tạo withdrawal (xẻ)
export async function createSawingWithdrawal({ containerId, pieceCount, weightKg, sawingBatchId, notes, createdBy }) {
  const { data, error } = await sb.from('raw_wood_withdrawals').insert({
    container_id: containerId,
    type: 'sawing',
    piece_count: pieceCount || 0,
    weight_kg: weightKg || 0,
    unit: 'ton',
    sawing_batch_id: sawingBatchId || null,
    notes: notes || null,
    created_by: createdBy || null,
  }).select().single();
  if (error) return { error: error.message };

  const weightTon = (weightKg || 0) / 1000;
  await updateContainerRemaining(containerId, -(pieceCount || 0), -weightTon);

  return { success: true, withdrawal: mapWithdrawal(data) };
}

// Revert withdrawal (hủy đơn / hoàn trả)
export async function revertWithdrawal(withdrawalId) {
  const { data: w, error: fe } = await sb.from('raw_wood_withdrawals')
    .select('*').eq('id', withdrawalId).single();
  if (fe || !w) return { error: 'Không tìm thấy withdrawal' };

  const weightTon = (parseFloat(w.weight_kg) || 0) / 1000;
  await updateContainerRemaining(w.container_id, w.piece_count || 0, weightTon);

  const { error } = await sb.from('raw_wood_withdrawals').delete().eq('id', withdrawalId);
  return error ? { error: error.message } : { success: true };
}

// Revert tất cả withdrawals của 1 order (khi hủy đơn)
export async function revertOrderWithdrawals(orderId) {
  const { data: ws, error: fe } = await sb.from('raw_wood_withdrawals')
    .select('*').eq('order_id', orderId);
  if (fe) return { error: fe.message };
  for (const w of (ws || [])) {
    const weightTon = (parseFloat(w.weight_kg) || 0) / 1000;
    await updateContainerRemaining(w.container_id, w.piece_count || 0, weightTon);
  }
  await sb.from('raw_wood_withdrawals').delete().eq('order_id', orderId);
  return { success: true, count: (ws || []).length };
}

// Fetch containers có remaining > 0 cho bán lẻ theo cân
export async function fetchContainersForWeightSale() {
  const { data, error } = await sb.from('containers')
    .select('id, container_code, cargo_type, total_volume, remaining_volume, remaining_pieces, weight_unit, raw_wood_type_id, ncc_id, status, sale_unit_price, raw_wood_types(name, icon)')
    .in('cargo_type', ['raw_round', 'raw_box'])
    .not('status', 'eq', 'Đã bán')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id,
    containerCode: r.container_code,
    cargoType: r.cargo_type,
    totalVolume: parseFloat(r.total_volume) || 0,
    remainingVolume: r.remaining_volume != null ? parseFloat(r.remaining_volume) : parseFloat(r.total_volume) || 0,
    remainingPieces: r.remaining_pieces,
    weightUnit: r.weight_unit || 'm3',
    rawWoodTypeId: r.raw_wood_type_id,
    nccId: r.ncc_id,
    status: r.status,
    saleUnitPrice: r.sale_unit_price != null ? parseFloat(r.sale_unit_price) : null,
    rawWoodTypeName: r.raw_wood_types?.name || '',
    rawWoodTypeIcon: r.raw_wood_types?.icon || '',
  }));
}

// Helper: update remaining trên container
async function updateContainerRemaining(containerId, deltaPieces, deltaVolume) {
  const { data: c } = await sb.from('containers')
    .select('remaining_volume, remaining_pieces, total_volume')
    .eq('id', containerId).single();
  if (!c) return;
  const curVol = c.remaining_volume != null ? parseFloat(c.remaining_volume) : parseFloat(c.total_volume) || 0;
  const curPcs = c.remaining_pieces != null ? c.remaining_pieces : null;
  const newVol = Math.max(0, parseFloat((curVol + deltaVolume).toFixed(4)));
  const newPcs = curPcs != null ? Math.max(0, curPcs + deltaPieces) : null;
  const updates = { remaining_volume: newVol };
  if (newPcs != null) updates.remaining_pieces = newPcs;
  // Auto-set status 'Đã hết' khi remaining = 0
  if (newVol <= 0 && (newPcs == null || newPcs <= 0)) updates.status = 'Đã hết';
  await sb.from('containers').update(updates).eq('id', containerId);
}
