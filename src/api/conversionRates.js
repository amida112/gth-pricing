import sb from './client';

// ===== WOOD CONVERSION RATES (BẢNG QUY ĐỔI kg/m³) =====

export async function fetchConversionRates() {
  const { data, error } = await sb.from('wood_conversion_rates').select('*').order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, woodTypeId: r.wood_type_id || null, name: r.name,
    rate: r.rate != null ? parseFloat(r.rate) : 0,
    thicknessMin: r.thickness_min || null,
    notes: r.notes, sortOrder: r.sort_order || 0, updatedAt: r.updated_at,
  }));
}

export async function addConversionRate(woodTypeId, name, rate, thicknessMin, notes) {
  const { data: maxRow } = await sb.from('wood_conversion_rates').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const nextOrder = maxRow?.length ? (maxRow[0].sort_order + 1) : 0;
  const { data, error } = await sb.from('wood_conversion_rates').insert({
    wood_type_id: woodTypeId || null, name, rate, thickness_min: thicknessMin || null, notes: notes || null, sort_order: nextOrder,
  }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function updateConversionRate(id, woodTypeId, name, rate, thicknessMin, notes) {
  const { error } = await sb.from('wood_conversion_rates').update({
    wood_type_id: woodTypeId || null, name, rate, thickness_min: thicknessMin || null, notes: notes || null, updated_at: new Date().toISOString(),
  }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteConversionRate(id) {
  const { error } = await sb.from('wood_conversion_rates').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// Recalc volume_m3 cho kiln_items theo conversion rates mới
export async function recalcKilnItemVolumes(conversionRates) {
  const { data: activeBatches } = await sb.from('kiln_batches').select('id').neq('status', 'Đã ra hết');
  if (!activeBatches?.length) return { updated: 0 };
  const batchIds = activeBatches.map(b => b.id);
  const { data: items, error } = await sb.from('kiln_items').select('id,wood_type_id,thickness_cm,weight_kg').in('batch_id', batchIds);
  if (error || !items?.length) return { updated: 0 };

  let updated = 0;
  for (const item of items) {
    if (!item.wood_type_id) continue;
    const thickNum = item.thickness_cm != null ? parseFloat(item.thickness_cm) : NaN;
    const matches = conversionRates.filter(cr => cr.woodTypeId === item.wood_type_id);
    if (!matches.length) continue;
    let best = matches.find(cr => !cr.thicknessMin);
    if (!isNaN(thickNum)) {
      const thickMatch = matches.find(cr => { if (!cr.thicknessMin) return false; const min = parseFloat(String(cr.thicknessMin).replace(/[^\d.]/g, '')); return !isNaN(min) && thickNum >= min; });
      if (thickMatch) best = thickMatch;
    }
    if (!best) best = matches[0];
    const rate = best.rate;
    const vol = rate > 0 ? (parseFloat(item.weight_kg) || 0) / rate : 0;
    await sb.from('kiln_items').update({ conversion_rate: rate, volume_m3: vol }).eq('id', item.id);
    updated++;
  }
  return { updated };
}
