import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Dialog from "../components/Dialog";

const fmtMoney = (v) => v ? Number(v).toLocaleString("vi-VN") : "0";
const fmtDate = (d) => d ? new Date(d).toLocaleDateString("vi-VN") : "";
const PAYROLL_STATUS = { draft: { label: "Nháp", color: "#f39c12" }, confirmed: { label: "Đã duyệt", color: "#27ae60" }, paid: { label: "Đã trả", color: "#3498db" } };
const WORK_VALUE = { present: 1, half_day: 0.5, absent: 0, leave: 0, holiday: 0 };

const inputSt = { width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid var(--bd)", fontSize: "0.82rem", background: "var(--bg)", color: "var(--tp)", outline: "none", boxSizing: "border-box" };
const labelSt = { fontSize: "0.72rem", fontWeight: 600, color: "var(--ts)", marginBottom: 3, display: "block" };
const ths = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", whiteSpace: "nowrap" };
const tds = { padding: "7px 10px", fontSize: "0.75rem", borderBottom: "1px solid var(--bd)" };

export default function PgPayroll({ employees, departments, allowanceTypes, useAPI, notify, user, isAdmin }) {
  const now = new Date();
  const [period, setPeriod] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [tab, setTab] = useState("payroll"); // payroll | advances | bhxh | print

  // Data
  const [payroll, setPayroll] = useState(null);
  const [details, setDetails] = useState([]);
  const [advances, setAdvances] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [allAllowances, setAllAllowances] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(false);

  // Advance dialog
  const [advDlg, setAdvDlg] = useState(null);
  const [advFm, setAdvFm] = useState({});

  // Other deduction dialog
  const [deductDlg, setDeductDlg] = useState(null);

  // Print
  const [printEmp, setPrintEmp] = useState(null);
  const printRef = useRef(null);

  // ─── Helpers ───
  const deptName = useCallback((id) => departments.find(d => d.id === id)?.name || "—", [departments]);
  const getSetting = useCallback((key, fallback) => {
    const v = settings[key]?.value;
    if (v == null) return fallback;
    try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return v; }
  }, [settings]);

  // ─── Load data for period ───
  useEffect(() => {
    if (!useAPI) return;
    setLoading(true);
    Promise.all([
      import("../api.js").then(api => api.fetchPayrollByPeriod(period)),
      import("../api.js").then(api => api.fetchSalaryAdvances(period)),
      import("../api.js").then(api => api.fetchAttendance(period)),
      import("../api.js").then(api => api.fetchPayrollSettings()),
      import("../api.js").then(api => api.fetchEmployeeAllowances()),
    ]).then(([pr, adv, att, sett, allAl]) => {
      setPayroll(pr);
      setAdvances(adv);
      setAttendance(att);
      setSettings(sett);
      setAllAllowances(allAl);
      // Load details if payroll exists
      if (pr) {
        import("../api.js").then(api => api.fetchPayrollDetails(pr.id)).then(setDetails).catch(() => {});
      } else {
        setDetails([]);
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [useAPI, period]);

  // ─── Calculate payroll for one employee ───
  const calcEmployee = useCallback((emp) => {
    const standardDays = Number(getSetting("standard_work_days", 26));
    const otRate = Number(getSetting("ot_rate", 1.5));
    const bonus28 = Number(getSetting("attendance_bonus_28", 200000));
    const bonus30 = Number(getSetting("attendance_bonus_30", 500000));

    // Attendance summary
    let workDays = 0, otMins = 0;
    const [y, m] = period.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const attMap = {};
    attendance.filter(a => a.employeeId === emp.id).forEach(a => { attMap[a.date] = a; });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${period}-${String(d).padStart(2, "0")}`;
      const rec = attMap[dateStr];
      if (rec) {
        workDays += WORK_VALUE[rec.status] || 0;
        otMins += rec.otMinutes || 0;
      }
    }
    const otHours = Math.round(otMins / 60 * 100) / 100;

    // Probation
    const probRate = emp.status === "probation" ? (emp.probationRate || 0.85) : 1;

    // Base amount
    let baseAmount;
    if (emp.salaryType === "daily") {
      baseAmount = Math.round(emp.baseSalary * workDays * probRate);
    } else {
      baseAmount = Math.round(emp.baseSalary * (workDays / standardDays) * probRate);
    }

    // OT
    const hourlyRate = emp.salaryType === "daily"
      ? emp.baseSalary / 8
      : emp.baseSalary / standardDays / 8;
    const otAmount = Math.round(otHours * hourlyRate * otRate);

    // Allowances
    const empAllowances = allAllowances.filter(a => a.employeeId === emp.id);
    const allowanceDetail = empAllowances.map(a => {
      const typeName = allowanceTypes.find(t => t.id === a.allowanceTypeId)?.name || "Khác";
      return { name: typeName, amount: a.amount };
    });
    const allowanceTotal = empAllowances.reduce((s, a) => s + a.amount, 0);

    // Attendance bonus
    let attendanceBonus = 0;
    if (workDays >= 30) attendanceBonus = bonus30;
    else if (workDays >= 28) attendanceBonus = bonus28;

    // BHXH
    const bhxhEmployee = emp.bhxhEnrolled ? (emp.bhxhEmployee || 0) : 0;
    const bhxhCompany = emp.bhxhEnrolled ? (emp.bhxhCompany || 0) : 0;

    // Advances
    const empAdvances = advances.filter(a => a.employeeId === emp.id && a.status === "pending");
    const advanceDeduction = empAdvances.reduce((s, a) => s + a.amount, 0);

    // Net
    const grossIncome = baseAmount + otAmount + allowanceTotal + attendanceBonus;
    const totalDeduction = bhxhEmployee + advanceDeduction;
    const netSalary = grossIncome - totalDeduction;

    return {
      employeeId: emp.id, employeeCode: emp.code, employeeName: emp.fullName,
      departmentName: deptName(emp.departmentId),
      salaryType: emp.salaryType, baseSalary: emp.baseSalary, probationRate: probRate,
      workDays, standardDays, baseAmount,
      otHours, otRate, otAmount,
      allowanceTotal, allowanceDetail, attendanceBonus,
      commission: 0, commissionDetail: {},
      bhxhEmployee, bhxhCompany,
      advanceDeduction, otherDeduction: 0, otherDeductionNote: "",
      netSalary, note: "",
    };
  }, [period, attendance, allAllowances, allowanceTypes, advances, deptName, getSetting]);

  // ─── Generate / recalculate payroll ───
  const generatePayroll = async () => {
    const activeEmps = employees.filter(e => e.status !== "inactive");
    const calculated = activeEmps.map(calcEmployee);

    if (!payroll) {
      // Create new payroll
      if (useAPI) {
        const api = await import("../api.js");
        const r = await api.createPayroll(period, user?.username);
        if (r?.error) { notify("Lỗi tạo bảng lương: " + r.error, false); return; }
        setPayroll(r.data);
        const sr = await api.savePayrollDetails(r.data.id, calculated);
        if (sr?.error) { notify("Lỗi lưu chi tiết: " + sr.error, false); return; }
        // Mark advances as deducted
        await api.deductAdvances(period);
        setAdvances(prev => prev.map(a => a.payrollPeriod === period && a.status === "pending" ? { ...a, status: "deducted" } : a));
        setDetails(calculated);
        notify("Đã tạo bảng lương tháng " + period);
      }
    } else {
      // Recalculate existing draft
      if (payroll.status !== "draft") { notify("Không thể tính lại — bảng lương đã duyệt", false); return; }
      // Merge: keep otherDeduction from existing details
      const existingMap = {};
      details.forEach(d => { existingMap[d.employeeId] = d; });
      const merged = calculated.map(c => {
        const ex = existingMap[c.employeeId];
        if (ex) {
          c.otherDeduction = ex.otherDeduction;
          c.otherDeductionNote = ex.otherDeductionNote;
          c.netSalary = c.netSalary - c.otherDeduction;
        }
        return c;
      });
      if (useAPI) {
        const api = await import("../api.js");
        const sr = await api.savePayrollDetails(payroll.id, merged);
        if (sr?.error) { notify("Lỗi: " + sr.error, false); return; }
        setDetails(merged);
        notify("Đã tính lại bảng lương");
      }
    }
  };

  // ─── Confirm / Pay ───
  const changeStatus = async (newStatus) => {
    if (!payroll) return;
    if (newStatus === "confirmed" && !isAdmin) { notify("Chỉ admin mới được duyệt lương", false); return; }
    if (useAPI) {
      const api = await import("../api.js");
      const r = await api.updatePayrollStatus(payroll.id, newStatus, user?.username);
      if (r?.error) { notify("Lỗi: " + r.error, false); return; }
      setPayroll(p => ({ ...p, status: newStatus }));
      notify(`Bảng lương → ${PAYROLL_STATUS[newStatus].label}`);
    }
  };

  const handleDeletePayroll = async () => {
    if (!payroll) return;
    if (payroll.status !== "draft") { notify("Chỉ xóa được bảng lương nháp", false); return; }
    if (!window.confirm("Xóa bảng lương tháng " + period + "?")) return;
    if (useAPI) {
      const api = await import("../api.js");
      const r = await api.deletePayroll(payroll.id);
      if (r?.error) { notify("Lỗi: " + r.error, false); return; }
      // Revert advances
      setAdvances(prev => prev.map(a => a.payrollPeriod === period ? { ...a, status: "pending" } : a));
      setPayroll(null);
      setDetails([]);
      notify("Đã xóa bảng lương");
    }
  };

  // ─── Advance CRUD ───
  const openAdvDlg = (adv) => {
    setAdvFm(adv ? {
      id: adv.id, employeeId: adv.employeeId, amount: String(adv.amount),
      advanceDate: adv.advanceDate, note: adv.note || "",
    } : {
      id: null, employeeId: "", amount: "", advanceDate: new Date().toISOString().slice(0, 10), note: "",
    });
    setAdvDlg(adv ? "edit" : "new");
  };

  const saveAdvance = async () => {
    if (!advFm.employeeId || !advFm.amount) return;
    if (useAPI) {
      const api = await import("../api.js");
      if (advDlg === "new") {
        const r = await api.addSalaryAdvance({ ...advFm, amount: Number(advFm.amount), payrollPeriod: period, createdBy: user?.username });
        if (r?.error) { notify("Lỗi: " + r.error, false); return; }
        setAdvances(prev => [...prev, r.data]);
        notify("Đã thêm tạm ứng");
      } else {
        const r = await api.updateSalaryAdvance(advFm.id, { amount: Number(advFm.amount), advanceDate: advFm.advanceDate, note: advFm.note });
        if (r?.error) { notify("Lỗi: " + r.error, false); return; }
        setAdvances(prev => prev.map(a => a.id === advFm.id ? { ...a, amount: Number(advFm.amount), advanceDate: advFm.advanceDate, note: advFm.note } : a));
        notify("Đã cập nhật");
      }
    }
    setAdvDlg(null);
  };

  const deleteAdv = async (adv) => {
    if (!window.confirm("Xóa tạm ứng này?")) return;
    if (useAPI) {
      const api = await import("../api.js");
      const r = await api.deleteSalaryAdvance(adv.id);
      if (r?.error) { notify("Lỗi: " + r.error, false); return; }
      setAdvances(prev => prev.filter(a => a.id !== adv.id));
      notify("Đã xóa");
    }
  };

  // ─── Other deduction (khấu trừ khác) ───
  const saveOtherDeduction = async () => {
    if (!deductDlg) return;
    const d = deductDlg;
    const otherDed = Number(d.otherDeduction) || 0;
    const newNet = d.grossIncome - d.bhxhEmployee - d.advanceDeduction - otherDed;
    setDetails(prev => prev.map(det => det.employeeId === d.employeeId ? { ...det, otherDeduction: otherDed, otherDeductionNote: d.otherDeductionNote, netSalary: newNet } : det));
    if (useAPI && payroll) {
      const det = details.find(det => det.employeeId === d.employeeId);
      if (det?.id) {
        const api = await import("../api.js");
        api.updatePayrollDetail(det.id, { otherDeduction: otherDed, otherDeductionNote: d.otherDeductionNote, netSalary: newNet });
      }
    }
    setDeductDlg(null);
    notify("Đã lưu khấu trừ");
  };

  // ─── Totals ───
  const totals = useMemo(() => {
    const t = { baseAmount: 0, otAmount: 0, allowanceTotal: 0, attendanceBonus: 0, bhxhEmployee: 0, bhxhCompany: 0, advanceDeduction: 0, otherDeduction: 0, netSalary: 0 };
    details.forEach(d => {
      t.baseAmount += d.baseAmount; t.otAmount += d.otAmount; t.allowanceTotal += d.allowanceTotal;
      t.attendanceBonus += d.attendanceBonus; t.bhxhEmployee += d.bhxhEmployee; t.bhxhCompany += d.bhxhCompany;
      t.advanceDeduction += d.advanceDeduction; t.otherDeduction += d.otherDeduction; t.netSalary += d.netSalary;
    });
    return t;
  }, [details]);

  // ─── Print payslip ───
  const printPayslip = (det) => {
    setPrintEmp(det);
    setTimeout(() => {
      const el = printRef.current;
      if (!el) return;
      const w = window.open("", "_blank", "width=800,height=600");
      w.document.write(`<html><head><title>Phiếu lương ${det.employeeName} - T${period}</title>
        <style>body{font-family:'Segoe UI',Arial,sans-serif;margin:20px;font-size:13px}
        table{width:100%;border-collapse:collapse}td,th{padding:6px 8px;border:1px solid #ccc;text-align:left}
        th{background:#f5f5f5;font-weight:700}.r{text-align:right}.b{font-weight:700}
        h2{margin:0 0 4px;font-size:16px}h3{margin:16px 0 8px;font-size:14px}
        .header{text-align:center;margin-bottom:16px}.sig{display:flex;justify-content:space-between;margin-top:40px}
        .sig div{text-align:center;width:200px}@media print{body{margin:0}}</style></head><body>`);
      w.document.write(el.innerHTML);
      w.document.write("</body></html>");
      w.document.close();
      w.print();
    }, 100);
  };

  // ─── Active employees ───
  const activeEmps = useMemo(() => employees.filter(e => e.status !== "inactive"), [employees]);
  const empName = (id) => employees.find(e => e.id === id)?.fullName || "—";
  const empCode = (id) => employees.find(e => e.id === id)?.code || "—";

  // Tab content
  const [y, m] = period.split("-").map(Number);

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>💰 Bảng lương</h2>
          <span style={{ fontSize: "0.72rem", color: "var(--tm)" }}>
            Tháng {m}/{y}
            {payroll && <> — <span style={{ color: PAYROLL_STATUS[payroll.status].color, fontWeight: 700 }}>{PAYROLL_STATUS[payroll.status].label}</span></>}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)} style={{ padding: "6px 10px", borderRadius: 7, border: "1.5px solid var(--bd)", fontSize: "0.78rem", background: "var(--bg)", color: "var(--tp)", outline: "none" }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--bd)", marginBottom: 14 }}>
        {[["payroll", "Bảng lương"], ["advances", "Tạm ứng"], ["bhxh", "Tổng hợp BHXH"]].map(([k, lb]) => (
          <button key={k} onClick={() => setTab(k)} style={{ padding: "8px 16px", border: "none", borderBottom: tab === k ? "2px solid var(--ac)" : "2px solid transparent", marginBottom: -2, background: "transparent", cursor: "pointer", fontWeight: tab === k ? 700 : 500, fontSize: "0.78rem", color: tab === k ? "var(--ac)" : "var(--ts)" }}>{lb}</button>
        ))}
      </div>

      {loading && <div style={{ padding: 24, textAlign: "center", color: "var(--tm)" }}>Đang tải...</div>}

      {/* ═══ Tab: Bảng lương ═══ */}
      {!loading && tab === "payroll" && (
        <div>
          {/* Action bar */}
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" }}>
            {(!payroll || payroll.status === "draft") && (
              <button onClick={generatePayroll} style={{ padding: "7px 16px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>
                {payroll ? "↻ Tính lại" : "⚡ Tạo bảng lương"}
              </button>
            )}
            {payroll?.status === "draft" && isAdmin && (
              <button onClick={() => changeStatus("confirmed")} style={{ padding: "7px 14px", borderRadius: 7, border: "1.5px solid #27ae60", background: "#27ae6011", color: "#27ae60", cursor: "pointer", fontWeight: 700, fontSize: "0.75rem" }}>✓ Duyệt lương</button>
            )}
            {payroll?.status === "confirmed" && isAdmin && (
              <button onClick={() => changeStatus("paid")} style={{ padding: "7px 14px", borderRadius: 7, border: "1.5px solid #3498db", background: "#3498db11", color: "#3498db", cursor: "pointer", fontWeight: 700, fontSize: "0.75rem" }}>💳 Đánh dấu đã trả</button>
            )}
            {payroll?.status === "draft" && (
              <button onClick={handleDeletePayroll} style={{ padding: "7px 14px", borderRadius: 7, border: "1.5px solid #e74c3c", background: "transparent", color: "#e74c3c", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}>Xóa</button>
            )}
          </div>

          {/* Payroll table */}
          {details.length > 0 ? (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={ths}>Mã</th>
                    <th style={ths}>Họ tên</th>
                    <th style={ths}>Bộ phận</th>
                    <th style={{ ...ths, textAlign: "center" }}>Công</th>
                    <th style={{ ...ths, textAlign: "right" }}>Lương CB</th>
                    <th style={{ ...ths, textAlign: "right" }}>OT</th>
                    <th style={{ ...ths, textAlign: "right" }}>Phụ cấp</th>
                    <th style={{ ...ths, textAlign: "right" }}>CC</th>
                    <th style={{ ...ths, textAlign: "right" }}>BHXH</th>
                    <th style={{ ...ths, textAlign: "right" }}>Tạm ứng</th>
                    <th style={{ ...ths, textAlign: "right" }}>Trừ khác</th>
                    <th style={{ ...ths, textAlign: "right", color: "var(--ac)" }}>Thực lãnh</th>
                    <th style={{ ...ths, textAlign: "center", width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {details.map(d => {
                    const grossIncome = d.baseAmount + d.otAmount + d.allowanceTotal + d.attendanceBonus;
                    return (
                      <tr key={d.employeeId}>
                        <td style={{ ...tds, fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap" }}>{d.employeeCode}</td>
                        <td style={{ ...tds, fontWeight: 600, whiteSpace: "nowrap" }}>{d.employeeName}</td>
                        <td style={tds}>{d.departmentName}</td>
                        <td style={{ ...tds, textAlign: "center" }}>{d.workDays}</td>
                        <td style={{ ...tds, textAlign: "right" }}>{fmtMoney(d.baseAmount)}</td>
                        <td style={{ ...tds, textAlign: "right", color: d.otAmount > 0 ? "#e67e22" : "var(--tm)" }}>{d.otAmount > 0 ? fmtMoney(d.otAmount) : "—"}</td>
                        <td style={{ ...tds, textAlign: "right" }}>{d.allowanceTotal > 0 ? fmtMoney(d.allowanceTotal) : "—"}</td>
                        <td style={{ ...tds, textAlign: "right", color: d.attendanceBonus > 0 ? "#27ae60" : "var(--tm)" }}>{d.attendanceBonus > 0 ? fmtMoney(d.attendanceBonus) : "—"}</td>
                        <td style={{ ...tds, textAlign: "right", color: d.bhxhEmployee > 0 ? "#e74c3c" : "var(--tm)" }}>{d.bhxhEmployee > 0 ? "-" + fmtMoney(d.bhxhEmployee) : "—"}</td>
                        <td style={{ ...tds, textAlign: "right", color: d.advanceDeduction > 0 ? "#e74c3c" : "var(--tm)" }}>{d.advanceDeduction > 0 ? "-" + fmtMoney(d.advanceDeduction) : "—"}</td>
                        <td style={{ ...tds, textAlign: "right", cursor: payroll?.status === "draft" ? "pointer" : "default" }} title="Click để nhập khấu trừ khác" onClick={() => payroll?.status === "draft" && setDeductDlg({ ...d, grossIncome })}>
                          {d.otherDeduction > 0 ? <span style={{ color: "#e74c3c" }}>-{fmtMoney(d.otherDeduction)}</span> : <span style={{ color: "var(--tm)" }}>—</span>}
                        </td>
                        <td style={{ ...tds, textAlign: "right", fontWeight: 700, color: "var(--ac)", fontSize: "0.78rem" }}>{fmtMoney(d.netSalary)}</td>
                        <td style={{ ...tds, textAlign: "center" }}>
                          <button onClick={() => printPayslip(d)} style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.65rem" }} title="In phiếu lương">🖨</button>
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  <tr style={{ background: "var(--bgh)" }}>
                    <td colSpan={3} style={{ ...tds, fontWeight: 700 }}>TỔNG CỘNG ({details.length} NV)</td>
                    <td style={tds} />
                    <td style={{ ...tds, textAlign: "right", fontWeight: 700 }}>{fmtMoney(totals.baseAmount)}</td>
                    <td style={{ ...tds, textAlign: "right", fontWeight: 700 }}>{fmtMoney(totals.otAmount)}</td>
                    <td style={{ ...tds, textAlign: "right", fontWeight: 700 }}>{fmtMoney(totals.allowanceTotal)}</td>
                    <td style={{ ...tds, textAlign: "right", fontWeight: 700 }}>{fmtMoney(totals.attendanceBonus)}</td>
                    <td style={{ ...tds, textAlign: "right", fontWeight: 700, color: "#e74c3c" }}>-{fmtMoney(totals.bhxhEmployee)}</td>
                    <td style={{ ...tds, textAlign: "right", fontWeight: 700, color: "#e74c3c" }}>-{fmtMoney(totals.advanceDeduction)}</td>
                    <td style={{ ...tds, textAlign: "right", fontWeight: 700, color: "#e74c3c" }}>-{fmtMoney(totals.otherDeduction)}</td>
                    <td style={{ ...tds, textAlign: "right", fontWeight: 800, color: "var(--ac)", fontSize: "0.82rem" }}>{fmtMoney(totals.netSalary)}</td>
                    <td style={tds} />
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: 24, textAlign: "center", color: "var(--tm)", fontSize: "0.82rem" }}>
              {payroll ? "Bảng lương rỗng" : "Chưa có bảng lương. Bấm \"Tạo bảng lương\" để tính."}
            </div>
          )}
        </div>
      )}

      {/* ═══ Tab: Tạm ứng ═══ */}
      {!loading && tab === "advances" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: "0.75rem", color: "var(--tm)" }}>
              Tạm ứng tháng {m}/{y}: <strong>{advances.length}</strong> khoản — Tổng: <strong style={{ color: "var(--tp)" }}>{fmtMoney(advances.reduce((s, a) => s + a.amount, 0))}đ</strong>
            </span>
            <button onClick={() => openAdvDlg(null)} style={{ padding: "7px 14px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>+ Thêm tạm ứng</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={ths}>Nhân viên</th>
                <th style={{ ...ths, textAlign: "right" }}>Số tiền</th>
                <th style={ths}>Ngày ứng</th>
                <th style={ths}>Trạng thái</th>
                <th style={ths}>Ghi chú</th>
                <th style={{ ...ths, width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {advances.length === 0 && <tr><td colSpan={6} style={{ padding: 16, textAlign: "center", color: "var(--tm)", fontSize: "0.82rem" }}>Chưa có tạm ứng</td></tr>}
              {advances.map(a => (
                <tr key={a.id}>
                  <td style={tds}><span style={{ fontFamily: "monospace", marginRight: 6 }}>{empCode(a.employeeId)}</span>{empName(a.employeeId)}</td>
                  <td style={{ ...tds, textAlign: "right", fontWeight: 600 }}>{fmtMoney(a.amount)}</td>
                  <td style={tds}>{fmtDate(a.advanceDate)}</td>
                  <td style={tds}>
                    <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: "0.68rem", fontWeight: 700, background: a.status === "deducted" ? "#27ae6022" : "#f39c1222", color: a.status === "deducted" ? "#27ae60" : "#f39c12" }}>{a.status === "deducted" ? "Đã trừ" : "Chờ trừ"}</span>
                  </td>
                  <td style={tds}>{a.note || "—"}</td>
                  <td style={{ ...tds, whiteSpace: "nowrap" }}>
                    {a.status === "pending" && <>
                      <button onClick={() => openAdvDlg(a)} style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--bd)", background: "transparent", color: "var(--ac)", cursor: "pointer", fontSize: "0.65rem", marginRight: 3 }}>Sửa</button>
                      <button onClick={() => deleteAdv(a)} style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid #e74c3c44", background: "transparent", color: "#e74c3c", cursor: "pointer", fontSize: "0.65rem" }}>Xóa</button>
                    </>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ Tab: BHXH ═══ */}
      {!loading && tab === "bhxh" && (
        <div>
          <h3 style={{ fontSize: "0.88rem", fontWeight: 700, marginBottom: 10 }}>Tổng hợp BHXH tháng {m}/{y}</h3>
          {(() => {
            const bhxhEmps = employees.filter(e => e.bhxhEnrolled && e.status !== "inactive");
            const totalEmp = bhxhEmps.reduce((s, e) => s + (e.bhxhEmployee || 0), 0);
            const totalComp = bhxhEmps.reduce((s, e) => s + (e.bhxhCompany || 0), 0);
            return (
              <>
                <div style={{ fontSize: "0.78rem", marginBottom: 10, display: "flex", gap: 24 }}>
                  <span>Số NV đóng BHXH: <strong>{bhxhEmps.length}</strong></span>
                  <span>Tổng NV đóng: <strong style={{ color: "#e74c3c" }}>{fmtMoney(totalEmp)}đ</strong></span>
                  <span>Tổng CT đóng: <strong style={{ color: "#3498db" }}>{fmtMoney(totalComp)}đ</strong></span>
                  <span>Tổng cộng: <strong>{fmtMoney(totalEmp + totalComp)}đ</strong></span>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={ths}>Mã NV</th>
                      <th style={ths}>Họ tên</th>
                      <th style={ths}>Bộ phận</th>
                      <th style={{ ...ths, textAlign: "right" }}>NV đóng</th>
                      <th style={{ ...ths, textAlign: "right" }}>CT đóng</th>
                      <th style={{ ...ths, textAlign: "right" }}>Tổng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bhxhEmps.map(e => (
                      <tr key={e.id}>
                        <td style={{ ...tds, fontFamily: "monospace", fontWeight: 600 }}>{e.code}</td>
                        <td style={{ ...tds, fontWeight: 600 }}>{e.fullName}</td>
                        <td style={tds}>{deptName(e.departmentId)}</td>
                        <td style={{ ...tds, textAlign: "right" }}>{fmtMoney(e.bhxhEmployee)}</td>
                        <td style={{ ...tds, textAlign: "right" }}>{fmtMoney(e.bhxhCompany)}</td>
                        <td style={{ ...tds, textAlign: "right", fontWeight: 700 }}>{fmtMoney((e.bhxhEmployee || 0) + (e.bhxhCompany || 0))}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "var(--bgh)" }}>
                      <td colSpan={3} style={{ ...tds, fontWeight: 700 }}>TỔNG ({bhxhEmps.length} NV)</td>
                      <td style={{ ...tds, textAlign: "right", fontWeight: 700, color: "#e74c3c" }}>{fmtMoney(totalEmp)}</td>
                      <td style={{ ...tds, textAlign: "right", fontWeight: 700, color: "#3498db" }}>{fmtMoney(totalComp)}</td>
                      <td style={{ ...tds, textAlign: "right", fontWeight: 800 }}>{fmtMoney(totalEmp + totalComp)}</td>
                    </tr>
                  </tbody>
                </table>
              </>
            );
          })()}
        </div>
      )}

      {/* ═══ Advance Dialog ═══ */}
      {advDlg && (
        <Dialog open onClose={() => setAdvDlg(null)} title={advDlg === "new" ? "Thêm tạm ứng" : "Sửa tạm ứng"} width={400}>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Nhân viên</label>
            <select value={advFm.employeeId} onChange={e => setAdvFm(p => ({ ...p, employeeId: e.target.value }))} style={inputSt} disabled={advDlg === "edit"}>
              <option value="">-- Chọn --</option>
              {activeEmps.map(e => <option key={e.id} value={e.id}>{e.code} — {e.fullName}</option>)}
            </select>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
            <div>
              <label style={labelSt}>Số tiền (đ)</label>
              <input value={advFm.amount} onChange={e => setAdvFm(p => ({ ...p, amount: e.target.value.replace(/[^0-9]/g, "") }))} style={{ ...inputSt, textAlign: "right" }} />
              {advFm.amount && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 2 }}>{fmtMoney(advFm.amount)}đ</div>}
            </div>
            <div>
              <label style={labelSt}>Ngày ứng</label>
              <input type="date" value={advFm.advanceDate} onChange={e => setAdvFm(p => ({ ...p, advanceDate: e.target.value }))} style={inputSt} />
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Ghi chú</label>
            <input value={advFm.note} onChange={e => setAdvFm(p => ({ ...p, note: e.target.value }))} style={inputSt} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setAdvDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={saveAdvance} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
          </div>
        </Dialog>
      )}

      {/* ═══ Other Deduction Dialog ═══ */}
      {deductDlg && (
        <Dialog open onClose={() => setDeductDlg(null)} title={`Khấu trừ khác — ${deductDlg.employeeName}`} width={380}>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Số tiền khấu trừ (đ)</label>
            <input value={deductDlg.otherDeduction || ""} onChange={e => setDeductDlg(p => ({ ...p, otherDeduction: e.target.value.replace(/[^0-9]/g, "") }))} style={{ ...inputSt, textAlign: "right" }} autoFocus />
            {deductDlg.otherDeduction && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 2 }}>{fmtMoney(deductDlg.otherDeduction)}đ</div>}
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Ghi chú</label>
            <input value={deductDlg.otherDeductionNote || ""} onChange={e => setDeductDlg(p => ({ ...p, otherDeductionNote: e.target.value }))} style={inputSt} placeholder="VD: Phạt đi muộn" />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setDeductDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={saveOtherDeduction} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
          </div>
        </Dialog>
      )}

      {/* ═══ Print template (hidden) ═══ */}
      <div ref={printRef} style={{ display: "none" }}>
        {printEmp && (
          <div>
            <div className="header">
              <h2>CÔNG TY CỔ PHẦN GTH</h2>
              <h3>PHIẾU LƯƠNG THÁNG {m}/{y}</h3>
            </div>
            <table>
              <tbody>
                <tr><td style={{ width: "30%" }}>Mã nhân viên</td><td className="b">{printEmp.employeeCode}</td></tr>
                <tr><td>Họ tên</td><td className="b">{printEmp.employeeName}</td></tr>
                <tr><td>Bộ phận</td><td>{printEmp.departmentName}</td></tr>
                <tr><td>Loại lương</td><td>{printEmp.salaryType === "monthly" ? "Lương tháng" : "Lương ngày"}</td></tr>
              </tbody>
            </table>
            <h3>THU NHẬP</h3>
            <table>
              <thead><tr><th>Khoản mục</th><th className="r" style={{ width: "30%" }}>Số tiền (đ)</th></tr></thead>
              <tbody>
                <tr><td>Lương cơ bản ({printEmp.workDays} công / {printEmp.standardDays} chuẩn{printEmp.probationRate < 1 ? ` × ${Math.round(printEmp.probationRate * 100)}%` : ""})</td><td className="r">{fmtMoney(printEmp.baseAmount)}</td></tr>
                {printEmp.otAmount > 0 && <tr><td>Tăng ca ({printEmp.otHours}h × {printEmp.otRate})</td><td className="r">{fmtMoney(printEmp.otAmount)}</td></tr>}
                {(printEmp.allowanceDetail || []).map((a, i) => (
                  <tr key={i}><td>Phụ cấp: {a.name}</td><td className="r">{fmtMoney(a.amount)}</td></tr>
                ))}
                {printEmp.attendanceBonus > 0 && <tr><td>Thưởng chuyên cần</td><td className="r">{fmtMoney(printEmp.attendanceBonus)}</td></tr>}
                <tr className="b"><td>Tổng thu nhập</td><td className="r">{fmtMoney(printEmp.baseAmount + printEmp.otAmount + printEmp.allowanceTotal + printEmp.attendanceBonus)}</td></tr>
              </tbody>
            </table>
            <h3>KHẤU TRỪ</h3>
            <table>
              <tbody>
                {printEmp.bhxhEmployee > 0 && <tr><td>BHXH (người lao động)</td><td className="r">{fmtMoney(printEmp.bhxhEmployee)}</td></tr>}
                {printEmp.advanceDeduction > 0 && <tr><td>Tạm ứng</td><td className="r">{fmtMoney(printEmp.advanceDeduction)}</td></tr>}
                {printEmp.otherDeduction > 0 && <tr><td>Khác{printEmp.otherDeductionNote ? ` (${printEmp.otherDeductionNote})` : ""}</td><td className="r">{fmtMoney(printEmp.otherDeduction)}</td></tr>}
                <tr className="b"><td>Tổng khấu trừ</td><td className="r">{fmtMoney(printEmp.bhxhEmployee + printEmp.advanceDeduction + printEmp.otherDeduction)}</td></tr>
              </tbody>
            </table>
            <table style={{ marginTop: 16 }}>
              <tbody>
                <tr className="b" style={{ fontSize: "15px" }}><td>THỰC LÃNH</td><td className="r" style={{ color: "#d35400" }}>{fmtMoney(printEmp.netSalary)} đ</td></tr>
              </tbody>
            </table>
            <div className="sig">
              <div><strong>Người lập</strong><br /><br /><br /><em>{user?.label || user?.username || ""}</em></div>
              <div><strong>Giám đốc</strong><br /><br /><br /></div>
              <div><strong>Người nhận</strong><br /><br /><br /><em>{printEmp.employeeName}</em></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
