import sb from './client';

// ===== PRICES =====

export async function fetchPrices(woodId) {
  let query = sb.from('prices').select('*');
  if (woodId) query = query.eq('wood_id', woodId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const result = {};
  (data || []).forEach(r => {
    const key = r.wood_id + '||' + r.sku_key;
    result[key] = {
      price: r.price != null ? parseFloat(r.price) : null,
      price2: r.price2 != null ? parseFloat(r.price2) : undefined,
      updated: r.updated_date ? String(r.updated_date).slice(0, 10) : '',
      updatedBy: r.updated_by,
      costPrice: r.cost_price != null ? parseFloat(r.cost_price) : undefined,
    };
  });
  return result;
}

export async function fetchChangeLogs(woodId, limit = 50) {
  let query = sb.from('change_log').select('*').order('timestamp', { ascending: false }).limit(limit);
  if (woodId) query = query.eq('wood_id', woodId);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data || [];
}

export async function updatePrice(woodId, skuKey, newPrice, oldPrice, reason, changedBy, costPrice, price2, batchId) {
  const row = {
    wood_id: woodId,
    sku_key: skuKey,
    price: newPrice,
    updated_date: new Date().toISOString().slice(0, 10),
    updated_by: changedBy || 'admin',
    ...(costPrice != null && { cost_price: costPrice }),
    ...(price2 != null && { price2: price2 }),
  };
  const { error } = await sb.from('prices').upsert(row, { onConflict: 'wood_id,sku_key' });
  if (error) return { error: error.message };

  await sb.from('change_log').insert({
    wood_id: woodId, sku_key: skuKey,
    old_price: oldPrice ?? null,
    new_price: newPrice ?? null,
    reason: reason || '',
    changed_by: changedBy || 'admin',
    ...(batchId != null && { batch_id: batchId }),
  });
  return { ok: true };
}

export async function renameAttrValue(attrId, oldVal, newVal) {
  const seg = `${attrId}:${oldVal}`;
  const newSeg = `${attrId}:${newVal}`;
  let pricesMigrated = 0, bundlesMigrated = 0, logsMigrated = 0;

  // 1. Prices: fetch → insert new key → delete old key
  const { data: pRows, error: pErr } = await sb.from('prices')
    .select('wood_id,sku_key,price,price2,updated_date,updated_by,cost_price')
    .like('sku_key', `%${seg}%`);
  if (pErr) return { error: pErr.message };
  for (const row of (pRows || [])) {
    const segs = row.sku_key.split('||');
    if (!segs.includes(seg)) continue;
    const newSkuKey = segs.map(s => s === seg ? newSeg : s).join('||');
    const { error: ie } = await sb.from('prices').upsert(
      { wood_id: row.wood_id, sku_key: newSkuKey, price: row.price, price2: row.price2 ?? null, updated_date: row.updated_date, updated_by: row.updated_by, cost_price: row.cost_price },
      { onConflict: 'wood_id,sku_key' }
    );
    if (ie) return { error: ie.message };
    await sb.from('prices').delete().eq('wood_id', row.wood_id).eq('sku_key', row.sku_key);
    pricesMigrated++;
  }

  // 2. Bundles: update sku_key + attributes jsonb + price_attrs_override
  const { data: bRows, error: bErr } = await sb.from('wood_bundles')
    .select('id,sku_key,attributes,price_attrs_override')
    .contains('attributes', { [attrId]: oldVal });
  if (bErr) return { error: bErr.message };
  for (const row of (bRows || [])) {
    const newAttrs = { ...row.attributes, [attrId]: newVal };
    const newSkuKey = (row.sku_key || '').split('||').map(s => s === seg ? newSeg : s).join('||');
    const updates = { sku_key: newSkuKey, attributes: newAttrs };
    // Migrate price_attrs_override nếu có chứa giá trị cũ
    if (row.price_attrs_override && row.price_attrs_override[attrId] === oldVal) {
      updates.price_attrs_override = { ...row.price_attrs_override, [attrId]: newVal };
    }
    const { error: ue } = await sb.from('wood_bundles').update(updates).eq('id', row.id);
    if (ue) return { error: ue.message };
    bundlesMigrated++;
  }
  // 2b. Bundles có price_attrs_override chứa oldVal nhưng attributes không chứa
  const { data: bOvrRows, error: bOvrErr } = await sb.from('wood_bundles')
    .select('id,price_attrs_override')
    .not('attributes', 'cs', JSON.stringify({ [attrId]: oldVal }))
    .contains('price_attrs_override', { [attrId]: oldVal });
  if (!bOvrErr && bOvrRows?.length) {
    for (const row of bOvrRows) {
      const newOvr = { ...row.price_attrs_override, [attrId]: newVal };
      await sb.from('wood_bundles').update({ price_attrs_override: newOvr }).eq('id', row.id);
    }
  }

  // 3. Change log (lịch sử bảng giá)
  const { data: cRows, error: cErr } = await sb.from('change_log')
    .select('id,sku_key')
    .like('sku_key', `%${seg}%`);
  if (cErr) return { error: cErr.message };
  for (const row of (cRows || [])) {
    const segs = row.sku_key.split('||');
    if (!segs.includes(seg)) continue;
    const newSkuKey = segs.map(s => s === seg ? newSeg : s).join('||');
    await sb.from('change_log').update({ sku_key: newSkuKey }).eq('id', row.id);
    logsMigrated++;
  }

  return { success: true, pricesMigrated, bundlesMigrated, logsMigrated };
}

// Copy giá từ key nhóm default sang key NCC riêng
export async function migratePriceGroupKeys(woodId, attrId, defaultLabel, newSpecials) {
  const oldSeg = `${attrId}:${defaultLabel}`;
  let migrated = 0;

  const { data: pRows, error: pErr } = await sb.from('prices')
    .select('wood_id,sku_key,price,price2,updated_date,updated_by,cost_price')
    .eq('wood_id', woodId)
    .like('sku_key', `%${oldSeg}%`);
  if (pErr) return { error: pErr.message };

  for (const row of (pRows || [])) {
    const segs = row.sku_key.split('||');
    if (!segs.includes(oldSeg)) continue;
    for (const ncc of newSpecials) {
      const newSeg = `${attrId}:${ncc}`;
      const newSkuKey = segs.map(s => s === oldSeg ? newSeg : s).join('||');
      const { data: exist } = await sb.from('prices')
        .select('wood_id').eq('wood_id', woodId).eq('sku_key', newSkuKey).limit(1);
      if (exist?.length) continue;
      const { error: ie } = await sb.from('prices').upsert(
        { wood_id: woodId, sku_key: newSkuKey, price: row.price, price2: row.price2 ?? null, updated_date: row.updated_date, updated_by: row.updated_by, cost_price: row.cost_price },
        { onConflict: 'wood_id,sku_key' }
      );
      if (ie) return { error: ie.message };
      migrated++;
    }
  }

  return { success: true, migrated };
}

// Xóa giá orphan của key nhóm default
export async function deletePriceGroupKeys(woodId, attrId, defaultLabel) {
  const oldSeg = `${attrId}:${defaultLabel}`;
  const { data: pRows, error } = await sb.from('prices')
    .select('wood_id,sku_key').eq('wood_id', woodId).like('sku_key', `%${oldSeg}%`);
  if (error) return { error: error.message };
  let deleted = 0;
  for (const row of (pRows || [])) {
    if (!row.sku_key.split('||').includes(oldSeg)) continue;
    await sb.from('prices').delete().eq('wood_id', row.wood_id).eq('sku_key', row.sku_key);
    deleted++;
  }
  return { success: true, deleted };
}

// Xóa hàng loạt giá theo danh sách
export async function deletePrices(woodId, skuKeys) {
  let deleted = 0;
  for (const sk of skuKeys) {
    const { error } = await sb.from('prices').delete().eq('wood_id', woodId).eq('sku_key', sk);
    if (error) return { error: error.message };
    deleted++;
  }
  return { success: true, deleted };
}
