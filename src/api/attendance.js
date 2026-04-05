import sb from './client';

// ===== ATTENDANCE =====

function mapAttendance(r) {
  return {
    id: r.id, employeeId: r.employee_id, date: r.date,
    status: r.status, checkIn: r.check_in, checkOut: r.check_out,
    otMinutes: r.ot_minutes || 0, source: r.source || 'manual',
    workValue: Number(r.work_value) || 0,
    isAdjusted: r.is_adjusted ?? false, adjustReason: r.adjust_reason || '', adjustedBy: r.adjusted_by || '',
    isLate: r.is_late ?? false, isEarlyLeave: r.is_early_leave ?? false,
    lateMinutes: r.late_minutes || 0, earlyMinutes: r.early_minutes || 0,
    flag: r.flag || 'normal',
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
    work_value: fields.workValue ?? 0,
    is_adjusted: fields.isAdjusted ?? false,
    adjust_reason: fields.adjustReason || null,
    adjusted_by: fields.adjustedBy || null,
    is_late: fields.isLate ?? false,
    is_early_leave: fields.isEarlyLeave ?? false,
    late_minutes: fields.lateMinutes || 0,
    early_minutes: fields.earlyMinutes || 0,
    flag: fields.flag || 'normal',
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
    work_value: r.workValue ?? 0,
    is_late: r.isLate ?? false, is_early_leave: r.isEarlyLeave ?? false,
    late_minutes: r.lateMinutes || 0, early_minutes: r.earlyMinutes || 0,
    flag: r.flag || 'normal',
    is_adjusted: r.isAdjusted ?? false,
    adjust_reason: r.adjustReason || null,
    adjusted_by: r.adjustedBy || null,
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

export async function deleteAttendanceByPeriod(period) {
  const startDate = period + '-01';
  const [y, m] = period.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const endDate = period + '-' + String(lastDay).padStart(2, '0');
  const { error } = await sb.from('attendance').delete().gte('date', startDate).lte('date', endDate);
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

// ===== WORK SHIFTS =====

export async function fetchWorkShifts() {
  const { data, error } = await sb.from('work_shifts').select('*').eq('is_active', true).order('name');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, name: r.name,
    startTime: r.start_time, endTime: r.end_time,
    lunchStart: r.lunch_start, lunchEnd: r.lunch_end,
    breakMorningStart: r.break_morning_start, breakMorningEnd: r.break_morning_end,
    breakAfternoonStart: r.break_afternoon_start, breakAfternoonEnd: r.break_afternoon_end,
    standardHours: Number(r.standard_hours) || 8,
    calcMode: r.calc_mode || 'standard',
    minPresenceHours: Number(r.min_presence_hours) || 0,
    effectiveFrom: r.effective_from, season: r.season,
    isActive: r.is_active, createdAt: r.created_at,
  }));
}

export async function addWorkShift(shift) {
  const row = {
    name: shift.name, start_time: shift.startTime, end_time: shift.endTime,
    lunch_start: shift.lunchStart, lunch_end: shift.lunchEnd,
    break_morning_start: shift.breakMorningStart || null, break_morning_end: shift.breakMorningEnd || null,
    break_afternoon_start: shift.breakAfternoonStart || null, break_afternoon_end: shift.breakAfternoonEnd || null,
    standard_hours: shift.standardHours || 8,
    calc_mode: shift.calcMode || 'standard',
    min_presence_hours: shift.minPresenceHours || 0,
  };
  const { data, error } = await sb.from('work_shifts').insert(row).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function updateWorkShift(id, shift) {
  const row = {
    name: shift.name, start_time: shift.startTime, end_time: shift.endTime,
    lunch_start: shift.lunchStart, lunch_end: shift.lunchEnd,
    break_morning_start: shift.breakMorningStart || null, break_morning_end: shift.breakMorningEnd || null,
    break_afternoon_start: shift.breakAfternoonStart || null, break_afternoon_end: shift.breakAfternoonEnd || null,
    standard_hours: shift.standardHours || 8,
    calc_mode: shift.calcMode || 'standard',
    min_presence_hours: shift.minPresenceHours || 0,
  };
  const { error } = await sb.from('work_shifts').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== BHXH MONTHLY =====

export async function fetchBhxhMonthly(period) {
  const { data, error } = await sb.from('bhxh_monthly').select('*').eq('period', period);
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ id: r.id, employeeId: r.employee_id, period: r.period, isActive: r.is_active ?? true, amount: Number(r.amount) || 0, note: r.note || '' }));
}

export async function upsertBhxhMonthly(employeeId, period, isActive, amount, note) {
  const row = { employee_id: employeeId, period, is_active: isActive, amount: amount || 0, note: note || null };
  const { error } = await sb.from('bhxh_monthly').upsert(row, { onConflict: 'employee_id,period' });
  return error ? { error: error.message } : { success: true };
}

export async function generateBhxhMonthly(period, employees) {
  // Auto tạo từ hồ sơ NV cho tháng này
  const bhxhEmps = employees.filter(e => e.bhxhEnrolled && e.status !== 'inactive');
  const rows = bhxhEmps.map(e => ({ employee_id: e.id, period, is_active: true, amount: e.bhxhAmount || 0 }));
  if (!rows.length) return { success: true, count: 0 };
  const { error } = await sb.from('bhxh_monthly').upsert(rows, { onConflict: 'employee_id,period' });
  return error ? { error: error.message } : { success: true, count: rows.length };
}
