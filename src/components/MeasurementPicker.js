import React, { useState, useMemo } from "react";

/**
 * MeasurementPicker — Shared component hiển thị danh sách kiện đo từ app,
 * cho phép gán vào mẻ xếp (packing session hoặc edging batch).
 *
 * Props:
 *   measurements: array — bundle_measurements records (status="chờ gán")
 *   sessions: array — danh sách mẻ/session đang mở, mỗi item cần { id, label }
 *   onAssign: (measurement, sessionId) => Promise — gọi khi user gán
 *   onDelete: (measurement) => Promise — gọi khi user xóa
 *   saving: bool
 *   emptyText: string — text khi không có measurement
 *   sessionLabel: string — label cho dropdown chọn mẻ (VD: "mẻ dong cạnh", "mẻ xếp")
 *   mode: 'table' | 'list' — table cho tab full-page, list cho dialog picker
 */

const btnS = { padding: '6px 14px', borderRadius: 6, border: 'none', fontWeight: 600, fontSize: '0.74rem', cursor: 'pointer' };
const btnP = { ...btnS, background: 'var(--ac)', color: '#fff' };
const btnDg = { ...btnS, background: 'var(--dg)', color: '#fff' };
const inpS = { width: '100%', padding: '5px 8px', borderRadius: 5, border: '1px solid var(--bd)', fontSize: '0.76rem', background: 'var(--bgc)', color: 'var(--tp)', outline: 'none', boxSizing: 'border-box' };
const thS = { padding: '4px 8px', fontSize: '0.66rem', fontWeight: 700, color: 'var(--brl)', textAlign: 'left', borderBottom: '2px solid var(--bd)', whiteSpace: 'nowrap' };
const tdS = { padding: '3px 8px', fontSize: '0.74rem', borderBottom: '1px solid var(--bd)', whiteSpace: 'nowrap' };
const panelS = { background: 'var(--bgc)', borderRadius: 10, border: '1px solid var(--bd)', overflow: 'hidden' };
const panelHead = { padding: '10px 14px', borderBottom: '1px solid var(--bd)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 };

function fmtNum(n, dec = 4) {
  if (n == null || isNaN(n)) return '—';
  return Number(n).toLocaleString('vi-VN', { minimumFractionDigits: dec, maximumFractionDigits: dec });
}

// ═══════════════════════════════════════════
// Table mode — full tab view with session selector
// ═══════════════════════════════════════════
export function MeasurementTable({ measurements, sessions, onAssign, onDelete, onView, saving, sessionLabel = 'mẻ', emptyText }) {
  const [selSessionId, setSelSessionId] = useState('');

  const COLS = 9;
  return (
    <div style={panelS}>
      <div style={panelHead}>
        <span style={{ fontWeight: 700, fontSize: '0.82rem' }}>Kiện nguyên đo từ app ({measurements.length})</span>
        {sessions.length > 0 && (
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--tm)' }}>Gán vào {sessionLabel}:</span>
            <select style={{ ...inpS, width: 'auto', minWidth: 160 }} value={selSessionId} onChange={e => setSelSessionId(e.target.value)}>
              <option value="">— Chọn {sessionLabel} —</option>
              {sessions.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </div>
        )}
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', tableLayout: 'fixed' }}>
          <colgroup>
            <col style={{ width: 36 }} />
            <col style={{ width: 130 }} />
            <col />
            <col style={{ width: 60 }} />
            <col style={{ width: 70 }} />
            <col style={{ width: 90 }} />
            <col style={{ width: 55 }} />
            <col style={{ width: 80 }} />
            <col style={{ width: 100 }} />
          </colgroup>
          <thead>
            <tr>
              <th style={{ ...thS, textAlign: 'center', width: 36 }}>#</th>
              <th style={thS}>Mã kiện</th>
              <th style={thS}>Loại gỗ</th>
              <th style={thS}>Dày</th>
              <th style={thS}>Chất lượng</th>
              <th style={{ ...thS, textAlign: 'right' }}>m³</th>
              <th style={{ ...thS, textAlign: 'right' }}>Tấm</th>
              <th style={thS}>Người đo</th>
              <th style={{ ...thS, textAlign: 'center' }} />
            </tr>
          </thead>
          <tbody>
            {measurements.length === 0 && <tr><td colSpan={COLS} style={{ ...tdS, textAlign: 'center', color: 'var(--tm)', padding: 20 }}>{emptyText || 'Không có kiện đo nào chờ gán'}</td></tr>}
            {measurements.map((m, i) => (
              <tr key={m.id}>
                <td style={{ ...tdS, textAlign: 'center', fontSize: '0.68rem', color: 'var(--tm)' }}>{i + 1}</td>
                <td style={{ ...tdS, fontWeight: 600 }}>{onView && m.boards?.length ? <span style={{ cursor: 'pointer', color: 'var(--ac)' }} onClick={() => onView(m)} title="Xem chi tiết tấm">{m.bundle_code} 📐</span> : m.bundle_code}</td>
                <td style={{ ...tdS, whiteSpace: 'normal' }}>{m.wood_type || '—'}</td>
                <td style={tdS}>{m.thickness || '—'}</td>
                <td style={tdS}>{m.quality || '—'}</td>
                <td style={{ ...tdS, textAlign: 'right', fontFamily: 'monospace' }}>{fmtNum(parseFloat(m.volume))}</td>
                <td style={{ ...tdS, textAlign: 'right' }}>{m.board_count || 0}</td>
                <td style={{ ...tdS, color: 'var(--tm)', overflow: 'hidden', textOverflow: 'ellipsis' }} title={m.measured_by}>{m.measured_by}</td>
                <td style={{ ...tdS, textAlign: 'center' }}>
                  <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                    <button style={{ ...btnP, padding: '2px 8px', fontSize: '0.64rem', opacity: selSessionId ? 1 : 0.4 }} disabled={!selSessionId || saving} onClick={() => onAssign(m, selSessionId)}>Gán</button>
                    {onDelete && <button style={{ ...btnDg, padding: '2px 6px', fontSize: '0.64rem' }} onClick={() => onDelete(m)}>Xóa</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════
// List mode — compact list for dialog picker (assign to a specific session)
// ═══════════════════════════════════════════
export function MeasurementList({ measurements, onAssign, onView, saving, emptyText }) {
  return (
    <div>
      {measurements.length === 0 && <div style={{ padding: 16, textAlign: 'center', color: 'var(--tm)', fontSize: '0.76rem' }}>{emptyText || 'Không có kiện đo nào chờ gán'}</div>}
      <div style={{ maxHeight: 350, overflow: 'auto' }}>
        {measurements.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 8px', borderBottom: '1px solid var(--bd)', fontSize: '0.74rem' }}>
            <div style={{ flex: 1, cursor: onView && m.boards?.length ? 'pointer' : 'default' }} onClick={onView && m.boards?.length ? () => onView(m) : undefined}>
              <div><span style={{ fontWeight: 600 }}>{m.bundle_code}</span>{onView && m.boards?.length ? <span style={{ marginLeft: 4, fontSize: '0.6rem' }}>📐</span> : ''} — {m.wood_type} · {m.thickness} · {m.quality}</div>
              <div style={{ color: 'var(--tm)', fontSize: '0.68rem' }}>{m.board_count} tấm · {fmtNum(parseFloat(m.volume))} m³ · {m.measured_by}</div>
            </div>
            <button style={btnP} disabled={saving} onClick={() => onAssign(m)}>{saving ? '...' : 'Gán'}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

export default { MeasurementTable, MeasurementList };
