// tests/parser.test.js
// Faz 21 - 25: Metin / tablo ayrıştırıcı testleri.
import { describe, it, expect } from 'vitest';
import { tokenizeRawLine, isSummaryRow } from '../src/core/parser.js';

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
