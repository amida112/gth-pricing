import React, { useState, useMemo } from "react";
import { bpk, cart } from "../utils";
import { WoodPicker } from "../components/Matrix";

export default function PgSKU({ wts, cfg, prices, bundles = [] }) {
  const [sw, setSw] = useState(wts[0]?.id);
  const wc = cfg[sw] || { attrs: [], attrValues: {} };

  // V-14: tính tồn kho (m³) per bpk key
  const inventoryMap = useMemo(() => {
    const map = {};
    bundles.forEach(b => {
      if (b.status === 'Đã bán') return;
      const key = bpk(b.woodId || b.wood_id, b.attributes);
      map[key] = (map[key] || 0) + (parseFloat(b.remainingVolume ?? b.remaining_volume) || 0);
    });
    return map;
  }, [bundles]);

  const list = useMemo(() => {
    if (!wc.attrs.length) return [];
    const arrays = wc.attrs.map(ak => (wc.attrValues[ak] || []).map(v => ({ key: ak, value: v })));
    return cart(arrays).map(combo => {
      const a = Object.fromEntries(combo.map(c => [c.key, c.value]));
      const pk = bpk(sw, a);
      return { code: sw.toUpperCase().slice(0, 3) + "-" + combo.map(c => c.value.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 5)).join("-"), a, pk, price: prices[pk]?.price, inventory: inventoryMap[pk] || 0 };
    });
  }, [sw, wc, prices, inventoryMap]);

  const pc = list.filter(s => s.price != null);
  const hasStock = list.filter(s => s.inventory > 0).length;

  const th = { padding: "6px 8px", background: "var(--bgh)", borderBottom: "2px solid var(--bds)", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--brl)", fontWeight: 700, textAlign: "left" };

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>🏷️ SKU</h2>
      <WoodPicker wts={wts} sel={sw} onSel={setSw} />
      <p style={{ fontSize: "0.78rem", marginBottom: 12 }}>
        Tổng: <b>{list.length}</b> — Có giá: <b style={{ color: "var(--gn)" }}>{pc.length}</b> — Còn hàng: <b style={{ color: "var(--ac)" }}>{hasStock}</b>
      </p>
      <div style={{ borderRadius: 10, background: "var(--bgc)", border: "1px solid var(--bd)", overflow: "hidden", maxHeight: 500, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.75rem" }}>
          <thead>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Mã</th>
              {wc.attrs.map(ak => <th key={ak} style={th}>{ak}</th>)}
              <th style={{ ...th, textAlign: "right" }}>Giá (tr/m³)</th>
              <th style={{ ...th, textAlign: "right" }}>Tồn kho (m³)</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s, i) => (
              <tr key={i} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", color: "var(--tm)", fontSize: "0.65rem" }}>{i + 1}</td>
                <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", fontWeight: 700, fontSize: "0.68rem", color: "var(--br)", fontFamily: "monospace" }}>{s.code}</td>
                {wc.attrs.map(ak => <td key={ak} style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", fontSize: "0.72rem" }}>{s.a[ak]}</td>)}
                <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 700, color: s.price != null ? "var(--ac)" : "var(--tm)" }}>
                  {s.price != null ? s.price.toFixed(1) : "—"}
                </td>
                <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 600, color: s.inventory > 0 ? "var(--gn)" : "var(--tm)" }}>
                  {s.inventory > 0 ? s.inventory.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
