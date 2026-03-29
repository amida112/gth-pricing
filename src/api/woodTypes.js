import sb from './client';

// ===== WOOD TYPES =====

export async function fetchWoodTypes() {
  const { data, error } = await sb.from('wood_types').select('*').order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ id: r.id, name: r.name, nameEn: r.name_en, icon: r.icon, code: r.code || "", unit: r.unit || 'm3', thicknessMode: r.thickness_mode || 'fixed' }));
}

export async function addWoodType(id, name, nameEn, icon, code, unit, thicknessMode) {
  const { data: existing } = await sb.from('wood_types').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const nextOrder = existing?.length ? (existing[0].sort_order + 1) : 0;
  const { error } = await sb.from('wood_types').insert({ id, name, name_en: nameEn, icon, code: code || null, sort_order: nextOrder, unit: unit || 'm3', thickness_mode: thicknessMode || 'fixed' });
  return error ? { error: error.message } : { success: true };
}

export async function apiUpdateWoodType(id, name, nameEn, icon, code, thicknessMode) {
  const row = { name, name_en: nameEn, icon, code: code || null };
  if (thicknessMode) row.thickness_mode = thicknessMode;
  const { error } = await sb.from('wood_types').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteWoodType(id) {
  const { error } = await sb.from('wood_types').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function updateWoodOrder(ids) {
  const updates = ids.map((id, i) => sb.from('wood_types').update({ sort_order: i }).eq('id', id));
  await Promise.all(updates);
  return { success: true };
}
