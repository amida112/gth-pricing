/**
 * Tính công lẻ từ giờ vào/ra + ca làm việc.
 *
 * Hỗ trợ 3 calc_mode:
 *   - standard: tính theo giờ làm việc chuẩn (sáng + chiều - break)
 *   - night_cross_day: ca đêm bảo vệ (17:15→8:00 hôm sau)
 *   - presence_only: chỉ cần có mặt ≥ N giờ = 1 công (vệ sinh)
 *
 * @param {string} checkIn  - "HH:MM"
 * @param {string} checkOut - "HH:MM"
 * @param {object} shift    - { startTime, endTime, lunchStart, lunchEnd,
 *                              breakMorningStart, breakMorningEnd,
 *                              breakAfternoonStart, breakAfternoonEnd,
 *                              standardHours, calcMode, minPresenceHours }
 * @param {number} graceMinutes - phút được phép muộn (0 mặc định)
 * @returns {{ workValue, isLate, isEarlyLeave, lateMinutes, earlyMinutes, flag }}
 */
export function calcWorkDay(checkIn, checkOut, shift, graceMinutes = 0) {
  const ZERO = { workValue: 0, isLate: false, isEarlyLeave: false, lateMinutes: 0, earlyMinutes: 0, flag: 'normal' };
  if (!shift) return ZERO;

  const mode = shift.calcMode || 'standard';

  // ═══ NIGHT_CROSS_DAY (Bảo vệ) ═══
  // Máy CC ghi: Vào = 8:00 (kết thúc ca đêm), Ra = 17:15 (bắt đầu ca đêm mới)
  // Có Vào buổi sáng (≤ 12:00) = hoàn thành ca đêm hôm qua = 1 công
  // Chỉ có Ra chiều (≥ 13:00) = bắt đầu ca mới, chưa kết thúc = 0 công (tính vào ngày mai)
  if (mode === 'night_cross_day') {
    if (checkIn) {
      const inH = parseInt(checkIn.split(':')[0], 10);
      if (inH <= 12) {
        // Có quẹt buổi sáng = kết thúc ca đêm = 1 công
        return { workValue: 1, isLate: false, isEarlyLeave: false, lateMinutes: 0, earlyMinutes: 0, flag: 'normal' };
      }
    }
    // Chỉ có quẹt chiều hoặc không có quẹt sáng
    if (checkOut && !checkIn) {
      // Chỉ Ra, không Vào = chưa kết thúc ca
      return { ...ZERO, flag: 'normal' };
    }
    if (!checkIn && !checkOut) return ZERO;
    // Có Vào nhưng giờ chiều (≥ 13:00) = chỉ bắt đầu ca, chưa tính
    return { ...ZERO, flag: 'normal' };
  }

  // ═══ PRESENCE_ONLY (Vệ sinh) ═══
  // Chỉ cần có Vào + Ra cách nhau ≥ minPresenceHours = 1 công
  if (mode === 'presence_only') {
    if (!checkIn || !checkOut) {
      return { ...ZERO, flag: checkIn || checkOut ? 'forgot_clock' : 'normal' };
    }
    const inMin = timeToMin(checkIn);
    const outMin = timeToMin(checkOut);
    const diffHours = (outMin - inMin) / 60;
    const minHours = shift.minPresenceHours || 1;
    if (diffHours >= minHours) {
      return { workValue: 1, isLate: false, isEarlyLeave: false, lateMinutes: 0, earlyMinutes: 0, flag: 'normal' };
    }
    return { workValue: 0, isLate: false, isEarlyLeave: false, lateMinutes: 0, earlyMinutes: 0, flag: 'normal' };
  }

  // ═══ STANDARD ═══
  if (!checkIn) {
    return { ...ZERO, flag: checkOut ? 'forgot_clock' : 'normal' };
  }
  if (!checkOut) {
    return { ...ZERO, flag: 'forgot_clock' };
  }

  const inMin = timeToMin(checkIn);
  const outMin = timeToMin(checkOut);
  const startMin = timeToMin(shift.startTime);
  const endMin = timeToMin(shift.endTime);
  const lunchStartMin = timeToMin(shift.lunchStart);
  const lunchEndMin = timeToMin(shift.lunchEnd);

  // Buổi sáng: MAX(0, MIN(out, lunchStart) - MAX(in, startTime))
  let morningWork = Math.max(0, Math.min(outMin, lunchStartMin) - Math.max(inMin, startMin));
  // Trừ nghỉ giữa ca sáng (nếu có)
  if (shift.breakMorningStart && shift.breakMorningEnd) {
    const bms = timeToMin(shift.breakMorningStart);
    const bme = timeToMin(shift.breakMorningEnd);
    morningWork -= Math.max(0, Math.min(outMin, bme) - Math.max(inMin, bms));
  }

  // Buổi chiều: MAX(0, MIN(out, endTime) - MAX(in, lunchEnd))
  let afternoonWork = Math.max(0, Math.min(outMin, endMin) - Math.max(inMin, lunchEndMin));
  // Trừ nghỉ giữa ca chiều (nếu có)
  if (shift.breakAfternoonStart && shift.breakAfternoonEnd) {
    const bas = timeToMin(shift.breakAfternoonStart);
    const bae = timeToMin(shift.breakAfternoonEnd);
    afternoonWork -= Math.max(0, Math.min(outMin, bae) - Math.max(inMin, bas));
  }

  const totalMinutes = Math.max(0, morningWork) + Math.max(0, afternoonWork);
  const standardMinutes = (shift.standardHours || 8) * 60;
  const workValue = Math.min(1, Math.round(totalMinutes / standardMinutes * 100) / 100);

  // Late / early detection
  const effectiveStart = startMin + graceMinutes;
  const isLate = inMin > effectiveStart;
  const lateMinutes = isLate ? inMin - startMin : 0;
  const isEarlyLeave = outMin < endMin;
  const earlyMinutes = isEarlyLeave ? endMin - outMin : 0;

  return { workValue, isLate, isEarlyLeave, lateMinutes, earlyMinutes, flag: 'normal' };
}

/**
 * Convert "HH:MM" → minutes since midnight
 */
function timeToMin(t) {
  if (!t) return 0;
  const [h, m] = String(t).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

/**
 * Xác định status từ workValue
 */
export function statusFromWorkValue(wv) {
  if (wv >= 0.95) return 'present';
  if (wv >= 0.4) return 'half_day';
  return 'absent';
}

/**
 * Lấy shift cho employee dựa trên department
 */
export function getShiftForEmployee(emp, departments, shifts) {
  const dept = departments.find(d => d.id === emp.departmentId);
  if (!dept?.shiftId) return shifts.find(s => s.calcMode === 'standard') || shifts[0] || null;
  return shifts.find(s => s.id === dept.shiftId) || shifts[0] || null;
}
