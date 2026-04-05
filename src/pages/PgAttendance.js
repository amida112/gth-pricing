import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Dialog from "../components/Dialog";
import { calcWorkDay, getShiftForEmployee } from "../utils/attendance";
import { fmtMoney } from "../utils";

const STATUS_MAP = {
  present:  { label: "✓", color: "#27ae60", title: "Có mặt" },
  absent:   { label: "✕", color: "#e74c3c", title: "Vắng" },
  half_day: { label: "½", color: "#f39c12", title: "Nửa ngày" },
  leave:    { label: "P", color: "#3498db", title: "Phép" },
  holiday:  { label: "H", color: "#9b59b6", title: "Nghỉ lễ" },
};
const STATUS_CYCLE = ["present", "absent", "half_day", "leave", "holiday"];

// Màu cell theo work_value
function cellColor(wv) {
  if (wv >= 0.95) return "#27ae60";
  if (wv >= 0.8) return "#2ecc71";
  if (wv >= 0.5) return "#f39c12";
  if (wv > 0) return "#e67e22";
  return "#e74c3c";
}

export default function PgAttendance({ employees, departments, useAPI, notify, user, isAdmin }) {
  // Period selection
  const now = new Date();
  const [period, setPeriod] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [attendance, setAttendance] = useState([]); // flat array of attendance records
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({});
  const [shifts, setShifts] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);

  // Filter & view
  const [fDept, setFDept] = useState("");
  const [viewMode, setViewMode] = useState("work");

  // OT dialog
  const [otDlg, setOtDlg] = useState(null);

  // Campaign dialog
  const [campaignDlg, setCampaignDlg] = useState(false);
  const [extraCampaigns, setExtraCampaigns] = useState([]);

  // Leave dialog
  const [leaveDlg, setLeaveDlg] = useState(null);
  // Leave detail dialog (khi click ô thêm phép)
  const [leaveDetailDlg, setLeaveDetailDlg] = useState(null);
  const saveLeaveDetailRef = useRef(null);

  // Import dialog
  const [importDlg, setImportDlg] = useState(false);
  const [importData, setImportData] = useState(null);
  const [importConflicts, setImportConflicts] = useState([]);
  const [importUnmatched, setImportUnmatched] = useState([]);
  const [importMachineSummary, setImportMachineSummary] = useState({}); // empId → { machineWorkDays }
  const fileRef = useRef(null);

  // Batch day dialog (mất điện / nghỉ lễ)
  const [batchDlg, setBatchDlg] = useState(null); // { day, type, scope, workValue, selectedEmps }


  // Shift management dialog
  const [shiftDlg, setShiftDlg] = useState(null); // null | 'list' | shift object

  // Settings dialog
  const [settingsDlg, setSettingsDlg] = useState(false);
  const [settingsFm, setSettingsFm] = useState({});

  // ─── Derived ───
  const [year, month] = period.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Active employees only
  const activeEmps = useMemo(() => {
    let list = employees.filter(e => e.status !== "inactive");
    // Bỏ NV thuộc BP skip_attendance (thủ quỹ, mài cưa)
    list = list.filter(e => { const d = departments.find(d => d.id === e.departmentId); return !d?.skipAttendance; });
    if (fDept) list = list.filter(e => e.departmentId === fDept);
    return list.sort((a, b) => a.code.localeCompare(b.code));
  }, [employees, departments, fDept]);

  // Build lookup: empId+date → record
  const attMap = useMemo(() => {
    const m = {};
    attendance.forEach(a => { m[`${a.employeeId}_${a.date}`] = a; });
    return m;
  }, [attendance]);

  // ─── Load data ───
  useEffect(() => {
    if (!useAPI) return;
    setLoading(true);
    Promise.all([
      import("../api.js").then(api => api.fetchAttendance(period)),
      import("../api.js").then(api => api.fetchPayrollSettings()),
      import("../api.js").then(api => api.fetchWorkShifts()),
      import("../api.js").then(api => api.fetchCampaigns(period)),
      import("../api.js").then(api => api.fetchLeaveRequests(period)),
    ]).then(([attData, settData, shiftsData, campData, leaveData]) => {
      setAttendance(attData);
      setSettings(settData);
      if (shiftsData?.length) setShifts(shiftsData);
      setCampaigns(campData || []);
      setLeaveRequests(leaveData || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [useAPI, period]);

  // ─── Get setting value ───
  const getSetting = useCallback((key, fallback) => {
    const v = settings[key]?.value;
    if (v == null) return fallback;
    // value stored as JSON string — may be raw number or quoted string
    try { return typeof v === "string" ? JSON.parse(v) : v; } catch { return v; }
  }, [settings]);

  // ─── Kiểm tra đã import chưa ───
  const hasImportedData = attendance.length > 0;

  // ─── Detail dialog (right-click / click cell) ───
  const openOtDlg = useCallback((empId, day) => {
    const dateStr = `${period}-${String(day).padStart(2, "0")}`;
    const existing = attMap[`${empId}_${dateStr}`];
    const emp = employees.find(e => e.id === empId);
    const shift = emp ? getShiftForEmployee(emp, departments, shifts) : null;
    setOtDlg({
      employeeId: empId, empName: emp?.fullName || "", date: dateStr, day,
      checkIn: existing?.checkIn || "", checkOut: existing?.checkOut || "",
      otMinutes: String(existing?.otMinutes || ""),
      note: existing?.note || "",
      status: existing?.status || "present",
      workValue: existing?.workValue ?? "",
      flag: existing?.flag || "normal",
      adjustReason: existing?.adjustReason || "",
      isAdjusted: existing?.isAdjusted || false,
      shift,
    });
  }, [attMap, period, employees, departments, shifts]);

  const saveOt = () => {
    if (!otDlg) return;
    // Bắt buộc lý do khi điều chỉnh
    if (otDlg.flag !== "normal" && !otDlg.adjustReason?.trim()) {
      notify("Vui lòng nhập lý do điều chỉnh", false);
      return;
    }
    const ot = Number(otDlg.otMinutes) || 0;
    const dateStr = otDlg.date;
    const empId = otDlg.employeeId;
    const emp = employees.find(e => e.id === empId);

    // Recalc work_value if checkIn/checkOut provided
    let wv = Number(otDlg.workValue) || 0;
    let isLate = false, isEarlyLeave = false, lateMin = 0, earlyMin = 0;
    if (otDlg.checkIn && otDlg.checkOut && otDlg.shift) {
      const calc = calcWorkDay(otDlg.checkIn, otDlg.checkOut, otDlg.shift, emp?.lateGraceMinutes || 0);
      wv = calc.workValue;
      isLate = calc.isLate; isEarlyLeave = calc.isEarlyLeave;
      lateMin = calc.lateMinutes; earlyMin = calc.earlyMinutes;
    }

    // Determine status from work_value
    let status = otDlg.status;
    if (otDlg.checkIn && otDlg.checkOut) {
      status = wv >= 0.95 ? "present" : wv >= 0.4 ? "half_day" : "absent";
    }
    // Manual override
    if (otDlg.flag === "power_outage" || otDlg.flag === "adjusted") {
      wv = Number(otDlg.workValue) || 0;
      status = wv >= 0.95 ? "present" : wv >= 0.4 ? "half_day" : "absent";
    }

    const fields = {
      status, checkIn: otDlg.checkIn || null, checkOut: otDlg.checkOut || null,
      otMinutes: ot, workValue: wv, note: otDlg.note,
      flag: otDlg.flag, isLate, isEarlyLeave, lateMinutes: lateMin, earlyMinutes: earlyMin,
      isAdjusted: otDlg.flag !== "normal" || otDlg.isAdjusted,
      adjustReason: otDlg.adjustReason || null, adjustedBy: user?.username,
    };

    setAttendance(prev => {
      const idx = prev.findIndex(a => a.employeeId === empId && a.date === dateStr);
      const updated = { ...(prev[idx] || { id: "tmp_" + Date.now(), employeeId: empId, date: dateStr }), ...fields };
      if (idx >= 0) return prev.map((a, i) => i === idx ? updated : a);
      return [...prev, updated];
    });

    if (useAPI) {
      import("../api.js").then(api => api.upsertAttendance(empId, dateStr, fields).then(r => {
        if (r?.error) notify("Lỗi: " + r.error, false);
        else notify("Đã lưu");
      }));
    }
    setOtDlg(null);
  };

  // ─── Summary per employee ───
  // Lookup nghỉ phép
  const leaveMap = useMemo(() => {
    const m = {};
    leaveRequests.forEach(l => { if (l.status === "approved") m[`${l.employeeId}_${l.date}`] = l; });
    return m;
  }, [leaveRequests]);

  const empSummary = useCallback((empId) => {
    let workDays = 0, otMins = 0, absentDays = 0, leaveDays = 0, absentNoPermission = 0;
    let lateTimes = 0, earlyTimes = 0, forgotTimes = 0, totalLateMin = 0, sundayWorked = 0;
    const emp = employees.find(e => e.id === empId);
    const empDept = departments.find(d => d.id === emp?.departmentId);
    const empCampaign = campaigns.find(c => c.departmentId === emp?.departmentId);
    const campaignSundays = empCampaign?.activeSundays || [];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${period}-${String(d).padStart(2, "0")}`;
      const rec = attMap[`${empId}_${dateStr}`];
      const isSunday = new Date(year, month - 1, d).getDay() === 0;
      const hasLeave = !!leaveMap[`${empId}_${dateStr}`];

      if (rec) {
        workDays += rec.workValue ?? (rec.status === "present" ? 1 : rec.status === "half_day" ? 0.5 : 0);
        otMins += rec.otMinutes || 0;
        if (isSunday && rec.workValue > 0) sundayWorked++;
        if (rec.status === "absent" || rec.status === "leave") {
          if (hasLeave) { leaveDays++; }
          else if (isSunday && empDept?.sundayMode !== "campaign") { /* CN nghỉ mặc định — không tính vắng */ }
          else if (isSunday && empDept?.sundayMode === "campaign" && !campaignSundays.includes(d)) { /* CN này không nằm trong chiến dịch */ }
          else { absentDays++; absentNoPermission++; }
        }
        if (rec.isLate) { lateTimes++; totalLateMin += rec.lateMinutes || 0; }
        if (rec.isEarlyLeave) earlyTimes++;
        if (rec.flag === "forgot_clock" && !rec.isAdjusted) forgotTimes++;
      } else {
        // Không có record = không đi làm
        if (hasLeave) leaveDays++;
        else if (isSunday && empDept?.sundayMode !== "campaign") { /* CN nghỉ mặc định — ok */ }
        else if (isSunday && empDept?.sundayMode === "campaign" && !campaignSundays.includes(d)) { /* CN không nằm trong chiến dịch */ }
        else if (isSunday && empDept?.sundayMode === "not_applicable") { /* CTV — không áp dụng */ }
        // Ngày thường không có record + không có phép → không tính (chưa import CC)
      }
    }
    workDays = Math.round(workDays * 100) / 100;
    const bonus28 = Number(getSetting("attendance_bonus_28", 200000));
    const bonus30 = Number(getSetting("attendance_bonus_30", 500000));
    let bonus = 0;
    if (emp?.employeeType === "official" && empDept?.attendanceBonus) {
      if (workDays >= 30) bonus = bonus30;
      else if (workDays >= 28) bonus = bonus28;
    }
    return { workDays, otMins, absentDays, leaveDays, absentNoPermission, bonus, lateTimes, earlyTimes, forgotTimes, totalLateMin, sundayWorked };
  }, [daysInMonth, period, year, month, attMap, leaveMap, employees, departments, campaigns, getSetting]);

  // ─── Fill whole column (holiday/default) ───
  const fillColumn = useCallback((day, status) => {
    const dateStr = `${period}-${String(day).padStart(2, "0")}`;
    const updates = activeEmps.map(emp => ({
      employeeId: emp.id, date: dateStr, status, otMinutes: 0, note: "",
    }));
    // Optimistic
    setAttendance(prev => {
      const next = [...prev];
      updates.forEach(u => {
        const idx = next.findIndex(a => a.employeeId === u.employeeId && a.date === u.date);
        if (idx >= 0) next[idx] = { ...next[idx], status };
        else next.push({ id: "tmp_" + Date.now() + u.employeeId, ...u });
      });
      return next;
    });
    if (useAPI) {
      import("../api.js").then(api => api.upsertAttendanceBatch(updates.map(u => ({ ...u, source: "manual" }))).then(r => {
        if (r?.error) notify("Lỗi: " + r.error, false);
        else notify(`Đã đánh dấu ngày ${day} = ${STATUS_MAP[status].title} cho ${updates.length} NV`);
      }));
    }
  }, [period, activeEmps, useAPI, notify]);

  // ─── Batch day: mất điện / nghỉ lễ ───
  const openBatchDlg = (day) => {
    setBatchDlg({ day, type: "power_outage", scope: "full", workValue: "1", selectedEmps: activeEmps.map(e => e.id) });
  };

  const confirmBatch = () => {
    if (!batchDlg) return;
    const { day, type, scope, workValue: wvStr } = batchDlg;
    const dateStr = `${period}-${String(day).padStart(2, "0")}`;
    const wv = Number(wvStr) || 0;
    const flag = scope === "morning" ? "power_outage_morning" : scope === "afternoon" ? "power_outage_afternoon" : type;
    const statusVal = wv >= 0.95 ? "present" : wv >= 0.4 ? "half_day" : (type === "holiday" ? "holiday" : "absent");

    const selectedList = activeEmps.filter(e => batchDlg.selectedEmps?.includes(e.id));
    if (!selectedList.length) { notify("Chưa chọn NV nào", false); return; }
    const updates = selectedList.map(emp => ({
      employeeId: emp.id, date: dateStr, status: statusVal,
      workValue: wv, flag, otMinutes: 0, source: "manual",
      isAdjusted: true, adjustReason: scope === "morning" ? "Mất điện/lỗi máy buổi sáng" : scope === "afternoon" ? "Mất điện/lỗi máy buổi chiều" : type === "holiday" ? "Nghỉ lễ" : "Mất điện/lỗi máy cả ngày",
      adjustedBy: user?.username,
    }));

    // Nếu buổi sáng/chiều: merge với data hiện có (giữ công buổi còn lại)
    setAttendance(prev => {
      const next = [...prev];
      updates.forEach(u => {
        const idx = next.findIndex(a => a.employeeId === u.employeeId && a.date === u.date);
        if (idx >= 0) {
          const existing = next[idx];
          if (scope === "morning" && existing.checkIn) {
            // Giữ công buổi chiều, thêm công buổi sáng
            u.workValue = Math.min(1, (existing.workValue || 0) + wv);
            u.checkIn = existing.checkIn; u.checkOut = existing.checkOut;
          } else if (scope === "afternoon" && existing.checkIn) {
            // Giữ công buổi sáng, thêm công buổi chiều
            u.workValue = Math.min(1, (existing.workValue || 0) + wv);
            u.checkIn = existing.checkIn; u.checkOut = existing.checkOut;
          }
          u.status = u.workValue >= 0.95 ? "present" : u.workValue >= 0.4 ? "half_day" : "absent";
          next[idx] = { ...existing, ...u };
        } else {
          next.push({ id: "tmp_" + Date.now() + u.employeeId, ...u, note: "" });
        }
      });
      return next;
    });

    if (useAPI) {
      import("../api.js").then(api => api.upsertAttendanceBatch(updates).then(r => {
        if (r?.error) notify("Lỗi: " + r.error, false);
        else notify(`Đã đánh dấu ngày ${day}/${month}: ${scope === "morning" ? "mất buổi sáng" : scope === "afternoon" ? "mất buổi chiều" : type === "holiday" ? "nghỉ lễ" : "mất cả ngày"} — ${selectedList.length} NV`);
      }));
    }
    setBatchDlg(null);
  };

  // ─── Export Excel ───
  const exportExcel = async () => {
    try {
      const XLSX = await import("xlsx");
      const rows = [["STT", "Mã NV", "Họ tên", "Bộ phận", ...days.map(d => d), "Công", "OT (phút)", "Phép", "Vắng", "Muộn", "Thưởng CC"]];
      activeEmps.forEach((emp, i) => {
        const summary = empSummary(emp.id);
        const deptN = departments.find(d => d.id === emp.departmentId)?.name || "";
        const dayCells = days.map(d => {
          const dateStr = `${period}-${String(d).padStart(2, "0")}`;
          const rec = attMap[`${emp.id}_${dateStr}`];
          if (!rec) return "";
          return rec.workValue ?? (rec.status === "present" ? 1 : rec.status === "half_day" ? 0.5 : 0);
        });
        rows.push([i + 1, emp.code, emp.fullName, deptN, ...dayCells, summary.workDays, summary.otMins, summary.leaveDays, summary.absentDays, summary.lateTimes, summary.bonus]);
      });
      const ws = XLSX.utils.aoa_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, `T${month}-${year}`);
      XLSX.writeFile(wb, `Cham_cong_${period}.xlsx`);
      notify("Đã xuất file Excel");
    } catch (err) {
      notify("Lỗi xuất Excel: " + err.message, false);
    }
  };

  // ─── Import Excel ───
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1 });
      parseImportData(json);
    } catch (err) {
      notify("Lỗi đọc file: " + err.message, false);
    }
    e.target.value = "";
  };

  const parseImportData = (rows) => {
    if (rows.length < 5) { notify("File rỗng hoặc sai format", false); return; }

    // ── Detect format: máy chấm công GTH hoặc format đơn giản ──
    // GTH format: row 3 = header [STT, Phòng ban, Mã NV, Tên NV, "", 1..31, Giờ công,...]
    // row 4 = thứ trong tuần, rows 5+ = data (mỗi NV 2 dòng: Vào + Ra)
    const isGTHFormat = rows.some(r => String(r[4] || "").trim() === "Vào");

    if (isGTHFormat) {
      return parseGTHFormat(rows);
    }

    // Fallback: format đơn giản [Mã NV, Tên, 1, 2, ..., 31]
    const header = rows.find(r => r.some(h => String(h) === "1"));
    if (!header) { notify("Không nhận dạng được format file", false); return; }
    const dayColStart = header.findIndex(h => String(h) === "1");
    const parsed = [];
    const conflicts = [];
    const dataStart = rows.indexOf(header) + 1;
    for (let r = dataStart; r < rows.length; r++) {
      const row = rows[r];
      const codeRaw = String(row[0] || "").trim();
      if (!codeRaw) continue;
      const emp = matchEmployee(codeRaw);
      if (!emp) continue;
      for (let d = 0; d < daysInMonth; d++) {
        const cellVal = row[dayColStart + d];
        if (cellVal == null || cellVal === "") continue;
        const day = d + 1;
        const dateStr = `${period}-${String(day).padStart(2, "0")}`;
        const status = parseStatus(cellVal);
        checkConflict(emp, dateStr, day, status, conflicts);
        parsed.push({ employeeId: emp.id, date: dateStr, status, otMinutes: 0, source: "machine" });
      }
    }
    finishParse(parsed, conflicts);
  };

  // ── Parser cho format máy chấm công GTH ──
  // Cấu trúc: Col 0=STT, 1=Phòng ban, 2=Mã NV, 3=Tên, 4=Vào/Ra
  // Col 5..35 = Ngày 1..31 (giá trị: giờ "HH:MM" = có mặt, "V" = vắng, "" = vắng)
  // Col 36=Giờ công NT, 37=Giờ công CN, 38=Ngày công NT, 39=Ngày công CN
  // Col 40=Tăng ca NT, 41=Tăng ca CN, 42=Số V
  // Mỗi NV = 2 dòng: dòng "Vào" + dòng "Ra"
  const parseGTHFormat = (rows) => {
    const DAY_COL_START = 5; // Col F = ngày 1
    const parsed = [];
    const conflicts = [];
    const unmatchedCodes = [];
    const machineSummaryMap = {}; // empId → { machineWorkDays }

    for (let r = 0; r < rows.length; r++) {
      const row = rows[r];
      if (String(row[4] || "").trim() !== "Vào") continue; // chỉ xử lý dòng "Vào"

      const machineCode = String(row[2] || "").trim(); // Mã NV trên máy: "00023"
      const machineName = String(row[3] || "").replace(/\x00/g, "").trim(); // Clean null chars
      if (!machineCode) continue;

      const emp = matchEmployee(machineCode);
      // Lấy "Ngày công NT" từ col 38 + "Ngày công CN" từ col 39
      const machineWorkDaysNT = Number(row[38]) || 0;
      const machineWorkDaysCN = Number(row[39]) || 0;
      const machineWorkDays = Math.round((machineWorkDaysNT + machineWorkDaysCN) * 100) / 100;
      const machineDept = String(row[1] || "").replace(/^BỘ PHẬN\s*/i, "").trim();

      if (!emp) {
        unmatchedCodes.push({ code: machineCode, name: machineName, dept: machineDept, machineWorkDays });
        continue;
      }

      // Lưu machine summary để đối chiếu
      machineSummaryMap[emp.id] = { machineWorkDays, machineDept };

      // Dòng "Ra" ngay sau
      const raRow = (r + 1 < rows.length && String(rows[r + 1][4] || "").trim() === "Ra") ? rows[r + 1] : null;

      // Lấy ca làm việc cho NV
      const shift = getShiftForEmployee(emp, departments, shifts);
      const grace = emp.lateGraceMinutes || 0;

      // Parse từng ngày
      for (let d = 0; d < daysInMonth; d++) {
        const colIdx = DAY_COL_START + d;
        const day = d + 1;
        const dateStr = `${period}-${String(day).padStart(2, "0")}`;

        const vaoCell = String(row[colIdx] || "").trim();
        const raCell = raRow ? String(raRow[colIdx] || "").trim() : "";

        let status, checkIn = null, checkOut = null;
        let workValue = 0, isLate = false, isEarlyLeave = false, lateMinutes = 0, earlyMinutes = 0, flag = "normal";

        if (vaoCell === "V" || vaoCell === "") {
          const dow = new Date(year, month - 1, day).getDay();
          const empDept = departments.find(dd => dd.id === emp.departmentId);
          const empCampaign = campaigns.find(c => c.departmentId === emp.departmentId);
          const isCampaignSunday = dow === 0 && empDept?.sundayMode === "campaign" && (empCampaign?.activeSundays || []).includes(day);
          // CN: holiday nếu off_default hoặc campaign nhưng CN này không bắt buộc
          // CN campaign bắt buộc mà vắng → absent
          if (dow === 0 && !isCampaignSunday) status = "holiday";
          else status = "absent";
          // Nếu có leave request → để empSummary xử lý
          workValue = 0;
        } else if (vaoCell.match(/^\d{1,2}:\d{2}$/)) {
          checkIn = vaoCell;
          if (raCell.match(/^\d{1,2}:\d{2}$/)) checkOut = raCell;

          // Detect mất điện buổi sáng: chỉ có 1 lần quẹt, giờ ≥ 13:00 (giờ ra chiều)
          // Máy ghi vào ô "Vào" = 17:xx, ô "Ra" trống
          const [inH] = checkIn.split(":").map(Number);
          if (inH >= 13 && !checkOut) {
            // Chỉ có giờ ra chiều, mất giờ sáng → flag mất điện buổi sáng
            flag = "power_outage_morning";
            checkOut = checkIn; // giờ duy nhất thực ra là giờ ra
            checkIn = ""; // không có giờ vào thực
            workValue = 0.5; // tạm tính 0.5 (buổi chiều), cần kế toán review
          } else if (checkIn && checkOut && shift) {
            const calc = calcWorkDay(checkIn, checkOut, shift, grace);
            workValue = calc.workValue;
            isLate = calc.isLate; isEarlyLeave = calc.isEarlyLeave;
            lateMinutes = calc.lateMinutes; earlyMinutes = calc.earlyMinutes;
            flag = calc.flag;
          } else if (checkIn && !checkOut) {
            // Có giờ vào, không có giờ ra → quên CC hoặc mất điện buổi chiều
            flag = "forgot_clock";
            // Tính công buổi sáng từ giờ vào đến lunchStart
            if (shift) {
              const calc = calcWorkDay(checkIn, shift.lunchStart, shift, grace);
              workValue = calc.workValue;
            }
          }
          status = workValue >= 0.95 ? "present" : workValue >= 0.4 ? "half_day" : (checkIn ? "half_day" : "absent");
        } else {
          status = "absent";
        }

        checkConflict(emp, dateStr, day, status, conflicts);
        parsed.push({
          employeeId: emp.id, date: dateStr, status, checkIn, checkOut,
          workValue, isLate, isEarlyLeave, lateMinutes, earlyMinutes,
          flag, otMinutes: 0, source: "machine",
        });
      }

      // OT: không import từ máy CC (không đúng thực tế)
      // Kế toán nhập OT thủ công từ phiếu giấy quản lý → tab OT trong PgPayroll
    }

    setImportUnmatched(unmatchedCodes);
    setImportMachineSummary(machineSummaryMap);
    finishParse(parsed, conflicts);
  };

  // ── Helper: match employee by machine code ──
  // Ưu tiên match theo field machine_code trên hồ sơ NV, fallback đoán từ NV code
  const matchEmployee = (machineCode) => {
    // Match chính xác theo machine_code field
    const byMachine = employees.find(e => e.machineCode === machineCode);
    if (byMachine) return byMachine;
    // Fallback: đoán NV-023 từ 00023
    const code = machineCode.replace(/^0+/, "");
    const nvCode = "NV-" + code.padStart(3, "0");
    return employees.find(e =>
      e.code === nvCode ||
      e.code === machineCode ||
      e.code.replace(/^NV-0*/, "") === code
    );
  };

  const parseStatus = (cellVal) => {
    const cv = String(cellVal).trim().toUpperCase();
    if (cv === "V" || cv === "X" || cv === "✕" || cv === "0") return "absent";
    if (cv === "½" || cv === "0.5" || cv === "N") return "half_day";
    if (cv === "P") return "leave";
    if (cv === "H" || cv === "L") return "holiday";
    return "present";
  };

  const checkConflict = (emp, dateStr, day, status, conflicts) => {
    const existing = attMap[`${emp.id}_${dateStr}`];
    if (existing && existing.source === "manual" && existing.status !== status) {
      conflicts.push({ empCode: emp.code, empName: emp.fullName, date: dateStr, day, oldStatus: existing.status, newStatus: status });
    }
  };

  const finishParse = (parsed, conflicts) => {
    if (parsed.length === 0) { notify("Không tìm thấy dữ liệu hợp lệ trong file", false); return; }
    setImportData(parsed);
    setImportConflicts(conflicts);
    setImportDlg(true);
  };

  const confirmImport = () => {
    if (!importData) return;
    // Optimistic
    setAttendance(prev => {
      const next = [...prev];
      importData.forEach(u => {
        const idx = next.findIndex(a => a.employeeId === u.employeeId && a.date === u.date);
        if (idx >= 0) next[idx] = { ...next[idx], status: u.status, otMinutes: u.otMinutes, source: u.source };
        else next.push({ id: "tmp_" + Date.now() + Math.random(), ...u, note: "" });
      });
      return next;
    });
    if (useAPI) {
      import("../api.js").then(api => api.upsertAttendanceBatch(importData).then(r => {
        if (r?.error) notify("Lỗi import: " + r.error, false);
        else notify(`Đã import ${r.count} bản ghi chấm công`);
      }));
    }
    setImportDlg(false);
    setImportData(null);
  };

  // ─── Save settings ───
  const openSettingsDlg = () => {
    setSettingsFm({
      standard_work_days: getSetting("standard_work_days", 26),
      ot_rate: getSetting("ot_rate", 1.5),
      attendance_bonus_28: getSetting("attendance_bonus_28", 200000),
      attendance_bonus_30: getSetting("attendance_bonus_30", 500000),
    });
    setSettingsDlg(true);
  };

  const saveSettings = () => {
    if (useAPI) {
      import("../api.js").then(api => {
        Object.entries(settingsFm).forEach(([key, value]) => {
          api.savePayrollSetting(key, value, settings[key]?.description || "");
        });
      });
    }
    // Update local
    setSettings(prev => {
      const next = { ...prev };
      Object.entries(settingsFm).forEach(([key, value]) => {
        next[key] = { ...next[key], value: JSON.stringify(value) };
      });
      return next;
    });
    notify("Đã lưu cấu hình");
    setSettingsDlg(false);
  };

  // ─── Day of week helper ───
  const dayOfWeek = (day) => {
    const d = new Date(year, month - 1, day);
    return d.getDay(); // 0=Sun, 6=Sat
  };

  // ─── Styles ───
  const cellSt = { width: viewMode === "time" ? 44 : 28, height: 28, textAlign: "center", cursor: "pointer", fontSize: viewMode === "time" ? "0.6rem" : "0.7rem", fontWeight: 700, borderRadius: 4, border: "1px solid var(--bd)", transition: "all 0.12s", lineHeight: "28px", userSelect: "none" };
  const thSt = { padding: "4px 2px", textAlign: "center", fontSize: "0.6rem", fontWeight: 700, color: "var(--brl)", whiteSpace: "nowrap" };
  const inputSt = { width: "100%", padding: "8px 10px", borderRadius: 7, border: "1.5px solid var(--bd)", fontSize: "0.82rem", background: "var(--bg)", color: "var(--tp)", outline: "none", boxSizing: "border-box" };
  const labelSt = { fontSize: "0.72rem", fontWeight: 600, color: "var(--ts)", marginBottom: 3, display: "block" };

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800 }}>📅 Chấm công</h2>
          <span style={{ fontSize: "0.72rem", color: "var(--tm)" }}>Tháng {month}/{year} — {activeEmps.length} nhân viên</span>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
          {/* Period picker */}
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)} style={{ padding: "8px 14px", borderRadius: 8, border: "2px solid var(--ac)", fontSize: "0.88rem", fontWeight: 700, background: "var(--acbg)", color: "var(--ac)", outline: "none", cursor: "pointer" }} />
          {/* Dept filter */}
          <select value={fDept} onChange={e => setFDept(e.target.value)} style={{ padding: "6px 10px", borderRadius: 7, border: "1.5px solid var(--bd)", fontSize: "0.78rem", background: "var(--bg)", color: "var(--tp)", outline: "none" }}>
            <option value="">Tất cả BP</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={openSettingsDlg} style={{ padding: "7px 12px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}>⚙ Cấu hình</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFileSelect} />
          <button onClick={() => {
            setCampaignDlg(true);
            // Load campaigns cho 2 tháng tiếp theo
            if (useAPI) {
              const futures = [];
              for (let offset = 1; offset <= 2; offset++) {
                const d = new Date(year, month - 1 + offset, 1);
                futures.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
              }
              Promise.all(futures.map(p => import("../api.js").then(api => api.fetchCampaigns(p)))).then(results => {
                setExtraCampaigns(results.flat());
              }).catch(() => {});
            }
          }} style={{ padding: "7px 12px", borderRadius: 7, border: "1.5px solid var(--bd)", background: campaigns.some(c => c.isActive) ? "#e67e2222" : "transparent", color: campaigns.some(c => c.isActive) ? "#e67e22" : "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}>🏭 Chiến dịch{campaigns.filter(c => c.isActive).length > 0 ? ` (${campaigns.filter(c => c.isActive).length})` : ""}</button>
          <button onClick={() => setLeaveDlg({ employeeId: "", date: "", leaveType: "personal", note: "" })} style={{ padding: "7px 12px", borderRadius: 7, border: "1.5px solid var(--bd)", background: leaveRequests.length > 0 ? "#3498db22" : "transparent", color: leaveRequests.length > 0 ? "#3498db" : "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}>📋 Nghỉ phép{leaveRequests.length > 0 ? ` (${leaveRequests.length})` : ""}</button>
          <button onClick={() => setViewMode(v => v === "work" ? "time" : "work")} style={{ padding: "7px 12px", borderRadius: 7, border: "1.5px solid var(--bd)", background: viewMode === "time" ? "var(--ac)" : "transparent", color: viewMode === "time" ? "#fff" : "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }} title="Chuyển đổi hiển thị: số công ↔ giờ vào/ra">{viewMode === "work" ? "🕐 Xem giờ" : "📊 Xem công"}</button>
          <button onClick={() => setShiftDlg("list")} style={{ padding: "7px 12px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}>🔧 Ca làm việc</button>
          <button onClick={exportExcel} style={{ padding: "7px 12px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}>📤 Xuất Excel</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFileSelect} />
          <button onClick={() => fileRef.current?.click()} style={{ padding: "7px 12px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}>📥 Import Excel</button>
          {isAdmin && hasImportedData && (
            <button onClick={async () => {
              if (!window.confirm(`Xóa toàn bộ chấm công tháng ${month}/${year}?\n\nHành động này không thể hoàn tác.`)) return;
              if (!window.confirm("Xác nhận lần nữa — XÓA HẾT dữ liệu chấm công tháng này?")) return;
              if (useAPI) {
                const api = await import("../api.js");
                const r = await api.deleteAttendanceByPeriod(period);
                if (r?.error) notify("Lỗi: " + r.error, false);
                else { setAttendance([]); notify(`Đã xóa chấm công tháng ${month}/${year}`); }
              }
            }} style={{ padding: "7px 12px", borderRadius: 7, border: "1.5px solid #e74c3c", background: "transparent", color: "#e74c3c", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}>🗑 Xóa tháng</button>
          )}
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 12, marginBottom: 10, flexWrap: "wrap" }}>
        {Object.entries(STATUS_MAP).map(([k, v]) => (
          <span key={k} style={{ fontSize: "0.68rem", display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "inline-block", width: 18, height: 18, lineHeight: "18px", textAlign: "center", borderRadius: 3, background: v.color + "22", color: v.color, fontWeight: 700, fontSize: "0.65rem" }}>{v.label}</span>
            {v.title}
          </span>
        ))}
        <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #3498db", borderRadius: 3, verticalAlign: "middle", marginRight: 2 }} />
        <span style={{ fontSize: "0.68rem", marginRight: 8 }}>Đã điều chỉnh (mất điện/máy lỗi/xin sếp)</span>
        <span style={{ display: "inline-block", width: 14, height: 14, border: "2px solid #f39c12", borderRadius: 3, verticalAlign: "middle", marginRight: 2 }} />
        <span style={{ fontSize: "0.68rem", marginRight: 8 }}>Quên chấm công (chưa xử lý)</span>
        <span style={{ fontSize: "0.68rem", color: "var(--tm)" }}>| Double-click ô = điều chỉnh | Right-click số ngày = điều chỉnh hàng loạt</span>
      </div>

      {loading && <div style={{ padding: 24, textAlign: "center", color: "var(--tm)" }}>Đang tải...</div>}

      {/* Thống kê điều chỉnh */}
      {!loading && hasImportedData && (() => {
        const adjustedCount = attendance.filter(a => a.isAdjusted || (a.flag && a.flag !== "normal")).length;
        const needsFixCount = attendance.filter(a => a.flag === "forgot_clock" && !a.isAdjusted).length;
        return adjustedCount > 0 || needsFixCount > 0 ? (
          <div style={{ display: "flex", gap: 14, marginBottom: 8, fontSize: "0.72rem", padding: "6px 10px", background: "var(--bgs)", borderRadius: 6 }}>
            {adjustedCount > 0 && <span><span style={{ color: "#3498db", fontWeight: 700 }}>{adjustedCount}</span> ô đã điều chỉnh</span>}
            {needsFixCount > 0 && <span><span style={{ color: "#f39c12", fontWeight: 700 }}>{needsFixCount}</span> ô cần xử lý (quên CC)</span>}
          </div>
        ) : null;
      })()}

      {/* Guard: chưa import */}
      {!loading && !hasImportedData && (
        <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>
          <div style={{ fontSize: "1.2rem", marginBottom: 8 }}>📥</div>
          <div style={{ fontSize: "0.88rem", fontWeight: 600, marginBottom: 4 }}>Chưa có dữ liệu chấm công tháng {month}/{year}</div>
          <div style={{ fontSize: "0.78rem" }}>Bấm <strong>Import Excel</strong> để nhập từ file máy chấm công.</div>
        </div>
      )}

      {/* Grid */}
      {!loading && hasImportedData && (
        <div style={{ overflowX: "auto" }}>
          <table style={{ borderCollapse: "collapse" }}>
            <thead>
              {/* Day-of-week row */}
              <tr>
                <th style={{ ...thSt, minWidth: 60, textAlign: "left" }} />
                <th style={{ ...thSt, minWidth: 120, textAlign: "left" }} />
                {days.map(d => {
                  const dow = dayOfWeek(d);
                  const isSun = dow === 0;
                  return <th key={d} style={{ ...thSt, color: isSun ? "#e74c3c" : dow === 6 ? "#f39c12" : "var(--brl)" }}>{["CN", "T2", "T3", "T4", "T5", "T6", "T7"][dow]}</th>;
                })}
                <th style={{ ...thSt, minWidth: 38 }}>Công</th>
                <th style={{ ...thSt, minWidth: 35 }}>OT</th>
                <th style={{ ...thSt, minWidth: 30 }} title="Nghỉ có phép">Phép</th>
                <th style={{ ...thSt, minWidth: 30 }} title="Vắng không phép">Vắng</th>
                <th style={{ ...thSt, minWidth: 30 }}>Muộn</th>
                <th style={{ ...thSt, minWidth: 60 }}>Thưởng CC</th>
              </tr>
              {/* Day number + fill buttons */}
              <tr>
                <th style={{ ...thSt, textAlign: "left", fontSize: "0.65rem" }}>Mã</th>
                <th style={{ ...thSt, textAlign: "left", fontSize: "0.65rem" }}>Họ tên</th>
                {days.map(d => {
                  const dow = dayOfWeek(d);
                  const isSun = dow === 0;
                  return (
                    <th key={d} style={{ ...thSt, padding: "2px 0" }}>
                      <div style={{ cursor: "default", color: isSun ? "#e74c3c" : "var(--brl)" }} title={`Ngày ${d}${isSun ? " (CN)" : ""} — Right-click: đánh dấu mất điện/nghỉ lễ`} onContextMenu={e => { e.preventDefault(); openBatchDlg(d); }}>{d}</div>
                    </th>
                  );
                })}
                <th style={thSt} />
                <th style={thSt} />
                <th style={thSt} />
                <th style={thSt} />
                <th style={thSt} />
                <th style={thSt} />
              </tr>
            </thead>
            <tbody>
              {activeEmps.map(emp => {
                const summary = empSummary(emp.id);
                return (
                  <tr key={emp.id}>
                    <td style={{ padding: "4px 6px", fontSize: "0.68rem", fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap", borderBottom: "1px solid var(--bd)" }}>{emp.code}</td>
                    <td style={{ padding: "4px 6px", fontSize: "0.72rem", fontWeight: 600, whiteSpace: "nowrap", borderBottom: "1px solid var(--bd)", maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis" }} title={emp.fullName}>{emp.fullName}</td>
                    {days.map(d => {
                      const dateStr = `${period}-${String(d).padStart(2, "0")}`;
                      const rec = attMap[`${emp.id}_${dateStr}`];
                      const st = rec?.status;
                      const hasLeave = !!leaveMap[`${emp.id}_${dateStr}`];
                      // Override status nếu có phép
                      const effectiveSt = hasLeave && (st === "absent" || !st) ? "leave" : st;
                      const info = effectiveSt ? STATUS_MAP[effectiveSt] : null;
                      const wv = rec?.workValue ?? (effectiveSt === "present" ? 1 : effectiveSt === "half_day" ? 0.5 : 0);
                      const hasOt = (rec?.otMinutes || 0) > 0;
                      const isAdjusted = rec?.isAdjusted === true; // chỉ true khi kế toán đã xử lý thủ công
                      const needsFix = rec?.flag && rec.flag !== "normal" && !isAdjusted; // có flag nhưng chưa điều chỉnh
                      const hasData = rec && effectiveSt || hasLeave;
                      // Cell content
                      let cellContent;
                      if (viewMode === "time" && hasData) {
                        const ci = rec?.checkIn || "";
                        cellContent = ci ? ci.slice(0, 5) : (effectiveSt === "holiday" ? "H" : effectiveSt === "leave" ? "P" : "—");
                      } else {
                        cellContent = hasData
                          ? (effectiveSt === "holiday" ? "H" : effectiveSt === "leave" ? "P" : effectiveSt === "absent" && wv === 0 ? "✕" : wv >= 1 ? "1" : wv > 0 ? String(wv) : "✕")
                          : "·";
                      }
                      const clr = hasData ? (effectiveSt === "holiday" ? "#9b59b6" : effectiveSt === "leave" ? "#3498db" : cellColor(wv)) : "var(--tm)";
                      // Border: vàng nháy = cần xử lý, xanh dương = đã điều chỉnh, mặc định
                      const borderStyle = needsFix ? "2px solid #f39c12" : isAdjusted ? "2px solid #3498db" : "1px solid var(--bd)";
                      const bgStyle = isAdjusted ? (clr + "33") : (clr + "22");
                      return (
                        <td key={d} style={{ padding: "2px 1px", borderBottom: "1px solid var(--bd)" }}>
                          <div
                            style={{ ...cellSt, background: bgStyle, color: clr, position: "relative", border: borderStyle }}
                            title={`${emp.fullName} — ${d}/${month}: ${info?.title || "Chưa chấm"} | Công: ${wv}${rec?.checkIn ? ` | Vào: ${rec.checkIn}` : ""}${rec?.checkOut ? ` Ra: ${rec.checkOut}` : ""}${hasOt ? ` | OT: ${rec.otMinutes}p` : ""}${rec?.isLate ? ` | Muộn ${rec.lateMinutes}p` : ""}${isAdjusted ? ` | ✎ ${rec.adjustReason || rec.flag}` : ""}${needsFix ? " | ⚠ CẦN XỬ LÝ" : ""}`}
                            onDoubleClick={() => openOtDlg(emp.id, d)}
                            onContextMenu={e => { e.preventDefault(); openOtDlg(emp.id, d); }}
                          >
                            {cellContent}
                            {hasOt && <span style={{ position: "absolute", top: -2, right: -2, width: 6, height: 6, borderRadius: "50%", background: "#e67e22" }} />}
                            {isAdjusted && <span style={{ position: "absolute", bottom: -1, left: -1, fontSize: "0.45rem", color: "#3498db" }}>✎</span>}
                          </div>
                        </td>
                      );
                    })}
                    <td style={{ padding: "4px 4px", textAlign: "center", fontSize: "0.72rem", fontWeight: 700, borderBottom: "1px solid var(--bd)", color: "var(--ac)" }}>{summary.workDays}</td>
                    <td style={{ padding: "4px 4px", textAlign: "center", fontSize: "0.68rem", borderBottom: "1px solid var(--bd)", color: summary.otMins > 0 ? "#e67e22" : "var(--tm)" }}>{summary.otMins > 0 ? `${Math.floor(summary.otMins / 60)}h${summary.otMins % 60 > 0 ? summary.otMins % 60 + "p" : ""}` : "—"}</td>
                    <td style={{ padding: "4px 4px", textAlign: "center", fontSize: "0.68rem", borderBottom: "1px solid var(--bd)", color: summary.leaveDays > 0 ? "#3498db" : "var(--tm)" }}>{summary.leaveDays || "—"}</td>
                    <td style={{ padding: "4px 4px", textAlign: "center", fontSize: "0.68rem", borderBottom: "1px solid var(--bd)", color: summary.absentDays > 0 ? "#e74c3c" : "var(--tm)" }}>{summary.absentDays || "—"}</td>
                    <td style={{ padding: "4px 4px", textAlign: "center", fontSize: "0.68rem", borderBottom: "1px solid var(--bd)", color: summary.lateTimes > 0 ? "#e74c3c" : "var(--tm)" }}>{summary.lateTimes || "—"}</td>
                    <td style={{ padding: "4px 4px", textAlign: "right", fontSize: "0.68rem", fontWeight: 600, borderBottom: "1px solid var(--bd)", color: summary.bonus > 0 ? "#27ae60" : "var(--tm)", whiteSpace: "nowrap" }}>{summary.bonus > 0 ? fmtMoney(summary.bonus) : "—"}</td>
                  </tr>
                );
              })}
              {activeEmps.length === 0 && (
                <tr><td colSpan={days.length + 8} style={{ padding: 24, textAlign: "center", color: "var(--tm)", fontSize: "0.82rem" }}>Không có nhân viên</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ OT Dialog ═══ */}
      {otDlg && (() => {
        // Recalc preview khi đổi giờ
        let previewWv = otDlg.workValue;
        if (otDlg.checkIn && otDlg.checkOut && otDlg.shift) {
          const emp = employees.find(e => e.id === otDlg.employeeId);
          const calc = calcWorkDay(otDlg.checkIn, otDlg.checkOut, otDlg.shift, emp?.lateGraceMinutes || 0);
          previewWv = calc.workValue;
        }
        return (
          <Dialog open onClose={() => setOtDlg(null)} title={`${otDlg.empName} — Ngày ${otDlg.day}/${month}`} width={440} noEnter>
            {/* Giờ vào/ra */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelSt}>Giờ vào</label>
                <input type="time" value={otDlg.checkIn} onChange={e => setOtDlg(p => ({ ...p, checkIn: e.target.value }))} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Giờ ra</label>
                <input type="time" value={otDlg.checkOut} onChange={e => setOtDlg(p => ({ ...p, checkOut: e.target.value }))} style={inputSt} />
              </div>
              <div>
                <label style={labelSt}>Công tính được</label>
                <div style={{ padding: "8px 10px", fontSize: "1rem", fontWeight: 800, color: previewWv >= 0.95 ? "#27ae60" : previewWv >= 0.5 ? "#f39c12" : "#e74c3c" }}>{otDlg.checkIn && otDlg.checkOut ? previewWv : (otDlg.workValue || "—")}</div>
              </div>
            </div>
            {/* Status & Flag */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelSt}>Trạng thái</label>
                <select value={otDlg.status} onChange={e => setOtDlg(p => ({ ...p, status: e.target.value }))} style={inputSt}>
                  {Object.entries(STATUS_MAP).map(([k, v]) => <option key={k} value={k}>{v.title}</option>)}
                </select>
              </div>
              <div>
                <label style={labelSt}>Lý do điều chỉnh *</label>
                <select value={otDlg.flag} onChange={e => setOtDlg(p => ({ ...p, flag: e.target.value }))} style={inputSt}>
                  <option value="normal">— Không điều chỉnh —</option>
                  <option value="power_outage">Mất điện cả ngày</option>
                  <option value="power_outage_morning">Mất điện buổi sáng</option>
                  <option value="power_outage_afternoon">Mất điện buổi chiều</option>
                  <option value="forgot_clock">Quên chấm công (NV báo lại)</option>
                  <option value="machine_error">Máy chấm công lỗi</option>
                  <option value="adjusted">Xin sếp (đi muộn/về sớm có phép)</option>
                </select>
              </div>
            </div>
            {/* Khi điều chỉnh: nhập công + mô tả */}
            {otDlg.flag !== "normal" && (
              <div style={{ padding: 10, background: "#3498db11", borderRadius: 6, border: "1px solid #3498db44", marginBottom: 10 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10 }}>
                  <div>
                    <label style={labelSt}>Công điều chỉnh (0–1)</label>
                    <input value={otDlg.workValue} onChange={e => setOtDlg(p => ({ ...p, workValue: e.target.value }))} style={inputSt} placeholder="VD: 1 hoặc 0.5" />
                  </div>
                  <div>
                    <label style={labelSt}>Mô tả chi tiết *</label>
                    <input value={otDlg.adjustReason} onChange={e => setOtDlg(p => ({ ...p, adjustReason: e.target.value }))} style={{ ...inputSt, borderColor: (!otDlg.adjustReason?.trim() && otDlg.flag !== "normal") ? "#e74c3c" : "var(--bd)" }} placeholder="VD: Mất điện 8h-12h, NV báo lại có đi làm buổi sáng" />
                  </div>
                </div>
              </div>
            )}
            {/* OT */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={labelSt}>Phút tăng ca (OT)</label>
                <input value={otDlg.otMinutes} onChange={e => setOtDlg(p => ({ ...p, otMinutes: e.target.value.replace(/[^0-9]/g, "") }))} style={inputSt} placeholder="VD: 120" />
                {otDlg.otMinutes && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 2 }}>{Math.floor(Number(otDlg.otMinutes) / 60)}h{Number(otDlg.otMinutes) % 60 > 0 ? Number(otDlg.otMinutes) % 60 + "p" : ""} × {getSetting("ot_rate", 1.5)}</div>}
              </div>
              <div>
                <label style={labelSt}>Ghi chú</label>
                <input value={otDlg.note} onChange={e => setOtDlg(p => ({ ...p, note: e.target.value }))} style={inputSt} />
              </div>
            </div>
            {/* Ca làm việc info */}
            {otDlg.shift && (
              <div style={{ fontSize: "0.65rem", color: "var(--tm)", padding: "4px 0", borderTop: "1px solid var(--bd)", marginTop: 4 }}>
                Ca: {otDlg.shift.name} ({otDlg.shift.startTime}–{otDlg.shift.endTime}, nghỉ {otDlg.shift.lunchStart}–{otDlg.shift.lunchEnd})
              </div>
            )}
            {/* Footer */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setOtDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
              <button onClick={saveOt} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
            </div>
          </Dialog>
        );
      })()}

      {/* ═══ Import Preview Dialog ═══ */}
      {importDlg && (() => {
        // Tổng hợp theo NV
        const empSummaryMap = {};
        (importData || []).forEach(r => {
          if (!empSummaryMap[r.employeeId]) {
            const emp = employees.find(e => e.id === r.employeeId);
            const dept = departments.find(d => d.id === emp?.departmentId);
            const shift = emp ? getShiftForEmployee(emp, departments, shifts) : null;
            empSummaryMap[r.employeeId] = { id: emp?.id, code: emp?.code || "?", name: emp?.fullName || "?", dept: dept?.name || "—", shiftName: shift?.name?.replace("Ca ", "") || "—", daysWorked: 0, totalWorkValue: 0, lateTimes: 0, forgotTimes: 0, powerOutageTimes: 0, otMinutes: 0 };
          }
          const s = empSummaryMap[r.employeeId];
          if (r.status !== "absent" && r.status !== "holiday") s.daysWorked++;
          s.totalWorkValue += r.workValue || 0;
          s.otMinutes += r.otMinutes || 0;
          if (r.isLate) s.lateTimes++;
          if (r.flag === "forgot_clock") s.forgotTimes++;
          if (r.flag === "power_outage_morning" || r.flag === "power_outage_afternoon") s.powerOutageTimes++;
        });
        const summaryList = Object.values(empSummaryMap).sort((a, b) => a.code.localeCompare(b.code));
        const totalWorkDays = Math.round(summaryList.reduce((s, e) => s + e.totalWorkValue, 0) * 100) / 100;
        const totalLate = summaryList.reduce((s, e) => s + e.lateTimes, 0);
        const totalNeedFix = summaryList.reduce((s, e) => s + e.forgotTimes + e.powerOutageTimes, 0);
        const thP = { padding: "5px 6px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", whiteSpace: "nowrap" };
        const tdP = { padding: "4px 6px", fontSize: "0.72rem", borderBottom: "1px solid var(--bd)" };

        return (
          <Dialog open onClose={() => setImportDlg(false)} title={`Import chấm công — T${month}/${year}`} width={Math.min(1100, window.innerWidth - 80)} noEnter>
            {/* Tổng hợp nhanh */}
            <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10, fontSize: "0.75rem" }}>
              <span><strong style={{ color: "var(--ac)" }}>{summaryList.length}</strong> NV khớp</span>
              {importUnmatched.length > 0 && <span><strong style={{ color: "#e74c3c" }}>{importUnmatched.length}</strong> NV không khớp</span>}
              <span>Tổng công: <strong style={{ color: "var(--ac)" }}>{totalWorkDays}</strong></span>
              {totalLate > 0 && <span>Muộn: <strong style={{ color: "#e74c3c" }}>{totalLate}</strong> lần</span>}
              {totalNeedFix > 0 && <span>Cần xử lý: <strong style={{ color: "#f39c12" }}>{totalNeedFix}</strong> ngày</span>}
              <span style={{ color: "var(--tm)" }}>{importData?.length || 0} bản ghi</span>
            </div>

            {/* Bảng chính */}
            <div style={{ maxHeight: "calc(90vh - 280px)", overflowY: "auto", overflowX: "auto", marginBottom: 10, border: "1px solid var(--bd)", borderRadius: 6 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                  <tr>
                    <th style={{ ...thP, width: 30, textAlign: "center" }}>STT</th>
                    <th style={thP}>Mã</th>
                    <th style={thP}>Họ tên</th>
                    <th style={thP}>BP</th>
                    <th style={thP}>Ca</th>
                    <th style={{ ...thP, textAlign: "center" }} title="Số ngày đi làm">Ngày ĐL</th>
                    <th style={{ ...thP, textAlign: "center", color: "var(--ac)" }} title="Công tính từ giờ vào/ra">Công TT</th>
                    <th style={{ ...thP, textAlign: "center", color: "#3498db" }} title="Ngày công từ file máy CC">Công máy</th>
                    <th style={{ ...thP, textAlign: "center" }} title="Chênh lệch">Lệch</th>
                    <th style={{ ...thP, textAlign: "center", color: "#e74c3c" }} title="Số lần đi muộn">Muộn</th>
                    <th style={{ ...thP, textAlign: "center", color: "#f39c12" }} title="Quên CC + mất điện buổi → cần xử lý thủ công">Cần XL</th>
                  </tr>
                </thead>
                <tbody>
                  {summaryList.map((e, i) => {
                    const wv = Math.round(e.totalWorkValue * 100) / 100;
                    const mWd = importMachineSummary[e.id]?.machineWorkDays;
                    const diff = mWd != null ? Math.round((wv - mWd) * 100) / 100 : null;
                    const needFix = e.forgotTimes + e.powerOutageTimes;
                    return (
                      <tr key={e.code}>
                        <td style={{ ...tdP, textAlign: "center", fontSize: "0.65rem", color: "var(--tm)" }}>{i + 1}</td>
                        <td style={{ ...tdP, fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap" }}>{e.code}</td>
                        <td style={{ ...tdP, fontWeight: 600, whiteSpace: "nowrap" }}>{e.name}</td>
                        <td style={{ ...tdP, fontSize: "0.68rem" }}>{e.dept}</td>
                        <td style={{ ...tdP, fontSize: "0.65rem", color: "var(--tm)" }}>{e.shiftName}</td>
                        <td style={{ ...tdP, textAlign: "center" }}>{e.daysWorked}</td>
                        <td style={{ ...tdP, textAlign: "center", fontWeight: 700, color: "var(--ac)" }}>{wv}</td>
                        <td style={{ ...tdP, textAlign: "center", color: "#3498db" }}>{mWd != null ? mWd : "—"}</td>
                        <td style={{ ...tdP, textAlign: "center", fontWeight: 600, color: diff != null ? (Math.abs(diff) > 0.5 ? "#e74c3c" : diff !== 0 ? "#f39c12" : "var(--tm)") : "var(--tm)" }}>{diff != null ? (diff > 0 ? "+" : "") + diff : "—"}</td>
                        <td style={{ ...tdP, textAlign: "center", color: e.lateTimes > 0 ? "#e74c3c" : "var(--tm)" }}>{e.lateTimes || "—"}</td>
                        <td style={{ ...tdP, textAlign: "center", fontWeight: needFix > 0 ? 700 : 400, color: needFix > 0 ? "#f39c12" : "var(--tm)" }}>{needFix || "—"}</td>
                      </tr>
                    );
                  })}
                  {/* Total row */}
                  <tr style={{ background: "var(--bgh)" }}>
                    <td colSpan={5} style={{ ...tdP, fontWeight: 700 }}>TỔNG ({summaryList.length} NV)</td>
                    <td style={tdP} />
                    <td style={{ ...tdP, textAlign: "center", fontWeight: 800, color: "var(--ac)" }}>{totalWorkDays}</td>
                    <td style={tdP} />
                    <td style={tdP} />
                    <td style={{ ...tdP, textAlign: "center", fontWeight: 700, color: "#e74c3c" }}>{totalLate || "—"}</td>
                    <td style={{ ...tdP, textAlign: "center", fontWeight: 700, color: "#f39c12" }}>{totalNeedFix || "—"}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* NV không khớp */}
            {importUnmatched.length > 0 && (
              <div style={{ marginBottom: 10, padding: 10, background: "#e74c3c11", borderRadius: 6, border: "1px solid #e74c3c44" }}>
                <div style={{ fontWeight: 700, fontSize: "0.75rem", color: "#e74c3c", marginBottom: 6 }}>{importUnmatched.length} NV trên máy chấm công không khớp:</div>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      <th style={{ ...thP, fontSize: "0.58rem" }}>Mã máy</th>
                      <th style={{ ...thP, fontSize: "0.58rem" }}>Tên trên máy</th>
                      <th style={{ ...thP, fontSize: "0.58rem" }}>BP trên máy</th>
                      <th style={{ ...thP, fontSize: "0.58rem", textAlign: "center" }}>Công máy</th>
                    </tr>
                  </thead>
                  <tbody>
                    {importUnmatched.map((u, i) => (
                      <tr key={i}>
                        <td style={{ ...tdP, fontFamily: "monospace", fontWeight: 600 }}>{u.code}</td>
                        <td style={tdP}>{u.name}</td>
                        <td style={{ ...tdP, color: "var(--tm)" }}>{u.dept || "—"}</td>
                        <td style={{ ...tdP, textAlign: "center" }}>{u.machineWorkDays || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 4 }}>Vào Nhân sự → thêm NV hoặc cập nhật mã máy chấm công.</div>
              </div>
            )}

            {/* Xung đột */}
            {importConflicts.length > 0 && (
              <div style={{ marginBottom: 10, padding: 10, background: "#f39c1222", borderRadius: 6, border: "1px solid #f39c12" }}>
                <div style={{ fontWeight: 700, fontSize: "0.75rem", color: "#f39c12", marginBottom: 6 }}>⚠ {importConflicts.length} xung đột với dữ liệu nhập tay:</div>
                <div style={{ maxHeight: 100, overflowY: "auto" }}>
                  {importConflicts.slice(0, 15).map((c, i) => (
                    <div key={i} style={{ fontSize: "0.68rem", padding: "2px 0", borderBottom: "1px solid #f39c1244" }}>
                      {c.empCode} — Ngày {c.day}: {STATUS_MAP[c.oldStatus]?.title} → <strong>{STATUS_MAP[c.newStatus]?.title}</strong>
                    </div>
                  ))}
                  {importConflicts.length > 15 && <div style={{ fontSize: "0.65rem", color: "var(--tm)" }}>...và {importConflicts.length - 15} xung đột khác</div>}
                </div>
                <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 4 }}>Dữ liệu import sẽ ghi đè.</div>
              </div>
            )}

            {/* Footer */}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setImportDlg(false)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
              <button onClick={confirmImport} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Import {importData?.length} bản ghi</button>
            </div>
          </Dialog>
        );
      })()}

      {/* ═══ Settings Dialog ═══ */}
      {settingsDlg && (
        <Dialog open onClose={() => setSettingsDlg(false)} title="Cấu hình lương & chấm công" width={420}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
            <div>
              <label style={labelSt}>Công chuẩn/tháng</label>
              <input value={settingsFm.standard_work_days} onChange={e => setSettingsFm(p => ({ ...p, standard_work_days: e.target.value }))} style={inputSt} />
            </div>
            <div>
              <label style={labelSt}>Hệ số OT</label>
              <input value={settingsFm.ot_rate} onChange={e => setSettingsFm(p => ({ ...p, ot_rate: e.target.value }))} style={inputSt} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 10 }}>
            <div>
              <label style={labelSt}>Thưởng CC ≥ 28 công (đ)</label>
              <input value={settingsFm.attendance_bonus_28} onChange={e => setSettingsFm(p => ({ ...p, attendance_bonus_28: e.target.value.replace(/[^0-9]/g, "") }))} style={{ ...inputSt, textAlign: "right" }} />
              {settingsFm.attendance_bonus_28 && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 2 }}>{fmtMoney(settingsFm.attendance_bonus_28)}đ</div>}
            </div>
            <div>
              <label style={labelSt}>Thưởng CC ≥ 30 công (đ)</label>
              <input value={settingsFm.attendance_bonus_30} onChange={e => setSettingsFm(p => ({ ...p, attendance_bonus_30: e.target.value.replace(/[^0-9]/g, "") }))} style={{ ...inputSt, textAlign: "right" }} />
              {settingsFm.attendance_bonus_30 && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 2 }}>{fmtMoney(settingsFm.attendance_bonus_30)}đ</div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setSettingsDlg(false)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={saveSettings} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
          </div>
        </Dialog>
      )}

      {/* ═══ Campaign Dialog ═══ */}
      {campaignDlg && (() => {
        const campaignDepts = departments.filter(d => d.sundayMode === "campaign");
        const allCampaigns = [...campaigns, ...extraCampaigns];

        // Tính danh sách CN cho 3 tháng (hiện tại + 2 tháng sau)
        const campMonths = [];
        for (let offset = 0; offset <= 2; offset++) {
          const dt = new Date(year, month - 1 + offset, 1);
          const p = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`;
          const cm = dt.getMonth() + 1, cy = dt.getFullYear();
          const lastDay = new Date(cy, cm, 0).getDate();
          const sundays = [];
          for (let d = 1; d <= lastDay; d++) { if (new Date(cy, cm - 1, d).getDay() === 0) sundays.push(d); }
          campMonths.push({ period: p, month: cm, year: cy, sundays });
        }

        const getCamp = (deptId, p) => allCampaigns.find(c => c.departmentId === deptId && c.period === p);
        const getActiveSundays = (deptId, p) => getCamp(deptId, p)?.activeSundays || [];

        const toggleSunday = (deptId, p, day) => {
          const camp = getCamp(deptId, p);
          const current = camp?.activeSundays || [];
          const next = current.includes(day) ? current.filter(d => d !== day) : [...current, day].sort((a, b) => a - b);
          const isActive = next.length > 0;
          const setter = p === period ? setCampaigns : setExtraCampaigns;
          setter(prev => {
            const idx = prev.findIndex(c => c.departmentId === deptId && (p === period ? true : c.period === p));
            const updated = { ...(camp || { id: "tmp_" + Date.now(), departmentId: deptId, period: p, note: "" }), isActive, activeSundays: next };
            if (idx >= 0) return prev.map((c, i) => i === idx ? updated : c);
            return [...prev, updated];
          });
          if (useAPI) import("../api.js").then(api => api.upsertCampaign(deptId, p, isActive, next, camp?.note || "", user?.username));
        };

        const thC = { padding: "5px 6px", textAlign: "center", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.6rem", borderBottom: "2px solid var(--bds)", whiteSpace: "nowrap" };
        return (
          <Dialog open onClose={() => setCampaignDlg(false)} title="Chiến dịch sản xuất — Chọn CN bắt buộc" width={Math.min(800, window.innerWidth - 60)} noEnter>
            <div style={{ fontSize: "0.72rem", color: "var(--tm)", marginBottom: 10 }}>
              Tick từng CN bắt buộc đi làm. NV nghỉ CN đã tick mà không có phép = vắng không phép.
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={{ ...thC, textAlign: "left", minWidth: 80 }}>Bộ phận</th>
                    {campMonths.map(cm => (
                      <th key={cm.period} colSpan={cm.sundays.length} style={{ ...thC, background: cm.period === period ? "var(--acbg)" : "var(--bgh)", color: cm.period === period ? "var(--ac)" : "var(--brl)" }}>
                        T{cm.month}/{cm.year}{cm.period === period ? " ●" : ""}
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <th style={{ ...thC, textAlign: "left" }}>Tuần →</th>
                    {campMonths.map(cm => cm.sundays.map((d, wi) => (
                      <th key={`${cm.period}_${d}`} style={{ ...thC, fontSize: "0.58rem", minWidth: 36, background: cm.period === period ? "var(--acbg)" : "var(--bgs)" }}>
                        CN {d}/{cm.month}
                      </th>
                    )))}
                  </tr>
                </thead>
                <tbody>
                  {campaignDepts.map(dept => (
                    <tr key={dept.id}>
                      <td style={{ padding: "6px 8px", fontSize: "0.75rem", fontWeight: 600, borderBottom: "1px solid var(--bd)", whiteSpace: "nowrap" }}>{dept.name}</td>
                      {campMonths.map(cm => cm.sundays.map(d => {
                        const active = getActiveSundays(dept.id, cm.period).includes(d);
                        return (
                          <td key={`${cm.period}_${d}`} style={{ padding: "4px", textAlign: "center", borderBottom: "1px solid var(--bd)", background: active ? "#e67e2222" : "transparent" }}>
                            <input type="checkbox" checked={active} onChange={() => toggleSunday(dept.id, cm.period, d)} style={{ cursor: "pointer" }} />
                          </td>
                        );
                      }))}
                    </tr>
                  ))}
                  {campaignDepts.length === 0 && <tr><td colSpan={99} style={{ padding: 16, textAlign: "center", color: "var(--tm)", fontSize: "0.78rem" }}>Cấu hình BP → chế độ "Chiến dịch" trong Quản lý bộ phận.</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setCampaignDlg(false)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Đóng</button>
            </div>
          </Dialog>
        );
      })()}

      {/* ═══ Leave Request Dialog — Ma trận NV × Ngày ═══ */}
      {leaveDlg && (() => {
        const officialEmps = employees.filter(e => e.status !== "inactive" && e.employeeType === "official").sort((a, b) => a.code.localeCompare(b.code));
        const leaveShort = { personal: "V", sick: "Ố", annual: "P", other: "K" };
        const leaveColors = { personal: "#f39c12", sick: "#e74c3c", annual: "#3498db", other: "#95a5a6" };
        const leaveLabels = { personal: "Việc riêng", sick: "Ốm", annual: "Phép năm", other: "Khác" };
        const leaveByKey = {};
        leaveRequests.forEach(l => { leaveByKey[`${l.employeeId}_${l.date}`] = l; });
        // Loại phép đang chọn để thêm
        const [pickType, setPickType] = [leaveDlg.leaveType || "personal", (v) => setLeaveDlg(p => ({ ...p, leaveType: v }))];
        const totalLeaves = leaveRequests.length;
        const thL = { padding: "4px 2px", textAlign: "center", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", borderBottom: "2px solid var(--bds)", whiteSpace: "nowrap" };

        const handleLeaveClick = (empId, day) => {
          const dateStr = `${period}-${String(day).padStart(2, "0")}`;
          const existing = leaveByKey[`${empId}_${dateStr}`];
          if (existing) {
            // Đã có → không làm gì (cần double-click để xóa)
            return;
          }
          // Chưa có → mở dialog nhập lý do + người duyệt
          const emp = employees.find(e => e.id === empId);
          setLeaveDetailDlg({ empId, empName: emp?.fullName || "", day, leaveType: pickType, note: "", approvedBy: "" });
        };

        const handleLeaveDoubleClick = (empId, day) => {
          const dateStr = `${period}-${String(day).padStart(2, "0")}`;
          const existing = leaveByKey[`${empId}_${dateStr}`];
          if (!existing) return;
          // Double-click ô đã có → xóa
          // Optimistic
          setLeaveRequests(prev => prev.filter(x => x.id !== existing.id));
          if (useAPI) {
            import("../api.js").then(api => api.deleteLeaveRequest(existing.id).then(r => {
              if (r?.error) { notify("Lỗi xóa: " + r.error, false); setLeaveRequests(prev => [...prev, existing]); }
            }));
          }
        };

        return (
          <Dialog open onClose={() => { if (!leaveDetailDlg) setLeaveDlg(null); }} title={`Nghỉ phép — T${month}/${year}`} width={Math.min(1100, window.innerWidth - 60)} noEnter>
            {/* Chọn loại phép + thống kê */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: "0.72rem", color: "var(--tm)" }}>Click ô để gán/bỏ. Loại:</span>
                {Object.entries(leaveShort).map(([k, s]) => (
                  <button key={k} onClick={() => setPickType(k)} style={{ padding: "3px 10px", borderRadius: 5, border: pickType === k ? `2px solid ${leaveColors[k]}` : "1.5px solid var(--bd)", background: pickType === k ? leaveColors[k] + "22" : "transparent", color: leaveColors[k], cursor: "pointer", fontWeight: 700, fontSize: "0.72rem" }}>{s} {leaveLabels[k]}</button>
                ))}
              </div>
              <span style={{ fontSize: "0.72rem", color: "var(--tm)" }}><strong style={{ color: "var(--tp)" }}>{totalLeaves}</strong> ngày phép</span>
            </div>

            {/* Ma trận NV × ngày */}
            <div style={{ overflowX: "auto", maxHeight: "calc(85vh - 220px)" }}>
              <table style={{ borderCollapse: "collapse" }}>
                <thead style={{ position: "sticky", top: 0, zIndex: 2 }}>
                  <tr>
                    <th style={{ ...thL, width: 28, position: "sticky", left: 0, zIndex: 3, background: "var(--bgh)" }} rowSpan={2}>STT</th>
                    <th style={{ ...thL, textAlign: "left", minWidth: 55, position: "sticky", left: 28, zIndex: 3, background: "var(--bgh)" }} rowSpan={2}>Mã</th>
                    <th style={{ ...thL, textAlign: "left", minWidth: 100, position: "sticky", left: 83, zIndex: 3, background: "var(--bgh)" }} rowSpan={2}>Họ tên</th>
                    {days.map(d => {
                      const dow = new Date(year, month - 1, d).getDay();
                      const isSun = dow === 0;
                      const dowLabels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
                      return <th key={d} style={{ ...thL, minWidth: 26, fontSize: "0.5rem", padding: "2px 1px", color: isSun ? "#e74c3c" : dow === 6 ? "#f39c12" : "var(--tm)", background: isSun ? "#e74c3c08" : "var(--bgh)" }}>{dowLabels[dow]}</th>;
                    })}
                    <th style={{ ...thL, minWidth: 32 }} rowSpan={2}>Tổng</th>
                  </tr>
                  <tr>
                    {days.map(d => {
                      const dow = new Date(year, month - 1, d).getDay();
                      const isSun = dow === 0;
                      return <th key={d} style={{ ...thL, minWidth: 26, color: isSun ? "#e74c3c" : dow === 6 ? "#f39c12" : "var(--brl)", background: isSun ? "#e74c3c08" : "var(--bgh)" }}>{d}</th>;
                    })}
                  </tr>
                </thead>
                <tbody>
                  {officialEmps.map((emp, i) => {
                    const empTotal = days.reduce((s, d) => s + (leaveByKey[`${emp.id}_${period}-${String(d).padStart(2, "0")}`] ? 1 : 0), 0);
                    return (
                      <tr key={emp.id}>
                        <td style={{ padding: "3px 2px", textAlign: "center", fontSize: "0.62rem", color: "var(--tm)", borderBottom: "1px solid var(--bd)", position: "sticky", left: 0, background: "var(--bgc)", zIndex: 1 }}>{i + 1}</td>
                        <td style={{ padding: "3px 4px", fontSize: "0.65rem", fontFamily: "monospace", fontWeight: 600, whiteSpace: "nowrap", borderBottom: "1px solid var(--bd)", position: "sticky", left: 28, background: "var(--bgc)", zIndex: 1 }}>{emp.code}</td>
                        <td style={{ padding: "3px 4px", fontSize: "0.68rem", fontWeight: 600, whiteSpace: "nowrap", borderBottom: "1px solid var(--bd)", position: "sticky", left: 83, background: "var(--bgc)", zIndex: 1 }}>{emp.fullName}</td>
                        {days.map(d => {
                          const dateStr = `${period}-${String(d).padStart(2, "0")}`;
                          const leave = leaveByKey[`${emp.id}_${dateStr}`];
                          const dow = new Date(year, month - 1, d).getDay();
                          const isSun = dow === 0;
                          return (
                            <td key={d} style={{ padding: "2px 1px", borderBottom: "1px solid var(--bd)", background: isSun ? "#e74c3c06" : "transparent" }}>
                              <div onClick={() => handleLeaveClick(emp.id, d)} onDoubleClick={() => handleLeaveDoubleClick(emp.id, d)} style={{ width: 24, height: 24, lineHeight: "24px", textAlign: "center", borderRadius: 4, cursor: "pointer", fontSize: "0.62rem", fontWeight: 700, border: leave ? `1.5px solid ${leaveColors[leave.leaveType]}` : "1px solid transparent", background: leave ? leaveColors[leave.leaveType] + "22" : "transparent", color: leave ? leaveColors[leave.leaveType] : "transparent", transition: "all 0.1s" }} title={leave ? `${d}/${month} — ${leaveLabels[leave.leaveType]}${leave.note ? ": " + leave.note : ""}${leave.approvedBy ? " (duyệt: " + leave.approvedBy + ")" : ""}. Double-click để xóa.` : `Click để gán ${leaveLabels[pickType]}`}>
                                {leave ? leaveShort[leave.leaveType] : ""}
                              </div>
                            </td>
                          );
                        })}
                        <td style={{ padding: "3px 4px", textAlign: "center", fontWeight: 700, fontSize: "0.68rem", color: empTotal > 0 ? "#3498db" : "var(--tm)", borderBottom: "1px solid var(--bd)" }}>{empTotal || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
              <button onClick={() => setLeaveDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Đóng</button>
            </div>
          </Dialog>
        );
      })()}

      {/* ═══ Leave Detail Dialog ═══ */}
      {leaveDetailDlg && (
        <Dialog open onClose={() => setLeaveDetailDlg(null)} onOk={() => saveLeaveDetailRef.current?.()} title={`Nghỉ phép — ${leaveDetailDlg.empName} — Ngày ${leaveDetailDlg.day}/${month}`} width={400}>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Loại nghỉ phép</label>
            <select value={leaveDetailDlg.leaveType} onChange={e => setLeaveDetailDlg(p => ({ ...p, leaveType: e.target.value }))} style={inputSt}>
              <option value="personal">Việc riêng</option>
              <option value="sick">Ốm</option>
              <option value="annual">Phép năm</option>
              <option value="other">Khác</option>
            </select>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Lý do *</label>
            <input value={leaveDetailDlg.note} onChange={e => setLeaveDetailDlg(p => ({ ...p, note: e.target.value }))} style={inputSt} placeholder="VD: Đám cưới, khám bệnh..." />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Người duyệt</label>
            <input value={leaveDetailDlg.approvedBy} onChange={e => setLeaveDetailDlg(p => ({ ...p, approvedBy: e.target.value }))} style={inputSt} placeholder="VD: Anh Mạnh (QL xẻ)" />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setLeaveDetailDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            {(() => {
              const doSave = async () => {
                if (!leaveDetailDlg.note?.trim()) { notify("Vui lòng nhập lý do", false); return; }
                const dateStr = `${period}-${String(leaveDetailDlg.day).padStart(2, "0")}`;
                const tmpId = "tmp_" + Date.now();
                const newLeave = { id: tmpId, employeeId: leaveDetailDlg.empId, date: dateStr, leaveType: leaveDetailDlg.leaveType, status: "approved", approvedBy: leaveDetailDlg.approvedBy?.trim() || "", note: leaveDetailDlg.note.trim() };
                setLeaveRequests(prev => [...prev, newLeave]);
                setLeaveDetailDlg(null);
                if (useAPI) {
                  const api = await import("../api.js");
                  const r = await api.addLeaveRequest(leaveDetailDlg.empId, dateStr, leaveDetailDlg.leaveType, newLeave.note, newLeave.approvedBy || user?.username, user?.username);
                  if (r?.error) { notify("Lỗi: " + r.error, false); setLeaveRequests(prev => prev.filter(x => x.id !== tmpId)); }
                  else { setLeaveRequests(prev => prev.map(x => x.id === tmpId ? { ...x, id: r.id } : x)); }
                }
              };
              saveLeaveDetailRef.current = doSave;
              return <button onClick={doSave} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>;
            })()}
          </div>
        </Dialog>
      )}

      {/* ═══ Batch Day Dialog (mất điện / nghỉ lễ) ═══ */}
      {batchDlg && (
        <Dialog open onClose={() => setBatchDlg(null)} onOk={confirmBatch} title="Điều chỉnh chấm công hàng loạt" width={460}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelSt}>Ngày</label>
              <select value={batchDlg.day} onChange={e => setBatchDlg(p => ({ ...p, day: Number(e.target.value) }))} style={inputSt}>
                {days.map(d => <option key={d} value={d}>{d}/{month} ({["CN","T2","T3","T4","T5","T6","T7"][new Date(year, month - 1, d).getDay()]})</option>)}
              </select>
            </div>
            <div>
              <label style={labelSt}>Loại</label>
              <select value={batchDlg.type} onChange={e => setBatchDlg(p => ({ ...p, type: e.target.value }))} style={inputSt}>
                <option value="power_outage">Mất điện / Máy lỗi</option>
                <option value="holiday">Nghỉ lễ</option>
              </select>
            </div>
          </div>
          {batchDlg.type === "power_outage" && (
            <div style={{ marginBottom: 10 }}>
              <label style={labelSt}>Phạm vi</label>
              <div style={{ display: "flex", gap: 8 }}>
                {[["full", "Cả ngày"], ["morning", "Buổi sáng"], ["afternoon", "Buổi chiều"]].map(([v, lb]) => (
                  <label key={v} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer", fontSize: "0.78rem", padding: "6px 12px", borderRadius: 6, border: batchDlg.scope === v ? "2px solid var(--ac)" : "1.5px solid var(--bd)", background: batchDlg.scope === v ? "var(--ac)11" : "transparent" }}>
                    <input type="radio" name="scope" checked={batchDlg.scope === v} onChange={() => setBatchDlg(p => ({ ...p, scope: v, workValue: v === "full" ? "1" : "0.5" }))} style={{ display: "none" }} />
                    {lb}
                  </label>
                ))}
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--tm)", marginTop: 6 }}>
                {batchDlg.scope === "full" && "Máy CC không hoạt động cả ngày → tính đủ 1 công"}
                {batchDlg.scope === "morning" && "Mất buổi sáng → máy chỉ ghi được giờ ra chiều (17:xx). Công buổi chiều giữ nguyên, bù 0.5 công buổi sáng"}
                {batchDlg.scope === "afternoon" && "Mất buổi chiều → có giờ vào sáng, không có giờ ra. Công buổi sáng giữ nguyên, bù 0.5 công buổi chiều"}
              </div>
            </div>
          )}
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Công điều chỉnh {batchDlg.scope !== "full" ? "(công bù thêm)" : "(tổng)"}</label>
            <input value={batchDlg.workValue} onChange={e => setBatchDlg(p => ({ ...p, workValue: e.target.value }))} style={inputSt} placeholder="VD: 1 hoặc 0.5" />
          </div>
          {/* Chọn NV */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
              <label style={labelSt}>Nhân viên áp dụng ({batchDlg.selectedEmps?.length || 0}/{activeEmps.length})</label>
              <div style={{ display: "flex", gap: 4 }}>
                <button onClick={() => setBatchDlg(p => ({ ...p, selectedEmps: activeEmps.map(e => e.id) }))} style={{ padding: "2px 6px", borderRadius: 3, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.62rem" }}>Chọn tất cả</button>
                <button onClick={() => setBatchDlg(p => ({ ...p, selectedEmps: [] }))} style={{ padding: "2px 6px", borderRadius: 3, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.62rem" }}>Bỏ chọn</button>
              </div>
            </div>
            <div style={{ maxHeight: 150, overflowY: "auto", border: "1px solid var(--bd)", borderRadius: 5, padding: 4 }}>
              {activeEmps.map(e => (
                <label key={e.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "3px 4px", cursor: "pointer", fontSize: "0.72rem", borderRadius: 3, background: batchDlg.selectedEmps?.includes(e.id) ? "var(--acbg)" : "transparent" }}>
                  <input type="checkbox" checked={batchDlg.selectedEmps?.includes(e.id) || false} onChange={ev => {
                    setBatchDlg(p => ({ ...p, selectedEmps: ev.target.checked ? [...(p.selectedEmps || []), e.id] : (p.selectedEmps || []).filter(x => x !== e.id) }));
                  }} />
                  <span style={{ fontFamily: "monospace", marginRight: 4 }}>{e.code}</span>{e.fullName}
                </label>
              ))}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setBatchDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={confirmBatch} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Áp dụng cho {batchDlg.selectedEmps?.length || 0} NV</button>
          </div>
        </Dialog>
      )}

      {/* ═══ Shift Management Dialog ═══ */}
      {shiftDlg === "list" && (
        <Dialog open onClose={() => setShiftDlg(null)} title="Quản lý ca làm việc" width={780} noEnter>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 10 }}>
            <thead>
              <tr>
                <th style={{ ...thSt, textAlign: "left", fontSize: "0.65rem" }}>Tên ca</th>
                <th style={{ ...thSt, textAlign: "center", fontSize: "0.65rem" }}>Vào</th>
                <th style={{ ...thSt, textAlign: "center", fontSize: "0.65rem" }}>Nghỉ trưa</th>
                <th style={{ ...thSt, textAlign: "center", fontSize: "0.65rem" }}>Chiều</th>
                <th style={{ ...thSt, textAlign: "center", fontSize: "0.65rem" }}>Tan</th>
                <th style={{ ...thSt, textAlign: "center", fontSize: "0.65rem" }}>Break</th>
                <th style={{ ...thSt, textAlign: "center", fontSize: "0.65rem" }}>Cách tính</th>
                <th style={{ ...thSt, textAlign: "center", fontSize: "0.65rem" }}>BP áp dụng</th>
                <th style={{ ...thSt, width: 40 }} />
              </tr>
            </thead>
            <tbody>
              {shifts.map(s => {
                const depts = departments.filter(d => d.shiftId === s.id).map(d => d.name).join(", ");
                return (
                  <tr key={s.id}>
                    <td style={{ padding: "6px 8px", fontSize: "0.75rem", fontWeight: 600, borderBottom: "1px solid var(--bd)" }}>{s.name}</td>
                    <td style={{ padding: "6px 8px", fontSize: "0.75rem", textAlign: "center", borderBottom: "1px solid var(--bd)" }}>{s.startTime?.slice(0, 5)}</td>
                    <td style={{ padding: "6px 8px", fontSize: "0.75rem", textAlign: "center", borderBottom: "1px solid var(--bd)" }}>{s.lunchStart?.slice(0, 5)}–{s.lunchEnd?.slice(0, 5)}</td>
                    <td style={{ padding: "6px 8px", fontSize: "0.75rem", textAlign: "center", borderBottom: "1px solid var(--bd)" }}>{s.lunchEnd?.slice(0, 5)}</td>
                    <td style={{ padding: "6px 8px", fontSize: "0.75rem", textAlign: "center", borderBottom: "1px solid var(--bd)" }}>{s.endTime?.slice(0, 5)}</td>
                    <td style={{ padding: "6px 8px", fontSize: "0.68rem", textAlign: "center", borderBottom: "1px solid var(--bd)", color: "var(--tm)" }}>
                      {s.breakMorningStart ? `${s.breakMorningStart.slice(0, 5)}-${s.breakMorningEnd?.slice(0, 5)}, ${s.breakAfternoonStart?.slice(0, 5)}-${s.breakAfternoonEnd?.slice(0, 5)}` : "Không"}
                    </td>
                    <td style={{ padding: "6px 8px", fontSize: "0.68rem", textAlign: "center", borderBottom: "1px solid var(--bd)" }}>
                      <span style={{ padding: "1px 6px", borderRadius: 4, fontSize: "0.62rem", fontWeight: 600, background: s.calcMode === "night_cross_day" ? "#9b59b622" : s.calcMode === "presence_only" ? "#3498db22" : "var(--bgs)", color: s.calcMode === "night_cross_day" ? "#9b59b6" : s.calcMode === "presence_only" ? "#3498db" : "var(--ts)" }}>
                        {s.calcMode === "night_cross_day" ? "Ca đêm" : s.calcMode === "presence_only" ? "Có mặt" : "Chuẩn"}
                      </span>
                    </td>
                    <td style={{ padding: "6px 8px", fontSize: "0.68rem", borderBottom: "1px solid var(--bd)", color: "var(--tm)" }}>{depts || "—"}</td>
                    <td style={{ padding: "6px 8px", borderBottom: "1px solid var(--bd)" }}>
                      <button onClick={() => setShiftDlg(s)} style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--bd)", background: "transparent", color: "var(--ac)", cursor: "pointer", fontSize: "0.65rem" }}>Sửa</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button onClick={() => setShiftDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Đóng</button>
          </div>
        </Dialog>
      )}

      {/* ═══ Shift Edit Dialog ═══ */}
      {shiftDlg && shiftDlg !== "list" && (
        <Dialog open onClose={() => setShiftDlg("list")} title={`Sửa ca: ${shiftDlg.name}`} width={640} noEnter>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div><label style={labelSt}>Tên ca</label><input value={shiftDlg.name} onChange={e => setShiftDlg(p => ({ ...p, name: e.target.value }))} style={inputSt} /></div>
            <div>
              <label style={labelSt}>Cách tính công</label>
              <select value={shiftDlg.calcMode || "standard"} onChange={e => setShiftDlg(p => ({ ...p, calcMode: e.target.value }))} style={inputSt}>
                <option value="standard">Chuẩn (giờ làm / 8h)</option>
                <option value="night_cross_day">Ca đêm (bảo vệ)</option>
                <option value="presence_only">Có mặt (vệ sinh)</option>
              </select>
            </div>
            <div><label style={labelSt}>{shiftDlg.calcMode === "presence_only" ? "Giờ tối thiểu" : "Giờ chuẩn"}</label><input value={shiftDlg.calcMode === "presence_only" ? (shiftDlg.minPresenceHours || "") : shiftDlg.standardHours} onChange={e => setShiftDlg(p => shiftDlg.calcMode === "presence_only" ? { ...p, minPresenceHours: e.target.value } : { ...p, standardHours: e.target.value })} style={inputSt} /></div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div><label style={labelSt}>Giờ vào</label><input type="time" value={shiftDlg.startTime?.slice(0, 5) || ""} onChange={e => setShiftDlg(p => ({ ...p, startTime: e.target.value }))} style={inputSt} /></div>
            <div><label style={labelSt}>Nghỉ trưa</label><input type="time" value={shiftDlg.lunchStart?.slice(0, 5) || ""} onChange={e => setShiftDlg(p => ({ ...p, lunchStart: e.target.value }))} style={inputSt} /></div>
            <div><label style={labelSt}>Chiều</label><input type="time" value={shiftDlg.lunchEnd?.slice(0, 5) || ""} onChange={e => setShiftDlg(p => ({ ...p, lunchEnd: e.target.value }))} style={inputSt} /></div>
            <div><label style={labelSt}>Tan</label><input type="time" value={shiftDlg.endTime?.slice(0, 5) || ""} onChange={e => setShiftDlg(p => ({ ...p, endTime: e.target.value }))} style={inputSt} /></div>
          </div>
          <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--ts)", marginBottom: 6 }}>Nghỉ giữa giờ (để trống nếu không có)</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 10, marginBottom: 10 }}>
            <div><label style={labelSt}>Sáng từ</label><input type="time" value={shiftDlg.breakMorningStart?.slice(0, 5) || ""} onChange={e => setShiftDlg(p => ({ ...p, breakMorningStart: e.target.value || null }))} style={inputSt} /></div>
            <div><label style={labelSt}>Sáng đến</label><input type="time" value={shiftDlg.breakMorningEnd?.slice(0, 5) || ""} onChange={e => setShiftDlg(p => ({ ...p, breakMorningEnd: e.target.value || null }))} style={inputSt} /></div>
            <div><label style={labelSt}>Chiều từ</label><input type="time" value={shiftDlg.breakAfternoonStart?.slice(0, 5) || ""} onChange={e => setShiftDlg(p => ({ ...p, breakAfternoonStart: e.target.value || null }))} style={inputSt} /></div>
            <div><label style={labelSt}>Chiều đến</label><input type="time" value={shiftDlg.breakAfternoonEnd?.slice(0, 5) || ""} onChange={e => setShiftDlg(p => ({ ...p, breakAfternoonEnd: e.target.value || null }))} style={inputSt} /></div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setShiftDlg("list")} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={() => {
              if (!useAPI || !shiftDlg.id) return;
              import("../api.js").then(api => api.updateWorkShift(shiftDlg.id, shiftDlg).then(r => {
                if (r?.error) notify("Lỗi: " + r.error, false);
                else {
                  setShifts(p => p.map(s => s.id === shiftDlg.id ? { ...s, ...shiftDlg } : s));
                  notify("Đã cập nhật ca " + shiftDlg.name);
                  setShiftDlg("list");
                }
              }));
            }} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
