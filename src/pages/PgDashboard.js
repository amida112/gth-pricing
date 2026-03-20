import React, { useState, useEffect, useMemo } from "react";

// ── Hằng số ───────────────────────────────────────────────────────────────────

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const LOW_INVENTORY_THRESHOLD = 5; // m³ — cảnh báo khi một loại gỗ < ngưỡng này
const COLORS = ['#F26522', '#5A3E2B', '#324F27', '#7C5CBF', '#2196F3', '#E91E63', '#009688', '#FF9800'];

// ── Tiện ích ──────────────────────────────────────────────────────────────────

/** Chuyển ISO datetime sang ngày YYYY-MM-DD theo giờ Việt Nam (UTC+7) */
function toVNDate(isoStr) {
  if (!isoStr) return '';
  return new Date(new Date(isoStr).getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

function fmtM3(n) {
  return (parseFloat(n) || 0).toLocaleString('vi-VN', { maximumFractionDigits: 2 });
}

function fmtMoney(n) {
  const v = parseFloat(n) || 0;
  if (v >= 1e9) return (v / 1e9).toLocaleString('vi-VN', { maximumFractionDigits: 2 }) + ' tỷ';
  if (v >= 1e6) return (v / 1e6).toLocaleString('vi-VN', { maximumFractionDigits: 1 }) + ' tr';
  return v.toLocaleString('vi-VN') + ' đ';
}

function fmtRevTick(v) {
  if (v >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (v >= 1e6) return (v / 1e6).toFixed(0) + 'M';
  if (v >= 1e3) return (v / 1e3).toFixed(0) + 'K';
  return v.toFixed(0);
}

// ── UI Components ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 120, color: '#A89B8E', fontSize: '0.82rem' }}>
      Chưa có dữ liệu
    </div>
  );
}

function Card({ children, style }) {
  return (
    <div style={{ background: '#FFF', border: '1px solid #E8DFD3', borderRadius: 10, padding: '18px 20px', ...style }}>
      {children}
    </div>
  );
}

function CardTitle({ children }) {
  return (
    <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#A89B8E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
      {children}
    </div>
  );
}

// ── Tooltip helper ────────────────────────────────────────────────────────────

function ChartTooltip({ tt }) {
  if (!tt) return null;
  return (
    <div style={{ position: 'absolute', left: tt.x + 12, top: tt.y - 10, background: '#2D2016', color: '#FFF', borderRadius: 6, padding: '6px 10px', fontSize: '0.71rem', pointerEvents: 'none', zIndex: 200, boxShadow: '0 2px 10px rgba(0,0,0,0.22)', whiteSpace: 'nowrap', lineHeight: 1.6 }}>
      {tt.lines.map((l, i) => <div key={i}>{l}</div>)}
    </div>
  );
}

// ── Chart: Horizontal Bar (Top 5 loại gỗ bán) ────────────────────────────────

function HBarChart({ data }) {
  const [tt, setTt] = useState(null);
  if (!data || data.length === 0) return <EmptyState />;
  const max = Math.max(...data.map(d => d.value), 0.001);
  const BAR_H = 22, GAP = 8;
  const LABEL_W = 100, VAL_W = 70;
  const W = 460, BAR_MAX = W - LABEL_W - VAL_W - 12;
  const totalH = data.length * (BAR_H + GAP) + 4;

  const handleMove = (e, lines) => {
    const rect = e.currentTarget.closest('svg').parentElement.getBoundingClientRect();
    setTt({ x: e.clientX - rect.left, y: e.clientY - rect.top, lines });
  };

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${totalH}`} style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => setTt(null)}>
        {data.map((d, i) => {
          const y = i * (BAR_H + GAP);
          const bw = Math.max((d.value / max) * BAR_MAX, 3);
          const lbl = d.label.length > 13 ? d.label.slice(0, 12) + '…' : d.label;
          const lines = [d.label, `${d.value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m³`];
          return (
            <g key={i}>
              <text x={0} y={y + BAR_H / 2 + 4} fontSize={11} fill="#6B5B4E" fontFamily="DM Sans,sans-serif">{lbl}</text>
              <rect
                x={LABEL_W} y={y + 2} width={bw} height={BAR_H - 4}
                fill={d.color || COLORS[i % COLORS.length]} rx={3} opacity={0.88}
                style={{ cursor: 'pointer' }}
                onMouseEnter={e => handleMove(e, lines)}
                onMouseMove={e => handleMove(e, lines)}
              />
              <text x={LABEL_W + bw + 6} y={y + BAR_H / 2 + 4} fontSize={11} fill="#2D2016" fontFamily="DM Sans,sans-serif" fontWeight={600}>
                {d.value.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} m³
              </text>
            </g>
          );
        })}
      </svg>
      <ChartTooltip tt={tt} />
    </div>
  );
}

// ── Chart: Donut (Phân bổ tồn kho) ───────────────────────────────────────────

function DonutChart({ data, totalM3 }) {
  const [tt, setTt] = useState(null);
  if (!data || data.length === 0) return <EmptyState />;
  const total = data.reduce((s, d) => s + d.value, 0);
  if (total === 0) return <EmptyState />;

  const SZ = 160, cx = SZ / 2, cy = SZ / 2, R = SZ * 0.4, RI = R * 0.58;
  let angle = -Math.PI / 2;

  function pt(a, r) { return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) }; }
  function arcPath(sa, ea, ro, ri) {
    const s1 = pt(sa, ro), e1 = pt(ea, ro), s2 = pt(ea, ri), e2 = pt(sa, ri);
    const large = ea - sa > Math.PI ? 1 : 0;
    return `M${s1.x} ${s1.y} A${ro} ${ro} 0 ${large} 1 ${e1.x} ${e1.y} L${s2.x} ${s2.y} A${ri} ${ri} 0 ${large} 0 ${e2.x} ${e2.y}Z`;
  }

  const slices = data.map((d, i) => {
    const sweep = (d.value / total) * 2 * Math.PI;
    const sa = angle, ea = angle + sweep;
    angle = ea;
    return { ...d, sa, ea, color: d.color || COLORS[i % COLORS.length] };
  });

  const handleMove = (e, s) => {
    const rect = e.currentTarget.closest('svg').parentElement.getBoundingClientRect();
    const pct = ((s.value / total) * 100).toFixed(1);
    setTt({ x: e.clientX - rect.left, y: e.clientY - rect.top, lines: [s.label, `${fmtM3(s.value)} m³ (${pct}%)`] });
  };

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <svg width={SZ} height={SZ} viewBox={`0 0 ${SZ} ${SZ}`} onMouseLeave={() => setTt(null)}>
        {slices.map((s, i) => (
          <path key={i} d={arcPath(s.sa, s.ea, R, RI)} fill={s.color} style={{ cursor: 'pointer' }}
            onMouseEnter={e => handleMove(e, s)} onMouseMove={e => handleMove(e, s)} />
        ))}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize={10} fill="#A89B8E" fontFamily="DM Sans,sans-serif">Tổng kho</text>
        <text x={cx} y={cy + 11} textAnchor="middle" fontSize={12} fill="#2D2016" fontWeight="700" fontFamily="DM Sans,sans-serif">
          {fmtM3(totalM3)} m³
        </text>
      </svg>
      <ChartTooltip tt={tt} />
    </div>
  );
}

function DonutLegend({ items }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {items.map((it, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.72rem' }}>
          <div style={{ width: 10, height: 10, borderRadius: 2, background: it.color || COLORS[i % COLORS.length], flexShrink: 0 }} />
          <span style={{ color: '#5A3E2B', fontWeight: 600 }}>{it.label}</span>
          <span style={{ color: '#A89B8E' }}>{fmtM3(it.value)} m³</span>
          {it.isLow && (
            <span style={{ background: '#FFF3CD', color: '#856404', borderRadius: 4, padding: '1px 5px', fontSize: '0.65rem', fontWeight: 700 }}>
              ⚠ Thấp
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Chart: Dual Axis (Bar = doanh thu, Line = thể tích) ──────────────────────

function DualChart({ data }) {
  const [tt, setTt] = useState(null);
  if (!data || data.length === 0) return <EmptyState />;

  const W = 520, H = 210;
  const PL = 52, PR = 44, PT = 16, PB = 36;
  const CW = W - PL - PR, CH = H - PT - PB;

  const maxRev = Math.max(...data.map(d => d.revenue), 1);
  const maxVol = Math.max(...data.map(d => d.volume), 0.001);
  const slotW = CW / data.length;
  const bw = Math.max(Math.floor(slotW) - 2, 3);

  const revTicks = [0, 0.25, 0.5, 0.75, 1];
  const volTicks = [0, 0.5, 1];

  const linePoints = data.map((d, i) => {
    const x = PL + (i + 0.5) * slotW;
    const y = PT + CH - (d.volume / maxVol) * CH;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const step = data.length > 20 ? Math.ceil(data.length / 10) : data.length > 12 ? 2 : 1;

  const handleMove = (e, d) => {
    const rect = e.currentTarget.closest('svg').parentElement.getBoundingClientRect();
    setTt({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      lines: [d.label, `Doanh thu: ${fmtMoney(d.revenue)}`, `Thể tích: ${fmtM3(d.volume)} m³`],
    });
  };

  return (
    <div style={{ position: 'relative' }}>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ display: 'block', overflow: 'visible' }} onMouseLeave={() => setTt(null)}>
        {/* Grid lines */}
        {revTicks.map((t, i) => (
          <line key={i} x1={PL} y1={PT + CH - t * CH} x2={PL + CW} y2={PT + CH - t * CH} stroke="#F0E8DC" strokeWidth={1} />
        ))}

        {/* Bars — revenue */}
        {data.map((d, i) => {
          const x = PL + i * slotW + (slotW - bw) / 2;
          const bh = (d.revenue / maxRev) * CH;
          return (
            <rect key={i} x={x} y={PT + CH - bh} width={bw} height={bh} fill="#F26522" opacity={0.82} rx={2}
              style={{ cursor: 'pointer' }}
              onMouseEnter={e => handleMove(e, d)} onMouseMove={e => handleMove(e, d)} />
          );
        })}

        {/* Line — volume */}
        <polyline points={linePoints} fill="none" stroke="#324F27" strokeWidth={2} strokeLinejoin="round" />
        {data.map((d, i) => {
          const x = PL + (i + 0.5) * slotW;
          const y = PT + CH - (d.volume / maxVol) * CH;
          return (
            <circle key={i} cx={x} cy={y} r={4} fill="#324F27" style={{ cursor: 'pointer' }}
              onMouseEnter={e => handleMove(e, d)} onMouseMove={e => handleMove(e, d)} />
          );
        })}

        {/* X labels */}
        {data.map((d, i) => {
          if (i % step !== 0) return null;
          return (
            <text key={i} x={PL + (i + 0.5) * slotW} y={PT + CH + 13} textAnchor="middle" fontSize={9} fill="#A89B8E" fontFamily="DM Sans,sans-serif">
              {d.label}
            </text>
          );
        })}

        {/* Left Y — revenue (VND) */}
        {revTicks.map((t, i) => (
          <text key={i} x={PL - 4} y={PT + CH - t * CH + 4} textAnchor="end" fontSize={9} fill="#A89B8E" fontFamily="DM Sans,sans-serif">
            {fmtRevTick(maxRev * t)}
          </text>
        ))}

        {/* Right Y — volume (m³) */}
        {volTicks.map((t, i) => (
          <text key={i} x={PL + CW + 4} y={PT + CH - t * CH + 4} textAnchor="start" fontSize={9} fill="#324F27" fontFamily="DM Sans,sans-serif">
            {(maxVol * t).toFixed(1)}
          </text>
        ))}

        {/* Axes */}
        <line x1={PL} y1={PT} x2={PL} y2={PT + CH} stroke="#D4C8B8" strokeWidth={1} />
        <line x1={PL} y1={PT + CH} x2={PL + CW} y2={PT + CH} stroke="#D4C8B8" strokeWidth={1} />
        <line x1={PL + CW} y1={PT} x2={PL + CW} y2={PT + CH} stroke="#E8DFD3" strokeWidth={1} strokeDasharray="3,3" />
      </svg>
      <ChartTooltip tt={tt} />
    </div>
  );
}

function DualChartLegend() {
  return (
    <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: '#6B5B4E' }}>
        <div style={{ width: 12, height: 8, background: '#F26522', borderRadius: 2, opacity: 0.82 }} />
        Doanh thu (VND) — trái
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: '0.7rem', color: '#6B5B4E' }}>
        <svg width={20} height={10}><line x1={0} y1={5} x2={20} y2={5} stroke="#324F27" strokeWidth={2} /><circle cx={10} cy={5} r={2.5} fill="#324F27" /></svg>
        Thể tích (m³) — phải
      </div>
    </div>
  );
}

// ── Banner cảnh báo tồn kho thấp ─────────────────────────────────────────────

function LowInventoryAlert({ items }) {
  if (!items || items.length === 0) return null;
  return (
    <div style={{ background: '#FFF8E1', border: '1px solid #FFD54F', borderRadius: 8, padding: '10px 16px', marginBottom: 16, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ fontSize: '1rem', flexShrink: 0, marginTop: 1 }}>⚠️</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.8rem', color: '#5D4037', marginBottom: 3 }}>
          Cảnh báo tồn kho thấp (dưới {LOW_INVENTORY_THRESHOLD} m³)
        </div>
        <div style={{ fontSize: '0.75rem', color: '#795548', display: 'flex', flexWrap: 'wrap', gap: '4px 12px' }}>
          {items.map((it, i) => (
            <span key={i}>
              <strong>{it.name}</strong>: {fmtM3(it.volume)} m³
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main Dashboard Component ──────────────────────────────────────────────────

export default function PgDashboard({ wts, role, useAPI, notify, onNavigate }) {
  const [raw, setRaw] = useState(null);
  const [loading, setLoading] = useState(true);
  const [topDays, setTopDays] = useState(30);
  const [refresh, setRefresh] = useState(0);

  const canSeeSales = role === 'admin' || role === 'banhang';
  const canSeeInventory = role === 'admin' || role === 'kho';

  useEffect(() => {
    if (!useAPI) { setLoading(false); return; }
    setLoading(true);
    import('../api.js').then(api =>
      api.fetchDashboardData()
        .then(d => { setRaw(d); setLoading(false); })
        .catch(err => { notify('Lỗi tải dashboard: ' + err.message, false); setLoading(false); })
    );
  }, [useAPI, refresh]); // eslint-disable-line

  // ── Xử lý dữ liệu client-side ─────────────────────────────────────────────
  const metrics = useMemo(() => {
    if (!raw) return null;

    // Index order_items theo order_id
    const itemsByOrder = {};
    (raw.orderItems || []).forEach(it => {
      if (!itemsByOrder[it.order_id]) itemsByOrder[it.order_id] = [];
      itemsByOrder[it.order_id].push(it);
    });

    // Set các loại gỗ đơn vị m² — loại khỏi mọi thống kê m³
    const m2Ids = new Set(wts.filter(w => w.unit === 'm2').map(w => w.id));

    // ── Tồn kho ──────────────────────────────────────────────────────────────
    const invByWood = {};
    (raw.inventory || []).forEach(b => {
      if (m2Ids.has(b.wood_id)) return;
      invByWood[b.wood_id] = (invByWood[b.wood_id] || 0) + (parseFloat(b.remaining_volume) || 0);
    });
    const totalInventory = Object.values(invByWood).reduce((s, v) => s + v, 0);

    // Cảnh báo tồn kho thấp
    const lowInventory = Object.entries(invByWood)
      .filter(([, v]) => v > 0 && v < LOW_INVENTORY_THRESHOLD)
      .map(([woodId, volume]) => ({
        name: wts.find(w => w.id === woodId)?.name || woodId,
        volume,
      }));

    // Donut tồn kho
    const inventoryDonut = Object.entries(invByWood)
      .filter(([, v]) => v > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([woodId, vol], i) => ({
        label: wts.find(w => w.id === woodId)?.name || woodId,
        value: parseFloat(vol.toFixed(3)),
        color: COLORS[i % COLORS.length],
        isLow: vol < LOW_INVENTORY_THRESHOLD,
      }));

    // ── Top 5 loại gỗ bán trong topDays ngày (lọc client-side từ 12 tháng) ──
    // Dùng toVNDate() để so sánh đúng múi giờ VN
    const cutoffVN = new Date(Date.now() + VN_OFFSET_MS - topDays * 86400000).toISOString().slice(0, 10);
    const soldByWood = {};
    (raw.allOrders || []).forEach(o => {
      if (toVNDate(o.payment_date) < cutoffVN) return;
      (itemsByOrder[o.id] || []).forEach(it => {
        if (m2Ids.has(it.wood_id)) return;
        soldByWood[it.wood_id] = (soldByWood[it.wood_id] || 0) + (parseFloat(it.volume) || 0);
      });
    });
    const top5 = Object.entries(soldByWood)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([woodId, vol], i) => ({
        label: wts.find(w => w.id === woodId)?.name || woodId,
        value: parseFloat(vol.toFixed(3)),
        color: COLORS[i],
      }));

    // ── Daily: 30 ngày gần nhất (theo giờ VN) ────────────────────────────────
    const dailyMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() + VN_OFFSET_MS - i * 86400000);
      const key = d.toISOString().slice(0, 10);
      const lbl = `${String(d.getUTCDate()).padStart(2, '0')}/${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      dailyMap[key] = { label: lbl, revenue: 0, volume: 0 };
    }
    (raw.allOrders || []).forEach(o => {
      const day = toVNDate(o.payment_date); // đúng múi giờ VN
      if (!dailyMap[day]) return;
      dailyMap[day].revenue += parseFloat(o.total_amount) || 0;
      (itemsByOrder[o.id] || []).forEach(it => {
        if (m2Ids.has(it.wood_id)) return;
        dailyMap[day].volume += parseFloat(it.volume) || 0;
      });
    });
    const dailyData = Object.values(dailyMap);

    // ── Monthly: 12 tháng gần nhất (theo giờ VN) ─────────────────────────────
    const monthlyMap = {};
    (raw.allOrders || []).forEach(o => {
      const dt = new Date(new Date(o.payment_date).getTime() + VN_OFFSET_MS);
      const key = `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}`;
      const lbl = `T${dt.getUTCMonth() + 1}/${String(dt.getUTCFullYear()).slice(-2)}`;
      if (!monthlyMap[key]) monthlyMap[key] = { label: lbl, revenue: 0, volume: 0 };
      monthlyMap[key].revenue += parseFloat(o.total_amount) || 0;
      (itemsByOrder[o.id] || []).forEach(it => {
        if (m2Ids.has(it.wood_id)) return;
        monthlyMap[key].volume += parseFloat(it.volume) || 0;
      });
    });
    const monthlyData = Object.entries(monthlyMap)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([, v]) => v);

    return { totalInventory, lowInventory, inventoryDonut, top5, dailyData, monthlyData };
  }, [raw, wts, topDays]);

  // ── Offline state ──────────────────────────────────────────────────────────
  if (!useAPI) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#A89B8E' }}>
        <div style={{ fontSize: '2.2rem', marginBottom: 10 }}>📊</div>
        <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 4, color: '#5A3E2B' }}>Dashboard chưa khả dụng</div>
        <div style={{ fontSize: '0.82rem' }}>Cần kết nối Supabase để hiển thị dữ liệu thực tế.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ padding: 48, textAlign: 'center', color: '#A89B8E', fontSize: '0.9rem' }}>
        Đang tải dữ liệu dashboard...
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ maxWidth: 1160 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 8 }}>
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#2D2016' }}>Tổng quan</div>
          <div style={{ fontSize: '0.72rem', color: '#A89B8E', marginTop: 2 }}>
            {new Date(Date.now() + VN_OFFSET_MS).toISOString().slice(0, 10).split('-').reverse().join('/')} — giờ Việt Nam
          </div>
        </div>
        <button
          onClick={() => setRefresh(k => k + 1)}
          style={{ border: '1px solid #E8DFD3', background: '#FFF', borderRadius: 6, padding: '6px 14px', fontSize: '0.78rem', cursor: 'pointer', color: '#5A3E2B', fontWeight: 600 }}
        >
          ↻ Làm mới
        </button>
      </div>

      {/* Cảnh báo tồn kho thấp — chỉ admin & kho */}
      {canSeeInventory && metrics?.lowInventory?.length > 0 && (
        <LowInventoryAlert items={metrics.lowInventory} />
      )}

      {/* Metric Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(185px, 1fr))', gap: 12, marginBottom: 16 }}>

        {/* Tổng tồn kho */}
        {canSeeInventory && (
          <Card style={{ cursor: onNavigate ? 'pointer' : 'default' }} onClick={() => onNavigate?.('warehouse')}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#A89B8E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              🏪 Tổng tồn kho
            </div>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#5A3E2B', lineHeight: 1 }}>
              {metrics ? fmtM3(metrics.totalInventory) : '—'}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#A89B8E', marginTop: 5 }}>m³ gỗ kiện còn lại</div>
            {onNavigate && <div style={{ fontSize: '0.6rem', color: '#D4C8B8', marginTop: 4 }}>Xem kho →</div>}
          </Card>
        )}

        {/* Doanh thu hôm nay */}
        {canSeeSales && (
          <Card style={{ cursor: onNavigate ? 'pointer' : 'default' }} onClick={() => onNavigate?.('sales')}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#A89B8E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              💰 Doanh thu hôm nay
            </div>
            <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#F26522', lineHeight: 1.1 }}>
              {raw ? fmtMoney(raw.todayRevenue) : '—'}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#A89B8E', marginTop: 5 }}>Đơn đã thanh toán (giờ VN)</div>
            {onNavigate && <div style={{ fontSize: '0.6rem', color: '#D4C8B8', marginTop: 4 }}>Xem đơn hàng →</div>}
          </Card>
        )}

        {/* Đơn chờ xuất hàng */}
        {canSeeSales && (
          <Card style={{ cursor: onNavigate ? 'pointer' : 'default' }} onClick={() => onNavigate?.('sales')}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#A89B8E', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
              📦 Chờ xuất hàng
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <div style={{ fontSize: '1.8rem', fontWeight: 800, color: raw?.pendingExportCount > 0 ? '#7C5CBF' : '#5A3E2B', lineHeight: 1 }}>
                {raw ? raw.pendingExportCount : '—'}
              </div>
              {raw?.pendingExportCount > 0 && (
                <div style={{ fontSize: '0.72rem', color: '#7C5CBF', fontWeight: 700 }}>đơn</div>
              )}
            </div>
            <div style={{ fontSize: '0.76rem', color: '#A89B8E', marginTop: 5 }}>Đã thanh toán, chưa xuất</div>
            {onNavigate && <div style={{ fontSize: '0.6rem', color: '#D4C8B8', marginTop: 4 }}>Xem đơn hàng →</div>}
          </Card>
        )}
      </div>

      {/* Charts Row 1 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12, marginBottom: 12 }}>

        {/* Top 5 loại gỗ bán */}
        {canSeeSales && (
          <Card>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
              <CardTitle>Top 5 loại gỗ bán (m³)</CardTitle>
              <select
                value={topDays}
                onChange={e => setTopDays(Number(e.target.value))}
                style={{ fontSize: '0.74rem', border: '1px solid #E8DFD3', borderRadius: 5, padding: '3px 8px', background: '#FFF', color: '#5A3E2B', cursor: 'pointer' }}
              >
                <option value={7}>7 ngày</option>
                <option value={30}>30 ngày</option>
                <option value={90}>90 ngày</option>
              </select>
            </div>
            <HBarChart data={metrics?.top5} />
          </Card>
        )}

        {/* Phân bổ tồn kho */}
        {canSeeInventory && (
          <Card>
            <CardTitle>Phân bổ tồn kho theo loại gỗ</CardTitle>
            {metrics?.inventoryDonut?.length > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
                <DonutChart data={metrics.inventoryDonut} totalM3={metrics.totalInventory} />
                <DonutLegend items={metrics.inventoryDonut} />
              </div>
            ) : <EmptyState />}
          </Card>
        )}
      </div>

      {/* Charts Row 2 — chỉ admin & banhang */}
      {canSeeSales && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
          <Card>
            <CardTitle>Doanh thu &amp; Thể tích — 30 ngày gần nhất</CardTitle>
            <DualChart data={metrics?.dailyData} />
            <DualChartLegend />
          </Card>

          <Card>
            <CardTitle>Doanh thu &amp; Thể tích — Theo tháng</CardTitle>
            <DualChart data={metrics?.monthlyData} />
            <DualChartLegend />
          </Card>
        </div>
      )}
    </div>
  );
}
