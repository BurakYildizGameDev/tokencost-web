// src/ui/store.js
// Faz 31: Reaktif durum yöneticisi (saf Pub/Sub store).
// KURAL: Redux, Zustand veya React KULLANILMAZ; document/window/localStorage erişimi YOKTUR.
// Bu modül çekirdek hesaplayıcıları kullanarak türetilmiş (derived) durumu üretir.

import { createTokenRecord, createPricingProfile } from '../core/schema.js';
import {
  aggregateUsageSummaries,
  calculateCacheHitRatio,
  calculateCacheSavings,
  calculateSingleRowCost,
  groupRecordsByModel,
  validateTokenConsistency,
} from '../core/calculator.js';
import { applyCustomPriceOverrides } from '../services/pricing-service.js';

/** Değiştiğinde türetilmiş durumun (derived state) yeniden hesaplanmasını tetikleyen alanlar. */
const DERIVED_INPUT_KEYS = Object.freeze(['records', 'customPrices', 'pricingCatalog']);

/** Fiyat kataloğunda bulunamayan modeller için güvenli tahmini fiyat (1M token / USD). */
export const FALLBACK_PRICING = Object.freeze({
  uncachedInputCostPerMillion: 0.14,
  outputCostPerMillion: 0.28,
});

/** Bilinmeyen model fiyatının kaynağı (uyarı rozetleri için). */
export const FALLBACK_PRICING_SOURCE = 'fallback';

/** Kullanıcı yeni satır eklediğinde kullanılan varsayılan model adı. */
export const DEFAULT_NEW_MODEL_NAME = 'Yeni Model';

/**
 * Faz 31: Başlangıç durumunu üretir (türetilmiş alanlar hariç).
 * @param {object} [overrides]
 * @returns {object}
 */
function createBaseState(overrides = {}) {
  return {
    records: [],
    pricingCatalog: {},
    customPrices: {},
    currency: 'USD',
    currencyRates: {},
    progress: { step: 'idle', percentage: 0, message: '', isVisible: false },
    ...overrides,
  };
}

/** Kaydı standart forma getirir (id yoksa üretir). */
function normalizeRecord(record) {
  if (record && typeof record.id === 'string' && record.id !== '') {
    return Object.freeze({ ...record });
  }
  return createTokenRecord(record || {});
}

/**
 * Faz 31: Ham kayıtları fiyatlandırılmış (calculatedRecords) satırlara dönüştürür.
 * Saf fonksiyondur: girdi kayıtlarını mutasyona uğratmaz, yeni diziler döner.
 * @param {object[]} records
 * @param {{ catalog?: object, customPrices?: object }} [options]
 * @returns {object[]}
 */
export function buildCalculatedRecords(records, { catalog = {}, customPrices = {} } = {}) {
  const list = Array.isArray(records) ? records.filter(Boolean) : [];
  if (list.length === 0) return [];

  // Katalogda olmayan modeller için fallback profili üretilir (temel katalog kopyası üzerinde).
  const effectiveCatalog = { ...catalog };
  for (const record of list) {
    const model = record.model;
    if (typeof model !== 'string' || model === '' || effectiveCatalog[model]) continue;
    effectiveCatalog[model] = createPricingProfile({
      modelId: model,
      uncachedInputCostPerMillion: FALLBACK_PRICING.uncachedInputCostPerMillion,
      outputCostPerMillion: FALLBACK_PRICING.outputCostPerMillion,
      source: FALLBACK_PRICING_SOURCE,
    });
  }

  const pricedCatalog = applyCustomPriceOverrides(effectiveCatalog, customPrices);

  return list.map((record) => {
    const profile = pricedCatalog[record.model]
      || createPricingProfile({
        modelId: record.model,
        uncachedInputCostPerMillion: FALLBACK_PRICING.uncachedInputCostPerMillion,
        outputCostPerMillion: FALLBACK_PRICING.outputCostPerMillion,
        source: FALLBACK_PRICING_SOURCE,
      });

    const consistency = validateTokenConsistency(record);
    const cost = calculateSingleRowCost(
      { ...record, billedTokens: consistency.effectiveBilledTokens },
      profile,
    );
    const savings = calculateCacheSavings(
      record.cachedTokens,
      profile.uncachedInputCostPerMillion,
      profile.cachedInputCostPerMillion,
    );

    return Object.freeze({
      ...record,
      cachedCostUSD: cost.cachedCostUSD,
      billedCostUSD: cost.billedCostUSD,
      totalCostUSD: cost.totalCostUSD,
      blendedInputOutputCostPerMillion: cost.blendedInputOutputCostPerMillion,
      savedUSD: savings.savedUSD,
      cacheHitRatio: calculateCacheHitRatio(record.cachedTokens, record.totalTokens),
      effectiveBilledTokens: consistency.effectiveBilledTokens,
      isExactMatch: consistency.isExactMatch,
      warningCode: consistency.warningCode,
      pricingSource: profile.source,
    });
  });
}

