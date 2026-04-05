import sb from './client';

// ===== PRODUCTION CAMPAIGNS =====

export async function fetchCampaigns(period) {
  const { data, error } = await sb.from('production_campaigns').select('*').eq('period', period);
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ id: r.id, departmentId: r.department_id, period: r.period, isActive: r.is_active ?? true, activeSundays: r.active_sundays || [], note: r.note || '', createdBy: r.created_by }));
}

export async function upsertCampaign(departmentId, period, isActive, activeSundays, note, createdBy) {
  const row = { department_id: departmentId, period, is_active: isActive, active_sundays: activeSundays || [], note: note || null, created_by: createdBy || null };
  const { error } = await sb.from('production_campaigns').upsert(row, { onConflict: 'department_id,period' });
  return error ? { error: error.message } : { success: true };
}

// ===== LEAVE REQUESTS =====

export async function fetchLeaveRequests(period) {
  const startDate = period + '-01';
  const [y, m] = period.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = period + '-' + String(lastDay).padStart(2, '0');
  const { data, error } = await sb.from('leave_requests').select('*')
    .gte('date', startDate).lte('date', endDate).order('date');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, employeeId: r.employee_id, date: r.date,
    leaveType: r.leave_type || 'personal', status: r.status || 'approved',
    approvedBy: r.approved_by, note: r.note || '', createdBy: r.created_by,
  }));
}

export async function addLeaveRequest(employeeId, date, leaveType, note, approvedBy, createdBy) {
  const row = {
    employee_id: employeeId, date, leave_type: leaveType || 'personal',
    status: 'approved', approved_by: approvedBy || null,
    note: note || null, created_by: createdBy || null,
  };
  const { data, error } = await sb.from('leave_requests').insert(row).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function deleteLeaveRequest(id) {
  const { error } = await sb.from('leave_requests').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}
