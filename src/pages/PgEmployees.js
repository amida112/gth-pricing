import React, { useState, useEffect, useCallback, useMemo } from "react";
import Dialog from "../components/Dialog";
import useTableSort from "../useTableSort";
import { fmtDate, fmtMoney } from "../utils";

const STATUS_LABELS = { active: "Đang làm", inactive: "Nghỉ việc", probation: "Thử việc" };
const STATUS_COLORS = { active: "#27ae60", inactive: "#95a5a6", probation: "#f39c12" };
const SALARY_TYPE_LABELS = { monthly: "Lương tháng", daily: "Lương ngày" };

const CHANGE_TYPE_LABELS = {
  salary: "Lương", allowance: "Phụ cấp", bhxh: "BHXH",
  position: "Chức vụ", department: "Bộ phận", status: "Trạng thái",
  probation_rate: "Tỷ lệ thử việc", other: "Khác",
};

const inputSt = { width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid var(--bd)", fontSize: "0.82rem", background: "var(--bg)", color: "var(--tp)", outline: "none", boxSizing: "border-box" };
const labelSt = { fontSize: "0.72rem", fontWeight: 600, color: "var(--ts)", marginBottom: 3, display: "block" };
const errSt = { fontSize: "0.68rem", color: "#e74c3c", marginTop: 2 };
const gridRow = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 };

