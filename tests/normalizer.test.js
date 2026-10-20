// tests/normalizer.test.js
// Faz 11 - 14: Model normalizasyon, alias ve bulanık eşleme testleri.
import { describe, it, expect } from 'vitest';
import { normalizeModelName, extractModelIdentifiers } from '../src/core/normalizer.js';

describe('Faz 11: normalizeModelName', () => {
  it('boşlukları ve büyük/küçük harfi temizler', () => {
    expect(normalizeModelName('  DeepSeek-V4.1-Flash \n')).toBe('deepseek-v4.1-flash');
  });

  it('sağlayıcı önekini ayıklayıp baz adı döndürür', () => {
    expect(normalizeModelName('openai/gpt-4o-mini')).toBe('gpt-4o-mini');
    expect(normalizeModelName('zhipu/glm-5.3')).toBe('glm-5.3');
  });

  it('extractModelIdentifiers hem tam adı hem baz adı verir', () => {
    expect(extractModelIdentifiers('zhipu/glm-5.3')).toEqual({
      full: 'zhipu/glm-5.3',
      provider: 'zhipu',
      base: 'glm-5.3',
    });
  });

  it('etiket son eklerini (:free, :beta, -latest) temizler', () => {
    expect(normalizeModelName('deepseek-v4.1-flash:free')).toBe('deepseek-v4.1-flash');
    expect(normalizeModelName('deepseek-v4.1-flash:beta')).toBe('deepseek-v4.1-flash');
    expect(normalizeModelName('deepseek-chat-latest')).toBe('deepseek-chat');
  });

  it('versiyon/boyut numaralarını KORUR', () => {
    expect(normalizeModelName('Qwen3-VL-30B')).toBe('qwen3-vl-30b');
    expect(normalizeModelName('Qwen3-ASR-1.7B')).toBe('qwen3-asr-1.7b');
    expect(normalizeModelName('glm-5.3')).toBe('glm-5.3');
  });

  it('geçersiz girdide boş string döndürür', () => {
    expect(normalizeModelName(null)).toBe('');
    expect(normalizeModelName('   ')).toBe('');
  });
});
