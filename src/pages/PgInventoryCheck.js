import React, { useState, useEffect, useCallback, useRef } from "react";
import * as XLSX from "xlsx";
import sb from "../api/client";
import { fetchDropboxLinks, saveDropboxLinks } from "../api/settings";

// ═══════ CONSTANTS ═══════
const SB_FUNC_URL = `${process.env.REACT_APP_SUPABASE_URL || 'https://tscddgjkelnmlitzcxyg.supabase.co'}/functions/v1/fetch-dropbox`;
const SALE_DATE_CUTOFF = new Date('2026-03-20T00:00:00');
const VOL_TOL = 0.005;

const WOOD_NAMES = {
  ash_eu:'TẦN BÌ NK', ash_xs:'TẦN BÌ XS', bas:'TEAK', beech_eu:'BEECH NK', beech_xs:'BEECH XS',
  pachyloba:'GÕ', pine:'THÔNG NK', pine_cladding:'THÔNG ỐP', pine_xs:'THÔNG XS',
  red_oak_eu:'SỒI ĐỎ NK ÂU', red_oak_us:'SỒI ĐỎ NK MỸ', red_oak_xs:'SỒI ĐỎ XS',
  walnut:'ÓC CHÓ NK', walnut_xs:'ÓC CHÓ XS', white_oak_eu:'SỒI TRẮNG NK ÂU', white_oak_us:'SỒI TRẮNG NK MỸ'
};
const WOOD_MAP_MY = { 'R.OAK':'red_oak_us','W.OAK':'white_oak_us','WALNUT':'walnut','BLACK WANUT':'walnut' };
const WOOD_MAP_AU = { 'ASH':'ash_eu','BEECH':'beech_eu','R.OAK':'red_oak_eu','W.OAK':'white_oak_eu' };
const WOOD_MAP_XE = { 'TẦN BÌ':'ash_xs','Tần Bì':'ash_xs','Tần bì':'ash_xs','GÕ':'pachyloba','Gõ':'pachyloba',
  'ÓC CHÓ':'walnut_xs','SỒI ĐỎ':'red_oak_xs','TEAK':'bas','Teak':'bas',
  'BEECH':'beech_xs','Beech':'beech_xs','THÔNG MỸ VÀNG':'pine_xs','THÔNG  MỸ VÀNG':'pine_xs' };
const SKIP_XE = new Set(['X.ĐÀO','S.TRẮNG','S.Trắng','POPLAR','Poplar','Dâu','MUỒNG','SỒI TRẮNG','XOAN ĐÀO','THÔNG TRẮNG','N/A','']);
const STATUS_MAP = { 'Kiện nguyên':'Kiện nguyên','K.Nguyên':'Kiện nguyên','Kiện lẻ':'Kiện lẻ','K.Lẻ':'Kiện lẻ','Lẻ':'Kiện lẻ' };
const THONG_TYPE_MAP = { 'Trắng':'pine','Vàng':'pine','Vàng - Mỹ':'pine','Vàng-Mỹ':'pine','TRắng':'pine','Trắng ':'pine','Trắng xẻ':'pine' };
const THONG_OP_TYPES = new Set(['Thông ốp','ỐP','Ốp','ỐP ']);

const DEFAULT_LINKS = {
  NK_MY: 'https://www.dropbox.com/scl/fi/gf02qpcre6fh3y3vd88vm/S-KHO-G-NK-M.xlsx?rlkey=7pa7how1p6ucuf60wedsmthuk&st=1gbeuoor&dl=0',
  NK_AU: 'https://www.dropbox.com/scl/fi/cx9dcdjfxqqarhnneigma/S-KHO-G-NK-U.xlsx?rlkey=hcdiny1b0oqurstxu8il5we0i&st=9ddqxn43&dl=0',
  THONG_NK: 'https://www.dropbox.com/scl/fi/zs0wmue6rb4ut2c546cbt/S-KHO-G-TH-NG-NK.xlsx?rlkey=hcg4unot6rayyu98majnqlsnc&st=0th2522f&dl=0',
  GO_XE: 'https://www.dropbox.com/scl/fi/38ale2i420wkks1pqnyzk/S-G-X.xlsx?rlkey=gs9r3kpf00r9vngtgc439dxbv&st=p6p0jwhn&dl=0',
};
const FILE_LABELS = { NK_MY:'SỔ KHO GỖ NK MỸ', NK_AU:'SỔ KHO GỖ NK ÂU', THONG_NK:'SỔ KHO GỖ THÔNG NK', GO_XE:'SỔ GỖ XẺ' };
const FILE_KEYS = ['NK_MY','NK_AU','THONG_NK','GO_XE'];

// ═══════ HELPERS ═══════
const XL_EPOCH = new Date(1899, 11, 30);
function xlToDate(s) { if (typeof s !== 'number' || s < 1) return null; return new Date(XL_EPOCH.getTime() + s * 86400000); }
function fmtD(d) { if (!d) return ''; return d.toLocaleDateString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}); }
function fmtM(v) { if (!v) return '-'; return Math.round(v).toLocaleString('vi-VN'); }
function fmtDelta(v) { if (v == null) return '-'; return (v >= 0 ? '+' : '') + v.toFixed(4); }
function fmtDeltaInt(v) { if (v == null || v === 0) return '-'; return (v >= 0 ? '+' : '') + v; }

