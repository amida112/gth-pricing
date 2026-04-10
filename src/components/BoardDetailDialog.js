import React, { useState } from 'react';
import Dialog from './Dialog';

/**
 * BoardDetailDialog — Hiển thị chi tiết danh sách tấm gỗ.
 * 2 layout: "packing" (mẫu nhập khẩu, mặc định) và "matrix" (bảng dọc cũ).
 *
 * Props:
 *   data: object — measurement hoặc bundle có boards data
 *   onClose: () => void
 *   title: string (optional)
 *   defaultLayout: 'packing' | 'matrix' (default: 'packing')
 */

const MAX_WIDTHS_PER_ROW = 20;

export default function BoardDetailDialog({ data, onClose, title, defaultLayout = 'packing' }) {
  const [layout, setLayout] = useState(defaultLayout);
  if (!data) return null;

  const boards = data.boards || data.rawMeasurements?.boards || [];
  const bundleCode = data.bundle_code || data.bundleCode || '';
  const woodType = data.wood_type || data.woodType || '';
  const thickness = data.thickness || 0;
  const quality = data.quality || data.attributes?.quality || '';
  const boardCount = data.board_count || data.boardCount || boards.length;
  const volume = data.volume || 0;
  const measuredBy = data.measured_by || data.measuredBy || '';
  const createdAt = data.created_at || data.createdAt || '';

  const thickMm = Math.round(parseFloat(thickness) * 10);

  // ── Switcher style ──
  const swS = { display: 'flex', gap: 2, background: '#f0f0f0', borderRadius: 5, padding: 2 };
  const swBtn = (active) => ({ padding: '3px 10px', border: 'none', borderRadius: 3, fontSize: '0.64rem', fontWeight: 600, cursor: 'pointer', background: active ? '#fff' : 'transparent', color: active ? 'var(--tp)' : 'var(--tm)', boxShadow: active ? '0 1px 2px rgba(0,0,0,0.1)' : 'none', transition: 'all 0.15s' });

  return (
    <Dialog open={true} onClose={onClose} title={title || `📐 Chi tiết kiện ${bundleCode}`} width={920} hideFooter>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 6 }}>
        <div>
          <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{bundleCode}</span>
          <span style={{ fontSize: '0.76rem', color: 'var(--tm)', marginLeft: 8 }}>{woodType} · {thickMm}mm · {quality}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: '0.76rem', fontWeight: 700 }}>{boardCount} pcs · {parseFloat(volume).toFixed(4)} m³</span>
          <div style={swS}>
            <button style={swBtn(layout === 'packing')} onClick={() => setLayout('packing')}>Packing</button>
            <button style={swBtn(layout === 'matrix')} onClick={() => setLayout('matrix')}>Matrix</button>
          </div>
        </div>
      </div>
      {measuredBy && (
        <div style={{ fontSize: '0.68rem', color: 'var(--tm)', marginBottom: 12 }}>
          Measured by: {measuredBy}{createdAt ? ` · ${new Date(createdAt).toLocaleString('vi-VN')}` : ''}
        </div>
      )}

      {boards.length === 0 ? (
        <div style={{ padding: 16, textAlign: 'center', color: 'var(--tm)' }}>Không có dữ liệu tấm</div>
      ) : layout === 'packing' ? (
        <PackingLayout boards={boards} thickness={thickness} bundleCode={bundleCode} />
      ) : (
        <MatrixLayout boards={boards} thickness={thickness} />
      )}
    </Dialog>
  );
}