export default function PgEmployees({ departments: deptsProp, setDepartments: setDeptsProp, employees: empsProp, setEmployees: setEmpsProp, allowanceTypes: atsProp, setAllowanceTypes: setAtsProp, workShifts = [], useAPI, notify, user, isAdmin }) {
  // ─── State ───
  const [departments, setDepartments] = [deptsProp, setDeptsProp];
  const [employees, setEmployees] = [empsProp, setEmpsProp];
  const [allowanceTypes, setAllowanceTypes] = [atsProp, setAtsProp];

  const [dlg, setDlg] = useState(null); // null | 'new' | employee.id
  const [fm, setFm] = useState({});
  const [fmErr, setFmErr] = useState({});
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState("info"); // info | allowance | history
  const [detailEmp, setDetailEmp] = useState(null);
  const [empAllowances, setEmpAllowances] = useState([]);
  const [empHistory, setEmpHistory] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Filters
  const [fDept, setFDept] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fSearch, setFSearch] = useState("");

  // Department dialog
  const [deptDlg, setDeptDlg] = useState(null);
  const [deptFm, setDeptFm] = useState({ name: "", description: "" });

  // Allowance type dialogs
  const [atListDlg, setAtListDlg] = useState(false); // danh sách loại phụ cấp
  const [atListTab, setAtListTab] = useState("types"); // "types" | "assign"
  const [atDlg, setAtDlg] = useState(null);
  const [atFm, setAtFm] = useState({ name: "", description: "" });
  const [allEmpAllowances, setAllEmpAllowances] = useState([]); // tất cả employee_allowances
  const [assignSaving, setAssignSaving] = useState(false);

  // Allowance edit
  const [alDlg, setAlDlg] = useState(null);

  // Change reason dialog (for salary/allowance/bhxh changes)
  const [changeDlg, setChangeDlg] = useState(null);
  const [changeReason, setChangeReason] = useState("");
  const [changeDate, setChangeDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { sortField, sortDir, toggleSort, sortIcon, applySort } = useTableSort("code", "asc");

  // ─── Fetch next code for new employee ───
  const [nextCode, setNextCode] = useState("NV-001");

  // ─── Filtered & sorted list ───
  const filtered = useMemo(() => {
    let list = employees;
    if (fDept) list = list.filter(e => e.departmentId === fDept);
    if (fStatus) list = list.filter(e => e.status === fStatus);
    if (fSearch) {
      const q = fSearch.toLowerCase();
      list = list.filter(e => e.fullName.toLowerCase().includes(q) || e.code.toLowerCase().includes(q) || (e.phone || "").includes(q));
    }
    return applySort(list, (item, field) => {
      if (field === "departmentId") return departments.find(d => d.id === item.departmentId)?.name || "";
      return item[field];
    });
  }, [employees, departments, fDept, fStatus, fSearch, applySort]);

  // ─── Helpers ───
  const deptName = useCallback((id) => departments.find(d => d.id === id)?.name || "—", [departments]);
  const mgrName = useCallback((id) => employees.find(e => e.id === id)?.fullName || "—", [employees]);

  // ─── Open new / edit dialog ───
  const openNew = async () => {
    // Fetch mã NV tiếp theo mỗi lần mở dialog
    let code = nextCode;
    if (useAPI) {
      try {
        const api = await import("../api.js");
        code = await api.fetchNextEmployeeCode();
        setNextCode(code);
      } catch {}
    }
    setFm({
      code, fullName: "", dateOfBirth: "", idNumber: "", phone: "", address: "",
      departmentId: "", position: "", startDate: new Date().toISOString().slice(0, 10),
      status: "active", salaryType: "monthly", baseSalary: "", probationRate: "85",
      bankName: "", bankAccount: "", bankHolder: "",
      bhxhEnrolled: false, bhxhAmount: "",
      managerId: "", isManager: false, employeeType: "official", machineCode: "", lateGraceMinutes: "0", note: "",
    });
    setFmErr({});
    setDlg("new");
  };

  const openEdit = (emp) => {
    setFm({
      code: emp.code, fullName: emp.fullName, dateOfBirth: emp.dateOfBirth || "",
      idNumber: emp.idNumber || "", phone: emp.phone || "", address: emp.address || "",
      departmentId: emp.departmentId || "", position: emp.position || "",
      startDate: emp.startDate || "", status: emp.status,
      salaryType: emp.salaryType, baseSalary: String(emp.baseSalary || ""),
      probationRate: String(Math.round((emp.probationRate || 0.85) * 100)),
      bankName: emp.bankName || "", bankAccount: emp.bankAccount || "", bankHolder: emp.bankHolder || "",
      bhxhEnrolled: emp.bhxhEnrolled, bhxhAmount: String(emp.bhxhAmount || ""),
      managerId: emp.managerId || "", isManager: emp.isManager || false, employeeType: emp.employeeType || "official",
      machineCode: emp.machineCode || "", lateGraceMinutes: String(emp.lateGraceMinutes || "0"),
      note: emp.note || "",
    });
    setFmErr({});
    setDlg(emp.id);
  };

  // ─── Validate ───
  const validate = () => {
    const e = {};
    if (!fm.fullName.trim()) e.fullName = "Bắt buộc";
    if (!fm.startDate) e.startDate = "Bắt buộc";
    if (!fm.baseSalary || isNaN(Number(fm.baseSalary))) e.baseSalary = "Nhập số";
    return e;
  };

  // ─── Detect tracked changes for auto-logging ───
  const detectChanges = (oldEmp, newFm) => {
    const changes = [];
    const newBaseSalary = Number(newFm.baseSalary) || 0;
    if (oldEmp.baseSalary !== newBaseSalary) {
      changes.push({ changeType: "salary", fieldName: "Lương cơ bản", oldValue: fmtMoney(oldEmp.baseSalary), newValue: fmtMoney(newBaseSalary) });
    }
    const newProbRate = (Number(newFm.probationRate) || 85) / 100;
    if (Math.abs((oldEmp.probationRate || 0.85) - newProbRate) > 0.001) {
      changes.push({ changeType: "probation_rate", fieldName: "Tỷ lệ thử việc", oldValue: Math.round((oldEmp.probationRate || 0.85) * 100) + "%", newValue: Math.round(newProbRate * 100) + "%" });
    }
    if (oldEmp.status !== newFm.status) {
      changes.push({ changeType: "status", fieldName: "Trạng thái", oldValue: STATUS_LABELS[oldEmp.status], newValue: STATUS_LABELS[newFm.status] });
    }
    if ((oldEmp.departmentId || "") !== (newFm.departmentId || "")) {
      changes.push({ changeType: "department", fieldName: "Bộ phận", oldValue: deptName(oldEmp.departmentId), newValue: deptName(newFm.departmentId) });
    }
    if ((oldEmp.position || "") !== (newFm.position || "").trim()) {
      changes.push({ changeType: "position", fieldName: "Chức vụ", oldValue: oldEmp.position || "—", newValue: newFm.position?.trim() || "—" });
    }
    const newBhxhAmt = Number(newFm.bhxhAmount) || 0;
    if ((oldEmp.bhxhAmount || 0) !== newBhxhAmt || oldEmp.bhxhEnrolled !== newFm.bhxhEnrolled) {
      changes.push({ changeType: "bhxh", fieldName: "BHXH", oldValue: fmtMoney(oldEmp.bhxhAmount || 0), newValue: fmtMoney(newBhxhAmt) });
    }
    return changes;
  };

  // ─── Save employee (with change logging) ───
  const saveEmployee = (reason, effectiveDate) => {
    const errs = validate();
    if (Object.keys(errs).length) { setFmErr(errs); return; }

    const empData = {
      ...fm, fullName: fm.fullName.trim(), position: (fm.position || "").trim(),
      baseSalary: Number(fm.baseSalary) || 0,
      probationRate: (Number(fm.probationRate) || 85) / 100,
      bhxhAmount: Number(fm.bhxhAmount) || 0,
      managerId: fm.managerId || null,
      employeeType: fm.employeeType || "official",
      machineCode: fm.machineCode || null,
      lateGraceMinutes: Number(fm.lateGraceMinutes) || 0,
      departmentId: fm.departmentId || null,
    };

    setSaving(true);
    if (dlg === "new") {
      const tmp = { ...empData, id: "tmp_" + Date.now(), createdAt: new Date().toISOString() };
      setEmployees(p => [...p, tmp]);
      setDlg(null);
      if (useAPI) {
        import("../api.js").then(api => api.addEmployee(empData).then(r => {
          setSaving(false);
          if (r?.error) { notify("Lỗi: " + r.error, false); setEmployees(p => p.filter(e => e.id !== tmp.id)); }
          else {
            setEmployees(p => p.map(e => e.id === tmp.id ? r.data : e));
            notify("Đã thêm " + empData.fullName);
            // Log tạo mới
            api.addEmployeeChangeLog({ employeeId: r.data.id, changeType: "other", fieldName: "Tạo mới", newValue: empData.fullName, effectiveDate: empData.startDate, createdBy: user?.username });
          }
        }));
      } else setSaving(false);
    } else {
      // Edit existing
      const oldEmp = employees.find(e => e.id === dlg);
      const changes = oldEmp ? detectChanges(oldEmp, fm) : [];
      setEmployees(p => p.map(e => e.id === dlg ? { ...e, ...empData } : e));
      setDlg(null);
      if (useAPI) {
        import("../api.js").then(api => {
          api.updateEmployee(dlg, empData).then(r => {
            setSaving(false);
            if (r?.error) { notify("Lỗi: " + r.error, false); }
            else {
              setEmployees(p => p.map(e => e.id === dlg ? r.data : e));
              notify("Đã cập nhật " + empData.fullName);
              // Log changes
              changes.forEach(c => {
                api.addEmployeeChangeLog({
                  employeeId: dlg, changeType: c.changeType, fieldName: c.fieldName,
                  oldValue: c.oldValue, newValue: c.newValue,
                  effectiveDate: effectiveDate || new Date().toISOString().slice(0, 10),
                  reason: reason || null, createdBy: user?.username,
                });
              });
            }
          });
        });
      } else setSaving(false);
    }
  };

  // ─── Handle save: check if tracked fields changed → ask reason ───
  const handleSave = () => {
    const errs = validate();
    if (Object.keys(errs).length) { setFmErr(errs); return; }

    if (dlg !== "new") {
      const oldEmp = employees.find(e => e.id === dlg);
      const changes = oldEmp ? detectChanges(oldEmp, fm) : [];
      const needReason = changes.some(c => ["salary", "allowance", "bhxh", "probation_rate"].includes(c.changeType));
      if (needReason) {
        setChangeDlg({ changes });
        setChangeReason("");
        setChangeDate(new Date().toISOString().slice(0, 10));
        return;
      }
    }
    saveEmployee("", "");
  };

  // ─── Delete ───
  const handleDelete = (emp) => {
    if (!window.confirm(`Xóa nhân viên "${emp.fullName}" (${emp.code})?`)) return;
    setEmployees(p => p.filter(e => e.id !== emp.id));
    if (useAPI) {
      import("../api.js").then(api => api.deleteEmployee(emp.id).then(r => {
        if (r?.error) { notify("Lỗi: " + r.error, false); setEmployees(p => [...p, emp]); }
        else notify("Đã xóa " + emp.fullName);
      }));
    }
  };

  // ─── Detail view (click row → phụ cấp + lịch sử) ───
  const openDetail = useCallback((emp) => {
    setDetailEmp(emp);
    setTab("info");
    setEmpAllowances([]);
    setEmpHistory([]);
    if (useAPI) {
      setLoadingDetail(true);
      import("../api.js").then(api => Promise.all([
        api.fetchEmployeeAllowances(emp.id),
        api.fetchEmployeeChangeLog(emp.id),
      ])).then(([al, hist]) => {
        setEmpAllowances(al);
        setEmpHistory(hist);
        setLoadingDetail(false);
      }).catch(() => setLoadingDetail(false));
    }
  }, [useAPI]);

  // ─── Allowance CRUD ───
  const openAlDlg = (alTypeId, existing) => {
    // Auto fill mức mặc định nếu chưa có existing
    let amount = existing ? String(existing.amount) : "";
    if (!existing && alTypeId) {
      const at = allowanceTypes.find(t => t.id === alTypeId);
      if (at?.defaultAmount) amount = String(at.defaultAmount);
    }
    setAlDlg({
      empId: detailEmp.id,
      allowanceTypeId: alTypeId || "",
      amount,
      note: existing?.note || "",
      existingId: existing?.id || null,
    });
  };

  const saveAllowance = () => {
    if (!alDlg.allowanceTypeId || !alDlg.amount) return;
    const amt = Number(alDlg.amount) || 0;
    if (useAPI) {
      import("../api.js").then(api => {
        api.saveEmployeeAllowance(alDlg.empId, alDlg.allowanceTypeId, amt, alDlg.note).then(r => {
          if (r?.error) notify("Lỗi: " + r.error, false);
          else {
            notify("Đã lưu phụ cấp");
            // Refresh
            api.fetchEmployeeAllowances(alDlg.empId).then(setEmpAllowances);
            // Log
            const typeName = allowanceTypes.find(t => t.id === alDlg.allowanceTypeId)?.name || "";
            const old = empAllowances.find(a => a.allowanceTypeId === alDlg.allowanceTypeId);
            api.addEmployeeChangeLog({
              employeeId: alDlg.empId, changeType: "allowance", fieldName: typeName,
              oldValue: old ? fmtMoney(old.amount) : "—", newValue: fmtMoney(amt),
              effectiveDate: new Date().toISOString().slice(0, 10), createdBy: user?.username,
            });
          }
        });
      });
    }
    setAlDlg(null);
  };

  const deleteAllowance = (al) => {
    if (!window.confirm("Xóa phụ cấp này?")) return;
    if (useAPI) {
      import("../api.js").then(api => {
        api.deleteEmployeeAllowance(al.id).then(r => {
          if (r?.error) notify("Lỗi: " + r.error, false);
          else {
            setEmpAllowances(p => p.filter(a => a.id !== al.id));
            notify("Đã xóa phụ cấp");
          }
        });
      });
    }
  };

  // ─── Department CRUD ───
  const saveDept = () => {
    if (!deptFm.name.trim()) return;
    if (deptDlg === "new") {
      if (useAPI) {
        import("../api.js").then(api => api.addDepartment(deptFm.name.trim(), deptFm.description.trim(), { attendanceBonus: deptFm.attendanceBonus, sundayMode: deptFm.sundayMode, skipAttendance: deptFm.skipAttendance, shiftId: deptFm.shiftId }).then(r => {
          if (r?.error) notify("Lỗi: " + r.error, false);
          else {
            setDepartments(p => [...p, { id: r.id, name: deptFm.name.trim(), description: deptFm.description.trim(), attendanceBonus: !!deptFm.attendanceBonus, sundayMode: deptFm.sundayMode, skipAttendance: !!deptFm.skipAttendance, shiftId: deptFm.shiftId || null }]);
            notify("Đã thêm bộ phận");
          }
        }));
      }
    } else {
      if (useAPI) {
        import("../api.js").then(api => api.updateDepartment(deptDlg, deptFm.name.trim(), deptFm.description.trim(), { attendanceBonus: deptFm.attendanceBonus, sundayMode: deptFm.sundayMode, skipAttendance: deptFm.skipAttendance, shiftId: deptFm.shiftId }).then(r => {
          if (r?.error) notify("Lỗi: " + r.error, false);
          else {
            setDepartments(p => p.map(d => d.id === deptDlg ? { ...d, name: deptFm.name.trim(), description: deptFm.description.trim(), attendanceBonus: !!deptFm.attendanceBonus, sundayMode: deptFm.sundayMode, skipAttendance: !!deptFm.skipAttendance, shiftId: deptFm.shiftId || null } : d));
            notify("Đã cập nhật bộ phận");
          }
        }));
      }
    }
    setDeptDlg(null);
  };

  // ─── Allowance type CRUD ───
  const saveAtType = async () => {
    if (!atFm.name.trim()) return;
    const dup = allowanceTypes.find(a => a.name.toLowerCase() === atFm.name.trim().toLowerCase() && a.id !== atDlg);
    if (dup) { notify("Loại phụ cấp \"" + atFm.name.trim() + "\" đã tồn tại", false); return; }
    const defAmt = Number(atFm.defaultAmount) || 0;
    const calcMode = atFm.calcMode || "fixed";
    if (atDlg === "new") {
      if (useAPI) {
        const api = await import("../api.js");
        const r = await api.addAllowanceType(atFm.name.trim(), atFm.description.trim(), calcMode, defAmt);
        if (r?.error) { notify("Lỗi: " + r.error, false); return; }
        setAllowanceTypes(p => [...p, { id: r.id, name: atFm.name.trim(), description: atFm.description.trim(), isActive: true, isProrated: calcMode === "prorated", calcMode, defaultAmount: defAmt }]);
        notify("Đã thêm loại phụ cấp");
      }
    } else {
      if (useAPI) {
        const at = allowanceTypes.find(a => a.id === atDlg);
        const oldDefAmt = at?.defaultAmount || 0;
        const api = await import("../api.js");
        const r = await api.updateAllowanceType(atDlg, atFm.name.trim(), atFm.description.trim(), at?.isActive ?? true, calcMode, defAmt);
        if (r?.error) { notify("Lỗi: " + r.error, false); return; }
        setAllowanceTypes(p => p.map(a => a.id === atDlg ? { ...a, name: atFm.name.trim(), description: atFm.description.trim(), isProrated: calcMode === "prorated", calcMode, defaultAmount: defAmt } : a));
        // Nếu thay đổi mức mặc định → hỏi cập nhật hàng loạt
        if (defAmt > 0 && oldDefAmt > 0 && defAmt !== oldDefAmt) {
          if (window.confirm(`Mức mặc định đổi từ ${fmtMoney(oldDefAmt)} → ${fmtMoney(defAmt)}.\nCập nhật cho tất cả NV đang nhận mức cũ (${fmtMoney(oldDefAmt)})?`)) {
            const br = await api.bulkUpdateAllowanceAmount(atDlg, oldDefAmt, defAmt);
            if (br?.error) notify("Lỗi: " + br.error, false);
            else notify(`Đã cập nhật ${br.count} NV từ ${fmtMoney(oldDefAmt)} → ${fmtMoney(defAmt)}`);
          }
        }
        notify("Đã cập nhật loại phụ cấp");
      }
    }
    setAtDlg(null);
  };

  // Gán phụ cấp mặc định cho tất cả NV active
  // Load tất cả phụ cấp NV cho tab "Gán phụ cấp"
  const loadAllEmpAllowances = useCallback(() => {
    if (!useAPI) return;
    import("../api.js").then(api => api.fetchEmployeeAllowances()).then(setAllEmpAllowances).catch(() => {});
  }, [useAPI]);

  // Save 1 cell trong ma trận gán phụ cấp
  const saveAssignCell = useCallback(async (empId, atTypeId, amount) => {
    if (!useAPI) return;
    setAssignSaving(true);
    try {
      const api = await import("../api.js");
      if (amount > 0) {
        await api.saveEmployeeAllowance(empId, atTypeId, amount, "");
        setAllEmpAllowances(prev => {
          const idx = prev.findIndex(a => a.employeeId === empId && a.allowanceTypeId === atTypeId);
          if (idx >= 0) return prev.map((a, i) => i === idx ? { ...a, amount } : a);
          return [...prev, { id: "tmp_" + Date.now(), employeeId: empId, allowanceTypeId: atTypeId, amount, note: "" }];
        });
      } else {
        const existing = allEmpAllowances.find(a => a.employeeId === empId && a.allowanceTypeId === atTypeId);
        if (existing) {
          await api.deleteEmployeeAllowance(existing.id);
          setAllEmpAllowances(prev => prev.filter(a => a.id !== existing.id));
        }
      }
    } catch {}
    setAssignSaving(false);
  }, [useAPI, allEmpAllowances]);

  // Gán mức mặc định cho 1 loại PC → tất cả NV active chưa có
  const assignDefaultToMissing = useCallback(async (atTypeId) => {
    const at = allowanceTypes.find(a => a.id === atTypeId);
    if (!at?.defaultAmount) return;
    const activeIds = employees.filter(e => e.status !== "inactive").map(e => e.id);
    const alreadyHas = new Set(allEmpAllowances.filter(a => a.allowanceTypeId === atTypeId).map(a => a.employeeId));
    const missing = activeIds.filter(id => !alreadyHas.has(id));
    if (!missing.length) { notify("Tất cả NV đã có phụ cấp này", true); return; }
    if (!window.confirm(`Gán "${at.name}" = ${fmtMoney(at.defaultAmount)}đ cho ${missing.length} NV chưa có?`)) return;
    if (useAPI) {
      const api = await import("../api.js");
      const r = await api.assignAllowanceToAllActive(atTypeId, at.defaultAmount);
      if (r?.error) notify("Lỗi: " + r.error, false);
      else { notify(`Đã gán cho ${r.count} NV`); loadAllEmpAllowances(); }
    }
  }, [allowanceTypes, employees, allEmpAllowances, useAPI, notify, loadAllEmpAllowances]);

  const assignAllToActive = async (atTypeId) => {
    const at = allowanceTypes.find(a => a.id === atTypeId);
    if (!at || !at.defaultAmount || at.defaultAmount <= 0) { notify("Cần set mức mặc định > 0 trước khi gán hàng loạt. Bấm Sửa để nhập mức mặc định.", false); return; }
    if (!window.confirm(`Gán "${at.name}" = ${fmtMoney(at.defaultAmount)}đ cho tất cả NV đang làm?`)) return;
    if (useAPI) {
      const api = await import("../api.js");
      const r = await api.assignAllowanceToAllActive(atTypeId, at.defaultAmount);
      if (r?.error) notify("Lỗi: " + r.error, false);
      else notify(`Đã gán "${at.name}" cho ${r.count} NV`);
    }
  };

  // ─── Table styles ───
  const ths = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.68rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", cursor: "pointer", whiteSpace: "nowrap" };
  const tds = { padding: "8px 10px", fontSize: "0.78rem", borderBottom: "1px solid var(--bd)" };

  // ─── RENDER ───
  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>👤 Nhân sự</h2>
          <span style={{ fontSize: "0.72rem", color: "var(--tm)" }}>{employees.length} nhân viên</span>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => { setDeptDlg("new"); setDeptFm({ name: "", description: "", attendanceBonus: false, sundayMode: "off_default", skipAttendance: false, shiftId: "" }); }} style={{ padding: "7px 14px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}>+ Bộ phận</button>
          <button onClick={() => setAtListDlg(true)} style={{ padding: "7px 14px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}>📋 Phụ cấp</button>
          <button onClick={openNew} style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm nhân viên</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            {/* Filter row */}
            <tr style={{ background: "var(--bgs)" }}>
              <td style={{ padding: "3px 4px" }} />
              <td style={{ padding: "3px 4px" }} />
              <td style={{ padding: "3px 4px" }}>
                <input value={fSearch} onChange={e => setFSearch(e.target.value)} placeholder="Tìm tên/mã/SĐT..." style={{ width: "100%", fontSize: "0.64rem", padding: "2px 3px", borderRadius: 4, border: "1px solid var(--bd)", outline: "none" }} />
              </td>
              <td style={{ padding: "3px 4px" }}>
                <select value={fDept} onChange={e => setFDept(e.target.value)} style={{ width: "100%", fontSize: "0.64rem", padding: "2px 3px", borderRadius: 4, border: "1px solid var(--bd)", outline: "none" }}>
                  <option value="">Tất cả</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </td>
              <td style={{ padding: "3px 4px" }} />
              <td style={{ padding: "3px 4px" }}>
                <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width: "100%", fontSize: "0.64rem", padding: "2px 3px", borderRadius: 4, border: "1px solid var(--bd)", outline: "none" }}>
                  <option value="">Tất cả</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </td>
              <td style={{ padding: "3px 4px" }} />
              <td style={{ padding: "3px 4px" }} />
              <td style={{ padding: "3px 4px" }} />
              <td style={{ padding: "3px 4px" }} />
            </tr>
            {/* Header row */}
            <tr>
              <th style={{ ...ths, width: 36, textAlign: "center" }}>STT</th>
              <th onClick={() => toggleSort("code")} style={{ ...ths, width: 80, cursor: "pointer" }}>Mã NV{sortIcon("code")}</th>
              <th onClick={() => toggleSort("fullName")} style={{ ...ths, cursor: "pointer" }}>Họ tên{sortIcon("fullName")}</th>
              <th onClick={() => toggleSort("departmentId")} style={{ ...ths, cursor: "pointer" }}>Bộ phận{sortIcon("departmentId")}</th>
              <th onClick={() => toggleSort("position")} style={{ ...ths, cursor: "pointer" }}>Chức vụ{sortIcon("position")}</th>
              <th onClick={() => toggleSort("status")} style={{ ...ths, cursor: "pointer" }}>Trạng thái{sortIcon("status")}</th>
              <th onClick={() => toggleSort("employeeType")} style={{ ...ths, cursor: "pointer" }}>Loại NV{sortIcon("employeeType")}</th>
              <th onClick={() => toggleSort("salaryType")} style={{ ...ths, cursor: "pointer" }}>Loại lương{sortIcon("salaryType")}</th>
              <th onClick={() => toggleSort("baseSalary")} style={{ ...ths, textAlign: "right", cursor: "pointer" }}>Lương CB{sortIcon("baseSalary")}</th>
              <th style={{ ...ths, textAlign: "center", width: 80 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={10} style={{ padding: 24, textAlign: "center", color: "var(--tm)", fontSize: "0.82rem" }}>Chưa có nhân viên nào</td></tr>
            )}
            {filtered.map((emp, i) => (
              <tr key={emp.id} data-clickable="true" onClick={() => openDetail(emp)} style={{ cursor: "pointer" }}>
                <td style={{ ...tds, textAlign: "center", fontSize: "0.68rem", color: "var(--tm)", width: 36 }}>{i + 1}</td>
                <td style={{ ...tds, whiteSpace: "nowrap", fontFamily: "monospace", fontWeight: 600 }}>{emp.code}</td>
                <td style={{ ...tds, fontWeight: 600 }}>{emp.fullName}</td>
                <td style={tds}>{deptName(emp.departmentId)}</td>
                <td style={tds}>{emp.position || "—"}</td>
                <td style={tds}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: "0.68rem", fontWeight: 700, background: STATUS_COLORS[emp.status] + "22", color: STATUS_COLORS[emp.status] }}>{STATUS_LABELS[emp.status]}</span>
                </td>
                <td style={tds}>
                  <span style={{ padding: "2px 6px", borderRadius: 10, fontSize: "0.65rem", fontWeight: 600, background: emp.employeeType === "collaborator" ? "#9b59b622" : "#27ae6022", color: emp.employeeType === "collaborator" ? "#9b59b6" : "#27ae60" }}>{emp.employeeType === "collaborator" ? "CTV" : "Chính thức"}</span>
                </td>
                <td style={tds}>{SALARY_TYPE_LABELS[emp.salaryType]}</td>
                <td style={{ ...tds, textAlign: "right", fontWeight: 600 }}>{fmtMoney(emp.baseSalary)}</td>
                <td style={{ ...tds, textAlign: "center", whiteSpace: "nowrap" }}>
                  <button onClick={e => { e.stopPropagation(); openEdit(emp); }} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid var(--bd)", background: "transparent", color: "var(--ac)", cursor: "pointer", fontSize: "0.7rem", fontWeight: 600, marginRight: 4 }}>Sửa</button>
                  <button onClick={e => { e.stopPropagation(); handleDelete(emp); }} style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #e74c3c44", background: "transparent", color: "#e74c3c", cursor: "pointer", fontSize: "0.7rem", fontWeight: 600 }}>Xóa</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ═══ Employee Form Dialog ═══ */}
      {dlg && (
        <Dialog open onClose={() => setDlg(null)} title={dlg === "new" ? "Thêm nhân viên" : "Sửa nhân viên"} width={600} noEnter>
          {/* Thông tin cơ bản */}
          <div style={gridRow}>
            <div>
              <label style={labelSt}>Mã NV</label>
              <input value={fm.code} disabled style={{ ...inputSt, background: "var(--bgs)" }} />
            </div>
            <div>
              <label style={labelSt}>Họ tên *</label>
              <input value={fm.fullName} onChange={e => setFm(p => ({ ...p, fullName: e.target.value }))} style={inputSt} />
              {fmErr.fullName && <div style={errSt}>{fmErr.fullName}</div>}
            </div>
          </div>
          <div style={gridRow}>
            <div>
              <label style={labelSt}>Ngày sinh</label>
              <input type="date" value={fm.dateOfBirth} onChange={e => setFm(p => ({ ...p, dateOfBirth: e.target.value }))} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>CMND/CCCD</label>
              <input value={fm.idNumber} onChange={e => setFm(p => ({ ...p, idNumber: e.target.value }))} style={inputSt} />
            </div>
          </div>
          <div style={gridRow}>
            <div>
              <label style={labelSt}>Điện thoại</label>
              <input value={fm.phone} onChange={e => setFm(p => ({ ...p, phone: e.target.value }))} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Địa chỉ</label>
              <input value={fm.address} onChange={e => setFm(p => ({ ...p, address: e.target.value }))} style={inputSt} />
            </div>
          </div>

          {/* Công việc */}
          <div style={{ borderTop: "1px solid var(--bd)", marginTop: 8, paddingTop: 10 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ac)", marginBottom: 8 }}>CÔNG VIỆC</div>
          </div>
          <div style={gridRow}>
            <div>
              <label style={labelSt}>Bộ phận</label>
              <select value={fm.departmentId} onChange={e => setFm(p => ({ ...p, departmentId: e.target.value }))} style={inputSt}>
                <option value="">-- Chọn --</option>
                {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>Chức vụ</label>
              <input value={fm.position} onChange={e => setFm(p => ({ ...p, position: e.target.value }))} style={inputSt} placeholder="VD: Thợ xẻ chính" />
            </div>
          </div>
          <div style={gridRow}>
            <div>
              <label style={labelSt}>Ngày bắt đầu *</label>
              <input type="date" value={fm.startDate} onChange={e => setFm(p => ({ ...p, startDate: e.target.value }))} style={inputSt} />
              {fmErr.startDate && <div style={errSt}>{fmErr.startDate}</div>}
            </div>
            <div>
              <label style={labelSt}>Trạng thái</label>
              <select value={fm.status} onChange={e => setFm(p => ({ ...p, status: e.target.value }))} style={inputSt}>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>
          <div style={gridRow}>
            <div>
              <label style={labelSt}>Loại nhân viên</label>
              <select value={fm.employeeType || "official"} onChange={e => setFm(p => ({ ...p, employeeType: e.target.value }))} style={inputSt}>
                <option value="official">Chính thức</option>
                <option value="collaborator">Cộng tác viên</option>
              </select>
            </div>
            <div>
              <label style={labelSt}>Quản lý trực tiếp</label>
              <select value={fm.managerId} onChange={e => setFm(p => ({ ...p, managerId: e.target.value }))} style={inputSt}>
                <option value="">-- Không --</option>
                {employees.filter(e => e.id !== dlg && e.isManager).map(e => <option key={e.id} value={e.id}>{e.fullName} ({e.code})</option>)}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", paddingTop: 18 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.78rem" }}>
                <input type="checkbox" checked={fm.isManager} onChange={e => setFm(p => ({ ...p, isManager: e.target.checked }))} />
                Là quản lý bộ phận
              </label>
            </div>
          </div>

          {/* Chấm công */}
          <div style={gridRow}>
            <div>
              <label style={labelSt}>Mã máy chấm công</label>
              <input value={fm.machineCode} onChange={e => setFm(p => ({ ...p, machineCode: e.target.value }))} style={inputSt} placeholder="VD: 00023" />
            </div>
            <div>
              <label style={labelSt}>Xin muộn (phút)</label>
              <input value={fm.lateGraceMinutes} onChange={e => setFm(p => ({ ...p, lateGraceMinutes: e.target.value.replace(/[^0-9]/g, "") }))} style={inputSt} placeholder="0" />
              {Number(fm.lateGraceMinutes) > 0 && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 2 }}>Được phép muộn tối đa {fm.lateGraceMinutes} phút/ngày</div>}
            </div>
          </div>

          {/* Lương */}
          <div style={{ borderTop: "1px solid var(--bd)", marginTop: 8, paddingTop: 10 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ac)", marginBottom: 8 }}>LƯƠNG & BHXH</div>
          </div>
          <div style={gridRow}>
            <div>
              <label style={labelSt}>Loại lương</label>
              <select value={fm.salaryType} onChange={e => setFm(p => ({ ...p, salaryType: e.target.value }))} style={inputSt}>
                <option value="monthly">Lương tháng</option>
                <option value="daily">Lương ngày</option>
              </select>
            </div>
            <div>
              <label style={labelSt}>Lương cơ bản * ({fm.salaryType === "monthly" ? "đ/tháng" : "đ/ngày"})</label>
              <input value={fm.baseSalary} onChange={e => setFm(p => ({ ...p, baseSalary: e.target.value.replace(/[^0-9]/g, "") }))} style={{ ...inputSt, textAlign: "right" }} placeholder="VD: 10000000" />
              {fmErr.baseSalary && <div style={errSt}>{fmErr.baseSalary}</div>}
              {fm.baseSalary && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 2 }}>{fmtMoney(fm.baseSalary)}đ</div>}
            </div>
          </div>
          {fm.status === "probation" && (
            <div style={{ ...gridRow, gridTemplateColumns: "1fr 1fr 1fr" }}>
              <div>
                <label style={labelSt}>Tỷ lệ thử việc (%)</label>
                <input value={fm.probationRate} onChange={e => setFm(p => ({ ...p, probationRate: e.target.value.replace(/[^0-9]/g, "") }))} style={inputSt} placeholder="85" />
              </div>
              <div style={{ gridColumn: "2/4", paddingTop: 18, fontSize: "0.72rem", color: "var(--tm)" }}>
                Lương thử việc: <strong style={{ color: "var(--tp)" }}>{fmtMoney(Math.round((Number(fm.baseSalary) || 0) * (Number(fm.probationRate) || 85) / 100))}đ</strong>
              </div>
            </div>
          )}
          <div style={gridRow}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: "0.78rem" }}>
                <input type="checkbox" checked={fm.bhxhEnrolled} onChange={e => setFm(p => ({ ...p, bhxhEnrolled: e.target.checked }))} />
                Đóng BHXH
              </label>
            </div>
          </div>
          {fm.bhxhEnrolled && (
            <div style={gridRow}>
              <div>
                <label style={labelSt}>Số tiền đóng BHXH (khấu trừ vào lương)</label>
                <input value={fm.bhxhAmount || ""} onChange={e => setFm(p => ({ ...p, bhxhAmount: e.target.value.replace(/[^0-9]/g, "") }))} style={{ ...inputSt, textAlign: "right" }} placeholder="VD: 1141650" />
                {fm.bhxhAmount && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 2 }}>{fmtMoney(fm.bhxhAmount)}đ/tháng — trừ vào lương, phụ cấp BHXH gán riêng</div>}
              </div>
            </div>
          )}

          {/* Ngân hàng */}
          <div style={{ borderTop: "1px solid var(--bd)", marginTop: 8, paddingTop: 10 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ac)", marginBottom: 8 }}>TÀI KHOẢN NGÂN HÀNG</div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 10 }}>
            <div>
              <label style={labelSt}>Ngân hàng</label>
              <input value={fm.bankName} onChange={e => setFm(p => ({ ...p, bankName: e.target.value }))} style={inputSt} placeholder="VD: Vietcombank" />
            </div>
            <div>
              <label style={labelSt}>Số tài khoản</label>
              <input value={fm.bankAccount} onChange={e => setFm(p => ({ ...p, bankAccount: e.target.value }))} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Chủ tài khoản</label>
              <input value={fm.bankHolder} onChange={e => setFm(p => ({ ...p, bankHolder: e.target.value }))} style={inputSt} />
            </div>
          </div>

          {/* Ghi chú */}
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Ghi chú</label>
            <textarea value={fm.note} onChange={e => setFm(p => ({ ...p, note: e.target.value }))} rows={2} style={{ ...inputSt, resize: "vertical" }} />
          </div>

          {/* Footer */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={handleSave} disabled={saving} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>{saving ? "Đang lưu..." : "Lưu"}</button>
          </div>
        </Dialog>
      )}

      {/* ═══ Change Reason Dialog ═══ */}
      {changeDlg && (
        <Dialog open onClose={() => setChangeDlg(null)} onOk={() => { setChangeDlg(null); saveEmployee(changeReason, changeDate); }} title="Xác nhận thay đổi" width={420}>
          <div style={{ fontSize: "0.78rem", marginBottom: 12 }}>
            Các thay đổi quan trọng:
            {changeDlg.changes.filter(c => ["salary", "allowance", "bhxh", "probation_rate"].includes(c.changeType)).map((c, i) => (
              <div key={i} style={{ padding: "4px 0", borderBottom: "1px solid var(--bd)" }}>
                <strong>{c.fieldName}</strong>: {c.oldValue} → <span style={{ color: "var(--ac)", fontWeight: 700 }}>{c.newValue}</span>
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Ngày hiệu lực</label>
            <input type="date" value={changeDate} onChange={e => setChangeDate(e.target.value)} style={inputSt} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Lý do thay đổi</label>
            <textarea value={changeReason} onChange={e => setChangeReason(e.target.value)} rows={2} style={{ ...inputSt, resize: "vertical" }} placeholder="VD: Tăng lương định kỳ Q2" />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setChangeDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={() => { setChangeDlg(null); saveEmployee(changeReason, changeDate); }} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Xác nhận</button>
          </div>
        </Dialog>
      )}

      {/* ═══ Detail Panel (click row) ═══ */}
      {detailEmp && (
        <Dialog open onClose={() => setDetailEmp(null)} title={`${detailEmp.fullName} (${detailEmp.code})`} width={620} noEnter>
          {/* Tabs */}
          <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--bd)", marginBottom: 12 }}>
            {[["info", "Thông tin"], ["allowance", "Phụ cấp"], ["history", "Lịch sử"]].map(([k, lb]) => (
              <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 16px", border: "none", borderBottom: tab === k ? "2px solid var(--ac)" : "2px solid transparent", marginBottom: -2, background: "transparent", cursor: "pointer", fontWeight: tab === k ? 700 : 500, fontSize: "0.78rem", color: tab === k ? "var(--ac)" : "var(--ts)" }}>{lb}</button>
            ))}
          </div>

          {loadingDetail && <div style={{ padding: 16, textAlign: "center", color: "var(--tm)", fontSize: "0.82rem" }}>Đang tải...</div>}

          {/* Tab: Thông tin */}
          {tab === "info" && !loadingDetail && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px", fontSize: "0.78rem" }}>
              <div><span style={{ color: "var(--tm)" }}>Bộ phận:</span> {deptName(detailEmp.departmentId)}</div>
              <div><span style={{ color: "var(--tm)" }}>Chức vụ:</span> {detailEmp.position || "—"}</div>
              <div><span style={{ color: "var(--tm)" }}>Trạng thái:</span> <span style={{ color: STATUS_COLORS[detailEmp.status], fontWeight: 700 }}>{STATUS_LABELS[detailEmp.status]}</span></div>
              <div><span style={{ color: "var(--tm)" }}>Ngày bắt đầu:</span> {fmtDate(detailEmp.startDate)}</div>
              <div><span style={{ color: "var(--tm)" }}>Loại lương:</span> {SALARY_TYPE_LABELS[detailEmp.salaryType]}</div>
              <div><span style={{ color: "var(--tm)" }}>Lương CB:</span> <strong>{fmtMoney(detailEmp.baseSalary)}đ</strong></div>
              {detailEmp.status === "probation" && (
                <div><span style={{ color: "var(--tm)" }}>Tỷ lệ thử việc:</span> {Math.round((detailEmp.probationRate || 0.85) * 100)}% → <strong>{fmtMoney(Math.round(detailEmp.baseSalary * (detailEmp.probationRate || 0.85)))}đ</strong></div>
              )}
              <div><span style={{ color: "var(--tm)" }}>Quản lý:</span> {detailEmp.managerId ? mgrName(detailEmp.managerId) : "—"}</div>
              <div><span style={{ color: "var(--tm)" }}>SĐT:</span> {detailEmp.phone || "—"}</div>
              <div><span style={{ color: "var(--tm)" }}>CCCD:</span> {detailEmp.idNumber || "—"}</div>
              {detailEmp.bhxhEnrolled && (
                <div><span style={{ color: "var(--tm)" }}>BHXH khấu trừ:</span> <strong style={{ color: "#e74c3c" }}>{fmtMoney(detailEmp.bhxhAmount)}đ</strong>/tháng</div>
              )}
              {detailEmp.bankAccount && (
                <div style={{ gridColumn: "1/3" }}><span style={{ color: "var(--tm)" }}>Ngân hàng:</span> {detailEmp.bankName} — {detailEmp.bankAccount} ({detailEmp.bankHolder})</div>
              )}
            </div>
          )}

          {/* Tab: Phụ cấp */}
          {tab === "allowance" && !loadingDetail && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: "0.75rem", color: "var(--tm)" }}>Tổng: <strong style={{ color: "var(--tp)" }}>{fmtMoney(empAllowances.reduce((s, a) => s + a.amount, 0))}đ/tháng</strong></span>
                <button onClick={() => openAlDlg("", null)} style={{ padding: "4px 10px", borderRadius: 5, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.7rem" }}>+ Thêm</button>
              </div>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={ths}>Loại phụ cấp</th>
                    <th style={{ ...ths, textAlign: "right" }}>Số tiền (đ/tháng)</th>
                    <th style={ths}>Ghi chú</th>
                    <th style={{ ...ths, width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {empAllowances.length === 0 && <tr><td colSpan={4} style={{ padding: 16, textAlign: "center", color: "var(--tm)", fontSize: "0.78rem" }}>Chưa có phụ cấp</td></tr>}
                  {empAllowances.map(al => (
                    <tr key={al.id}>
                      <td style={tds}>{allowanceTypes.find(t => t.id === al.allowanceTypeId)?.name || "—"}</td>
                      <td style={{ ...tds, textAlign: "right", fontWeight: 600 }}>{fmtMoney(al.amount)}</td>
                      <td style={tds}>{al.note || "—"}</td>
                      <td style={{ ...tds, whiteSpace: "nowrap" }}>
                        <button onClick={() => openAlDlg(al.allowanceTypeId, al)} style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--bd)", background: "transparent", color: "var(--ac)", cursor: "pointer", fontSize: "0.65rem", marginRight: 3 }}>Sửa</button>
                        <button onClick={() => deleteAllowance(al)} style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid #e74c3c44", background: "transparent", color: "#e74c3c", cursor: "pointer", fontSize: "0.65rem" }}>Xóa</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Tab: Lịch sử */}
          {tab === "history" && !loadingDetail && (
            <div>
              {empHistory.length === 0 && <div style={{ padding: 16, textAlign: "center", color: "var(--tm)", fontSize: "0.78rem" }}>Chưa có lịch sử thay đổi</div>}
              {empHistory.map(h => (
                <div key={h.id} style={{ padding: "8px 0", borderBottom: "1px solid var(--bd)", fontSize: "0.78rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: 700 }}>
                      <span style={{ display: "inline-block", padding: "1px 6px", borderRadius: 4, fontSize: "0.65rem", background: "var(--ac)22", color: "var(--ac)", marginRight: 6 }}>{CHANGE_TYPE_LABELS[h.changeType] || h.changeType}</span>
                      {h.fieldName}
                    </span>
                    <span style={{ fontSize: "0.65rem", color: "var(--tm)" }}>{fmtDate(h.effectiveDate || h.createdAt)}</span>
                  </div>
                  {h.oldValue && (
                    <div style={{ fontSize: "0.72rem", color: "var(--tm)", marginTop: 2 }}>
                      {h.oldValue} → <span style={{ color: "var(--ac)", fontWeight: 600 }}>{h.newValue}</span>
                    </div>
                  )}
                  {!h.oldValue && h.newValue && (
                    <div style={{ fontSize: "0.72rem", color: "var(--ac)", fontWeight: 600, marginTop: 2 }}>{h.newValue}</div>
                  )}
                  {h.reason && <div style={{ fontSize: "0.68rem", color: "var(--tm)", fontStyle: "italic", marginTop: 2 }}>Lý do: {h.reason}</div>}
                  {h.createdBy && <div style={{ fontSize: "0.62rem", color: "var(--tm)", marginTop: 1 }}>bởi {h.createdBy}</div>}
                </div>
              ))}
            </div>
          )}

          {/* Footer */}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setDetailEmp(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Đóng</button>
            <button onClick={() => { setDetailEmp(null); openEdit(detailEmp); }} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Chỉnh sửa</button>
          </div>
        </Dialog>
      )}

      {/* ═══ Allowance Edit Dialog ═══ */}
      {alDlg && (
        <Dialog open onClose={() => setAlDlg(null)} onOk={saveAllowance} title="Phụ cấp" width={380}>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Loại phụ cấp</label>
            <select value={alDlg.allowanceTypeId} onChange={e => {
              const typeId = e.target.value;
              const at = allowanceTypes.find(t => t.id === typeId);
              setAlDlg(p => ({ ...p, allowanceTypeId: typeId, amount: (!p.existingId && at?.defaultAmount) ? String(at.defaultAmount) : p.amount }));
            }} style={inputSt}>
              <option value="">-- Chọn --</option>
              {allowanceTypes.filter(t => t.isActive !== false).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Số tiền (đ/tháng)</label>
            <input value={alDlg.amount} onChange={e => setAlDlg(p => ({ ...p, amount: e.target.value.replace(/[^0-9]/g, "") }))} style={{ ...inputSt, textAlign: "right" }} />
            {alDlg.amount && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 2 }}>{fmtMoney(alDlg.amount)}đ</div>}
            {(() => { const at = allowanceTypes.find(t => t.id === alDlg.allowanceTypeId); return at?.defaultAmount ? <div style={{ fontSize: "0.62rem", color: "var(--ac)", marginTop: 1 }}>Mặc định: {fmtMoney(at.defaultAmount)}đ{at.calcMode === "per_day" ? "/ngày công" : at.calcMode === "prorated" ? " (theo mốc công)" : "/tháng"}</div> : null; })()}
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Ghi chú</label>
            <input value={alDlg.note} onChange={e => setAlDlg(p => ({ ...p, note: e.target.value }))} style={inputSt} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setAlDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={saveAllowance} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
          </div>
        </Dialog>
      )}

      {/* ═══ Department Dialog ═══ */}
      {deptDlg && (
        <Dialog open onClose={() => setDeptDlg(null)} title="Quản lý bộ phận" width={500} noEnter>
          {/* Danh sách bộ phận */}
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
            <thead>
              <tr>
                <th style={{ ...ths, width: 30, textAlign: "center" }}>STT</th>
                <th style={ths}>Tên</th>
                <th style={{ ...ths, textAlign: "center" }}>CN</th>
                <th style={{ ...ths, textAlign: "center" }}>CC</th>
                <th style={ths}>Ca</th>
                <th style={{ ...ths, textAlign: "center" }}>Chấm công</th>
                <th style={{ ...ths, width: 45 }} />
              </tr>
            </thead>
            <tbody>
              {departments.map((d, i) => (
                <tr key={d.id}>
                  <td style={{ ...tds, textAlign: "center", fontSize: "0.68rem", color: "var(--tm)" }}>{i + 1}</td>
                  <td style={{ ...tds, fontWeight: 600 }}>{d.name}</td>
                  <td style={{ ...tds, textAlign: "center", fontSize: "0.62rem" }}>
                    <span style={{ color: d.sundayMode === "campaign" ? "#e67e22" : d.sundayMode === "not_applicable" ? "var(--tm)" : "#3498db" }}>
                      {d.sundayMode === "campaign" ? "Chiến dịch" : d.sundayMode === "not_applicable" ? "N/A" : "Nghỉ"}
                    </span>
                  </td>
                  <td style={{ ...tds, textAlign: "center" }}>{d.attendanceBonus ? <span style={{ color: "#27ae60", fontWeight: 700 }}>✓</span> : "—"}</td>
                  <td style={{ ...tds, fontSize: "0.68rem" }}>{(() => { const s = workShifts.find(ws => ws.id === d.shiftId); return s ? s.name.replace("Ca ", "") : <span style={{ color: "var(--tm)" }}>—</span>; })()}</td>
                  <td style={{ ...tds, textAlign: "center" }}>{d.skipAttendance ? <span style={{ color: "var(--tm)" }}>Bỏ qua</span> : <span style={{ color: "#27ae60" }}>✓</span>}</td>
                  <td style={{ ...tds, whiteSpace: "nowrap" }}>{isAdmin && <>
                    <button onClick={() => { setDeptDlg(d.id); setDeptFm({ name: d.name, description: d.description || "", attendanceBonus: d.attendanceBonus || false, sundayMode: d.sundayMode || "off_default", skipAttendance: d.skipAttendance || false, shiftId: d.shiftId || "" }); }} style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--bd)", background: "transparent", color: "var(--ac)", cursor: "pointer", fontSize: "0.65rem", marginRight: 3 }}>Sửa</button>
                    <button onClick={async () => {
                      const empCount = employees.filter(e => e.departmentId === d.id).length;
                      if (empCount > 0) { notify(`Không thể xóa "${d.name}" — đang có ${empCount} NV`, false); return; }
                      if (!window.confirm(`Xóa bộ phận "${d.name}"?`)) return;
                      if (useAPI) {
                        const api = await import("../api.js");
                        const r = await api.deleteDepartment(d.id);
                        if (r?.error) notify("Lỗi: " + r.error, false);
                        else { setDepartments(p => p.filter(x => x.id !== d.id)); notify("Đã xóa"); }
                      }
                    }} style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid #e74c3c44", background: "transparent", color: "#e74c3c", cursor: "pointer", fontSize: "0.65rem" }}>Xóa</button>
                  </>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {/* Form thêm/sửa — chỉ admin */}
          {isAdmin && <div style={{ padding: 10, background: "var(--bgs)", borderRadius: 6 }}>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ac)", marginBottom: 8 }}>{deptDlg === "new" ? "Thêm mới" : "Sửa bộ phận"}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
              <div>
                <label style={labelSt}>Tên bộ phận</label>
                <input value={deptFm.name} onChange={e => setDeptFm(p => ({ ...p, name: e.target.value }))} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Mô tả</label>
                <input value={deptFm.description} onChange={e => setDeptFm(p => ({ ...p, description: e.target.value }))} style={inputSt} />
              </div>
            </div>
            <div style={{ marginBottom: 8 }}>
              <label style={labelSt}>Ca làm việc</label>
              <select value={deptFm.shiftId || ""} onChange={e => setDeptFm(p => ({ ...p, shiftId: e.target.value }))} style={inputSt}>
                <option value="">— Chưa gán —</option>
                {workShifts.map(s => <option key={s.id} value={s.id}>{s.name} ({s.startTime?.slice(0,5)}–{s.endTime?.slice(0,5)})</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8 }}>
              <div>
                <label style={labelSt}>Chế độ chủ nhật</label>
                <select value={deptFm.sundayMode || "off_default"} onChange={e => setDeptFm(p => ({ ...p, sundayMode: e.target.value }))} style={inputSt}>
                  <option value="off_default">Nghỉ mặc định</option>
                  <option value="campaign">Chiến dịch (CN bắt buộc)</option>
                  <option value="not_applicable">Không áp dụng (CTV)</option>
                </select>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6, paddingTop: 18 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: "0.75rem" }}>
                  <input type="checkbox" checked={deptFm.attendanceBonus || false} onChange={e => setDeptFm(p => ({ ...p, attendanceBonus: e.target.checked }))} />
                  Thưởng chuyên cần
                </label>
                <label style={{ display: "flex", alignItems: "center", gap: 5, cursor: "pointer", fontSize: "0.75rem" }}>
                  <input type="checkbox" checked={deptFm.skipAttendance || false} onChange={e => setDeptFm(p => ({ ...p, skipAttendance: e.target.checked }))} />
                  Bỏ qua chấm công
                </label>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", gap: 6 }}>
                {deptDlg !== "new" && <button onClick={() => { setDeptDlg("new"); setDeptFm({ name: "", description: "", attendanceBonus: false, sundayMode: "off_default", skipAttendance: false, shiftId: "" }); }} style={{ padding: "6px 12px", borderRadius: 6, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem" }}>+ Thêm mới</button>}
                <button onClick={saveDept} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.72rem" }}>Lưu</button>
              </div>
            </div>
          </div>}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setDeptDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Đóng</button>
          </div>
        </Dialog>
      )}

      {/* ═══ Allowance Type List + Assign Matrix Dialog ═══ */}
      {atListDlg && (() => {
        const activeAts = allowanceTypes.filter(t => t.isActive !== false);
        const activeEmpsList = employees.filter(e => e.status !== "inactive").sort((a, b) => a.code.localeCompare(b.code));
        const alMap = {};
        allEmpAllowances.forEach(a => { alMap[`${a.employeeId}_${a.allowanceTypeId}`] = a; });
        return (
          <Dialog open onClose={() => { if (!atDlg && !alDlg) setAtListDlg(false); }} title="Quản lý phụ cấp" width={atListTab === "assign" ? Math.min(1400, 350 + activeAts.length * 110) : 750} noEnter>
            {/* Tabs */}
            <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--bd)", marginBottom: 12 }}>
              {[["types", "Loại phụ cấp"], ["assign", "Gán phụ cấp"]].map(([k, lb]) => (
                <button key={k} onClick={() => { setAtListTab(k); if (k === "assign") loadAllEmpAllowances(); }} style={{ padding: "7px 14px", border: "none", borderBottom: atListTab === k ? "2px solid var(--ac)" : "2px solid transparent", marginBottom: -2, background: "transparent", cursor: "pointer", fontWeight: atListTab === k ? 700 : 500, fontSize: "0.78rem", color: atListTab === k ? "var(--ac)" : "var(--ts)" }}>{lb}</button>
              ))}
            </div>

            {/* Tab: Loại phụ cấp */}
            {atListTab === "types" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--tm)" }}>{allowanceTypes.length} loại phụ cấp</span>
                  <button onClick={() => { setAtDlg("new"); setAtFm({ name: "", description: "", calcMode: "fixed", defaultAmount: "" }); }} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.72rem" }}>+ Thêm mới</button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...ths, width: 36, textAlign: "center" }}>STT</th>
                      <th style={ths}>Tên</th>
                      <th style={ths}>Mô tả</th>
                      <th style={{ ...ths, textAlign: "right" }}>Mức mặc định</th>
                      <th style={{ ...ths, textAlign: "center" }}>Cách tính</th>
                      <th style={{ ...ths, textAlign: "center" }}>Trạng thái</th>
                      <th style={{ ...ths, width: 80 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {allowanceTypes.length === 0 && <tr><td colSpan={7} style={{ padding: 16, textAlign: "center", color: "var(--tm)", fontSize: "0.82rem" }}>Chưa có loại phụ cấp</td></tr>}
                    {allowanceTypes.map((at, i) => (
                      <tr key={at.id}>
                        <td style={{ ...tds, textAlign: "center", fontSize: "0.68rem", color: "var(--tm)" }}>{i + 1}</td>
                        <td style={{ ...tds, fontWeight: 600 }}>{at.name}</td>
                        <td style={{ ...tds, color: "var(--tm)" }}>{at.description || "—"}</td>
                        <td style={{ ...tds, textAlign: "right", fontWeight: 600 }}>{at.defaultAmount ? fmtMoney(at.defaultAmount) : "—"}</td>
                        <td style={{ ...tds, textAlign: "center" }}>
                    <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: "0.62rem", fontWeight: 600, background: at.calcMode === "per_day" ? "#8e44ad22" : at.calcMode === "prorated" ? "#f39c1222" : "var(--bgs)", color: at.calcMode === "per_day" ? "#8e44ad" : at.calcMode === "prorated" ? "#f39c12" : "var(--ts)" }}>
                      {at.calcMode === "per_day" ? "×ngày công" : at.calcMode === "prorated" ? "Theo mốc" : "Cố định"}
                    </span>
                  </td>
                        <td style={{ ...tds, textAlign: "center" }}><span style={{ padding: "2px 8px", borderRadius: 10, fontSize: "0.65rem", fontWeight: 700, background: at.isActive !== false ? "#27ae6022" : "#e74c3c22", color: at.isActive !== false ? "#27ae60" : "#e74c3c" }}>{at.isActive !== false ? "Hoạt động" : "Tắt"}</span></td>
                        <td style={{ ...tds, whiteSpace: "nowrap" }}>
                          <button onClick={() => { setAtDlg(at.id); setAtFm({ name: at.name, description: at.description || "", calcMode: at.calcMode || "fixed", defaultAmount: at.defaultAmount ? String(at.defaultAmount) : "" }); }} style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--bd)", background: "transparent", color: "var(--ac)", cursor: "pointer", fontSize: "0.65rem", marginRight: 3 }}>Sửa</button>
                          <button onClick={async () => {
                            // Kiểm tra đã gán cho NV nào chưa
                            const assignCount = allEmpAllowances.filter(a => a.allowanceTypeId === at.id).length;
                            if (assignCount > 0) { notify(`Không thể xóa "${at.name}" — đang gán cho ${assignCount} NV`, false); return; }
                            if (!window.confirm(`Xóa loại phụ cấp "${at.name}"?`)) return;
                            if (useAPI) {
                              const api = await import("../api.js");
                              const r = await api.deleteAllowanceType(at.id);
                              if (r?.error) notify("Lỗi: " + r.error, false);
                              else { setAllowanceTypes(p => p.filter(a => a.id !== at.id)); notify("Đã xóa"); }
                            }
                          }} style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid #e74c3c44", background: "transparent", color: "#e74c3c", cursor: "pointer", fontSize: "0.65rem" }}>Xóa</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            {/* Tab: Gán phụ cấp — Ma trận NV × Loại PC */}
            {atListTab === "assign" && (
              <>
                <div style={{ fontSize: "0.72rem", color: "var(--tm)", marginBottom: 8 }}>
                  Click ô để nhập/sửa số tiền. <span style={{ display: "inline-block", width: 10, height: 10, background: "var(--acbg)", border: "1px solid var(--ac)", borderRadius: 2, verticalAlign: "middle" }} /> = đã gán.
                  Nút <strong style={{ color: "var(--ac)" }}>+ MĐ</strong> = gán mức mặc định cho tất cả NV <em>chưa có</em> loại phụ cấp đó (NV đã có sẽ không bị ghi đè). Chỉ hiện khi loại phụ cấp đã set mức mặc định.
                  {assignSaving && <span style={{ marginLeft: 8, color: "var(--ac)" }}>Đang lưu...</span>}
                </div>
                <div style={{ overflowX: "auto", maxHeight: "calc(90vh - 220px)" }}>
                  <table style={{ borderCollapse: "collapse" }}>
                    <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                      <tr>
                        <th style={{ ...ths, width: 36, textAlign: "center", position: "sticky", left: 0, zIndex: 3, background: "var(--bgh)" }}>STT</th>
                        <th style={{ ...ths, minWidth: 60, position: "sticky", left: 36, zIndex: 3, background: "var(--bgh)" }}>Mã</th>
                        <th style={{ ...ths, minWidth: 120, position: "sticky", left: 96, zIndex: 3, background: "var(--bgh)" }}>Họ tên</th>
                        {activeAts.map(at => (
                          <th key={at.id} style={{ ...ths, textAlign: "center", minWidth: 90, whiteSpace: "normal", lineHeight: 1.2 }}>
                            <div>{at.name}</div>
                            <div style={{ fontSize: "0.5rem", fontWeight: 600, color: at.calcMode === "per_day" ? "#8e44ad" : at.calcMode === "prorated" ? "#f39c12" : "var(--tm)", marginTop: 1 }}>
                              {at.calcMode === "per_day" ? `${fmtMoney(at.defaultAmount)}/ngày` : at.calcMode === "prorated" ? `${fmtMoney(at.defaultAmount)} (mốc)` : at.defaultAmount > 0 ? `${fmtMoney(at.defaultAmount)}/tháng` : "Cố định"}
                            </div>
                          </th>
                        ))}
                        <th style={{ ...ths, textAlign: "right", minWidth: 80 }}>Tổng</th>
                      </tr>
                      {/* Nút gán mặc định cho từng cột */}
                      <tr style={{ background: "var(--bgs)" }}>
                        <td colSpan={3} style={{ padding: "3px 4px", fontSize: "0.6rem", color: "var(--tm)", position: "sticky", left: 0, background: "var(--bgs)", zIndex: 2 }}>Gán nhanh ↓</td>
                        {activeAts.map(at => (
                          <td key={at.id} style={{ padding: "2px 2px", textAlign: "center" }}>
                            {at.defaultAmount > 0 && <button onClick={() => assignDefaultToMissing(at.id)} style={{ padding: "1px 4px", borderRadius: 3, border: "1px solid var(--ac)", background: "var(--acbg)", color: "var(--ac)", cursor: "pointer", fontSize: "0.55rem", fontWeight: 600 }} title={`Gán ${fmtMoney(at.defaultAmount)} cho NV chưa có`}>+ MĐ</button>}
                          </td>
                        ))}
                        <td style={{ padding: "2px 2px" }} />
                      </tr>
                    </thead>
                    <tbody>
                      {activeEmpsList.map((emp, i) => {
                        const empTotal = activeAts.reduce((s, at) => s + (alMap[`${emp.id}_${at.id}`]?.amount || 0), 0);
                        return (
                          <tr key={emp.id}>
                            <td style={{ ...tds, textAlign: "center", fontSize: "0.68rem", color: "var(--tm)", position: "sticky", left: 0, background: "var(--bgc)", zIndex: 1 }}>{i + 1}</td>
                            <td style={{ ...tds, fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap", position: "sticky", left: 36, background: "var(--bgc)", zIndex: 1 }}>{emp.code}</td>
                            <td style={{ ...tds, fontWeight: 600, whiteSpace: "nowrap", position: "sticky", left: 96, background: "var(--bgc)", zIndex: 1 }}>{emp.fullName}</td>
                            {activeAts.map(at => {
                              const al = alMap[`${emp.id}_${at.id}`];
                              const amt = al?.amount || 0;
                              return (
                                <td key={at.id} style={{ ...tds, textAlign: "right", padding: "2px 3px", cursor: "pointer", background: amt > 0 ? (at.calcMode === "per_day" ? "rgba(142,68,173,0.06)" : at.calcMode === "prorated" ? "rgba(243,156,18,0.06)" : "var(--acbg)") : "transparent" }} title={amt > 0 ? `${at.name}: ${fmtMoney(amt)}đ${at.calcMode === "per_day" ? "/ngày công" : at.calcMode === "prorated" ? " (theo mốc)" : "/tháng"} — Click để sửa` : `Click để gán ${at.name}`} onClick={() => {
                                  const unitLabel = at.calcMode === "per_day" ? "đ/ngày công" : "đ/tháng";
                                  const input = window.prompt(`${emp.fullName} — ${at.name}\nSố tiền (${unitLabel}):${at.defaultAmount ? `\n(Mặc định: ${fmtMoney(at.defaultAmount)})` : ""}`, amt || at.defaultAmount || "");
                                  if (input === null) return;
                                  const val = Number(input.replace(/[^0-9]/g, "")) || 0;
                                  saveAssignCell(emp.id, at.id, val);
                                }}>
                                  <span style={{ fontSize: "0.68rem", fontWeight: amt > 0 ? 600 : 400, color: amt > 0 ? (at.calcMode === "per_day" ? "#8e44ad" : at.calcMode === "prorated" ? "#f39c12" : "var(--ac)") : "var(--tm)" }}>{amt > 0 ? fmtMoney(amt) : "—"}</span>
                                </td>
                              );
                            })}
                            <td style={{ ...tds, textAlign: "right", fontWeight: 700, fontSize: "0.72rem" }}>{empTotal > 0 ? fmtMoney(empTotal) : "—"}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Footer */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setAtListDlg(false)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Đóng</button>
            </div>
          </Dialog>
        );
      })()}

      {/* ═══ Allowance Type Dialog ═══ */}
      {atDlg && (
        <Dialog open onClose={() => setAtDlg(null)} onOk={saveAtType} title={atDlg === "new" ? "Thêm loại phụ cấp" : "Sửa loại phụ cấp"} width={360}>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Tên loại phụ cấp</label>
            <input value={atFm.name} onChange={e => setAtFm(p => ({ ...p, name: e.target.value }))} style={inputSt} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Mô tả</label>
            <input value={atFm.description} onChange={e => setAtFm(p => ({ ...p, description: e.target.value }))} style={inputSt} />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelSt}>Cách tính</label>
              <select value={atFm.calcMode || "fixed"} onChange={e => setAtFm(p => ({ ...p, calcMode: e.target.value }))} style={inputSt}>
                <option value="fixed">Cố định/tháng</option>
                <option value="prorated">Theo mốc công (1/3, 1/2, đủ)</option>
                <option value="per_day">Theo ngày công (×đơn giá)</option>
              </select>
            </div>
            <div>
              <label style={labelSt}>{atFm.calcMode === "per_day" ? "Đơn giá (đ/ngày công)" : "Mức mặc định (đ/tháng)"}</label>
              <input value={atFm.defaultAmount || ""} onChange={e => setAtFm(p => ({ ...p, defaultAmount: e.target.value.replace(/[^0-9]/g, "") }))} style={{ ...inputSt, textAlign: "right" }} placeholder="0" />
              {atFm.defaultAmount && Number(atFm.defaultAmount) > 0 && (
                <div style={{ fontSize: "0.62rem", color: "var(--tm)", marginTop: 2 }}>
                  {atFm.calcMode === "per_day" ? `${fmtMoney(atFm.defaultAmount)}đ × số công = tiền` : `${fmtMoney(atFm.defaultAmount)}đ/tháng`}
                  {atFm.calcMode === "prorated" && " (áp tỷ lệ theo mốc công)"}
                </div>
              )}
            </div>
          </div>
          {atDlg !== "new" && Number(atFm.defaultAmount) > 0 && (
            <div style={{ marginBottom: 10, padding: 8, background: "var(--acbg)", borderRadius: 6 }}>
              <button onClick={() => assignAllToActive(atDlg)} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.72rem" }}>Gán {fmtMoney(atFm.defaultAmount)}đ cho tất cả NV đang làm</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setAtDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={saveAtType} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
