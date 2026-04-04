import sb from './client';

// ===== ATTENDANCE =====

function mapAttendance(r) {
  return {
    id: r.id, employeeId: r.employee_id, date: r.date,
    status: r.status, checkIn: r.check_in, checkOut: r.check_out,
    otMinutes: r.ot_minutes || 0, source: r.source || 'manual',
    note: r.note || '', createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

/**
 * Fetch chấm công theo tháng (YYYY-MM)
 */
export async function fetchAttendance(period) {
  const startDate = period + '-01';
  const [y, m] = period.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = period + '-' + String(lastDay).padStart(2, '0');

  const { data, error } = await sb.from('attendance')
    .select('*')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date');
  if (error) throw new Error(error.message);
  return (data || []).map(mapAttendance);
}

/**
 * Upsert một dòng chấm công (theo employee_id + date)
 */
export async function upsertAttendance(employeeId, date, fields) {
  const row = {
    employee_id: employeeId, date,
    status: fields.status || 'present',
    check_in: fields.checkIn || null,
    check_out: fields.checkOut || null,
    ot_minutes: fields.otMinutes || 0,
    source: fields.source || 'manual',
    note: fields.note || null,
    updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from('attendance')
    .upsert(row, { onConflict: 'employee_id,date' })
    .select().single();
  return error ? { error: error.message } : { success: true, data: mapAttendance(data) };
}

/**
 * Upsert batch (import Excel) — mảng { employeeId, date, status, otMinutes, ... }
 */
export async function upsertAttendanceBatch(rows) {
  const dbRows = rows.map(r => ({
    employee_id: r.employeeId, date: r.date,
    status: r.status || 'present',
    check_in: r.checkIn || null,
    check_out: r.checkOut || null,
    ot_minutes: r.otMinutes || 0,
    source: r.source || 'machine',
    note: r.note || null,
    updated_at: new Date().toISOString(),
  }));
  const { error } = await sb.from('attendance')
    .upsert(dbRows, { onConflict: 'employee_id,date' });
  return error ? { error: error.message } : { success: true, count: dbRows.length };
}

export async function deleteAttendance(id) {
  const { error } = await sb.from('attendance').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== PAYROLL SETTINGS =====

export async function fetchPayrollSettings() {
  const { data, error } = await sb.from('payroll_settings').select('*');
  if (error) throw new Error(error.message);
  const map = {};
  (data || []).forEach(r => { map[r.key] = { value: r.value, description: r.description }; });
  return map;
}

export async function savePayrollSetting(key, value, description) {
  const { error } = await sb.from('payroll_settings')
    .upsert({ key, value: JSON.stringify(value), description, updated_at: new Date().toISOString() }, { onConflict: 'key' });
  return error ? { error: error.message } : { success: true };
}
