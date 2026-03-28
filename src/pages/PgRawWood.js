import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { INV_STATUS, getContainerInvStatus } from "../utils";

// ── Constants ─────────────────────────────────────────────────────────────────
const CARGO = {
  sawn:      { label: "Gỗ xẻ NK",  icon: "🪚", color: "var(--gn)",  bg: "rgba(50,79,39,0.1)" },
  raw_round: { label: "Gỗ tròn",   icon: "🪵", color: "#8B5E3C",   bg: "rgba(139,94,60,0.1)" },
  raw_box:   { label: "Gỗ hộp",    icon: "📦", color: "#2980b9",   bg: "rgba(41,128,185,0.1)" },
};

const STATUS_COLORS = {
  available: { label: "Còn lại",  color: "var(--gn)",  bg: "rgba(50,79,39,0.1)" },
  sold:      { label: "Đã bán",   color: "#6B4226",    bg: "rgba(107,66,38,0.1)" },
  sawn:      { label: "Đã xẻ",    color: "#2980b9",    bg: "rgba(41,128,185,0.1)" },
};

// Tính thể tích gỗ hộp (không cần formula config)
function calcVolBox(p) {
  const L = parseFloat(p.lengthM) || 0;
  const W = parseFloat(p.widthCm) || 0;
  const T = parseFloat(p.thicknessCm) || 0;
  return (L && W && T) ? parseFloat((L * (W / 100) * (T / 100)).toFixed(5)) : null;
}

// Tính thể tích gỗ tròn theo formula config
function calcVolByFormula(formula, p) {
  if (!formula || formula.measurement === 'weight') return null;

  // Gỗ hộp — không dùng formula
  if (formula.measurement === 'box') return calcVolBox(p);

  const D = parseFloat(p.lengthM) || 0;
  if (!D) return null;
  const dec = formula.decimals ?? 3;
  const divisor = Math.pow(10, formula.exponent || 6);

  if (formula.measurement === 'circumference') {
    const V = parseFloat(p.circumferenceCm) || 0;
    if (!V) return null;
    const coeff = formula.coeff || 8;
    const Dadj = formula.lengthAdjust ? (D >= 5 ? D - 0.2 : D - 0.1) : D;
    const vol = V * V * Dadj * coeff / divisor;
    const factor = Math.pow(10, dec);
    if (formula.rounding === 'ROUNDDOWN')
      // Dùng toFixed(10) trước để tránh lỗi floating-point kiểu 0.38699999...
      return Math.floor(parseFloat((vol * factor).toFixed(10))) / factor;
    return parseFloat(vol.toFixed(dec));
  }

  if (formula.measurement === 'diameter') {
    const K = parseFloat(p.diameterCm) || 0;
    if (!K) return null;
    const coeff = formula.coeff || 7854;
    const vol = K * K * D * coeff / divisor;
    return parseFloat(vol.toFixed(dec));
  }

  return null;
}

// Fallback khi chưa có formula config: dùng circumference_simple
const DEFAULT_ROUND_FORMULA = {
  measurement: 'circumference', coeff: 8, exponent: 6,
  lengthAdjust: false, rounding: 'ROUND', decimals: 3,
  label: 'Vanh chuẩn  V²×D×8/10⁶',
};

const INSP_QUALITY_OPTS = ['Xấu', 'TB', 'Đẹp'];

function emptyPieceRow() {
  return { _id: Date.now() + Math.random(), pieceCode: "", lengthM: "", diameterCm: "", circumferenceCm: "", widthCm: "", thicknessCm: "", weightKg: "", quality: "TB", notes: "" };
}