// ═══════════════════════════════════════════
// Packing List layout (mẫu nhập khẩu)
// ═══════════════════════════════════════════
function PackingLayout({ boards, thickness, bundleCode }) {
  const thickNum = parseFloat(thickness) || 0;

  // Group by length (dm → cm for display)
  const groups = {};
  boards.forEach(b => {
    const cm = Math.round(b.l * 10);
    if (!groups[cm]) groups[cm] = { dm: b.l, widths: [] };
    groups[cm].widths.push(b.w);
  });
  const lengthKeys = Object.keys(groups).sort((a, b) => b - a);

  // Build rows — each chunk = separate row with own Length, PCS, M3
  const allRows = [];
  lengthKeys.forEach(cm => {
    const g = groups[cm];
    const widths = g.widths.sort((a, b) => a - b);
    for (let i = 0; i < widths.length; i += MAX_WIDTHS_PER_ROW) {
      const chunk = widths.slice(i, i + MAX_WIDTHS_PER_ROW);
      const chunkM3 = chunk.reduce((s, w) => s + (g.dm / 10) * (w / 100) * (thickNum / 100), 0);
      allRows.push({ cm, widths: chunk, pcs: chunk.length, m3: chunkM3 });
    }
  });

  const totalPcs = boards.length;
  const totalM3 = boards.reduce((s, b) => s + (b.l / 10) * (b.w / 100) * (thickNum / 100), 0);

  const thS = { fontSize: '0.78rem', fontWeight: 700, color: '#1a1a1a', textAlign: 'left', padding: '4px 0', borderBottom: '1.5px solid #1a1a1a', whiteSpace: 'nowrap' };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ minWidth: 700, borderCollapse: 'collapse', fontVariantNumeric: 'tabular-nums' }}>
        <thead>
          <tr>
            <th style={{ ...thS, paddingRight: 20 }}>Package</th>
            <th style={{ ...thS, paddingRight: 16 }}>Length</th>
            <th style={{ ...thS, textAlign: 'center' }}>Width</th>
            <th style={{ ...thS, textAlign: 'right', paddingRight: 16 }}>PCS</th>
            <th style={{ ...thS, textAlign: 'right' }}>M3</th>
          </tr>
        </thead>
        <tbody>
          {allRows.map((row, ri) => (
            <tr key={ri}>
              {ri === 0 && <td rowSpan={allRows.length} style={{ fontWeight: 700, fontSize: '0.82rem', verticalAlign: 'top', padding: '2px 20px 2px 0', whiteSpace: 'nowrap' }}>{bundleCode}</td>}
              <td style={{ fontWeight: 700, fontSize: '0.82rem', whiteSpace: 'nowrap', padding: '2px 16px 2px 0', verticalAlign: 'top' }}>{row.cm}</td>
              <td style={{ fontSize: '0.78rem', lineHeight: 1.5, padding: '2px 12px 2px 0', whiteSpace: 'nowrap' }}>
                {row.widths.map((w, wi) => <span key={wi} style={{ display: 'inline-block', width: 28, textAlign: 'right' }}>{w}</span>)}
              </td>
              <td style={{ fontSize: '0.78rem', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top', padding: '2px 16px 2px 0' }}>{row.pcs}</td>
              <td style={{ fontSize: '0.78rem', textAlign: 'right', whiteSpace: 'nowrap', verticalAlign: 'top', padding: '2px 0' }}>{row.m3.toFixed(4)}</td>
            </tr>
          ))}
          <tr>
            <td style={{ borderTop: '1.5px solid #1a1a1a' }} colSpan={2} />
            <td style={{ textAlign: 'right', paddingRight: 12, borderTop: '1.5px solid #1a1a1a', paddingTop: 6, fontWeight: 700, fontSize: '0.78rem' }}>Total:</td>
            <td style={{ textAlign: 'right', paddingRight: 16, borderTop: '1.5px solid #1a1a1a', paddingTop: 6, fontWeight: 700, fontSize: '0.78rem' }}>{totalPcs}</td>
            <td style={{ textAlign: 'right', borderTop: '1.5px solid #1a1a1a', paddingTop: 6, fontWeight: 700, fontSize: '0.78rem' }}>{totalM3.toFixed(4)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ═══════════════════════════════════════════
// Matrix layout (bảng dọc — giữ nguyên)
// ═══════════════════════════════════════════
function MatrixLayout({ boards, thickness }) {
  const thickNum = parseFloat(thickness) || 0;
  const groups = {};
  boards.forEach(b => { if (!groups[b.l]) groups[b.l] = []; groups[b.l].push(b.w); });
  const lengths = Object.keys(groups).sort((a, b) => a - b);
  lengths.forEach(l => groups[l].sort((a, b) => a - b));
  const columns = [];
  lengths.forEach(l => { const arr = groups[l]; for (let i = 0; i < arr.length; i += 10) columns.push({ length: l, values: arr.slice(i, i + 10) }); });
  const maxRows = columns.length > 0 ? Math.max(...columns.map(c => c.values.length)) : 0;

  const thBase = { padding: '4px 6px', border: '1px solid var(--bd)', fontWeight: 700 };

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ borderCollapse: 'collapse', fontSize: '0.74rem' }}>
        <thead>
          <tr>
            <th style={{ ...thBase, background: 'var(--bgh)', fontSize: '0.66rem', color: '#7A3A10' }}>Dài</th>
            {columns.map((c, i) => <th key={i} style={{ ...thBase, background: '#FEF0E8', color: '#C24E10' }}>{c.length}</th>)}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: maxRows }, (_, r) => (
            <tr key={r}>
              {r === 0 && <th rowSpan={maxRows} style={{ ...thBase, background: 'var(--bgh)', fontSize: '0.66rem', color: '#7A3A10', verticalAlign: 'middle' }}>Rộng</th>}
              {columns.map((c, i) => <td key={i} style={{ padding: '3px 6px', border: '1px solid var(--bd)', textAlign: 'center', background: r % 2 ? 'var(--bgs)' : '#fff' }}>{c.values[r] != null ? c.values[r] : ''}</td>)}
            </tr>
          ))}
          <tr>
            <th style={{ ...thBase, background: '#FEF0E8', fontSize: '0.66rem', color: '#C24E10' }}>Tổng</th>
            {columns.map((c, i) => {
              const sumW = c.values.reduce((s, w) => s + Number(w || 0), 0);
              const total = c.length * sumW * thickNum;
              return <th key={i} style={{ ...thBase, background: '#FEF0E8', fontSize: '0.62rem', color: '#C24E10' }}>{sumW ? total.toFixed(0) : ''}</th>;
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
