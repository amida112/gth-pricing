import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';

// Inject placeholder style once
const STYLE_ID = 'combo-filter-css';
if (typeof document !== 'undefined' && !document.getElementById(STYLE_ID)) {
  const s = document.createElement('style');
  s.id = STYLE_ID;
  s.textContent = '.combo-filter-input::placeholder{font-size:0.66rem;color:#b8a898}';
  document.head.appendChild(s);
}

/**
 * ComboFilter — input kết hợp dropdown, thay thế input+datalist
 *
 * Props:
 *  - value: giá trị hiện tại
 *  - onChange: (val) => void
 *  - options: string[] — danh sách giá trị gợi ý
 *  - placeholder: text placeholder
 */
export default function ComboFilter({ value, onChange, options = [], placeholder, strict }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [hlIdx, setHlIdx] = useState(-1);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const filtered = query
    ? options.filter(v => v.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Compute dropdown position from input rect
  const updatePos = useCallback(() => {
    if (!inputRef.current) return;
    const r = inputRef.current.getBoundingClientRect();
    setPos({ top: r.bottom, left: r.left, minWidth: r.width });
  }, []);

  const handleFocus = () => {
    setQuery('');
    setHlIdx(-1);
    updatePos();
    setOpen(true);
  };

  const select = useCallback((val) => {
    onChange(val);
    setQuery('');
    setOpen(false);
    setHlIdx(-1);
    inputRef.current?.blur();
  }, [onChange]);

  const handleInput = (e) => {
    const v = e.target.value;
    setQuery(v);
    if (!strict) onChange(v);
    setHlIdx(-1);
    if (!open) { updatePos(); setOpen(true); }
  };

  const handleKeyDown = (e) => {
    if (!open) { if (e.key === 'ArrowDown') { updatePos(); setOpen(true); e.preventDefault(); } return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHlIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHlIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (hlIdx >= 0 && filtered[hlIdx]) select(filtered[hlIdx]);
      else setOpen(false);
    } else if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  // Scroll highlighted option into view
  useEffect(() => {
    if (hlIdx >= 0 && listRef.current) {
      const el = listRef.current.children[hlIdx];
      if (el) el.scrollIntoView({ block: 'nearest' });
    }
  }, [hlIdx]);

  // Close on click outside or scroll
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target) &&
          (!listRef.current || !listRef.current.contains(e.target))) { setOpen(false); setQuery(''); }
    };
    const onScroll = () => { if (open) updatePos(); };
    document.addEventListener('mousedown', close);
    window.addEventListener('scroll', onScroll, true);
    return () => { document.removeEventListener('mousedown', close); window.removeEventListener('scroll', onScroll, true); };
  }, [open, updatePos]);

  const hasValue = !!value;

  // Highlight matching text
  const renderOption = (val) => {
    if (!query) return val;
    const idx = val.toLowerCase().indexOf(query.toLowerCase());
    if (idx < 0) return val;
    return <>{val.slice(0, idx)}<b style={{ color: 'var(--ac)', fontWeight: 700 }}>{val.slice(idx, idx + query.length)}</b>{val.slice(idx + query.length)}</>;
  };

  const dropdownStyle = {
    position: 'fixed', top: pos?.top || 0, left: pos?.left || 0,
    minWidth: pos?.minWidth || 100, width: 'max-content', zIndex: 9999,
    background: '#fff', border: '1.5px solid var(--ac)', borderTop: 'none',
    borderRadius: '0 0 6px 6px', boxShadow: '0 6px 16px rgba(0,0,0,0.1)',
    maxHeight: 180, overflowY: 'auto',
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        className="combo-filter-input"
        value={open ? query : (value || '')}
        onChange={handleInput}
        onFocus={handleFocus}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        style={{
          width: '100%', padding: hasValue ? '5px 22px 5px 8px' : '5px 8px', borderRadius: 5,
          border: `1.5px solid ${hasValue ? 'var(--ac)' : open ? '#90a4ae' : 'var(--bd)'}`,
          fontSize: '0.76rem', outline: 'none', background: hasValue ? 'rgba(193,127,58,0.04)' : '#fff',
          color: 'var(--br)', minHeight: 28, boxSizing: 'border-box',
          fontWeight: hasValue && !open ? 600 : 400,
          boxShadow: open && !hasValue ? '0 0 0 2px rgba(144,164,174,0.15)' : 'none',
          transition: 'border-color 0.12s, box-shadow 0.12s',
        }}
      />
      {hasValue && !open && (
        <button
          onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); onChange(''); inputRef.current?.focus(); }}
          style={{
            position: 'absolute', right: 3, top: '50%', transform: 'translateY(-50%)',
            width: 16, height: 16, padding: 0, border: 'none', borderRadius: '50%',
            background: 'rgba(0,0,0,0.08)', color: 'var(--tm)', fontSize: '0.58rem',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.12s',
          }}
        >✕</button>
      )}
      {open && filtered.length > 0 && pos && createPortal(
        <div
          ref={listRef}
          style={dropdownStyle}
          onMouseDown={e => e.preventDefault()}
        >
          {filtered.map((v, i) => (
            <div
              key={v}
              onMouseDown={(e) => { e.preventDefault(); select(v); }}
              style={{
                padding: '6px 10px', fontSize: '0.76rem', cursor: 'pointer', whiteSpace: 'nowrap',
                background: i === hlIdx ? 'rgba(193,127,58,0.1)' : 'transparent',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--bgs)' : 'none',
                transition: 'background 0.08s',
              }}
              onMouseEnter={() => setHlIdx(i)}
            >
              {renderOption(v)}
            </div>
          ))}
        </div>,
        document.body
      )}
      {open && query && filtered.length === 0 && options.length > 0 && pos && createPortal(
        <div
          style={{ ...dropdownStyle, padding: '8px 10px', fontSize: '0.72rem', color: 'var(--tm)', textAlign: 'center', width: pos?.minWidth || 100 }}
          onMouseDown={e => e.preventDefault()}
        >
          Không tìm thấy
        </div>,
        document.body
      )}
    </div>
  );
}
