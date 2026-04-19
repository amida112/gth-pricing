import React, { useState, useMemo, useRef } from 'react';

/**
 * BoardsInput — Nhập chi tiết tấm gỗ cho kiện.
 * 3 tab: Paste ma trận, Paste CSV, File Excel (lý lịch gỗ cũ).
 *
 * Props:
 *   thickness: number (cm) — để tính m³
 *   onBoardsChange: (boards: [{l, w}], stats: {count, volume}) => void
 *   boards: array — current boards (controlled)
 */

const inpS = { width: '100%', padding: '5px 8px', borderRadius: 5, border: '1px solid var(--bd)', fontSize: '0.76rem', background: 'var(--bgc)', color: 'var(--tp)', outline: 'none', boxSizing: 'border-box' };
const btnSec = { padding: '6px 14px', borderRadius: 6, border: '1px solid var(--bd)', fontWeight: 600, fontSize: '0.74rem', cursor: 'pointer', background: 'var(--bgs)', color: 'var(--ts)' };

function fmtNum(n, dec = 4) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('vi-VN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ── Parse ma trận (paste từ Excel) ──
// Dòng 1: chiều dài (dm), dòng 2+: chiều rộng (cm) theo cột
function parseMatrix(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return { boards: [], errors: ['Cần ít nhất 2 dòng (dài + rộng)'] };
  const errors = [];
  // Parse dòng 1 → dài (dm)
  const lengths = lines[0].split(/[\t,;]+/).map(v => parseFloat(v.replace(',', '.'))).filter(v => !isNaN(v) && v > 0);
  if (!lengths.length) return { boards: [], errors: ['Dòng 1 không có giá trị chiều dài hợp lệ'] };
  const boards = [];
  for (let r = 1; r < lines.length; r++) {
    const widths = lines[r].split(/[\t,;]+/);
    for (let c = 0; c < widths.length && c < lengths.length; c++) {
      const w = parseFloat(widths[c]?.replace(',', '.'));
      if (!isNaN(w) && w > 0) {
        boards.push({ l: lengths[c], w });
      }
    }
  }
  if (!boards.length) errors.push('Không tìm thấy giá trị rộng hợp lệ');
  return { boards, errors };
}

// ── Parse CSV ──
// Format: dài,rộng mỗi dòng (hoặc tab)
function parseCsv(text) {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const boards = [];
  const errors = [];
  lines.forEach((line, i) => {
    // Skip header
    if (i === 0 && /d[àa]i|length|rộng|width/i.test(line)) return;
    const cols = line.split(/[\t,;]+/).map(v => parseFloat(v.replace(',', '.')));
    if (cols.length < 2 || isNaN(cols[0]) || isNaN(cols[1])) {
      errors.push(`Dòng ${i + 1}: cần 2 số (dài, rộng)`);
      return;
    }
    boards.push({ l: cols[0], w: cols[1] });
  });
  return { boards, errors };
}

// ── Parse Excel file (lý lịch gỗ cũ) ──
// Dùng SheetJS (xlsx) — lazy import
async function parseExcelFile(file, fileName) {
  try {
    const XLSX = await import('xlsx');
    const data = await file.arrayBuffer();
    const wb = XLSX.read(data, { type: 'array' });
    const results = [];
    const sheetErrors = []; // { fileName, sheetName, error }

    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      const json = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (json.length < 2) { sheetErrors.push({ fileName: fileName || file.name, sheetName: name, error: 'Sheet trống hoặc quá ít dữ liệu' }); continue; }

      // Tìm dòng "Dài" — thường hàng 10 (index 9) hoặc chứa text "Dài"
      let lengthRowIdx = -1;
      for (let r = 0; r < Math.min(json.length, 15); r++) {
        const row = json[r];
        const firstCell = String(row[0] || '').toLowerCase();
        if (firstCell.includes('dài') || firstCell.includes('dai')) {
          lengthRowIdx = r;
          break;
        }
      }
      if (lengthRowIdx < 0) {
        // Fallback: tìm dòng có nhiều số > 15 (dm) liên tiếp
        for (let r = 5; r < Math.min(json.length, 15); r++) {
          const nums = json[r].slice(1).filter(v => { const n = parseFloat(v); return !isNaN(n) && n >= 10 && n <= 50; });
          if (nums.length >= 3) { lengthRowIdx = r; break; }
        }
      }
      if (lengthRowIdx < 0) { sheetErrors.push({ fileName: fileName || file.name, sheetName: name, error: 'Không có dữ liệu (dòng dài trống)' }); continue; }

      // Parse dài từ dòng lengthRowIdx (skip cột A = label)
      const lengthRow = json[lengthRowIdx];
      const lengths = [];
      for (let c = 1; c < lengthRow.length; c++) {
        const v = parseFloat(lengthRow[c]);
        if (!isNaN(v) && v > 0) lengths.push({ col: c, val: v });
      }
      if (!lengths.length) { sheetErrors.push({ fileName: fileName || file.name, sheetName: name, error: 'Không có giá trị chiều dài hợp lệ' }); continue; }

      // Parse rộng từ dòng lengthRowIdx+1 trở đi
      const boards = [];
      for (let r = lengthRowIdx + 1; r < json.length; r++) {
        const row = json[r];
        const firstCell = String(row[0] || '').toLowerCase();
        if (firstCell.includes('kh') || firstCell.includes('tổng') || firstCell.includes('total')) break;
        let hasValue = false;
        for (const { col, val: l } of lengths) {
          const w = parseFloat(row[col]);
          if (!isNaN(w) && w > 0) { boards.push({ l, w }); hasValue = true; }
        }
        if (!hasValue && r > lengthRowIdx + 1) break;
      }
      if (!boards.length) { sheetErrors.push({ fileName: fileName || file.name, sheetName: name, error: 'Không có dữ liệu rộng' }); continue; }

      // Extract metadata từ header
      let bundleCode = '', woodType = '', thickness = '', quality = '', boardCount = '';
      for (let r = 0; r < lengthRowIdx; r++) {
        const row = json[r];
        for (let c = 0; c < row.length - 1; c++) {
          const label = String(row[c] || '').toLowerCase().trim();
          if (!label) continue;
          // Tìm val: cột tiếp theo có giá trị (Excel thường merge cell → skip cột trống)
          let val = '';
          for (let nc = c + 1; nc < Math.min(c + 4, row.length); nc++) {
            const v = String(row[nc] || '').trim();
            if (v) { val = v; break; }
          }
          if (!val) continue;
          if (label.includes('mã') || label.includes('ma')) bundleCode = val;
          else if (label.includes('loại') || label.includes('loai')) woodType = val;
          else if (label.includes('dày') || label.includes('day') || label.includes('chiều dày')) thickness = val;
          else if (label.includes('chất') || label.includes('chat')) quality = val;
          else if (label.includes('số tấm') || label.includes('so tam')) boardCount = val;
        }
      }

      // Validate: mã header vs tên sheet — cảnh báo (không skip)
      const headerCode = bundleCode ? String(bundleCode).trim() : '';
      const sheetCode = String(name).trim();
      const codeMismatch = headerCode && headerCode !== sheetCode;

      results.push({
        sheetName: name, boards,
        bundleCode: headerCode || sheetCode,
        headerCode, sheetCode, codeMismatch,
        woodType, thickness, quality,
        boardCount: parseInt(boardCount) || boards.length,
        fileName: fileName || file.name,
      });
    }
    return { sheets: results, errors: sheetErrors };
  } catch (e) {
    return { sheets: [], errors: [{ fileName: fileName || file.name, sheetName: '—', error: 'Lỗi đọc file: ' + e.message }] };
  }
}

