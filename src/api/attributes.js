import sb from './client';

// ===== ATTRIBUTES =====

export async function fetchAttributes() {
  const { data, error } = await sb.from('attributes').select('*');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id,
    name: r.name,
    groupable: r.groupable,
    values: r.values ? r.values.split(',').map(v => v.trim()).filter(Boolean) : [],
    rangeGroups: r.range_groups || null,
  }));
}

export async function saveAttribute(id, name, groupable, values, rangeGroups) {
  const valuesStr = Array.isArray(values) ? values.join(', ') : (values || '');
  const row = { id, name, groupable, values: valuesStr };
  if (rangeGroups !== undefined) row.range_groups = rangeGroups || null;
  const { error } = await sb.from('attributes').upsert(row, { onConflict: 'id' });
  return error ? { error: error.message } : { success: true };
}

export async function deleteAttribute(id) {
  const { error } = await sb.from('attributes').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}
