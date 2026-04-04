import sb from './client';

// ===== SALARY ADVANCES (Tạm ứng) =====

function mapAdvance(r) {
  return {
    id: r.id, employeeId: r.employee_id, amount: Number(r.amount) || 0,
    advanceDate: r.advance_date, payrollPeriod: r.payroll_period,
    status: r.status, note: r.note || '', createdBy: r.created_by, createdAt: r.created_at,
  };
}

export async function fetchSalaryAdvances(period) {
  let q = sb.from('salary_advances').select('*').order('advance_date');
  if (period) q = q.eq('payroll_period', period);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data || []).map(mapAdvance);
}

export async function addSalaryAdvance(adv) {
  const row = {
    employee_id: adv.employeeId, amount: adv.amount,
    advance_date: adv.advanceDate, payroll_period: adv.payrollPeriod || null,
    status: 'pending', note: adv.note || null, created_by: adv.createdBy || null,
  };
  const { data, error } = await sb.from('salary_advances').insert(row).select().single();
  return error ? { error: error.message } : { success: true, data: mapAdvance(data) };
}

export async function updateSalaryAdvance(id, fields) {
  const row = {};
  if (fields.amount != null) row.amount = fields.amount;
  if (fields.advanceDate) row.advance_date = fields.advanceDate;
  if (fields.payrollPeriod !== undefined) row.payroll_period = fields.payrollPeriod;
  if (fields.status) row.status = fields.status;
  if (fields.note !== undefined) row.note = fields.note || null;
  const { error } = await sb.from('salary_advances').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteSalaryAdvance(id) {
  const { error } = await sb.from('salary_advances').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// Mark advances as deducted for a payroll period
export async function deductAdvances(period) {
  const { error } = await sb.from('salary_advances')
    .update({ status: 'deducted' })
    .eq('payroll_period', period)
    .eq('status', 'pending');
  return error ? { error: error.message } : { success: true };
}

// ===== PAYROLL (Bảng lương) =====

function mapPayroll(r) {
  return {
    id: r.id, period: r.period, status: r.status,
    createdBy: r.created_by, confirmedBy: r.confirmed_by,
    confirmedAt: r.confirmed_at, paidAt: r.paid_at,
    note: r.note || '', createdAt: r.created_at,
  };
}

export async function fetchPayrolls() {
  const { data, error } = await sb.from('payroll').select('*').order('period', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(mapPayroll);
}

export async function fetchPayrollByPeriod(period) {
  const { data, error } = await sb.from('payroll').select('*').eq('period', period).maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapPayroll(data) : null;
}

export async function createPayroll(period, createdBy) {
  const { data, error } = await sb.from('payroll')
    .insert({ period, status: 'draft', created_by: createdBy })
    .select().single();
  return error ? { error: error.message } : { success: true, data: mapPayroll(data) };
}

export async function updatePayrollStatus(id, status, byUser) {
  const row = { status, updated_at: new Date().toISOString() };
  if (status === 'confirmed') { row.confirmed_by = byUser; row.confirmed_at = new Date().toISOString(); }
  if (status === 'paid') { row.paid_at = new Date().toISOString(); }
  const { error } = await sb.from('payroll').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deletePayroll(id) {
  // Cascade deletes payroll_details
  const { error } = await sb.from('payroll').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== PAYROLL DETAILS =====

function mapDetail(r) {
  return {
    id: r.id, payrollId: r.payroll_id, employeeId: r.employee_id,
    employeeCode: r.employee_code, employeeName: r.employee_name,
    departmentName: r.department_name,
    salaryType: r.salary_type, baseSalary: Number(r.base_salary) || 0,
    probationRate: Number(r.probation_rate) || 1,
    workDays: Number(r.work_days) || 0, standardDays: r.standard_days || 26,
    baseAmount: Number(r.base_amount) || 0,
    otHours: Number(r.ot_hours) || 0, otRate: Number(r.ot_rate) || 1.5,
    otAmount: Number(r.ot_amount) || 0,
    allowanceTotal: Number(r.allowance_total) || 0,
    allowanceDetail: r.allowance_detail || [],
    attendanceBonus: Number(r.attendance_bonus) || 0,
    commission: Number(r.commission) || 0, commissionDetail: r.commission_detail || {},
    bhxhEmployee: Number(r.bhxh_employee) || 0, bhxhCompany: Number(r.bhxh_company) || 0,
    advanceDeduction: Number(r.advance_deduction) || 0,
    otherDeduction: Number(r.other_deduction) || 0, otherDeductionNote: r.other_deduction_note || '',
    netSalary: Number(r.net_salary) || 0, note: r.note || '',
  };
}

export async function fetchPayrollDetails(payrollId) {
  const { data, error } = await sb.from('payroll_details').select('*')
    .eq('payroll_id', payrollId).order('employee_code');
  if (error) throw new Error(error.message);
  return (data || []).map(mapDetail);
}

export async function savePayrollDetails(payrollId, details) {
  // Delete existing + insert all (full replace)
  await sb.from('payroll_details').delete().eq('payroll_id', payrollId);
  if (!details.length) return { success: true };
  const rows = details.map(d => ({
    payroll_id: payrollId, employee_id: d.employeeId,
    employee_code: d.employeeCode, employee_name: d.employeeName,
    department_name: d.departmentName,
    salary_type: d.salaryType, base_salary: d.baseSalary,
    probation_rate: d.probationRate,
    work_days: d.workDays, standard_days: d.standardDays,
    base_amount: d.baseAmount,
    ot_hours: d.otHours, ot_rate: d.otRate, ot_amount: d.otAmount,
    allowance_total: d.allowanceTotal, allowance_detail: d.allowanceDetail,
    attendance_bonus: d.attendanceBonus,
    commission: d.commission, commission_detail: d.commissionDetail,
    bhxh_employee: d.bhxhEmployee, bhxh_company: d.bhxhCompany,
    advance_deduction: d.advanceDeduction,
    other_deduction: d.otherDeduction, other_deduction_note: d.otherDeductionNote || null,
    net_salary: d.netSalary, note: d.note || null,
  }));
  const { error } = await sb.from('payroll_details').insert(rows);
  return error ? { error: error.message } : { success: true };
}

export async function updatePayrollDetail(id, fields) {
  const row = {};
  if (fields.otherDeduction != null) row.other_deduction = fields.otherDeduction;
  if (fields.otherDeductionNote !== undefined) row.other_deduction_note = fields.otherDeductionNote || null;
  if (fields.netSalary != null) row.net_salary = fields.netSalary;
  if (fields.note !== undefined) row.note = fields.note || null;
  const { error } = await sb.from('payroll_details').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}
