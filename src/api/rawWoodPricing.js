import sb from './client';

// ===== CRUD bảng giá gỗ nguyên liệu (legacy rules) =====

function mapRule(r) {
  return {
    id: r.id,
    rawWoodTypeId: r.raw_wood_type_id,
    quality: r.quality || null,
    sizeMin: r.size_min != null ? parseFloat(r.size_min) : null,
    sizeMax: r.size_max != null ? parseFloat(r.size_max) : null,
    unitPrice: parseFloat(r.unit_price) || 0,
    priceUnit: r.price_unit || 'm3',
    notes: r.notes || '',
    updatedBy: r.updated_by || '',
    updatedAt: r.updated_at,
    // joined
    rawWoodTypeName: r.raw_wood_types?.name || '',
    rawWoodTypeIcon: r.raw_wood_types?.icon || '',
    woodForm: r.raw_wood_types?.wood_form || '',
  };
}

export async function fetchRawWoodPricing() {
  const { data, error } = await sb.from('raw_wood_pricing')
    .select('*, raw_wood_types(name, icon, wood_form)')
    .order('raw_wood_type_id').order('quality').order('size_min');
  if (error) throw new Error(error.message);
  return (data || []).map(mapRule);
}

export async function addRawWoodPricingRule({ rawWoodTypeId, quality, sizeMin, sizeMax, unitPrice, priceUnit, notes, updatedBy }) {
  const { data, error } = await sb.from('raw_wood_pricing').insert({
    raw_wood_type_id: rawWoodTypeId,
    quality: quality || null,
    size_min: sizeMin != null ? sizeMin : null,
    size_max: sizeMax != null ? sizeMax : null,
    unit_price: unitPrice,
    price_unit: priceUnit || 'm3',
    notes: notes || null,
    updated_by: updatedBy || null,
    updated_at: new Date().toISOString(),
  }).select('*, raw_wood_types(name, icon, wood_form)').single();
  if (error) return { error: error.message };
  return { success: true, rule: mapRule(data) };
}

