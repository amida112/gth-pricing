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
    createdAt: r.created_at,
    createdBy: r.created_by,
  }));
}

export async function saveUser(id, username, passwordHash, role, label, active, createdBy) {
  if (id) {
    const updates = { username, role, label, active };
    if (passwordHash) updates.password_hash = passwordHash;
    const { error } = await sb.from('users').update(updates).eq('id', id);
    return error ? { error: error.message } : { success: true };
  }
  const { error } = await sb.from('users').insert({
    username, password_hash: passwordHash, role, label, active: active !== false, created_by: createdBy,
  });
  return error ? { error: error.message } : { success: true };
}

export async function deleteUser(id) {
  const { error } = await sb.from('users').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}
