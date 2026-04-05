import sb from './client';

// ===== EXTRA WORK TYPES =====

export async function fetchExtraWorkTypes() {
  const { data, error } = await sb.from('extra_work_types').select('*').order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ id: r.id, name: r.name, rate: Number(r.rate) || 0, unit: r.unit || 'công', isActive: r.is_active ?? true, sortOrder: r.sort_order, createdAt: r.created_at }));
}

export async function addExtraWorkType(name, rate, unit) {
  const { data, error } = await sb.from('extra_work_types').insert({ name, rate: rate || 0, unit: unit || 'công' }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function updateExtraWorkType(id, name, rate, unit, isActive) {
  const { error } = await sb.from('extra_work_types').update({ name, rate: rate || 0, unit: unit || 'công', is_active: isActive }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteExtraWorkType(id) {
  const { error } = await sb.from('extra_work_types').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== EXTRA WORK RECORDS =====

export async function fetchExtraWorkRecords(period) {
  const { data, error } = await sb.from('extra_work_records').select('*').eq('period', period).order('created_at');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, employeeId: r.employee_id, extraWorkTypeId: r.extra_work_type_id,
    period: r.period, quantity: Number(r.quantity) || 0, amount: Number(r.amount) || 0,
    note: r.note || '', createdBy: r.created_by, createdAt: r.created_at,
  }));
}

export async function upsertExtraWorkRecord(employeeId, extraWorkTypeId, period, quantity, rate, note, createdBy) {
  const amount = Math.round((quantity || 0) * (rate || 0));
  const row = {
    employee_id: employeeId, extra_work_type_id: extraWorkTypeId, period,
    quantity: quantity || 0, amount, note: note || null, created_by: createdBy || null,
  };
  const { error } = await sb.from('extra_work_records')
    .upsert(row, { onConflict: 'employee_id,extra_work_type_id,period' });
  return error ? { error: error.message } : { success: true, amount };
}

export async function deleteExtraWorkRecord(id) {
  const { error } = await sb.from('extra_work_records').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== EXTRA WORK ASSIGNMENTS (gán CV phụ cho NV) =====

export async function fetchExtraWorkAssignments() {
  const { data, error } = await sb.from('employee_extra_work_assignments').select('*');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ id: r.id, employeeId: r.employee_id, extraWorkTypeId: r.extra_work_type_id }));
}

export async function toggleExtraWorkAssignment(employeeId, extraWorkTypeId) {
  // Check existing
  const { data: existing } = await sb.from('employee_extra_work_assignments')
    .select('id').eq('employee_id', employeeId).eq('extra_work_type_id', extraWorkTypeId).maybeSingle();
  if (existing) {
    const { error } = await sb.from('employee_extra_work_assignments').delete().eq('id', existing.id);
    return error ? { error: error.message } : { success: true, action: 'removed' };
  }
  const { error } = await sb.from('employee_extra_work_assignments').insert({ employee_id: employeeId, extra_work_type_id: extraWorkTypeId });
  return error ? { error: error.message } : { success: true, action: 'added' };
}

// ===== MONTHLY OT (tổng OT tháng) =====

export async function fetchMonthlyOt(period) {
  const { data, error } = await sb.from('monthly_ot').select('*').eq('period', period);
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ id: r.id, employeeId: r.employee_id, period: r.period, otMinutes: r.ot_minutes || 0, note: r.note || '', createdBy: r.created_by }));
}

export async function upsertMonthlyOt(employeeId, period, otMinutes, note, createdBy) {
  const row = { employee_id: employeeId, period, ot_minutes: otMinutes || 0, note: note || null, created_by: createdBy || null };
  const { error } = await sb.from('monthly_ot').upsert(row, { onConflict: 'employee_id,period' });
  return error ? { error: error.message } : { success: true };
}
