import sb from './client';

// ===== DEPARTMENTS =====

export async function fetchDepartments() {
  const { data, error } = await sb.from('departments').select('*').order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ id: r.id, name: r.name, description: r.description || '', sortOrder: r.sort_order, shiftId: r.shift_id || null, attendanceBonus: r.attendance_bonus ?? false, sundayMode: r.sunday_mode || 'off_default', skipAttendance: r.skip_attendance ?? false, createdAt: r.created_at }));
}

export async function addDepartment(name, description, opts = {}) {
  const { data, error } = await sb.from('departments').insert({ name, description: description || null, attendance_bonus: !!opts.attendanceBonus, sunday_mode: opts.sundayMode || 'off_default', skip_attendance: !!opts.skipAttendance }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function updateDepartment(id, name, description, opts = {}) {
  const { error } = await sb.from('departments').update({ name, description: description || null, attendance_bonus: !!opts.attendanceBonus, sunday_mode: opts.sundayMode || 'off_default', skip_attendance: !!opts.skipAttendance }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteDepartment(id) {
  const { error } = await sb.from('departments').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== EMPLOYEES =====

function mapEmployee(r) {
  return {
    id: r.id, code: r.code, fullName: r.full_name,
    dateOfBirth: r.date_of_birth, idNumber: r.id_number,
    phone: r.phone, address: r.address,
    departmentId: r.department_id, position: r.position,
    startDate: r.start_date, status: r.status,
    salaryType: r.salary_type, baseSalary: Number(r.base_salary) || 0,
    probationRate: Number(r.probation_rate) || 0.85,
    bankName: r.bank_name, bankAccount: r.bank_account, bankHolder: r.bank_holder,
    employeeType: r.employee_type || 'official',
    bhxhEnrolled: r.bhxh_enrolled ?? false,
    bhxhAmount: Number(r.bhxh_amount) || 0,
    bhxhEmployee: Number(r.bhxh_employee) || 0,
    bhxhCompany: Number(r.bhxh_company) || 0,
    managerId: r.manager_id, isManager: r.is_manager ?? false, commissionEligible: r.commission_eligible ?? false,
    lateGraceMinutes: r.late_grace_minutes || 0,
    machineCode: r.machine_code || '',
    note: r.note || '',
    createdAt: r.created_at, updatedAt: r.updated_at,
  };
}

export async function fetchEmployees() {
  const { data, error } = await sb.from('employees').select('*').order('code');
  if (error) throw new Error(error.message);
  return (data || []).map(mapEmployee);
}

export async function fetchNextEmployeeCode() {
  const { data, error } = await sb.rpc('next_employee_code');
  if (error) return 'NV-001';
  return data;
}

export async function addEmployee(emp) {
  const row = {
    code: emp.code, full_name: emp.fullName,
    date_of_birth: emp.dateOfBirth || null, id_number: emp.idNumber || null,
    phone: emp.phone || null, address: emp.address || null,
    department_id: emp.departmentId || null, position: emp.position || null,
    start_date: emp.startDate, status: emp.status || 'active',
    salary_type: emp.salaryType || 'monthly', base_salary: emp.baseSalary || 0,
    probation_rate: emp.probationRate ?? 0.85,
    bank_name: emp.bankName || null, bank_account: emp.bankAccount || null, bank_holder: emp.bankHolder || null,
    employee_type: emp.employeeType || 'official',
    commission_eligible: !!emp.commissionEligible,
    bhxh_enrolled: !!emp.bhxhEnrolled,
    bhxh_amount: emp.bhxhAmount || 0,
    bhxh_employee: emp.bhxhEmployee || 0, bhxh_company: emp.bhxhCompany || 0,
    manager_id: emp.managerId || null, is_manager: !!emp.isManager,
    machine_code: emp.machineCode || null,
    note: emp.note || null,
  };
  const { data, error } = await sb.from('employees').insert(row).select().single();
  return error ? { error: error.message } : { success: true, data: mapEmployee(data) };
}

export async function updateEmployee(id, emp) {
  const row = {
    full_name: emp.fullName,
    date_of_birth: emp.dateOfBirth || null, id_number: emp.idNumber || null,
    phone: emp.phone || null, address: emp.address || null,
    department_id: emp.departmentId || null, position: emp.position || null,
    start_date: emp.startDate, status: emp.status,
    salary_type: emp.salaryType, base_salary: emp.baseSalary || 0,
    probation_rate: emp.probationRate ?? 0.85,
    bank_name: emp.bankName || null, bank_account: emp.bankAccount || null, bank_holder: emp.bankHolder || null,
    employee_type: emp.employeeType || 'official',
    commission_eligible: !!emp.commissionEligible,
    bhxh_enrolled: !!emp.bhxhEnrolled,
    bhxh_amount: emp.bhxhAmount || 0,
    bhxh_employee: emp.bhxhEmployee || 0, bhxh_company: emp.bhxhCompany || 0,
    manager_id: emp.managerId || null, is_manager: !!emp.isManager,
    machine_code: emp.machineCode || null,
    note: emp.note || null, updated_at: new Date().toISOString(),
  };
  const { data, error } = await sb.from('employees').update(row).eq('id', id).select().single();
  return error ? { error: error.message } : { success: true, data: mapEmployee(data) };
}

export async function deleteEmployee(id) {
  const { error } = await sb.from('employees').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== ALLOWANCE TYPES =====

export async function fetchAllowanceTypes() {
  const { data, error } = await sb.from('allowance_types').select('*').order('sort_order');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({ id: r.id, name: r.name, description: r.description || '', sortOrder: r.sort_order, isActive: r.is_active ?? true, isProrated: r.is_prorated ?? false, calcMode: r.calc_mode || 'fixed', defaultAmount: Number(r.default_amount) || 0, createdAt: r.created_at }));
}

export async function addAllowanceType(name, description, calcMode, defaultAmount) {
  const isProrated = calcMode === 'prorated';
  const { data, error } = await sb.from('allowance_types').insert({ name, description: description || null, is_prorated: isProrated, calc_mode: calcMode || 'fixed', default_amount: defaultAmount || 0 }).select().single();
  return error ? { error: error.message } : { success: true, id: data.id };
}

export async function updateAllowanceType(id, name, description, isActive, calcMode, defaultAmount) {
  const isProrated = calcMode === 'prorated';
  const { error } = await sb.from('allowance_types').update({ name, description: description || null, is_active: isActive, is_prorated: isProrated, calc_mode: calcMode || 'fixed', default_amount: defaultAmount || 0 }).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// Gán phụ cấp mặc định cho tất cả NV active
export async function assignAllowanceToAllActive(allowanceTypeId, amount) {
  // Lấy tất cả NV active
  const { data: emps, error: empErr } = await sb.from('employees').select('id').in('status', ['active', 'probation']);
  if (empErr) return { error: empErr.message };
  if (!emps?.length) return { success: true, count: 0 };
  // Upsert cho từng NV
  const rows = emps.map(e => ({ employee_id: e.id, allowance_type_id: allowanceTypeId, amount, note: 'Gán mặc định' }));
  const { error } = await sb.from('employee_allowances').upsert(rows, { onConflict: 'employee_id,allowance_type_id' });
  return error ? { error: error.message } : { success: true, count: rows.length };
}

// Cập nhật hàng loạt: NV đang nhận mức cũ → mức mới
export async function bulkUpdateAllowanceAmount(allowanceTypeId, oldAmount, newAmount) {
  const { data, error } = await sb.from('employee_allowances')
    .update({ amount: newAmount })
    .eq('allowance_type_id', allowanceTypeId)
    .eq('amount', oldAmount)
    .select('id');
  return error ? { error: error.message } : { success: true, count: data?.length || 0 };
}

export async function deleteAllowanceType(id) {
  const { error } = await sb.from('allowance_types').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== EMPLOYEE ALLOWANCES =====

export async function fetchEmployeeAllowances(employeeId) {
  let q = sb.from('employee_allowances').select('*');
  if (employeeId) q = q.eq('employee_id', employeeId);
  const { data, error } = await q.order('created_at');
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, employeeId: r.employee_id, allowanceTypeId: r.allowance_type_id,
    amount: Number(r.amount) || 0, effectiveDate: r.effective_date || '', note: r.note || '', createdAt: r.created_at,
  }));
}

export async function saveEmployeeAllowance(employeeId, allowanceTypeId, amount, note, effectiveDate) {
  const effDate = effectiveDate || new Date().toISOString().slice(0, 10);
  const { data: existing } = await sb.from('employee_allowances')
    .select('id').eq('employee_id', employeeId).eq('allowance_type_id', allowanceTypeId).maybeSingle();
  if (existing) {
    const { error } = await sb.from('employee_allowances').update({ amount, note: note || null, effective_date: effDate }).eq('id', existing.id);
    return error ? { error: error.message } : { success: true };
  }
  const { error } = await sb.from('employee_allowances').insert({ employee_id: employeeId, allowance_type_id: allowanceTypeId, amount, note: note || null, effective_date: effDate });
  return error ? { error: error.message } : { success: true };
}

export async function deleteEmployeeAllowance(id) {
  const { error } = await sb.from('employee_allowances').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}

// ===== EMPLOYEE CHANGE LOG =====

export async function fetchEmployeeChangeLog(employeeId) {
  const { data, error } = await sb.from('employee_change_log').select('*')
    .eq('employee_id', employeeId).order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data || []).map(r => ({
    id: r.id, employeeId: r.employee_id, changeType: r.change_type,
    fieldName: r.field_name, oldValue: r.old_value, newValue: r.new_value,
    effectiveDate: r.effective_date, reason: r.reason,
    createdBy: r.created_by, createdAt: r.created_at,
  }));
}

export async function addEmployeeChangeLog(entry) {
  const row = {
    employee_id: entry.employeeId, change_type: entry.changeType,
    field_name: entry.fieldName, old_value: entry.oldValue ?? null,
    new_value: entry.newValue ?? null, effective_date: entry.effectiveDate || null,
    reason: entry.reason || null, created_by: entry.createdBy || null,
  };
  const { error } = await sb.from('employee_change_log').insert(row);
  return error ? { error: error.message } : { success: true };
}
