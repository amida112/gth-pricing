/**
 * Parse CSV text thành packing list rows cho gỗ nguyên liệu.
 * Dùng chung cho PgShipment ContainerExpandPanel + PgRawWood ImportPanel.
 *
 * @param {string} text - CSV text (comma hoặc tab separated)
 * @param {boolean} isRound - true = gỗ tròn, false = gỗ hộp
 * @returns {Array|null} - Array of row objects, hoặc null nếu không parse được
 *
 * Format gỗ tròn: Mã cây, Dài (m), ĐK (cm), CV (cm), Chất lượng, Ghi chú
 * Format gỗ hộp: Mã hộp, Dày (cm), Rộng (cm), Dài (cm), KL m³ (bỏ qua), Ghi chú
 */
export function parsePackingListCsv(text, isRound) {
  const lines = (text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return null;

  // Detect header row
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
      quality: 'TB', notes: '',
    };

    if (isRound) {
      r.lengthM = cols[1] || '';
      r.diameterCm = cols[2] || '';
      r.circumferenceCm = cols[3] || '';
      r.quality = cols[4] || 'TB';
      r.notes = cols[5] || '';
    } else {
      // Gỗ hộp: Mã, Dày(cm), Rộng(cm), Dài(cm), KL(skip), Ghi chú
      r.thicknessCm = cols[1] || '';
      r.widthCm = cols[2] || '';
      const lCm = parseFloat(cols[3]) || 0;
      r.lengthM = lCm ? String(lCm / 100) : '';
      // cols[4] = KL m³ skip
      r.notes = cols[5] || '';
      r.quality = 'TB';
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
