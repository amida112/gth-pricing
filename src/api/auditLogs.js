import sb from './client';

// ===== AUDIT LOGS =====

export async function fetchAuditLogs({ page = 1, pageSize = 50, username, module, action, dateFrom, dateTo } = {}) {
  let query = sb.from('audit_logs').select('*', { count: 'exact' });

  if (username) query = query.eq('username', username);
  if (module) query = query.eq('module', module);
  if (action) query = query.eq('action', action);
  if (dateFrom) query = query.gte('created_at', dateFrom);
  if (dateTo) query = query.lte('created_at', dateTo + 'T23:59:59');

  query = query.order('created_at', { ascending: false })
    .range((page - 1) * pageSize, page * pageSize - 1);

  const { data, error, count } = await query;
  if (error) throw new Error(error.message);

  return {
    logs: (data || []).map(r => ({
      id: r.id,
      userId: r.user_id,
      username: r.username,
      module: r.module,
      action: r.action,
      description: r.description,
      entityType: r.entity_type,
      entityId: r.entity_id,
      oldData: r.old_data,
      newData: r.new_data,
      ipAddress: r.ip_address,
      userAgent: r.user_agent,
      createdAt: r.created_at,
    })),
    total: count || 0,
    page,
    pageSize,
  };
}

export async function createAuditLog({ username, module, action, description, entityType, entityId, oldData, newData, userId }) {
  // Lấy IP từ client-side (best effort)
  let ipAddress = '';
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const json = await res.json();
    ipAddress = json.ip;
  } catch { /* ignore */ }

  const { error } = await sb.from('audit_logs').insert({
    user_id: userId || null,
    username: username || 'system',
    module,
    action,
    description,
    entity_type: entityType || null,
    entity_id: entityId || null,
    old_data: oldData || null,
    new_data: newData || null,
    ip_address: ipAddress,
    user_agent: navigator?.userAgent || '',
  });
  return error ? { error: error.message } : { success: true };
}

// Hàm helper ghi log nhanh — dùng fire-and-forget
export function logAction(username, module, action, description, extra = {}) {
  createAuditLog({ username, module, action, description, ...extra }).catch(() => {});
}

export async function fetchAuditLogModules() {
  const { data, error } = await sb.rpc('audit_log_distinct_modules');
  if (error || !Array.isArray(data)) return [];
  return data.map(r => r.module).filter(Boolean);
}

export async function fetchAuditLogUsernames() {
  const { data, error } = await sb.rpc('audit_log_distinct_usernames');
  if (error || !Array.isArray(data)) return [];
  return data.map(r => r.username).filter(Boolean);
}
