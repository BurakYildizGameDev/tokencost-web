// src/core/normalizer.js
// Faz 11: Model adı normalizasyonu (Saf / Pure Core katmanı).
// KURAL: Bu dosyada document, window, localStorage veya fetch KULLANILMAZ.

/** Ad sonundaki etiket ekleri: ":free", ":beta", ":latest" vb. */
const TAG_SUFFIX_PATTERN = /:(free|beta|preview|nitro|extended|thinking|latest)$/;
/** "-latest" son eki. */
const LATEST_SUFFIX_PATTERN = /-latest$/;

/**
 * Etiket son eklerini temizler (birden fazla ek varsa hepsini kaldırır).
 * NOT: Versiyon/boyut numaralarına (v4.1, 5.3, 30b, 8b, 1.7b) DOKUNMAZ.
 * @param {string} name
 * @returns {string}
 */
function stripModelTags(name) {
  let out = name;
  let changed = true;
  while (changed) {
    changed = false;
    if (TAG_SUFFIX_PATTERN.test(out)) {
      out = out.replace(TAG_SUFFIX_PATTERN, '');
      changed = true;
    }
    if (LATEST_SUFFIX_PATTERN.test(out)) {
      out = out.replace(LATEST_SUFFIX_PATTERN, '');
      changed = true;
    }
  }
  return out;
}

/** Boşlukları tek tireye indirger, ardışık/kenar tireleri temizler. */
function canonicalizeName(name) {
  return stripModelTags(name)
    .replace(/\s+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Faz 11: Ham adı parçalarına ayırır (sağlayıcı + tam ad + baz ad).
 * @param {string} rawName
 * @returns {{ full: string, provider: string, base: string }}
 */
export function extractModelIdentifiers(rawName) {
  if (typeof rawName !== 'string') {
    return { full: '', provider: '', base: '' };
  }
  const trimmed = rawName.trim().toLowerCase();
  if (trimmed === '') {
    return { full: '', provider: '', base: '' };
  }
  const lastSlash = trimmed.lastIndexOf('/');
  const provider = lastSlash === -1 ? '' : trimmed.slice(0, lastSlash);
  const base = lastSlash === -1 ? trimmed : trimmed.slice(lastSlash + 1);
  return {
    full: canonicalizeName(trimmed),
    provider,
    base: canonicalizeName(base),
  };
}

/**
 * Faz 11: Sağlayıcı önekini ve etiket son eklerini ayıklayıp model adını normalize eder.
 * @param {string} rawName
 * @returns {string}
 */
export function normalizeModelName(rawName) {
  return extractModelIdentifiers(rawName).base;
}

/** Faz 12: Yerleşik model takma ad (alias) sözlüğü. */
export const DEFAULT_MODEL_ALIASES = Object.freeze({
  'deepseek-v4.1-flash': 'deepseek-chat',
  'deepseek-v4-flash': 'deepseek-chat',
  'glm-5.3': 'glm-4-plus',
  'mimo-v2.6-pro': 'mimo-v2.6-pro',
  'qwen3-vl-30b': 'qwen-vl-max',
  'qwen3-embedding-8b': 'qwen-text-embedding',
  'qwen3-asr-1.7b': 'qwen-audio-asr',
});

/**
 * Faz 12: Normalize edilmiş adı kanonik fiyat anahtarına eşler.
 * customAliases verilirse yerleşik sözlüğü ezer.
 * @param {string} normalizedName
 * @param {Record<string,string>} [customAliases]
 * @returns {string}
 */
export function resolveModelAlias(normalizedName, customAliases = {}) {
  const key = typeof normalizedName === 'string' ? normalizedName.trim().toLowerCase() : '';
  const table = Object.assign({}, DEFAULT_MODEL_ALIASES, customAliases || {});
  if (Object.prototype.hasOwnProperty.call(table, key)) {
    return table[key];
  }
  return key;
}

/**
 * Faz 13: Saf Levenshtein mesafesi (harici paket YOK, ~25 satırlık DP).
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
export function levenshteinDistance(a, b) {
  const s = String(a);
  const t = String(b);
  if (s === t) return 0;
  if (s.length === 0) return t.length;
  if (t.length === 0) return s.length;

  let prev = new Array(t.length + 1);
  let curr = new Array(t.length + 1);
  for (let j = 0; j <= t.length; j += 1) prev[j] = j;

  for (let i = 1; i <= s.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
    }
    const swap = prev;
    prev = curr;
    curr = swap;
  }
  return prev[t.length];
}

/**
 * Faz 13: OCR/typo hatalarına karşı bulanık eşleme yapar.
 * @param {string} targetName
 * @param {string[]} candidateModelIds
 * @param {number} [maxDistance=3]
 * @returns {{ matchedId: string, distance: number, confidence: number } | null}
 */
export function fuzzyMatchModel(targetName, candidateModelIds = [], maxDistance = 3) {
  const target = normalizeModelName(targetName);
  if (!target || !Array.isArray(candidateModelIds) || candidateModelIds.length === 0) {
    return null;
  }

  let best = null;
  for (const candidate of candidateModelIds) {
    const normalizedCandidate = normalizeModelName(candidate);
    if (!normalizedCandidate) continue;
    const distance = levenshteinDistance(target, normalizedCandidate);
    if (best === null || distance < best.distance) {
      const maxLen = Math.max(target.length, normalizedCandidate.length) || 1;
      best = {
        matchedId: candidate,
        distance,
        confidence: Number((1 - distance / maxLen).toFixed(2)),
      };
    }
  }

  if (best === null || best.distance > maxDistance) return null;
  return best;
}
