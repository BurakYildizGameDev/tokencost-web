// tests/normalizer.test.js
// Faz 11 - 14: Model normalizasyon, alias ve bulanık eşleme testleri.
import { describe, it, expect } from 'vitest';
import { normalizeModelName, extractModelIdentifiers } from '../src/core/normalizer.js';
import { resolveModelAlias, DEFAULT_MODEL_ALIASES } from '../src/core/normalizer.js';

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

describe('Faz 12: resolveModelAlias', () => {
  it('yerleşik alias sözlüğü kullanıcı konsol modellerini eşler', () => {
    expect(resolveModelAlias('deepseek-v4.1-flash')).toBe('deepseek-chat');
    expect(resolveModelAlias('deepseek-v4-flash')).toBe('deepseek-chat');
    expect(resolveModelAlias('glm-5.3')).toBe('glm-4-plus');
    expect(resolveModelAlias('mimo-v2.6-pro')).toBe('mimo-v2.6-pro');
    expect(resolveModelAlias('qwen3-vl-30b')).toBe('qwen-vl-max');
    expect(resolveModelAlias('qwen3-embedding-8b')).toBe('qwen-text-embedding');
    expect(resolveModelAlias('qwen3-asr-1.7b')).toBe('qwen-audio-asr');
  });

  it('7 zorunlu model adı varsayılan sözlükte bulunur', () => {
    const required = [
      'deepseek-v4.1-flash',
      'deepseek-v4-flash',
      'glm-5.3',
      'mimo-v2.6-pro',
      'qwen3-vl-30b',
      'qwen3-embedding-8b',
      'qwen3-asr-1.7b',
    ];
    for (const key of required) {
      expect(Object.prototype.hasOwnProperty.call(DEFAULT_MODEL_ALIASES, key)).toBe(true);
    }
  });

  it('customAliases varsayılan sözlüğü ezer', () => {
    expect(resolveModelAlias('glm-5.3', { 'glm-5.3': 'zhipu-glm-5.3' })).toBe('zhipu-glm-5.3');
  });

  it('alias yoksa normalize adı aynen döner', () => {
    expect(resolveModelAlias('some-unknown-model')).toBe('some-unknown-model');
  });
});
