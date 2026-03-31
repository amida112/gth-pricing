import sb from './client';

// ===== PERMISSION GROUPS =====

export async function fetchPermissionGroups() {
  const { data, error } = await sb.from('permission_groups').select('*').order('is_system', { ascending: false }).order('created_at');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id,
    code: r.code,
    name: r.name,
    description: r.description || '',
    icon: r.icon || '🔐',
    color: r.color || '#666',
    isSystem: r.is_system,
    active: r.active !== false,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }));
}

export async function addPermissionGroup(code, name, description, icon, color) {
  const { data, error } = await sb.from('permission_groups').insert({
    code, name, description: description || '', icon: icon || '🔐', color: color || '#666',
    is_system: false, active: true,
  }).select().single();
  if (error) return { error: error.message };
  return { success: true, data };
}

export async function updatePermissionGroup(id, updates) {
  const mapped = {};
  if (updates.code !== undefined) mapped.code = updates.code;
  if (updates.name !== undefined) mapped.name = updates.name;
  if (updates.description !== undefined) mapped.description = updates.description;
  if (updates.icon !== undefined) mapped.icon = updates.icon;
  if (updates.color !== undefined) mapped.color = updates.color;
  if (updates.active !== undefined) mapped.active = updates.active;
  mapped.updated_at = new Date().toISOString();
  const { error } = await sb.from('permission_groups').update(mapped).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deletePermissionGroup(id) {
  const { error } = await sb.from('permission_groups').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== GROUP PERMISSIONS (chi tiết phân quyền) =====

export async function fetchGroupPermissions(groupId) {
  const query = groupId
    ? sb.from('group_permissions').select('*').eq('group_id', groupId)
    : sb.from('group_permissions').select('*');
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id,
    groupId: r.group_id,
    permissionKey: r.permission_key,
    granted: r.granted !== false,
  }));
}

export async function fetchAllGroupPermissions() {
  const { data, error } = await sb.from('group_permissions').select('*');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id,
    groupId: r.group_id,
    permissionKey: r.permission_key,
    granted: r.granted !== false,
  }));
}

export async function saveGroupPermissions(groupId, permissionKeys) {
  // permissionKeys = ['sales.create', 'sales.edit', ...] — danh sách quyền được bật
  // Xóa toàn bộ rồi insert lại
  const { error: delErr } = await sb.from('group_permissions').delete().eq('group_id', groupId);
  if (delErr) return { error: delErr.message };

  if (permissionKeys.length === 0) return { success: true };

  const rows = permissionKeys.map(key => ({
    group_id: groupId,
    permission_key: key,
    granted: true,
  }));
  const { error } = await sb.from('group_permissions').insert(rows);
  return error ? { error: error.message } : { success: true };
}
