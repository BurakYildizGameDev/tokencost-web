// tests/store.test.js
// Faz 31: Reaktif durum yöneticisi (Pub/Sub store) testleri.
import { describe, it, expect, vi } from 'vitest';
import { createAppStore, buildCalculatedRecords, resolveCatalogKeyForModel } from '../src/ui/store.js';
import { createTokenRecord, createPricingProfile } from '../src/core/schema.js';

/** Test fiyat kataloğu (LiteLLM benzeri kaynak). */
function createTestCatalog() {
  return {
    'deepseek-v4.1-flash': createPricingProfile({
      modelId: 'deepseek-v4.1-flash',
      cachedInputCostPerMillion: 0.014,
      uncachedInputCostPerMillion: 0.14,
      outputCostPerMillion: 0.28,
      source: 'litellm',
    }),
    'glm-5.3': createPricingProfile({
      modelId: 'glm-5.3',
      cachedInputCostPerMillion: 0.03,
      uncachedInputCostPerMillion: 0.3,
      outputCostPerMillion: 0.6,
      source: 'litellm',
    }),
  };
}

/** 1M token'lık örnek kayıt: 600k önbellekli + 400k faturalı. */
function createTestRecord(overrides = {}) {
  return createTokenRecord({
    date: '14 Eki',
    model: 'deepseek-v4.1-flash',
    requests: 341,
    totalTokens: 1_000_000,
    cachedTokens: 600_000,
    billedTokens: 400_000,
    ...overrides,
  });
}

describe('Faz 31: createAppStore - temel durum ve abonelikler', () => {
  it('varsayılan ve verilen başlangıç durumunu yansıtır', () => {
    const defaults = createAppStore().getState();
    expect(defaults.records).toEqual([]);
    expect(defaults.customPrices).toEqual({});
    expect(defaults.currency).toBe('USD');
    expect(defaults.calculatedRecords).toEqual([]);
    expect(defaults.groupedModels).toEqual([]);
    expect(defaults.summary.totalCostUSD).toBe(0);
    expect(defaults.unknownModels).toEqual([]);

    expect(createAppStore({ currency: 'TRY' }).getState().currency).toBe('TRY');
  });

  it('subscribe + setState tüm dinleyicileri yeni state ile tetikler', () => {
    const store = createAppStore();
    const first = vi.fn();
    const second = vi.fn();

    store.subscribe(first);
    store.subscribe(second);
    store.setState({ currency: 'TRY' });

    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    expect(first.mock.calls[0][0].currency).toBe('TRY');
    expect(second.mock.calls[0][0]).toBe(store.getState());
    expect(store.getListenerCount()).toBe(2);
  });

  it('unsubscribe çağrıldıktan sonra dinleyici tetiklenmez', () => {
    const store = createAppStore();
    const listener = vi.fn();

    const unsubscribe = store.subscribe(listener);
    store.setState({ currency: 'EUR' });
    unsubscribe();
    store.setState({ currency: 'USD' });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getListenerCount()).toBe(0);
  });

  it('her setState yeni bir anlık görüntü üretir ve dış mutasyon state bozmaz', () => {
    const store = createAppStore();
    const before = store.getState();

    store.setState({ currency: 'TRY' });
    expect(store.getState()).not.toBe(before);
    expect(before.currency).toBe('USD');

    expect(() => {
      store.getState().currency = 'HACKED';
    }).toThrow();
    expect(store.getState().currency).toBe('TRY');
  });

  it('setState fonksiyon (updater) biçimini de kabul eder', () => {
    const store = createAppStore();
    store.setState((state) => ({ currency: state.currency === 'USD' ? 'TRY' : 'USD' }));
    expect(store.getState().currency).toBe('TRY');
  });

  it('bir dinleyicinin hata fırlatması diğer dinleyicileri engellemez', () => {
    const store = createAppStore();
    const healthy = vi.fn();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    store.subscribe(() => {
      throw new Error('BOOM');
    });
    store.subscribe(healthy);

    expect(() => store.setState({ currency: 'TRY' })).not.toThrow();
    expect(healthy).toHaveBeenCalledTimes(1);

    spy.mockRestore();
  });
});

