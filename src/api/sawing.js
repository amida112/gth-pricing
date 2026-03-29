import sb from './client';

// SAWING MODULE — Mẻ xẻ gỗ
// ══════════════════════════════════════════════════════════════

function mapSawingBatch(r) {
  return {
    id: r.id, batchCode: r.batch_code, woodId: r.wood_id,
    batchDate: r.batch_date, status: r.status, note: r.notes || r.note || null,
    createdBy: r.created_by, createdAt: r.created_at, updatedAt: r.updated_at,
  };
}
function mapSawingItem(r) {
  return {
    id: r.id, batchId: r.batch_id, thickness: r.thickness, quality: r.quality,
    targetVolume: parseFloat(r.target_volume) || 0,
    doneVolume: parseFloat(r.done_volume) || 0,
    note: r.note || null, priority: r.priority || 'normal',
    sortOrder: r.sort_order || 0, createdAt: r.created_at,
  };
}
function mapSawingLog(r) {
  return {
    id: r.id, sawingItemId: r.sawing_item_id, logDate: r.log_date,
    addedVolume: parseFloat(r.added_volume) || 0,
    loggedBy: r.logged_by, note: r.note, createdAt: r.created_at,
  };
}
function mapSawingRoundInput(r) {
  return {
    id: r.id, batchId: r.batch_id, inputDate: r.input_date,
    containerId: r.container_id, logCount: r.log_count || 0,
    volumeM3: parseFloat(r.volume_m3) || 0,
    roundQuality: r.round_quality, note: r.note,
    createdBy: r.created_by, createdAt: r.created_at,
  };
}

// ── Sawing Batches ──