// ═══════ STYLES — dùng var(--xx) đúng ngôn ngữ thiết kế app ═══════
const S = {
  page: { padding: 16 },
  h1: { fontSize: '1.2rem', fontWeight: 700, color: 'var(--br)', marginBottom: 4 },
  sub: { fontSize: '0.78rem', color: 'var(--tm)', marginBottom: 16 },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 8, marginBottom: 14 },
  card: () => ({ background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 8, padding: '10px 14px', cursor: 'pointer', transition: 'all .12s' }),
  cardVal: (c) => ({ fontSize: '1.5rem', fontWeight: 700, color: c || 'var(--tp)' }),
  cardLbl: { fontSize: '0.72rem', color: 'var(--ts)', marginTop: 2 },
  tabs: { display: 'flex', gap: 0, borderBottom: '2px solid var(--bd)', marginBottom: 0 },
  tab: (active) => ({ padding: '7px 16px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 600,
    borderBottom: active ? '2px solid var(--br)' : '2px solid transparent', marginBottom: -2,
    color: active ? 'var(--br)' : 'var(--tm)', transition: 'all .12s' }),
  badge: (active) => ({ background: active ? 'var(--br)' : 'var(--bd)', color: active ? '#FAF6F0' : 'var(--ts)',
    padding: '1px 7px', borderRadius: 10, fontSize: '0.68rem', marginLeft: 4, fontWeight: 700 }),
  // Top-level mode tabs
  modeBar: { display: 'flex', gap: 0, marginBottom: 16 },
  modeTab: (active) => ({ padding: '10px 24px', cursor: 'pointer', fontSize: '0.88rem', fontWeight: 700,
    background: active ? 'var(--br)' : 'var(--bgc)', color: active ? '#FAF6F0' : 'var(--tm)',
    border: active ? '1px solid var(--br)' : '1px solid var(--bd)', borderRadius: 0,
    transition: 'all .12s' }),
  modeTabFirst: { borderRadius: '8px 0 0 8px' },
  modeTabLast: { borderRadius: '0 8px 8px 0' },
  tblWrap: { overflowX: 'auto', background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 8, marginBottom: 12 },
  tbl: { width: '100%', borderCollapse: 'collapse', fontSize: '0.76rem' },
  th: { background: 'var(--bgs)', padding: '6px 8px', textAlign: 'left', fontWeight: 600, whiteSpace: 'nowrap', cursor: 'pointer', position: 'sticky', top: 0 },
  td: { padding: '5px 8px', borderTop: '1px solid var(--bd)', whiteSpace: 'nowrap' },
  r: { textAlign: 'right' },
  pos: { color: 'var(--gn)', fontWeight: 600 },
  neg: { color: 'var(--dg)', fontWeight: 600 },
  tag: (bg, color) => ({ display: 'inline-block', padding: '1px 7px', borderRadius: 4, fontSize: '0.68rem', fontWeight: 600, background: bg, color }),
  mono: { fontFamily: 'Consolas,monospace', fontSize: '0.74rem' },
  filters: { display: 'flex', gap: 8, padding: '8px 0', flexWrap: 'wrap', alignItems: 'center' },
  sel: { padding: '4px 8px', border: '1px solid var(--bd)', borderRadius: 6, fontSize: '0.76rem' },
  inp: { padding: '4px 8px', border: '1px solid var(--bd)', borderRadius: 6, fontSize: '0.76rem', width: 160 },
  btn: { padding: '7px 18px', border: 'none', borderRadius: 8, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', background: 'var(--br)', color: '#FAF6F0' },
  btnSec: { padding: '7px 18px', border: '1px solid var(--bd)', borderRadius: 8, fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', background: 'var(--bgs)', color: 'var(--br)' },
  log: { maxHeight: 100, overflowY: 'auto', background: 'var(--bgs)', border: '1px solid var(--bd)', borderRadius: 6, padding: 8, fontSize: '0.7rem', fontFamily: 'Consolas,monospace', color: 'var(--ts)', margin: '8px 0', whiteSpace: 'pre-wrap' },
  detailPanel: { background: 'var(--bgc)', border: '1px solid var(--bd)', borderRadius: 8, padding: 14, marginTop: 10 },
  detailGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 },
  detailCol: (bc) => ({ border: `1px solid ${bc || 'var(--bd)'}`, borderRadius: 6, padding: 10 }),
  detailRow: { display: 'flex', justifyContent: 'space-between', padding: '2px 0', fontSize: '0.76rem' },
  linkInput: { flex: 1, padding: '5px 8px', border: '1px solid var(--bd)', borderRadius: 6, fontSize: '0.72rem', fontFamily: 'Consolas,monospace' },
  configRow: { display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 },
  configLabel: { width: 140, fontSize: '0.76rem', fontWeight: 600 },
  progress: { height: 4, background: 'var(--bd)', borderRadius: 2, overflow: 'hidden', margin: '8px 0' },
  progressBar: (pct) => ({ height: '100%', background: 'var(--ac)', width: `${pct}%`, transition: 'width .3s' }),
};

function StTag({ st }) {
  if (!st) return <span>-</span>;
  const [bg, c] = st === 'Kiện nguyên' ? ['rgba(50,79,39,0.1)','var(--gn)'] : st === 'Kiện lẻ' ? ['rgba(242,101,34,0.1)','var(--ac)'] : st === 'Đang dong cạnh' ? ['rgba(37,99,235,0.1)','#2563EB'] : ['var(--bd)', 'var(--ts)'];
  return <span style={S.tag(bg, c)}>{st}</span>;
}

