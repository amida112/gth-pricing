import sb from './client';

// ===== PRICE BATCHES =====

/** Lấy danh sách đợt giá của 1 loại gỗ */
export async function fetchPriceBatches(woodId, limit = 10) {
  const { data, error } = await sb.rpc('get_price_batches', { p_wood_id: woodId, p_limit: limit });
  if (error) throw new Error(error.message);
  return data || [];
}

/** Lấy chi tiết change_log của 1 đợt */
export async function fetchBatchChanges(batchId) {
  const { data, error } = await sb.from('change_log')
    .select('*')
    .eq('batch_id', batchId)
    .order('timestamp', { ascending: false });
  if (error) throw new Error(error.message);
  return data || [];
}

/** Lấy delta so sánh giá hiện tại vs 1 đợt */
export async function fetchPriceDeltas(woodId, batchId) {
  const { data, error } = await sb.rpc('get_price_deltas', { p_wood_id: woodId, p_batch_id: batchId });
  if (error) throw new Error(error.message);
  // Convert to map: { sku_key → { currentPrice, batchPrice, delta, isNew } }
  const map = {};
  (data || []).forEach(r => {
    map[r.sku_key] = {
      currentPrice: r.current_price != null ? parseFloat(r.current_price) : null,
      batchPrice: r.batch_price != null ? parseFloat(r.batch_price) : null,
      delta: r.delta != null ? parseFloat(r.delta) : null,
      isNew: r.is_new,
    };
  });
  return map;
}

/** Tạo đợt mới, trả về batch id */
export async function createPriceBatch(woodId, reason) {
  const { data, error } = await sb.from('price_batches')
    .insert({ wood_id: woodId, reason })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return data.id;
}

/** Gộp đợt nguồn vào đợt đích (chuyển change_log + xóa đợt nguồn) */
export async function mergeBatches(targetBatchId, sourceBatchId) {
  // Chuyển tất cả change_log từ source → target
  const { error: e1 } = await sb.from('change_log')
    .update({ batch_id: targetBatchId })
    .eq('batch_id', sourceBatchId);
  if (e1) throw new Error(e1.message);
  // Cập nhật updated_at của target
  const { error: e2 } = await sb.from('price_batches')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', targetBatchId);
  if (e2) throw new Error(e2.message);
  // Xóa đợt nguồn
  const { error: e3 } = await sb.from('price_batches')
    .delete()
    .eq('id', sourceBatchId);
  if (e3) throw new Error(e3.message);
  return { success: true };
}

/** Lấy đợt gần nhất của 1 loại gỗ (cho gợi ý gộp) */
export async function fetchLatestBatch(woodId) {
  const { data, error } = await sb.from('price_batches')
    .select('id, reason, created_at, updated_at')
    .eq('wood_id', woodId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  // Đếm SKU trong đợt
  const { count } = await sb.from('change_log')
    .select('id', { count: 'exact', head: true })
    .eq('batch_id', data.id);
  return { ...data, skuCount: count || 0 };
}
