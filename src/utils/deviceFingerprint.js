/**
 * Device Fingerprint & Token — nhận diện thiết bị kết hợp 2 lớp:
 * 1. FingerprintJS (browser fingerprint) — nhận diện ban đầu
 * 2. Persistent device token (UUID localStorage) — ổn định hơn fingerprint
 *
 * + IP Geolocation helper — thu thập IP và vị trí từ ip-api.com
 */
import FingerprintJS from '@fingerprintjs/fingerprintjs';

const FP_STORAGE_KEY = 'gth_device_fp';
const TOKEN_STORAGE_KEY = 'gth_device_token';

let cachedFp = null;

// ===== FINGERPRINT =====

export async function getDeviceFingerprint() {
  if (cachedFp) return cachedFp;
  try {
    const fp = await FingerprintJS.load();
    const result = await fp.get();
    cachedFp = result.visitorId;
    try { localStorage.setItem(FP_STORAGE_KEY, cachedFp); } catch {}
    return cachedFp;
  } catch {
    return null;
  }
}

/** Lấy fingerprint đã lưu trong localStorage (không tính lại) */
export function getStoredFingerprint() {
  try { return localStorage.getItem(FP_STORAGE_KEY); } catch { return null; }
}

// ===== PERSISTENT DEVICE TOKEN =====

/** Lấy device token từ localStorage (không tạo mới) */
export function getDeviceToken() {
  try { return localStorage.getItem(TOKEN_STORAGE_KEY); } catch { return null; }
}

/** Lưu device token vào localStorage (khi server trả về sau approve) */
export function saveDeviceToken(token) {
  try { localStorage.setItem(TOKEN_STORAGE_KEY, token); } catch {}
}

/** Xóa device token (khi bị block hoặc logout force) */
export function clearDeviceToken() {
  try { localStorage.removeItem(TOKEN_STORAGE_KEY); } catch {}
}

// ===== IP GEOLOCATION =====

let cachedGeo = null;

/**
 * Lấy IP + vị trí từ ip-api.com (free, không cần API key, 45 req/phút)
 * Trả về: { ip, city, region, country, lat, lon }
 */
export async function getIpGeoLocation() {
  if (cachedGeo) return cachedGeo;
  try {
    const res = await fetch('http://ip-api.com/json/?fields=query,city,regionName,country,lat,lon', { signal: AbortSignal.timeout(5000) });
    const json = await res.json();
    cachedGeo = {
      ip: json.query || '',
      city: json.city || '',
      region: json.regionName || '',
      country: json.country || '',
      lat: json.lat || null,
      lon: json.lon || null,
    };
    return cachedGeo;
  } catch {
    // Fallback: chỉ lấy IP từ ipify
    try {
      const res = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(3000) });
      const json = await res.json();
      cachedGeo = { ip: json.ip || '', city: '', region: '', country: '', lat: null, lon: null };
      return cachedGeo;
    } catch {
      return { ip: '', city: '', region: '', country: '', lat: null, lon: null };
    }
  }
}
