import React, { useState, useEffect } from "react";
import Dialog from "../components/Dialog";
import { fmtMoney } from "../utils";

const ths = { padding: "6px 8px", textAlign: "left", background: "var(--bgh)", color: "var(--brl)", fontWeight: 700, fontSize: "0.62rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", whiteSpace: "nowrap" };
const tds = { padding: "5px 8px", fontSize: "0.75rem", borderBottom: "1px solid var(--bd)" };
const inputSt = { width: "100%", padding: "6px 8px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.78rem", background: "var(--bg)", color: "var(--tp)", outline: "none", boxSizing: "border-box" };
const labelSt = { fontSize: "0.68rem", fontWeight: 600, color: "var(--ts)", marginBottom: 2, display: "block" };

export default function PgCommissionConfig({ wts = [], ats = [], cfg = {}, useAPI, notify }) {
  const [subTab, setSubTab] = useState("rates"); // rates | overrides | container | settings
  const [woodRates, setWoodRates] = useState([]);
  const [skuOverrides, setSkuOverrides] = useState([]);
  const [containerTiers, setContainerTiers] = useState([]);
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  // Override dialog
  const [ovDlg, setOvDlg] = useState(null); // null | "new" | id
  const [ovFm, setOvFm] = useState({ woodTypeId: "", attrs: {}, pointsPerM3: "", note: "" });

  useEffect(() => {
    if (!useAPI) { setLoading(false); return; }
    Promise.all([
      import("../api.js").then(api => api.fetchCommissionWoodRates()),
      import("../api.js").then(api => api.fetchCommissionSkuOverrides()),
      import("../api.js").then(api => api.fetchCommissionContainerTiers()),
      import("../api.js").then(api => api.fetchCommissionSettings()),
    ]).then(([wr, so, ct, cs]) => {
      setWoodRates(wr || []);
      setSkuOverrides(so || []);
      setContainerTiers(ct || []);
      setSettings(cs || {});
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [useAPI]);

  const getSetting = (key) => settings[key]?.value || 0;

  // ─── Save wood rate ───
  const saveWoodRate = async (woodTypeId, category, value) => {
    const pts = Number(value) || 0;
    setWoodRates(prev => {
      const idx = prev.findIndex(r => r.woodTypeId === woodTypeId && r.category === category);
      if (idx >= 0) return prev.map((r, i) => i === idx ? { ...r, pointsPerM3: pts } : r);
      return [...prev, { id: "tmp_" + Date.now(), woodTypeId, category, pointsPerM3: pts }];
    });
    if (useAPI) {
      const api = await import("../api.js");
      api.upsertCommissionWoodRate(woodTypeId, category, pts);
    }
  };

  // ─── Save setting ───
  const saveSetting = async (key, value) => {
    const val = Number(value) || 0;
    setSettings(prev => ({ ...prev, [key]: { ...prev[key], value: val } }));
    if (useAPI) {
      const api = await import("../api.js");
      api.saveCommissionSetting(key, val, settings[key]?.description || "");
    }
  };

  // ─── Build SKU pattern from selected attrs ───
  const buildPattern = (attrs) => {
    return Object.entries(attrs).filter(([, v]) => v).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}:${v}`).join("||");
  };

  // ─── Save SKU override ───
  const saveOverride = async () => {
    if (!ovFm.woodTypeId || !ovFm.pointsPerM3) return;
    const pattern = buildPattern(ovFm.attrs);
    if (!pattern) { notify("Chọn ít nhất 1 thuộc tính", false); return; }
    const pts = Number(ovFm.pointsPerM3) || 0;
    const api = await import("../api.js");
    if (ovDlg === "new") {
      const r = await api.addCommissionSkuOverride(ovFm.woodTypeId, pattern, pts, ovFm.note);
      if (r?.error) { notify("Lỗi: " + r.error, false); return; }
      setSkuOverrides(prev => [...prev, { id: r.id, woodTypeId: ovFm.woodTypeId, skuPattern: pattern, pointsPerM3: pts, note: ovFm.note }]);
      notify("Đã thêm");
    } else {
      const r = await api.updateCommissionSkuOverride(ovDlg, pattern, pts, ovFm.note);
      if (r?.error) { notify("Lỗi: " + r.error, false); return; }
      setSkuOverrides(prev => prev.map(o => o.id === ovDlg ? { ...o, skuPattern: pattern, pointsPerM3: pts, note: ovFm.note } : o));
      notify("Đã cập nhật");
    }
    setOvDlg(null);
  };

  const deleteOverride = async (id) => {
    if (!window.confirm("Xóa override này?")) return;
    if (useAPI) {
      const api = await import("../api.js");
      const r = await api.deleteCommissionSkuOverride(id);
      if (r?.error) { notify("Lỗi: " + r.error, false); return; }
    }
    setSkuOverrides(prev => prev.filter(o => o.id !== id));
    notify("Đã xóa");
  };

  if (loading) return <div style={{ padding: 16, textAlign: "center", color: "var(--tm)" }}>Đang tải...</div>;

  return (
    <div>
      {/* Sub-tabs */}
      <div style={{ display: "flex", gap: 0, borderBottom: "1.5px solid var(--bd)", marginBottom: 10 }}>
        {[["rates", "Hệ số gỗ"], ["overrides", "Override SKU"], ["container", "Container"], ["settings", "Rate"]].map(([k, lb]) => (
          <button key={k} onClick={() => setSubTab(k)} style={{ padding: "6px 14px", border: "none", borderBottom: subTab === k ? "2px solid var(--ac)" : "2px solid transparent", marginBottom: -1.5, background: "transparent", cursor: "pointer", fontWeight: subTab === k ? 700 : 500, fontSize: "0.72rem", color: subTab === k ? "var(--ac)" : "var(--ts)" }}>{lb}</button>
        ))}
      </div>

      {/* ═══ Sub: Hệ số gỗ ═══ */}
      {subTab === "rates" && (
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--tm)", marginBottom: 8 }}>Hệ số điểm mặc định cho mỗi loại gỗ. Override SKU cụ thể ở tab kế bên.</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...ths, width: 36, textAlign: "center" }}>STT</th>
                <th style={ths}>Loại gỗ</th>
                <th style={{ ...ths, textAlign: "center", width: 120 }}>Gỗ kiện (đ/m³)</th>
              </tr>
            </thead>
            <tbody>
              {wts.map((w, i) => {
                const bundleRate = woodRates.find(r => r.woodTypeId === w.id && r.category === "bundle")?.pointsPerM3 || "";
                return (
                  <tr key={w.id}>
                    <td style={{ ...tds, textAlign: "center", fontSize: "0.68rem", color: "var(--tm)" }}>{i + 1}</td>
                    <td style={{ ...tds, fontWeight: 600 }}>{w.name}</td>
                    <td style={{ ...tds, textAlign: "center", padding: "3px 6px" }}>
                      <input value={bundleRate} onChange={e => {
                        const val = e.target.value;
                        setWoodRates(prev => {
                          const idx = prev.findIndex(r => r.woodTypeId === w.id && r.category === "bundle");
                          if (idx >= 0) return prev.map((r, j) => j === idx ? { ...r, pointsPerM3: val } : r);
                          return [...prev, { id: "tmp_" + Date.now(), woodTypeId: w.id, category: "bundle", pointsPerM3: val }];
                        });
                      }} onBlur={e => saveWoodRate(w.id, "bundle", e.target.value)} style={{ width: 80, padding: "4px 6px", borderRadius: 4, border: "1px solid var(--bd)", fontSize: "0.75rem", textAlign: "center", outline: "none" }} placeholder="0" />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div style={{ marginTop: 10, padding: 8, background: "var(--bgs)", borderRadius: 6, fontSize: "0.72rem", color: "var(--tm)" }}>
            Gỗ tròn/hộp bán lẻ: tính chung 1 hệ số = <strong>{getSetting("raw_retail_rate")}</strong> điểm/m³ (chỉnh ở tab Rate)
          </div>
        </div>
      )}

      {/* ═══ Sub: Override SKU ═══ */}
      {subTab === "overrides" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: "0.72rem", color: "var(--tm)" }}>Hệ số đặc biệt cho SKU cụ thể — ưu tiên hơn hệ số mặc định. Match partial: chỉ cần chứa thuộc tính đã cấu hình.</span>
            <button onClick={() => { setOvDlg("new"); setOvFm({ woodTypeId: wts[0]?.id || "", attrs: {}, pointsPerM3: "", note: "" }); }} style={{ padding: "6px 12px", borderRadius: 6, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.72rem", whiteSpace: "nowrap" }}>+ Thêm</button>
          </div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ ...ths, width: 36, textAlign: "center" }}>STT</th>
                <th style={ths}>Loại gỗ</th>
                <th style={ths}>Pattern</th>
                <th style={{ ...ths, textAlign: "center", width: 80 }}>Hệ số</th>
                <th style={ths}>Ghi chú</th>
                <th style={{ ...ths, width: 60 }} />
              </tr>
            </thead>
            <tbody>
              {skuOverrides.length === 0 && <tr><td colSpan={6} style={{ padding: 16, textAlign: "center", color: "var(--tm)", fontSize: "0.78rem" }}>Chưa có override</td></tr>}
              {skuOverrides.map((o, i) => {
                const wt = wts.find(w => w.id === o.woodTypeId);
                return (
                  <tr key={o.id}>
                    <td style={{ ...tds, textAlign: "center", fontSize: "0.68rem", color: "var(--tm)" }}>{i + 1}</td>
                    <td style={{ ...tds, fontWeight: 600 }}>{wt?.name || o.woodTypeId}</td>
                    <td style={{ ...tds, fontFamily: "monospace", fontSize: "0.68rem" }}>{o.skuPattern.split("||").map(s => <span key={s} style={{ display: "inline-block", padding: "1px 4px", borderRadius: 3, background: "var(--acbg)", color: "var(--ac)", fontSize: "0.6rem", marginRight: 3 }}>{s}</span>)}</td>
                    <td style={{ ...tds, textAlign: "center", fontWeight: 700, color: "var(--ac)" }}>{o.pointsPerM3}</td>
                    <td style={{ ...tds, color: "var(--tm)", fontSize: "0.7rem" }}>{o.note || "—"}</td>
                    <td style={{ ...tds, whiteSpace: "nowrap" }}>
                      <button onClick={() => {
                        const attrs = {};
                        o.skuPattern.split("||").forEach(s => { const [k, v] = s.split(":"); if (k && v) attrs[k] = v; });
                        setOvDlg(o.id); setOvFm({ woodTypeId: o.woodTypeId, attrs, pointsPerM3: String(o.pointsPerM3), note: o.note });
                      }} style={{ padding: "2px 5px", borderRadius: 3, border: "1px solid var(--bd)", background: "transparent", color: "var(--ac)", cursor: "pointer", fontSize: "0.6rem", marginRight: 2 }}>Sửa</button>
                      <button onClick={() => deleteOverride(o.id)} style={{ padding: "2px 5px", borderRadius: 3, border: "1px solid #e74c3c44", background: "transparent", color: "#e74c3c", cursor: "pointer", fontSize: "0.6rem" }}>Xóa</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ═══ Sub: Container tiers ═══ */}
      {subTab === "container" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
            <span style={{ fontSize: "0.72rem", color: "var(--tm)" }}>Hoa hồng bán nguyên container (VNĐ/cont). So sánh giá bán/m³ với giá định/m³.</span>
            <button onClick={async () => {
              const api = await import("../api.js");
              const r = await api.saveContainerTier(null, { isAtPrice: false, isFallback: false, maxBelowPrice: 100000, amount: 0, sortOrder: containerTiers.length + 1 });
              if (r?.error) { notify("Lỗi: " + r.error, false); return; }
              setContainerTiers(prev => [...prev, { id: r.id || "tmp_" + Date.now(), isAtPrice: false, isFallback: false, maxBelowPrice: 100000, amount: 0, sortOrder: prev.length + 1 }]);
            }} style={{ padding: "5px 10px", borderRadius: 5, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: "0.7rem", whiteSpace: "nowrap" }}>+ Thêm mốc</button>
          </div>
          {(() => {
            const saveTier = async (t) => {
              if (!useAPI) return;
              const api = await import("../api.js");
              const r = await api.saveContainerTier(t.id, t);
              if (r?.error) notify("Lỗi: " + r.error, false);
              else notify("Đã lưu");
            };
            const saveAll = async () => {
              if (!useAPI) return;
              const api = await import("../api.js");
              for (const t of containerTiers) { await api.saveContainerTier(t.id, t); }
              notify("Đã lưu tất cả");
            };
            const inpSt = { width: 100, padding: "5px 8px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.78rem", textAlign: "right", outline: "none" };
            return (
              <>
                <table style={{ borderCollapse: "collapse", maxWidth: 560 }}>
                  <thead>
                    <tr>
                      <th style={ths}>Điều kiện</th>
                      <th style={{ ...ths, textAlign: "right", width: 120 }}>Dưới giá tối đa</th>
                      <th style={{ ...ths, textAlign: "right", width: 120 }}>Hoa hồng/cont</th>
                      <th style={{ ...ths, width: 70 }} />
                    </tr>
                  </thead>
                  <tbody>
                    {containerTiers.filter(t => t.isAtPrice).map(t => (
                      <tr key={t.id}>
                        <td style={{ ...tds, fontWeight: 600, color: "#27ae60" }}>Đúng giá trở lên</td>
                        <td style={{ ...tds, textAlign: "center", color: "var(--tm)" }}>—</td>
                        <td style={{ ...tds, textAlign: "right", padding: "4px 6px" }}>
                          <input value={t.amount || ""} onChange={e => setContainerTiers(prev => prev.map(x => x.id === t.id ? { ...x, amount: e.target.value.replace(/[^0-9]/g, "") } : x))} style={{ ...inpSt, fontWeight: 700 }} />
                          {Number(t.amount) > 0 && <div style={{ fontSize: "0.6rem", color: "var(--tm)", textAlign: "right" }}>{fmtMoney(t.amount)}đ</div>}
                        </td>
                        <td style={{ ...tds, textAlign: "center" }}><button onClick={() => saveTier(t)} style={{ padding: "3px 8px", borderRadius: 4, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontSize: "0.65rem", fontWeight: 600 }}>Lưu</button></td>
                      </tr>
                    ))}
                    {containerTiers.filter(t => !t.isAtPrice && !t.isFallback).map(t => (
                      <tr key={t.id}>
                        <td style={{ ...tds, color: "var(--ts)" }}>Dưới giá tối đa</td>
                        <td style={{ ...tds, textAlign: "right", padding: "4px 6px" }}>
                          <input value={t.maxBelowPrice || ""} onChange={e => setContainerTiers(prev => prev.map(x => x.id === t.id ? { ...x, maxBelowPrice: e.target.value.replace(/[^0-9]/g, "") } : x))} style={inpSt} />
                          {Number(t.maxBelowPrice) > 0 && <div style={{ fontSize: "0.6rem", color: "var(--tm)", textAlign: "right" }}>{fmtMoney(t.maxBelowPrice)} đ/m³</div>}
                        </td>
                        <td style={{ ...tds, textAlign: "right", padding: "4px 6px" }}>
                          <input value={t.amount || ""} onChange={e => setContainerTiers(prev => prev.map(x => x.id === t.id ? { ...x, amount: e.target.value.replace(/[^0-9]/g, "") } : x))} style={{ ...inpSt, fontWeight: 700 }} />
                          {Number(t.amount) > 0 && <div style={{ fontSize: "0.6rem", color: "var(--tm)", textAlign: "right" }}>{fmtMoney(t.amount)}đ</div>}
                        </td>
                        <td style={{ ...tds, textAlign: "center", whiteSpace: "nowrap" }}>
                          <button onClick={() => saveTier(t)} style={{ padding: "3px 8px", borderRadius: 4, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontSize: "0.65rem", fontWeight: 600, marginRight: 3 }}>Lưu</button>
                          <button onClick={async () => { if (useAPI) { const api = await import("../api.js"); await api.deleteCommissionContainerTier(t.id); } setContainerTiers(prev => prev.filter(x => x.id !== t.id)); notify("Đã xóa"); }} style={{ padding: "2px 5px", borderRadius: 3, border: "1px solid #e74c3c44", background: "transparent", color: "#e74c3c", cursor: "pointer", fontSize: "0.6rem" }}>✕</button>
                        </td>
                      </tr>
                    ))}
                    {containerTiers.filter(t => t.isFallback).map(t => (
                      <tr key={t.id}>
                        <td style={{ ...tds, fontWeight: 600, color: "#e74c3c" }}>Vượt mốc cuối</td>
                        <td style={{ ...tds, textAlign: "center", color: "var(--tm)" }}>—</td>
                        <td style={{ ...tds, textAlign: "right", padding: "4px 6px" }}>
                          <input value={t.amount || ""} onChange={e => setContainerTiers(prev => prev.map(x => x.id === t.id ? { ...x, amount: e.target.value.replace(/[^0-9]/g, "") } : x))} style={{ ...inpSt, fontWeight: 700 }} />
                          {Number(t.amount) > 0 && <div style={{ fontSize: "0.6rem", color: "var(--tm)", textAlign: "right" }}>{fmtMoney(t.amount)}đ</div>}
                        </td>
                        <td style={{ ...tds, textAlign: "center" }}><button onClick={() => saveTier(t)} style={{ padding: "3px 8px", borderRadius: 4, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontSize: "0.65rem", fontWeight: 600 }}>Lưu</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button onClick={saveAll} style={{ padding: "6px 14px", borderRadius: 6, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.72rem" }}>Lưu tất cả</button>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ═══ Sub: Settings ═══ */}
      {subTab === "settings" && (
        <div>
          <div style={{ fontSize: "0.72rem", color: "var(--tm)", marginBottom: 10 }}>Rate quy đổi điểm → tiền.</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, maxWidth: 500 }}>
            {[
              { key: "staff_rate", label: "NVBH thường (đ/điểm)" },
              { key: "manager_rate", label: "Quản lý BPBH (đ/điểm)" },
              { key: "veneer_rate", label: "Thợ xẻ gỗ lạng (đ/m³)" },
              { key: "raw_retail_rate", label: "Gỗ tròn/hộp lẻ (hệ số điểm/m³)" },
            ].map(s => (
              <div key={s.key}>
                <label style={labelSt}>{s.label}</label>
                <input value={getSetting(s.key) || ""} onChange={e => {
                  setSettings(prev => ({ ...prev, [s.key]: { ...prev[s.key], value: e.target.value } }));
                }} onBlur={e => saveSetting(s.key, e.target.value)} style={{ ...inputSt, textAlign: "right" }} />
                {getSetting(s.key) > 0 && <div style={{ fontSize: "0.62rem", color: "var(--tm)", marginTop: 1 }}>{fmtMoney(getSetting(s.key))}đ</div>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Override Dialog ═══ */}
      {ovDlg && (
        <Dialog open onClose={() => setOvDlg(null)} onOk={saveOverride} title={ovDlg === "new" ? "Thêm Override SKU" : "Sửa Override"} width={500}>
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Loại gỗ</label>
            <select value={ovFm.woodTypeId} onChange={e => setOvFm(p => ({ ...p, woodTypeId: e.target.value, attrs: {} }))} style={inputSt}>
              {wts.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
          </div>
          {/* Chọn thuộc tính — dynamic từ cfg */}
          <div style={{ marginBottom: 10 }}>
            <label style={labelSt}>Thuộc tính (chọn 1 hoặc nhiều — chỉ chọn giá trị cần match)</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {(cfg[ovFm.woodTypeId]?.attrs || []).map(atId => {
                const at = ats.find(a => a.id === atId);
                const values = cfg[ovFm.woodTypeId]?.attrValues?.[atId] || [];
                if (!values.length) return null;
                return (
                  <div key={atId}>
                    <label style={{ fontSize: "0.65rem", color: "var(--tm)" }}>{at?.name || atId}</label>
                    <select value={ovFm.attrs[atId] || ""} onChange={e => setOvFm(p => ({ ...p, attrs: { ...p.attrs, [atId]: e.target.value } }))} style={{ ...inputSt, fontSize: "0.75rem" }}>
                      <option value="">— Tất cả —</option>
                      {values.map(v => <option key={v} value={v}>{v}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
            {buildPattern(ovFm.attrs) && <div style={{ marginTop: 6, fontSize: "0.65rem", color: "var(--ac)", fontFamily: "monospace" }}>Pattern: {buildPattern(ovFm.attrs)}</div>}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 10, marginBottom: 10 }}>
            <div>
              <label style={labelSt}>Hệ số điểm/m³</label>
              <input value={ovFm.pointsPerM3} onChange={e => setOvFm(p => ({ ...p, pointsPerM3: e.target.value }))} style={{ ...inputSt, textAlign: "center" }} placeholder="VD: 1.5" />
            </div>
            <div>
              <label style={labelSt}>Ghi chú</label>
              <input value={ovFm.note} onChange={e => setOvFm(p => ({ ...p, note: e.target.value }))} style={inputSt} placeholder="VD: Óc chó Missouri 2F 2COM" />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 14 }}>
            <button onClick={() => setOvDlg(null)} style={{ padding: "8px 16px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.78rem" }}>Hủy</button>
            <button onClick={saveOverride} style={{ padding: "8px 20px", borderRadius: 7, border: "none", background: "var(--ac)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.78rem" }}>Lưu</button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
