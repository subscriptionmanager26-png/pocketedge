import { supabase } from '../supabase';


const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isDbUserId(userId) {
  return Boolean(userId && UUID_RE.test(userId));
}

function mapDbBasket(row, profile = null) {
  if (!row) return null;
  const meta = row.metadata && typeof row.metadata === 'object' ? row.metadata : {};
  const constituentCount = Array.isArray(row.constituents) ? row.constituents.length : 0;
  const creatorFromRow =
    row.creator_display_name || row.creator_bio || row.creator_avatar_url
      ? {
          name: row.creator_display_name || 'Investor',
          bio: row.creator_bio || '',
          avatarUrl: row.creator_avatar_url || '',
          links: [],
          followers: meta.followers ?? 0,
        }
      : null;

  return {
    id: row.id,
    catalogSlug: row.catalog_slug ?? null,
    name: row.name,
    shortDescription: row.short_description ?? '',
    description: row.description ?? '',
    imageUrl: row.image_url ?? '',
    imageGradient: row.image_gradient ?? 'from-emerald-600 to-cyan-500',
    weightingType: row.weighting_type ?? 'equal',
    rebalanceFrequency: row.rebalance_frequency ?? 'quarterly',
    constituents: Array.isArray(row.constituents) ? row.constituents : [],
    versionNumber: row.version_number ?? row.current_version ?? 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    badge: meta.badge ?? null,
    type: meta.type ?? 'Basket',
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    methodology: meta.methodology,
    factsheet: meta.factsheet,
    risk: meta.risk,
    creatorName: meta.creatorName,
    followers: meta.followers,
    creator: creatorFromRow ||
      (profile
        ? {
            name: profile.display_name || profile.name || 'Investor',
            bio: profile.bio || '',
            avatarUrl: profile.avatar_url || profile.avatarUrl || '',
            links: profile.links || [],
            followers: meta.followers ?? 0,
          }
        : meta.creatorName
          ? {
              name: meta.creatorName,
              bio: '',
              avatarUrl: '',
              links: [],
              followers: meta.followers ?? 0,
            }
          : undefined),
    stats: {
      ...(meta.stats || {}),
      constituents: meta.stats?.constituents ?? constituentCount,
      minInvestAmount: meta.stats?.minInvestAmount ?? 5000,
    },
  };
}

function mapDbProfile(row) {
  if (!row) return null;
  return {
    name: row.display_name ?? '',
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url ?? '',
    links: Array.isArray(row.links) ? row.links : [],
  };
}

export function profileHasContent(profile) {
  if (!profile) return false;
  return Boolean(
    profile.name?.trim() ||
      profile.bio?.trim() ||
      profile.avatarUrl ||
      (profile.links || []).some((l) => l.label?.trim() || l.url?.trim())
  );
}

function profileFromAuthUser(user) {
  const meta = user?.user_metadata || {};
  return {
    name: (meta.full_name || meta.name || '').trim(),
    bio: '',
    avatarUrl: meta.avatar_url || meta.picture || '',
    links: [],
  };
}

/** Create a DB profile from Google auth when none exists yet. */
export async function ensureCreatorProfileFromAuth(user) {
  if (!supabase || !user?.id || !isDbUserId(user.id)) return null;

  const existing = await fetchCreatorProfile(user.id);
  if (profileHasContent(existing)) return existing;

  const seed = profileFromAuthUser(user);
  if (!profileHasContent(seed)) return existing;

  return saveCreatorProfile(user.id, seed);
}

export function computeBasketVersionChanges(previous, next) {
  if (!previous) return { initial: true };

  const fields = [];
  const fieldMap = [
    ['name', 'name'],
    ['shortDescription', 'short_description'],
    ['description', 'description'],
    ['imageUrl', 'image_url'],
    ['imageGradient', 'image_gradient'],
    ['weightingType', 'weighting_type'],
    ['rebalanceFrequency', 'rebalance_frequency'],
  ];

  for (const [clientKey, dbKey] of fieldMap) {
    const prevVal = previous[clientKey] ?? previous[dbKey] ?? '';
    const nextVal = next[clientKey] ?? next[dbKey] ?? '';
    if (String(prevVal) !== String(nextVal)) {
      fields.push(clientKey);
    }
  }

  const prevSymbols = new Map(
    (previous.constituents || []).map((c) => [c.symbol, c])
  );
  const nextSymbols = new Map((next.constituents || []).map((c) => [c.symbol, c]));

  const added = [];
  const removed = [];
  const weightChanges = [];

  for (const [symbol, row] of nextSymbols) {
    if (!prevSymbols.has(symbol)) {
      added.push({ symbol, name: row.name, weight: row.weight });
    }
  }

  for (const [symbol, row] of prevSymbols) {
    if (!nextSymbols.has(symbol)) {
      removed.push({ symbol, name: row.name, weight: row.weight });
    }
  }

  for (const [symbol, row] of nextSymbols) {
    const prev = prevSymbols.get(symbol);
    if (prev && Number(prev.weight) !== Number(row.weight)) {
      weightChanges.push({
        symbol,
        name: row.name,
        old_weight: Number(prev.weight),
        new_weight: Number(row.weight),
      });
    }
  }

  return {
    fields_changed: fields,
    constituents: { added, removed, weight_changes: weightChanges },
  };
}

