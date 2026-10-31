// tests/parser.test.js
// Faz 21 - 25: Metin / tablo ayrıştırıcı testleri.
import { describe, it, expect } from 'vitest';
import { tokenizeRawLine, isSummaryRow } from '../src/core/parser.js';
import { sanitizeNumberString } from '../src/core/parser.js';

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
