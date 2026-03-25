import React, { useState, useMemo } from "react";
import { bpk, cart, getPriceGroupValues, resolvePriceAttrs, isPerBundle, isM2Wood, autoGrp } from "../utils";
import { WoodPicker } from "../components/Matrix";

export default function PgSKU({ wts, cfg, prices, bundles = [], ugPersist }) {
  const [sw, setSw] = useState(wts[0]?.id);
  const wc = cfg[sw] || { attrs: [], attrValues: {} };
  const isPerBundleWood = isPerBundle(sw, wts);
  const isM2 = isM2Wood(sw, wts);

  // autoGrp cho thickness khi ugPersist bật
  const grps = useMemo(() => ugPersist ? autoGrp(sw, wc, prices) : null, [ugPersist, sw, wc, prices]);
  const thicknessToGroupLabel = useMemo(() => {
    if (!grps) return null;
    const m = {};
    grps.forEach(g => g.members.forEach(t => { m[t] = g.label; }));
    return m;
  }, [grps]);

  // Effective wc with grouped thickness values
  const effectiveWc = useMemo(() => {
    if (!grps || !wc.attrValues?.thickness) return wc;
    return { ...wc, attrValues: { ...wc.attrValues, thickness: grps.map(g => g.label) } };
  }, [wc, grps]);

  // V-14: tính tồn kho (m³) per bpk key
  const inventoryMap = useMemo(() => {
    const map = {};
    bundles.forEach(b => {
      if (b.status === 'Đã bán') return;
      const wid = b.woodId || b.wood_id;
      const resolved = resolvePriceAttrs(wid, b.attributes, cfg);
      // Gộp dày: map thickness thực → group label
      if (thicknessToGroupLabel && resolved.thickness) {
        const gl = thicknessToGroupLabel[resolved.thickness];
        if (gl) resolved.thickness = gl;
      }
      const key = bpk(wid, resolved);
      map[key] = (map[key] || 0) + (parseFloat(b.remainingVolume ?? b.remaining_volume) || 0);
    });
    return map;
  }, [bundles, cfg, thicknessToGroupLabel]);

  const list = useMemo(() => {
    if (!effectiveWc.attrs.length) return [];
    const arrays = effectiveWc.attrs.map(ak => getPriceGroupValues(ak, effectiveWc).map(v => ({ key: ak, value: v })));
    return cart(arrays).map(combo => {
      const a = Object.fromEntries(combo.map(c => [c.key, c.value]));
      const pk = bpk(sw, a);
      // Khi grouped: giá lấy từ member đầu tiên
      let priceVal = prices[pk]?.price;
      let price2Val = prices[pk]?.price2;
      if (priceVal == null && grps && a.thickness) {
        const g = grps.find(gr => gr.label === a.thickness);
        if (g) {
          const memberKey = bpk(sw, { ...a, thickness: g.members[0] });
          priceVal = prices[memberKey]?.price;
          price2Val = prices[memberKey]?.price2;
        }
      }
      return { code: sw.toUpperCase().slice(0, 3) + "-" + combo.map(c => c.value.replace(/[^a-zA-Z0-9.]/g, "").slice(0, 5)).join("-"), a, pk, price: priceVal, price2: price2Val, inventory: inventoryMap[pk] || 0 };
    });
  }, [sw, effectiveWc, prices, inventoryMap, grps]);

  const pc = list.filter(s => s.price != null);
  const hasStock = list.filter(s => s.inventory > 0).length;

  const th = { padding: "6px 8px", background: "var(--bgh)", borderBottom: "2px solid var(--bds)", fontSize: "0.65rem", textTransform: "uppercase", color: "var(--brl)", fontWeight: 700, textAlign: "left" };

  return (
    <div>
      <h2 style={{ margin: "0 0 16px", fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>🏷️ SKU</h2>
      <WoodPicker wts={wts} sel={sw} onSel={setSw} />
      {isPerBundleWood ? (
        <div style={{ padding: "14px 18px", borderRadius: 10, background: "rgba(139,92,246,0.06)", border: "1px solid rgba(139,92,246,0.2)", fontSize: "0.8rem", color: "#7C5CBF", lineHeight: 1.6 }}>
          <strong>Định giá theo kiện (perBundle)</strong> — Loại gỗ này không dùng bảng giá SKU tổng hợp.<br />
          Giá được lưu trực tiếp trên từng kiện gỗ trong <strong>Kho</strong>. Xem và cập nhật giá tại màn hình Bảng giá hoặc Kho gỗ.
        </div>
      ) : (
      <>
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
              <th style={{ ...th, textAlign: "right" }}>{isM2 ? "Giá (k/m²)" : "Giá (tr/m³)"}</th>
              <th style={{ ...th, textAlign: "right" }}>{isM2 ? "Tồn kho (m²)" : "Tồn kho (m³)"}</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s, i) => (
              <tr key={i} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", color: "var(--tm)", fontSize: "0.65rem" }}>{i + 1}</td>
                <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", fontWeight: 700, fontSize: "0.68rem", color: "var(--br)", fontFamily: "monospace" }}>{s.code}</td>
                {wc.attrs.map(ak => <td key={ak} style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", fontSize: "0.72rem" }}>{s.a[ak]}</td>)}
                <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 700, color: s.price != null ? "var(--ac)" : "var(--tm)" }}>
                  {s.price != null
                    ? (isM2
                        ? <>{s.price.toFixed(0)}{s.price2 != null && <span style={{ color: "var(--tm)", fontWeight: 500 }}>/{s.price2.toFixed(0)}</span>}</>
                        : s.price.toFixed(1))
                    : "—"}
                </td>
                <td style={{ padding: "5px 8px", borderBottom: "1px solid var(--bd)", textAlign: "right", fontWeight: 600, color: s.inventory > 0 ? "var(--gn)" : "var(--tm)" }}>
                  {s.inventory > 0 ? s.inventory.toLocaleString('vi-VN', { maximumFractionDigits: isM2 ? 2 : 3 }) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
}
