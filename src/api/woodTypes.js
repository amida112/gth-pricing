import sb from './client';

// ===== WOOD SPECIES =====

export async function fetchWoodSpecies() {
  const { data, error } = await sb.from('wood_species').select('*').order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ id: r.id, name: r.name, nameEn: r.name_en, icon: r.icon || '', sortOrder: r.sort_order }));
}

export async function addWoodSpecies(id, name, nameEn, icon) {
  const { data: existing } = await sb.from('wood_species').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const nextOrder = existing?.length ? (existing[0].sort_order + 1) : 0;
  const { error } = await sb.from('wood_species').insert({ id, name, name_en: nameEn, icon: icon || '🌳', sort_order: nextOrder });
  return error ? { error: error.message } : { success: true };
}

export async function updateWoodSpecies(id, name, nameEn, icon) {
  const { error } = await sb.from('wood_species').update({ name, name_en: nameEn, icon: icon || '🌳' }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteWoodSpecies(id) {
  const { error } = await sb.from('wood_species').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== WOOD TYPES =====

export async function fetchWoodTypes() {
  const { data, error } = await sb.from('wood_types').select('*').order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ id: r.id, name: r.name, nameEn: r.name_en, icon: r.icon, code: r.code || "", unit: r.unit || 'm3', thicknessMode: r.thickness_mode || 'fixed', speciesId: r.species_id || null, productForm: r.product_form || 'imported' }));
}

export async function addWoodType(id, name, nameEn, icon, code, unit, thicknessMode, speciesId, productForm) {
  const { data: existing } = await sb.from('wood_types').select('sort_order').order('sort_order', { ascending: false }).limit(1);
  const nextOrder = existing?.length ? (existing[0].sort_order + 1) : 0;
  const { error } = await sb.from('wood_types').insert({ id, name, name_en: nameEn, icon, code: code || null, sort_order: nextOrder, unit: unit || 'm3', thickness_mode: thicknessMode || 'fixed', species_id: speciesId || null, product_form: productForm || 'imported' });
  return error ? { error: error.message } : { success: true };
}

export async function apiUpdateWoodType(id, name, nameEn, icon, code, thicknessMode, speciesId, productForm) {
  const row = { name, name_en: nameEn, icon, code: code || null };
  if (thicknessMode) row.thickness_mode = thicknessMode;
  if (speciesId !== undefined) row.species_id = speciesId || null;
  if (productForm !== undefined) row.product_form = productForm;
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