export async function fetchSawingBatches() {
  const { data, error } = await sb.from('sawing_batches').select('*').order('batch_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapSawingBatch);
}

export async function addSawingBatch(fields) {
  const { data, error } = await sb.from('sawing_batches').insert({
    wood_id: fields.woodId, batch_date: fields.batchDate,
    status: 'sawing', note: fields.note || null, created_by: fields.createdBy || null,
  }).select().single();
  if (error) return { error: error.message };
  return mapSawingBatch(data);
}

export async function updateSawingBatch(id, fields) {
  const row = {};
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.note !== undefined) row.note = fields.note;
  row.updated_at = new Date().toISOString();
  const { error } = await sb.from('sawing_batches').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteSawingBatch(id) {
  // 1. Lấy danh sách sawing_items của batch để cleanup
  const { data: sItems } = await sb.from('sawing_items').select('id').eq('batch_id', id);
  const sItemIds = (sItems || []).map(i => i.id);

  // 2. Clear kiln_items.sawing_item_id (tránh FK violation nếu chưa có ON DELETE SET NULL)
  if (sItemIds.length) {
    await sb.from('kiln_items').update({ sawing_item_id: null }).in('sawing_item_id', sItemIds);
  }

  // 3. Clear raw_wood_packing_list.sawing_batch_id (reset về chưa chọn)
  await sb.from('raw_wood_packing_list')
    .update({ sawing_batch_id: null, sawn_date: null })
    .eq('sawing_batch_id', id);

  // 4. Xóa batch (cascade xóa sawing_items, sawing_daily_logs, sawing_round_inputs)
  const { error } = await sb.from('sawing_batches').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// Lấy kiln_items liên kết đến các sawing_items của 1 batch (để cảnh báo trước khi xóa)
export async function fetchKilnItemsLinkedToBatch(batchId) {
  const { data: sItems } = await sb.from('sawing_items').select('id,thickness,quality').eq('batch_id', batchId);
  if (!sItems?.length) return [];
  const sItemIds = sItems.map(i => i.id);
  const sItemMap = Object.fromEntries(sItems.map(i => [i.id, i]));
  const { data: kItems } = await sb.from('kiln_items')
    .select('id,item_code,batch_id,wood_type_id,thickness_cm,volume_m3,sawing_item_id')
    .in('sawing_item_id', sItemIds);
  return (kItems || []).map(k => ({
    ...k,
    sawingThickness: sItemMap[k.sawing_item_id]?.thickness,
    sawingQuality: sItemMap[k.sawing_item_id]?.quality,
  }));
}

// ── Sawing Items ──

export async function fetchSawingItems(batchId) {
  const q = sb.from('sawing_items').select('*').order('sort_order').order('created_at');
  if (batchId) q.eq('batch_id', batchId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mapSawingItem);
}

export async function addSawingItem(batchId, item) {
  const { data, error } = await sb.from('sawing_items').insert({
    batch_id: batchId, thickness: item.thickness, quality: item.quality,
    target_volume: item.targetVolume || 0, note: item.note || null,
    priority: item.priority || 'normal', sort_order: item.sortOrder || 0,
  }).select().single();
  if (error) return { error: error.message };
  return mapSawingItem(data);
}

export async function updateSawingItem(id, fields) {
  const row = {};
  if (fields.thickness !== undefined) row.thickness = fields.thickness;
  if (fields.quality !== undefined) row.quality = fields.quality;
  if (fields.targetVolume !== undefined) row.target_volume = fields.targetVolume;
  if (fields.note !== undefined) row.note = fields.note;
  if (fields.priority !== undefined) row.priority = fields.priority;
  if (fields.sortOrder !== undefined) row.sort_order = fields.sortOrder;
  const { error } = await sb.from('sawing_items').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteSawingItem(id) {
  const { error } = await sb.from('sawing_items').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ── Sawing Daily Logs ──

export async function fetchSawingDailyLogs(sawingItemId) {
  const q = sb.from('sawing_daily_logs').select('*').order('log_date', { ascending: false }).order('created_at', { ascending: false });
  if (sawingItemId) q.eq('sawing_item_id', sawingItemId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mapSawingLog);
}

export async function fetchSawingDailyLogsByBatch(batchId) {
  // Fetch all logs for all items of a batch
  const { data: items } = await sb.from('sawing_items').select('id').eq('batch_id', batchId);
  if (!items?.length) return [];
  const itemIds = items.map(i => i.id);
  const { data, error } = await sb.from('sawing_daily_logs').select('*')
    .in('sawing_item_id', itemIds).order('log_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(mapSawingLog);
}

export async function addSawingDailyLog(sawingItemId, addedVolume, logDate, loggedBy, note) {
  const { data, error } = await sb.from('sawing_daily_logs').insert({
    sawing_item_id: sawingItemId,
    added_volume: addedVolume,
    log_date: logDate || new Date().toISOString().slice(0, 10),
    logged_by: loggedBy || null,
    note: note || null,
  }).select().single();
  if (error) return { error: error.message };
  return mapSawingLog(data);
}

export async function deleteSawingDailyLog(id) {
  const { error } = await sb.from('sawing_daily_logs').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ── Sawing Round Inputs (Gỗ tròn đầu vào) ──

export async function fetchSawingRoundInputs(batchId) {
  const q = sb.from('sawing_round_inputs').select('*').order('input_date', { ascending: false });
  if (batchId) q.eq('batch_id', batchId);
  const { data, error } = await q;
  if (error) throw error;
  return (data || []).map(mapSawingRoundInput);
}

export async function addSawingRoundInput(batchId, fields) {
  const { data, error } = await sb.from('sawing_round_inputs').insert({
    batch_id: batchId,
    input_date: fields.inputDate || new Date().toISOString().slice(0, 10),
    container_id: fields.containerId || null,
    log_count: fields.logCount || 0,
    volume_m3: fields.volumeM3 || 0,
    round_quality: fields.roundQuality || null,
    note: fields.note || null,
    created_by: fields.createdBy || null,
  }).select().single();
  if (error) return { error: error.message };
  // Trừ remaining_volume của container
  if (fields.containerId && fields.volumeM3) {
    await sb.rpc('decrement_container_remaining', {
      cid: fields.containerId, vol: fields.volumeM3,
    }).catch(() => {});
  }
  return mapSawingRoundInput(data);
}

export async function deleteSawingRoundInput(id) {
  const { data: row } = await sb.from('sawing_round_inputs').select('container_id,volume_m3').eq('id', id).single();
  const { error } = await sb.from('sawing_round_inputs').delete().eq('id', id);
  if (error) return { error: error.message };
  // Hoàn lại remaining_volume
  if (row?.container_id && row?.volume_m3) {
    await sb.rpc('increment_container_remaining', {
      cid: row.container_id, vol: row.volume_m3,
    }).catch(() => {});
  }
  return { success: true };
}

// Fetch raw_wood containers còn tồn kho (cargo_type = 'raw_round')
export async function fetchRawWoodStock() {
  const { data, error } = await sb
    .from('containers')
    .select('id,container_code,cargo_type,total_volume,remaining_volume,weight_unit,ton_to_m3_factor,raw_wood_type_id,ncc_id,arrival_date,status,notes')
    .eq('cargo_type', 'raw_round')
    .order('arrival_date', { ascending: false });
  if (error) throw error;
  return (data || []).map(r => ({
    id: r.id, containerCode: r.container_code, cargoType: r.cargo_type,
    totalVolume: parseFloat(r.total_volume) || 0,
    remainingVolume: r.remaining_volume != null ? parseFloat(r.remaining_volume) : null,
    weightUnit: r.weight_unit || 'm3',
    tonToM3Factor: r.ton_to_m3_factor ? parseFloat(r.ton_to_m3_factor) : null,
    rawWoodTypeId: r.raw_wood_type_id || null,
    nccId: r.ncc_id, arrivalDate: r.arrival_date, status: r.status, notes: r.notes,
  }));
}

// Lấy sawing items có thể đưa vào lò: done_volume > 0, kèm volume đã dùng trong kiln
export async function fetchSawingItemsForKiln() {
  // Fetch active sawing items
  const { data: batches } = await sb.from('sawing_batches').select('id,wood_id,batch_code,batch_date').eq('status', 'sawing');
  if (!batches?.length) return [];
  const batchIds = batches.map(b => b.id);
  const { data: sitems } = await sb.from('sawing_items').select('*').in('batch_id', batchIds);
  if (!sitems?.length) return [];
  // Tính volume đã nạp vào kiln
  const sitemIds = sitems.map(i => i.id);
  const { data: kilnUsage } = await sb.from('kiln_items').select('sawing_item_id,volume_m3').in('sawing_item_id', sitemIds);
  const usedMap = {};
  (kilnUsage || []).forEach(k => {
    usedMap[k.sawing_item_id] = (usedMap[k.sawing_item_id] || 0) + (parseFloat(k.volume_m3) || 0);
  });
  const batchMap = Object.fromEntries(batches.map(b => [b.id, b]));
  return sitems.map(r => {
    const b = batchMap[r.batch_id] || {};
    const done = parseFloat(r.done_volume) || 0;
    const used = usedMap[r.id] || 0;
    const available = Math.max(0, done - used);
    return {
      id: r.id, batchId: r.batch_id, batchCode: b.batch_code, batchDate: b.batch_date,
      woodId: b.wood_id, thickness: r.thickness, quality: r.quality,
      targetVolume: parseFloat(r.target_volume) || 0,
      doneVolume: done, usedInKiln: used, available,
      priority: r.priority || 'normal', note: r.note,
    };
  }).filter(i => i.doneVolume > 0); // chỉ hiện item đã xẻ được
}
