/**
 * Tính thể tích gỗ tròn/hộp từ số đo.
 * Gỗ tròn: ĐK → K²×D×7854/10⁸, CV → V²×D×8/10⁶
 * Gỗ hộp: D(m)×W(cm)/100×T(cm)/100
 */
export function calcRoundVol(r) {
  const D = parseFloat(r.lengthM) || 0;
  if (!D) return null;
  const K = parseFloat(r.diameterCm) || 0;
  const V = parseFloat(r.circumferenceCm) || 0;
  if (K > 0) return parseFloat((K * K * D * 7854 / 1e8).toFixed(5));
  if (V > 0) return parseFloat((V * V * D * 8 / 1e6).toFixed(5));
  return null;
}

export function calcBoxVol(r) {
  const L = parseFloat(r.lengthM) || 0;
  const W = parseFloat(r.widthCm) || 0;
  const T = parseFloat(r.thicknessCm) || 0;
  return (L && W && T) ? parseFloat((L * (W / 100) * (T / 100)).toFixed(3)) : null;
}

/**
 * Parse CSV text thành packing list rows cho gỗ nguyên liệu.
 * Auto-calc volumeM3 cho gỗ tròn (từ ĐK hoặc CV) và gỗ hộp (từ chiều đo).
 *
 * Format gỗ tròn: Mã cây, Dài (m), ĐK (cm), CV (cm), Chất lượng, Ghi chú
 * Format gỗ hộp: Mã hộp, Dày (cm), Rộng (cm), Dài (cm), KL m³ (bỏ qua), Ghi chú
 */
export function parsePackingListCsv(text, isRound) {
  const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  const first = lines[0].split(/[,\t]/);
  const looksHeader = first[0]?.match(/^[A-Za-z\u00C0-\u024F]/) && isNaN(parseFloat(first[1]));
  const start = looksHeader ? 1 : 0;

  const rows = lines.slice(start).map(line => {
    const cols = line.split(/[,\t]/).map(s => s.trim().replace(/^["']|["']$/g, ''));
    const r = {
      _id: Date.now() + Math.random(),
      pieceCode: cols[0] || '',
      lengthM: '', diameterCm: '', circumferenceCm: '',
      widthCm: '', thicknessCm: '', weightKg: '',
      quality: '', notes: '', volumeM3: null,
    };

    if (isRound) {
      r.lengthM = cols[1] || '';
      r.diameterCm = cols[2] || '';
      r.circumferenceCm = cols[3] || '';
      r.quality = cols[4] || '';
      r.notes = cols[5] || '';
      r.volumeM3 = calcRoundVol(r);
    } else {
      r.thicknessCm = cols[1] || '';
      r.widthCm = cols[2] || '';
      const lCm = parseFloat(cols[3]) || 0;
      r.lengthM = lCm ? String(lCm / 100) : '';
      r.notes = cols[5] || '';
      r.volumeM3 = calcBoxVol(r);
    }

    return r;
  }).filter(r => r.pieceCode || r.lengthM);

  return rows.length ? rows : null;
}

/**
 * CSV template hint text
 */
export function getPackingListCsvHint(isRound) {
  return isRound
    ? 'Mã cây, Dài (m), ĐK (cm), CV (cm), Chất lượng, Ghi chú'
    : 'Mã hộp, Dày (cm), Rộng (cm), Dài (cm), KL m³ (bỏ qua—tự tính), Ghi chú';
}

export function getPackingListCsvPlaceholder(isRound) {
  return isRound
    ? 'T-001,4.20,32,100.5,Đẹp,\nT-002,3.80,28,88.0,TB,Cây bị nứt nhẹ'
    : 'H-001,4.5,28,320,,\nH-002,5,25,280,,Gỗ hộp xô';
}
