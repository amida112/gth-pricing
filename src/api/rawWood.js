import sb from './client';

// ===== RAW WOOD (GO TRON / GO HOP) =====

// ===== FORMULA CONFIG =====

export async function fetchRawWoodFormulas() {
  const { data, error } = await sb.from('raw_wood_formulas').select('*').order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, name: r.name, label: r.label,
    measurement: r.measurement,
    coeff: r.coeff != null ? parseFloat(r.coeff) : null,
    exponent: r.exponent,
    lengthAdjust: r.length_adjust || false,
    rounding: r.rounding || 'ROUND',
    decimals: r.decimals || 3,
    description: r.description || '',
    sortOrder: r.sort_order || 0,
  }));
}

// ===== RAW WOOD TYPES (GO TRON / GO HOP) =====

export async function fetchRawWoodTypes(woodForm) {
  const q = sb.from('raw_wood_types').select('*').order('sort_order');
  if (woodForm) q.eq('wood_form', woodForm);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, name: r.name, woodForm: r.wood_form, icon: r.icon || '',
    sortOrder: r.sort_order,
    supplierFormulaId: r.supplier_formula_id || null,
    inspectionFormulaId: r.inspection_formula_id || null,
    unitType: r.unit_type || 'volume',
    saleUnit: r.sale_unit || 'volume',
  }));
}