// ═══════ MAIN COMPONENT ═══════
export default function PgInventoryCheck({ user, useAPI, notify }) {
  // Config
  const [links, setLinks] = useState(DEFAULT_LINKS);
  const [showConfig, setShowConfig] = useState(false);
  // Data
  const [exBundles, setExBundles] = useState([]);
  const [dbBundles, setDbBundles] = useState([]);
  const [exSales, setExSales] = useState([]);
  const [dbSalesData, setDbSalesData] = useState([]);
  const [invResults, setInvResults] = useState(null);
  const [salesResults, setSalesResults] = useState(null);
  // UI
  const [mode, setMode] = useState('inv'); // 'inv' | 'sale'
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [logText, setLogText] = useState('');
  const [invTab, setInvTab] = useState('vol');
  const [saleTab, setSaleTab] = useState('saleDiff');
  const [filterWood, setFilterWood] = useState('');
  const [filterSearch, setFilterSearch] = useState('');
  const [saleFilterWood, setSaleFilterWood] = useState('');
  const [saleFilterSearch, setSaleFilterSearch] = useState('');
  const [sortCol, setSortCol] = useState(null);
  const [sortDir, setSortDir] = useState(1);
  const [saleSortCol, setSaleSortCol] = useState(null);
  const [saleSortDir, setSaleSortDir] = useState(1);
  const [detailIdx, setDetailIdx] = useState(null);
  const [saleDetailIdx, setSaleDetailIdx] = useState(null);
  const logRef = useRef(null);

  const log = useCallback((msg) => { setLogText(prev => prev + msg + '\n'); }, []);
  useEffect(() => { if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight; }, [logText]);

  // Load saved Dropbox links
  useEffect(() => {
    if (!useAPI) return;
    fetchDropboxLinks().then(saved => { if (saved) setLinks(prev => ({ ...prev, ...saved })); });
  }, [useAPI]);

  // ═══════ FETCH FROM DROPBOX ═══════
  async function fetchExcelFromDropbox(url) {
    const resp = await fetch(SB_FUNC_URL, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!resp.ok) { const e = await resp.json().catch(() => ({})); throw new Error(e.error || `HTTP ${resp.status}`); }
    return await resp.arrayBuffer();
  }

  // ═══════ PARSE EXCEL ═══════
  function parseExcel(bufs) {
    const bundles = [], sales = [];
    // 1) NK MỸ
    let wb = XLSX.read(bufs.NK_MY, { type: 'array' });
    let data = XLSX.utils.sheet_to_json(wb.Sheets['ĐÓNG KIỆN'], { header: 1, defval: '' });
    data.slice(1).forEach(r => {
      const st = STATUS_MAP[r[10]]; if (!st) return;
      const wid = WOOD_MAP_MY[r[3]]; if (!wid) return;
      bundles.push({ source:'NK_MY', woodId:wid, code:String(r[4]).trim(), status:st,
        remainVol:parseFloat(r[11])||0, remainBoards:parseInt(r[12])||0, thickness:r[5], quality:r[6] });
    });
    data = XLSX.utils.sheet_to_json(wb.Sheets['BÁN HÀNG'], { header: 1, defval: '' });
    data.slice(1).forEach(r => {
      const d = xlToDate(r[1]); if (!d || d < SALE_DATE_CUTOFF) return;
      const wid = WOOD_MAP_MY[r[2]]; if (!wid) return;
      const vol = parseFloat(r[6])||0; if (vol <= 0) return;
      sales.push({ source:'NK_MY', woodId:wid, code:String(r[3]).trim(), date:d, vol, boards:parseInt(r[9])||0, price:parseFloat(r[8])||0, customer:String(r[10]||'').trim() });
    });

    // 2) NK ÂU
    wb = XLSX.read(bufs.NK_AU, { type: 'array' });
    data = XLSX.utils.sheet_to_json(wb.Sheets['ĐÓNG KIỆN'], { header: 1, defval: '' });
    data.slice(1).forEach(r => {
      const st = STATUS_MAP[r[10]]; if (!st) return;
      const wid = WOOD_MAP_AU[r[2]]; if (!wid) return;
      bundles.push({ source:'NK_AU', woodId:wid, code:String(r[3]).trim(), status:st,
        remainVol:parseFloat(r[11])||0, remainBoards:parseInt(r[12])||0, thickness:r[4], quality:r[5] });
    });
    data = XLSX.utils.sheet_to_json(wb.Sheets['BÁN HÀNG'], { header: 1, defval: '' });
    data.slice(1).forEach(r => {
      const d = xlToDate(r[1]); if (!d || d < SALE_DATE_CUTOFF) return;
      const wid = WOOD_MAP_AU[r[2]]; if (!wid) return;
      const vol = parseFloat(r[6])||0; if (vol <= 0) return;
      sales.push({ source:'NK_AU', woodId:wid, code:String(r[4]).trim(), date:d, vol, boards:parseInt(r[9])||0, price:parseFloat(r[8])||0, customer:String(r[10]||'').trim() });
    });

    // 3) THÔNG NK
    wb = XLSX.read(bufs.THONG_NK, { type: 'array' });
    data = XLSX.utils.sheet_to_json(wb.Sheets['THÔNG'], { header: 1, defval: '' });
    data.slice(1).forEach(r => {
      const st = STATUS_MAP[r[13]]; if (!st) return;
      const loaiGo = String(r[2]).trim(), loai = String(r[3]).trim();
      const wid = loaiGo === 'THÔNG ỐP' ? 'pine_cladding' : (THONG_TYPE_MAP[loai] || 'pine');
      bundles.push({ source:'THONG_NK', woodId:wid, code:String(r[5]).trim(), status:st,
        remainVol:parseFloat(r[14])||0, remainBoards:parseInt(r[15])||0, thickness:r[7], quality:r[6] });
    });
    data = XLSX.utils.sheet_to_json(wb.Sheets['BÁN HÀNG'], { header: 1, defval: '' });
    data.slice(1).forEach(r => {
      const d = xlToDate(r[1]); if (!d || d < SALE_DATE_CUTOFF) return;
      const loai = String(r[2]).trim();
      const wid = THONG_OP_TYPES.has(loai) ? 'pine_cladding' : (THONG_TYPE_MAP[loai] || 'pine');
      const vol = parseFloat(r[5])||0; if (vol <= 0) return;
      sales.push({ source:'THONG_NK', woodId:wid, code:String(r[3]).trim(), date:d, vol, boards:parseInt(r[8])||0, price:parseFloat(r[7])||0, customer:String(r[9]||'').trim() });
    });

    // 4) GỖ XẺ
    wb = XLSX.read(bufs.GO_XE, { type: 'array' });
    data = XLSX.utils.sheet_to_json(wb.Sheets['ĐÓNG KIỆN'], { header: 1, defval: '' });
    data.slice(1).forEach(r => {
      const st = STATUS_MAP[String(r[10]).trim()]; if (!st) return;
      const wood = String(r[2]).trim(); if (SKIP_XE.has(wood)) return;
      const wid = WOOD_MAP_XE[wood]; if (!wid) return;
      bundles.push({ source:'GO_XE', woodId:wid, code:String(r[1]).trim(), status:st,
        remainVol:parseFloat(r[9])||0, remainBoards:parseInt(r[11])||0, thickness:r[3], quality:r[5] });
    });
    data = XLSX.utils.sheet_to_json(wb.Sheets['BÁN HÀNG'], { header: 1, defval: '' });
    data.slice(1).forEach(r => {
      const d = xlToDate(r[1]); if (!d || d < SALE_DATE_CUTOFF) return;
      const wood = String(r[3]).trim(); if (SKIP_XE.has(wood)) return;
      const wid = WOOD_MAP_XE[wood]; if (!wid) return;
      const vol = parseFloat(r[5])||0; if (vol <= 0) return;
      sales.push({ source:'GO_XE', woodId:wid, code:String(r[2]).trim(), date:d, vol, boards:parseInt(r[7])||0, price:parseFloat(r[6])||0, customer:String(r[8]||'').trim() });
    });

    return { bundles, sales };
  }

  // ═══════ QUERY DB ═══════
  async function queryDB() {
    // Bundles
    const allBundles = [];
    let from = 0, more = true;
    while (more) {
      const { data, error } = await sb.from('wood_bundles')
        .select('wood_id, bundle_code, status, remaining_volume, remaining_boards, volume, board_count, attributes')
        .in('status', ['Kiện nguyên','Kiện lẻ','Đang dong cạnh'])
        .range(from, from + 999);
      if (error) { log('Lỗi DB bundles: ' + error.message); break; }
      allBundles.push(...data); more = data.length === 1000; from += 1000;
    }
    // Sales
    const allSales = [];
    from = 0; more = true;
    while (more) {
      const { data, error } = await sb.from('order_items')
        .select('bundle_code, board_count, volume, unit_price, amount, orders!inner(order_code, status, created_at, customers(name))')
        .eq('item_type', 'bundle')
        .neq('orders.status', 'Đã hủy')
        .gte('orders.created_at', '2026-03-20T00:00:00')
        .range(from, from + 999);
      if (error) { log('Lỗi DB sales: ' + error.message); break; }
      data.forEach(r => {
        if (!r.bundle_code) return;
        allSales.push({ code:r.bundle_code, boards:r.board_count||0, vol:parseFloat(r.volume)||0, price:r.unit_price||0,
          orderCode:r.orders?.order_code||'', date:r.orders?.created_at?new Date(r.orders.created_at):null, customer:r.orders?.customers?.name||'' });
      });
      more = data.length === 1000; from += 1000;
    }
    return { bundles: allBundles, sales: allSales };
  }

  // ═══════ COMPARE INVENTORY ═══════
  function compareInventory(exB, dbB) {
    const exMap = {}, dbMap = {};
    exB.forEach(b => { exMap[b.woodId + '|' + b.code] = b; });
    dbB.forEach(b => { dbMap[b.wood_id + '|' + b.bundle_code] = b; });
    const res = { match:[], vol:[], board:[], status:[], exOnly:[], dbOnly:[], summary:{} };
    const checked = new Set();
    Object.entries(exMap).forEach(([key, ex]) => {
      checked.add(key);
      const db = dbMap[key];
      if (!db) { res.exOnly.push({ woodId:ex.woodId, code:ex.code, source:ex.source, exStatus:ex.status, exVol:ex.remainVol, exBoards:ex.remainBoards, thickness:ex.thickness, quality:ex.quality }); return; }
      const dbVol = parseFloat(db.remaining_volume)||0, dbBoards = db.remaining_boards||0;
      const volDelta = +(dbVol - ex.remainVol).toFixed(4), boardDelta = dbBoards - ex.remainBoards;
      const stMatch = ex.status === db.status || (ex.status === 'Kiện nguyên' && db.status === 'Đang dong cạnh');
      const entry = { woodId:ex.woodId, code:ex.code, source:ex.source, exVol:ex.remainVol, dbVol, volDelta, exBoards:ex.remainBoards, dbBoards, boardDelta,
        exStatus:ex.status, dbStatus:db.status, thickness:ex.thickness||db.attributes?.thickness, quality:ex.quality||db.attributes?.quality, diffs:[] };
      if (Math.abs(volDelta) > VOL_TOL) entry.diffs.push('vol');
      if (Math.abs(boardDelta) > 0) entry.diffs.push('board');
      if (!stMatch) entry.diffs.push('status');
      if (!entry.diffs.length) res.match.push(entry);
      else { if (entry.diffs.includes('vol')) res.vol.push(entry); if (entry.diffs.includes('board')) res.board.push(entry); if (entry.diffs.includes('status')) res.status.push(entry); }
    });
    Object.entries(dbMap).forEach(([key, db]) => {
      if (checked.has(key)) return;
      res.dbOnly.push({ woodId:db.wood_id, code:db.bundle_code, dbStatus:db.status, dbVol:parseFloat(db.remaining_volume)||0, dbBoards:db.remaining_boards||0, thickness:db.attributes?.thickness, quality:db.attributes?.quality });
    });
    // Summary
    const allW = [...new Set([...exB.map(b=>b.woodId),...dbB.map(b=>b.wood_id)])].sort();
    allW.forEach(w => {
      const eL = exB.filter(b=>b.woodId===w), dL = dbB.filter(b=>b.wood_id===w);
      const eV = eL.reduce((s,b)=>s+b.remainVol,0), dV = dL.reduce((s,b)=>s+parseFloat(b.remaining_volume||0),0);
      res.summary[w] = { exCount:eL.length, dbCount:dL.length, exVol:eV, dbVol:dV, deltaCount:dL.length-eL.length, deltaVol:+(dV-eV).toFixed(4) };
    });
    return res;
  }

  // ═══════ COMPARE SALES ═══════
  function compareSales(exS, dbS) {
    const exByCode = {}, dbByCode = {};
    exS.forEach(s => { if (!exByCode[s.code]) exByCode[s.code]={woodId:s.woodId,txns:[],totalVol:0,totalBoards:0}; exByCode[s.code].txns.push(s); exByCode[s.code].totalVol+=s.vol; exByCode[s.code].totalBoards+=s.boards; });
    dbS.forEach(s => { if (!dbByCode[s.code]) dbByCode[s.code]={txns:[],totalVol:0,totalBoards:0}; dbByCode[s.code].txns.push(s); dbByCode[s.code].totalVol+=s.vol; dbByCode[s.code].totalBoards+=s.boards; });
    const res = { saleMatch:[], saleDiff:[], saleExOnly:[], saleDbOnly:[] };
    const checked = new Set();
    Object.entries(exByCode).forEach(([code, ex]) => {
      checked.add(code);
      const db = dbByCode[code];
      if (!db) { res.saleExOnly.push({ code, woodId:ex.woodId, exTxns:ex.txns, exVol:+ex.totalVol.toFixed(4), exBoards:ex.totalBoards, exCount:ex.txns.length }); return; }
      const volDelta = +(db.totalVol - ex.totalVol).toFixed(4), boardDelta = db.totalBoards - ex.totalBoards;
      const entry = { code, woodId:ex.woodId, exVol:+ex.totalVol.toFixed(4), dbVol:+db.totalVol.toFixed(4), volDelta, exBoards:ex.totalBoards, dbBoards:db.totalBoards, boardDelta,
        exCount:ex.txns.length, dbCount:db.txns.length, exTxns:ex.txns, dbTxns:db.txns };
      if (Math.abs(volDelta) <= VOL_TOL && Math.abs(boardDelta) <= 0) res.saleMatch.push(entry); else res.saleDiff.push(entry);
    });
    Object.entries(dbByCode).forEach(([code, db]) => {
      if (checked.has(code)) return;
      res.saleDbOnly.push({ code, dbTxns:db.txns, dbVol:+db.totalVol.toFixed(4), dbBoards:db.totalBoards, dbCount:db.txns.length });
    });
    res.saleDiff.sort((a,b) => Math.abs(b.volDelta) - Math.abs(a.volDelta));
    return res;
  }

  // ═══════ RUN ═══════
  async function run() {
    setLoading(true); setLogText(''); setInvResults(null); setSalesResults(null); setDetailIdx(null); setSaleDetailIdx(null);
    try {
      setProgress(5); log('Tải file Excel từ Dropbox...');
      const bufs = {};
      for (const key of FILE_KEYS) {
        const url = links[key];
        if (!url) { log(`⚠ Thiếu link ${FILE_LABELS[key]}`); continue; }
        log('  ↓ ' + FILE_LABELS[key]);
        bufs[key] = await fetchExcelFromDropbox(url);
      }
      if (Object.keys(bufs).length < 4) throw new Error('Thiếu file Excel');

      setProgress(30); log('Parse Excel...');
      const { bundles: exB, sales: exS } = parseExcel(bufs);
      log(`✓ Excel: ${exB.length} kiện tồn kho, ${exS.length} giao dịch bán`);
      setExBundles(exB); setExSales(exS);

      setProgress(50); log('Query DB...');
      const { bundles: dbB, sales: dbS } = await queryDB();
      log(`✓ DB: ${dbB.length} kiện tồn kho, ${dbS.length} giao dịch bán`);
      setDbBundles(dbB); setDbSalesData(dbS);

      setProgress(75); log('So sánh tồn kho...');
      const inv = compareInventory(exB, dbB);
      setInvResults(inv);
      log(`  Khớp: ${inv.match.length} | Lệch KL: ${inv.vol.length} | Lệch tấm: ${inv.board.length} | Lệch TT: ${inv.status.length} | Excel-only: ${inv.exOnly.length} | DB-only: ${inv.dbOnly.length}`);

      setProgress(90); log('So sánh bán hàng...');
      const sr = compareSales(exS, dbS);
      setSalesResults(sr);
      log(`  Khớp: ${sr.saleMatch.length} | Lệch: ${sr.saleDiff.length} | Excel-only: ${sr.saleExOnly.length} | DB-only: ${sr.saleDbOnly.length}`);

      setProgress(100); log('✓ Hoàn tất! ' + new Date().toLocaleString('vi-VN'));
      notify('Đối chiếu hoàn tất', true);
    } catch (e) { log('❌ ' + e.message); notify(e.message, false); }
    setLoading(false);
  }

  // ═══════ SAVE CONFIG ═══════
  async function handleSaveLinks() {
    const res = await saveDropboxLinks(links);
    if (res.error) notify('Lỗi lưu: ' + res.error, false);
    else notify('Đã lưu Dropbox links', true);
  }

  // ═══════ FILTERED DATA ═══════
  function getInvData() {
    let data = invResults?.[invTab] || [];
    if (filterWood) data = data.filter(r => r.woodId === filterWood);
    if (filterSearch) { const q = filterSearch.toLowerCase(); data = data.filter(r => (r.code||'').toLowerCase().includes(q)); }
    if (sortCol) data = [...data].sort((a,b) => { const va=a[sortCol], vb=b[sortCol]; return (typeof va==='number'&&typeof vb==='number'?(va-vb):(String(va||'').localeCompare(String(vb||''))))*sortDir; });
    return data;
  }
  function getSaleData() {
    let data = salesResults?.[saleTab] || [];
    if (saleFilterWood) data = data.filter(r => r.woodId === saleFilterWood);
    if (saleFilterSearch) { const q = saleFilterSearch.toLowerCase(); data = data.filter(r => (r.code||'').toLowerCase().includes(q)); }
    if (saleSortCol) data = [...data].sort((a,b) => { const va=a[saleSortCol], vb=b[saleSortCol]; return (typeof va==='number'&&typeof vb==='number'?(va-vb):(String(va||'').localeCompare(String(vb||''))))*saleSortDir; });
    return data;
  }
  function toggleInvSort(col) { if (sortCol===col) setSortDir(d=>d*-1); else { setSortCol(col); setSortDir(1); } }
  function toggleSaleSort(col) { if (saleSortCol===col) setSaleSortDir(d=>d*-1); else { setSaleSortCol(col); setSaleSortDir(1); } }
  function si(col) { return sortCol===col ? (sortDir===1?' ▲':' ▼') : ''; }
  function ssi(col) { return saleSortCol===col ? (saleSortDir===1?' ▲':' ▼') : ''; }

  // ═══════ RENDER ═══════
  const invData = getInvData();
  const saleData = getSaleData();
  const allWoods = invResults ? [...new Set([...exBundles.map(b=>b.woodId),...dbBundles.map(b=>b.wood_id)])].sort() : [];

  return (
    <div style={S.page}>
      <div style={S.h1}>Đối chiếu tồn kho & bán hàng</div>
      <div style={S.sub}>So sánh sổ Excel (Dropbox) vs DB — Tồn kho + Bán hàng từ 20/03/2026</div>

      {/* Config */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <button style={S.btn} onClick={run} disabled={loading}>{loading ? 'Đang chạy...' : 'Tải từ Dropbox & đối chiếu'}</button>
          <button style={S.btnSec} onClick={() => setShowConfig(v => !v)}>{showConfig ? 'Ẩn cấu hình' : 'Cấu hình Dropbox'}</button>
        </div>
        {loading && <div style={S.progress}><div style={S.progressBar(progress)} /></div>}
        {showConfig && (
          <div style={{ background:'#fff', border:`1px solid ${'var(--bd)'}`, borderRadius:8, padding:12, marginTop:8 }}>
            <div style={{ fontSize:'0.78rem', fontWeight:600, marginBottom:8 }}>Dropbox Shared Links (view-only)</div>
            {FILE_KEYS.map(k => (
              <div key={k} style={S.configRow}>
                <span style={S.configLabel}>{FILE_LABELS[k]}</span>
                <input style={S.linkInput} value={links[k]||''} onChange={e => setLinks(prev => ({...prev,[k]:e.target.value}))} placeholder="https://www.dropbox.com/scl/fi/..." />
              </div>
            ))}
            <button style={{...S.btn, marginTop:6}} onClick={handleSaveLinks}>Lưu links</button>
          </div>
        )}
      </div>

      {logText && <div style={S.log} ref={logRef}>{logText}</div>}

      {/* Mode tabs */}
      {invResults && <div style={S.modeBar}>
        <div style={{...S.modeTab(mode==='inv'), ...S.modeTabFirst}} onClick={() => setMode('inv')}>
          Tồn kho {invResults ? <span style={S.badge(mode==='inv')}>{exBundles.length} kiện</span> : null}
        </div>
        <div style={{...S.modeTab(mode==='sale'), ...S.modeTabLast}} onClick={() => setMode('sale')}>
          Bán hàng {salesResults ? <span style={{...S.badge(mode==='sale'), background: mode==='sale'?'rgba(255,255,255,0.3)':'#e2ddd5'}}>{exSales.length} GD</span> : null}
        </div>
      </div>}

      {/* ═══════ INVENTORY RESULTS ═══════ */}
      {invResults && mode === 'inv' && <>
        {/* Cards */}
        <div style={S.cards}>
          {[
            { k:'match', v:invResults.match.length, l:`Khớp (${(invResults.match.length/exBundles.length*100).toFixed(1)}%)`, c:'#3a7d34' },
            { k:'vol', v:invResults.vol.length, l:'Lệch KL', c:'#d48806' },
            { k:'board', v:invResults.board.length, l:'Lệch tấm', c:'#d48806' },
            { k:'status', v:invResults.status.length, l:'Lệch TT', c:'#d48806' },
            { k:'exOnly', v:invResults.exOnly.length, l:'Chỉ Excel', c:'#c0392b' },
            { k:'dbOnly', v:invResults.dbOnly.length, l:'Chỉ DB', c:'#c0392b' },
          ].map(c => (
            <div key={c.k} style={{...S.card(), borderColor: invTab===c.k?'var(--br)':'var(--bd)'}} onClick={() => { setInvTab(c.k); setDetailIdx(null); }}>
              <div style={S.cardVal(c.c)}>{c.v}</div>
              <div style={S.cardLbl}>{c.l}</div>
            </div>
          ))}
        </div>

        {/* Summary table */}
        <div style={S.tblWrap}>
          <table style={S.tbl}><thead><tr>
            <th style={S.th}>Loại gỗ</th><th style={{...S.th,...S.r}}>Excel (kiện)</th><th style={{...S.th,...S.r}}>Excel (m³)</th>
            <th style={{...S.th,...S.r}}>DB (kiện)</th><th style={{...S.th,...S.r}}>DB (m³)</th><th style={{...S.th,...S.r}}>Δ kiện</th><th style={{...S.th,...S.r}}>Δ m³</th>
          </tr></thead><tbody>
            {Object.entries(invResults.summary).sort((a,b)=>a[0].localeCompare(b[0])).map(([w,v]) => (
              <tr key={w}><td style={{...S.td,fontWeight:600}}>{WOOD_NAMES[w]||w}</td>
                <td style={{...S.td,...S.r}}>{v.exCount}</td><td style={{...S.td,...S.r}}>{v.exVol.toFixed(2)}</td>
                <td style={{...S.td,...S.r}}>{v.dbCount}</td><td style={{...S.td,...S.r}}>{v.dbVol.toFixed(2)}</td>
                <td style={{...S.td,...S.r,...(v.deltaCount>0?S.pos:v.deltaCount<0?S.neg:{})}}>{(v.deltaCount>=0?'+':'')+v.deltaCount}</td>
                <td style={{...S.td,...S.r,...(v.deltaVol>0.01?S.pos:v.deltaVol<-0.01?S.neg:{})}}>{(v.deltaVol>=0?'+':'')+v.deltaVol.toFixed(2)}</td>
              </tr>
            ))}
          </tbody></table>
        </div>

        {/* Tabs */}
        <div style={S.tabs}>
          {[{id:'vol',l:'Lệch KL',n:invResults.vol.length},{id:'board',l:'Lệch tấm',n:invResults.board.length},
            {id:'status',l:'Lệch TT',n:invResults.status.length},{id:'exOnly',l:'Chỉ Excel',n:invResults.exOnly.length},
            {id:'dbOnly',l:'Chỉ DB',n:invResults.dbOnly.length},{id:'match',l:'Khớp',n:invResults.match.length}].map(t => (
            <div key={t.id} style={S.tab(invTab===t.id)} onClick={() => { setInvTab(t.id); setDetailIdx(null); }}>
              {t.l}<span style={S.badge(invTab===t.id)}>{t.n}</span>
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={S.filters}>
          <span style={{fontSize:'0.72rem',color:'var(--tm)'}}>Loại gỗ:</span>
          <select style={S.sel} value={filterWood} onChange={e => setFilterWood(e.target.value)}>
            <option value="">Tất cả</option>
            {allWoods.map(w => <option key={w} value={w}>{WOOD_NAMES[w]||w}</option>)}
          </select>
          <span style={{fontSize:'0.72rem',color:'var(--tm)'}}>Mã kiện:</span>
          <input style={S.inp} value={filterSearch} onChange={e => setFilterSearch(e.target.value)} placeholder="Tìm..." />
        </div>

        {/* Detail table */}
        <div style={{...S.tblWrap, maxHeight:'55vh', overflowY:'auto'}}>
          <table style={S.tbl}><thead><tr>
            {(invTab==='vol'||invTab==='board'||invTab==='match') ? <>
              <th style={S.th} onClick={()=>toggleInvSort('woodId')}>Loại gỗ{si('woodId')}</th>
              <th style={S.th} onClick={()=>toggleInvSort('code')}>Mã kiện{si('code')}</th>
              <th style={S.th}>TT Excel</th><th style={S.th}>TT DB</th>
              <th style={{...S.th,...S.r}} onClick={()=>toggleInvSort('exVol')}>KL Excel{si('exVol')}</th>
              <th style={{...S.th,...S.r}} onClick={()=>toggleInvSort('dbVol')}>KL DB{si('dbVol')}</th>
              <th style={{...S.th,...S.r}} onClick={()=>toggleInvSort('volDelta')}>Δ KL{si('volDelta')}</th>
              <th style={{...S.th,...S.r}}>Tấm Ex</th><th style={{...S.th,...S.r}}>Tấm DB</th>
              <th style={{...S.th,...S.r}} onClick={()=>toggleInvSort('boardDelta')}>Δ Tấm{si('boardDelta')}</th>
            </> : invTab==='status' ? <>
              <th style={S.th}>Loại gỗ</th><th style={S.th}>Mã kiện</th>
              <th style={S.th}>TT Excel</th><th style={S.th}>TT DB</th>
              <th style={{...S.th,...S.r}}>KL Excel</th><th style={{...S.th,...S.r}}>KL DB</th><th style={{...S.th,...S.r}}>Δ KL</th><th style={S.th}>Nhận xét</th>
            </> : invTab==='exOnly' ? <>
              <th style={S.th}>Loại gỗ</th><th style={S.th}>Mã kiện</th><th style={S.th}>TT</th><th style={S.th}>Nguồn</th>
              <th style={{...S.th,...S.r}}>KL</th><th style={{...S.th,...S.r}}>Tấm</th><th style={S.th}>Dày</th><th style={S.th}>CL</th>
            </> : <>
              <th style={S.th}>Loại gỗ</th><th style={S.th}>Mã kiện</th><th style={S.th}>TT</th>
              <th style={{...S.th,...S.r}}>KL</th><th style={{...S.th,...S.r}}>Tấm</th><th style={S.th}>Dày</th><th style={S.th}>CL</th>
            </>}
          </tr></thead><tbody>
            {invData.map((r,i) => {
              const vc = Math.abs(r.volDelta||0)>VOL_TOL?(r.volDelta>0?S.pos:S.neg):{};
              const bc = (r.boardDelta||0)!==0?(r.boardDelta>0?S.pos:S.neg):{};
              if (invTab==='vol'||invTab==='board'||invTab==='match') return (
                <tr key={i} style={{cursor:'pointer'}} onClick={()=>setDetailIdx(i)} data-clickable="true">
                  <td style={S.td}>{WOOD_NAMES[r.woodId]||r.woodId}</td><td style={{...S.td,...S.mono}}>{r.code}</td>
                  <td style={S.td}><StTag st={r.exStatus}/></td><td style={S.td}><StTag st={r.dbStatus}/></td>
                  <td style={{...S.td,...S.r}}>{(r.exVol||0).toFixed(4)}</td><td style={{...S.td,...S.r}}>{(r.dbVol||0).toFixed(4)}</td>
                  <td style={{...S.td,...S.r,...vc}}>{fmtDelta(r.volDelta)}</td>
                  <td style={{...S.td,...S.r}}>{r.exBoards||0}</td><td style={{...S.td,...S.r}}>{r.dbBoards||0}</td>
                  <td style={{...S.td,...S.r,...bc}}>{fmtDeltaInt(r.boardDelta)}</td>
                </tr>);
              if (invTab==='status') { const dir=r.exStatus==='Kiện lẻ'&&r.dbStatus==='Kiện nguyên'?'Excel bán lẻ, DB chưa':r.exStatus==='Kiện nguyên'&&r.dbStatus==='Kiện lẻ'?'DB bán lẻ, Excel chưa':'Khác'; return (
                <tr key={i} style={{cursor:'pointer'}} onClick={()=>setDetailIdx(i)} data-clickable="true">
                  <td style={S.td}>{WOOD_NAMES[r.woodId]||r.woodId}</td><td style={{...S.td,...S.mono}}>{r.code}</td>
                  <td style={S.td}><StTag st={r.exStatus}/></td><td style={S.td}><StTag st={r.dbStatus}/></td>
                  <td style={{...S.td,...S.r}}>{(r.exVol||0).toFixed(4)}</td><td style={{...S.td,...S.r}}>{(r.dbVol||0).toFixed(4)}</td>
                  <td style={{...S.td,...S.r,...vc}}>{fmtDelta(r.volDelta)}</td>
                  <td style={{...S.td,fontSize:'0.7rem',color:'var(--tm)'}}>{dir}</td>
                </tr>); }
              if (invTab==='exOnly') return (
                <tr key={i}><td style={S.td}>{WOOD_NAMES[r.woodId]||r.woodId}</td><td style={{...S.td,...S.mono}}>{r.code}</td>
                  <td style={S.td}><StTag st={r.exStatus}/></td><td style={{...S.td,...S.tag('#fce4ec','#c0392b')}}>{r.source}</td>
                  <td style={{...S.td,...S.r}}>{(r.exVol||0).toFixed(4)}</td><td style={{...S.td,...S.r}}>{r.exBoards||0}</td>
                  <td style={S.td}>{r.thickness||''}</td><td style={S.td}>{r.quality||''}</td></tr>);
              return (
                <tr key={i}><td style={S.td}>{WOOD_NAMES[r.woodId]||r.woodId}</td><td style={{...S.td,...S.mono}}>{r.code}</td>
                  <td style={S.td}><StTag st={r.dbStatus}/></td>
                  <td style={{...S.td,...S.r}}>{(r.dbVol||0).toFixed(4)}</td><td style={{...S.td,...S.r}}>{r.dbBoards||0}</td>
                  <td style={S.td}>{r.thickness||''}</td><td style={S.td}>{r.quality||''}</td></tr>);
            })}
          </tbody></table>
        </div>

        {/* Detail panel */}
        {detailIdx != null && invData[detailIdx] && (() => {
          const r = invData[detailIdx];
          const ex = exBundles.find(b=>b.woodId===r.woodId&&b.code===r.code);
          const db = dbBundles.find(b=>b.wood_id===r.woodId&&b.bundle_code===r.code);
          return <div style={S.detailPanel}>
            <div style={{fontSize:'0.88rem',fontWeight:700,marginBottom:8}}>Chi tiết: <span style={S.mono}>{r.code}</span> — {WOOD_NAMES[r.woodId]||r.woodId}</div>
            <div style={S.detailGrid}>
              <div style={S.detailCol(ex?'#3a7d34':'var(--bd)')}>
                <div style={{fontSize:'0.76rem',color:'var(--tm)',marginBottom:4,fontWeight:600}}>{ex?'EXCEL':'Không có trên Excel'}</div>
                {ex && <>
                  <div style={S.detailRow}><span style={{color:'var(--tm)'}}>Trạng thái</span><span style={{fontWeight:600}}>{ex.status}</span></div>
                  <div style={S.detailRow}><span style={{color:'var(--tm)'}}>KL còn lại</span><span style={{fontWeight:600}}>{ex.remainVol.toFixed(4)} m³</span></div>
                  <div style={S.detailRow}><span style={{color:'var(--tm)'}}>Tấm còn lại</span><span style={{fontWeight:600}}>{ex.remainBoards}</span></div>
                  <div style={S.detailRow}><span style={{color:'var(--tm)'}}>Dày</span><span style={{fontWeight:600}}>{ex.thickness}</span></div>
                  <div style={S.detailRow}><span style={{color:'var(--tm)'}}>CL</span><span style={{fontWeight:600}}>{ex.quality}</span></div>
                </>}
              </div>
              <div style={S.detailCol(db?'var(--br)':'var(--bd)')}>
                <div style={{fontSize:'0.76rem',color:'var(--tm)',marginBottom:4,fontWeight:600}}>{db?'DATABASE':'Không có trên DB'}</div>
                {db && <>
                  <div style={S.detailRow}><span style={{color:'var(--tm)'}}>Trạng thái</span><span style={{fontWeight:600}}>{db.status}</span></div>
                  <div style={S.detailRow}><span style={{color:'var(--tm)'}}>KL còn lại</span><span style={{fontWeight:600}}>{parseFloat(db.remaining_volume||0).toFixed(4)} m³</span></div>
                  <div style={S.detailRow}><span style={{color:'var(--tm)'}}>Tấm còn lại</span><span style={{fontWeight:600}}>{db.remaining_boards||0}</span></div>
                  <div style={S.detailRow}><span style={{color:'var(--tm)'}}>KL nguyên</span><span style={{fontWeight:600}}>{parseFloat(db.volume||0).toFixed(4)} m³</span></div>
                  <div style={S.detailRow}><span style={{color:'var(--tm)'}}>Dày</span><span style={{fontWeight:600}}>{db.attributes?.thickness||''}</span></div>
                  <div style={S.detailRow}><span style={{color:'var(--tm)'}}>CL</span><span style={{fontWeight:600}}>{db.attributes?.quality||''}</span></div>
                </>}
              </div>
            </div>
          </div>;
        })()}
      </>}

      {/* ═══════ SALES RESULTS ═══════ */}
      {salesResults && mode === 'sale' && <>
        <div style={S.cards}>
          {[
            { k:'saleMatch', v:salesResults.saleMatch.length, l:'Kiện khớp KL bán', c:'#3a7d34' },
            { k:'saleDiff', v:salesResults.saleDiff.length, l:'Lệch KL/tấm bán', c:'#d48806' },
            { k:'saleExOnly', v:salesResults.saleExOnly.length, l:'Chỉ bán trên Excel', c:'#c0392b' },
            { k:'saleDbOnly', v:salesResults.saleDbOnly.length, l:'Chỉ bán trên DB', c:'#c0392b' },
          ].map(c => (
            <div key={c.k} style={{...S.card(), borderColor:saleTab===c.k?'var(--br)':'var(--bd)'}} onClick={() => { setSaleTab(c.k); setSaleDetailIdx(null); }}>
              <div style={S.cardVal(c.c)}>{c.v}</div><div style={S.cardLbl}>{c.l}</div>
            </div>
          ))}
        </div>

        {/* Sale tabs */}
        <div style={S.tabs}>
          {[{id:'saleDiff',l:'Lệch',n:salesResults.saleDiff.length},{id:'saleExOnly',l:'Chỉ Excel',n:salesResults.saleExOnly.length},
            {id:'saleDbOnly',l:'Chỉ DB',n:salesResults.saleDbOnly.length},{id:'saleMatch',l:'Khớp',n:salesResults.saleMatch.length}].map(t => (
            <div key={t.id} style={S.tab(saleTab===t.id)} onClick={() => { setSaleTab(t.id); setSaleDetailIdx(null); }}>
              {t.l}<span style={S.badge(saleTab===t.id)}>{t.n}</span>
            </div>
          ))}
        </div>
        <div style={S.filters}>
          <span style={{fontSize:'0.72rem',color:'var(--tm)'}}>Loại gỗ:</span>
          <select style={S.sel} value={saleFilterWood} onChange={e => setSaleFilterWood(e.target.value)}>
            <option value="">Tất cả</option>
            {[...new Set(exSales.map(s=>s.woodId))].sort().map(w => <option key={w} value={w}>{WOOD_NAMES[w]||w}</option>)}
          </select>
          <span style={{fontSize:'0.72rem',color:'var(--tm)'}}>Mã kiện:</span>
          <input style={S.inp} value={saleFilterSearch} onChange={e => setSaleFilterSearch(e.target.value)} placeholder="Tìm..." />
        </div>

        <div style={{...S.tblWrap, maxHeight:'55vh', overflowY:'auto'}}>
          <table style={S.tbl}><thead><tr>
            {(saleTab==='saleDiff'||saleTab==='saleMatch') ? <>
              <th style={S.th} onClick={()=>toggleSaleSort('woodId')}>Loại gỗ{ssi('woodId')}</th>
              <th style={S.th} onClick={()=>toggleSaleSort('code')}>Mã kiện{ssi('code')}</th>
              <th style={{...S.th,...S.r}}>GD Ex</th><th style={{...S.th,...S.r}}>GD DB</th>
              <th style={{...S.th,...S.r}} onClick={()=>toggleSaleSort('exVol')}>KL bán Ex{ssi('exVol')}</th>
              <th style={{...S.th,...S.r}} onClick={()=>toggleSaleSort('dbVol')}>KL bán DB{ssi('dbVol')}</th>
              <th style={{...S.th,...S.r}} onClick={()=>toggleSaleSort('volDelta')}>Δ KL{ssi('volDelta')}</th>
              <th style={{...S.th,...S.r}}>Tấm Ex</th><th style={{...S.th,...S.r}}>Tấm DB</th><th style={{...S.th,...S.r}}>Δ Tấm</th>
            </> : saleTab==='saleExOnly' ? <>
              <th style={S.th}>Loại gỗ</th><th style={S.th}>Mã kiện</th><th style={{...S.th,...S.r}}>GD</th>
              <th style={{...S.th,...S.r}}>KL bán</th><th style={{...S.th,...S.r}}>Tấm</th><th style={S.th}>Khách</th><th style={S.th}>Ngày</th>
            </> : <>
              <th style={S.th}>Mã kiện</th><th style={{...S.th,...S.r}}>GD</th><th style={{...S.th,...S.r}}>KL bán</th>
              <th style={{...S.th,...S.r}}>Tấm</th><th style={S.th}>Khách</th><th style={S.th}>Mã đơn</th><th style={S.th}>Ngày</th>
            </>}
          </tr></thead><tbody>
            {saleData.map((r,i) => {
              if (saleTab==='saleDiff'||saleTab==='saleMatch') { const vc=Math.abs(r.volDelta||0)>VOL_TOL?(r.volDelta>0?S.pos:S.neg):{}; const bc=(r.boardDelta||0)!==0?(r.boardDelta>0?S.pos:S.neg):{}; return (
                <tr key={i} style={{cursor:'pointer'}} onClick={()=>setSaleDetailIdx(i)} data-clickable="true">
                  <td style={S.td}>{WOOD_NAMES[r.woodId]||r.woodId||'-'}</td><td style={{...S.td,...S.mono}}>{r.code}</td>
                  <td style={{...S.td,...S.r}}>{r.exCount}</td><td style={{...S.td,...S.r}}>{r.dbCount}</td>
                  <td style={{...S.td,...S.r}}>{r.exVol.toFixed(4)}</td><td style={{...S.td,...S.r}}>{r.dbVol.toFixed(4)}</td>
                  <td style={{...S.td,...S.r,...vc}}>{fmtDelta(r.volDelta)}</td>
                  <td style={{...S.td,...S.r}}>{r.exBoards}</td><td style={{...S.td,...S.r}}>{r.dbBoards}</td>
                  <td style={{...S.td,...S.r,...bc}}>{fmtDeltaInt(r.boardDelta)}</td>
                </tr>); }
              if (saleTab==='saleExOnly') { const custs=[...new Set(r.exTxns.map(t=>t.customer))].join(', '); const dates=[...new Set(r.exTxns.map(t=>fmtD(t.date)))].join(', '); return (
                <tr key={i} style={{cursor:'pointer'}} onClick={()=>setSaleDetailIdx(i)} data-clickable="true">
                  <td style={S.td}>{WOOD_NAMES[r.woodId]||'-'}</td><td style={{...S.td,...S.mono}}>{r.code}</td>
                  <td style={{...S.td,...S.r}}>{r.exCount}</td><td style={{...S.td,...S.r}}>{r.exVol.toFixed(4)}</td><td style={{...S.td,...S.r}}>{r.exBoards}</td>
                  <td style={{...S.td,whiteSpace:'normal',maxWidth:180}}>{custs}</td><td style={S.td}>{dates}</td>
                </tr>); }
              const custs=[...new Set(r.dbTxns.map(t=>t.customer))].join(', '); const codes=[...new Set(r.dbTxns.map(t=>t.orderCode))].join(', '); const dates=[...new Set(r.dbTxns.map(t=>fmtD(t.date)))].join(', ');
              return (<tr key={i} style={{cursor:'pointer'}} onClick={()=>setSaleDetailIdx(i)} data-clickable="true">
                <td style={{...S.td,...S.mono}}>{r.code}</td><td style={{...S.td,...S.r}}>{r.dbCount}</td>
                <td style={{...S.td,...S.r}}>{r.dbVol.toFixed(4)}</td><td style={{...S.td,...S.r}}>{r.dbBoards}</td>
                <td style={{...S.td,whiteSpace:'normal',maxWidth:180}}>{custs}</td><td style={{...S.td,...S.mono}}>{codes}</td><td style={S.td}>{dates}</td>
              </tr>);
            })}
          </tbody></table>
        </div>

        {/* Sale detail panel */}
        {saleDetailIdx != null && saleData[saleDetailIdx] && (() => {
          const r = saleData[saleDetailIdx];
          return <div style={S.detailPanel}>
            <div style={{fontSize:'0.88rem',fontWeight:700,marginBottom:8}}>Lịch sử bán: <span style={S.mono}>{r.code}</span> — {WOOD_NAMES[r.woodId]||r.woodId||'?'}</div>
            <div style={S.detailGrid}>
              <div style={S.detailCol('#3a7d34')}>
                <div style={{fontSize:'0.76rem',color:'var(--tm)',fontWeight:600,marginBottom:6}}>EXCEL — {r.exTxns?.length||0} giao dịch</div>
                {(r.exTxns||[]).length ? <table style={{...S.tbl,fontSize:'0.7rem'}}><thead><tr><th style={S.th}>Ngày</th><th style={{...S.th,...S.r}}>KL</th><th style={{...S.th,...S.r}}>Tấm</th><th style={{...S.th,...S.r}}>Đơn giá</th><th style={S.th}>Khách</th></tr></thead><tbody>
                  {r.exTxns.map((t,j)=><tr key={j}><td style={S.td}>{fmtD(t.date)}</td><td style={{...S.td,...S.r}}>{t.vol.toFixed(4)}</td><td style={{...S.td,...S.r}}>{t.boards}</td><td style={{...S.td,...S.r}}>{fmtM(t.price)}</td><td style={{...S.td,whiteSpace:'normal'}}>{t.customer}</td></tr>)}
                  <tr style={{fontWeight:700}}><td style={{...S.td,borderTop:`2px solid ${'var(--bd)'}`}}>Tổng</td><td style={{...S.td,...S.r,borderTop:`2px solid ${'var(--bd)'}`}}>{r.exVol?.toFixed(4)}</td><td style={{...S.td,...S.r,borderTop:`2px solid ${'var(--bd)'}`}}>{r.exBoards}</td><td style={{...S.td,borderTop:`2px solid ${'var(--bd)'}`}}></td><td style={{...S.td,borderTop:`2px solid ${'var(--bd)'}`}}></td></tr>
                </tbody></table> : <span style={{fontSize:'0.72rem',color:'var(--tm)'}}>Không có</span>}
              </div>
              <div style={S.detailCol('var(--br)')}>
                <div style={{fontSize:'0.76rem',color:'var(--tm)',fontWeight:600,marginBottom:6}}>DATABASE — {r.dbTxns?.length||0} giao dịch</div>
                {(r.dbTxns||[]).length ? <table style={{...S.tbl,fontSize:'0.7rem'}}><thead><tr><th style={S.th}>Ngày</th><th style={{...S.th,...S.r}}>KL</th><th style={{...S.th,...S.r}}>Tấm</th><th style={{...S.th,...S.r}}>Đơn giá</th><th style={S.th}>Khách</th><th style={S.th}>Mã đơn</th></tr></thead><tbody>
                  {r.dbTxns.map((t,j)=><tr key={j}><td style={S.td}>{fmtD(t.date)}</td><td style={{...S.td,...S.r}}>{t.vol.toFixed(4)}</td><td style={{...S.td,...S.r}}>{t.boards}</td><td style={{...S.td,...S.r}}>{fmtM(t.price)}</td><td style={{...S.td,whiteSpace:'normal'}}>{t.customer}</td><td style={{...S.td,...S.mono}}>{t.orderCode}</td></tr>)}
                  <tr style={{fontWeight:700}}><td style={{...S.td,borderTop:`2px solid ${'var(--bd)'}`}}>Tổng</td><td style={{...S.td,...S.r,borderTop:`2px solid ${'var(--bd)'}`}}>{r.dbVol?.toFixed(4)}</td><td style={{...S.td,...S.r,borderTop:`2px solid ${'var(--bd)'}`}}>{r.dbBoards}</td><td style={{...S.td,borderTop:`2px solid ${'var(--bd)'}`}}></td><td style={{...S.td,borderTop:`2px solid ${'var(--bd)'}`}}></td><td style={{...S.td,borderTop:`2px solid ${'var(--bd)'}`}}></td></tr>
                </tbody></table> : <span style={{fontSize:'0.72rem',color:'var(--tm)'}}>Không có</span>}
              </div>
            </div>
          </div>;
        })()}
      </>}
    </div>
  );
}
