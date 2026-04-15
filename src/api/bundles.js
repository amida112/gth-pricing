import sb from './client';

// ===== WOOD BUNDLES (GỖ KIỆN) =====

export function mapBundleRow(r) {
  return {
    id: r.id,
    bundleCode: r.bundle_code,
    woodId: r.wood_id,
    containerId: r.container_id,
    skuKey: r.sku_key,
    attributes: r.attributes || {},
    boardCount: r.board_count || 0,
    remainingBoards: r.remaining_boards != null ? r.remaining_boards : (r.board_count || 0),
    volume: r.volume != null ? parseFloat(r.volume) : 0,
    remainingVolume: r.remaining_volume != null ? parseFloat(r.remaining_volume) : 0,
    status: r.status || 'Kiện nguyên',
    notes: r.notes || '',
    location: r.location || '',
    qrCode: r.qr_code || r.bundle_code,
    images: r.images || [],
    itemListImages: r.item_list_images || [],
    rawMeasurements: r.raw_measurements || {},
    manualGroupAssignment: r.manual_group_assignment || false,
    createdAt: r.created_at,
    lockedBy: r.locked_by || null,
    lockedAt: r.locked_at || null,
    unitPrice: r.unit_price != null ? parseFloat(r.unit_price) : null,
    priceAdjustment: r.price_adjustment || null, // { type: 'percent'|'absolute', value: number, reason: string }
    priceAttrsOverride: r.price_attrs_override || null, // { attrId: overrideValue, ... }
    priceOverrideReason: r.price_override_reason || '',
    volumeAdjustment: r.volume_adjustment != null ? parseFloat(r.volume_adjustment) : null,
    packingSessionId: r.packing_session_id || null,
    edgingBatchId: r.edging_batch_id || null,
    supplierBoards: r.supplier_boards != null ? r.supplier_boards : null,
    supplierVolume: r.supplier_volume != null ? parseFloat(r.supplier_volume) : null,
    inspectionId: r.inspection_id || null,
    measuredBy: r.measured_by || [],
  };
}

// V-21: Bundle soft lock để tránh bán trùng
export async function lockBundle(bundleId, lockedBy) {
  const { error } = await sb.from('wood_bundles')
    .update({ locked_by: lockedBy, locked_at: new Date().toISOString() })
    .eq('id', bundleId);
  return error ? { error: error.message } : { success: true };
}

export async function unlockBundle(bundleId) {
  const { error } = await sb.from('wood_bundles')
    .update({ locked_by: null, locked_at: null })
    .eq('id', bundleId);
  return error ? { error: error.message } : { success: true };
}

// Shared Pool: hold kiện — chỉ thành công nếu kiện đang available
export async function holdBundle(bundleId) {
  const { error } = await sb.from('wood_bundles')
    .update({ status: 'Chưa được bán' })
    .eq('id', bundleId)
    .in('status', ['Kiện nguyên', 'Kiện lẻ']);
  return error ? { error: error.message } : { success: true };
}

// Giải phóng hold "Chưa được bán" → trả về status phù hợp
export async function releaseHoldBundle(bundleId) {
  const { data: b } = await sb.from('wood_bundles')
    .select('status,board_count,remaining_boards')
    .eq('id', bundleId).single();
  if (b?.status === 'Chưa được bán') {
    const newStatus = (b.remaining_boards >= b.board_count) ? 'Kiện nguyên' : 'Kiện lẻ';
    await sb.from('wood_bundles').update({ status: newStatus }).eq('id', bundleId);
  }
  return { success: true };
}

// Migrate kiện gỗ: đổi giá trị một thuộc tính từ oldVal → newVal cho wood_id nhất định
export async function migrateBundleGroupValue(woodId, attrId, fromVal, toVal) {
  const { data, error } = await sb.from('wood_bundles')
    .select('id, attributes, sku_key, price_attrs_override')
    .eq('wood_id', woodId);
  if (error) return { error: error.message };
  const affected = (data || []).filter(r => r.attributes?.[attrId] === fromVal || r.price_attrs_override?.[attrId] === fromVal);
  if (!affected.length) return { count: 0, failed: 0 };
  let updated = 0, failed = 0;
  for (const row of affected) {
    const updates = {};
    if (row.attributes?.[attrId] === fromVal) {
      updates.attributes = { ...row.attributes, [attrId]: toVal };
      updates.sku_key = (row.sku_key || '').replace(`${attrId}:${fromVal}`, `${attrId}:${toVal}`);
    }
    if (row.price_attrs_override?.[attrId] === fromVal) {
      updates.price_attrs_override = { ...row.price_attrs_override, [attrId]: toVal };
    }
    if (!Object.keys(updates).length) continue;
    const { error: ue } = await sb.from('wood_bundles')
      .update(updates)
      .eq('id', row.id);
    if (ue) failed++; else updated++;
  }
  return { count: updated, failed };
}

