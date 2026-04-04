import React, { useState, useEffect, useCallback, useMemo } from "react";
import Dialog from "../components/Dialog";
import useTableSort from "../useTableSort";

const STATUS_LABELS = { active: "Đang làm", inactive: "Nghỉ việc", probation: "Thử việc" };
const STATUS_COLORS = { active: "#27ae60", inactive: "#95a5a6", probation: "#f39c12" };
const SALARY_TYPE_LABELS = { monthly: "Lương tháng", daily: "Lương ngày" };

const fmtMoney = (v) => v ? Number(v).toLocaleString("vi-VN") : "0";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("vi-VN") : "";

const CHANGE_TYPE_LABELS = {
  salary: "Lương", allowance: "Phụ cấp", bhxh: "BHXH",
  position: "Chức vụ", department: "Bộ phận", status: "Trạng thái",
  probation_rate: "Tỷ lệ thử việc", other: "Khác",
};

const inputSt = { width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid var(--bd)", fontSize: "0.82rem", background: "var(--bg)", color: "var(--tp)", outline: "none", boxSizing: "border-box" };
const labelSt = { fontSize: "0.72rem", fontWeight: 600, color: "var(--ts)", marginBottom: 3, display: "block" };
const errSt = { fontSize: "0.68rem", color: "#e74c3c", marginTop: 2 };
const gridRow = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 };

