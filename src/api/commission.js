import sb from './client';

// ===== COMMISSION WOOD RATES (hệ số mặc định/gỗ) =====

export async function fetchCommissionWoodRates() {
  const { data, error } = await sb.from('commission_wood_rates').select('*').order('wood_type_id');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ id: r.id, woodTypeId: r.wood_type_id, category: r.category, pointsPerM3: Number(r.points_per_m3) || 0 }));
}

export async function upsertCommissionWoodRate(woodTypeId, category, pointsPerM3) {
  const { error } = await sb.from('commission_wood_rates')
    .upsert({ wood_type_id: woodTypeId, category, points_per_m3: pointsPerM3 }, { onConflict: 'wood_type_id,category' });
  return error ? { error: error.message } : { success: true };
}

export async function deleteCommissionWoodRate(id) {
  const { error } = await sb.from('commission_wood_rates').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== SKU OVERRIDES =====

export async function fetchCommissionSkuOverrides() {
  const { data, error } = await sb.from('commission_sku_overrides').select('*').order('wood_type_id');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ id: r.id, woodTypeId: r.wood_type_id, skuPattern: r.sku_pattern, pointsPerM3: Number(r.points_per_m3) || 0, note: r.note || '' }));
}

export async function addCommissionSkuOverride(woodTypeId, skuPattern, pointsPerM3, note) {
  const { data, error } = await sb.from('commission_sku_overrides')
    .insert({ wood_type_id: woodTypeId, sku_pattern: skuPattern, points_per_m3: pointsPerM3, note: note || null }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function updateCommissionSkuOverride(id, skuPattern, pointsPerM3, note) {
  const { error } = await sb.from('commission_sku_overrides')
    .update({ sku_pattern: skuPattern, points_per_m3: pointsPerM3, note: note || null }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteCommissionSkuOverride(id) {
  const { error } = await sb.from('commission_sku_overrides').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== CONTAINER TIERS =====

export async function fetchCommissionContainerTiers() {
  const { data, error } = await sb.from('commission_container_tiers').select('*').order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, isAtPrice: r.is_at_price ?? false, isFallback: r.is_fallback ?? false,
    maxBelowPrice: r.max_below_price != null ? Number(r.max_below_price) : null,
    amount: Number(r.amount) || 0, rawWoodTypeId: r.raw_wood_type_id || null,
    note: r.note || '', sortOrder: r.sort_order,
  }));
}

export async function saveContainerTier(id, tier) {
  const row = {
    is_at_price: !!tier.isAtPrice, is_fallback: !!tier.isFallback,
    max_below_price: tier.maxBelowPrice ?? null,
    amount: tier.amount || 0, raw_wood_type_id: tier.rawWoodTypeId || null,
    note: tier.note || null, sort_order: tier.sortOrder || 0,
    min_diff: 0, max_diff: 0, points: 0,
  };
  if (id) {
    const { error } = await sb.from('commission_container_tiers').update(row).eq('id', id);
    return error ? { error: error.message } : { success: true };
  }
  const { data, error } = await sb.from('commission_container_tiers').insert(row).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function deleteCommissionContainerTier(id) {
  const { error } = await sb.from('commission_container_tiers').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== COMMISSION SETTINGS =====

export async function fetchCommissionSettings() {
  const { data, error } = await sb.from('commission_settings').select('*');
  if (error) throw new Error(error.message);
  const map = {};
  (data || []).forEach(r => { map[r.key] = { value: Number(r.value) || 0, description: r.description }; });
  return map;
}

export async function saveCommissionSetting(key, value, description) {
  const { error } = await sb.from('commission_settings')
    .upsert({ key, value, description, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return error ? { error: error.message } : { success: true };
}

// ===== TÍNH ĐIỂM HOA HỒNG =====

/**
 * Match SKU pattern (partial): kiểm tra bundle's skuKey chứa tất cả segments trong pattern.
 * Pattern: "supplier:Missouri||thickness:2F" → match nếu skuKey chứa cả 2 segment.
 */
export function matchSkuPattern(skuKey, pattern) {
  if (!pattern || !skuKey) return false;
  const segments = pattern.split('||').filter(Boolean);
  return segments.every(seg => skuKey.split('||').includes(seg));
}

/**
 * Resolve hệ số điểm cho 1 bundle.
 * Ưu tiên: SKU override (match nhiều segment nhất) > mặc định loại gỗ > 0.
 */
export function resolvePointsPerM3(woodTypeId, skuKey, woodRates, skuOverrides) {
  // Tìm override match nhiều segment nhất
  const matches = skuOverrides
    .filter(o => o.woodTypeId === woodTypeId && matchSkuPattern(skuKey, o.skuPattern))
    .sort((a, b) => b.skuPattern.split('||').length - a.skuPattern.split('||').length);
  if (matches.length) return matches[0].pointsPerM3;
  // Fallback: mặc định loại gỗ
  const woodRate = woodRates.find(r => r.woodTypeId === woodTypeId && r.category === 'bundle');
  return woodRate?.pointsPerM3 || 0;
}

/**
 * Resolve hoa hồng container (VNĐ trực tiếp).
 * belowPrice: số tiền dưới giá/m³ (số dương, 0 = đúng giá)
 */
export function resolveContainerCommission(belowPricePerM3, tiers) {
  if (belowPricePerM3 <= 0) {
    const atPrice = tiers.find(t => t.isAtPrice);
    return atPrice?.amount || 0;
  }
  // Tìm mốc phù hợp: dưới giá ≤ maxBelowPrice
  const midTiers = tiers.filter(t => !t.isAtPrice && !t.isFallback && t.maxBelowPrice != null)
    .sort((a, b) => a.maxBelowPrice - b.maxBelowPrice);
  for (const t of midTiers) {
    if (belowPricePerM3 <= t.maxBelowPrice) return t.amount;
  }
  // Fallback
  const fallback = tiers.find(t => t.isFallback);
  return fallback?.amount || 0;
}