export async function fetchBundles() {
  const PAGE = 1000;
  let all = [], from = 0;
  while (true) {
    const { data, error } = await sb.from('wood_bundles').select('*').order('created_at', { ascending: false }).range(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    all = all.concat(data || []);
    if (!data || data.length < PAGE) break;
    from += PAGE;
  }
  return all.map(mapBundleRow);
}

// Mẻ xếp lò sấy: YYMMDD-NN (tối đa 99 kiện/ngày)
export async function genKilnBundleCode() {
  const d = new Date();
  const prefix = String(d.getFullYear()).slice(2)
    + String(d.getMonth() + 1).padStart(2, '0')
    + String(d.getDate()).padStart(2, '0');
  const { data } = await sb.from('wood_bundles')
    .select('bundle_code')
    .like('bundle_code', `${prefix}-%`)
    .order('bundle_code', { ascending: false })
    .limit(1);
  const next = data?.length
    ? (parseInt(data[0].bundle_code.split('-')[1]) || 0) + 1
    : 1;
  return `${prefix}-${String(next).padStart(2, '0')}`;
}

// Dong cạnh: random 6 ký tự (chữ+số, bỏ I,O,0,1 tránh nhầm)
export async function genEdgingBundleCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  for (let attempt = 0; attempt < 10; attempt++) {
    let code = '';
    for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
    const { data } = await sb.from('wood_bundles')
      .select('id').eq('bundle_code', code).limit(1);
    if (!data?.length) return code;
  }
  throw new Error('Không thể sinh mã kiện dong cạnh unique sau 10 lần thử');
}

export async function checkBundleCodeExists(bundleCode) {
  const { data } = await sb.from('wood_bundles').select('id').eq('bundle_code', bundleCode).limit(1);
  return !!(data && data.length > 0);
}

export async function addBundle({ bundleCode, woodId, containerId, packingSessionId, edgingBatchId, skuKey, attributes, boardCount, remainingBoards, volume, remainingVolume, notes, location, rawMeasurements, manualGroupAssignment, unit_price, volumeAdjustment, measuredBy }) {
  if (!bundleCode) return { error: 'Mã kiện là bắt buộc' };
  const bc = parseInt(boardCount) || 0;
  const rb = remainingBoards != null ? (parseInt(remainingBoards) ?? bc) : bc;
  const vol = parseFloat(volume) || 0;
  const rv = remainingVolume != null ? (parseFloat(remainingVolume) ?? vol) : vol;
  const isClosed = rb <= 0;
  const row = {
    bundle_code: bundleCode,
    wood_id: woodId,
    container_id: containerId || null,
    sku_key: skuKey,
    attributes,
    board_count: bc,
    remaining_boards: rb,
    volume: vol,
    remaining_volume: isClosed ? 0 : rv,
    status: isClosed ? 'Đã bán' : rb < bc ? 'Kiện lẻ' : 'Kiện nguyên',
    notes: notes || null,
    location: location || null,
    qr_code: bundleCode,
    ...(rawMeasurements && Object.keys(rawMeasurements).length ? { raw_measurements: rawMeasurements } : {}),
    ...(manualGroupAssignment ? { manual_group_assignment: true } : {}),
    ...(unit_price != null && !isNaN(parseFloat(unit_price)) ? { unit_price: parseFloat(unit_price) } : {}),
    ...(isClosed && volumeAdjustment != null ? { volume_adjustment: parseFloat(volumeAdjustment) } : {}),
    ...(packingSessionId ? { packing_session_id: packingSessionId } : {}),
    ...(edgingBatchId ? { edging_batch_id: edgingBatchId } : {}),
    ...(measuredBy?.length ? { measured_by: measuredBy } : {}),
  };
  const { data, error } = await sb.from('wood_bundles').insert(row).select().single();
  if (error) return { error: error.message };
  const { data: priceData } = await sb.from('prices').select('id').eq('wood_id', woodId).eq('sku_key', skuKey).limit(1);
  return { success: true, id: data.id, bundleCode, unpricedSku: !(priceData && priceData.length > 0) };
}

export async function updateBundle(id, updates) {
  const { error } = await sb.from('wood_bundles').update(updates).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteBundle(id) {
  const { error } = await sb.from('wood_bundles').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export function subscribeWoodBundles(callback) {
  return sb.channel('wood_bundles_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'wood_bundles' }, callback)
    .subscribe();
}

// V-20: kiểm tra bundle có đang trong order_items không
export async function checkBundleInOrders(bundleId) {
  const { count, error } = await sb.from('order_items').select('id', { count: 'exact', head: true }).eq('bundle_id', bundleId);
  if (error) return true; // nếu lỗi, chặn xóa để an toàn
  return count > 0;
}