// fields: { name, icon, supplierFormulaId, inspectionFormulaId, unitType, saleUnit }
export async function addRawWoodType(name, woodForm, icon, fields = {}) {
  const { data, error } = await sb.from('raw_wood_types').insert({
    name, wood_form: woodForm, icon: icon || '🪵',
    supplier_formula_id:   fields.supplierFormulaId   || null,
    inspection_formula_id: fields.inspectionFormulaId || null,
    unit_type:             fields.unitType             || 'volume',
    sale_unit:             fields.saleUnit             || 'volume',
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function updateRawWoodType(id, name, icon, fields = {}) {
  const row = { name, icon: icon || '🪵' };
  if (fields.supplierFormulaId   !== undefined) row.supplier_formula_id   = fields.supplierFormulaId || null;
  if (fields.inspectionFormulaId !== undefined) row.inspection_formula_id = fields.inspectionFormulaId || null;
  if (fields.unitType            !== undefined) row.unit_type             = fields.unitType || 'volume';
  if (fields.saleUnit            !== undefined) row.sale_unit             = fields.saleUnit || 'volume';
  const { error } = await sb.from('raw_wood_types').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteRawWoodType(id) {
  const { error } = await sb.from('raw_wood_types').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== PACKING LIST NCC (tung cay/hop theo NCC) =====

function mapPiece(r) {
  return {
    id: r.id,
    containerItemId: r.container_item_id || null,
    pieceCode: r.piece_code || null,
    lengthM: r.length_m != null ? parseFloat(r.length_m) : null,
    diameterCm: r.diameter_cm != null ? parseFloat(r.diameter_cm) : null,
    circumferenceCm: r.circumference_cm != null ? parseFloat(r.circumference_cm) : null,
    widthCm: r.width_cm != null ? parseFloat(r.width_cm) : null,
    thicknessCm: r.thickness_cm != null ? parseFloat(r.thickness_cm) : null,
    volumeM3: r.volume_m3 != null ? parseFloat(r.volume_m3) : null,
    weightKg: r.weight_kg != null ? parseFloat(r.weight_kg) : null,
    quality: r.quality || null,
    sortOrder: r.sort_order || 0,
    notes: r.notes || null,
    sawingBatchId: r.sawing_batch_id || null,
    sawnDate: r.sawn_date || null,
  };
}

export async function fetchRawWoodPackingList(containerId) {
  const { data, error } = await sb.from('raw_wood_packing_list')
    .select('*').eq('container_id', containerId).order('sort_order').order('id');
  if (error) throw new Error(error.message);
  return (data || []).map(mapPiece);
}

// Fetch nhe: chi lay logs da duoc chon cho 1 batch cu the (sawing_batch_id = batchId)
export async function fetchSelectedLogsForBatch(batchId) {
  if (!batchId) return [];
  const { data, error } = await sb.from('raw_wood_packing_list')
    .select('id, container_id, piece_code, volume_m3, quality, sawing_batch_id, sawn_date')
    .eq('sawing_batch_id', batchId)
    .order('container_id')
    .order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id,
    containerId: r.container_id,
    pieceCode: r.piece_code || null,
    volumeM3: parseFloat(r.volume_m3) || 0,
    quality: r.quality || null,
    sawingBatchId: r.sawing_batch_id || null,
    sawnDate: r.sawn_date || null,
  }));
}

// Chon nhieu cay cho me xe (bulk select)
export async function selectLogsForSawing(logIds, sawingBatchId, sawnDate) {
  if (!logIds.length) return { success: true };
  const { error } = await sb.from('raw_wood_packing_list')
    .update({ sawing_batch_id: sawingBatchId, sawn_date: sawnDate || new Date().toISOString().slice(0, 10) })
    .in('id', logIds);
  return error ? { error: error.message } : { success: true, count: logIds.length };
}

// Bo chon nhieu cay (deselect)
export async function deselectLogsFromSawing(logIds) {
  if (!logIds.length) return { success: true };
  const { error } = await sb.from('raw_wood_packing_list')
    .update({ sawing_batch_id: null, sawn_date: null })
    .in('id', logIds);
  return error ? { error: error.message } : { success: true };
}

// Bo chon tat ca cay cua 1 me xe
export async function deselectAllLogsFromBatch(sawingBatchId) {
  const { error } = await sb.from('raw_wood_packing_list')
    .update({ sawing_batch_id: null, sawn_date: null })
    .eq('sawing_batch_id', sawingBatchId);
  return error ? { error: error.message } : { success: true };
}

export async function addRawWoodPackingListBatch(containerId, pieces) {
  const rows = pieces.map((p, i) => ({
    container_id: containerId,
    container_item_id: p.containerItemId || null,
    piece_code: p.pieceCode || null,
    length_m: p.lengthM || null,
    diameter_cm: p.diameterCm || null,
    circumference_cm: p.circumferenceCm || null,
    width_cm: p.widthCm || null,
    thickness_cm: p.thicknessCm || null,
    volume_m3: p.volumeM3 || null,
    weight_kg: p.weightKg || null,
    quality: p.quality || null,
    sort_order: p.sortOrder ?? i,
    notes: p.notes || null,
  }));
  const { data, error } = await sb.from('raw_wood_packing_list').insert(rows).select();
  return error ? { error: error.message } : { success: true, count: data.length, items: data.map(mapPiece) };
}

export async function deleteRawWoodPackingListItem(id) {
  const { error } = await sb.from('raw_wood_packing_list').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== NGHIEM THU THUC TE =====

function mapInspectionPiece(r) {
  return {
    id: r.id,
    containerItemId: r.container_item_id || null,
    packingListId: r.packing_list_id || null,
    pieceCode: r.piece_code || null,
    lengthM: r.length_m != null ? parseFloat(r.length_m) : null,
    diameterCm: r.diameter_cm != null ? parseFloat(r.diameter_cm) : null,
    circumferenceCm: r.circumference_cm != null ? parseFloat(r.circumference_cm) : null,
    widthCm: r.width_cm != null ? parseFloat(r.width_cm) : null,
    thicknessCm: r.thickness_cm != null ? parseFloat(r.thickness_cm) : null,
    volumeM3: r.volume_m3 != null ? parseFloat(r.volume_m3) : null,
    weightKg: r.weight_kg != null ? parseFloat(r.weight_kg) : null,
    quality: r.quality || null,
    isMissing: r.is_missing || false,
    isDamaged: r.is_damaged || false,
    isStandalone: r.is_standalone || false,
    status: r.status || 'available',
    sawmillBatchId: r.sawmill_batch_id || null,
    sawingBatchId: r.sawing_batch_id || null,
    saleOrderId: r.sale_order_id || null,
    sortOrder: r.sort_order || 0,
    notes: r.notes || null,
    inspectionDate: r.inspection_date || null,
    inspector: r.inspector || null,
  };
}

export async function fetchRawWoodInspection(containerId) {
  const { data, error } = await sb.from('raw_wood_inspection')
    .select('*').eq('container_id', containerId).order('sort_order').order('id');
  if (error) throw new Error(error.message);
  return (data || []).map(mapInspectionPiece);
}

// Lightweight: fetch inspection summary (counts + volumes) cho tat ca containers
// Tra ve map: { [containerId]: { total, available, sawn, sold, totalVol, availVol } }
export async function fetchInspectionSummaryAll() {
  const { data, error } = await sb
    .from('raw_wood_inspection')
    .select('container_id, status, volume_m3, is_missing, diameter_cm, width_cm');
  if (error) throw new Error(error.message);
  const map = {};
  (data || []).forEach(r => {
    const cid = r.container_id;
    if (!map[cid]) map[cid] = { total: 0, available: 0, on_order: 0, sawn: 0, sold: 0, missing: 0, totalVol: 0, availVol: 0, _diameters: [], _widths: [] };
    if (r.is_missing) { map[cid].missing++; return; }
    map[cid].total++;
    map[cid].totalVol += parseFloat(r.volume_m3) || 0;
    if (r.status === 'available') { map[cid].available++; map[cid].availVol += parseFloat(r.volume_m3) || 0; }
    if (r.status === 'on_order')  map[cid].on_order++;
    if (r.status === 'sawn')      map[cid].sawn++;
    if (r.status === 'sold')      map[cid].sold++;
    if (r.diameter_cm) map[cid]._diameters.push(parseFloat(r.diameter_cm));
    if (r.width_cm) map[cid]._widths.push(parseFloat(r.width_cm));
  });
  // Tính avg
  Object.values(map).forEach(m => {
    m.avgDiameter = m._diameters.length ? m._diameters.reduce((s, v) => s + v, 0) / m._diameters.length : null;
    m.avgWidth = m._widths.length ? m._widths.reduce((s, v) => s + v, 0) / m._widths.length : null;
    delete m._diameters; delete m._widths;
  });
  return map;
}

export async function addRawWoodInspectionBatch(containerId, pieces) {
  const rows = pieces.map((p, i) => ({
    container_id: containerId,
    container_item_id: p.containerItemId || null,
    packing_list_id: p.packingListId || null,
    piece_code: p.pieceCode || null,
    length_m: p.lengthM || null,
    diameter_cm: p.diameterCm || null,
    circumference_cm: p.circumferenceCm || null,
    width_cm: p.widthCm || null,
    thickness_cm: p.thicknessCm || null,
    volume_m3: p.volumeM3 || null,
    weight_kg: p.weightKg || null,
    quality: p.quality || null,
    is_missing: p.isMissing || false,
    is_damaged: p.isDamaged || false,
    sort_order: p.sortOrder ?? i,
    notes: p.notes || null,
    inspection_date: p.inspectionDate || null,
    inspector: p.inspector || null,
  }));
  const { data, error } = await sb.from('raw_wood_inspection').insert(rows).select();
  return error ? { error: error.message } : { success: true, count: data.length, items: data.map(mapInspectionPiece) };
}

export async function updateRawWoodInspectionItem(id, fields) {
  const row = {};
  if (fields.status        !== undefined) row.status        = fields.status;
  if (fields.isMissing     !== undefined) row.is_missing    = fields.isMissing;
  if (fields.isDamaged     !== undefined) row.is_damaged    = fields.isDamaged;
  if (fields.volumeM3      !== undefined) row.volume_m3     = fields.volumeM3;
  if (fields.quality       !== undefined) row.quality       = fields.quality;
  if (fields.notes         !== undefined) row.notes         = fields.notes;
  if (fields.sawmillBatchId  !== undefined) row.sawmill_batch_id = fields.sawmillBatchId;
  if (fields.sawingBatchId   !== undefined) row.sawing_batch_id  = fields.sawingBatchId;
  const { error } = await sb.from('raw_wood_inspection').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteRawWoodInspectionItem(id) {
  const { error } = await sb.from('raw_wood_inspection').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function clearRawWoodInspection(containerId) {
  const { error } = await sb.from('raw_wood_inspection').delete().eq('container_id', containerId);
  return error ? { error: error.message } : { success: true };
}

// -- Sawing: Inspection-based selection --

// Fetch containers raw_round/raw_box co it nhat 1 ban ghi nghiem thu (available inventory)
export async function fetchRawContainersWithInspection() {
  // Lay containers go nguyen lieu
  const { data: conts, error: ce } = await sb
    .from('containers')
    .select('id,container_code,cargo_type,total_volume,remaining_volume,weight_unit,ton_to_m3_factor,raw_wood_type_id,ncc_id,arrival_date,status,notes')
    .in('cargo_type', ['raw_round', 'raw_box'])
    .order('arrival_date', { ascending: false });
  if (ce) throw new Error(ce.message);
  if (!conts?.length) return [];

  // Lay summary nghiem thu per container
  const cids = conts.map(c => c.id);
  const { data: summary } = await sb
    .from('raw_wood_inspection')
    .select('container_id, status, volume_m3, is_missing')
    .in('container_id', cids);

  // Gom summary — cay thieu (is_missing) khong tinh vao ton kho
  const sumMap = {};
  (summary || []).forEach(r => {
    const cid = r.container_id;
    if (!sumMap[cid]) sumMap[cid] = { total: 0, available: 0, sawn: 0, sold: 0, missing: 0, totalVol: 0, availVol: 0 };
    if (r.is_missing) { sumMap[cid].missing++; return; }
    sumMap[cid].total++;
    sumMap[cid].totalVol += parseFloat(r.volume_m3) || 0;
    if (r.status === 'available') { sumMap[cid].available++; sumMap[cid].availVol += parseFloat(r.volume_m3) || 0; }
    if (r.status === 'sawn') sumMap[cid].sawn++;
    if (r.status === 'sold') sumMap[cid].sold++;
  });

  return conts.map(r => ({
    id: r.id, containerCode: r.container_code, cargoType: r.cargo_type,
    totalVolume: parseFloat(r.total_volume) || 0,
    remainingVolume: r.remaining_volume != null ? parseFloat(r.remaining_volume) : null,
    weightUnit: r.weight_unit || 'm3',
    tonToM3Factor: r.ton_to_m3_factor != null ? parseFloat(r.ton_to_m3_factor) : null,
    rawWoodTypeId: r.raw_wood_type_id || null,
    nccId: r.ncc_id, arrivalDate: r.arrival_date, status: r.status, notes: r.notes,
    inspection: sumMap[r.id] || null,   // null = chua co nghiem thu
  })).filter(c => c.inspection !== null); // chi hien cont da co nghiem thu
}

// Fetch inspection pieces da chon cho 1 sawing batch (nhe — chi fields can thiet)
export async function fetchSelectedInspLogsForBatch(batchId) {
  if (!batchId) return [];
  const { data, error } = await sb.from('raw_wood_inspection')
    .select('id,container_id,piece_code,volume_m3,quality,status,sawing_batch_id,inspection_date')
    .eq('sawing_batch_id', batchId)
    .order('container_id').order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, containerId: r.container_id, pieceCode: r.piece_code || null,
    volumeM3: parseFloat(r.volume_m3) || 0, quality: r.quality || null,
    status: r.status || 'available', sawingBatchId: r.sawing_batch_id || null,
    inspectionDate: r.inspection_date || null,
  }));
}

// Chon inspection pieces vao me xe -> status = 'sawn', sawing_batch_id = batchId
export async function selectInspLogsForSawing(ids, batchId) {
  if (!ids.length) return { success: true };
  // Thu update ca status + sawing_batch_id
  const { error } = await sb.from('raw_wood_inspection')
    .update({ status: 'sawn', sawing_batch_id: batchId })
    .in('id', ids);
  if (error) {
    // Fallback: column sawing_batch_id chua ton tai -> chi update status
    if (error.message?.includes('sawing_batch_id') || error.code === '42703') {
      const { error: e2 } = await sb.from('raw_wood_inspection')
        .update({ status: 'sawn' })
        .in('id', ids);
      return e2 ? { error: e2.message } : { success: true, count: ids.length, needsMigration: true };
    }
    return { error: error.message };
  }
  return { success: true, count: ids.length };
}

// Bo chon -> status = 'available', sawing_batch_id = NULL
export async function deselectInspLogsFromSawing(ids) {
  if (!ids.length) return { success: true };
  const { error } = await sb.from('raw_wood_inspection')
    .update({ status: 'available', sawing_batch_id: null })
    .in('id', ids);
  if (error) {
    // Fallback khi column chua co
    if (error.message?.includes('sawing_batch_id') || error.code === '42703') {
      const { error: e2 } = await sb.from('raw_wood_inspection')
        .update({ status: 'available' })
        .in('id', ids);
      return e2 ? { error: e2.message } : { success: true, needsMigration: true };
    }
    return { error: error.message };
  }
  return { success: true };
}

function mapLotRow(r) {
  return {
    id: r.id, lotCode: r.lot_code, woodForm: r.wood_form,
    containerId: r.container_id, shipmentId: r.shipment_id,
    woodTypeId: r.wood_type_id, supplierId: r.supplier_id, quality: r.quality,
    totalPieces: r.total_pieces || 0, totalVolume: r.total_volume != null ? parseFloat(r.total_volume) : 0,
    disposition: r.disposition || 'pending', customerId: r.customer_id,
    status: r.status || 'Mới nhập', notes: r.notes, createdAt: r.created_at,
  };
}

function mapItemRow(r) {
  return {
    id: r.id, lotId: r.lot_id, itemCode: r.item_code,
    woodTypeId: r.wood_type_id, quality: r.quality,
    length: r.length != null ? parseFloat(r.length) : null,
    diameter: r.diameter != null ? parseFloat(r.diameter) : null,
    circumference: r.circumference != null ? parseFloat(r.circumference) : null,
    width: r.width != null ? parseFloat(r.width) : null,
    thickness: r.thickness != null ? parseFloat(r.thickness) : null,
    volume: r.volume != null ? parseFloat(r.volume) : null,
    status: r.status || 'Trong kho',
    soldToCustomerId: r.sold_to_customer_id, soldOrderId: r.sold_order_id,
    sawingBatchId: r.sawing_batch_id, sawingDate: r.sawing_date,
    notes: r.notes,
  };
}

export async function fetchRawWoodLots(woodForm) {
  const q = sb.from('raw_wood_lots').select('*').order('created_at', { ascending: false });
  if (woodForm) q.eq('wood_form', woodForm);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(mapLotRow);
}

export async function addRawWoodLot(woodForm, woodTypeId, supplierId, quality, containerId, shipmentId, notes) {
  const { data, error } = await sb.from('raw_wood_lots').insert({
    lot_code: '', wood_form: woodForm, wood_type_id: woodTypeId || null,
    supplier_id: supplierId || null, quality: quality || null,
    container_id: containerId || null, shipment_id: shipmentId || null,
    notes: notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id, lotCode: data.lot_code };
}

export async function updateRawWoodLot(id, fields) {
  const row = {};
  if (fields.woodTypeId !== undefined) row.wood_type_id = fields.woodTypeId || null;
  if (fields.supplierId !== undefined) row.supplier_id = fields.supplierId || null;
  if (fields.quality !== undefined) row.quality = fields.quality || null;
  if (fields.containerId !== undefined) row.container_id = fields.containerId || null;
  if (fields.totalPieces !== undefined) row.total_pieces = fields.totalPieces;
  if (fields.totalVolume !== undefined) row.total_volume = fields.totalVolume;
  if (fields.disposition !== undefined) row.disposition = fields.disposition;
  if (fields.customerId !== undefined) row.customer_id = fields.customerId || null;
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.notes !== undefined) row.notes = fields.notes || null;
  const { error } = await sb.from('raw_wood_lots').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteRawWoodLot(id) {
  const { error } = await sb.from('raw_wood_lots').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function fetchRawWoodItems(lotId) {
  const { data, error } = await sb.from('raw_wood_items').select('*').eq('lot_id', lotId).order('item_code');
  if (error) throw new Error(error.message);
  return (data || []).map(mapItemRow);
}

export async function addRawWoodItem(lotId, item) {
  const { data, error } = await sb.from('raw_wood_items').insert({
    lot_id: lotId, item_code: item.itemCode || null,
    wood_type_id: item.woodTypeId || null, quality: item.quality || null,
    length: item.length || null, diameter: item.diameter || null,
    circumference: item.circumference || null,
    width: item.width || null, thickness: item.thickness || null,
    volume: item.volume || null, status: 'Trong kho', notes: item.notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function addRawWoodItemsBatch(lotId, items) {
  const rows = items.map(item => ({
    lot_id: lotId, item_code: item.itemCode || null,
    wood_type_id: item.woodTypeId || null, quality: item.quality || null,
    length: item.length || null, diameter: item.diameter || null,
    circumference: item.circumference || null,
    width: item.width || null, thickness: item.thickness || null,
    volume: item.volume || null, status: 'Trong kho', notes: item.notes || null,
  }));
  const { data, error } = await sb.from('raw_wood_items').insert(rows).select();
  return error ? { error: error.message } : { success: true, count: data.length };
}

export async function updateRawWoodItem(id, fields) {
  const row = {};
  if (fields.itemCode !== undefined) row.item_code = fields.itemCode;
  if (fields.woodTypeId !== undefined) row.wood_type_id = fields.woodTypeId;
  if (fields.quality !== undefined) row.quality = fields.quality;
  if (fields.length !== undefined) row.length = fields.length;
  if (fields.diameter !== undefined) row.diameter = fields.diameter;
  if (fields.circumference !== undefined) row.circumference = fields.circumference;
  if (fields.width !== undefined) row.width = fields.width;
  if (fields.thickness !== undefined) row.thickness = fields.thickness;
  if (fields.volume !== undefined) row.volume = fields.volume;
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.soldToCustomerId !== undefined) row.sold_to_customer_id = fields.soldToCustomerId;
  if (fields.sawingBatchId !== undefined) row.sawing_batch_id = fields.sawingBatchId;
  if (fields.sawingDate !== undefined) row.sawing_date = fields.sawingDate;
  if (fields.notes !== undefined) row.notes = fields.notes;
  const { error } = await sb.from('raw_wood_items').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function updateRawWoodItemsBatch(ids, fields) {
  const row = {};
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.soldToCustomerId !== undefined) row.sold_to_customer_id = fields.soldToCustomerId;
  if (fields.sawingBatchId !== undefined) row.sawing_batch_id = fields.sawingBatchId;
  if (fields.sawingDate !== undefined) row.sawing_date = fields.sawingDate;
  const { error } = await sb.from('raw_wood_items').update(row).in('id', ids);
  return error ? { error: error.message } : { success: true };
}

export async function deleteRawWoodItem(id) {
  const { error } = await sb.from('raw_wood_items').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}