function calcVolume(boards, thickCm) {
  const t = parseFloat(thickCm) || 0;
  return boards.reduce((s, b) => s + (b.l / 10) * (b.w / 100) * (t / 100), 0);
}

export default function BoardsInput({ thickness, onBoardsChange, boards: currentBoards }) {
  const [tab, setTab] = useState('matrix');
  const [matrixText, setMatrixText] = useState('');
  const [csvText, setCsvText] = useState('');
  const [parseResult, setParseResult] = useState(null); // { boards, errors }
  const [excelSheets, setExcelSheets] = useState(null); // [{ sheetName, boards, ... }]
  const [selSheet, setSelSheet] = useState(0);
  const fileRef = useRef(null);

  const handleParseMatrix = (text) => {
    setMatrixText(text);
    if (!text.trim()) { setParseResult(null); onBoardsChange([], null); return; }
    const r = parseMatrix(text);
    setParseResult(r);
    if (r.boards.length) {
      const vol = calcVolume(r.boards, thickness);
      onBoardsChange(r.boards, { count: r.boards.length, volume: +vol.toFixed(4) });
    }
  };

  const handleParseCsv = (text) => {
    setCsvText(text);
    if (!text.trim()) { setParseResult(null); onBoardsChange([], null); return; }
    const r = parseCsv(text);
    setParseResult(r);
    if (r.boards.length) {
      const vol = calcVolume(r.boards, thickness);
      onBoardsChange(r.boards, { count: r.boards.length, volume: +vol.toFixed(4) });
    }
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    const r = await parseExcelFile(file, file.name);
    if (r.errors.length && !r.sheets.length) {
      setParseResult({ boards: [], errors: r.errors });
      return;
    }
    setExcelSheets(r.sheets);
    setSelSheet(0);
    if (r.sheets.length) {
      const s = r.sheets[0];
      const vol = calcVolume(s.boards, thickness);
      setParseResult({ boards: s.boards, errors: [] });
      onBoardsChange(s.boards, { count: s.boards.length, volume: +vol.toFixed(4) });
    }
  };

  const selectSheet = (idx) => {
    setSelSheet(idx);
    if (excelSheets?.[idx]) {
      const s = excelSheets[idx];
      const vol = calcVolume(s.boards, thickness);
      setParseResult({ boards: s.boards, errors: [] });
      onBoardsChange(s.boards, { count: s.boards.length, volume: +vol.toFixed(4) });
    }
  };

  const handleClear = () => {
    setMatrixText(''); setCsvText(''); setParseResult(null); setExcelSheets(null);
    onBoardsChange([], null);
  };

  const previewBoards = parseResult?.boards || currentBoards || [];
  const previewVol = calcVolume(previewBoards, thickness);

  const swS = { display: 'flex', gap: 2, background: '#f0f0f0', borderRadius: 5, padding: 2 };
  const swBtn = (active) => ({ padding: '3px 10px', border: 'none', borderRadius: 3, fontSize: '0.62rem', fontWeight: 600, cursor: 'pointer', background: active ? '#fff' : 'transparent', color: active ? 'var(--tp)' : 'var(--tm)', boxShadow: active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' });

  return (
    <div style={{ border: '1px solid var(--bd)', borderRadius: 8, padding: '8px 10px', marginBottom: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--brl)' }}>Chi tiết tấm (tùy chọn)</span>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <div style={swS}>
            <button style={swBtn(tab === 'matrix')} onClick={() => setTab('matrix')}>Ma trận</button>
            <button style={swBtn(tab === 'csv')} onClick={() => setTab('csv')}>CSV</button>
            <button style={swBtn(tab === 'file')} onClick={() => setTab('file')}>File Excel</button>
          </div>
          {(previewBoards.length > 0 || matrixText || csvText) && <button onClick={handleClear} style={{ background: 'none', border: 'none', color: 'var(--dg)', cursor: 'pointer', fontSize: '0.6rem' }}>Xóa</button>}
        </div>
      </div>

      {tab === 'matrix' && (
        <div>
          <div style={{ fontSize: '0.62rem', color: 'var(--tm)', marginBottom: 4 }}>
            Paste từ Excel: Dòng 1 = chiều dài (dm), dòng 2+ = chiều rộng (cm) theo cột
          </div>
          <textarea value={matrixText} onChange={e => handleParseMatrix(e.target.value)} rows={5}
            placeholder={"21\t24\t23\t19\n17\t17\t14\t13\n17\t16\t12\n11\t12"}
            style={{ ...inpS, fontFamily: 'monospace', fontSize: '0.7rem', resize: 'vertical' }} />
        </div>
      )}

      {tab === 'csv' && (
        <div>
          <div style={{ fontSize: '0.62rem', color: 'var(--tm)', marginBottom: 4 }}>
            Mỗi dòng: dài(dm), rộng(cm) — VD: 30,17
          </div>
          <textarea value={csvText} onChange={e => handleParseCsv(e.target.value)} rows={5}
            placeholder={"30,17\n30,14\n30,16\n25,20\n25,23"}
            style={{ ...inpS, fontFamily: 'monospace', fontSize: '0.7rem', resize: 'vertical' }} />
        </div>
      )}

      {tab === 'file' && (
        <div>
          <div style={{ fontSize: '0.62rem', color: 'var(--tm)', marginBottom: 4 }}>
            Chọn file Excel lý lịch gỗ (tự nhận diện dòng Dài/Rộng)
          </div>
          <input ref={fileRef} type="file" accept=".xlsx,.xls" onChange={handleFileChange} style={{ fontSize: '0.72rem', marginBottom: 6 }} />
          {excelSheets && excelSheets.length > 1 && (
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              {excelSheets.map((s, i) => (
                <button key={i} onClick={() => selectSheet(i)} style={{ ...btnSec, padding: '2px 8px', fontSize: '0.62rem', background: selSheet === i ? 'var(--ac)' : 'var(--bgs)', color: selSheet === i ? '#fff' : 'var(--ts)' }}>
                  {s.bundleCode || s.sheetName} ({s.boards.length} tấm)
                </button>
              ))}
            </div>
          )}
          {excelSheets?.[selSheet] && (
            <div style={{ fontSize: '0.66rem', color: 'var(--ts)', padding: '4px 6px', background: 'var(--bgs)', borderRadius: 4, marginBottom: 4 }}>
              Mã: <strong>{excelSheets[selSheet].bundleCode}</strong>
              {excelSheets[selSheet].woodType && <> · {excelSheets[selSheet].woodType}</>}
              {excelSheets[selSheet].thickness && <> · {excelSheets[selSheet].thickness}cm</>}
              {excelSheets[selSheet].quality && <> · {excelSheets[selSheet].quality}</>}
            </div>
          )}
        </div>
      )}

      {/* Errors */}
      {parseResult?.errors?.length > 0 && (
        <div style={{ fontSize: '0.66rem', color: 'var(--dg)', marginTop: 4 }}>
          {parseResult.errors.map((e, i) => <div key={i}>{typeof e === 'string' ? e : `${e.sheetName}: ${e.error}`}</div>)}
        </div>
      )}

      {/* Preview — Matrix */}
      {previewBoards.length > 0 && (
        <div style={{ marginTop: 6, padding: '6px 8px', background: 'var(--bgs)', borderRadius: 6 }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--gn)', marginBottom: 6 }}>
            {previewBoards.length} tấm · {fmtNum(previewVol, 4)} m³
            <span style={{ fontWeight: 400, color: 'var(--tm)', marginLeft: 6 }}>(dày {thickness}cm)</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            {(() => {
              const thickNum = parseFloat(thickness) || 0;
              const groups = {};
              previewBoards.forEach(b => { if (!groups[b.l]) groups[b.l] = []; groups[b.l].push(b.w); });
              const lengths = Object.keys(groups).sort((a, b) => a - b);
              lengths.forEach(l => groups[l].sort((a, b) => a - b));
              const columns = [];
              lengths.forEach(l => { const arr = groups[l]; for (let i = 0; i < arr.length; i += 10) columns.push({ length: l, values: arr.slice(i, i + 10) }); });
              const maxRows = columns.length > 0 ? Math.max(...columns.map(c => c.values.length)) : 0;
              const thBase = { padding: '2px 4px', border: '1px solid var(--bd)', fontWeight: 700, fontSize: '0.6rem' };
              return (
                <table style={{ borderCollapse: 'collapse', fontSize: '0.62rem' }}>
                  <thead><tr>
                    <th style={{ ...thBase, background: 'var(--bgh)', color: '#7A3A10' }}>Dài</th>
                    {columns.map((c, i) => <th key={i} style={{ ...thBase, background: '#FEF0E8', color: '#C24E10' }}>{c.length}</th>)}
                  </tr></thead>
                  <tbody>
                    {Array.from({ length: maxRows }, (_, r) => (
                      <tr key={r}>
                        {r === 0 && <th rowSpan={maxRows} style={{ ...thBase, background: 'var(--bgh)', color: '#7A3A10', verticalAlign: 'middle' }}>Rộng</th>}
                        {columns.map((c, i) => <td key={i} style={{ padding: '2px 4px', border: '1px solid var(--bd)', textAlign: 'center', fontSize: '0.62rem', background: r % 2 ? 'var(--bgs)' : '#fff' }}>{c.values[r] != null ? c.values[r] : ''}</td>)}
                      </tr>
                    ))}
                    <tr>
                      <th style={{ ...thBase, background: '#FEF0E8', color: '#C24E10' }}>Tổng</th>
                      {columns.map((c, i) => {
                        const sumW = c.values.reduce((s, w) => s + Number(w || 0), 0);
                        const total = c.length * sumW * thickNum;
                        return <th key={i} style={{ ...thBase, background: '#FEF0E8', color: '#C24E10' }}>{sumW ? total.toFixed(0) : ''}</th>;
                      })}
                    </tr>
                  </tbody>
                </table>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export { parseExcelFile, calcVolume };
