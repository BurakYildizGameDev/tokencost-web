// tests/parser.test.js
// Faz 21 - 25: Metin / tablo ayrıştırıcı testleri.
import { describe, it, expect } from 'vitest';
import { tokenizeRawLine, isSummaryRow } from '../src/core/parser.js';
import { sanitizeNumberString } from '../src/core/parser.js';
import { parseCachedColumn } from '../src/core/parser.js';
import { detectColumnIndices } from '../src/core/parser.js';
import { parsePastedTableText } from '../src/core/parser.js';

describe('Faz 21: tokenizeRawLine', () => {
  it('sekme ile ayrılmış gerçek satırı tam 7 hücreye ayırır', () => {
    const line =
      '14 Eki\tdeepseek-v4.1-flash\t341\t30.811.037\t29.312.128 (%96)\t2.378.273\t0,00';
    const cells = tokenizeRawLine(line);
    expect(cells).toHaveLength(7);
    expect(cells[0]).toBe('14 Eki');
    expect(cells[1]).toBe('deepseek-v4.1-flash');
    expect(cells[4]).toBe('29.312.128 (%96)');
    expect(cells[6]).toBe('0,00');
  });

  it('sekme yoksa 2+ boşluğu ayırıcı kabul eder, "14 Eki" bölünmez', () => {
    const cells = tokenizeRawLine('14 Eki   deepseek-v4.1-flash   341   30.811.037');
    expect(cells).toEqual(['14 Eki', 'deepseek-v4.1-flash', '341', '30.811.037']);
    expect(cells[0]).toBe('14 Eki');
  });

  it('tek boşluklu cümleleri parçalamaz ve boş satırda [] döner', () => {
    expect(tokenizeRawLine('kartında görebilirsiniz.')).toEqual(['kartında görebilirsiniz.']);
    expect(tokenizeRawLine('')).toEqual([]);
    expect(tokenizeRawLine('   ')).toEqual([]);
  });

  it('Toplam (30 gün) satırını isSummaryRow ile işaretler', () => {
    expect(isSummaryRow('Toplam (30 gün)')).toBe(true);
    expect(isSummaryRow('Total (30 days)')).toBe(true);
    expect(isSummaryRow('14 Eki\tdeepseek-v4.1-flash')).toBe(false);
  });
});

describe('Faz 22: sanitizeNumberString', () => {
  it('Türkçe binlik ayırıcıyı (nokta) doğru çözer', () => {
    expect(sanitizeNumberString('30.811.037')).toBe(30811037);
    expect(sanitizeNumberString('1.079')).toBe(1079);
    expect(sanitizeNumberString('2.378.273')).toBe(2378273);
  });

  it('İngilizce binlik ayırıcıyı (virgül) doğru çözer', () => {
    expect(sanitizeNumberString('30,811,037')).toBe(30811037);
  });

  it('tire ve boş metinlerde 0 döner', () => {
    expect(sanitizeNumberString('—')).toBe(0);
    expect(sanitizeNumberString('-')).toBe(0);
    expect(sanitizeNumberString('')).toBe(0);
    expect(sanitizeNumberString(null)).toBe(0);
    expect(sanitizeNumberString(undefined)).toBe(0);
  });

  it('kuruşlu ücret sütununu (0,00) 0 olarak okur', () => {
    expect(sanitizeNumberString('0,00')).toBe(0);
    expect(sanitizeNumberString('1,25')).toBe(1.25);
  });

  it('para sembolü ve yüzde işaretini yoksayar', () => {
    expect(sanitizeNumberString('$1.234,56')).toBe(1234.56);
    expect(sanitizeNumberString('341')).toBe(341);
  });
});

describe('Faz 23: parseCachedColumn', () => {
  it('"29.312.128 (%96)" hücresini token ve yüzdeye ayırır', () => {
    expect(parseCachedColumn('29.312.128 (%96)')).toEqual({
      cachedTokens: 29312128,
      reportedPercentage: 96,
    });
  });

  it('"23.488 (%6)" hücresini doğru ayrıştırır', () => {
    expect(parseCachedColumn('23.488 (%6)')).toEqual({
      cachedTokens: 23488,
      reportedPercentage: 6,
    });
  });

  it('İngilizce "96%" biçimini de destekler', () => {
    expect(parseCachedColumn('29,312,128 (96%)')).toEqual({
      cachedTokens: 29312128,
      reportedPercentage: 96,
    });
  });

  it('tire ve sıfır hücrelerinde 0/0 döner', () => {
    expect(parseCachedColumn('—')).toEqual({ cachedTokens: 0, reportedPercentage: 0 });
    expect(parseCachedColumn('0')).toEqual({ cachedTokens: 0, reportedPercentage: 0 });
  });
});

describe('Faz 24: detectColumnIndices', () => {
  it('Türkçe başlık satırındaki indeksleri doğru eşler', () => {
    const indices = detectColumnIndices([
      'Zaman dilimi',
      'Model',
      'İstek',
      'Toplam token',
      'Önbellekten',
      'Kotaya yansıyan',
      'Ücret ($)',
    ]);
    expect(indices).toEqual({
      date: 0,
      model: 1,
      requests: 2,
      totalTokens: 3,
      cachedTokens: 4,
      billedTokens: 5,
      cost: 6,
      hasHeader: true,
    });
  });

  it('başlıksız veri satırından yapısal çıkarım yapar ve satırı yutmaz', () => {
    const indices = detectColumnIndices([
      '14 Eki',
      'deepseek-v4.1-flash',
      '341',
      '30.811.037',
      '29.312.128 (%96)',
      '2.378.273',
      '0,00',
    ]);
    expect(indices).toEqual({
      date: 0,
      model: 1,
      requests: 2,
      totalTokens: 3,
      cachedTokens: 4,
      billedTokens: 5,
      cost: 6,
      hasHeader: false,
    });
  });

  it('İngilizce başlıkları da (Date/Model/Requests/Cost) tanır', () => {
    const indices = detectColumnIndices(['Date', 'Model', 'Requests', 'Total tokens', 'Cached', 'Cost ($)']);
    expect(indices.hasHeader).toBe(true);
    expect(indices.date).toBe(0);
    expect(indices.model).toBe(1);
    expect(indices.requests).toBe(2);
    expect(indices.totalTokens).toBe(3);
    expect(indices.cachedTokens).toBe(4);
    expect(indices.cost).toBe(5);
  });
});

