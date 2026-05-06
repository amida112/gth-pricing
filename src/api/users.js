import sb from './client';

// ===== USERS (dynamic) =====

export async function fetchUsers() {
  const { data, error } = await sb.from('users').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id,
    username: r.username,
    passwordHash: r.password_hash,
    role: r.role,
    label: r.label,
    active: r.active !== false,
    email: r.email || '',
    phone: r.phone || '',
    permissionGroupId: r.permission_group_id || null,
    lastLoginAt: r.last_login_at || null,
    lastLoginIp: r.last_login_ip || null,
    linkedEmployeeId: r.linked_employee_id || null,
    notes: r.notes || '',
    experimentalMobileForm: r.experimental_mobile_form === true,
    createdAt: r.created_at,
    createdBy: r.created_by,
  }));
}

export async function saveUser(id, username, passwordHash, role, label, active, createdBy, extra = {}) {
  if (id) {
    const updates = { username, role, label, active };
    if (passwordHash) updates.password_hash = passwordHash;
    if (extra.email !== undefined) updates.email = extra.email;
    if (extra.phone !== undefined) updates.phone = extra.phone;
    if (extra.permissionGroupId !== undefined) updates.permission_group_id = extra.permissionGroupId;
    if (extra.notes !== undefined) updates.notes = extra.notes;
    if (extra.linkedEmployeeId !== undefined) updates.linked_employee_id = extra.linkedEmployeeId || null;
    if (extra.experimentalMobileForm !== undefined) updates.experimental_mobile_form = extra.experimentalMobileForm === true;
    const { error } = await sb.from('users').update(updates).eq('id', id);
    return error ? { error: error.message } : { success: true };
  }
  const insert = {
    username, password_hash: passwordHash, role, label, active: active !== false, created_by: createdBy,
  };
  if (extra.email) insert.email = extra.email;
  if (extra.phone) insert.phone = extra.phone;
  if (extra.permissionGroupId) insert.permission_group_id = extra.permissionGroupId;
  if (extra.notes) insert.notes = extra.notes;
  if (extra.linkedEmployeeId) insert.linked_employee_id = extra.linkedEmployeeId;
  if (extra.experimentalMobileForm) insert.experimental_mobile_form = true;
  const { error } = await sb.from('users').insert(insert);
  return error ? { error: error.message } : { success: true };
}

export async function deleteUser(id) {
  const { error } = await sb.from('users').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function updateUserLogin(id, ip) {
  const { error } = await sb.from('users').update({
    last_login_at: new Date().toISOString(),
    last_login_ip: ip || '',
  }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}