describe('Faz 31: Türetilmiş durum (derived state) hesaplaması', () => {
  it('records eklendiğinde calculatedRecords, summary ve gruplama otomatik üretilir', () => {
    const store = createAppStore();
    store.setState({ pricingCatalog: createTestCatalog() });
    store.addRecords([createTestRecord()]);

    const state = store.getState();
    expect(state.calculatedRecords).toHaveLength(1);

    const row = state.calculatedRecords[0];
    // cached: 0.6M * 0.014 = 0.0084 | blended: 0.3*0.14 + 0.7*0.28 = 0.238
    // billed: 0.4M * 0.238 = 0.0952 | toplam: 0.1036
    expect(row.cachedCostUSD).toBeCloseTo(0.0084, 6);
    expect(row.billedCostUSD).toBeCloseTo(0.0952, 6);
    expect(row.totalCostUSD).toBeCloseTo(0.1036, 6);
    expect(row.savedUSD).toBeCloseTo(0.0756, 6);
    expect(row.cacheHitRatio).toBe(60);
    expect(row.pricingSource).toBe('litellm');
    expect(typeof row.totalCostUSD).toBe('number');

    expect(state.summary.totalCostUSD).toBeCloseTo(0.1036, 6);
    expect(state.summary.totalRequests).toBe(341);
    expect(state.summary.overallCacheHitRate).toBe(60);
    expect(state.groupedModels).toHaveLength(1);
    expect(state.groupedModels[0].model).toBe('deepseek-v4.1-flash');
  });

  it('customPrices güncellenince derived state yeniden hesaplanır', () => {
    const store = createAppStore({ pricingCatalog: createTestCatalog() });
    store.addRecords([createTestRecord()]);
    const beforeCost = store.getState().summary.totalCostUSD;

    store.setCustomPrice('deepseek-v4.1-flash', {
      cachedInputCostPerMillion: 0.14,
      uncachedInputCostPerMillion: 1.4,
      outputCostPerMillion: 2.8,
    });

    const state = store.getState();
    expect(state.summary.totalCostUSD).toBeCloseTo(beforeCost * 10, 6);
    expect(state.calculatedRecords[0].pricingSource).toBe('custom');
    expect(state.customPrices['deepseek-v4.1-flash'].outputCostPerMillion).toBe(2.8);
  });

  it('satır düzenlendiğinde fatura toplamı anında yeniden hesaplanır', () => {
    const store = createAppStore({ pricingCatalog: createTestCatalog() });
    const id = store.addRecords([createTestRecord()])[0];
    const before = store.getState().summary.totalCostUSD;

    store.updateRecord(id, { totalTokens: 4_000_000, cachedTokens: 2_400_000, billedTokens: 1_600_000 });

    const state = store.getState();
    expect(state.calculatedRecords[0].totalTokens).toBe(4_000_000);
    expect(state.summary.totalTokens).toBe(4_000_000);
    expect(state.summary.totalCostUSD).toBeCloseTo(before * 4, 6);
  });

  it('ilgisiz bir alan (currency) değiştiğinde derived referanslar korunur', () => {
    const store = createAppStore({ pricingCatalog: createTestCatalog() });
    store.addRecords([createTestRecord()]);
    const before = store.getState();

    store.setState({ currency: 'TRY' });

    const state = store.getState();
    expect(state.currency).toBe('TRY');
    expect(state.calculatedRecords).toBe(before.calculatedRecords);
    expect(state.summary).toBe(before.summary);
    expect(state.groupedModels).toBe(before.groupedModels);
  });

  it('katalogda olmayan model fallback fiyatla hesaplanır ve unknownModels listesine girer', () => {
    const store = createAppStore({ pricingCatalog: createTestCatalog() });
    store.addRecords([
      createTestRecord({ model: 'bilinmeyen-model-x', totalTokens: 1_000_000, cachedTokens: 0, billedTokens: 1_000_000 }),
    ]);

    const state = store.getState();
    expect(state.unknownModels).toEqual(['bilinmeyen-model-x']);
    expect(state.calculatedRecords[0].pricingSource).toBe('fallback');
    expect(state.calculatedRecords[0].totalCostUSD).toBeGreaterThan(0);
  });
});

