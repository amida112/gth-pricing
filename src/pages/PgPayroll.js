import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Dialog from "../components/Dialog";
import { fmtDate, fmtMoney } from "../utils";
import PgCommissionConfig from "./PgCommissionConfig";
import { calcCommissions } from "../utils/commission";
const PAYROLL_STATUS = { draft: { label: "Nháp", color: "#f39c12" }, confirmed: { label: "Đã duyệt", color: "#27ae60" }, paid: { label: "Đã trả", color: "#3498db" } };
const WORK_VALUE = { present: 1, half_day: 0.5, absent: 0, leave: 0, holiday: 0 };

const inputSt = { width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid var(--bd)", fontSize: "0.82rem", background: "var(--bg)", color: "var(--tp)", outline: "none", boxSizing: "border-box" };
const labelSt = { fontSize: "0.72rem", fontWeight: 600, color: "var(--ts)", marginBottom: 3, display: "block" };
const ths = { padding: "8px 10px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.65rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", whiteSpace: "nowrap" };
const tds = { padding: "7px 10px", fontSize: "0.75rem", borderBottom: "1px solid var(--bd)" };

function PgPayroll({ employees, departments, allowanceTypes, wts = [], ats = [], cfg = {}, useAPI, notify, user, isAdmin }) {
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

  // Extra work
  const [extraWorkTypes, setExtraWorkTypes] = useState([]);
  const [extraWorkRecords, setExtraWorkRecords] = useState([]);
  const [ewAssignments, setEwAssignments] = useState([]);

  // Monthly OT
  const [monthlyOt, setMonthlyOt] = useState([]);

  // BHXH monthly
  const [bhxhMonthly, setBhxhMonthly] = useState([]);

  // Leave requests
  const [leaveRequests, setLeaveRequests] = useState([]);

  // Commission data
  const [commData, setCommData] = useState({}); // { woodRates, skuOverrides, containerTiers, commSettings, orders, orderDetails, dynamicUsers }
  const [commResult, setCommResult] = useState({});
  const [commDetailDlg, setCommDetailDlg] = useState(null); // { empId, emp, data }

  // Employee quick view (lịch sử lương + phụ cấp)
  const [quickViewDlg, setQuickViewDlg] = useState(null);
  const openQuickView = async (empId) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;
    setQuickViewDlg({ emp, history: [], allowances: [], loading: true });
    if (useAPI) {
      try {
        const api = await import("../api.js");
        const [hist, al] = await Promise.all([api.fetchEmployeeChangeLog(empId), api.fetchEmployeeAllowances(empId)]);
        setQuickViewDlg(p => p ? { ...p, history: hist || [], allowances: al || [], loading: false } : null);
      } catch { setQuickViewDlg(p => p ? { ...p, loading: false } : null); }
    }
  };

  // Extra work sub-tab + type CRUD dialog
  const [ewSubTab, setEwSubTab] = useState("input"); // "input" | "assign" | "types"
  const [ewTypeDlg, setEwTypeDlg] = useState(null);
  const [ewTypeFm, setEwTypeFm] = useState({ name: "", rate: "", unit: "công" });

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
      import("../api.js").then(api => api.fetchExtraWorkTypes()),
      import("../api.js").then(api => api.fetchExtraWorkRecords(period)),
      import("../api.js").then(api => api.fetchExtraWorkAssignments()),
      import("../api.js").then(api => api.fetchMonthlyOt(period)),
      import("../api.js").then(api => api.fetchBhxhMonthly(period)),
      import("../api.js").then(api => api.fetchLeaveRequests(period)),
      import("../api.js").then(api => api.fetchCommissionWoodRates()),
      import("../api.js").then(api => api.fetchCommissionSkuOverrides()),
      import("../api.js").then(api => api.fetchCommissionContainerTiers()),
      import("../api.js").then(api => api.fetchCommissionSettings()),
      import("../api.js").then(api => api.fetchOrders()),
      import("../api.js").then(api => api.fetchUsers()),
    ]).then(async ([pr, adv, att, sett, allAl, ewTypes, ewRecords, ewAssign, otData, bhxhData, leaveData, woodRates, skuOverrides, containerTiers, commSettings, allOrders, dynUsers]) => {
      setPayroll(pr);
      setAdvances(adv);
      setAttendance(att);
      setSettings(sett);
      if (ewTypes?.length) setExtraWorkTypes(ewTypes);
      setExtraWorkRecords(ewRecords || []);
      setEwAssignments(ewAssign || []);
      setMonthlyOt(otData || []);
      setBhxhMonthly(bhxhData || []);
      setLeaveRequests(leaveData || []);
      // Commission: filter orders trong kỳ (delivered/paid) + tính HH
      const [py, pm] = period.split("-").map(Number);
      const periodOrders = (allOrders || []).filter(o => {
        if (!o.createdAt) return false;
        const d = new Date(o.createdAt);
        const st = (o.status || "").toLowerCase();
        const isCompleted = st === "delivered" || st === "paid" || st.includes("xuất") || st.includes("thanh toán");
        return d.getFullYear() === py && d.getMonth() + 1 === pm && isCompleted;
      });
      // Fetch order details (items) cho từng order — batch
      const orderDetailMap = {};
      if (periodOrders.length > 0) {
        const api2 = await import("../api.js");
        await Promise.all(periodOrders.map(async o => {
          try {
            const detail = await api2.fetchOrderDetail(o.id);
            orderDetailMap[o.id] = detail?.items || [];
          } catch { orderDetailMap[o.id] = []; }
        }));
      }
      const cd = { woodRates: woodRates || [], skuOverrides: skuOverrides || [], containerTiers: containerTiers || [], commSettings: commSettings || {}, orders: periodOrders, orderDetails: orderDetailMap, dynamicUsers: dynUsers || [] };
      setCommData(cd);
      try {
        const cr = calcCommissions({ ...cd, employees, wts });
        setCommResult(cr);
      } catch { setCommResult({}); }
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

    // Attendance summary — dùng work_value lẻ
    let workDays = 0;
    const [y, m] = period.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const attMap = {};
    attendance.filter(a => a.employeeId === emp.id).forEach(a => { attMap[a.date] = a; });
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${period}-${String(d).padStart(2, "0")}`;
      const rec = attMap[dateStr];
      if (rec) {
        workDays += rec.workValue ?? (rec.status === "present" ? 1 : rec.status === "half_day" ? 0.5 : 0);
      }
    }
    workDays = Math.round(workDays * 100) / 100;
    // OT: ưu tiên monthly_ot (kế toán nhập tổng), fallback cộng từ attendance
    const empMonthlyOt = monthlyOt.find(o => o.employeeId === emp.id);
    let otMins = empMonthlyOt ? empMonthlyOt.otMinutes : 0;
    if (!empMonthlyOt) {
      for (let d = 1; d <= daysInMonth; d++) {
        const rec = attMap[`${period}-${String(d).padStart(2, "0")}`];
        if (rec) otMins += rec.otMinutes || 0;
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

    // Allowances — phụ cấp theo công (proration)
    const empAllowances = allAllowances.filter(a => a.employeeId === emp.id);
    let prorationTiers;
    try { prorationTiers = JSON.parse(getSetting("allowance_proration_tiers", "[]")); } catch { prorationTiers = []; }
    const getProrateRate = (days) => {
      if (!prorationTiers.length) return 1;
      const tier = prorationTiers.find(t => days >= t.minDays && days <= t.maxDays);
      return tier ? tier.rate : 1;
    };
    const prorateRate = getProrateRate(workDays);

    const allowanceDetail = empAllowances.map(a => {
      const aType = allowanceTypes.find(t => t.id === a.allowanceTypeId);
      const typeName = aType?.name || "Khác";
      const calcMode = aType?.calcMode || "fixed";
      let actualAmount = a.amount;
      let pRate = 1;
      if (calcMode === "prorated") {
        pRate = prorateRate;
        actualAmount = Math.round(a.amount * pRate);
      } else if (calcMode === "per_day") {
        // a.amount = đơn giá/ngày, nhân với số công
        actualAmount = Math.round(a.amount * workDays);
        pRate = workDays;
      }
      return { name: typeName, amount: actualAmount, fullAmount: a.amount, calcMode, prorateRate: pRate };
    });
    const allowanceTotal = allowanceDetail.reduce((s, a) => s + a.amount, 0);

    // Attendance bonus — chỉ NV chính thức + BP có flag attendance_bonus
    const empDept = departments.find(d => d.id === emp.departmentId);
    let attendanceBonus = 0;
    if (emp.employeeType === "official" && empDept?.attendanceBonus) {
      if (workDays >= 30) attendanceBonus = bonus30;
      else if (workDays >= 28) attendanceBonus = bonus28;
    }

    // Thống kê chấm công cho phiếu lương
    let leaveDays = 0, absentNoPermission = 0, lateTimes = 0, forgotClockTimes = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${period}-${String(d).padStart(2, "0")}`;
      const rec = attMap[dateStr];
      const hasLeave = leaveRequests?.some(l => l.employeeId === emp.id && l.date === dateStr && l.status === "approved");
      if (rec) {
        if (rec.status === "absent" || rec.status === "leave") {
          if (hasLeave) leaveDays++;
          else {
            const isSunday = new Date(y, m - 1, d).getDay() === 0;
            const empDept = departments.find(dd => dd.id === emp.departmentId);
            if (isSunday && empDept?.sundayMode !== "campaign") { /* CN mặc định */ }
            else absentNoPermission++;
          }
        }
        if (rec.isLate) lateTimes++;
        if (rec.flag === "forgot_clock") forgotClockTimes++;
      } else if (hasLeave) {
        leaveDays++;
      }
    }

    // BHXH — ưu tiên bhxh_monthly (theo tháng), fallback employees.bhxh_amount
    const empBhxh = bhxhMonthly.find(b => b.employeeId === emp.id);
    const bhxhActive = empBhxh ? empBhxh.isActive : emp.bhxhEnrolled;
    const bhxhDeduction = bhxhActive ? (empBhxh ? empBhxh.amount : (emp.bhxhAmount || 0)) : 0;

    // Extra work (công việc phụ)
    const empExtraWork = extraWorkRecords.filter(r => r.employeeId === emp.id);
    const extraWorkDetail = empExtraWork.map(r => {
      const ewType = extraWorkTypes.find(t => t.id === r.extraWorkTypeId);
      return { name: ewType?.name || "Khác", quantity: r.quantity, rate: ewType?.rate || 0, amount: r.amount, unit: ewType?.unit || "công" };
    });
    const extraWorkTotal = empExtraWork.reduce((s, r) => s + r.amount, 0);

    // Advances
    const empAdvances = advances.filter(a => a.employeeId === emp.id && a.status === "pending");
    const advanceDeduction = empAdvances.reduce((s, a) => s + a.amount, 0);

    // Commission (hoa hồng)
    const empComm = commResult[emp.id];
    const commission = empComm?.totalCommission || 0;
    const commissionDetail = empComm || {};

    // Net
    const grossIncome = baseAmount + otAmount + allowanceTotal + attendanceBonus + extraWorkTotal + commission;
    const totalDeduction = bhxhDeduction + advanceDeduction;
    const netSalary = grossIncome - totalDeduction;

    return {
      employeeId: emp.id, employeeCode: emp.code, employeeName: emp.fullName,
      departmentName: deptName(emp.departmentId),
      salaryType: emp.salaryType, baseSalary: emp.baseSalary, probationRate: probRate,
      workDays, standardDays, baseAmount,
      otHours, otRate, otAmount,
      allowanceTotal, allowanceDetail, attendanceBonus,
      extraWorkTotal, extraWorkDetail,
      commission, commissionDetail,
      bhxhEmployee: bhxhDeduction, bhxhCompany: 0,
      leaveDays, absentNoPermission, lateTimes, forgotClockTimes,
      advanceDeduction, otherDeduction: 0, otherDeductionNote: "",
      netSalary, note: "",
    };
  }, [period, attendance, allAllowances, allowanceTypes, departments, advances, extraWorkTypes, extraWorkRecords, monthlyOt, bhxhMonthly, leaveRequests, commResult, deptName, getSetting]);

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
    const t = { baseAmount: 0, otAmount: 0, allowanceTotal: 0, attendanceBonus: 0, extraWorkTotal: 0, commission: 0, bhxhEmployee: 0, bhxhCompany: 0, advanceDeduction: 0, otherDeduction: 0, netSalary: 0 };
    details.forEach(d => {
      t.baseAmount += d.baseAmount; t.otAmount += d.otAmount; t.allowanceTotal += d.allowanceTotal;
      t.attendanceBonus += d.attendanceBonus; t.extraWorkTotal += d.extraWorkTotal || 0; t.commission += d.commission || 0; t.bhxhEmployee += d.bhxhEmployee; t.bhxhCompany += d.bhxhCompany;
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
        .sig{display:flex;justify-content:space-between;margin-top:40px}
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
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)} style={{ padding: "8px 14px", borderRadius: 8, border: "2px solid var(--ac)", fontSize: "0.88rem", fontWeight: 700, background: "var(--acbg)", color: "var(--ac)", outline: "none", cursor: "pointer" }} />
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "2px solid var(--bd)", marginBottom: 14 }}>
        {[["payroll", "Bảng lương"], ["ot", "OT"], ["commission", "Hoa hồng"], ["extra_work", "Công việc phụ"], ["advances", "Tạm ứng"], ["bhxh", "Tổng hợp BHXH"]].map(([k, lb]) => (
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
                    <th style={{ ...ths, width: 36, textAlign: "center" }}>STT</th>
                    <th style={ths}>Mã</th>
                    <th style={ths}>Họ tên</th>
                    <th style={ths}>Bộ phận</th>
                    <th style={{ ...ths, textAlign: "center" }}>Công</th>
                    <th style={{ ...ths, textAlign: "right" }}>Lương CB</th>
                    <th style={{ ...ths, textAlign: "right" }}>OT</th>
                    <th style={{ ...ths, textAlign: "right" }}>Phụ cấp</th>
                    <th style={{ ...ths, textAlign: "right" }}>CC</th>
                    <th style={{ ...ths, textAlign: "right" }}>CV phụ</th>
                    <th style={{ ...ths, textAlign: "right" }}>Hoa hồng</th>
                    <th style={{ ...ths, textAlign: "right" }}>BHXH</th>
                    <th style={{ ...ths, textAlign: "right" }}>Tạm ứng</th>
                    <th style={{ ...ths, textAlign: "right" }}>Trừ khác</th>
                    <th style={{ ...ths, textAlign: "right", color: "var(--ac)" }}>Thực lãnh</th>
                    <th style={{ ...ths, textAlign: "center", width: 60 }} />
                  </tr>
                </thead>
                <tbody>
                  {details.map((d, i) => {
                    const grossIncome = d.baseAmount + d.otAmount + d.allowanceTotal + d.attendanceBonus;
                    return (
                      <tr key={d.employeeId}>
                        <td style={{ ...tds, textAlign: "center", fontSize: "0.68rem", color: "var(--tm)", width: 36 }}>{i + 1}</td>
                        <td style={{ ...tds, fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap" }}>{d.employeeCode}</td>
                        <td style={{ ...tds, fontWeight: 600, whiteSpace: "nowrap", cursor: "pointer", color: "var(--ac)" }} title="Click xem lịch sử lương & phụ cấp" onClick={() => openQuickView(d.employeeId)}>{d.employeeName}</td>
                        <td style={tds}>{d.departmentName}</td>
                        <td style={{ ...tds, textAlign: "center" }}>{d.workDays}</td>
                        <td style={{ ...tds, textAlign: "right" }}>{fmtMoney(d.baseAmount)}</td>
                        <td style={{ ...tds, textAlign: "right", color: d.otAmount > 0 ? "#e67e22" : "var(--tm)" }}>{d.otAmount > 0 ? fmtMoney(d.otAmount) : "—"}</td>
                        <td style={{ ...tds, textAlign: "right" }}>{d.allowanceTotal > 0 ? fmtMoney(d.allowanceTotal) : "—"}</td>
                        <td style={{ ...tds, textAlign: "right", color: d.attendanceBonus > 0 ? "#27ae60" : "var(--tm)" }}>{d.attendanceBonus > 0 ? fmtMoney(d.attendanceBonus) : "—"}</td>
                        <td style={{ ...tds, textAlign: "right", color: (d.extraWorkTotal || 0) > 0 ? "#8e44ad" : "var(--tm)" }} title={(d.extraWorkDetail || []).map(e => `${e.name}: ${e.quantity}${e.unit} × ${fmtMoney(e.rate)} = ${fmtMoney(e.amount)}`).join("\n")}>{(d.extraWorkTotal || 0) > 0 ? fmtMoney(d.extraWorkTotal) : "—"}</td>
                        <td style={{ ...tds, textAlign: "right", color: d.commission > 0 ? "#2980b9" : "var(--tm)", cursor: d.commission > 0 ? "pointer" : "default" }} title={d.commission > 0 ? "Click xem chi tiết" : ""} onClick={() => { if (d.commission > 0) { const emp = employees.find(e => e.id === d.employeeId); setCommDetailDlg({ empId: d.employeeId, emp, data: commResult[d.employeeId] }); } }}>{d.commission > 0 ? fmtMoney(d.commission) : "—"}</td>
                        <td style={{ ...tds, textAlign: "right", color: d.bhxhEmployee > 0 ? "#e74c3c" : "var(--tm)" }}>{d.bhxhEmployee > 0 ? "-" + fmtMoney(d.bhxhEmployee) : "—"}</td>
                        <td style={{ ...tds, textAlign: "right", color: d.advanceDeduction > 0 ? "#e74c3c" : "var(--tm)" }}>{d.advanceDeduction > 0 ? "-" + fmtMoney(d.advanceDeduction) : "—"}</td>
                        <td style={{ ...tds, textAlign: "right", cursor: payroll?.status === "draft" ? "pointer" : "default" }} title="Click để nhập khấu trừ khác" onClick={() => payroll?.status === "draft" && setDeductDlg({ ...d, grossIncome })}>
                          {d.otherDeduction > 0 ? <span style={{ color: "#e74c3c" }}>-{fmtMoney(d.otherDeduction)}</span> : <span style={{ color: "var(--tm)" }}>—</span>}
                        </td>
                        <td style={{ ...tds, textAlign: "right", fontWeight: 700, color: "var(--ac)", fontSize: "0.78rem" }}>{fmtMoney(d.netSalary)}</td>
                        <td style={{ ...tds, textAlign: "center" }}>
                          <button onClick={() => printPayslip(d)} style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.65rem", marginRight: 2 }} title="In phiếu lương">🖨</button>
                          {(() => {
                            const emp = employees.find(e => e.id === d.employeeId);
                            const phone = emp?.phone?.replace(/[^0-9]/g, "");
                            const zaloPhone = phone ? (phone.startsWith("0") ? "84" + phone.slice(1) : phone) : "";
                            return (
                              <button onClick={() => {
                                if (!zaloPhone) { notify(`${d.employeeName} chưa có SĐT — cập nhật trong Nhân sự`, false); return; }
                                window.open(`https://zalo.me/${zaloPhone}`, "_blank");
                              }} style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid #0068ff44", background: "#0068ff11", color: "#0068ff", cursor: "pointer", fontSize: "0.65rem", fontWeight: 700 }} title={phone ? `Gửi Zalo: ${emp?.phone}` : "Chưa có SĐT"}>Z</button>
                            );
                          })()}
                        </td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  <tr style={{ background: "var(--bgh)" }}>
                    <td colSpan={4} style={{ ...tds, fontWeight: 700 }}>TỔNG CỘNG ({details.length} NV)</td>
                    <td style={tds} />
                    <td style={{ ...tds, textAlign: "right", fontWeight: 700 }}>{fmtMoney(totals.baseAmount)}</td>
                    <td style={{ ...tds, textAlign: "right", fontWeight: 700 }}>{fmtMoney(totals.otAmount)}</td>
                    <td style={{ ...tds, textAlign: "right", fontWeight: 700 }}>{fmtMoney(totals.allowanceTotal)}</td>
                    <td style={{ ...tds, textAlign: "right", fontWeight: 700 }}>{fmtMoney(totals.attendanceBonus)}</td>
                    <td style={{ ...tds, textAlign: "right", fontWeight: 700, color: "#8e44ad" }}>{fmtMoney(totals.extraWorkTotal)}</td>
                    <td style={{ ...tds, textAlign: "right", fontWeight: 700, color: "#2980b9" }}>{fmtMoney(totals.commission)}</td>
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

      {/* ═══ Tab: OT ═══ */}
      {!loading && tab === "ot" && (() => {
        const otMap = {};
        monthlyOt.forEach(o => { otMap[o.employeeId] = o; });
        // Default: tổng OT từ chấm công per-day nếu chưa có monthly_ot
        const getOtDefault = (empId) => {
          if (otMap[empId]) return otMap[empId].otMinutes;
          let total = 0;
          attendance.filter(a => a.employeeId === empId).forEach(a => { total += a.otMinutes || 0; });
          return total;
        };
        const totalOtMins = activeEmps.reduce((s, emp) => s + getOtDefault(emp.id), 0);
        return (
          <div>
            <div style={{ fontSize: "0.75rem", color: "var(--tm)", marginBottom: 10 }}>
              Nhập tổng phút OT tháng {m}/{y} cho từng NV (từ phiếu OT quản lý). Tổng: <strong style={{ color: "#e67e22" }}>{Math.floor(totalOtMins / 60)}h{totalOtMins % 60 > 0 ? totalOtMins % 60 + "p" : ""}</strong>
            </div>
            <div style={{ overflowX: "auto", maxHeight: "calc(80vh - 200px)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                  <tr>
                    <th style={{ ...ths, width: 36, textAlign: "center" }}>STT</th>
                    <th style={ths}>Mã</th>
                    <th style={ths}>Họ tên</th>
                    <th style={ths}>Bộ phận</th>
                    <th style={{ ...ths, textAlign: "center", minWidth: 100 }}>OT (phút)</th>
                    <th style={{ ...ths, textAlign: "center", minWidth: 80 }}>Quy giờ</th>
                    <th style={ths}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {activeEmps.map((emp, i) => {
                    const rec = otMap[emp.id];
                    const mins = getOtDefault(emp.id);
                    return (
                      <tr key={emp.id}>
                        <td style={{ ...tds, textAlign: "center", fontSize: "0.68rem", color: "var(--tm)" }}>{i + 1}</td>
                        <td style={{ ...tds, fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap" }}>{emp.code}</td>
                        <td style={{ ...tds, fontWeight: 600, whiteSpace: "nowrap" }}>{emp.fullName}</td>
                        <td style={tds}>{deptName(emp.departmentId)}</td>
                        <td style={{ ...tds, textAlign: "center", padding: "2px 4px" }}>
                          <input value={mins || ""} onChange={e => {
                            const val = Number(e.target.value.replace(/[^0-9]/g, "")) || 0;
                            setMonthlyOt(prev => {
                              const idx = prev.findIndex(o => o.employeeId === emp.id);
                              if (idx >= 0) return prev.map((o, j) => j === idx ? { ...o, otMinutes: val } : o);
                              return [...prev, { id: "tmp_" + Date.now(), employeeId: emp.id, period, otMinutes: val, note: "" }];
                            });
                          }} onBlur={() => {
                            const val = otMap[emp.id]?.otMinutes ?? (monthlyOt.find(o => o.employeeId === emp.id)?.otMinutes || 0);
                            if (useAPI) import("../api.js").then(api => api.upsertMonthlyOt(emp.id, period, val, "", user?.username));
                          }} style={{ width: 70, padding: "4px 6px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.78rem", textAlign: "center", background: mins > 0 ? "#e67e2211" : "var(--bg)", color: "var(--tp)", outline: "none" }} placeholder="0" />
                        </td>
                        <td style={{ ...tds, textAlign: "center", fontSize: "0.72rem", color: mins > 0 ? "#e67e22" : "var(--tm)" }}>{mins > 0 ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? mins % 60 + "p" : ""}` : "—"}</td>
                        <td style={{ ...tds, padding: "2px 4px" }}>
                          <input value={rec?.note || ""} onChange={e => {
                            setMonthlyOt(prev => prev.map(o => o.employeeId === emp.id ? { ...o, note: e.target.value } : o));
                          }} onBlur={() => {
                            const o = monthlyOt.find(o => o.employeeId === emp.id);
                            if (useAPI && o) import("../api.js").then(api => api.upsertMonthlyOt(emp.id, period, o.otMinutes, o.note || "", user?.username));
                          }} style={{ width: "100%", padding: "4px 6px", borderRadius: 5, border: "1px solid var(--bd)", fontSize: "0.72rem", background: "var(--bg)", color: "var(--tp)", outline: "none" }} placeholder="Ghi chú" />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ═══ Tab: Hoa hồng ═══ */}
      {!loading && tab === "commission" && (
        <PgCommissionConfig wts={wts} ats={ats} cfg={cfg} useAPI={useAPI} notify={notify} />
      )}

      {/* ═══ Tab: Công việc phụ ═══ */}
      {!loading && tab === "extra_work" && (() => {
        const activeEwTypes = extraWorkTypes.filter(t => t.isActive !== false);
        const ewMap = {};
        extraWorkRecords.forEach(r => { ewMap[`${r.employeeId}_${r.extraWorkTypeId}`] = r; });
        const assignSet = new Set(ewAssignments.map(a => `${a.employeeId}_${a.extraWorkTypeId}`));
        const isAssigned = (empId, typeId) => assignSet.has(`${empId}_${typeId}`);
        const assignedEmps = activeEmps.filter(emp => activeEwTypes.some(t => isAssigned(emp.id, t.id)));

        return (
          <div>
            {/* Sub-tabs */}
            <div style={{ display: "flex", gap: 0, borderBottom: "1.5px solid var(--bd)", marginBottom: 10 }}>
              {[["input", "Nhập số công"], ["assign", "Gán NV"], ["types", "Loại CV phụ"]].map(([k, lb]) => (
                <button key={k} onClick={() => setEwSubTab(k)} style={{ padding: "6px 14px", border: "none", borderBottom: ewSubTab === k ? "2px solid #8e44ad" : "2px solid transparent", marginBottom: -1.5, background: "transparent", cursor: "pointer", fontWeight: ewSubTab === k ? 700 : 500, fontSize: "0.72rem", color: ewSubTab === k ? "#8e44ad" : "var(--ts)" }}>{lb}</button>
              ))}
            </div>

            {/* Sub: Nhập số công — chỉ NV đã gán */}
            {ewSubTab === "input" && (
              <>
                {assignedEmps.length === 0 && <div style={{ padding: 20, textAlign: "center", color: "var(--tm)", fontSize: "0.82rem" }}>Chưa gán CV phụ cho NV nào. Vào tab "Gán NV" để gán trước.</div>}
                {assignedEmps.length > 0 && (
                  <div style={{ overflowX: "auto", maxHeight: "calc(80vh - 240px)" }}>
                    <table style={{ borderCollapse: "collapse", width: "100%" }}>
                      <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                        <tr>
                          <th style={{ ...ths, width: 36, textAlign: "center" }}>STT</th>
                          <th style={ths}>Mã</th>
                          <th style={ths}>Họ tên</th>
                          {activeEwTypes.map(t => (
                            <th key={t.id} style={{ ...ths, textAlign: "center", minWidth: 100 }}>
                              <div>{t.name}</div>
                              <div style={{ fontSize: "0.55rem", color: "var(--tm)", fontWeight: 500 }}>{fmtMoney(t.rate)}đ/{t.unit}</div>
                            </th>
                          ))}
                          <th style={{ ...ths, textAlign: "right", minWidth: 80 }}>Tổng tiền</th>
                        </tr>
                      </thead>
                      <tbody>
                        {assignedEmps.map((emp, i) => {
                          const empTotal = activeEwTypes.reduce((s, t) => s + (isAssigned(emp.id, t.id) ? (ewMap[`${emp.id}_${t.id}`]?.amount || 0) : 0), 0);
                          return (
                            <tr key={emp.id}>
                              <td style={{ ...tds, textAlign: "center", fontSize: "0.68rem", color: "var(--tm)" }}>{i + 1}</td>
                              <td style={{ ...tds, fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap" }}>{emp.code}</td>
                              <td style={{ ...tds, fontWeight: 600, whiteSpace: "nowrap" }}>{emp.fullName}</td>
                              {activeEwTypes.map(t => {
                                if (!isAssigned(emp.id, t.id)) return <td key={t.id} style={{ ...tds, textAlign: "center", background: "var(--bgs)", color: "var(--bd)" }}>—</td>;
                                const rec = ewMap[`${emp.id}_${t.id}`];
                                const qty = rec?.quantity || 0;
                                return (
                                  <td key={t.id} style={{ ...tds, textAlign: "center", cursor: "pointer", background: qty > 0 ? "rgba(142,68,173,0.06)" : "transparent" }} title={qty > 0 ? `${qty} ${t.unit} × ${fmtMoney(t.rate)} = ${fmtMoney(rec?.amount)}` : `Click để nhập`} onClick={() => {
                                    const input = window.prompt(`${emp.fullName} — ${t.name}\nSố ${t.unit} (đơn giá: ${fmtMoney(t.rate)}đ/${t.unit}):`, qty || "");
                                    if (input === null) return;
                                    const val = parseFloat(input) || 0;
                                    if (useAPI) {
                                      import("../api.js").then(api => api.upsertExtraWorkRecord(emp.id, t.id, period, val, t.rate, "", user?.username).then(r => {
                                        if (r?.error) notify("Lỗi: " + r.error, false);
                                        else {
                                          setExtraWorkRecords(prev => {
                                            const idx = prev.findIndex(x => x.employeeId === emp.id && x.extraWorkTypeId === t.id);
                                            const updated = { id: rec?.id || "tmp_" + Date.now(), employeeId: emp.id, extraWorkTypeId: t.id, period, quantity: val, amount: r.amount || Math.round(val * t.rate), note: "" };
                                            if (idx >= 0) return prev.map((x, j) => j === idx ? updated : x);
                                            return [...prev, updated];
                                          });
                                        }
                                      }));
                                    }
                                  }}>
                                    <span style={{ fontSize: "0.72rem", fontWeight: qty > 0 ? 700 : 400, color: qty > 0 ? "#8e44ad" : "var(--tm)" }}>{qty > 0 ? qty : "—"}</span>
                                    {qty > 0 && <div style={{ fontSize: "0.58rem", color: "var(--tm)" }}>{fmtMoney(rec?.amount)}</div>}
                                  </td>
                                );
                              })}
                              <td style={{ ...tds, textAlign: "right", fontWeight: 700, color: empTotal > 0 ? "#8e44ad" : "var(--tm)" }}>{empTotal > 0 ? fmtMoney(empTotal) : "—"}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}

            {/* Sub: Gán NV — ma trận tick */}
            {ewSubTab === "assign" && (
              <div style={{ overflowX: "auto", maxHeight: "calc(80vh - 240px)" }}>
                <div style={{ fontSize: "0.72rem", color: "var(--tm)", marginBottom: 6 }}>Click ô để gán/bỏ gán CV phụ cho NV.</div>
                <table style={{ borderCollapse: "collapse", width: "100%" }}>
                  <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                    <tr>
                      <th style={{ ...ths, width: 36, textAlign: "center" }}>STT</th>
                      <th style={ths}>Mã</th>
                      <th style={ths}>Họ tên</th>
                      {activeEwTypes.map(t => <th key={t.id} style={{ ...ths, textAlign: "center", minWidth: 90 }}>{t.name}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {activeEmps.map((emp, i) => (
                      <tr key={emp.id}>
                        <td style={{ ...tds, textAlign: "center", fontSize: "0.68rem", color: "var(--tm)" }}>{i + 1}</td>
                        <td style={{ ...tds, fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap" }}>{emp.code}</td>
                        <td style={{ ...tds, fontWeight: 600, whiteSpace: "nowrap" }}>{emp.fullName}</td>
                        {activeEwTypes.map(t => {
                          const assigned = isAssigned(emp.id, t.id);
                          return (
                            <td key={t.id} style={{ ...tds, textAlign: "center", cursor: "pointer", background: assigned ? "rgba(142,68,173,0.08)" : "transparent" }} onClick={() => {
                              if (useAPI) {
                                import("../api.js").then(api => api.toggleExtraWorkAssignment(emp.id, t.id).then(r => {
                                  if (r?.error) notify("Lỗi: " + r.error, false);
                                  else {
                                    if (r.action === "added") setEwAssignments(p => [...p, { id: "tmp_" + Date.now(), employeeId: emp.id, extraWorkTypeId: t.id }]);
                                    else setEwAssignments(p => p.filter(a => !(a.employeeId === emp.id && a.extraWorkTypeId === t.id)));
                                  }
                                }));
                              }
                            }}>
                              <span style={{ fontSize: "0.82rem", color: assigned ? "#8e44ad" : "var(--bd)" }}>{assigned ? "✓" : "○"}</span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Sub: Loại CV phụ — CRUD */}
            {ewSubTab === "types" && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--tm)" }}>{extraWorkTypes.length} loại</span>
                  <button onClick={() => { setEwTypeDlg("new"); setEwTypeFm({ name: "", rate: "", unit: "công" }); }} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "#8e44ad", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.72rem" }}>+ Thêm loại</button>
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...ths, width: 36, textAlign: "center" }}>STT</th>
                      <th style={ths}>Tên</th>
                      <th style={{ ...ths, textAlign: "right" }}>Đơn giá</th>
                      <th style={ths}>Đơn vị</th>
                      <th style={{ ...ths, textAlign: "center" }}>NV gán</th>
                      <th style={{ ...ths, width: 60 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {extraWorkTypes.map((t, i) => (
                      <tr key={t.id}>
                        <td style={{ ...tds, textAlign: "center", fontSize: "0.68rem", color: "var(--tm)" }}>{i + 1}</td>
                        <td style={{ ...tds, fontWeight: 600 }}>{t.name}</td>
                        <td style={{ ...tds, textAlign: "right" }}>{fmtMoney(t.rate)}đ</td>
                        <td style={tds}>{t.unit}</td>
                        <td style={{ ...tds, textAlign: "center" }}>{ewAssignments.filter(a => a.extraWorkTypeId === t.id).length}</td>
                        <td style={{ ...tds, whiteSpace: "nowrap" }}>
                          <button onClick={() => { setEwTypeDlg(t.id); setEwTypeFm({ name: t.name, rate: String(t.rate), unit: t.unit }); }} style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--bd)", background: "transparent", color: "#8e44ad", cursor: "pointer", fontSize: "0.65rem" }}>Sửa</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}
          </div>
        );
      })()}

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
                <th style={{ ...ths, width: 36, textAlign: "center" }}>STT</th>
                <th style={ths}>Nhân viên</th>
                <th style={{ ...ths, textAlign: "right" }}>Số tiền</th>
                <th style={ths}>Ngày ứng</th>
                <th style={ths}>Trạng thái</th>
                <th style={ths}>Ghi chú</th>
                <th style={{ ...ths, width: 80 }} />
              </tr>
            </thead>
            <tbody>
              {advances.length === 0 && <tr><td colSpan={7} style={{ padding: 16, textAlign: "center", color: "var(--tm)", fontSize: "0.82rem" }}>Chưa có tạm ứng</td></tr>}
              {advances.map((a, i) => (
                <tr key={a.id}>
                  <td style={{ ...tds, textAlign: "center", fontSize: "0.68rem", color: "var(--tm)", width: 36 }}>{i + 1}</td>
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
      {!loading && tab === "bhxh" && (() => {
        const bhxhEmps = employees.filter(e => e.bhxhEnrolled && e.status !== "inactive");
        const bhxhMap = {};
        bhxhMonthly.forEach(b => { bhxhMap[b.employeeId] = b; });
        const activeCount = bhxhEmps.filter(e => { const b = bhxhMap[e.id]; return b ? b.isActive : true; }).length;
        const totalAmount = bhxhEmps.reduce((s, e) => { const b = bhxhMap[e.id]; const active = b ? b.isActive : true; return s + (active ? (b?.amount || e.bhxhAmount || 0) : 0); }, 0);
        return (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ fontSize: "0.78rem", display: "flex", gap: 16 }}>
                <span>NV đóng BHXH: <strong>{activeCount}</strong>/{bhxhEmps.length}</span>
                <span>Tổng khấu trừ: <strong style={{ color: "#e74c3c" }}>{fmtMoney(totalAmount)}đ</strong></span>
              </div>
              <button onClick={async () => {
                if (useAPI) {
                  const api = await import("../api.js");
                  const r = await api.generateBhxhMonthly(period, employees);
                  if (r?.error) notify("Lỗi: " + r.error, false);
                  else { notify(`Đã tạo BHXH tháng ${m}/${y} cho ${r.count} NV`); api.fetchBhxhMonthly(period).then(setBhxhMonthly); }
                }
              }} style={{ padding: "6px 12px", borderRadius: 6, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.72rem" }}>Tạo từ hồ sơ NV</button>
            </div>
            <div style={{ overflowX: "auto", maxHeight: "calc(80vh - 200px)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                  <tr>
                    <th style={{ ...ths, width: 36, textAlign: "center" }}>STT</th>
                    <th style={ths}>Mã NV</th>
                    <th style={ths}>Họ tên</th>
                    <th style={ths}>Bộ phận</th>
                    <th style={{ ...ths, textAlign: "center" }}>Đóng</th>
                    <th style={{ ...ths, textAlign: "right" }}>Khấu trừ</th>
                    <th style={ths}>Ghi chú</th>
                  </tr>
                </thead>
                <tbody>
                  {bhxhEmps.map((e, i) => {
                    const rec = bhxhMap[e.id];
                    const isActive = rec ? rec.isActive : true;
                    const amt = rec?.amount || e.bhxhAmount || 0;
                    return (
                      <tr key={e.id} style={{ opacity: isActive ? 1 : 0.5 }}>
                        <td style={{ ...tds, textAlign: "center", fontSize: "0.68rem", color: "var(--tm)" }}>{i + 1}</td>
                        <td style={{ ...tds, fontFamily: "monospace", fontWeight: 600 }}>{e.code}</td>
                        <td style={{ ...tds, fontWeight: 600 }}>{e.fullName}</td>
                        <td style={tds}>{deptName(e.departmentId)}</td>
                        <td style={{ ...tds, textAlign: "center" }}>
                          <input type="checkbox" checked={isActive} onChange={ev => {
                            const newActive = ev.target.checked;
                            setBhxhMonthly(prev => {
                              const idx = prev.findIndex(b => b.employeeId === e.id);
                              if (idx >= 0) return prev.map((b, j) => j === idx ? { ...b, isActive: newActive } : b);
                              return [...prev, { id: "tmp_" + Date.now(), employeeId: e.id, period, isActive: newActive, amount: amt, note: "" }];
                            });
                            if (useAPI) import("../api.js").then(api => api.upsertBhxhMonthly(e.id, period, newActive, amt, rec?.note || ""));
                          }} />
                        </td>
                        <td style={{ ...tds, textAlign: "right", padding: "2px 4px" }}>
                          <input value={amt || ""} onChange={ev => {
                            const val = Number(ev.target.value.replace(/[^0-9]/g, "")) || 0;
                            setBhxhMonthly(prev => {
                              const idx = prev.findIndex(b => b.employeeId === e.id);
                              if (idx >= 0) return prev.map((b, j) => j === idx ? { ...b, amount: val } : b);
                              return [...prev, { id: "tmp_" + Date.now(), employeeId: e.id, period, isActive, amount: val, note: "" }];
                            });
                          }} onBlur={() => {
                            const cur = bhxhMonthly.find(b => b.employeeId === e.id);
                            if (useAPI) import("../api.js").then(api => api.upsertBhxhMonthly(e.id, period, cur?.isActive ?? true, cur?.amount || 0, cur?.note || ""));
                          }} style={{ width: 100, padding: "4px 6px", borderRadius: 5, border: "1px solid var(--bd)", fontSize: "0.75rem", textAlign: "right", background: "var(--bg)", color: "var(--tp)", outline: "none" }} />
                          {amt > 0 && <div style={{ fontSize: "0.6rem", color: "var(--tm)" }}>{fmtMoney(amt)}đ</div>}
                        </td>
                        <td style={{ ...tds, padding: "2px 4px" }}>
                          <input value={rec?.note || ""} onChange={ev => {
                            setBhxhMonthly(prev => prev.map(b => b.employeeId === e.id ? { ...b, note: ev.target.value } : b));
                          }} onBlur={() => {
                            const cur = bhxhMonthly.find(b => b.employeeId === e.id);
                            if (useAPI && cur) import("../api.js").then(api => api.upsertBhxhMonthly(e.id, period, cur.isActive, cur.amount, cur.note || ""));
                          }} style={{ width: "100%", padding: "4px 6px", borderRadius: 5, border: "1px solid var(--bd)", fontSize: "0.72rem", background: "var(--bg)", color: "var(--tp)", outline: "none" }} placeholder="Ghi chú" />
                        </td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: "var(--bgh)" }}>
                    <td colSpan={4} style={{ ...tds, fontWeight: 700 }}>TỔNG ({activeCount} NV đóng)</td>
                    <td style={tds} />
                    <td style={{ ...tds, textAlign: "right", fontWeight: 800, color: "#e74c3c" }}>{fmtMoney(totalAmount)}</td>
                    <td style={tds} />
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        );
      })()}

      {/* ═══ Advance Dialog ═══ */}
      {advDlg && (
        <Dialog open onClose={() => setAdvDlg(null)} onOk={saveAdvance} title={advDlg === "new" ? "Thêm tạm ứng" : "Sửa tạm ứng"} width={400}>
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
        <Dialog open onClose={() => setDeductDlg(null)} onOk={saveOtherDeduction} title={`Khấu trừ khác — ${deductDlg.employeeName}`} width={380}>
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

      {/* ═══ Extra Work Type CRUD Dialog ═══ */}
      {ewTypeDlg && (
        <Dialog open onClose={() => setEwTypeDlg(null)} onOk={async () => {
          if (!ewTypeFm.name.trim()) return;
          const api = await import("../api.js");
          if (ewTypeDlg === "new") {
            const r = await api.addExtraWorkType(ewTypeFm.name.trim(), Number(ewTypeFm.rate) || 0, ewTypeFm.unit || "công");
            if (r?.error) { notify("Lỗi: " + r.error, false); return; }
            setExtraWorkTypes(p => [...p, { id: r.id, name: ewTypeFm.name.trim(), rate: Number(ewTypeFm.rate) || 0, unit: ewTypeFm.unit || "công", isActive: true }]);
          } else {
            const r = await api.updateExtraWorkType(ewTypeDlg, ewTypeFm.name.trim(), Number(ewTypeFm.rate) || 0, ewTypeFm.unit || "công", true);
            if (r?.error) { notify("Lỗi: " + r.error, false); return; }
            setExtraWorkTypes(p => p.map(t => t.id === ewTypeDlg ? { ...t, name: ewTypeFm.name.trim(), rate: Number(ewTypeFm.rate) || 0, unit: ewTypeFm.unit || "công" } : t));
          }
          notify(ewTypeDlg === "new" ? "Đã thêm" : "Đã cập nhật"); setEwTypeDlg(null);
        }} title={ewTypeDlg === "new" ? "Thêm loại CV phụ" : "Sửa loại CV phụ"} width={380}>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Tên công việc</label>
            <input value={ewTypeFm.name} onChange={e => setEwTypeFm(p => ({ ...p, name: e.target.value }))} style={inputSt} placeholder="VD: Dọn vệ sinh" />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelSt}>Đơn giá (đ)</label>
              <input value={ewTypeFm.rate} onChange={e => setEwTypeFm(p => ({ ...p, rate: e.target.value.replace(/[^0-9]/g, "") }))} style={{ ...inputSt, textAlign: "right" }} placeholder="80000" />
              {ewTypeFm.rate && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 2 }}>{fmtMoney(ewTypeFm.rate)}đ</div>}
            </div>
            <div>
              <label style={labelSt}>Đơn vị</label>
              <input value={ewTypeFm.unit} onChange={e => setEwTypeFm(p => ({ ...p, unit: e.target.value }))} style={inputSt} placeholder="công" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setEwTypeDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={async () => {
              if (!ewTypeFm.name.trim()) return;
              const api = await import("../api.js");
              if (ewTypeDlg === "new") {
                const r = await api.addExtraWorkType(ewTypeFm.name.trim(), Number(ewTypeFm.rate) || 0, ewTypeFm.unit || "công");
                if (r?.error) { notify("Lỗi: " + r.error, false); return; }
                setExtraWorkTypes(p => [...p, { id: r.id, name: ewTypeFm.name.trim(), rate: Number(ewTypeFm.rate) || 0, unit: ewTypeFm.unit || "công", isActive: true }]);
                notify("Đã thêm");
              } else {
                const r = await api.updateExtraWorkType(ewTypeDlg, ewTypeFm.name.trim(), Number(ewTypeFm.rate) || 0, ewTypeFm.unit || "công", true);
                if (r?.error) { notify("Lỗi: " + r.error, false); return; }
                setExtraWorkTypes(p => p.map(t => t.id === ewTypeDlg ? { ...t, name: ewTypeFm.name.trim(), rate: Number(ewTypeFm.rate) || 0, unit: ewTypeFm.unit || "công" } : t));
                notify("Đã cập nhật");
              }
              setEwTypeDlg(null);
            }} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "#8e44ad", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
          </div>
        </Dialog>
      )}

      {/* ═══ Commission Detail Dialog ═══ */}
      {commDetailDlg && (() => {
        const { emp, data } = commDetailDlg;
        if (!data) return null;
        const thC = { padding: "5px 6px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", whiteSpace: "nowrap" };
        const tdC = { padding: "4px 6px", fontSize: "0.72rem", borderBottom: "1px solid var(--bd)" };
        const totalVolume = data.bundleDetails.reduce((s, d) => s + d.volume, 0);
        const totalPoints = data.bundleDetails.reduce((s, d) => s + d.points, 0);
        return (
          <Dialog open onClose={() => setCommDetailDlg(null)} title={`Hoa hồng — ${emp?.code} ${emp?.fullName}`} width={Math.min(750, window.innerWidth - 60)} noEnter>
            {/* Tổng kết */}
            <div style={{ padding: 10, background: "var(--bgs)", borderRadius: 6, marginBottom: 12, fontSize: "0.78rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Vai trò: <strong>{data.isManager ? "Quản lý" : "NVBH"}</strong> — Rate: <strong style={{ color: "var(--ac)" }}>{fmtMoney(data.rate)}đ/điểm</strong></span>
                <span style={{ fontWeight: 800, color: "#2980b9", fontSize: "0.88rem" }}>Tổng: {fmtMoney(data.totalCommission)}đ</span>
              </div>
              <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: "0.72rem", color: "var(--ts)" }}>
                <span>Điểm tự bán: <strong>{data.points}</strong> × {fmtMoney(data.rate)} = <strong>{fmtMoney(data.pointsAmount)}</strong></span>
                {data.containerAmount > 0 && <span>Container: <strong>{fmtMoney(data.containerAmount)}</strong></span>}
                {data.managerTeamAmount > 0 && <span>Điểm team: <strong>{fmtMoney(data.managerTeamAmount)}</strong></span>}
              </div>
            </div>

            {/* Chi tiết đơn hàng */}
            {data.bundleDetails.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ac)", marginBottom: 4 }}>CHI TIẾT ĐƠN HÀNG</div>
                <div style={{ maxHeight: 250, overflowY: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead style={{ position: "sticky", top: 0 }}>
                      <tr>
                        <th style={{ ...thC, width: 30, textAlign: "center" }}>STT</th>
                        <th style={thC}>Đơn hàng</th>
                        <th style={thC}>Loại gỗ</th>
                        <th style={{ ...thC, textAlign: "right" }}>m³</th>
                        <th style={{ ...thC, textAlign: "center" }}>Hệ số</th>
                        <th style={{ ...thC, textAlign: "right" }}>Điểm</th>
                        <th style={thC}>Ghi chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.bundleDetails.map((d, i) => (
                        <tr key={i}>
                          <td style={{ ...tdC, textAlign: "center", fontSize: "0.65rem", color: "var(--tm)" }}>{i + 1}</td>
                          <td style={{ ...tdC, fontFamily: "monospace", fontSize: "0.68rem" }}>{d.orderCode}</td>
                          <td style={{ ...tdC, fontWeight: 600 }}>{d.woodName}</td>
                          <td style={{ ...tdC, textAlign: "right" }}>{d.volume}</td>
                          <td style={{ ...tdC, textAlign: "center", fontWeight: 700, color: d.isOverride ? "var(--ac)" : "var(--ts)" }}>{d.coefficient}</td>
                          <td style={{ ...tdC, textAlign: "right", fontWeight: 600 }}>{d.points}</td>
                          <td style={{ ...tdC, fontSize: "0.65rem", color: d.isOverride ? "var(--ac)" : "var(--tm)" }}>{d.isOverride ? `★ ${d.overrideNote}` : ""}</td>
                        </tr>
                      ))}
                      <tr style={{ background: "var(--bgh)" }}>
                        <td colSpan={3} style={{ ...tdC, fontWeight: 700 }}>Tổng</td>
                        <td style={{ ...tdC, textAlign: "right", fontWeight: 700 }}>{Math.round(totalVolume * 10000) / 10000}</td>
                        <td style={tdC} />
                        <td style={{ ...tdC, textAlign: "right", fontWeight: 800, color: "var(--ac)" }}>{Math.round(totalPoints * 100) / 100}</td>
                        <td style={tdC} />
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Container */}
            {data.containerDetails.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ac)", marginBottom: 4 }}>CONTAINER</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...thC, width: 30, textAlign: "center" }}>STT</th>
                      <th style={thC}>Đơn hàng</th>
                      <th style={thC}>Chênh lệch/m³</th>
                      <th style={thC}>Mốc áp dụng</th>
                      <th style={{ ...thC, textAlign: "right" }}>Hoa hồng</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.containerDetails.map((d, i) => (
                      <tr key={i}>
                        <td style={{ ...tdC, textAlign: "center", fontSize: "0.65rem", color: "var(--tm)" }}>{i + 1}</td>
                        <td style={{ ...tdC, fontFamily: "monospace", fontSize: "0.68rem" }}>{d.orderCode}</td>
                        <td style={tdC}>{d.diff === 0 ? "Đúng giá" : `${fmtMoney(d.diff)} đ/m³`}</td>
                        <td style={tdC}>{d.tier}</td>
                        <td style={{ ...tdC, textAlign: "right", fontWeight: 700 }}>{fmtMoney(d.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Team breakdown (QL) */}
            {data.teamBreakdown.length > 0 && (
              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ac)", marginBottom: 4 }}>ĐIỂM TEAM (Quản lý nhận)</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...thC, width: 30, textAlign: "center" }}>STT</th>
                      <th style={thC}>Nhân viên</th>
                      <th style={{ ...thC, textAlign: "right" }}>Điểm</th>
                      <th style={{ ...thC, textAlign: "right" }}>Rate</th>
                      <th style={{ ...thC, textAlign: "right" }}>HH QL nhận</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.teamBreakdown.map((t, i) => (
                      <tr key={i}>
                        <td style={{ ...tdC, textAlign: "center", fontSize: "0.65rem", color: "var(--tm)" }}>{i + 1}</td>
                        <td style={{ ...tdC, fontWeight: 600 }}><span style={{ fontFamily: "monospace", marginRight: 4 }}>{t.empCode}</span>{t.empName}</td>
                        <td style={{ ...tdC, textAlign: "right" }}>{t.points}</td>
                        <td style={{ ...tdC, textAlign: "right" }}>{fmtMoney(t.rate)}</td>
                        <td style={{ ...tdC, textAlign: "right", fontWeight: 700 }}>{fmtMoney(t.amount)}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "var(--bgh)" }}>
                      <td colSpan={2} style={{ ...tdC, fontWeight: 700 }}>Tổng team</td>
                      <td style={{ ...tdC, textAlign: "right", fontWeight: 700 }}>{data.teamBreakdown.reduce((s, t) => s + t.points, 0)}</td>
                      <td style={tdC} />
                      <td style={{ ...tdC, textAlign: "right", fontWeight: 800, color: "#2980b9" }}>{fmtMoney(data.managerTeamAmount)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setCommDetailDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Đóng</button>
            </div>
          </Dialog>
        );
      })()}

      {/* ═══ Quick View Dialog — Lịch sử lương & phụ cấp ═══ */}
      {quickViewDlg && (() => {
        const { emp, history, allowances: empAl, loading: qvLoading } = quickViewDlg;
        const deptN = departments.find(d => d.id === emp.departmentId)?.name || "—";
        const SALARY_TYPE_LABELS = { monthly: "Lương tháng", daily: "Lương ngày" };
        const CHANGE_LABELS = { salary: "Lương", allowance: "Phụ cấp", bhxh: "BHXH", position: "Chức vụ", department: "Bộ phận", status: "Tr��ng thái", probation_rate: "Thử việc", other: "Khác" };
        const CHANGE_COLORS = { salary: "#e67e22", allowance: "#8e44ad", bhxh: "#e74c3c", position: "#3498db", department: "#27ae60", status: "#f39c12" };
        const recentHistory = history.slice(0, 10);
        return (
          <Dialog open onClose={() => setQuickViewDlg(null)} title={`${emp.code} — ${emp.fullName}`} width={580} noEnter>
            {qvLoading && <div style={{ padding: 16, textAlign: "center", color: "var(--tm)" }}>Đang tải...</div>}
            {!qvLoading && (
              <>
                {/* Thông tin lương */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14, padding: 10, background: "var(--bgs)", borderRadius: 6, fontSize: "0.75rem" }}>
                  <div><span style={{ color: "var(--tm)" }}>Bộ phận:</span> <strong>{deptN}</strong></div>
                  <div><span style={{ color: "var(--tm)" }}>Loại:</span> <strong>{SALARY_TYPE_LABELS[emp.salaryType]}</strong></div>
                  <div><span style={{ color: "var(--tm)" }}>Lương CB:</span> <strong style={{ color: "var(--ac)" }}>{fmtMoney(emp.baseSalary)}đ</strong></div>
                  <div><span style={{ color: "var(--tm)" }}>Loại NV:</span> {emp.employeeType === "collaborator" ? "CTV" : "Chính thức"}</div>
                  <div><span style={{ color: "var(--tm)" }}>Trạng thái:</span> {emp.status === "active" ? "Đang làm" : emp.status === "probation" ? `Thử việc (${Math.round((emp.probationRate || 0.85) * 100)}%)` : "Nghỉ"}</div>
                  {emp.bhxhEnrolled && <div><span style={{ color: "var(--tm)" }}>BHXH:</span> <strong style={{ color: "#e74c3c" }}>{fmtMoney(emp.bhxhAmount)}đ</strong></div>}
                </div>

                {/* Phụ cấp hi��n tại */}
                <div style={{ marginBottom: 14 }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ac)", marginBottom: 6 }}>PHỤ CẤP HIỆN TẠI</div>
                  {empAl.length === 0 && <div style={{ fontSize: "0.75rem", color: "var(--tm)" }}>Chưa có phụ cấp</div>}
                  {empAl.length > 0 && (
                    <table style={{ width: "100%", borderCollapse: "collapse" }}>
                      <thead>
                        <tr>
                          <th style={{ ...ths, fontSize: "0.6rem" }}>Loại</th>
                          <th style={{ ...ths, fontSize: "0.6rem", textAlign: "right" }}>Số tiền</th>
                          <th style={{ ...ths, fontSize: "0.6rem", textAlign: "center" }}>Cách tính</th>
                          <th style={{ ...ths, fontSize: "0.6rem", textAlign: "center" }}>Áp dụng từ</th>
                        </tr>
                      </thead>
                      <tbody>
                        {empAl.map(a => {
                          const at = allowanceTypes.find(t => t.id === a.allowanceTypeId);
                          return (
                            <tr key={a.id}>
                              <td style={{ ...tds, fontSize: "0.72rem", fontWeight: 600 }}>{at?.name || "—"}</td>
                              <td style={{ ...tds, fontSize: "0.72rem", textAlign: "right" }}>{fmtMoney(a.amount)}</td>
                              <td style={{ ...tds, fontSize: "0.65rem", textAlign: "center" }}>
                                <span style={{ padding: "1px 5px", borderRadius: 3, fontSize: "0.58rem", fontWeight: 600, background: at?.calcMode === "per_day" ? "#8e44ad22" : at?.calcMode === "prorated" ? "#f39c1222" : "var(--bgs)", color: at?.calcMode === "per_day" ? "#8e44ad" : at?.calcMode === "prorated" ? "#f39c12" : "var(--ts)" }}>
                                  {at?.calcMode === "per_day" ? "×ngày" : at?.calcMode === "prorated" ? "Mốc" : "Cố định"}
                                </span>
                              </td>
                              <td style={{ ...tds, fontSize: "0.68rem", textAlign: "center", color: "var(--tm)" }}>{a.effectiveDate ? fmtDate(a.effectiveDate) : "—"}</td>
                            </tr>
                          );
                        })}
                        <tr style={{ background: "var(--bgh)" }}>
                          <td style={{ ...tds, fontWeight: 700 }}>Tổng</td>
                          <td style={{ ...tds, textAlign: "right", fontWeight: 700 }}>{fmtMoney(empAl.reduce((s, a) => s + a.amount, 0))}</td>
                          <td colSpan={2} style={tds} />
                        </tr>
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Lịch sử thay đổi gần nhất */}
                <div>
                  <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ac)", marginBottom: 6 }}>LỊCH SỬ THAY ĐỔI GẦN NHẤT</div>
                  {recentHistory.length === 0 && <div style={{ fontSize: "0.75rem", color: "var(--tm)" }}>Chưa có lịch sử</div>}
                  {recentHistory.map(h => (
                    <div key={h.id} style={{ padding: "5px 0", borderBottom: "1px solid var(--bd)", fontSize: "0.72rem" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span>
                          <span style={{ display: "inline-block", padding: "1px 5px", borderRadius: 3, fontSize: "0.58rem", fontWeight: 600, background: (CHANGE_COLORS[h.changeType] || "var(--tm)") + "22", color: CHANGE_COLORS[h.changeType] || "var(--tm)", marginRight: 4 }}>{CHANGE_LABELS[h.changeType] || h.changeType}</span>
                          <strong>{h.fieldName}</strong>
                        </span>
                        <span style={{ fontSize: "0.62rem", color: "var(--tm)" }}>{fmtDate(h.effectiveDate || h.createdAt)}</span>
                      </div>
                      {h.oldValue && <div style={{ fontSize: "0.68rem", color: "var(--tm)", marginTop: 1 }}>{h.oldValue} → <strong style={{ color: "var(--tp)" }}>{h.newValue}</strong></div>}
                      {h.reason && <div style={{ fontSize: "0.62rem", color: "var(--tm)", fontStyle: "italic" }}>{h.reason}</div>}
                    </div>
                  ))}
                </div>
              </>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setQuickViewDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Đóng</button>
            </div>
          </Dialog>
        );
      })()}

      {/* ═══ Print template (hidden) ═══ */}
      <div ref={printRef} style={{ display: "none" }}>
        {printEmp && (() => {
          const creatorName = user?.label || user?.username || "";
          return (
            <div>
              {/* Header */}
              <div style={{ marginBottom: 16 }}>
                <h2 style={{ margin: "0 0 4px", fontSize: "16px", textAlign: "left" }}>CÔNG TY GỖ TINH HOA</h2>
                <h3 style={{ margin: "0", fontSize: "14px", textAlign: "left" }}>PHIẾU LƯƠNG THÁNG {m}/{y}</h3>
              </div>
              <table>
                <tbody>
                  <tr><td style={{ width: "30%" }}>Mã nhân viên</td><td className="b">{printEmp.employeeCode}</td></tr>
                  <tr><td>Họ tên</td><td className="b">{printEmp.employeeName}</td></tr>
                  <tr><td>Bộ phận</td><td>{printEmp.departmentName}</td></tr>
                  <tr><td>Loại lương</td><td>{printEmp.salaryType === "monthly" ? "Lương tháng" : "Lương ngày"}</td></tr>
                </tbody>
              </table>
              <h3>THỐNG KÊ CHẤM CÔNG</h3>
              <table>
                <tbody>
                  <tr><td>Tổng công</td><td className="r b">{printEmp.workDays}</td></tr>
                  {printEmp.leaveDays > 0 && <tr><td>Nghỉ có phép</td><td className="r">{printEmp.leaveDays} ngày</td></tr>}
                  {printEmp.absentNoPermission > 0 && <tr><td>Nghỉ không phép</td><td className="r" style={{ color: "#c0392b" }}>{printEmp.absentNoPermission} ngày</td></tr>}
                  {printEmp.lateTimes > 0 && <tr><td>Đi muộn</td><td className="r">{printEmp.lateTimes} lần</td></tr>}
                  {printEmp.forgotClockTimes > 0 && <tr><td>Quên chấm công</td><td className="r">{printEmp.forgotClockTimes} lần</td></tr>}
                </tbody>
              </table>
              <h3>THU NHẬP</h3>
              <table>
                <thead><tr><th>Khoản mục</th><th className="r" style={{ width: "30%" }}>Số tiền (đ)</th></tr></thead>
                <tbody>
                  <tr><td>Lương cơ bản ({printEmp.workDays} công / {printEmp.standardDays} chuẩn{printEmp.probationRate < 1 ? ` × ${Math.round(printEmp.probationRate * 100)}%` : ""})</td><td className="r">{fmtMoney(printEmp.baseAmount)}</td></tr>
                  {printEmp.otAmount > 0 && <tr><td>Tăng ca ({printEmp.otHours}h × {printEmp.otRate})</td><td className="r">{fmtMoney(printEmp.otAmount)}</td></tr>}
                  {(printEmp.allowanceDetail || []).map((a, i) => (
                    <tr key={i}><td>Phụ cấp: {a.name}{a.calcMode === "prorated" && a.prorateRate < 1 ? ` (${Math.round(a.prorateRate * 100)}% của ${fmtMoney(a.fullAmount)})` : ""}{a.calcMode === "per_day" ? ` (${fmtMoney(a.fullAmount)}/ngày × ${a.prorateRate} công)` : ""}</td><td className="r">{fmtMoney(a.amount)}</td></tr>
                  ))}
                  {printEmp.attendanceBonus > 0 && <tr><td>Thưởng chuyên cần</td><td className="r">{fmtMoney(printEmp.attendanceBonus)}</td></tr>}
                  {(printEmp.extraWorkDetail || []).map((e, i) => (
                    <tr key={'ew' + i}><td>CV phụ: {e.name} ({e.quantity} {e.unit} × {fmtMoney(e.rate)})</td><td className="r">{fmtMoney(e.amount)}</td></tr>
                  ))}
                  {printEmp.commission > 0 && <tr><td>Hoa hồng{printEmp.commissionDetail?.points ? ` (${printEmp.commissionDetail.points} điểm)` : ""}</td><td className="r">{fmtMoney(printEmp.commission)}</td></tr>}
                  <tr className="b"><td>Tổng thu nhập</td><td className="r">{fmtMoney(printEmp.baseAmount + printEmp.otAmount + printEmp.allowanceTotal + printEmp.attendanceBonus + (printEmp.extraWorkTotal || 0) + (printEmp.commission || 0))}</td></tr>
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
              {/* Mục xác nhận */}
              <div style={{ marginTop: 24, padding: "12px 16px", border: "1px solid #ccc", borderRadius: 6, fontSize: "12px", lineHeight: 1.6 }}>
                <p>Công ty xin gửi phiếu lương tháng {m}/{y}. Anh/Chị vui lòng kiểm tra và phản hồi với nhân sự phụ trách là <strong>{creatorName}</strong>.</p>
                <p>Thời hạn phản hồi: <strong>02 ngày</strong> kể từ ngày nhận thông báo này. Sau thời hạn trên, nếu không có phản hồi, bộ phận nhân sự sẽ ghi nhận Anh/Chị đồng ý với các thông tin trong phiếu lương.</p>
              </div>
              <div className="sig">
                <div><strong>Người lập</strong><br /><br /><br /><em>{creatorName}</em></div>
                <div><strong>Giám đốc</strong><br /><br /><br /></div>
                <div><strong>Người nhận</strong><br /><br /><br /><em>{printEmp.employeeName}</em></div>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}

export default React.memo(PgPayroll);