export default function PgEmployees({ departments: deptsProp, setDepartments: setDeptsProp, employees: empsProp, setEmployees: setEmpsProp, allowanceTypes: atsProp, setAllowanceTypes: setAtsProp, useAPI, notify, user }) {
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

  // Allowance type dialog
  const [atDlg, setAtDlg] = useState(null);
  const [atFm, setAtFm] = useState({ name: "", description: "" });

  // Allowance edit
  const [alDlg, setAlDlg] = useState(null); // { empId, allowanceTypeId, amount, note }

  // Change reason dialog (for salary/allowance/bhxh changes)
  const [changeDlg, setChangeDlg] = useState(null);
  const [changeReason, setChangeReason] = useState("");
  const [changeDate, setChangeDate] = useState(() => new Date().toISOString().slice(0, 10));

  const { sortField, sortDir, toggleSort, sortIcon, applySort } = useTableSort("code", "asc");

  // ─── Fetch next code for new employee ───
  const [nextCode, setNextCode] = useState("NV-001");
  useEffect(() => {
    if (!useAPI) return;
    import("../api.js").then(api => api.fetchNextEmployeeCode()).then(setNextCode).catch(() => {});
  }, [useAPI, employees.length]);

  // ─── Filtered & sorted list ───
  const filtered = useMemo(() => {
    let list = employees;
    if (fDept) list = list.filter(e => e.departmentId === fDept);
    if (fStatus) list = list.filter(e => e.status === fStatus);
    if (fSearch) {
      const q = fSearch.toLowerCase();
      list = list.filter(e => e.fullName.toLowerCase().includes(q) || e.code.toLowerCase().includes(q) || (e.phone || "").includes(q));
    }
    return applySort(list, (a, b) => {
      const va = a[sortField], vb = b[sortField];
      if (va == null) return 1; if (vb == null) return -1;
      if (typeof va === "number") return va - vb;
      return String(va).localeCompare(String(vb), "vi");
    });
  }, [employees, fDept, fStatus, fSearch, applySort, sortField]);

  // ─── Helpers ───
  const deptName = useCallback((id) => departments.find(d => d.id === id)?.name || "—", [departments]);
  const mgrName = useCallback((id) => employees.find(e => e.id === id)?.fullName || "—", [employees]);

  // ─── Open new / edit dialog ───
  const openNew = () => {
    setFm({
      code: nextCode, fullName: "", dateOfBirth: "", idNumber: "", phone: "", address: "",
      departmentId: "", position: "", startDate: new Date().toISOString().slice(0, 10),
      status: "active", salaryType: "monthly", baseSalary: "", probationRate: "85",
      bankName: "", bankAccount: "", bankHolder: "",
      bhxhEnrolled: false, bhxhEmployee: "", bhxhCompany: "",
      managerId: "", isManager: false, note: "",
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
      bhxhEnrolled: emp.bhxhEnrolled, bhxhEmployee: String(emp.bhxhEmployee || ""),
      bhxhCompany: String(emp.bhxhCompany || ""),
      managerId: emp.managerId || "", isManager: emp.isManager || false, note: emp.note || "",
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
    const newBhxhE = Number(newFm.bhxhEmployee) || 0;
    const newBhxhC = Number(newFm.bhxhCompany) || 0;
    if (oldEmp.bhxhEmployee !== newBhxhE || oldEmp.bhxhCompany !== newBhxhC || oldEmp.bhxhEnrolled !== newFm.bhxhEnrolled) {
      changes.push({ changeType: "bhxh", fieldName: "BHXH", oldValue: `NV: ${fmtMoney(oldEmp.bhxhEmployee)}, CT: ${fmtMoney(oldEmp.bhxhCompany)}`, newValue: `NV: ${fmtMoney(newBhxhE)}, CT: ${fmtMoney(newBhxhC)}` });
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
      bhxhEmployee: Number(fm.bhxhEmployee) || 0,
      bhxhCompany: Number(fm.bhxhCompany) || 0,
      managerId: fm.managerId || null,
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
    setAlDlg({
      empId: detailEmp.id,
      allowanceTypeId: alTypeId || "",
      amount: existing ? String(existing.amount) : "",
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
        import("../api.js").then(api => api.addDepartment(deptFm.name.trim(), deptFm.description.trim()).then(r => {
          if (r?.error) notify("Lỗi: " + r.error, false);
          else {
            setDepartments(p => [...p, { id: r.id, name: deptFm.name.trim(), description: deptFm.description.trim() }]);
            notify("Đã thêm bộ phận");
          }
        }));
      }
    } else {
      if (useAPI) {
        import("../api.js").then(api => api.updateDepartment(deptDlg, deptFm.name.trim(), deptFm.description.trim()).then(r => {
          if (r?.error) notify("Lỗi: " + r.error, false);
          else {
            setDepartments(p => p.map(d => d.id === deptDlg ? { ...d, name: deptFm.name.trim(), description: deptFm.description.trim() } : d));
            notify("Đã cập nhật bộ phận");
          }
        }));
      }
    }
    setDeptDlg(null);
  };

  // ─── Allowance type CRUD ───
  const saveAtType = () => {
    if (!atFm.name.trim()) return;
    if (atDlg === "new") {
      if (useAPI) {
        import("../api.js").then(api => api.addAllowanceType(atFm.name.trim(), atFm.description.trim()).then(r => {
          if (r?.error) notify("Lỗi: " + r.error, false);
          else {
            setAllowanceTypes(p => [...p, { id: r.id, name: atFm.name.trim(), description: atFm.description.trim(), isActive: true }]);
            notify("Đã thêm loại phụ cấp");
          }
        }));
      }
    } else {
      if (useAPI) {
        const at = allowanceTypes.find(a => a.id === atDlg);
        import("../api.js").then(api => api.updateAllowanceType(atDlg, atFm.name.trim(), atFm.description.trim(), at?.isActive ?? true).then(r => {
          if (r?.error) notify("Lỗi: " + r.error, false);
          else {
            setAllowanceTypes(p => p.map(a => a.id === atDlg ? { ...a, name: atFm.name.trim(), description: atFm.description.trim() } : a));
            notify("Đã cập nhật loại phụ cấp");
          }
        }));
      }
    }
    setAtDlg(null);
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
          <button onClick={() => { setDeptDlg("new"); setDeptFm({ name: "", description: "" }); }} style={{ padding: "7px 14px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}>+ Bộ phận</button>
          <button onClick={() => { setAtDlg("new"); setAtFm({ name: "", description: "" }); }} style={{ padding: "7px 14px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}>+ Loại phụ cấp</button>
          <button onClick={openNew} style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm nhân viên</button>
        </div>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            {/* Filter row */}
            <tr style={{ background: "var(--bgs)" }}>
              <td style={{ padding: "5px 6px" }} />
              <td style={{ padding: "5px 6px" }}>
                <input value={fSearch} onChange={e => setFSearch(e.target.value)} placeholder="Tìm tên/mã/SĐT..." style={{ width: "100%", fontSize: "0.76rem", padding: "4px 8px", borderRadius: 4, border: "1px solid var(--bd)", outline: "none" }} />
              </td>
              <td style={{ padding: "5px 6px" }}>
                <select value={fDept} onChange={e => setFDept(e.target.value)} style={{ width: "100%", fontSize: "0.76rem", padding: "4px 8px", borderRadius: 4, border: "1px solid var(--bd)", outline: "none" }}>
                  <option value="">Tất cả</option>
                  {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                </select>
              </td>
              <td style={{ padding: "5px 6px" }} />
              <td style={{ padding: "5px 6px" }}>
                <select value={fStatus} onChange={e => setFStatus(e.target.value)} style={{ width: "100%", fontSize: "0.76rem", padding: "4px 8px", borderRadius: 4, border: "1px solid var(--bd)", outline: "none" }}>
                  <option value="">Tất cả</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </td>
              <td style={{ padding: "5px 6px" }} />
              <td style={{ padding: "5px 6px" }} />
              <td style={{ padding: "5px 6px" }} />
            </tr>
            {/* Header row */}
            <tr>
              <th onClick={() => toggleSort("code")} style={{ ...ths, width: 80 }}>Mã NV{sortIcon("code")}</th>
              <th onClick={() => toggleSort("fullName")} style={ths}>Họ tên{sortIcon("fullName")}</th>
              <th onClick={() => toggleSort("departmentId")} style={ths}>Bộ phận{sortIcon("departmentId")}</th>
              <th style={ths}>Chức vụ</th>
              <th onClick={() => toggleSort("status")} style={ths}>Trạng thái{sortIcon("status")}</th>
              <th onClick={() => toggleSort("salaryType")} style={ths}>Loại lương{sortIcon("salaryType")}</th>
              <th onClick={() => toggleSort("baseSalary")} style={{ ...ths, textAlign: "right" }}>Lương CB{sortIcon("baseSalary")}</th>
              <th style={{ ...ths, textAlign: "center", width: 80 }}>Thao tác</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={8} style={{ padding: 24, textAlign: "center", color: "var(--tm)", fontSize: "0.82rem" }}>Chưa có nhân viên nào</td></tr>
            )}
            {filtered.map(emp => (
              <tr key={emp.id} data-clickable="true" onClick={() => openDetail(emp)} style={{ cursor: "pointer" }}>
                <td style={{ ...tds, whiteSpace: "nowrap", fontFamily: "monospace", fontWeight: 600 }}>{emp.code}</td>
                <td style={{ ...tds, fontWeight: 600 }}>{emp.fullName}</td>
                <td style={tds}>{deptName(emp.departmentId)}</td>
                <td style={tds}>{emp.position || "—"}</td>
                <td style={tds}>
                  <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: "0.68rem", fontWeight: 700, background: STATUS_COLORS[emp.status] + "22", color: STATUS_COLORS[emp.status] }}>{STATUS_LABELS[emp.status]}</span>
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
                <label style={labelSt}>BHXH — NV đóng (đ/tháng)</label>
                <input value={fm.bhxhEmployee} onChange={e => setFm(p => ({ ...p, bhxhEmployee: e.target.value.replace(/[^0-9]/g, "") }))} style={{ ...inputSt, textAlign: "right" }} />
                {fm.bhxhEmployee && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 2 }}>{fmtMoney(fm.bhxhEmployee)}đ</div>}
              </div>
              <div>
                <label style={labelSt}>BHXH — Công ty đóng (đ/tháng)</label>
                <input value={fm.bhxhCompany} onChange={e => setFm(p => ({ ...p, bhxhCompany: e.target.value.replace(/[^0-9]/g, "") }))} style={{ ...inputSt, textAlign: "right" }} />
                {fm.bhxhCompany && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 2 }}>{fmtMoney(fm.bhxhCompany)}đ</div>}
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
        <Dialog open onClose={() => setChangeDlg(null)} title="Xác nhận thay đổi" width={420}>
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
                <>
                  <div><span style={{ color: "var(--tm)" }}>BHXH NV:</span> {fmtMoney(detailEmp.bhxhEmployee)}đ</div>
                  <div><span style={{ color: "var(--tm)" }}>BHXH CT:</span> {fmtMoney(detailEmp.bhxhCompany)}đ</div>
                </>
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
        <Dialog open onClose={() => setAlDlg(null)} title="Phụ cấp" width={380}>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Loại phụ cấp</label>
            <select value={alDlg.allowanceTypeId} onChange={e => setAlDlg(p => ({ ...p, allowanceTypeId: e.target.value }))} style={inputSt}>
              <option value="">-- Chọn --</option>
              {allowanceTypes.filter(t => t.isActive !== false).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Số tiền (đ/tháng)</label>
            <input value={alDlg.amount} onChange={e => setAlDlg(p => ({ ...p, amount: e.target.value.replace(/[^0-9]/g, "") }))} style={{ ...inputSt, textAlign: "right" }} />
            {alDlg.amount && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 2 }}>{fmtMoney(alDlg.amount)}đ</div>}
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
        <Dialog open onClose={() => setDeptDlg(null)} title={deptDlg === "new" ? "Thêm bộ phận" : "Sửa bộ phận"} width={360}>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Tên bộ phận</label>
            <input value={deptFm.name} onChange={e => setDeptFm(p => ({ ...p, name: e.target.value }))} style={inputSt} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Mô tả</label>
            <input value={deptFm.description} onChange={e => setDeptFm(p => ({ ...p, description: e.target.value }))} style={inputSt} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setDeptDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={saveDept} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
          </div>
        </Dialog>
      )}

      {/* ═══ Allowance Type Dialog ═══ */}
      {atDlg && (
        <Dialog open onClose={() => setAtDlg(null)} title={atDlg === "new" ? "Thêm loại phụ cấp" : "Sửa loại phụ cấp"} width={360}>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Tên loại phụ cấp</label>
            <input value={atFm.name} onChange={e => setAtFm(p => ({ ...p, name: e.target.value }))} style={inputSt} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Mô tả</label>
            <input value={atFm.description} onChange={e => setAtFm(p => ({ ...p, description: e.target.value }))} style={inputSt} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setAtDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={saveAtType} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
