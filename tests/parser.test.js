// tests/parser.test.js
// Faz 21 - 25: Metin / tablo ayrıştırıcı testleri.
import { describe, it, expect } from 'vitest';
import { tokenizeRawLine, isSummaryRow } from '../src/core/parser.js';
import { sanitizeNumberString } from '../src/core/parser.js';
import { parseCachedColumn } from '../src/core/parser.js';
import { detectColumnIndices } from '../src/core/parser.js';

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
