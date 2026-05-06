import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';

/**
 * MultiSelectFilter — dropdown panel chọn nhiều giá trị, dùng làm filter đa giá trị.
 *
 * Props:
 *  - options: [{ value, label, count? }]
 *  - selected: Set<value>
 *  - onChange: (Set) => void
 *  - placeholder: text khi chưa chọn gì (default 'Tất cả')
 *  - allLabel: text khi chọn hết (default 'Tất cả')
 *  - noneLabel: text khi không chọn (default 'Tất cả')  // = "không filter"
 *  - width: min-width (default 'auto', cho header bảng dùng full width)
 *  - compact: dùng cho filter row trong bảng (height nhỏ hơn)
 */
export default function MultiSelectFilter({ options, selected, onChange, placeholder, allLabel = 'Tất cả', noneLabel = 'Tất cả', width, compact }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  const total = options.length;
  const selCount = selected?.size || 0;
  const isAll = selCount === 0 || selCount === total;
  let summary;
  if (isAll) summary = noneLabel;
  else if (selCount <= 2) summary = options.filter(o => selected.has(o.value)).map(o => o.label).join(', ');
  else summary = `${selCount}/${total}`;

  const updatePos = () => {
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom, left: r.left, width: Math.max(r.width, 180) });
  };

  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target) && popRef.current && !popRef.current.contains(e.target)) setOpen(false);
    };
    const onScroll = () => updatePos();
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', onScroll, true);
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('scroll', onScroll, true); };
  }, [open]);

  const toggle = (v) => {
    const next = new Set(selected || []);
    if (next.has(v)) next.delete(v); else next.add(v);
    onChange(next);
  };
  const selectAll = () => onChange(new Set(options.map(o => o.value)));
  const clearAll = () => onChange(new Set());

  const active = !isAll;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        ref={btnRef}
        type="button"
        onClick={() => { if (!open) updatePos(); setOpen(o => !o); }}
        style={{
          width: '100%',
          padding: compact ? '5px 8px' : '6px 10px',
          paddingRight: 24,
          borderRadius: 5,
          border: `1.5px solid ${active ? 'var(--ac)' : open ? '#90a4ae' : 'var(--bd)'}`,
          fontSize: '0.76rem',
          background: active ? 'rgba(193,127,58,0.04)' : '#fff',
          color: active ? 'var(--br)' : 'var(--ts)',
          cursor: 'pointer',
          textAlign: 'left',
          minHeight: compact ? 28 : 32,
          minWidth: width || 0,
          fontWeight: active && !open ? 600 : 400,
          boxShadow: open && !active ? '0 0 0 2px rgba(144,164,174,0.15)' : 'none',
          outline: 'none',
          position: 'relative',
          boxSizing: 'border-box',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
        title={summary}
      >
        {summary}
        <span style={{ position: 'absolute', right: 6, top: '50%', transform: 'translateY(-50%)', fontSize: '0.55rem', color: 'var(--tm)' }}>▼</span>
      </button>
      {open && pos && createPortal(
        <div ref={popRef} style={{
          position: 'fixed', top: pos.top, left: pos.left, minWidth: pos.width, width: 'max-content', maxWidth: 360,
          zIndex: 9999, background: '#fff', border: '1.5px solid var(--ac)', borderTop: 'none',
          borderRadius: '0 0 6px 6px', boxShadow: '0 6px 16px rgba(0,0,0,0.12)',
          maxHeight: 320, overflowY: 'auto',
        }}
        onMouseDown={e => e.preventDefault()}>
          {options.length === 0 ? (
            <div style={{ padding: '8px 10px', fontSize: '0.72rem', color: 'var(--tm)', textAlign: 'center' }}>Không có giá trị</div>
          ) : options.map(o => (
            <label key={o.value} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 10px', fontSize: '0.76rem', cursor: 'pointer', borderBottom: '1px solid var(--bgs)', whiteSpace: 'nowrap' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bgs)'}
              onMouseLeave={e => e.currentTarget.style.background = '#fff'}>
              <input type="checkbox" checked={selected?.has(o.value) || false} onChange={() => toggle(o.value)} style={{ accentColor: 'var(--ac)' }} />
              <span style={{ flex: 1 }}>{o.label}</span>
              {o.count != null && <span style={{ color: 'var(--tm)', fontSize: '0.66rem' }}>({o.count})</span>}
            </label>
          ))}
          {options.length > 0 && (
            <div style={{ display: 'flex', gap: 6, padding: '6px 8px', background: 'var(--bgs)', borderTop: '1px solid var(--bd)', position: 'sticky', bottom: 0 }}>
              <button type="button" onClick={selectAll} style={{ flex: 1, padding: '4px 6px', border: '1px solid var(--bd)', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.66rem', fontWeight: 600 }}>Chọn hết</button>
              <button type="button" onClick={clearAll} style={{ flex: 1, padding: '4px 6px', border: '1px solid var(--bd)', borderRadius: 4, background: '#fff', cursor: 'pointer', fontSize: '0.66rem', fontWeight: 600 }}>Bỏ chọn</button>
            </div>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
