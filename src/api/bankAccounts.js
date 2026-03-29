import sb from './client';

function mapBankAccount(r) {
  return {
    id: r.id,
    bankName: r.bank_name,
    accountNumber: r.account_number,
    accountName: r.account_name,
    bin: r.bin,
    isDefault: r.is_default || false,
    active: r.active !== false,
    createdAt: r.created_at,
  };
}

export async function fetchBankAccounts() {
  const { data, error } = await sb.from('bank_accounts').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return (data || []).map(mapBankAccount);
}

export async function addBankAccount({ bankName, accountNumber, accountName, bin, isDefault }) {
  // Nếu set default → bỏ default cũ
  if (isDefault) {
    await sb.from('bank_accounts').update({ is_default: false }).eq('is_default', true);
  }
  const { data, error } = await sb.from('bank_accounts').insert({
    bank_name: bankName, account_number: accountNumber, account_name: accountName,
    bin, is_default: isDefault || false,
  }).select().single();
  if (error) return { error: error.message };
  return { success: true, account: mapBankAccount(data) };
}

export async function updateBankAccount(id, updates) {
  const row = {};
  if (updates.bankName !== undefined) row.bank_name = updates.bankName;
  if (updates.accountNumber !== undefined) row.account_number = updates.accountNumber;
  if (updates.accountName !== undefined) row.account_name = updates.accountName;
  if (updates.bin !== undefined) row.bin = updates.bin;
  if (updates.active !== undefined) row.active = updates.active;
  if (updates.isDefault) {
    await sb.from('bank_accounts').update({ is_default: false }).eq('is_default', true);
    row.is_default = true;
  }
  const { error } = await sb.from('bank_accounts').update(row).eq('id', id);
  return error ? { error: error.message } : { success: true };
}

export async function deleteBankAccount(id) {
  const { error } = await sb.from('bank_accounts').delete().eq('id', id);
  return error ? { error: error.message } : { success: true };
}
