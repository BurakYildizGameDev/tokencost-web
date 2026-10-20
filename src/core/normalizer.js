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