export async function updateRawWoodPricingRule(id, updates) {
  const row = {};
  if (updates.quality !== undefined) row.quality = updates.quality || null;
  if (updates.sizeMin !== undefined) row.size_min = updates.sizeMin;
  if (updates.sizeMax !== undefined) row.size_max = updates.sizeMax;
  if (updates.unitPrice !== undefined) row.unit_price = updates.unitPrice;
  if (updates.priceUnit !== undefined) row.price_unit = updates.priceUnit;
  if (updates.notes !== undefined) row.notes = updates.notes || null;
  if (updates.updatedBy !== undefined) row.updated_by = updates.updatedBy;
  row.updated_at = new Date().toISOString();
  const { error } = await sb.from('raw_wood_pricing').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteRawWoodPricingRule(id) {
  const { error } = await sb.from('raw_wood_pricing').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== CRUD raw_wood_price_config (formula-based pricing) =====

function mapConfig(r) {
  return {
    id: r.id,
    rawWoodTypeId: r.raw_wood_type_id,
    formulaType: r.formula_type,
    basePrice: r.base_price != null ? parseFloat(r.base_price) : null,
    measureVariable: r.measure_variable || null,
    measureCoefficient: r.measure_coefficient != null ? parseFloat(r.measure_coefficient) : 0.1,
    qualityConfig: r.quality_config || null,
    sizeTiers: r.size_tiers || null,
    volumeDiscounts: r.volume_discounts || null,
    saleModifiers: r.sale_modifiers || null,
    previewSizes: r.preview_sizes || null,
    tonToM3Ratio: r.ton_to_m3_ratio != null ? parseFloat(r.ton_to_m3_ratio) : null,
    notes: r.notes || '',
    updatedBy: r.updated_by || '',
    updatedAt: r.updated_at,
    // joined
    rawWoodTypeName: r.raw_wood_types?.name || '',
    rawWoodTypeIcon: r.raw_wood_types?.icon || '',
    woodForm: r.raw_wood_types?.wood_form || '',
  };
}

export async function fetchRawWoodPriceConfigs() {
  const { data, error } = await sb.from('raw_wood_price_config')
    .select('*, raw_wood_types(name, icon, wood_form)')
    .order('raw_wood_type_id');
  if (error) throw new Error(error.message);
  return (data || []).map(mapConfig);
}

export async function upsertRawWoodPriceConfig({ rawWoodTypeId, formulaType, basePrice, measureVariable, measureCoefficient, qualityConfig, sizeTiers, volumeDiscounts, saleModifiers, previewSizes, tonToM3Ratio, notes, updatedBy }) {
  const row = {
    raw_wood_type_id: rawWoodTypeId,
    formula_type: formulaType,
    base_price: basePrice != null ? basePrice : null,
    measure_variable: measureVariable || null,
    measure_coefficient: measureCoefficient != null ? measureCoefficient : 0.1,
    quality_config: qualityConfig || null,
    size_tiers: sizeTiers || null,
    volume_discounts: volumeDiscounts || null,
    sale_modifiers: saleModifiers || null,
    preview_sizes: previewSizes || null,
    ton_to_m3_ratio: tonToM3Ratio != null ? tonToM3Ratio : null,
    notes: notes || null,
    updated_by: updatedBy || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from('raw_wood_price_config')
    .upsert(row, { onConflict: 'raw_wood_type_id' })
    .select('*, raw_wood_types(name, icon, wood_form)')
    .single();
  if (error) return { error: error.message };
  return { success: true, config: mapConfig(data) };
}

export async function deleteRawWoodPriceConfig(id) {
  const { error } = await sb.from('raw_wood_price_config').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== Resolve giá theo formula config =====

function matchSizeTier(size, tiers) {
  if (!tiers || !size) return 0;
  const tier = tiers.find(t =>
    (t.min == null || size >= t.min) && (t.max == null || size < t.max)
  );
  return tier ? (tier.adj || 0) : 0;
}

/**
 * Tính giá 1 cây/lô theo formula config.
 * @param {object} piece - { diameterCm, widthCm, quality, saleUnitPrice }
 * @param {object} config - raw_wood_price_config record (mapped)
 * @param {object} orderContext - { modifiers: {shape:'thẳng',...}, sizeTier: 'Chỉ lớn', totalVolume: 15 }
 * @returns {{ price: number, source: string, breakdown?: string[] }}
 */
export function resolveFormulaPrice(piece, config, orderContext = {}) {
  if (piece.saleUnitPrice != null) return { price: piece.saleUnitPrice, source: 'override' };
  if (!config) return { price: 0, source: 'none' };

  const size = piece.diameterCm || piece.widthCm || 0;
  const quality = piece.quality || '';
  const coeff = config.measureCoefficient ?? 0.1;
  let price = 0;
  const breakdown = [];

  switch (config.formulaType) {
    case 'flat':
      price = config.basePrice || 0;
      breakdown.push(`Giá cố định: ${price}`);
      break;

    case 'base_plus_measure': {
      const base = config.basePrice || 0;
      const sizeAdj = coeff * size;
      price = base + sizeAdj;
      breakdown.push(`Cơ sở: ${base}`);
      if (size && coeff) breakdown.push(`+ ${coeff} × ${size}cm = ${sizeAdj.toFixed(2)}`);

      // Quality surcharge
      const qs = config.qualityConfig?.[quality]?.surcharge;
      if (qs) { price += qs; breakdown.push(`+ CL "${quality}": +${qs}`); }

      // Size tier adjustment
      const stAdj = matchSizeTier(size, config.sizeTiers);
      if (stAdj) { price += stAdj; breakdown.push(`+ Cấp kính: ${stAdj > 0 ? '+' : ''}${stAdj}`); }
      break;
    }

    case 'quality_matrix': {
      const qEntry = config.qualityConfig?.[quality];
      if (qEntry?.base == null) return { price: 0, source: 'none', breakdown: [`Không tìm thấy CL "${quality}"`] };
      price = qEntry.base;
      breakdown.push(`CL "${quality}" cơ sở: ${qEntry.base}`);

      // + coefficient × size
      if (size && coeff) {
        const sizeVal = coeff * size;
        price += sizeVal;
        breakdown.push(`+ ${coeff} × ${size}cm = ${sizeVal.toFixed(2)}`);
      }

      // + size tier (nested per quality, fallback top-level)
      const sizeTiers = qEntry.sizeTiers?.length ? qEntry.sizeTiers : config.sizeTiers;
      const stAdj = matchSizeTier(size, sizeTiers);
      if (stAdj) { price += stAdj; breakdown.push(`+ Cấp kính: ${stAdj > 0 ? '+' : ''}${stAdj}`); }

      // + sale modifiers (nested per quality, fallback top-level)
      const modifiers = qEntry.modifiers?.length ? qEntry.modifiers : (config.saleModifiers || []);
      for (const mod of modifiers) {
        const val = orderContext.modifiers?.[mod.name];
        const opt = mod.options?.find(o => o.value === val);
        if (opt && opt.adj) { price += opt.adj; breakdown.push(`+ ${mod.label} "${val}": ${opt.adj > 0 ? '+' : ''}${opt.adj}`); }
      }
      break;
    }

    case 'volume_tier': {
      price = config.basePrice || 0;
      breakdown.push(`Giá lẻ: ${price}`);

      // Size tier (chọn level đơn hàng, VD: "Chỉ nhỏ", "Chỉ lớn")
      if (orderContext.sizeTier) {
        const tier = config.sizeTiers?.find(t => t.label === orderContext.sizeTier);
        if (tier && tier.adj) { price += tier.adj; breakdown.push(`+ ${tier.label}: ${tier.adj > 0 ? '+' : ''}${tier.adj}`); }
      }

      // Volume discount
      for (const vd of config.volumeDiscounts || []) {
        if ((orderContext.totalVolume || 0) >= vd.min_m3) {
          price += vd.adj;
          breakdown.push(`+ ${vd.label}: ${vd.adj > 0 ? '+' : ''}${vd.adj}`);
        }
      }
      break;
    }

    default:
      return { price: 0, source: 'none' };
  }

  // quality_matrix và volume_tier chỉ tham khảo, không áp tự động
  const isRef = config.formulaType === 'quality_matrix' || config.formulaType === 'volume_tier';
  return { price: Math.round(price * 100) / 100, source: isRef ? 'reference' : 'formula', breakdown };
}

// ===== Resolve giá cho 1 cây gỗ (hybrid: config trước, legacy rules fallback) =====
// Priority: override > formula config > legacy rules > 0
export function resolveRawWoodPrice(piece, pricingRules, priceConfigs = [], orderContext = {}) {
  // 1. Override per-piece
  if (piece.saleUnitPrice != null) return { price: piece.saleUnitPrice, source: 'override' };

  // 2. Formula config (mới) — chỉ dùng formula auto-price, skip reference (tham khảo)
  if (priceConfigs.length > 0) {
    const cfg = priceConfigs.find(c => c.rawWoodTypeId === piece.rawWoodTypeId);
    if (cfg) {
      const result = resolveFormulaPrice(piece, cfg, orderContext);
      if (result.price > 0 && result.source === 'formula') return result;
    }
  }

  // 3. Legacy rules (fallback)
  const typeRules = pricingRules.filter(r => r.rawWoodTypeId === piece.rawWoodTypeId);
  if (!typeRules.length) return { price: 0, source: 'none' };

  const size = piece.diameterCm || piece.widthCm || 0;
  const quality = piece.quality || '';

  const candidates = typeRules.filter(r => {
    const qualityMatch = !r.quality || r.quality === quality;
    const sizeMatch = (r.sizeMin == null || size >= r.sizeMin) && (r.sizeMax == null || size <= r.sizeMax);
    return qualityMatch && sizeMatch;
  });

  candidates.sort((a, b) => {
    if (a.quality && !b.quality) return -1;
    if (!a.quality && b.quality) return 1;
    const rangeA = (a.sizeMax || 999) - (a.sizeMin || 0);
    const rangeB = (b.sizeMax || 999) - (b.sizeMin || 0);
    return rangeA - rangeB;
  });

  if (candidates.length > 0) return { price: candidates[0].unitPrice, source: 'legacy', rule: candidates[0] };
  return { price: 0, source: 'none' };
}

// ===== Giá container =====
export async function updateContainerSalePrice(containerId, saleUnitPrice, saleNotes) {
  const { error } = await sb.from('containers').update({
    sale_unit_price: saleUnitPrice != null ? saleUnitPrice : null,
    sale_notes: saleNotes || null,
  }).eq('id', containerId);
  return error ? { error: error.message } : { success: true };
}

// ===== Giá per-piece (admin override) =====
export async function updatePieceSalePrice(inspectionId, saleUnitPrice) {
  const { error } = await sb.from('raw_wood_inspection').update({
    sale_unit_price: saleUnitPrice != null ? saleUnitPrice : null,
  }).eq('id', inspectionId);
  return error ? { error: error.message } : { success: true };
}

// Batch update giá cho tất cả cây trong container (áp dụng formula)
export async function applyFormulaPricesToContainer(containerId, pricingRules) {
  const { data: pieces, error } = await sb.from('raw_wood_inspection')
    .select('id, diameter_cm, width_cm, quality, sale_unit_price')
    .eq('container_id', containerId)
    .eq('status', 'available')
    .eq('is_missing', false);
  if (error) return { error: error.message };

  let updated = 0;
  for (const p of (pieces || [])) {
    const resolved = resolveRawWoodPrice({
      diameterCm: p.diameter_cm ? parseFloat(p.diameter_cm) : null,
      widthCm: p.width_cm ? parseFloat(p.width_cm) : null,
      quality: p.quality,
      rawWoodTypeId: null,
      saleUnitPrice: null,
    }, pricingRules);
    if (resolved.price > 0) {
      await sb.from('raw_wood_inspection').update({ sale_unit_price: resolved.price }).eq('id', p.id);
      updated++;
    }
  }
  return { success: true, updated };
}
