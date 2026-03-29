import sb from './client';

// ===== PRODUCT CATALOG =====

export async function fetchProductCatalog() {
  const { data, error } = await sb.from('product_catalog').select('*').order('sort_order');
  if (error) return [];
  return (data || []).map(r => ({ id: r.id, name: r.name, sortOrder: r.sort_order ?? 0 }));
}

export async function upsertProductCatalogItem(id, name, sortOrder) {
  const { error } = await sb.from('product_catalog').upsert({ id, name, sort_order: sortOrder ?? 0 }, { onConflict: 'id' });
  return error ? { error: error.message } : { success: true };
}

export async function deleteProductCatalogItem(id) {
  const { error } = await sb.from('product_catalog').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== PREFERENCE CATALOG =====

export async function fetchPreferenceCatalog() {
  const { data, error } = await sb.from('preference_catalog').select('*').order('sort_order');
  if (error) return [];
  return (data || []).map(r => ({ id: r.id, name: r.name, sortOrder: r.sort_order ?? 0 }));
}

export async function upsertPreferenceCatalogItem(id, name, sortOrder) {
  const { error } = await sb.from('preference_catalog').upsert({ id, name, sort_order: sortOrder ?? 0 }, { onConflict: 'id' });
  return error ? { error: error.message } : { success: true };
}

export async function deletePreferenceCatalogItem(id) {
  const { error } = await sb.from('preference_catalog').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}