// Parse CSV/tab-separated text → array of piece objects
// Cột theo formula:
//   circumference/diameter: Mã, Dài(m), Đo chính(cm), [Đo phụ(cm)], CL, Ghi chú
//   weight: Mã, Khối lượng(kg), CL, Ghi chú
//   box: Mã, Dài(m), Rộng(cm), Dày(cm), CL, Ghi chú
function parseImportText(text, formula, isBox) {
  const lines = text.trim().split(/\r?\n/).filter(l => l.trim());
  if (!lines.length) return [];
  return lines.map((line, i) => {
    const cols = line.split(/\t|,/).map(c => c.trim().replace(/^"|"$/g, ""));
    const base = { _id: Date.now() + i, pieceCode: "", lengthM: "", diameterCm: "", circumferenceCm: "", widthCm: "", thicknessCm: "", weightKg: "", quality: "", notes: "" };
    if (formula?.measurement === 'weight') {
      const [pieceCode, weightKg, quality, notes] = cols;
      return { ...base, pieceCode: pieceCode || "", weightKg: weightKg || "", quality: quality || "", notes: notes || "" };
    }
    if (isBox) {
      const [pieceCode, lengthM, widthCm, thicknessCm, quality, notes] = cols;
      return { ...base, pieceCode: pieceCode || "", lengthM: lengthM || "", widthCm: widthCm || "", thicknessCm: thicknessCm || "", quality: quality || "", notes: notes || "" };
    }
    if (formula?.measurement === 'diameter') {
      const [pieceCode, lengthM, diameterCm, quality, notes] = cols;
      return { ...base, pieceCode: pieceCode || "", lengthM: lengthM || "", diameterCm: diameterCm || "", quality: quality || "", notes: notes || "" };
    }
    // circumference (default for round)
    const [pieceCode, lengthM, circumferenceCm, quality, notes] = cols;
    return { ...base, pieceCode: pieceCode || "", lengthM: lengthM || "", circumferenceCm: circumferenceCm || "", quality: quality || "", notes: notes || "" };
  }).filter(p => p.lengthM || p.weightKg);
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function PgRawWood({ allContainers = [], wts = [], cfg = {}, suppliers = [], user, ce, isAdmin, useAPI, notify }) {
  const [rawWoodTypes, setRawWoodTypes] = useState([]);
  const [formulas,     setFormulas]     = useState([]);   // raw_wood_formulas
  const [shipments,    setShipments]    = useState([]);
  const [contItems,    setContItems]    = useState({});   // container_items per container
  const [packingLists, setPackingLists] = useState({});   // raw_wood_packing_list per container
  const [inspections,  setInspections]  = useState({});   // raw_wood_inspection per container
  const [inspSummary,  setInspSummary]  = useState({});   // {contId: {total,available,sawn,sold,totalVol,availVol}}
  const [loading,      setLoading]      = useState(true);

  // Navigation
  const [selCategory,  setSelCategory]  = useState(null); // 'raw_round'|'raw_box'|null
  const [selWoodId,    setSelWoodId]    = useState(null); // specific wood type id

  // Wood type manager
  const [showTypeMgr,  setShowTypeMgr]  = useState(false);
  const [typeEd,       setTypeEd]       = useState(null);  // null | "new" | id
  const [typeFm,       setTypeFm]       = useState({ name: "", woodForm: "round", icon: "🪵", supplierFormulaId: "", inspectionFormulaId: "", unitType: "volume", saleUnit: "volume" });

  // Detail
  const [expId,        setExpId]        = useState(null);
  const [activeTab,    setActiveTab]    = useState("manifest");

  // Packing list form
  const [plRows,       setPlRows]       = useState([]);
  const [showPlForm,   setShowPlForm]   = useState(false);

  // Inspection form
  const [insRows,      setInsRows]      = useState([]);
  const [showInsForm,  setShowInsForm]  = useState(false);
  const [insDate,      setInsDate]      = useState("");
  const [inspector,    setInspector]    = useState("");


  // Load base data
  useEffect(() => {
    if (!useAPI) { setLoading(false); return; }
    Promise.all([
      import('../api.js').then(api => api.fetchRawWoodTypes()),
      import('../api.js').then(api => api.fetchRawWoodFormulas()),
      import('../api.js').then(api => api.fetchShipments()),
      import('../api.js').then(api => api.fetchAllContainerItems()),
      import('../api.js').then(api => api.fetchInspectionSummaryAll()),
    ]).then(([rwt, fms, sms, ci, inspSum]) => {
      setRawWoodTypes(rwt);
      setFormulas(fms);
      setShipments(sms);
      setContItems(ci);
      setInspSummary(inspSum);
      setLoading(false);
    }).catch(e => { notify("Lỗi tải dữ liệu: " + e.message, false); setLoading(false); });
  }, [useAPI]); // eslint-disable-line

  const loadPackingList = useCallback((cid) => {
    if (packingLists[cid] !== undefined || !useAPI) return;
    import('../api.js').then(api => api.fetchRawWoodPackingList(cid))
      .then(data => setPackingLists(p => ({ ...p, [cid]: data })))
      .catch(() => setPackingLists(p => ({ ...p, [cid]: [] })));
  }, [packingLists, useAPI]);

  const loadInspection = useCallback((cid) => {
    if (inspections[cid] !== undefined || !useAPI) return;
    import('../api.js').then(api => api.fetchRawWoodInspection(cid))
      .then(data => setInspections(p => ({ ...p, [cid]: data })))
      .catch(() => setInspections(p => ({ ...p, [cid]: [] })));
  }, [inspections, useAPI]);

  const reloadPacking = (cid) => {
    if (!useAPI) return;
    import('../api.js').then(api => api.fetchRawWoodPackingList(cid))
      .then(data => setPackingLists(p => ({ ...p, [cid]: data })));
  };

  const reloadInspection = (cid) => {
    if (!useAPI) return;
    import('../api.js').then(api => Promise.all([
      api.fetchRawWoodInspection(cid),
      api.fetchInspectionSummaryAll(),
    ])).then(([data, sum]) => {
      setInspections(p => ({ ...p, [cid]: data }));
      setInspSummary(sum);
    });
  };

  // ── Containers PgRawWood — chỉ gỗ tròn và hộp ────────────────────────────
  const rawContainers = useMemo(() =>
    allContainers.filter(c => c.cargoType === "raw_round" || c.cargoType === "raw_box"),
    [allContainers]);

  // Đếm container theo category để hiển thị trong WoodPicker
  const countByCategory = useMemo(() => {
    const r = { raw_round: 0, raw_box: 0 };
    rawContainers.forEach(c => { if (r[c.cargoType] !== undefined) r[c.cargoType]++; });
    return r;
  }, [rawContainers]);

  // Đếm container theo raw wood type id
  const countByRawWood = useMemo(() => {
    const m = {};
    rawContainers.forEach(c => {
      const its = contItems[c.id] || [];
      its.forEach(it => { if (it.rawWoodTypeId) m[it.rawWoodTypeId] = (m[it.rawWoodTypeId] || 0) + 1; });
    });
    return m;
  }, [rawContainers, contItems]);

  // Kính TB (gỗ tròn) / Rộng TB (gỗ hộp) — tính từ packing list, fallback inspection
  const avgMeasures = useMemo(() => {
    const result = {};
    rawContainers.forEach(c => {
      const src = packingLists[c.id]?.length ? packingLists[c.id] : (inspections[c.id] || []);
      if (!src.length) return;
      if (c.cargoType === "raw_round") {
        const vals = src.map(p => p.diameterCm).filter(v => v != null && v > 0);
        result[c.id] = vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length) : null;
      } else if (c.cargoType === "raw_box") {
        const vals = src.map(p => p.widthCm).filter(v => v != null && v > 0);
        result[c.id] = vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length) : null;
      }
    });
    return result;
  }, [rawContainers, packingLists, inspections]);

  // ── Filter theo navigation ─────────────────────────────────────────────────
  const visContainers = useMemo(() => {
    let arr = [...rawContainers];
    if (selCategory) arr = arr.filter(c => c.cargoType === selCategory);
    if (selWoodId) {
      arr = arr.filter(c => {
        const its = contItems[c.id] || [];
        return its.some(it => it.woodId === selWoodId || it.rawWoodTypeId === selWoodId);
      });
    }
    return arr.sort((a, b) => (b.arrivalDate || "").localeCompare(a.arrivalDate || ""));
  }, [rawContainers, contItems, selCategory, selWoodId]);

  // Stats của danh sách đang hiển thị
  const stats = useMemo(() => {
    const totalM3 = visContainers.reduce((s, c) => s + (c.totalVolume || 0), 0);
    const withPl  = visContainers.filter(c => (packingLists[c.id] || []).length > 0).length;
    const withIns = visContainers.filter(c => (inspections[c.id] || []).length > 0).length;
    const avail   = Object.values(inspections).flat().filter(p => p.status === "available").length;
    return { count: visContainers.length, totalM3, withPl, withIns, avail };
  }, [visContainers, packingLists, inspections]);

  // ── Toggle expand container ────────────────────────────────────────────────
  const toggleExp = (cid) => {
    if (expId === cid) { setExpId(null); return; }
    setExpId(cid);
    setActiveTab("manifest");
    setShowPlForm(false); setShowInsForm(false);
    loadPackingList(cid);
    loadInspection(cid);
  };

  // Khi đổi tab
  const switchTab = (tab, cid) => {
    setActiveTab(tab);
    setShowPlForm(false); setShowInsForm(false);
    if (tab === "packing" || tab === "comparison") loadPackingList(cid);
    if (tab === "inspection" || tab === "comparison") loadInspection(cid);
  };

  const currentCargo = (c) => CARGO[c.cargoType] || CARGO.raw_round;

  // ── Packing list actions ───────────────────────────────────────────────────
  const openPlForm = (c) => {
    setPlRows([emptyPieceRow(c.cargoType)]);
    setShowPlForm(true); setShowImport(false);
  };

  // Lấy formula object từ id
  const getFormula = (id) => formulas.find(f => f.id === id) || null;

  // Lấy công thức chính xác cho từng row:
  // 1. Ưu tiên _formulaId lưu từ import (user đã chọn cụ thể)
  // 2. Fallback: detect từ measurement field
  const getRowFormula = (r, configFormula) => {
    if (r._formulaId) {
      const stored = formulas.find(f => f.id === r._formulaId);
      if (stored) return stored;
    }
    if (r.diameterCm != null && !r.circumferenceCm)
      return configFormula?.measurement === 'diameter' ? configFormula : DEFAULT_DIAMETER_FORMULA;
    if (r.circumferenceCm != null)
      return configFormula?.measurement === 'circumference' ? configFormula : DEFAULT_ROUND_FORMULA;
    return configFormula || DEFAULT_ROUND_FORMULA;
  };

  // Lấy formula config của container từ rawWoodType đầu tiên trong manifest
  const getContainerFormulas = (cid) => {
    const firstItem = (contItems[cid] || [])[0];
    const rwt = rawWoodTypes.find(t => t.id === firstItem?.rawWoodTypeId);
    return {
      supplierFormula:   getFormula(rwt?.supplierFormulaId)   || DEFAULT_ROUND_FORMULA,
      inspectionFormula: getFormula(rwt?.inspectionFormulaId) || DEFAULT_ROUND_FORMULA,
      unitType:  rwt?.unitType  || 'volume',
      saleUnit:  rwt?.saleUnit  || 'volume',
      woodType:  rwt,
    };
  };

  const savePacking = (cid, cargoType) => {
    const { supplierFormula } = getContainerFormulas(cid);
    const isWeight = supplierFormula?.measurement === 'weight';
    const valid = isWeight ? plRows.filter(r => r.weightKg) : plRows.filter(r => r.lengthM);
    if (!valid.length) { notify(isWeight ? "Nhập khối lượng cho ít nhất 1 cây" : "Nhập ít nhất 1 cây có chiều dài", false); return; }
    const pieces = valid.map((r, i) => ({
      pieceCode: r.pieceCode || null,
      lengthM: r.lengthM ? parseFloat(r.lengthM) : null,
      diameterCm: r.diameterCm ? parseFloat(r.diameterCm) : null,
      circumferenceCm: r.circumferenceCm ? parseFloat(r.circumferenceCm) : null,
      widthCm: r.widthCm ? parseFloat(r.widthCm) : null,
      thicknessCm: r.thicknessCm ? parseFloat(r.thicknessCm) : null,
      weightKg: r.weightKg ? parseFloat(r.weightKg) : null,
      volumeM3: cargoType === "raw_box" ? calcVolBox(r) : calcVolByFormula(getRowFormula(r, supplierFormula), r),
      quality: r.quality || null,
      sortOrder: (packingLists[cid] || []).length + i,
      notes: r.notes || null,
    }));
    // Optimistic
    const tmpItems = pieces.map((p, i) => ({ ...p, id: "tmp_" + i }));
    setPackingLists(prev => ({ ...prev, [cid]: [...(prev[cid] || []), ...tmpItems] }));
    setShowPlForm(false); setPlRows([]);
    if (useAPI) import('../api.js').then(api => api.addRawWoodPackingListBatch(cid, pieces))
      .then(r => { if (r?.error) notify("Lỗi: " + r.error, false); else { notify(`Đã thêm ${r.count} cây`); reloadPacking(cid); } })
      .catch(e => notify("Lỗi: " + e.message, false));
  };

  const deletePacking = (cid, id) => {
    setPackingLists(p => ({ ...p, [cid]: (p[cid] || []).filter(x => x.id !== id) }));
    if (useAPI) import('../api.js').then(api => api.deleteRawWoodPackingListItem(id));
  };

  // Import done callback: nhận rows đã parse từ ImportPanel
  const onImportPacking = (rows) => {
    setPlRows(rows); setShowPlForm(true);
    notify(`Đã tải ${rows.length} dòng — kiểm tra rồi bấm Lưu`, true);
  };

  // ── Inspection actions ─────────────────────────────────────────────────────
  const copyPlToInspection = async (cid, noInspection = false) => {
    const pl = packingLists[cid] || [];
    if (!pl.length) { notify("Chưa có packing list NCC để copy", false); return; }
    const label = noInspection ? "Không nghiệm thu — copy từ packing list" : null;
    const pieces = pl.map((p, i) => ({
      packingListId: p.id,
      pieceCode: p.pieceCode,
      lengthM: p.lengthM, diameterCm: p.diameterCm, circumferenceCm: p.circumferenceCm,
      widthCm: p.widthCm, thicknessCm: p.thicknessCm,
      volumeM3: p.volumeM3, quality: p.quality,
      sortOrder: i, notes: label,
      inspectionDate: noInspection ? null : (insDate || null),
      inspector: noInspection ? null : (inspector || null),
    }));
    if (useAPI) {
      await import('../api.js').then(api => api.clearRawWoodInspection(cid));
      import('../api.js').then(api => api.addRawWoodInspectionBatch(cid, pieces))
        .then(r => {
          if (r?.error) notify("Lỗi: " + r.error, false);
          else { notify(noInspection ? `Ghi nhận tồn kho ${r.count} cây (không nghiệm thu)` : `Copy ${r.count} cây từ list NCC`); reloadInspection(cid); }
        })
        .catch(e => notify("Lỗi: " + e.message, false));
    } else {
      setInspections(prev => ({ ...prev, [cid]: pieces.map((p, i) => ({ ...p, id: "tmp_" + i, status: "available", notes: label })) }));
      notify(noInspection ? `Ghi nhận ${pieces.length} cây (không nghiệm thu)` : `Copy ${pieces.length} cây`);
    }
  };

  const saveInspection = (cid, cargoType) => {
    const { inspectionFormula } = getContainerFormulas(cid);
    const isWeight = inspectionFormula?.measurement === 'weight';
    const valid = isWeight ? insRows.filter(r => r.weightKg) : insRows.filter(r => r.lengthM);
    if (!valid.length) { notify(isWeight ? "Nhập khối lượng cho ít nhất 1 cây" : "Nhập ít nhất 1 cây có chiều dài", false); return; }
    const pieces = valid.map((r, i) => ({
      pieceCode: r.pieceCode || null,
      lengthM: r.lengthM ? parseFloat(r.lengthM) : null,
      diameterCm: r.diameterCm ? parseFloat(r.diameterCm) : null,
      circumferenceCm: r.circumferenceCm ? parseFloat(r.circumferenceCm) : null,
      widthCm: r.widthCm ? parseFloat(r.widthCm) : null,
      thicknessCm: r.thicknessCm ? parseFloat(r.thicknessCm) : null,
      weightKg: r.weightKg ? parseFloat(r.weightKg) : null,
      volumeM3: cargoType === "raw_box" ? calcVolBox(r) : calcVolByFormula(getRowFormula(r, inspectionFormula), r),
      quality: r.quality || null,
      sortOrder: (inspections[cid] || []).length + i,
      inspectionDate: insDate || null,
      inspector: inspector || null,
    }));
    const tmpItems = pieces.map((p, i) => ({ ...p, id: "tmp_i_" + i, status: "available", isMissing: false, isDamaged: false }));
    setInspections(prev => ({ ...prev, [cid]: [...(prev[cid] || []), ...tmpItems] }));
    setShowInsForm(false); setInsRows([]);
    if (useAPI) import('../api.js').then(api => api.addRawWoodInspectionBatch(cid, pieces))
      .then(r => { if (r?.error) notify("Lỗi: " + r.error, false); else { notify(`Đã thêm ${r.count} cây nghiệm thu`); reloadInspection(cid); } })
      .catch(e => notify("Lỗi: " + e.message, false));
  };

  const updateInspStatus = (cid, id, field, value) => {
    setInspections(p => ({ ...p, [cid]: (p[cid] || []).map(x => x.id === id ? { ...x, [field]: value } : x) }));
    if (useAPI) import('../api.js').then(api =>
      api.updateRawWoodInspectionItem(id, { [field]: value }).then(() => {
        if (field === 'status') api.fetchInspectionSummaryAll().then(setInspSummary).catch(() => {});
      })
    );
  };

  const deleteInspection = (cid, id) => {
    setInspections(p => ({ ...p, [cid]: (p[cid] || []).filter(x => x.id !== id) }));
    if (useAPI) import('../api.js').then(api =>
      api.deleteRawWoodInspectionItem(id).then(() =>
        api.fetchInspectionSummaryAll().then(setInspSummary).catch(() => {})
      )
    );
  };

  const onImportInspection = (rows) => {
    setInsRows(rows); setShowInsForm(true);
    notify(`Đã tải ${rows.length} dòng — kiểm tra rồi bấm Lưu`, true);
  };

  // ── Wood type CRUD ─────────────────────────────────────────────────────────
  const saveType = () => {
    if (!typeFm.name.trim()) { notify("Tên không được trống", false); return; }
    const fields = {
      supplierFormulaId:   typeFm.supplierFormulaId   || null,
      inspectionFormulaId: typeFm.inspectionFormulaId || null,
      unitType:            typeFm.unitType   || "volume",
      saleUnit:            typeFm.saleUnit   || "volume",
    };
    if (typeEd === "new") {
      const tmp = { id: "tmp_" + Date.now(), name: typeFm.name.trim(), woodForm: typeFm.woodForm, icon: typeFm.icon || "🪵", ...fields };
      setRawWoodTypes(p => [...p, tmp]);
      if (useAPI) import('../api.js').then(api => api.addRawWoodType(typeFm.name.trim(), typeFm.woodForm, typeFm.icon, fields))
        .then(r => { if (r?.id) setRawWoodTypes(p => p.map(t => t.id === tmp.id ? { ...t, id: r.id } : t)); });
      notify("Đã thêm " + typeFm.name.trim());
    } else {
      setRawWoodTypes(p => p.map(t => t.id === typeEd ? { ...t, name: typeFm.name.trim(), icon: typeFm.icon, ...fields } : t));
      if (useAPI) import('../api.js').then(api => api.updateRawWoodType(typeEd, typeFm.name.trim(), typeFm.icon, fields));
      notify("Đã cập nhật");
    }
    setTypeEd(null);
  };

  const deleteType = (t) => {
    if (rawContainers.some(c => (contItems[c.id] || []).some(it => it.rawWoodTypeId === t.id))) {
      notify(`Không thể xóa "${t.name}" — đang có container sử dụng`, false); return;
    }
    setRawWoodTypes(p => p.filter(x => x.id !== t.id));
    if (useAPI) import('../api.js').then(api => api.deleteRawWoodType(t.id));
    notify("Đã xóa " + t.name);
  };

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: "var(--tm)" }}>Đang tải...</div>;

  const roundTypes = rawWoodTypes.filter(r => r.woodForm === "round");
  const boxTypes   = rawWoodTypes.filter(r => r.woodForm === "box");

  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>

      {/* ── WoodPicker sidebar ── */}
      <div style={{ width: 210, flexShrink: 0, position: "sticky", top: 0 }}>
        <div style={{ background: "var(--bgc)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden", marginBottom: 8 }}>
          <div style={{ padding: "8px 12px", background: "var(--bgh)", fontSize: "0.64rem", fontWeight: 700, color: "var(--brl)", textTransform: "uppercase", borderBottom: "1px solid var(--bds)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Loại hàng hóa</span>
            {ce && <button onClick={() => { setShowTypeMgr(t => !t); setTypeEd(null); }} title="Quản lý loại gỗ"
              style={{ padding: "2px 6px", borderRadius: 4, border: "1px solid var(--bd)", background: showTypeMgr ? "var(--ac)" : "transparent", color: showTypeMgr ? "#fff" : "var(--ts)", cursor: "pointer", fontSize: "0.68rem" }}>⚙</button>}
          </div>
        {/* Tất cả */}
        <NavItem
          icon="📋" label="Tất cả" count={rawContainers.length}
          active={!selCategory && !selWoodId}
          onClick={() => { setSelCategory(null); setSelWoodId(null); }}
        />
        {/* Gỗ tròn */}
        <NavCategory
          cargo={CARGO.raw_round} count={countByCategory.raw_round}
          active={selCategory === "raw_round"} selWoodId={selWoodId}
          onCategory={() => { setSelCategory("raw_round"); setSelWoodId(null); }}
        >
          {roundTypes.map(r => (
            <NavItem key={r.id} icon={r.icon} label={r.name} count={countByRawWood[r.id] || 0}
              active={selWoodId === r.id}
              onClick={() => { setSelCategory("raw_round"); setSelWoodId(r.id); }} sub />
          ))}
        </NavCategory>
        {/* Gỗ hộp */}
        <NavCategory
          cargo={CARGO.raw_box} count={countByCategory.raw_box}
          active={selCategory === "raw_box"} selWoodId={selWoodId}
          onCategory={() => { setSelCategory("raw_box"); setSelWoodId(null); }}
        >
          {boxTypes.map(r => (
            <NavItem key={r.id} icon={r.icon} label={r.name} count={countByRawWood[r.id] || 0}
              active={selWoodId === r.id}
              onClick={() => { setSelCategory("raw_box"); setSelWoodId(r.id); }} sub />
          ))}
        </NavCategory>
        </div>

        {/* ── Wood type manager panel ── */}
        {showTypeMgr && (
          <WoodTypeMgr
            rawWoodTypes={rawWoodTypes} formulas={formulas}
            typeEd={typeEd} setTypeEd={setTypeEd}
            typeFm={typeFm} setTypeFm={setTypeFm}
            saveType={saveType} deleteType={deleteType}
          />
        )}
      </div>

      {/* ── Main content ── */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "var(--br)" }}>
            🪵 Gỗ nguyên liệu
            {selCategory && <span style={{ marginLeft: 8, fontSize: "0.78rem", fontWeight: 600, color: CARGO[selCategory]?.color }}>{CARGO[selCategory]?.icon} {CARGO[selCategory]?.label}</span>}
          </h2>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 8, marginBottom: 10, flexWrap: "wrap" }}>
          {[
            { label: "Container",       val: `${stats.count}`,              color: "var(--br)" },
            { label: "Tổng KL",         val: `${stats.totalM3.toFixed(2)} m³`, color: "var(--ts)" },
            { label: "Có packing list", val: `${stats.withPl}`,             color: "#8B5E3C" },
            { label: "Đã nghiệm thu",   val: `${stats.withIns}`,            color: "var(--ac)" },
            { label: "Còn lại (NT)",    val: `${stats.avail} cây`,           color: "var(--gn)" },
          ].map(s => (
            <div key={s.label} style={{ padding: "7px 12px", borderRadius: 8, background: "var(--bgc)", border: "1px solid var(--bd)" }}>
              <div style={{ fontSize: "0.6rem", color: "var(--tm)", textTransform: "uppercase", fontWeight: 700 }}>{s.label}</div>
              <div style={{ fontSize: "0.98rem", fontWeight: 800, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Container list */}
        <div style={{ background: "var(--bgc)", borderRadius: 10, border: "1px solid var(--bd)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.78rem" }}>
            <thead>
              <tr style={{ background: "var(--bgh)" }}>
                {["Mã container", "Loại", "Lô hàng / NCC", "Ngày về", "Số cây / m³", "Kính TB / Rộng TB", "Packing list", "Nghiệm thu", "TT"].map((h, i) => (
                  <th key={i} style={{ padding: "7px 10px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.6rem", textTransform: "uppercase", borderBottom: "2px solid var(--bds)", whiteSpace: "nowrap" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visContainers.length === 0 && (
                <tr><td colSpan={9} style={{ padding: 28, textAlign: "center", color: "var(--tm)" }}>
                  Không có container nào {selCategory ? `loại ${CARGO[selCategory]?.label}` : ""}
                </td></tr>
              )}
              {visContainers.map((c, ci) => {
                const ct   = currentCargo(c);
                const sh   = shipments.find(s => s.id === c.shipmentId);
                const sup  = suppliers.find(s => s.nccId === c.nccId || (sh && s.nccId === sh.nccId));
                const pl   = packingLists[c.id];
                const ins  = inspections[c.id];
                const isExp = expId === c.id;
                const plCount    = pl?.length ?? null;
                const insCount   = ins?.length ?? null;
                const availCount = ins ? ins.filter(p => p.status === "available").length : null;
                const avgMeasure = avgMeasures[c.id];
                const measureLabel = c.cargoType === "raw_round" ? "Kính TB" : "Rộng TB";
                // Inventory status (tính tự động từ inspection summary)
                const invSum = inspSummary[c.id] || null;
                const invStatusKey = getContainerInvStatus(invSum);
                const invCfg = INV_STATUS[invStatusKey];

                return (
                  <React.Fragment key={c.id}>
                    <tr style={{ background: isExp ? "var(--acbg)" : (ci % 2 ? "var(--bgs)" : "#fff"), cursor: "pointer" }}
                      onClick={() => toggleExp(c.id)}>
                      <td style={{ padding: "9px 10px", borderBottom: isExp ? "none" : "1px solid var(--bd)", fontWeight: 700, color: "var(--br)" }}>
                        <span style={{ fontSize: "0.65rem", color: isExp ? "var(--ac)" : "var(--tm)", marginRight: 5 }}>{isExp ? "▾" : "▸"}</span>
                        📦 {c.containerCode}
                        {c.isStandalone && <span style={{ marginLeft: 4, fontSize: "0.58rem", padding: "1px 4px", borderRadius: 3, background: "rgba(242,101,34,0.1)", color: "var(--ac)", fontWeight: 700 }}>LẺ</span>}
                      </td>
                      <td style={{ padding: "9px 10px", borderBottom: isExp ? "none" : "1px solid var(--bd)" }}>
                        <span style={{ padding: "2px 7px", borderRadius: 5, background: ct.bg, color: ct.color, fontSize: "0.68rem", fontWeight: 700 }}>{ct.icon} {ct.label}</span>
                      </td>
                      <td style={{ padding: "9px 10px", borderBottom: isExp ? "none" : "1px solid var(--bd)", fontSize: "0.74rem" }}>
                        {sh ? <div style={{ fontWeight: 600, color: "var(--br)" }}>{sh.shipmentCode}</div> : null}
                        <div style={{ color: "var(--ts)", fontSize: "0.72rem" }}>{sup?.name || c.nccId || "—"}</div>
                      </td>
                      <td style={{ padding: "9px 10px", borderBottom: isExp ? "none" : "1px solid var(--bd)", color: "var(--ts)" }}>{c.arrivalDate || "—"}</td>
                      <td style={{ padding: "9px 10px", borderBottom: isExp ? "none" : "1px solid var(--bd)" }}>
                        <div style={{ fontWeight: 600 }}>{c.totalVolume != null ? `${c.totalVolume.toFixed(3)} m³` : "—"}</div>
                        {insCount != null && <div style={{ fontSize: "0.65rem", color: "var(--tm)" }}>{insCount} cây (NT)</div>}
                      </td>
                      {/* Kính TB / Rộng TB */}
                      <td style={{ padding: "9px 10px", borderBottom: isExp ? "none" : "1px solid var(--bd)" }}>
                        {avgMeasure != null
                          ? <span style={{ fontWeight: 600 }}>{avgMeasure.toFixed(1)} <span style={{ fontSize: "0.65rem", color: "var(--tm)", fontWeight: 400 }}>cm ({measureLabel})</span></span>
                          : <span style={{ color: "var(--tm)", fontSize: "0.72rem" }}>—</span>}
                      </td>
                      <td style={{ padding: "9px 10px", borderBottom: isExp ? "none" : "1px solid var(--bd)" }}>
                        {plCount == null ? <span style={{ color: "var(--tm)", fontSize: "0.72rem" }}>—</span>
                          : plCount === 0 ? <span style={{ color: "var(--dg)", fontSize: "0.72rem" }}>Chưa có</span>
                          : <span style={{ color: "var(--gn)", fontWeight: 600, fontSize: "0.74rem" }}>✓ {plCount} cây</span>}
                      </td>
                      <td style={{ padding: "9px 10px", borderBottom: isExp ? "none" : "1px solid var(--bd)" }}>
                        {insCount == null ? <span style={{ color: "var(--tm)", fontSize: "0.72rem" }}>—</span>
                          : insCount === 0 ? <span style={{ color: "var(--dg)", fontSize: "0.72rem" }}>Chưa có</span>
                          : <span style={{ fontSize: "0.72rem" }}>
                              <span style={{ color: "var(--gn)", fontWeight: 700 }}>{availCount} còn</span>
                              {(insCount - availCount) > 0 && <span style={{ color: "var(--tm)" }}> · {insCount - availCount} xử lý</span>}
                            </span>}
                      </td>
                      <td style={{ padding: "9px 10px", borderBottom: isExp ? "none" : "1px solid var(--bd)" }}>
                        <span style={{ padding: "2px 8px", borderRadius: 5, fontSize: "0.68rem", fontWeight: 700, background: invCfg.bg, color: invCfg.color, whiteSpace: "nowrap" }}>
                          {invCfg.label}
                        </span>
                        {invSum && invStatusKey !== 'no_inspection' && (
                          <div style={{ fontSize: "0.6rem", color: "var(--ts)", marginTop: 2 }}>
                            {invSum.available > 0 && <span style={{ color: "var(--gn)" }}>{invSum.available} còn </span>}
                            {invSum.sawn > 0 && <span style={{ color: "#2980b9" }}>{invSum.sawn} xẻ </span>}
                            {invSum.sold > 0 && <span style={{ color: "#8B5E3C" }}>{invSum.sold} bán</span>}
                          </div>
                        )}
                      </td>
                    </tr>

                    {/* ── Drill-down ── */}
                    {isExp && (
                      <tr>
                        <td colSpan={9} style={{ padding: 0, borderBottom: "2px solid var(--ac)" }}>
                          <ContainerDetail
                            c={c} ct={ct}
                            contItems={contItems[c.id] || []}
                            packingList={packingLists[c.id]}
                            inspection={inspections[c.id]}
                            rawWoodTypes={rawWoodTypes}
                            formulas={formulas}
                            containerFormulas={getContainerFormulas(c.id)}
                            suppliers={suppliers} shipments={shipments}
                            ce={ce} isAdmin={isAdmin}
                            activeTab={activeTab} switchTab={switchTab}
                            // Packing list
                            plRows={plRows} setPlRows={setPlRows}
                            showPlForm={showPlForm} openPlForm={() => openPlForm(c)}
                            setShowPlForm={setShowPlForm}
                            savePacking={() => savePacking(c.id, c.cargoType)}
                            deletePacking={(id) => deletePacking(c.id, id)}
                            onImportPacking={(rows) => onImportPacking(rows)}
                            // Inspection
                            insDate={insDate} setInsDate={setInsDate}
                            inspector={inspector} setInspector={setInspector}
                            insRows={insRows} setInsRows={setInsRows}
                            showInsForm={showInsForm} setShowInsForm={setShowInsForm}
                            copyPlToInspection={() => copyPlToInspection(c.id)}
                            copyPlToInspectionNoCheck={() => copyPlToInspection(c.id, true)}
                            saveInspection={() => saveInspection(c.id, c.cargoType)}
                            updateInspStatus={(id, field, val) => updateInspStatus(c.id, id, field, val)}
                            deleteInspection={(id) => deleteInspection(c.id, id)}
                            onImportInspection={(rows) => onImportInspection(rows)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ── WoodPicker Nav components ──────────────────────────────────────────────────
function NavCategory({ cargo, count, active, selWoodId, onCategory, children }) {
  const [open, setOpen] = useState(true);
  const childArr = React.Children.toArray(children);
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", padding: "7px 12px", cursor: "pointer", background: active && !selWoodId ? "var(--acbg)" : "transparent", borderLeft: active && !selWoodId ? `3px solid ${cargo.color}` : "3px solid transparent" }}
        onClick={onCategory}>
        <span style={{ flex: 1, fontSize: "0.76rem", fontWeight: 700, color: active && !selWoodId ? cargo.color : "var(--tp)" }}>{cargo.icon} {cargo.label}</span>
        <span style={{ fontSize: "0.68rem", padding: "1px 6px", borderRadius: 4, background: cargo.bg, color: cargo.color, fontWeight: 700, marginRight: 6 }}>{count}</span>
        {childArr.length > 0 && (
          <span style={{ fontSize: "0.6rem", color: "var(--tm)", cursor: "pointer" }} onClick={e => { e.stopPropagation(); setOpen(o => !o); }}>{open ? "▾" : "▸"}</span>
        )}
      </div>
      {open && childArr}
    </div>
  );
}

function NavItem({ icon, label, count, active, onClick, sub }) {
  return (
    <div style={{ display: "flex", alignItems: "center", padding: sub ? "5px 12px 5px 22px" : "7px 12px", cursor: "pointer", background: active ? "var(--acbg)" : "transparent", borderLeft: active ? "3px solid var(--ac)" : "3px solid transparent" }}
      onClick={onClick}>
      <span style={{ flex: 1, fontSize: sub ? "0.72rem" : "0.76rem", color: active ? "var(--ac)" : "var(--ts)", fontWeight: active ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {icon} {label}
      </span>
      {count > 0 && <span style={{ fontSize: "0.62rem", color: active ? "var(--ac)" : "var(--tm)", fontWeight: 600, marginLeft: 4 }}>{count}</span>}
    </div>
  );
}

// ── Container Detail (tabs) ────────────────────────────────────────────────────
function ContainerDetail({
  c, ct, contItems, packingList, inspection, rawWoodTypes, formulas, containerFormulas, suppliers, shipments,
  ce, isAdmin, activeTab, switchTab,
  plRows, setPlRows, showPlForm, openPlForm, setShowPlForm,
  savePacking, deletePacking, onImportPacking,
  insDate, setInsDate, inspector, setInspector,
  insRows, setInsRows, showInsForm, setShowInsForm,
  copyPlToInspection, copyPlToInspectionNoCheck, saveInspection, updateInspStatus, deleteInspection,
  onImportInspection,
}) {
  const isRaw = true; // PgRawWood chỉ có raw_round và raw_box
  const isBox = c.cargoType === "raw_box";
  const sh  = shipments.find(s => s.id === c.shipmentId);
  const sup = suppliers.find(s => s.nccId === c.nccId || (sh && s.nccId === sh.nccId));
  const { supplierFormula, inspectionFormula, unitType, woodType } = containerFormulas || {};

  // Formula override từ ImportPanel — ưu tiên hơn config khi user đã chọn cụ thể
  const [plImportFormula,  setPlImportFormula]  = useState(null);
  const [insImportFormula, setInsImportFormula] = useState(null);

  const activePlFormula  = plImportFormula  || supplierFormula;
  const activeInsFormula = insImportFormula || inspectionFormula;
  const isWeightNCC  = unitType === 'weight' || unitType === 'both';    // NCC giao theo tấn
  const isWeightIns  = unitType === 'weight';                           // inspection cũng theo tấn
  const showWeightCol = isWeightNCC || isWeightIns;

  const tabs = [
    { key: "manifest",    label: "Manifest" },
    { key: "packing",     label: `Packing List${packingList ? ` (${packingList.length})` : ""}` },
    { key: "inspection",  label: `Nghiệm thu${inspection ? ` (${inspection.length})` : ""}` },
    { key: "comparison",  label: "Tổng hợp" },
  ];

  const thS  = { padding: "5px 8px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", whiteSpace: "nowrap", background: "var(--bgh)" };
  const tdS  = { padding: "5px 8px", borderBottom: "1px solid var(--bd)", fontSize: "0.74rem" };
  const btnS = (color) => ({ padding: "3px 9px", borderRadius: 5, border: `1px solid ${color}`, background: "transparent", color, cursor: "pointer", fontSize: "0.68rem", fontWeight: 600, whiteSpace: "nowrap" });

  return (
    <div style={{ padding: "10px 14px 14px", background: "rgba(242,101,34,0.02)" }}>
      {/* Header info */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10, padding: "8px 12px", background: "var(--bgc)", borderRadius: 7, border: "1px solid var(--bds)", fontSize: "0.74rem" }}>
        <span><b>Container:</b> {c.containerCode}</span>
        <span style={{ color: ct.color, fontWeight: 700 }}>{ct.icon} {ct.label}</span>
        {sh && <span><b>Lô:</b> {sh.shipmentCode}</span>}
        {sup && <span><b>NCC:</b> {sup.name}</span>}
        {c.arrivalDate && <span><b>Ngày về:</b> {c.arrivalDate}</span>}
        {c.totalVolume && <span><b>KL:</b> {c.totalVolume.toFixed(3)} m³</span>}
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 2, marginBottom: 10, borderBottom: "2px solid var(--bds)" }}>
        {tabs.map(t => (
          <button key={t.key} onClick={() => switchTab(t.key, c.id)}
            style={{ padding: "6px 14px", border: "none", borderRadius: "5px 5px 0 0", cursor: "pointer", fontSize: "0.74rem", fontWeight: activeTab === t.key ? 700 : 500, background: activeTab === t.key ? "var(--ac)" : "transparent", color: activeTab === t.key ? "#fff" : "var(--ts)", marginBottom: -2, borderBottom: activeTab === t.key ? "2px solid var(--ac)" : "2px solid transparent" }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Manifest ── */}
      {activeTab === "manifest" && (
        <div style={{ border: "1.5px solid var(--bd)", borderRadius: 7, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.74rem" }}>
            <thead><tr>
              <th style={thS}>Loại gỗ</th>
              <th style={{ ...thS, textAlign: "right" }}>{isRaw ? "Số cây/hộp" : "Dày"}</th>
              <th style={thS}>CL</th>
              <th style={{ ...thS, textAlign: "right" }}>m³</th>
              <th style={thS}>Ghi chú</th>
            </tr></thead>
            <tbody>
              {contItems.length === 0 && <tr><td colSpan={5} style={{ padding: 12, textAlign: "center", color: "var(--tm)" }}>Chưa có hàng hóa trong manifest</td></tr>}
              {contItems.map((it, i) => {
                const w = rawWoodTypes.find(x => x.id === it.rawWoodTypeId);
                return (
                  <tr key={it.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                    <td style={tdS}>{w ? `${w.icon || ""} ${w.name}` : "—"}</td>
                    <td style={{ ...tdS, textAlign: "right" }}>{isRaw ? (it.pieceCount != null ? `${it.pieceCount} cây` : "—") : (it.thickness || "—")}</td>
                    <td style={tdS}>{it.quality || "—"}</td>
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 600 }}>{it.volume != null ? it.volume.toFixed(3) : "—"}</td>
                    <td style={{ ...tdS, color: "var(--tm)" }}>{it.notes || ""}</td>
                  </tr>
                );
              })}
            </tbody>
            {contItems.length > 0 && (
              <tfoot><tr style={{ background: "var(--bgh)" }}>
                <td colSpan={3} style={{ padding: "5px 8px", textAlign: "right", fontWeight: 700, fontSize: "0.66rem", color: "var(--brl)", borderTop: "2px solid var(--bds)" }}>Tổng ({contItems.length}):</td>
                <td style={{ padding: "5px 8px", textAlign: "right", fontWeight: 800, color: "var(--br)", borderTop: "2px solid var(--bds)" }}>{contItems.reduce((s, x) => s + (x.volume || 0), 0).toFixed(3)} m³</td>
                <td style={{ borderTop: "2px solid var(--bds)" }} />
              </tr></tfoot>
            )}
          </table>
        </div>
      )}

      {/* ── Tab: Packing List NCC ── */}
      {activeTab === "packing" && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--tm)" }}>
              {packingList == null ? "Đang tải..." : `${packingList.length} cây · ${packingList.reduce((s, p) => s + (p.volumeM3 || 0), 0).toFixed(4)} m³`}
            </span>
            {ce && !showPlForm && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 5 }}>
                <button onClick={() => openPlForm()} style={btnS("var(--br)")}>+ Nhập thủ công</button>
              </div>
            )}
          </div>

          {/* Import panel */}
          {ce && <ImportPanel isBox={isBox} formulas={formulas} defaultFormula={supplierFormula}
            onDone={(rows, formula) => { setPlImportFormula(formula || null); onImportPacking(rows); }} />}

          {/* Form nhập thủ công */}
          {showPlForm && <PieceForm rows={plRows} setRows={setPlRows} formula={activePlFormula} isBox={isBox}
            onSave={savePacking} onCancel={() => { setShowPlForm(false); setPlRows([]); setPlImportFormula(null); }} />}

          {packingList && <PieceTable pieces={packingList} formula={activePlFormula} isBox={isBox} ce={ce} onDelete={(id) => deletePacking(id)} showStatus={false} />}
        </div>
      )}

      {/* ── Tab: Nghiệm thu ── */}
      {activeTab === "inspection" && (
        <div>
          <div style={{ display: "flex", gap: 6, marginBottom: 8, alignItems: "center", flexWrap: "wrap" }}>
            <span style={{ fontSize: "0.7rem", color: "var(--tm)" }}>
              {inspection == null ? "Đang tải..." : `${inspection.length} cây · ${inspection.reduce((s, p) => s + (p.volumeM3 || 0), 0).toFixed(4)} m³`}
            </span>
            <input type="date" value={insDate} onChange={e => setInsDate(e.target.value)} title="Ngày nghiệm thu"
              style={{ padding: "4px 7px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.72rem", outline: "none" }} />
            <input value={inspector} onChange={e => setInspector(e.target.value)} placeholder="Người kiểm..."
              style={{ padding: "4px 8px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.72rem", outline: "none", width: 120 }} />
            {ce && (
              <div style={{ marginLeft: "auto", display: "flex", gap: 5, alignItems: 'center' }}>
                {packingList?.length > 0 && (
                  <button onClick={copyPlToInspection} disabled={inspection?.length > 0}
                    title={inspection?.length > 0 ? "Đã có dữ liệu nghiệm thu — xóa hết trước nếu muốn copy lại" : "Copy packing list NCC vào nghiệm thu"}
                    style={{ ...btnS("var(--br)"), opacity: inspection?.length > 0 ? 0.4 : 1, cursor: inspection?.length > 0 ? 'not-allowed' : 'pointer' }}>
                    ⬇ Copy từ list NCC
                  </button>
                )}
                {packingList?.length > 0 && !inspection?.length && (
                  <button onClick={copyPlToInspectionNoCheck}
                    title="Dùng số liệu NCC làm nghiệm thu (không kiểm đếm thực tế)"
                    style={{ ...btnS("var(--ts)"), borderStyle: 'dashed' }}>
                    ⬇ Ghi tồn kho (không NT)
                  </button>
                )}
                {!showInsForm && (
                  <button onClick={() => { setInsRows([emptyPieceRow()]); setShowInsForm(true); }} style={btnS("var(--br)")}>+ Nhập thủ công</button>
                )}
              </div>
            )}
          </div>

          {ce && <ImportPanel isBox={isBox} formulas={formulas} defaultFormula={inspectionFormula}
            onDone={(rows, formula) => { setInsImportFormula(formula || null); onImportInspection(rows); }} />}

          {showInsForm && <PieceForm rows={insRows} setRows={setInsRows} formula={activeInsFormula} isBox={isBox}
            onSave={saveInspection} onCancel={() => { setShowInsForm(false); setInsRows([]); setInsImportFormula(null); }} />}

          {inspection && <PieceTable pieces={inspection} formula={activeInsFormula} isBox={isBox} ce={ce}
            onDelete={(id) => deleteInspection(id)} showStatus={true} updateStatus={updateInspStatus} />}
        </div>
      )}

      {/* ── Tab: Tổng hợp ── */}
      {activeTab === "comparison" && (
        <ComparisonTab packingList={packingList} inspection={inspection} isBox={isBox} isRaw={isRaw} />
      )}
    </div>
  );
}

// Công thức kính mặc định (dùng khi toggle sang kính mà formula config là circumference)
const DEFAULT_DIAMETER_FORMULA = { measurement: 'diameter', coeff: 7854, exponent: 8, lengthAdjust: false, rounding: 'ROUND', decimals: 3, label: 'Kính chuẩn  K²×D×7854/10⁸' };

// ── ImportPanel — import CSV/file với toggle vanh/kính + chọn công thức ────────
function ImportPanel({ isBox, formulas, defaultFormula, onDone }) {
  const [open,        setOpen]        = useState(false);
  const [measurement, setMeasurement] = useState(defaultFormula?.measurement || 'circumference');
  const [formulaId,   setFormulaId]   = useState(defaultFormula?.id || '');
  const [text,        setText]        = useState('');
  const fileRef = useRef(null);

  // Lọc công thức theo measurement đã chọn
  const filteredFormulas = formulas.filter(f =>
    isBox ? f.measurement === 'box'
    : measurement === 'diameter' ? f.measurement === 'diameter'
    : f.measurement === 'circumference'
  );

  // Formula đang chọn
  const activeFormula = formulas.find(f => f.id === formulaId)
    || filteredFormulas[0]
    || (measurement === 'diameter' ? DEFAULT_DIAMETER_FORMULA : DEFAULT_ROUND_FORMULA);

  const handleFile = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => { setText(ev.target.result); };
    reader.readAsText(file, 'utf-8');
    e.target.value = '';
  };

  const doImport = () => {
    const parsed = parseImportText(text, activeFormula, isBox);
    if (!parsed.length) { alert('Không tìm thấy dữ liệu hợp lệ'); return; }
    // Pre-compute volumeM3 với công thức đã chọn + đánh dấu formula dùng
    const rows = parsed.map(r => ({
      ...r,
      _formulaId: activeFormula?.id || null,
      volumeM3: isBox ? calcVolBox(r) : (activeFormula?.measurement !== 'weight' ? calcVolByFormula(activeFormula, r) : null),
    }));
    onDone(rows, activeFormula);
    setText(''); setOpen(false);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)}
      style={{ marginBottom: 8, padding: "3px 10px", borderRadius: 5, border: "1.5px solid var(--ac)", background: "transparent", color: "var(--ac)", cursor: "pointer", fontSize: "0.7rem", fontWeight: 600 }}>
      ⇪ Import CSV / File
    </button>
  );

  const hintCol = isBox        ? "Mã, Dài(m), Rộng(cm), Dày(cm), CL, Ghi chú"
    : activeFormula?.measurement === 'weight'   ? "Mã, Khối lượng(kg), CL, Ghi chú"
    : measurement === 'diameter' ? "Mã, Dài(m), Kính(cm), CL, Ghi chú"
    : "Mã, Dài(m), Vanh(cm), CL, Ghi chú";

  return (
    <div style={{ padding: "10px 12px", borderRadius: 7, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 8 }}>
      {/* Hàng 1: toggle vanh/kính + chọn công thức */}
      {!isBox && (
        <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", borderRadius: 5, overflow: "hidden", border: "1.5px solid var(--bd)" }}>
            {[{ val: 'circumference', label: 'Vanh' }, { val: 'diameter', label: 'Kính' }].map(opt => (
              <button key={opt.val} onClick={() => { setMeasurement(opt.val); setFormulaId(''); }}
                style={{ padding: "4px 12px", border: "none", cursor: "pointer", fontSize: "0.72rem", fontWeight: measurement === opt.val ? 700 : 500, background: measurement === opt.val ? "var(--ac)" : "var(--bgc)", color: measurement === opt.val ? "#fff" : "var(--ts)" }}>
                {opt.label}
              </button>
            ))}
          </div>
          <select value={formulaId} onChange={e => setFormulaId(e.target.value)}
            style={{ flex: 1, minWidth: 180, padding: "4px 8px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.72rem", outline: "none", background: "var(--bgc)" }}>
            <option value="">— Mặc định ({measurement === 'diameter' ? 'K²×D×7854/10⁸' : 'V²×D×8/10⁶'}) —</option>
            {filteredFormulas.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
          <span style={{ fontSize: "0.64rem", color: "var(--tm)", fontStyle: "italic" }}>📐 {activeFormula?.label}</span>
        </div>
      )}

      {/* Hint cột */}
      <div style={{ fontSize: "0.68rem", color: "var(--brl)", marginBottom: 4, fontWeight: 700 }}>
        Dán dữ liệu CSV hoặc chọn file (tab / dấu phẩy):
        <span style={{ fontWeight: 400, marginLeft: 8, color: "var(--tm)" }}>{hintCol}</span>
      </div>

      {/* Textarea */}
      <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder="Dán dữ liệu từ Excel vào đây..."
        style={{ width: "100%", padding: "7px 10px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.73rem", outline: "none", boxSizing: "border-box", fontFamily: "monospace" }} />

      {/* Actions */}
      <div style={{ display: "flex", gap: 6, justifyContent: "space-between", marginTop: 6 }}>
        <div style={{ display: "flex", gap: 5 }}>
          <input type="file" ref={fileRef} style={{ display: "none" }} accept=".csv,.txt" onChange={handleFile} />
          <button onClick={() => fileRef.current?.click()}
            style={{ padding: "4px 10px", borderRadius: 5, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem" }}>📂 Chọn file</button>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={() => { setOpen(false); setText(''); }}
            style={{ padding: "4px 12px", borderRadius: 5, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem" }}>Hủy</button>
          <button onClick={doImport} disabled={!text.trim()}
            style={{ padding: "4px 16px", borderRadius: 5, background: text.trim() ? "var(--ac)" : "var(--bds)", color: "#fff", border: "none", cursor: text.trim() ? "pointer" : "default", fontSize: "0.72rem", fontWeight: 700 }}>
            Tải dữ liệu
          </button>
        </div>
      </div>
    </div>
  );
}

// ── PieceForm — form nhập từng cây, formula-aware + toggle vanh/kính ───────────
function PieceForm({ rows, setRows, formula, isBox, onSave, onCancel }) {
  // Toggle nhập theo vanh hoặc kính (chỉ áp dụng cho gỗ tròn, không weight, không box)
  const configMeasurement = formula?.measurement || 'circumference';
  // Auto-detect từ rows nếu đã có data (import), otherwise dùng formula config
  const [measurement, setMeasurement] = useState(() => {
    if (isBox || configMeasurement === 'weight') return configMeasurement;
    if (rows?.some(r => r.diameterCm)) return 'diameter';
    if (rows?.some(r => r.circumferenceCm)) return 'circumference';
    return configMeasurement;
  });

  const iS = { padding: "4px 5px", borderRadius: 4, border: "1.5px solid var(--bd)", fontSize: "0.74rem", outline: "none", boxSizing: "border-box" };
  const isWeight   = measurement === 'weight';
  const isDiameter = !isBox && measurement === 'diameter';
  const showToggle = !isBox && configMeasurement !== 'weight'; // toggle chỉ cho gỗ tròn, không weight

  // Công thức tính theo measurement hiện tại
  const activeFormula = isBox ? null
    : isDiameter ? (formula?.measurement === 'diameter' ? formula : DEFAULT_DIAMETER_FORMULA)
    : (formula?.measurement === 'circumference' ? formula : DEFAULT_ROUND_FORMULA);

  const calcRow = (r) => isBox ? calcVolBox(r) : (isWeight ? null : calcVolByFormula(activeFormula, r));

  const totalVol = rows.reduce((s, r) => s + (calcRow(r) || 0), 0);
  const totalKg  = rows.reduce((s, r) => s + (parseFloat(r.weightKg) || 0), 0);
  const validCount = isWeight ? rows.filter(r => r.weightKg).length : rows.filter(r => r.lengthM).length;

  let headers;
  if (isBox)        headers = ["Mã", "Dài(m)", "Rộng(cm)", "Dày(cm)", "m³(tính)", "CL", "Ghi chú", ""];
  else if (isWeight)headers = ["Mã", "Khối lượng(kg)", "CL", "Ghi chú", ""];
  else if (isDiameter) headers = ["Mã", "Dài(m)", "Kính(cm)", "m³(tính)", "CL", "Ghi chú", ""];
  else              headers = ["Mã", "Dài(m)", "Vanh(cm)", "m³(tính)", "CL", "Ghi chú", ""];

  return (
    <div style={{ padding: "10px 12px", borderRadius: 7, background: "var(--bgc)", border: "1.5px solid var(--ac)", marginBottom: 8 }}>
      {/* Header: tên công thức + toggle vanh/kính */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
        <span style={{ fontSize: "0.66rem", color: "var(--tm)", fontStyle: "italic", flex: 1 }}>
          📐 {activeFormula?.label || "Gỗ hộp — L×W×T"}
        </span>
        {showToggle && (
          <div style={{ display: "flex", borderRadius: 5, overflow: "hidden", border: "1.5px solid var(--bd)" }}>
            {[{ val: 'circumference', label: 'Vanh' }, { val: 'diameter', label: 'Kính' }].map(opt => (
              <button key={opt.val} onClick={() => setMeasurement(opt.val)}
                style={{ padding: "3px 10px", border: "none", cursor: "pointer", fontSize: "0.7rem", fontWeight: measurement === opt.val ? 700 : 500, background: measurement === opt.val ? "var(--ac)" : "var(--bgc)", color: measurement === opt.val ? "#fff" : "var(--ts)" }}>
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "max-content", minWidth: "100%", borderCollapse: "collapse", fontSize: "0.74rem" }}>
          <thead><tr style={{ background: "var(--bgs)" }}>
            {headers.map((h, i) => <th key={i} style={{ padding: "4px 6px", textAlign: "left", fontWeight: 700, fontSize: "0.6rem", color: "var(--brl)", textTransform: "uppercase", borderBottom: "1px solid var(--bds)", whiteSpace: "nowrap" }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {rows.map((r, idx) => {
              const vol = calcRow(r);
              const upd = (f, v) => setRows(p => p.map((x, i) => i === idx ? { ...x, [f]: v } : x));
              return (
                <tr key={r._id}>
                  <td style={{ padding: "3px 4px" }}><input value={r.pieceCode} onChange={e => upd("pieceCode", e.target.value)} placeholder="01" style={{ ...iS, width: 55 }} /></td>
                  {isWeight ? (
                    <td style={{ padding: "3px 4px" }}><input type="number" step="0.001" value={r.weightKg} onChange={e => upd("weightKg", e.target.value)} placeholder="0.000" style={{ ...iS, width: 90, textAlign: "right" }} /></td>
                  ) : (<>
                    <td style={{ padding: "3px 4px" }}><input type="number" step="0.01" value={r.lengthM} onChange={e => upd("lengthM", e.target.value)} placeholder="3.20" style={{ ...iS, width: 65, textAlign: "right" }} /></td>
                    {isBox && <>
                      <td style={{ padding: "3px 4px" }}><input type="number" step="0.1" value={r.widthCm} onChange={e => upd("widthCm", e.target.value)} placeholder="25" style={{ ...iS, width: 60, textAlign: "right" }} /></td>
                      <td style={{ padding: "3px 4px" }}><input type="number" step="0.1" value={r.thicknessCm} onChange={e => upd("thicknessCm", e.target.value)} placeholder="15" style={{ ...iS, width: 60, textAlign: "right" }} /></td>
                    </>}
                    {!isBox && isDiameter && (
                      <td style={{ padding: "3px 4px" }}><input type="number" step="0.1" value={r.diameterCm} onChange={e => upd("diameterCm", e.target.value)} placeholder="42" style={{ ...iS, width: 60, textAlign: "right" }} /></td>
                    )}
                    {!isBox && !isDiameter && (
                      <td style={{ padding: "3px 4px" }}><input type="number" step="0.1" value={r.circumferenceCm} onChange={e => upd("circumferenceCm", e.target.value)} placeholder="125" style={{ ...iS, width: 65, textAlign: "right" }} /></td>
                    )}
                    <td style={{ padding: "3px 4px", textAlign: "right", fontWeight: 600, color: vol > 0 ? "var(--br)" : "var(--tm)", width: 70, fontSize: "0.73rem" }}>{vol != null ? vol.toFixed(4) : "—"}</td>
                  </>)}
                  <td style={{ padding: "3px 4px" }}>
                    <select value={r.quality || "TB"} onChange={e => upd("quality", e.target.value)} style={{ ...iS, width: 52, padding: "2px 3px" }}>
                      {['Xấu','TB','Đẹp'].map(q => <option key={q} value={q}>{q}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: "3px 4px" }}><input value={r.notes} onChange={e => upd("notes", e.target.value)} style={{ ...iS, width: 100 }} /></td>
                  <td style={{ padding: "3px 4px" }}><button onClick={() => setRows(p => p.filter((_, i) => i !== idx))} style={{ width: 20, height: 20, padding: 0, borderRadius: 3, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.65rem" }}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot><tr>
              <td colSpan={isWeight ? 1 : (isBox ? 4 : 3)} style={{ padding: "4px 6px", textAlign: "right", fontWeight: 700, fontSize: "0.66rem", color: "var(--brl)", borderTop: "1.5px solid var(--bds)" }}>Tổng ({validCount}):</td>
              {isWeight
                ? <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.76rem", borderTop: "1.5px solid var(--bds)" }}>{totalKg.toFixed(3)} kg</td>
                : <td style={{ padding: "4px 6px", textAlign: "right", fontWeight: 800, color: "var(--br)", fontSize: "0.76rem", borderTop: "1.5px solid var(--bds)" }}>{totalVol.toFixed(4)} m³</td>
              }
              <td colSpan={3} style={{ borderTop: "1.5px solid var(--bds)" }} />
            </tr></tfoot>
          )}
        </table>
      </div>
      <div style={{ display: "flex", gap: 6, justifyContent: "space-between", marginTop: 8 }}>
        <button onClick={() => setRows(p => [...p, emptyPieceRow()])} style={{ padding: "4px 10px", borderRadius: 5, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem" }}>+ Dòng</button>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={onCancel} style={{ padding: "4px 12px", borderRadius: 5, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem" }}>Hủy</button>
          <button onClick={onSave} style={{ padding: "4px 16px", borderRadius: 5, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700 }}>Lưu ({validCount} cây)</button>
        </div>
      </div>
    </div>
  );
}

// ── PieceTable — hiển thị packing list / inspection, formula-aware ────────────
function PieceTable({ pieces, formula, isBox, ce, onDelete, showStatus, updateStatus }) {
  const [delConfirm, setDelConfirm] = useState(null); // {id, pieceCode, status} — confirm xóa cây đã xẻ/bán
  const thS = { padding: "5px 7px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", background: "var(--bgh)", whiteSpace: "nowrap" };
  const tdS = { padding: "4px 7px", borderBottom: "1px solid var(--bd)", fontSize: "0.73rem" };

  const handleDeleteClick = (p) => {
    if (p.status === 'sawn' || p.status === 'sold') {
      setDelConfirm({ id: p.id, pieceCode: p.pieceCode, status: p.status });
    } else {
      onDelete(p.id);
    }
  };
  const isWeight   = formula?.measurement === 'weight';
  // Gỗ tròn: hiển thị cả vanh lẫn kính — ẩn cột nào không có dữ liệu nào trong list
  const hasCircumference = !isBox && !isWeight && pieces.some(p => p.circumferenceCm != null);
  const hasDiameter      = !isBox && !isWeight && pieces.some(p => p.diameterCm      != null);
  // Nếu không có dữ liệu nào (list mới) → dùng formula config làm default hiển thị
  const showCircumference = !isBox && !isWeight && (hasCircumference || (!hasDiameter && formula?.measurement !== 'diameter'));
  const showDiameter      = !isBox && !isWeight && (hasDiameter      || (!hasCircumference && formula?.measurement === 'diameter'));
  const totalVol   = pieces.reduce((s, p) => s + (p.volumeM3 || 0), 0);
  const totalKg    = pieces.reduce((s, p) => s + (p.weightKg  || 0), 0);
  const availCount = pieces.filter(p => p.status === "available" && !p.isMissing).length;
  // Số cột đo để tính colSpan footer (Mã + các cột đo)
  const measCols = isBox ? 3 : isWeight ? 1
    : 1 + (showDiameter ? 1 : 0) + (showCircumference ? 1 : 0); // Dài + Kính? + Vanh?

  return (
    <div style={{ border: "1.5px solid var(--bd)", borderRadius: 7, overflow: "hidden" }}>
      {formula && (
        <div style={{ padding: "4px 10px", background: "var(--bgs)", fontSize: "0.64rem", color: "var(--tm)", borderBottom: "1px solid var(--bds)" }}>
          📐 {formula.label}
        </div>
      )}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 450, borderCollapse: "collapse", fontSize: "0.73rem" }}>
          <thead><tr>
            <th style={{ ...thS, width: 36 }}>#</th>
            <th style={thS}>Mã</th>
            {isWeight ? (
              <th style={{ ...thS, textAlign: "right" }}>Khối lượng(kg)</th>
            ) : (<>
              <th style={{ ...thS, textAlign: "right" }}>Dài(m)</th>
              {isBox && <><th style={{ ...thS, textAlign: "right" }}>Rộng(cm)</th><th style={{ ...thS, textAlign: "right" }}>Dày(cm)</th></>}
              {showDiameter      && <th style={{ ...thS, textAlign: "right" }}>Kính(cm)</th>}
              {showCircumference && <th style={{ ...thS, textAlign: "right" }}>Vanh(cm)</th>}
              <th style={{ ...thS, textAlign: "right" }}>m³</th>
            </>)}
            <th style={thS}>Chất lượng</th>
            {showStatus && <th style={thS}>Trạng thái</th>}
            <th style={thS}>Ghi chú</th>
            {ce && <th style={{ ...thS, width: 28 }}></th>}
          </tr></thead>
          <tbody>
            {pieces.length === 0 && <tr><td colSpan={20} style={{ padding: 16, textAlign: "center", color: "var(--tm)" }}>Chưa có dữ liệu</td></tr>}
            {pieces.map((p, i) => {
              const st = STATUS_COLORS[p.status] || STATUS_COLORS.available;
              const qualColor = p.quality === 'Xấu' ? { color: '#C0392B', bg: 'rgba(192,57,43,0.08)' }
                              : p.quality === 'Đẹp' ? { color: '#27AE60', bg: 'rgba(39,174,96,0.08)' }
                              : { color: 'var(--ts)', bg: 'var(--bgs)' };
              return (
                <tr key={p.id} style={{ background: i % 2 ? "var(--bgs)" : "#fff" }}>
                  <td style={{ ...tdS, textAlign: "center", color: "var(--tm)", fontWeight: 700, fontSize: "0.68rem" }}>{i + 1}</td>
                  <td style={{ ...tdS, fontWeight: 600, fontFamily: "monospace" }}>{p.pieceCode || "—"}</td>
                  {isWeight ? (
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 600 }}>{p.weightKg != null ? `${p.weightKg.toFixed(3)} kg` : "—"}</td>
                  ) : (<>
                    <td style={{ ...tdS, textAlign: "right" }}>{p.lengthM != null ? p.lengthM.toFixed(2) : "—"}</td>
                    {isBox && <><td style={{ ...tdS, textAlign: "right" }}>{p.widthCm ?? "—"}</td><td style={{ ...tdS, textAlign: "right" }}>{p.thicknessCm ?? "—"}</td></>}
                    {showDiameter      && <td style={{ ...tdS, textAlign: "right" }}>{p.diameterCm      != null ? p.diameterCm      : "—"}</td>}
                    {showCircumference && <td style={{ ...tdS, textAlign: "right" }}>{p.circumferenceCm != null ? p.circumferenceCm : "—"}</td>}
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 600 }}>{p.volumeM3 != null ? p.volumeM3.toFixed(4) : "—"}</td>
                  </>)}
                  {/* Chất lượng — dropdown Xấu/TB/Đẹp, editable khi ce */}
                  <td style={tdS}>
                    {ce
                      ? <select value={p.quality || "TB"} onChange={e => updateStatus(p.id, "quality", e.target.value)}
                          style={{ padding: "2px 5px", borderRadius: 4, border: `1px solid ${qualColor.color}`, background: qualColor.bg, color: qualColor.color, fontSize: "0.68rem", fontWeight: 700, outline: "none", cursor: "pointer" }}>
                          {['Xấu','TB','Đẹp'].map(q => <option key={q} value={q}>{q}</option>)}
                        </select>
                      : <span style={{ padding: "1px 6px", borderRadius: 4, background: qualColor.bg, color: qualColor.color, fontSize: "0.68rem", fontWeight: 700 }}>{p.quality || "TB"}</span>
                    }
                  </td>
                  {/* Trạng thái — chỉ đọc, auto theo hành động xẻ/bán */}
                  {showStatus && (
                    <td style={tdS}>
                      <span style={{ padding: "1px 6px", borderRadius: 4, background: st.bg, color: st.color, fontSize: "0.68rem", fontWeight: 700 }}>{st.label}</span>
                    </td>
                  )}
                  <td style={{ ...tdS, color: "var(--tm)", fontSize: '0.68rem' }}>
                    {p.sawingBatchId && <span style={{ display: 'inline-block', marginBottom: 2, padding: '1px 5px', borderRadius: 3, background: 'rgba(41,128,185,0.1)', color: '#2980b9', fontWeight: 700, fontSize: '0.62rem' }}>🪚 Đã xẻ</span>}
                    {p.notes || ""}
                  </td>
                  {ce && <td style={tdS}><button onClick={() => handleDeleteClick(p)} style={{ width: 18, height: 18, padding: 0, borderRadius: 3, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.6rem" }}>✕</button></td>}
                </tr>
              );
            })}
          </tbody>
          {pieces.length > 0 && (
            <tfoot><tr style={{ background: "var(--bgh)" }}>
              <td colSpan={2 + measCols} style={{ padding: "5px 7px", textAlign: "right", fontWeight: 700, fontSize: "0.66rem", color: "var(--brl)", borderTop: "2px solid var(--bds)" }}>
                Tổng ({pieces.length}) {showStatus ? `· ${availCount} còn lại` : ""}:
              </td>
              <td style={{ padding: "5px 7px", textAlign: "right", fontWeight: 800, color: "var(--br)", borderTop: "2px solid var(--bds)" }}>
                {isWeight ? `${totalKg.toFixed(3)} kg` : `${totalVol.toFixed(4)} m³`}
              </td>
              <td colSpan={20} style={{ borderTop: "2px solid var(--bds)" }} />
            </tr></tfoot>
          )}
        </table>
      </div>

      {/* Custom confirm dialog xóa cây đã xẻ/bán */}
      {delConfirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(45,32,22,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "var(--bgc)", borderRadius: 14, padding: 24, width: 380, maxWidth: "90vw", border: "1px solid var(--bd)", boxShadow: "0 8px 32px rgba(0,0,0,0.2)" }}>
            <div style={{ fontWeight: 800, fontSize: "0.95rem", color: "var(--dg)", marginBottom: 8 }}>Xác nhận xóa cây nghiệm thu</div>
            <div style={{ fontSize: "0.82rem", color: "var(--ts)", marginBottom: 12, lineHeight: 1.5 }}>
              Cây <strong style={{ fontFamily: "monospace" }}>{delConfirm.pieceCode || delConfirm.id}</strong> đang ở trạng thái{" "}
              <strong style={{ color: delConfirm.status === "sawn" ? "#2980b9" : "#8B5E3C" }}>
                {delConfirm.status === "sawn" ? "Đã xẻ" : "Đã bán"}
              </strong>.
            </div>
            <div style={{ padding: "8px 12px", borderRadius: 7, background: "rgba(192,57,43,0.07)", border: "1px solid rgba(192,57,43,0.2)", fontSize: "0.74rem", color: "var(--dg)", marginBottom: 16, lineHeight: 1.5 }}>
              {delConfirm.status === "sawn"
                ? "Xóa cây này sẽ gỡ liên kết với mẻ xẻ và hoàn trạng thái về tồn kho."
                : "Cây này đã được gắn vào đơn hàng. Xóa khỏi nghiệm thu sẽ ảnh hưởng đến đơn hàng liên quan."}
            </div>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setDelConfirm(null)}
                style={{ padding: "7px 18px", borderRadius: 7, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontWeight: 600, fontSize: "0.8rem" }}>
                Hủy
              </button>
              <button onClick={() => { onDelete(delConfirm.id); setDelConfirm(null); }}
                style={{ padding: "7px 18px", borderRadius: 7, border: "none", background: "var(--dg)", color: "#fff", cursor: "pointer", fontWeight: 700, fontSize: "0.8rem" }}>
                Xóa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── WoodTypeMgr — quản lý loại gỗ + config công thức ─────────────────────────
function WoodTypeMgr({ rawWoodTypes, formulas, typeEd, setTypeEd, typeFm, setTypeFm, saveType, deleteType }) {
  const inp = { width: "100%", padding: "5px 7px", borderRadius: 5, border: "1.5px solid var(--bd)", fontSize: "0.74rem", outline: "none", boxSizing: "border-box", background: "var(--bgc)" };
  const lbl = { display: "block", fontSize: "0.62rem", fontWeight: 700, color: "var(--brl)", marginBottom: 2 };
  const UNIT_TYPES = [
    { value: "volume", label: "m³ (đo kích thước)" },
    { value: "weight", label: "Tấn/kg (cân)" },
    { value: "both",   label: "NCC cân → bán m³" },
  ];

  return (
    <div style={{ background: "var(--bgc)", borderRadius: 10, border: "1px solid var(--bd)", padding: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
        <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--br)" }}>Loại gỗ nguyên liệu</span>
        <button onClick={() => { setTypeFm({ name: "", woodForm: "round", icon: "🪵", supplierFormulaId: "", inspectionFormulaId: "", unitType: "volume", saleUnit: "volume" }); setTypeEd("new"); }}
          style={{ padding: "3px 8px", borderRadius: 4, background: "var(--br)", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.68rem", fontWeight: 600 }}>+ Thêm</button>
      </div>

      {typeEd != null && (
        <div style={{ padding: "8px 10px", borderRadius: 7, background: "var(--bgs)", border: "1.5px solid var(--ac)", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <div style={{ flex: 2, minWidth: 100 }}>
              <label style={lbl}>Tên</label>
              <input value={typeFm.name} onChange={e => setTypeFm(p => ({ ...p, name: e.target.value }))} placeholder="VD: Tần bì tròn" style={inp} />
            </div>
            <div style={{ minWidth: 80 }}>
              <label style={lbl}>Hình thức</label>
              <select value={typeFm.woodForm} onChange={e => setTypeFm(p => ({ ...p, woodForm: e.target.value }))} style={inp} disabled={typeEd !== "new"}>
                <option value="round">Gỗ tròn</option>
                <option value="box">Gỗ hộp</option>
              </select>
            </div>
            <div style={{ minWidth: 50 }}>
              <label style={lbl}>Icon</label>
              <input value={typeFm.icon} onChange={e => setTypeFm(p => ({ ...p, icon: e.target.value }))} style={{ ...inp, width: 48, textAlign: "center" }} />
            </div>
          </div>
          {typeFm.woodForm === "round" && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={lbl}>📐 Công thức NCC</label>
                <select value={typeFm.supplierFormulaId} onChange={e => setTypeFm(p => ({ ...p, supplierFormulaId: e.target.value }))} style={inp}>
                  <option value="">— Mặc định (vanh chuẩn) —</option>
                  {formulas.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 140 }}>
                <label style={lbl}>📐 Công thức Nghiệm thu</label>
                <select value={typeFm.inspectionFormulaId} onChange={e => setTypeFm(p => ({ ...p, inspectionFormulaId: e.target.value }))} style={inp}>
                  <option value="">— Mặc định (vanh chuẩn) —</option>
                  {formulas.map(f => <option key={f.id} value={f.id}>{f.label}</option>)}
                </select>
              </div>
            </div>
          )}
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <label style={lbl}>Đơn vị nhập</label>
              <select value={typeFm.unitType} onChange={e => setTypeFm(p => ({ ...p, unitType: e.target.value }))} style={inp}>
                {UNIT_TYPES.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 100 }}>
              <label style={lbl}>Đơn vị bán</label>
              <select value={typeFm.saleUnit} onChange={e => setTypeFm(p => ({ ...p, saleUnit: e.target.value }))} style={inp}>
                <option value="volume">m³</option>
                <option value="weight">Tấn/kg</option>
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 5, justifyContent: "flex-end" }}>
            <button onClick={() => setTypeEd(null)} style={{ padding: "4px 10px", borderRadius: 4, border: "1.5px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.72rem" }}>Hủy</button>
            <button onClick={saveType} style={{ padding: "4px 12px", borderRadius: 4, background: "var(--ac)", color: "#fff", border: "none", cursor: "pointer", fontSize: "0.72rem", fontWeight: 700 }}>Lưu</button>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {rawWoodTypes.map(t => {
          const unitLabels = { volume: "m³", weight: "Tấn", both: "Tấn→m³" };
          return (
            <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "5px 7px", borderRadius: 6, border: "1px solid var(--bds)", background: "var(--bgs)", fontSize: "0.72rem" }}>
              <span style={{ flex: 1 }}>{t.icon} {t.name}</span>
              <span style={{ fontSize: "0.58rem", padding: "1px 4px", borderRadius: 3, background: t.woodForm === 'box' ? "rgba(41,128,185,0.1)" : "rgba(139,94,60,0.1)", color: t.woodForm === 'box' ? "#2980b9" : "#8B5E3C", fontWeight: 600 }}>{t.woodForm === 'box' ? 'hộp' : 'tròn'}</span>
              <span style={{ fontSize: "0.58rem", color: "var(--tm)" }}>{unitLabels[t.unitType] || "m³"}</span>
              <button onClick={() => { setTypeFm({ name: t.name, woodForm: t.woodForm, icon: t.icon, supplierFormulaId: t.supplierFormulaId || "", inspectionFormulaId: t.inspectionFormulaId || "", unitType: t.unitType || "volume", saleUnit: t.saleUnit || "volume" }); setTypeEd(t.id); }}
                style={{ padding: "1px 5px", borderRadius: 3, border: "1px solid var(--bd)", background: "transparent", color: "var(--ts)", cursor: "pointer", fontSize: "0.62rem" }}>✎</button>
              <button onClick={() => deleteType(t)}
                style={{ padding: "1px 5px", borderRadius: 3, border: "1px solid var(--dg)", background: "transparent", color: "var(--dg)", cursor: "pointer", fontSize: "0.62rem" }}>✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── ComparisonTab — đối chiếu NCC vs. Nghiệm thu ─────────────────────────────
function ComparisonTab({ packingList, inspection, isBox, isRaw }) {
  if (!packingList || !inspection) return <div style={{ padding: 20, textAlign: "center", color: "var(--tm)" }}>Đang tải dữ liệu...</div>;

  const plVol    = packingList.reduce((s, p) => s + (p.volumeM3 || 0), 0);
  const insVol   = inspection.reduce((s, p) => s + (p.volumeM3 || 0), 0);
  const deltaVol = insVol - plVol;
  // Thống kê chất lượng
  const goodCount = inspection.filter(p => p.quality === 'Đẹp').length;
  const badCount  = inspection.filter(p => p.quality === 'Xấu').length;

  const thS = { padding: "5px 7px", textAlign: "left", color: "var(--brl)", fontWeight: 700, fontSize: "0.58rem", textTransform: "uppercase", borderBottom: "1.5px solid var(--bds)", background: "var(--bgh)" };
  const tdS = { padding: "4px 7px", borderBottom: "1px solid var(--bd)", fontSize: "0.73rem" };

  // Ghép cặp NCC ↔ nghiệm thu — ưu tiên theo 3 cấp:
  // 1. packingListId khớp chính xác (khi dùng "Copy từ list NCC")
  // 2. pieceCode khớp + packingListId null (nhập tay cùng mã)
  // 3. Không ghép được → noMatch
  const usedInsIds = new Set();
  const paired = packingList.map(pl => {
    // Cấp 1: link trực tiếp qua packingListId
    let ins = inspection.find(i => i.packingListId === pl.id && !usedInsIds.has(i.id));
    // Cấp 2: cùng mã cây, chưa được ghép
    if (!ins && pl.pieceCode) {
      ins = inspection.find(i =>
        !i.packingListId &&
        i.pieceCode &&
        i.pieceCode.trim() === pl.pieceCode.trim() &&
        !usedInsIds.has(i.id)
      );
    }
    if (ins) usedInsIds.add(ins.id);
    const delta = ins && ins.volumeM3 != null && pl.volumeM3 != null ? ins.volumeM3 - pl.volumeM3 : null;
    return { pl, ins, delta };
  });
  // Nghiệm thu không ghép được với bất kỳ NCC nào → cây THỪA
  const noMatch = inspection.filter(ins => !usedInsIds.has(ins.id));
  // Cây THIẾU: có trong PL nhưng không có trong inspection
  const missingCount = paired.filter(({ ins }) => !ins).length;
  const extraCount   = noMatch.length;

  return (
    <div>
      {/* Summary */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
        {[
          { label: "NCC khai báo",  val: `${packingList.length} cây · ${plVol.toFixed(4)} m³`, color: "var(--br)" },
          { label: "Nghiệm thu",    val: `${inspection.length} cây · ${insVol.toFixed(4)} m³`, color: "var(--gn)" },
          { label: "Chênh lệch KL", val: `${deltaVol >= 0 ? "+" : ""}${deltaVol.toFixed(4)} m³`, color: deltaVol < 0 ? "#E74C3C" : "var(--gn)" },
          { label: "Cây thiếu",     val: `${missingCount}`, color: missingCount > 0 ? "#E74C3C" : "var(--gn)" },
          { label: "Cây thừa",      val: `${extraCount}`,   color: extraCount   > 0 ? "#F59E0B" : "var(--gn)" },
          { label: "Cây đẹp",       val: `${goodCount}`,    color: goodCount    > 0 ? "#27AE60" : "var(--ts)" },
          { label: "Cây xấu",       val: `${badCount}`,     color: badCount     > 0 ? "#C0392B" : "var(--ts)" },
        ].map(s => (
          <div key={s.label} style={{ padding: "7px 12px", borderRadius: 7, background: "var(--bgc)", border: "1px solid var(--bd)" }}>
            <div style={{ fontSize: "0.6rem", color: "var(--tm)", textTransform: "uppercase", fontWeight: 700 }}>{s.label}</div>
            <div style={{ fontSize: "0.9rem", fontWeight: 800, color: s.color }}>{s.val}</div>
          </div>
        ))}
      </div>

      <div style={{ border: "1.5px solid var(--bd)", borderRadius: 7, overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", minWidth: 700, borderCollapse: "collapse", fontSize: "0.72rem" }}>
            <thead><tr>
              <th style={{ ...thS, width: 36 }}>#</th>
              <th style={thS}>Mã cây</th>
              <th style={{ ...thS, textAlign: "right", background: "rgba(50,79,39,0.06)" }}>m³ (NCC)</th>
              <th style={{ ...thS, textAlign: "right", background: "rgba(41,128,185,0.06)" }}>m³ (NT)</th>
              <th style={{ ...thS, textAlign: "right" }}>Δ m³</th>
              <th style={thS}>CL(NCC)</th>
              <th style={thS}>CL(NT)</th>
              <th style={thS}>Ghi chú</th>
            </tr></thead>
            <tbody>
              {paired.map(({ pl, ins, delta }, i) => {
                const isMissingRow = !ins; // Cây thiếu: có trong PL nhưng không có trong NT
                const rowBg = isMissingRow ? "rgba(231,76,60,0.07)" : (i % 2 ? "var(--bgs)" : "#fff");
                const qualColor = (q) => q === 'Đẹp' ? '#27AE60' : q === 'Xấu' ? '#C0392B' : 'var(--ts)';
                return (
                  <tr key={pl.id} style={{ background: rowBg }}>
                    <td style={{ ...tdS, textAlign: "center", color: "var(--tm)" }}>{i + 1}</td>
                    <td style={{ ...tdS, fontWeight: 600, fontFamily: "monospace" }}>
                      {pl.pieceCode || "—"}
                      {isMissingRow && <span style={{ marginLeft: 6, padding: "1px 5px", borderRadius: 3, background: "#E74C3C", color: "#fff", fontSize: "0.58rem", fontWeight: 700 }}>THIẾU</span>}
                    </td>
                    <td style={{ ...tdS, textAlign: "right", background: "rgba(50,79,39,0.03)" }}>{pl.volumeM3 != null ? pl.volumeM3.toFixed(4) : "—"}</td>
                    <td style={{ ...tdS, textAlign: "right", background: "rgba(41,128,185,0.03)",
                      color: isMissingRow ? "#E74C3C" : delta == null ? "var(--tp)" : delta > 0.001 ? "#27AE60" : delta < -0.001 ? "#E74C3C" : "var(--tp)",
                      fontWeight: delta != null && Math.abs(delta) > 0.001 ? 600 : 400 }}>
                      {isMissingRow ? <span style={{ color: "#E74C3C", fontWeight: 700 }}>—</span> : (ins?.volumeM3 != null ? ins.volumeM3.toFixed(4) : "—")}
                    </td>
                    <td style={{ ...tdS, textAlign: "right", fontWeight: 800,
                      color: isMissingRow ? "#E74C3C" : delta == null ? "var(--tm)" : delta > 0.001 ? "#27AE60" : delta < -0.001 ? "#E74C3C" : "var(--ts)" }}>
                      {isMissingRow ? `−${pl.volumeM3?.toFixed(4) || "0"}` : delta != null ? `${delta >= 0 ? "+" : ""}${delta.toFixed(4)}` : "—"}
                    </td>
                    <td style={{ ...tdS, color: qualColor(pl.quality) }}>{pl.quality || "—"}</td>
                    <td style={{ ...tdS, color: qualColor(ins?.quality) }}>{isMissingRow ? "—" : (ins?.quality || "TB")}</td>
                    <td style={{ ...tdS, color: "var(--tm)" }}>{ins?.notes || ""}</td>
                  </tr>
                );
              })}
              {noMatch.map((ins, i) => {
                const qualColor = ins.quality === 'Đẹp' ? '#27AE60' : ins.quality === 'Xấu' ? '#C0392B' : 'var(--ts)';
                return (
                  <tr key={"nm_" + ins.id} style={{ background: "rgba(245,158,11,0.07)" }}>
                    <td style={{ ...tdS, textAlign: "center", color: "#F59E0B", fontWeight: 700 }}>+</td>
                    <td style={{ ...tdS, fontWeight: 600, fontFamily: "monospace" }}>
                      {ins.pieceCode || "—"}
                      <span style={{ marginLeft: 6, padding: "1px 5px", borderRadius: 3, background: "#F59E0B", color: "#fff", fontSize: "0.58rem", fontWeight: 700 }}>THỪA</span>
                    </td>
                    <td style={{ ...tdS, textAlign: "right", color: "var(--tm)", background: "rgba(50,79,39,0.03)" }}>—</td>
                    <td style={{ ...tdS, textAlign: "right", background: "rgba(41,128,185,0.03)" }}>{ins.volumeM3 != null ? ins.volumeM3.toFixed(4) : "—"}</td>
                    <td style={{ ...tdS, textAlign: "right", color: "#F59E0B", fontWeight: 700 }}>+{ins.volumeM3?.toFixed(4) || "0"}</td>
                    <td style={tdS}>—</td>
                    <td style={{ ...tdS, color: qualColor }}>{ins.quality || "TB"}</td>
                    <td style={{ ...tdS, color: "var(--tm)" }}>{ins.notes || ""}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