describe('Faz 31: Kayıt işlemleri (CRUD) ve sıfırlama', () => {
  it('addEmptyRecord boş satır ekler, tüm sayısal alanlar 0 olur', () => {
    const store = createAppStore({ pricingCatalog: createTestCatalog() });
    const id = store.addEmptyRecord();

    const state = store.getState();
    expect(state.records).toHaveLength(1);
    expect(state.records[0].model).toBe('Yeni Model');
    expect(state.records[0].requests).toBe(0);
    expect(state.calculatedRecords[0].totalCostUSD).toBe(0);
    expect(typeof id).toBe('string');
  });

  it('removeRecord ve clearRecords satırları siler, derived state küçülür', () => {
    const store = createAppStore({ pricingCatalog: createTestCatalog() });
    const [firstId] = store.addRecords([createTestRecord()]);
    store.addRecords([createTestRecord({ model: 'glm-5.3' })]);

    store.removeRecord(firstId);
    expect(store.getState().records).toHaveLength(1);
    expect(store.getState().groupedModels).toHaveLength(1);

    store.clearRecords();
    expect(store.getState().records).toEqual([]);
    expect(store.getState().summary.totalCostUSD).toBe(0);
  });

  it('reset başlangıç durumuna döner, kayıtlar ve fiyatlar temizlenir', () => {
    const store = createAppStore({ currency: 'TRY', pricingCatalog: createTestCatalog() });
    store.addRecords([createTestRecord()]);
    store.setCustomPrice('glm-5.3', { outputCostPerMillion: 9 });

    store.reset();

    const state = store.getState();
    expect(state.currency).toBe('TRY');
    expect(state.records).toEqual([]);
    expect(state.customPrices).toEqual({});
    expect(state.calculatedRecords).toEqual([]);
    expect(state.summary.totalCostUSD).toBe(0);
  });
});

describe('Faz 31: buildCalculatedRecords (saf yardımcı)', () => {
  it('girdi kayıtlarını mutasyona uğratmaz, kimlik ve fiyat kaynağını korur', () => {
    const record = createTestRecord();
    const snapshot = { ...record };

    const [row] = buildCalculatedRecords([record], { catalog: createTestCatalog() });

    expect(record).toEqual(snapshot);
    expect(row.id).toBe(record.id);
    expect(row.model).toBe('deepseek-v4.1-flash');
    expect(row.pricingSource).toBe('litellm');
    expect(row.isExactMatch).toBe(true);
    expect(row.warningCode).toBeNull();
  });

  it('faturalı token verilmediğinde total - cached ile türetir ve uyarı kodu ekler', () => {
    const record = createTestRecord({ billedTokens: undefined });
    const [row] = buildCalculatedRecords([record], { catalog: createTestCatalog() });

    expect(row.effectiveBilledTokens).toBe(400_000);
    expect(row.warningCode).toBe('BILLED_TOKENS_DERIVED');
  });

  it('boş veya geçersiz listede boş dizi döner', () => {
    expect(buildCalculatedRecords()).toEqual([]);
    expect(buildCalculatedRecords([])).toEqual([]);
    expect(buildCalculatedRecords(null)).toEqual([]);
  });
});

describe('Tarama düzeltmeleri: model adı çözümleme ve güvenli özel fiyatlar', () => {
  it('sağlayıcı önekli (deepseek-ai/DeepSeek-V4.1-Flash) ad katalog anahtarıyla eşleşir', () => {
    const catalog = {
      'deepseek-chat': createPricingProfile({
        modelId: 'deepseek-chat',
        cachedInputCostPerMillion: 0.014,
        uncachedInputCostPerMillion: 0.14,
        outputCostPerMillion: 0.28,
        source: 'litellm',
      }),
    };

    const [row] = buildCalculatedRecords(
      [createTestRecord({ model: 'deepseek-ai/DeepSeek-V4.1-Flash' })],
      { catalog },
    );

    expect(row.model).toBe('deepseek-ai/DeepSeek-V4.1-Flash'); // tabloda ham ad görünür
    expect(row.pricingSource).toBe('litellm');
    expect(row.totalCostUSD).toBeCloseTo(0.1036, 6);
  });

  it('resolveCatalogKeyForModel OCR bozulmasını bulanık eşler, ilgisiz adı null döner', () => {
    const catalog = createTestCatalog();

    expect(resolveCatalogKeyForModel('deepseek-v4.1-flash', catalog)).toBe('deepseek-v4.1-flash');
    expect(resolveCatalogKeyForModel('gIm-5.3', catalog)).toBe('glm-5.3');
    expect(resolveCatalogKeyForModel('bilinmeyen-model-x', catalog)).toBeNull();
    expect(resolveCatalogKeyForModel('', catalog)).toBeNull();
    expect(resolveCatalogKeyForModel('glm-5.3', {})).toBeNull();
  });

  it('katalog dışı modele kısmi özel fiyat verildiğinde store çökmez (source: custom)', () => {
    const store = createAppStore({ pricingCatalog: createTestCatalog() });
    store.addRecords([createTestRecord()]);

    expect(() => store.setCustomPrice('katalog-disi-model', { outputCostPerMillion: 5 })).not.toThrow();
    expect(store.getState().customPrices['katalog-disi-model'].outputCostPerMillion).toBe(5);
  });
});

