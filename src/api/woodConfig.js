import sb from './client';

// ===== WOOD CONFIG =====

export async function fetchAllConfig() {
  const { data, error } = await sb.from('wood_config').select('*');
  if (error) throw new Error(error.message);
  const result = {};
  (data || []).forEach(r => {
    if (!result[r.wood_id]) result[r.wood_id] = { attrs: [], attrValues: {}, defaultHeader: [], rangeGroups: {}, attrPriceGroups: {}, attrAliases: {} };
    result[r.wood_id].attrs.push(r.attr_id);
    result[r.wood_id].attrValues[r.attr_id] = r.selected_values
      ? r.selected_values.split(',').map(v => v.trim()).filter(Boolean)
      : [];
    if (r.is_header) result[r.wood_id].defaultHeader.push(r.attr_id);
    if (r.range_groups) result[r.wood_id].rangeGroups[r.attr_id] = r.range_groups;
    if (r.price_group_config) result[r.wood_id].attrPriceGroups[r.attr_id] = r.price_group_config;
    if (r.attr_aliases) result[r.wood_id].attrAliases[r.attr_id] = r.attr_aliases;
  });
  return result;
}

export async function saveWoodConfig(woodId, config) {
  await sb.from('wood_config').delete().eq('wood_id', woodId);
  const rows = (config.attrs || []).map(attrId => ({
    wood_id: woodId,
    attr_id: attrId,
    selected_values: (config.attrValues[attrId] || []).join(', '),
    is_header: (config.defaultHeader || []).includes(attrId),
    range_groups: config.rangeGroups?.[attrId] || null,
    price_group_config: config.attrPriceGroups?.[attrId] || null,
    attr_aliases: config.attrAliases?.[attrId] || null,
  }));
  if (rows.length > 0) {
    const { error } = await sb.from('wood_config').insert(rows);
    if (error) return { error: error.message };
  }
  return { success: true };
}
