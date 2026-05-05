import sb from './client';

function mapRow(r) {
  return {
    id: r.id,
    keyword: r.keyword,
    description: r.description || '',
    isActive: r.is_active !== false,
    createdAt: r.created_at,
    createdBy: r.created_by || '',
  };
}

export async function fetchFilterKeywords({ activeOnly = false } = {}) {
  let q = sb.from('bank_filter_keywords').select('*').order('created_at', { ascending: true });
  if (activeOnly) q = q.eq('is_active', true);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(mapRow);
}

export async function addFilterKeyword({ keyword, description, createdBy }) {
  const { data, error } = await sb.from('bank_filter_keywords').insert({
    keyword: (keyword || '').trim(),
    description: (description || '').trim() || null,
    created_by: createdBy || null,
  }).select('*').single();
  if (error) return { error: error.message };
  return { data: mapRow(data) };
}

export async function updateFilterKeyword(id, { keyword, description, isActive }) {
  const patch = {};
  if (keyword !== undefined) patch.keyword = keyword.trim();
  if (description !== undefined) patch.description = (description || '').trim() || null;
  if (isActive !== undefined) patch.is_active = !!isActive;
  const { error } = await sb.from('bank_filter_keywords').update(patch).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteFilterKeyword(id) {
  const { error } = await sb.from('bank_filter_keywords').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}
