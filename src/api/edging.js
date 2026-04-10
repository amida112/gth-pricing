import sb from './client';

// ===== EDGING BATCHES (MẺ DONG CẠNH) =====

function mapEdgingBatch(r) {
  return {
    id: r.id, batchCode: r.batch_code, batchDate: r.batch_date,
    woodTypeId: r.wood_type_id, thickness: r.thickness,
    parentBatchId: r.parent_batch_id, batchSeq: r.batch_seq || 1,
    status: r.status || 'Đang xử lý',
    totalInputVolume: r.total_input_volume != null ? parseFloat(r.total_input_volume) : 0,
    totalInputBoards: r.total_input_boards || 0,
    totalOutputVolume: r.total_output_volume != null ? parseFloat(r.total_output_volume) : 0,
    totalOutputBoards: r.total_output_boards || 0,
    notes: r.notes, createdBy: r.created_by,
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

function mapEdgingInput(r) {
  return {
    id: r.id, batchId: r.batch_id, bundleId: r.bundle_id,
    inputVolume: r.input_volume != null ? parseFloat(r.input_volume) : 0,
    inputBoards: r.input_boards || 0,
    createdAt: r.created_at,
  };
}

function mapEdgingLeftover(r) {
  return {
    id: r.id, leftoverCode: r.leftover_code,
    sourceBatchId: r.source_batch_id,
    woodTypeId: r.wood_type_id, thickness: r.thickness,
    quality: r.quality,
    volumeM3: r.volume_m3 != null ? parseFloat(r.volume_m3) : 0,
    boardCount: r.board_count || 0,
    status: r.status || 'Chờ xử lý',
    usedInBatchId: r.used_in_batch_id,
    notes: r.notes, createdAt: r.created_at,
  };
}

// ── Edging Batches ──

export async function fetchEdgingBatches() {
  const { data, error } = await sb.from('edging_batches').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapEdgingBatch);
}

export async function addEdgingBatch({ batchCode, batchDate, woodTypeId, thickness, parentBatchId, batchSeq, notes, createdBy }) {
  const { data, error } = await sb.from('edging_batches').insert({
    batch_code: batchCode || '',
    batch_date: batchDate || new Date().toISOString().slice(0, 10),
    wood_type_id: woodTypeId || null,
    thickness: thickness || null,
    parent_batch_id: parentBatchId || null,
    batch_seq: batchSeq || 1,
    notes: notes || null,
    created_by: createdBy || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id, batchCode: data.batch_code };
}

export async function updateEdgingBatch(id, fields) {
  const row = {};
  if (fields.batchDate !== undefined) row.batch_date = fields.batchDate;
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.totalInputVolume !== undefined) row.total_input_volume = fields.totalInputVolume;
  if (fields.totalInputBoards !== undefined) row.total_input_boards = fields.totalInputBoards;
  if (fields.totalOutputVolume !== undefined) row.total_output_volume = fields.totalOutputVolume;
  if (fields.totalOutputBoards !== undefined) row.total_output_boards = fields.totalOutputBoards;
  if (fields.notes !== undefined) row.notes = fields.notes || null;
  row.updated_at = new Date().toISOString();
  const { error } = await sb.from('edging_batches').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteEdgingBatch(id) {
  const { error } = await sb.from('edging_batches').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ── Edging Batch Inputs ──

export async function fetchEdgingInputs(batchId) {
  const q = sb.from('edging_batch_inputs').select('*').order('created_at');
  if (batchId) q.eq('batch_id', batchId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(mapEdgingInput);
}

export async function addEdgingInput(batchId, bundleId, inputVolume, inputBoards) {
  const { data, error } = await sb.from('edging_batch_inputs').insert({
    batch_id: batchId, bundle_id: bundleId,
    input_volume: inputVolume, input_boards: inputBoards,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function addEdgingInputsBatch(batchId, items) {
  const rows = items.map(it => ({
    batch_id: batchId, bundle_id: it.bundleId,
    input_volume: it.volume, input_boards: it.boardCount,
  }));
  const { data, error } = await sb.from('edging_batch_inputs').insert(rows).select();
  return error ? { error: error.message } : { success: true, items: (data || []).map(mapEdgingInput) };
}

export async function deleteEdgingInput(id) {
  const { error } = await sb.from('edging_batch_inputs').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ── Edging Leftovers (Bán thành phẩm) ──

export async function fetchEdgingLeftovers(batchId) {
  const q = sb.from('edging_leftovers').select('*').order('created_at');
  if (batchId) q.eq('source_batch_id', batchId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(mapEdgingLeftover);
}

export async function fetchAllEdgingLeftovers() {
  const { data, error } = await sb.from('edging_leftovers').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data || []).map(mapEdgingLeftover);
}

export async function addEdgingLeftover(sourceBatchId, { woodTypeId, thickness, quality, volumeM3, boardCount, notes }) {
  const { data, error } = await sb.from('edging_leftovers').insert({
    leftover_code: '',
    source_batch_id: sourceBatchId,
    wood_type_id: woodTypeId || null,
    thickness: thickness || null,
    quality: quality || null,
    volume_m3: volumeM3 || 0,
    board_count: boardCount || 0,
    notes: notes || null,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id, leftoverCode: data.leftover_code };
}

export async function updateEdgingLeftover(id, fields) {
  const row = {};
  if (fields.status !== undefined) row.status = fields.status;
  if (fields.usedInBatchId !== undefined) row.used_in_batch_id = fields.usedInBatchId || null;
  if (fields.quality !== undefined) row.quality = fields.quality || null;
  if (fields.volumeM3 !== undefined) row.volume_m3 = fields.volumeM3;
  if (fields.boardCount !== undefined) row.board_count = fields.boardCount;
  if (fields.notes !== undefined) row.notes = fields.notes || null;
  const { error } = await sb.from('edging_leftovers').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteEdgingLeftover(id) {
  const { error } = await sb.from('edging_leftovers').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ── Realtime ──

export function subscribeEdgingBatches(callback) {
  return sb.channel('edging_batches_changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'edging_batches' }, callback)
    .subscribe();
}
