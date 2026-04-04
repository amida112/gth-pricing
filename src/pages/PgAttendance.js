import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import Dialog from "../components/Dialog";

const STATUS_MAP = {
  present:  { label: "✓", color: "#27ae60", title: "Có mặt" },
  absent:   { label: "✕", color: "#e74c3c", title: "Vắng" },
  half_day: { label: "½", color: "#f39c12", title: "Nửa ngày" },
  leave:    { label: "P", color: "#3498db", title: "Phép" },
  holiday:  { label: "H", color: "#9b59b6", title: "Nghỉ lễ" },
};
const STATUS_CYCLE = ["present", "absent", "half_day", "leave", "holiday"];
const WORK_VALUE = { present: 1, half_day: 0.5, absent: 0, leave: 0, holiday: 0 };

const fmtMoney = (v) => v ? Number(v).toLocaleString("vi-VN") : "0";

export default function PgAttendance({ employees, departments, useAPI, notify, user }) {
  // Period selection
  const now = new Date();
  const [period, setPeriod] = useState(() => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`);
  const [attendance, setAttendance] = useState([]); // flat array of attendance records
  const [loading, setLoading] = useState(false);
  const [settings, setSettings] = useState({});

  // Filter
  const [fDept, setFDept] = useState("");

  // OT dialog
  const [otDlg, setOtDlg] = useState(null); // { employeeId, date, otMinutes, note }

  // Import dialog
  const [importDlg, setImportDlg] = useState(false);
  const [importData, setImportData] = useState(null);
  const [importConflicts, setImportConflicts] = useState([]);
  const fileRef = useRef(null);

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
    if (fDept) list = list.filter(e => e.departmentId === fDept);
    return list.sort((a, b) => a.code.localeCompare(b.code));
  }, [employees, fDept]);

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
    ]).then(([attData, settData]) => {
      setAttendance(attData);
      setSettings(settData);
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

  // ─── Cell click: cycle status ───
  const handleCellClick = useCallback((empId, day) => {
    const dateStr = `${period}-${String(day).padStart(2, "0")}`;
    const key = `${empId}_${dateStr}`;
    const existing = attMap[key];
    const currentStatus = existing?.status || "absent";
    const nextIdx = (STATUS_CYCLE.indexOf(currentStatus) + 1) % STATUS_CYCLE.length;
    const nextStatus = STATUS_CYCLE[nextIdx];

    // Optimistic update
    const updated = {
      ...(existing || { id: "tmp_" + Date.now(), employeeId: empId, date: dateStr, otMinutes: 0, note: "" }),
      status: nextStatus,
    };
    setAttendance(prev => {
      const idx = prev.findIndex(a => a.employeeId === empId && a.date === dateStr);
      if (idx >= 0) return prev.map((a, i) => i === idx ? { ...a, status: nextStatus } : a);
      return [...prev, updated];
    });

    if (useAPI) {
      import("../api.js").then(api => api.upsertAttendance(empId, dateStr, {
        status: nextStatus, otMinutes: existing?.otMinutes || 0, note: existing?.note || "",
      }).then(r => {
        if (r?.error) notify("Lỗi: " + r.error, false);
      }));
    }
  }, [attMap, period, useAPI, notify]);

  // ─── OT dialog ───
  const openOtDlg = useCallback((empId, day) => {
    const dateStr = `${period}-${String(day).padStart(2, "0")}`;
    const existing = attMap[`${empId}_${dateStr}`];
    setOtDlg({
      employeeId: empId, date: dateStr, day,
      otMinutes: String(existing?.otMinutes || ""),
      note: existing?.note || "",
      status: existing?.status || "present",
    });
  }, [attMap, period]);

  const saveOt = () => {
    if (!otDlg) return;
    const ot = Number(otDlg.otMinutes) || 0;
    const dateStr = otDlg.date;
    const empId = otDlg.employeeId;

    setAttendance(prev => {
      const idx = prev.findIndex(a => a.employeeId === empId && a.date === dateStr);
      if (idx >= 0) return prev.map((a, i) => i === idx ? { ...a, otMinutes: ot, note: otDlg.note } : a);
      return [...prev, { id: "tmp_" + Date.now(), employeeId: empId, date: dateStr, status: otDlg.status, otMinutes: ot, note: otDlg.note }];
    });

    if (useAPI) {
      import("../api.js").then(api => api.upsertAttendance(empId, dateStr, {
        status: otDlg.status, otMinutes: ot, note: otDlg.note,
      }).then(r => {
        if (r?.error) notify("Lỗi: " + r.error, false);
        else notify("Đã lưu OT");
      }));
    }
    setOtDlg(null);
  };

  // ─── Summary per employee ───
  const empSummary = useCallback((empId) => {
    let workDays = 0, otMins = 0, absentDays = 0, leaveDays = 0;
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${period}-${String(d).padStart(2, "0")}`;
      const rec = attMap[`${empId}_${dateStr}`];
      if (rec) {
        workDays += WORK_VALUE[rec.status] || 0;
        otMins += rec.otMinutes || 0;
        if (rec.status === "absent") absentDays++;
        if (rec.status === "leave") leaveDays++;
      }
    }
    // Attendance bonus
    const bonus28 = Number(getSetting("attendance_bonus_28", 200000));
    const bonus30 = Number(getSetting("attendance_bonus_30", 500000));
    let bonus = 0;
    if (workDays >= 30) bonus = bonus30;
    else if (workDays >= 28) bonus = bonus28;
    return { workDays, otMins, absentDays, leaveDays, bonus };
  }, [daysInMonth, period, attMap, getSetting]);

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
    if (rows.length < 2) { notify("File rỗng", false); return; }
    // Header row: [Mã NV, Tên, 1, 2, 3, ..., 31, OT]
    // hoặc [code, name, d1, d2, ..., d31]
    // Detect format: header row contains day numbers
    const header = rows[0];
    const dayColStart = header.findIndex(h => String(h) === "1" || String(h).match(/^0?1$/));
    if (dayColStart < 0) { notify("Không nhận dạng được format file. Cần có cột ngày (1, 2, 3...)", false); return; }

    const parsed = [];
    const conflicts = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r];
      const codeRaw = String(row[0] || "").trim();
      if (!codeRaw) continue;
      const emp = employees.find(e => e.code.toLowerCase() === codeRaw.toLowerCase());
      if (!emp) continue;

      for (let d = 0; d < daysInMonth; d++) {
        const colIdx = dayColStart + d;
        const cellVal = row[colIdx];
        if (cellVal == null || cellVal === "") continue;
        const day = d + 1;
        const dateStr = `${period}-${String(day).padStart(2, "0")}`;
        let status = "present";
        const cv = String(cellVal).trim().toUpperCase();
        if (cv === "X" || cv === "✕" || cv === "0") status = "absent";
        else if (cv === "½" || cv === "0.5" || cv === "N") status = "half_day";
        else if (cv === "P") status = "leave";
        else if (cv === "H" || cv === "L") status = "holiday";
        // else present (✓, 1, etc.)

        const existing = attMap[`${emp.id}_${dateStr}`];
        if (existing && existing.source === "manual" && existing.status !== status) {
          conflicts.push({ empCode: emp.code, empName: emp.fullName, date: dateStr, day, oldStatus: existing.status, newStatus: status });
        }
        parsed.push({ employeeId: emp.id, date: dateStr, status, otMinutes: 0, source: "machine" });
      }

      // OT column (last column or column after days)
      const otColIdx = dayColStart + daysInMonth;
      if (row[otColIdx] != null) {
        const otVal = Number(row[otColIdx]) || 0;
        if (otVal > 0) {
          // Distribute OT to last day or as total — for now store as note on first present day
          // Simple: add OT minutes to last day of month
          const lastDate = `${period}-${String(daysInMonth).padStart(2, "0")}`;
          const existing = parsed.find(p => p.employeeId === emp.id && p.date === lastDate);
          if (existing) existing.otMinutes = otVal;
        }
      }
    }

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
  const cellSt = { width: 28, height: 28, textAlign: "center", cursor: "pointer", fontSize: "0.7rem", fontWeight: 700, borderRadius: 4, border: "1px solid var(--bd)", transition: "all 0.12s", lineHeight: "28px", userSelect: "none" };
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
          <input type="month" value={period} onChange={e => setPeriod(e.target.value)} style={{ padding: "6px 10px", borderRadius: 7, border: "1.5px solid var(--bd)", fontSize: "0.78rem", background: "var(--bg)", color: "var(--tp)", outline: "none" }} />
          {/* Dept filter */}
          <select value={fDept} onChange={e => setFDept(e.target.value)} style={{ padding: "6px 10px", borderRadius: 7, border: "1.5px solid var(--bd)", fontSize: "0.78rem", background: "var(--bg)", color: "var(--tp)", outline: "none" }}>
            <option value="">Tất cả BP</option>
            {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <button onClick={openSettingsDlg} style={{ padding: "7px 12px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}>⚙ Cấu hình</button>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" style={{ display: "none" }} onChange={handleFileSelect} />
          <button onClick={() => fileRef.current?.click()} style={{ padding: "7px 12px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.75rem" }}>📥 Import Excel</button>
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
        <span style={{ fontSize: "0.68rem", color: "var(--tm)" }}>| Click ô = đổi trạng thái | Right-click = OT</span>
      </div>

      {loading && <div style={{ padding: 24, textAlign: "center", color: "var(--tm)" }}>Đang tải...</div>}

      {/* Grid */}
      {!loading && (
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
                <th style={{ ...thSt, minWidth: 40 }}>Công</th>
                <th style={{ ...thSt, minWidth: 40 }}>OT</th>
                <th style={{ ...thSt, minWidth: 50 }}>Vắng</th>
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
                      <div style={{ cursor: "pointer", color: isSun ? "#e74c3c" : "var(--brl)" }} title={`Ngày ${d} — Click đánh dấu toàn cột`} onClick={() => {
                        const status = isSun ? "holiday" : "present";
                        fillColumn(d, status);
                      }}>{d}</div>
                    </th>
                  );
                })}
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
                      const info = st ? STATUS_MAP[st] : null;
                      const hasOt = (rec?.otMinutes || 0) > 0;
                      return (
                        <td key={d} style={{ padding: "2px 1px", borderBottom: "1px solid var(--bd)" }}>
                          <div
                            style={{ ...cellSt, background: info ? info.color + "22" : "transparent", color: info ? info.color : "var(--tm)", position: "relative" }}
                            title={`${emp.fullName} — ${d}/${month}: ${info?.title || "Chưa chấm"}${hasOt ? ` | OT: ${rec.otMinutes}p` : ""}`}
                            onClick={() => handleCellClick(emp.id, d)}
                            onContextMenu={e => { e.preventDefault(); openOtDlg(emp.id, d); }}
                          >
                            {info?.label || "·"}
                            {hasOt && <span style={{ position: "absolute", top: -2, right: -2, width: 6, height: 6, borderRadius: "50%", background: "#e67e22" }} />}
                          </div>
                        </td>
                      );
                    })}
                    <td style={{ padding: "4px 4px", textAlign: "center", fontSize: "0.72rem", fontWeight: 700, borderBottom: "1px solid var(--bd)", color: "var(--ac)" }}>{summary.workDays}</td>
                    <td style={{ padding: "4px 4px", textAlign: "center", fontSize: "0.68rem", borderBottom: "1px solid var(--bd)", color: summary.otMins > 0 ? "#e67e22" : "var(--tm)" }}>{summary.otMins > 0 ? `${Math.floor(summary.otMins / 60)}h${summary.otMins % 60 > 0 ? summary.otMins % 60 + "p" : ""}` : "—"}</td>
                    <td style={{ padding: "4px 4px", textAlign: "center", fontSize: "0.68rem", borderBottom: "1px solid var(--bd)", color: summary.absentDays > 0 ? "#e74c3c" : "var(--tm)" }}>{summary.absentDays || "—"}</td>
                    <td style={{ padding: "4px 4px", textAlign: "right", fontSize: "0.68rem", fontWeight: 600, borderBottom: "1px solid var(--bd)", color: summary.bonus > 0 ? "#27ae60" : "var(--tm)", whiteSpace: "nowrap" }}>{summary.bonus > 0 ? fmtMoney(summary.bonus) : "—"}</td>
                  </tr>
                );
              })}
              {activeEmps.length === 0 && (
                <tr><td colSpan={days.length + 6} style={{ padding: 24, textAlign: "center", color: "var(--tm)", fontSize: "0.82rem" }}>Không có nhân viên</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ OT Dialog ═══ */}
      {otDlg && (
        <Dialog open onClose={() => setOtDlg(null)} title={`OT — Ngày ${otDlg.day}/${month}`} width={340}>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Số phút tăng ca</label>
            <input value={otDlg.otMinutes} onChange={e => setOtDlg(p => ({ ...p, otMinutes: e.target.value.replace(/[^0-9]/g, "") }))} style={inputSt} placeholder="VD: 120 (= 2 giờ)" autoFocus />
            {otDlg.otMinutes && <div style={{ fontSize: "0.65rem", color: "var(--tm)", marginTop: 2 }}>{Math.floor(Number(otDlg.otMinutes) / 60)} giờ {Number(otDlg.otMinutes) % 60} phút — Hệ số ×{getSetting("ot_rate", 1.5)}</div>}
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Ghi chú</label>
            <input value={otDlg.note} onChange={e => setOtDlg(p => ({ ...p, note: e.target.value }))} style={inputSt} />
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setOtDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={saveOt} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
          </div>
        </Dialog>
      )}

      {/* ═══ Import Preview Dialog ═══ */}
      {importDlg && (
        <Dialog open onClose={() => setImportDlg(false)} title="Import chấm công từ Excel" width={540} noEnter>
          <div style={{ fontSize: "0.78rem", marginBottom: 10 }}>
            <strong>{importData?.length || 0}</strong> bản ghi sẽ được import cho tháng {month}/{year}.
          </div>
          {importConflicts.length > 0 && (
            <div style={{ marginBottom: 10, padding: 10, background: "#f39c1222", borderRadius: 6, border: "1px solid #f39c12" }}>
              <div style={{ fontWeight: 700, fontSize: "0.75rem", color: "#f39c12", marginBottom: 6 }}>⚠ {importConflicts.length} xung đột với dữ liệu nhập tay:</div>
              <div style={{ maxHeight: 200, overflowY: "auto" }}>
                {importConflicts.slice(0, 20).map((c, i) => (
                  <div key={i} style={{ fontSize: "0.7rem", padding: "2px 0", borderBottom: "1px solid #f39c1244" }}>
                    {c.empCode} ({c.empName}) — Ngày {c.day}: <span style={{ color: STATUS_MAP[c.oldStatus]?.color }}>{STATUS_MAP[c.oldStatus]?.title}</span> → <span style={{ color: STATUS_MAP[c.newStatus]?.color, fontWeight: 700 }}>{STATUS_MAP[c.newStatus]?.title}</span>
                  </div>
                ))}
                {importConflicts.length > 20 && <div style={{ fontSize: "0.68rem", color: "var(--tm)" }}>...và {importConflicts.length - 20} xung đột khác</div>}
              </div>
              <div style={{ fontSize: "0.68rem", color: "var(--tm)", marginTop: 4 }}>Dữ liệu import sẽ ghi đè dữ liệu cũ.</div>
            </div>
          )}
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setImportDlg(false)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={confirmImport} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Import {importData?.length} bản ghi</button>
          </div>
        </Dialog>
      )}

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
    </div>
  );
}