// Kullanıcının 3 ekran görüntüsünden gelen 13 satırlık gerçekçi metin bloğu.
const TABLE_TEXT = [
  '14 Eki\tdeepseek-v4.1-flash\t341\t30.811.037\t29.312.128 (%96)\t2.378.273\t0,00',
  '14 Eki\tglm-5.3\t120\t8.450.123\t6.112.004 (%72)\t2.338.119\t0,00',
  '13 Eki\tdeepseek-v4.1-flash\t402\t35.120.998\t33.015.777 (%94)\t2.105.221\t0,00',
  '13 Eki\tmimo-v2.6-pro\t95\t4.882.310\t3.221.004 (%66)\t1.661.306\t0,00',
  '12 Eki\tdeepseek-v4.1-flash\t288\t21.004.552\t19.112.330 (%91)\t1.892.222\t0,00',
  '12 Eki\tglm-5.3\t76\t3.220.887\t2.004.112 (%62)\t1.216.775\t0,00',
  '11 Eki\tmimo-v2.6-pro\t54\t2.114.003\t1.400.221 (%66)\t713.782\t0,00',
  '11 Eki\tdeepseek-v4.1-flash\t310\t19.887.221\t18.552.110 (%93)\t1.335.111\t0,00',
  '10 Eki\tclef\t18\t945.221\t—\t945.221\t0,00',
  '10 Eki\tauto\t12\t510.004\t—\t510.004\t0,00',
  '9 Eki\tlaya\t7\t204.887\t—\t204.887\t0,00',
  '9 Eki\tqwen3-asr-1.7b\t5\t0\t0\t0\t0,00',
  '8 Eki\tqwen3-vl-30b\t22\t1.204.559\t880.334 (%73)\t324.225\t0,00',
  'Toplam (30 gün)\t1.750\t128.366.801\t115.427.062\t11.940.999\t0,00',
  '',
  'kullanım miktarını kartında görebilirsiniz.',
].join('\n');

describe('Faz 25: parsePastedTableText', () => {
  it('13 veri satırını çıkarır, Toplam satırını kayıtlara eklemez', () => {
    const result = parsePastedTableText(TABLE_TEXT);
    expect(result.records).toHaveLength(13);
    expect(result.records.some((record) => /toplam/i.test(record.model))).toBe(false);
    expect(result.parsedSummaryRow).not.toBeNull();
    expect(result.parsedSummaryRow.label).toContain('Toplam');
  });

  it('ilk satırın alanlarını doğru eşler', () => {
    const [first] = parsePastedTableText(TABLE_TEXT).records;
    expect(first).toMatchObject({
      date: '14 Eki',
      model: 'deepseek-v4.1-flash',
      requests: 341,
      totalTokens: 30811037,
      cachedTokens: 29312128,
      billedTokens: 2378273,
    });
  });

  it('boş satırları ve tablo dışı kırpıntı metni skippedLines içinde raporlar', () => {
    const result = parsePastedTableText(TABLE_TEXT);
    const reasons = result.skippedLines.map((entry) => entry.reason);
    expect(reasons).toContain('EMPTY_LINE');
    expect(reasons).toContain('UNRECOGNIZED_ROW');
    expect(result.skippedLines.some((entry) => entry.line.includes('kartında görebilirsiniz'))).toBe(true);
  });

  it('birebir aynı satırı iki kez saymaz (DUPLICATE_ROW)', () => {
    const duplicated = TABLE_TEXT.split('\n').slice(0, 2).concat(TABLE_TEXT.split('\n')[0]).join('\n');
    const result = parsePastedTableText(duplicated);
    expect(result.records).toHaveLength(2);
    expect(result.skippedLines.some((entry) => entry.reason === 'DUPLICATE_ROW')).toBe(true);
  });

  it('başlık satırı verilirse columnIndices doldurulur ve kayıtlar yine ayıklanır', () => {
    const withHeader = [
      'Zaman dilimi\tModel\tİstek\tToplam token\tÖnbellekten\tKotaya yansıyan\tÜcret ($)',
      ...TABLE_TEXT.split('\n').slice(0, 2),
    ].join('\n');
    const result = parsePastedTableText(withHeader);
    expect(result.columnIndices).not.toBeNull();
    expect(result.columnIndices.hasHeader).toBe(true);
    expect(result.columnIndices.model).toBe(1);
    expect(result.records).toHaveLength(2);
  });

  it('başlık satırındaki sütun eşlemesi veri satırlarına uygulanır (Toplam/Önbellek karışmaz)', () => {
    const withHeader = [
      'Tarih\tModel\tİstek\tToplam Token\tÖnbelleklenen\tKotaya Yansıyan',
      '14 Eki\tdeepseek-v4.1-flash\t2.984\t177.254.544 (%95)\t169.521.069\t7.733.475',
    ].join('\n');

    const [row] = parsePastedTableText(withHeader).records;
    expect(row).toMatchObject({
      date: '14 Eki',
      model: 'deepseek-v4.1-flash',
      requests: 2984,
      totalTokens: 177254544,
      cachedTokens: 169521069,
      billedTokens: 7733475,
    });
  });
});
