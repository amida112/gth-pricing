import sb from './client';

// Fetch gỗ nguyên liệu available để bán (chưa xẻ, chưa bán, không missing)
export async function fetchAvailableRawWood(containerId) {
  let q = sb.from('raw_wood_inspection')
    .select('*, containers!inner(container_code, cargo_type, weight_unit, raw_wood_type_id, ncc_id)')
    .eq('status', 'available')
    .eq('is_missing', false)
    .order('sort_order').order('id');
  if (containerId) q = q.eq('container_id', containerId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id,
    containerId: r.container_id,
    containerCode: r.containers?.container_code || '',
    cargoType: r.containers?.cargo_type || '',
    weightUnit: r.containers?.weight_unit || 'm3',
    rawWoodTypeId: r.containers?.raw_wood_type_id || null,
    nccId: r.containers?.ncc_id || null,
    pieceCode: r.piece_code || '',
    lengthM: r.length_m != null ? parseFloat(r.length_m) : null,
    diameterCm: r.diameter_cm != null ? parseFloat(r.diameter_cm) : null,
    circumferenceCm: r.circumference_cm != null ? parseFloat(r.circumference_cm) : null,
    widthCm: r.width_cm != null ? parseFloat(r.width_cm) : null,
    thicknessCm: r.thickness_cm != null ? parseFloat(r.thickness_cm) : null,
    volumeM3: r.volume_m3 != null ? parseFloat(r.volume_m3) : null,
    weightKg: r.weight_kg != null ? parseFloat(r.weight_kg) : null,
    quality: r.quality || '',
    isDamaged: r.is_damaged || false,
    saleUnitPrice: r.sale_unit_price != null ? parseFloat(r.sale_unit_price) : null,
  }));
}

// Fetch raw wood containers cho selector (with available counts + wood type name)
export async function fetchRawContainersForSale() {
  const [{ data, error }, { data: shipments }] = await Promise.all([
    sb.from('containers')
      .select('id, container_code, cargo_type, total_volume, remaining_volume, remaining_pieces, weight_unit, raw_wood_type_id, ncc_id, arrival_date, status, sale_unit_price, sale_notes, shipment_id, raw_wood_types(name, icon), container_items(piece_count)')
      .in('cargo_type', ['raw_round', 'raw_box'])
      .order('arrival_date', { ascending: false }),
    sb.from('shipments').select('id, raw_wood_type_id, raw_wood_types(name, icon)'),
  ]);
  if (error) throw new Error(error.message);
  const shipMap = Object.fromEntries((shipments || []).map(s => [s.id, s]));
  return (data || []).map(r => {
    const itemsPieceCount = (r.container_items || []).reduce((s, i) => s + (i.piece_count || 0), 0);
    const sh = r.shipment_id ? shipMap[r.shipment_id] : null;
    return {
      ...r,
      rawWoodTypeName: r.raw_wood_types?.name || sh?.raw_wood_types?.name || '',
      rawWoodTypeIcon: r.raw_wood_types?.icon || sh?.raw_wood_types?.icon || '',
      saleUnitPrice: r.sale_unit_price != null ? parseFloat(r.sale_unit_price) : null,
      saleNotes: r.sale_notes || '',
      itemsPieceCount: itemsPieceCount || null,
    };
  });
}

// Mark inspection pieces as sold khi đơn hàng thanh toán
export async function markRawWoodSold(inspectionIds, orderId) {
  if (!inspectionIds?.length) return { success: true };
  const { error } = await sb.from('raw_wood_inspection')
    .update({ status: 'sold', sale_order_id: orderId })
    .in('id', inspectionIds);
  return error ? { error: error.message } : { success: true };
}

// Hoàn trạng thái khi hủy đơn
export async function revertRawWoodSold(orderId) {
  const { error } = await sb.from('raw_wood_inspection')
    .update({ status: 'available', sale_order_id: null })
    .eq('sale_order_id', orderId);
  return error ? { error: error.message } : { success: true };
}

// Mark container as sold khi bán nguyên container
export async function markContainerSold(containerId, orderId) {
  const { error } = await sb.from('containers')
    .update({ status: 'Đã bán' })
    .eq('id', containerId);
  if (error) return { error: error.message };
  // Mark tất cả inspection pieces (nếu có) as sold
  await sb.from('raw_wood_inspection')
    .update({ status: 'sold', sale_order_id: orderId })
    .eq('container_id', containerId)
    .eq('status', 'available');
  return { success: true };
}

// Hoàn container khi hủy đơn
export async function revertContainerSold(containerId) {
  await sb.from('containers')
    .update({ status: 'Đã về' })
    .eq('id', containerId);
  await sb.from('raw_wood_inspection')
    .update({ status: 'available', sale_order_id: null })
    .eq('container_id', containerId)
    .eq('status', 'sold');
  return { success: true };
}
