/**
 * Supabase client instance — dùng chung cho tất cả API modules.
 *
 * Config đọc từ .env (CRA tự inject REACT_APP_* vào process.env).
 * Fallback sang giá trị mặc định nếu .env chưa có.
 */
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.REACT_APP_SUPABASE_URL || 'https://tscddgjkelnmlitzcxyg.supabase.co';
const SUPABASE_KEY = process.env.REACT_APP_SUPABASE_KEY || 'sb_publishable_MjQvtQAGbVFsAVZRQ3kmig_XnHKHuEc';

const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export default sb;

/**
 * Wrapper thống nhất error handling cho Supabase queries.
 * Thay vì throw hoặc return { error } tùy hứng,
 * tất cả module dùng safeQuery để trả về { data, error } nhất quán.
 *
 * Usage:
 *   const { data, error } = await safeQuery(() => sb.from('table').select('*'));
 *   if (error) return { data: null, error };
 *   return { data: transform(data), error: null };
 */
export async function safeQuery(queryFn) {
  try {
    const result = await queryFn();
    if (result.error) return { data: null, error: result.error.message };
    return { data: result.data, error: null };
  } catch (e) {
    return { data: null, error: e.message };
  }
}