/** Kayıtlardan özet, gruplama ve uyarı listesi gibi türetilmiş alanları üretir. */
function recomputeDerived(state) {
  const calculatedRecords = buildCalculatedRecords(state.records, {
    catalog: state.pricingCatalog,
    customPrices: state.customPrices,
  });

  const unknownModels = [];
  for (const row of calculatedRecords) {
    if (row.pricingSource === FALLBACK_PRICING_SOURCE && !unknownModels.includes(row.model)) {
      unknownModels.push(row.model);
    }
  }

  return {
    calculatedRecords,
    summary: aggregateUsageSummaries(calculatedRecords),
    groupedModels: groupRecordsByModel(calculatedRecords),
    unknownModels,
  };
}

/**
 * Faz 31: Basit Observer (Pub/Sub) tabanlı uygulama durumu.
 * ~50 satırlık saf JavaScript; Redux/Zustand/React bağımlılığı yok.
 * @param {object} [initialState]
 * @returns {object}
 */
export function createAppStore(initialState = {}) {
  const initialOverrides = { ...initialState };
  const baseState = createBaseState(initialOverrides);
  let state = Object.freeze({ ...baseState, ...recomputeDerived(baseState) });
  const listeners = new Set();

  /** @returns {object} Mevcut (dondurulmuş) durum anlık görüntüsü. */
  function getState() {
    return state;
  }

  function emit() {
    for (const listener of Array.from(listeners)) {
      try {
        listener(state);
      } catch (error) {
        // Bir dinleyicinin hatası diğerlerini ve uygulamayı durdurmamalı.
        if (typeof console !== 'undefined' && typeof console.error === 'function') {
          console.error('[store] Dinleyici hatası:', error);
        }
      }
    }
  }

  function commit(nextState) {
    state = Object.freeze(nextState);
    emit();
    return state;
  }

  /**
   * Durumu kısmi olarak günceller; girdiler değiştiyse türetilmiş alanları yeniden hesaplar.
   * @param {object|Function} partial - Nesne ya da `(state) => patch` fonksiyonu.
   * @returns {object} Yeni durum.
   */
  function setState(partial) {
    const patch = typeof partial === 'function' ? partial(state) : partial;
    const merged = { ...state, ...(patch || {}) };

    if (DERIVED_INPUT_KEYS.some((key) => merged[key] !== state[key])) {
      Object.assign(merged, recomputeDerived(merged));
    } else {
      // Türetilmiş alanlar yalnızca ilgili girdiler değiştiğinde yenilenir (gereksiz iş yok).
      Object.assign(merged, {
        calculatedRecords: state.calculatedRecords,
        summary: state.summary,
        groupedModels: state.groupedModels,
        unknownModels: state.unknownModels,
      });
    }

    return commit(merged);
  }

  /** @param {Function} listener @returns {Function} Abonelikten çıkma fonksiyonu. */
  function subscribe(listener) {
    if (typeof listener !== 'function') {
      throw new TypeError('ERR_INVALID_STORE_LISTENER');
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  /** @returns {number} Aktif dinleyici sayısı (test/gözlem amaçlı). */
  function getListenerCount() {
    return listeners.size;
  }

  /** @param {object|object[]} records @returns {string[]} Eklenen kayıt kimlikleri. */
  function addRecords(records) {
    const list = (Array.isArray(records) ? records : [records]).filter(Boolean).map(normalizeRecord);
    if (list.length === 0) return [];
    setState({ records: [...state.records, ...list] });
    return list.map((record) => record.id);
  }

  /** Faz 33: Hücre düzenlemesi. @returns {boolean} Güncelleme yapıldı mı? */
  function updateRecord(recordId, patch = {}) {
    const index = state.records.findIndex((record) => record.id === recordId);
    if (index === -1) return false;

    const current = state.records[index];
    const regenerated = createTokenRecord({ ...current, ...patch });
    const records = [...state.records];
    records[index] = Object.freeze({ ...regenerated, id: current.id });
    setState({ records });
    return true;
  }

  /** @returns {boolean} Silme yapıldı mı? */
  function removeRecord(recordId) {
    const records = state.records.filter((record) => record.id !== recordId);
    if (records.length === state.records.length) return false;
    setState({ records });
    return true;
  }

  /** Faz 33: "+ Satır Ekle" butonu. @returns {string} Yeni kaydın kimliği. */
  function addEmptyRecord(overrides = {}) {
    const record = createTokenRecord({
      model: DEFAULT_NEW_MODEL_NAME,
      requests: 0,
      totalTokens: 0,
      cachedTokens: 0,
      billedTokens: 0,
      ...overrides,
    });
    setState({ records: [...state.records, record] });
    return record.id;
  }

  function clearRecords() {
    setState({ records: [] });
  }

  /** Faz 33: Kullanıcının tablodan birim fiyatı elle düzeltmesi. */
  function setCustomPrice(modelId, prices = {}) {
    const existing = state.customPrices[modelId] || {};
    const merged = { ...existing, ...prices };
    setState({ customPrices: { ...state.customPrices, [modelId]: merged } });
    return merged;
  }

  /** Tüm durumu başlangıç değerlerine döndürür. */
  function reset() {
    const fresh = createBaseState(initialOverrides);
    return commit({ ...fresh, ...recomputeDerived(fresh) });
  }

  return {
    getState,
    setState,
    subscribe,
    getListenerCount,
    addRecords,
    updateRecord,
    removeRecord,
    addEmptyRecord,
    clearRecords,
    setCustomPrice,
    reset,
  };
}

