import sb from './client';

// ===== CONTAINERS =====

export async function fetchContainers() {
  const { data, error } = await sb.from('containers').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, containerCode: r.container_code, nccId: r.ncc_id,
    arrivalDate: r.arrival_date,
    totalVolume: r.total_volume != null ? parseFloat(r.total_volume) : null,
    remainingVolume: r.remaining_volume != null ? parseFloat(r.remaining_volume) : null,
    status: r.status || 'Tạo mới', notes: r.notes,
    shipmentId: r.shipment_id || null,
    cargoType: r.cargo_type || 'sawn',
    isStandalone: r.is_standalone || false,
    weightUnit: r.weight_unit || 'm3',
    tonToM3Factor: r.ton_to_m3_factor != null ? parseFloat(r.ton_to_m3_factor) : null,
    rawWoodTypeId: r.raw_wood_type_id || null,
    avgDiameterCm: r.avg_diameter_cm != null ? parseFloat(r.avg_diameter_cm) : null,
    avgWidthCm:    r.avg_width_cm    != null ? parseFloat(r.avg_width_cm)    : null,
    saleUnitPrice: r.sale_unit_price != null ? parseFloat(r.sale_unit_price) : null,
    saleNotes:     r.sale_notes || null,
    images:        r.images || [],
  }));
}

export async function addContainer(fields = {}) {
  const { data, error } = await sb.from('containers').insert({
    container_code: fields.containerCode,
    ncc_id: fields.nccId || null,
    arrival_date: fields.arrivalDate || null,
    total_volume: fields.totalVolume || null,
    status: fields.status || 'Tạo mới',
    notes: fields.notes || null,
    cargo_type: fields.cargoType || 'sawn',
    shipment_id: fields.shipmentId || null,
    is_standalone: fields.isStandalone || false,
    weight_unit: fields.weightUnit || 'm3',
    ton_to_m3_factor: fields.tonToM3Factor || null,
    remaining_volume: fields.totalVolume || null,
    remaining_pieces: fields.remainingPieces ?? fields.pieceCount ?? null,
    raw_wood_type_id: fields.rawWoodTypeId || null,
    ...(fields.avgWidthCm != null ? { avg_width_cm: fields.avgWidthCm } : {}),
    ...(fields.avgDiameterCm != null ? { avg_diameter_cm: fields.avgDiameterCm } : {}),
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function updateContainer(id, fields = {}) {
  const row = {};
  if (fields.containerCode !== undefined) row.container_code = fields.containerCode;
  if (fields.nccId         !== undefined) row.ncc_id         = fields.nccId || null;
  if (fields.arrivalDate   !== undefined) row.arrival_date   = fields.arrivalDate || null;
  if (fields.totalVolume   !== undefined) row.total_volume   = fields.totalVolume || null;
  if (fields.status        !== undefined) row.status         = fields.status || 'Tạo mới';
  if (fields.notes         !== undefined) row.notes          = fields.notes || null;
  if (fields.cargoType     !== undefined) row.cargo_type     = fields.cargoType || 'sawn';
  if (fields.shipmentId    !== undefined) row.shipment_id    = fields.shipmentId || null;
  if (fields.isStandalone  !== undefined) row.is_standalone  = fields.isStandalone;
  if (fields.weightUnit      !== undefined) row.weight_unit      = fields.weightUnit || 'm3';
  if (fields.tonToM3Factor   !== undefined) row.ton_to_m3_factor = fields.tonToM3Factor || null;
  if (fields.remainingVolume !== undefined) row.remaining_volume = fields.remainingVolume;
  if (fields.rawWoodTypeId   !== undefined) row.raw_wood_type_id = fields.rawWoodTypeId || null;
  if (fields.images          !== undefined) row.images           = fields.images;
  const { error } = await sb.from('containers').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteContainer(id) {
  const { error } = await sb.from('containers').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteContainersByShipment(shipmentId) {
  const { error } = await sb.from('containers').delete().eq('shipment_id', shipmentId);
  return error ? { error: error.message } : { success: true };
}

function mapContainerItem(r) {
  return {
    id: r.id,
    itemType: r.item_type || 'sawn',
    woodId: r.wood_id || null,
    rawWoodTypeId: r.raw_wood_type_id || null,
    thickness: r.thickness || null,
    pieceCount: r.piece_count || null,
    quality: r.quality || null,
    volume: r.volume != null ? parseFloat(r.volume) : null,
    notes: r.notes || null,
  };
}

export async function fetchAllContainerItems() {
  const { data, error } = await sb.from('container_items').select('*').order('container_id').order('id');
  if (error) throw new Error(error.message);
  const result = {};
  (data || []).forEach(r => {
    if (!result[r.container_id]) result[r.container_id] = [];
    result[r.container_id].push(mapContainerItem(r));
  });
  return result;
}

export async function fetchContainerItems(containerId) {
  const { data, error } = await sb.from('container_items').select('*').eq('container_id', containerId).order('id');
  if (error) throw new Error(error.message);
  return (data || []).map(r => mapContainerItem(r));
}

export async function addContainerItem(containerId, item = {}) {
  const { data, error } = await sb.from('container_items').insert({
    container_id:    containerId,
    item_type:       item.itemType       || 'sawn',
    wood_id:         item.woodId         || null,
    raw_wood_type_id:item.rawWoodTypeId  || null,
    thickness:       item.thickness      || null,
    piece_count:     item.pieceCount     || null,
    quality:         item.quality        || null,
    volume:          item.volume         || null,
    notes:           item.notes          || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function updateContainerItem(id, item = {}) {
  const row = {};
  if (item.itemType       !== undefined) row.item_type        = item.itemType || 'sawn';
  if (item.woodId         !== undefined) row.wood_id          = item.woodId || null;
  if (item.rawWoodTypeId  !== undefined) row.raw_wood_type_id = item.rawWoodTypeId || null;
  if (item.thickness      !== undefined) row.thickness        = item.thickness || null;
  if (item.pieceCount     !== undefined) row.piece_count      = item.pieceCount || null;
  if (item.quality        !== undefined) row.quality          = item.quality || null;
  if (item.volume         !== undefined) row.volume           = item.volume || null;
  if (item.notes          !== undefined) row.notes            = item.notes || null;
  const { error } = await sb.from('container_items').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteContainerItem(id) {
  const { error } = await sb.from('container_items').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}
