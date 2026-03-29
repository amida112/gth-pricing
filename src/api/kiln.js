import sb from './client';

// ===== KILN v2 (LO SAY) =====

function mapKilnBatch(r) {
  return {
    id: r.id, batchCode: r.batch_code, kilnNumber: r.kiln_number,
    entryDate: r.entry_date, expectedExitDate: r.expected_exit_date,
    actualExitDate: r.actual_exit_date, status: r.status || 'Đang sấy',
    notes: r.notes, createdAt: r.created_at,
  };
}

function mapKilnItem(r) {
  return {
    id: r.id, batchId: r.batch_id, itemCode: r.item_code,
    woodTypeId: r.wood_type_id, thicknessCm: r.thickness_cm != null ? parseFloat(r.thickness_cm) : 0,
    ownerType: r.owner_type || 'company', ownerName: r.owner_name,
    weightKg: r.weight_kg != null ? parseFloat(r.weight_kg) : 0,
    conversionRate: r.conversion_rate != null ? parseFloat(r.conversion_rate) : null,
    volumeM3: r.volume_m3 != null ? parseFloat(r.volume_m3) : 0,
    notes: r.notes, createdAt: r.created_at,
  };
}

function mapUnsorted(r) {
  return {
    id: r.id, bundleCode: r.bundle_code, kilnItemId: r.kiln_item_id,
    woodTypeId: r.wood_type_id, thicknessCm: r.thickness_cm != null ? parseFloat(r.thickness_cm) : 0,
    ownerType: r.owner_type || 'company', ownerName: r.owner_name,
    weightKg: r.weight_kg != null ? parseFloat(r.weight_kg) : 0,
    volumeM3: r.volume_m3 != null ? parseFloat(r.volume_m3) : 0,
    status: r.status || 'Chưa xếp', packingSessionId: r.packing_session_id,
    notes: r.notes, createdAt: r.created_at,
  };
}

function mapPackingSession(r) {
  return {
    id: r.id, sessionCode: r.session_code, packingDate: r.packing_date,
    woodTypeId: r.wood_type_id, thicknessCm: r.thickness_cm != null ? parseFloat(r.thickness_cm) : 0,
    totalInputKg: r.total_input_kg != null ? parseFloat(r.total_input_kg) : 0,
    totalInputM3: r.total_input_m3 != null ? parseFloat(r.total_input_m3) : 0,
    status: r.status || 'Đang xếp', notes: r.notes, createdAt: r.created_at,
  };
}

function mapLeftover(r) {
  return {
    id: r.id, leftoverCode: r.leftover_code, sourceSessionId: r.source_session_id,
    woodTypeId: r.wood_type_id, thicknessCm: r.thickness_cm != null ? parseFloat(r.thickness_cm) : 0,
    quality: r.quality, weightKg: r.weight_kg != null ? parseFloat(r.weight_kg) : 0,
    volumeM3: r.volume_m3 != null ? parseFloat(r.volume_m3) : 0,
    status: r.status || 'Chưa xếp', usedInSessionId: r.used_in_session_id,
    notes: r.notes, createdAt: r.created_at,
  };
}

// ── Kiln Batches ──

export async function fetchKilnBatches() {
  const { data, error } = await sb.from('kiln_batches').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapKilnBatch);
}