export async function fetchCreatorProfile(userId) {
  if (!supabase || !isDbUserId(userId)) return null;

  const { data, error } = await supabase.rpc('get_creator_profile', {
    p_user_id: userId,
  });

  if (error) throw error;
  return mapDbProfile(data);
}

export async function saveCreatorProfile(userId, profile) {
  if (!supabase || !isDbUserId(userId)) {
    throw new Error('Sign in to save your profile.');
  }

  const { data, error } = await supabase.rpc('upsert_creator_profile', {
    p_display_name: profile.name?.trim() || null,
    p_bio: profile.bio?.trim() || null,
    p_avatar_url: profile.avatarUrl || null,
    p_links: profile.links || [],
  });

  if (error) throw error;
  return mapDbProfile(data);
}

export async function fetchMarketplaceBaskets() {
  if (!supabase) return [];

  const { data, error } = await supabase.rpc('list_marketplace_baskets');
  if (error) throw error;

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => mapDbBasket(row));
}

export async function resolveBasketId(key) {
  if (!supabase || !key) return key;
  if (UUID_RE.test(key)) return key;

  const { data, error } = await supabase.rpc('resolve_basket_id', { p_key: key });
  if (error) throw error;
  return data || key;
}

export async function fetchUserBaskets(userId) {
  if (!supabase || !isDbUserId(userId)) return [];

  const [basketsRes, profileRes] = await Promise.all([
    supabase.rpc('list_creator_baskets', { p_creator_id: userId }),
    supabase.rpc('get_creator_profile', { p_user_id: userId }),
  ]);

  if (basketsRes.error) throw basketsRes.error;
  if (profileRes.error) throw profileRes.error;

  const profile = mapDbProfile(profileRes.data);
  const rows = Array.isArray(basketsRes.data) ? basketsRes.data : [];

  return rows.map((row) => mapDbBasket(row, profile));
}

export async function saveBasketToDb(userId, basket, { previousVersion = null } = {}) {
  if (!supabase || !isDbUserId(userId)) {
    throw new Error('Sign in to save baskets.');
  }

  const isUuidBasket = basket.id && UUID_RE.test(basket.id);
  const changes = previousVersion
    ? computeBasketVersionChanges(previousVersion, basket)
    : { initial: true };

  const { data, error } = await supabase.rpc('save_basket_version', {
    p_basket_id: isUuidBasket ? basket.id : null,
    p_name: basket.name,
    p_short_description: basket.shortDescription || null,
    p_description: basket.description || null,
    p_image_url: basket.imageUrl || null,
    p_image_gradient: basket.imageGradient || null,
    p_weighting_type: basket.weightingType || 'equal',
    p_rebalance_frequency: basket.rebalanceFrequency || 'quarterly',
    p_constituents: basket.constituents || [],
    p_changes_from_previous: changes,
  });

  if (error) throw error;

  const profile = await fetchCreatorProfile(userId);
  return mapDbBasket(data, profile);
}

export async function fetchBasketVersionHistory(basketId) {
  if (!supabase || !UUID_RE.test(basketId)) return [];

  const { data, error } = await supabase.rpc('list_basket_versions', {
    p_basket_id: basketId,
  });

  if (error) throw error;
  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => ({
    ...mapDbBasket(row),
    changesFromPrevious: row.changes_from_previous,
  }));
}

export async function fetchBasketSubscriptions(userId) {
  if (!supabase || !isDbUserId(userId)) return [];

  const { data, error } = await supabase
    .from('basket_subscriptions')
    .select('basket_key')
    .eq('user_id', userId);

  if (error) throw error;
  return (data || []).map((row) => row.basket_key);
}

export async function subscribeBasketInDb(userId, basketKey) {
  if (!supabase || !isDbUserId(userId)) return;

  const { error } = await supabase.from('basket_subscriptions').upsert({
    user_id: userId,
    basket_key: basketKey,
  });

  if (error) throw error;
}

export async function fetchTrackedInvestments(userId) {
  if (!supabase || !isDbUserId(userId)) return [];

  const { data, error } = await supabase
    .from('tracked_investments')
    .select('basket_key, invested_amount, since, updated_at')
    .eq('user_id', userId);

  if (error) throw error;

  return (data || []).map((row) => ({
    basketId: row.basket_key,
    investedAmount: Number(row.invested_amount),
    since: row.since,
    updatedAt: row.updated_at,
  }));
}

export async function trackInvestmentInDb(userId, basketId, amount) {
  if (!supabase || !isDbUserId(userId)) {
    throw new Error('Sign in to track investments.');
  }

  const existing = await supabase
    .from('tracked_investments')
    .select('invested_amount')
    .eq('user_id', userId)
    .eq('basket_key', basketId)
    .maybeSingle();

  if (existing.error) throw existing.error;

  const nextAmount = existing.data
    ? Number(existing.data.invested_amount) + amount
    : amount;

  const { data, error } = await supabase
    .from('tracked_investments')
    .upsert({
      user_id: userId,
      basket_key: basketId,
      invested_amount: nextAmount,
      since: existing.data ? undefined : new Date().toISOString().slice(0, 10),
      updated_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) throw error;

  return {
    basketId,
    investedAmount: Number(data.invested_amount),
    since: data.since,
  };
}