export async function addKilnBatch(kilnNumber, entryDate, expectedExitDate, notes) {
  const { data, error } = await sb.from('kiln_batches').insert({
    batch_code: '', kiln_number: kilnNumber,
    entry_date: entryDate, expected_exit_date: expectedExitDate || null, notes: notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id, batchCode: data.batch_code };
}

export async function updateKilnBatch(id, fields) {
  const row = {};
  if (fields.entryDate !== undefined) row.entry_date = fields.entryDate;
  if (fields.expectedExitDate !== undefined) row.expected_exit_date = fields.expectedExitDate || null;
  if (fields.actualExitDate !== undefined) row.actual_exit_date = fields.actualExitDate || null;
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.notes !== undefined) row.notes = fields.notes || null;
  const { error } = await sb.from('kiln_batches').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteKilnBatch(id) {
  const { error } = await sb.from('kiln_batches').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ── Kiln Items (Ma go say) ──

export async function fetchKilnItems(batchId) {
  const q = sb.from('kiln_items').select('*').order('created_at');
  if (batchId) q.eq('batch_id', batchId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(mapKilnItem);
}

export async function fetchAllKilnItems() {
  const { data, error } = await sb.from('kiln_items').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data || []).map(mapKilnItem);
}

export async function addKilnItem(batchId, item) {
  const vol = (item.weightKg && item.conversionRate) ? item.weightKg / item.conversionRate : (item.volumeM3 || 0);
  const { data, error } = await sb.from('kiln_items').insert({
    batch_id: batchId, item_code: '',
    wood_type_id: item.woodTypeId || null, thickness_cm: item.thicknessCm,
    owner_type: item.ownerType || 'company', owner_name: item.ownerName || null,
    weight_kg: item.weightKg || 0, conversion_rate: item.conversionRate || null,
    volume_m3: vol, notes: item.notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id, itemCode: data.item_code };
}

export async function updateKilnItem(id, fields) {
  const row = {};
  if (fields.woodTypeId !== undefined) row.wood_type_id = fields.woodTypeId || null;
  if (fields.thicknessCm !== undefined) row.thickness_cm = fields.thicknessCm;
  if (fields.ownerType !== undefined) row.owner_type = fields.ownerType;
  if (fields.ownerName !== undefined) row.owner_name = fields.ownerName || null;
  if (fields.weightKg !== undefined) row.weight_kg = fields.weightKg;
  if (fields.conversionRate !== undefined) row.conversion_rate = fields.conversionRate;
  if (fields.volumeM3 !== undefined) row.volume_m3 = fields.volumeM3;
  if (fields.notes !== undefined) row.notes = fields.notes || null;
  const { error } = await sb.from('kiln_items').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteKilnItem(id) {
  const { error } = await sb.from('kiln_items').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ── Kiln Edit Log (Audit) ──

export async function addKilnEditLog(kilnItemId, action, changedBy, oldValues, newValues) {
  await sb.from('kiln_edit_log').insert({
    kiln_item_id: kilnItemId, action, changed_by: changedBy || null,
    old_values: oldValues || null, new_values: newValues || null,
  });
}

export async function fetchKilnEditLog(kilnItemId) {
  const q = sb.from('kiln_edit_log').select('*').order('created_at', { ascending: false });
  if (kilnItemId) q.eq('kiln_item_id', kilnItemId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, kilnItemId: r.kiln_item_id, action: r.action,
    changedBy: r.changed_by, oldValues: r.old_values, newValues: r.new_values,
    createdAt: r.created_at,
  }));
}

// ── Unsorted Bundles (Kien chua xep) ──

export async function fetchUnsortedBundles() {
  const { data, error } = await sb.from('unsorted_bundles').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data || []).map(mapUnsorted);
}

export async function addUnsortedBundle(kilnItemId, weightKg, volumeM3, woodTypeId, thicknessCm, ownerType, ownerName, notes) {
  const { data, error } = await sb.from('unsorted_bundles').insert({
    bundle_code: '', kiln_item_id: kilnItemId,
    wood_type_id: woodTypeId || null, thickness_cm: thicknessCm,
    owner_type: ownerType || 'company', owner_name: ownerName || null,
    weight_kg: weightKg, volume_m3: volumeM3, notes: notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id, bundleCode: data.bundle_code };
}

export async function addUnsortedBundlesBatch(items) {
  const rows = items.map(it => ({
    bundle_code: '', kiln_item_id: it.kilnItemId,
    wood_type_id: it.woodTypeId || null, thickness_cm: it.thicknessCm,
    owner_type: it.ownerType || 'company', owner_name: it.ownerName || null,
    weight_kg: it.weightKg, volume_m3: it.volumeM3, notes: it.notes || null,
  }));
  const { data, error } = await sb.from('unsorted_bundles').insert(rows).select();
  return error ? { error: error.message } : { success: true, items: (data || []).map(mapUnsorted) };
}

export async function updateUnsortedBundle(id, fields) {
  const row = {};
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.packingSessionId !== undefined) row.packing_session_id = fields.packingSessionId || null;
  if (fields.weightKg !== undefined) row.weight_kg = fields.weightKg;
  if (fields.volumeM3 !== undefined) row.volume_m3 = fields.volumeM3;
  if (fields.notes !== undefined) row.notes = fields.notes || null;
  const { error } = await sb.from('unsorted_bundles').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function updateUnsortedBundlesBatch(ids, fields) {
  const row = {};
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.packingSessionId !== undefined) row.packing_session_id = fields.packingSessionId || null;
  const { error } = await sb.from('unsorted_bundles').update(row).in('id', ids);
  return error ? { error: error.message } : { success: true };
}

export async function deleteUnsortedBundle(id) {
  const { error } = await sb.from('unsorted_bundles').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// Import kien chua xep (khong qua lo)
export async function importUnsortedBundles(items) {
  const rows = items.map(it => ({
    bundle_code: '', kiln_item_id: null,
    wood_type_id: it.woodTypeId || null, thickness_cm: it.thicknessCm,
    owner_type: it.ownerType || 'company', owner_name: it.ownerName || null,
    weight_kg: it.weightKg || 0, volume_m3: it.volumeM3 || 0, notes: it.notes || null,
  }));
  const { data, error } = await sb.from('unsorted_bundles').insert(rows).select();
  return error ? { error: error.message } : { success: true, count: (data || []).length };
}

// ── Packing Sessions (Me xep) ──

export async function fetchPackingSessions() {
  const { data, error } = await sb.from('packing_sessions').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapPackingSession);
}

export async function addPackingSession(packingDate, woodTypeId, thicknessCm, totalInputKg, totalInputM3, notes) {
  const { data, error } = await sb.from('packing_sessions').insert({
    session_code: '', packing_date: packingDate,
    wood_type_id: woodTypeId, thickness_cm: thicknessCm,
    total_input_kg: totalInputKg, total_input_m3: totalInputM3, notes: notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id, sessionCode: data.session_code };
}

export async function updatePackingSession(id, fields) {
  const row = {};
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.totalInputKg !== undefined) row.total_input_kg = fields.totalInputKg;
  if (fields.totalInputM3 !== undefined) row.total_input_m3 = fields.totalInputM3;
  if (fields.notes !== undefined) row.notes = fields.notes || null;
  const { error } = await sb.from('packing_sessions').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deletePackingSession(id) {
  const { error } = await sb.from('packing_sessions').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ── Packing Leftovers (Kien bo lai) ──

export async function fetchPackingLeftovers() {
  const { data, error } = await sb.from('packing_leftovers').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data || []).map(mapLeftover);
}

export async function addPackingLeftover(sourceSessionId, woodTypeId, thicknessCm, quality, weightKg, volumeM3, notes) {
  const { data, error } = await sb.from('packing_leftovers').insert({
    leftover_code: '', source_session_id: sourceSessionId,
    wood_type_id: woodTypeId, thickness_cm: thicknessCm,
    quality: quality || null, weight_kg: weightKg, volume_m3: volumeM3, notes: notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id, leftoverCode: data.leftover_code };
}

export async function updatePackingLeftover(id, fields) {
  const row = {};
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.usedInSessionId !== undefined) row.used_in_session_id = fields.usedInSessionId || null;
  if (fields.quality !== undefined) row.quality = fields.quality || null;
  if (fields.weightKg !== undefined) row.weight_kg = fields.weightKg;
  if (fields.volumeM3 !== undefined) row.volume_m3 = fields.volumeM3;
  if (fields.notes !== undefined) row.notes = fields.notes || null;
  const { error } = await sb.from('packing_leftovers').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deletePackingLeftover(id) {
  const { error } = await sb.from('packing_leftovers').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}
