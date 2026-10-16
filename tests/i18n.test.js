// tests/i18n.test.js
// Faz 49: Çok dilli arayüz (i18n) çekirdeği testleri — TR/EN/DE/ZH/ES.
// KURAL: Bu katman saftır — DOM/window/localStorage/fetch yoktur; yalnızca veri + saf fonksiyon.
import { describe, it, expect, afterEach } from 'vitest';
import {
  DEFAULT_LANGUAGE,
  FALLBACK_LANGUAGE,
  GROUP_SEPARATORS,
  HTML_LANG,
  LANGUAGES,
  LANGUAGE_ALIASES,
  LANGUAGE_LABELS,
  LANGUAGE_STORAGE_KEY,
  MESSAGES,
  decimalSeparator,
  getLanguage,
  getMessages,
  groupSeparator,
  htmlLang,
  isSupportedLanguage,
  missingKeys,
  resolveLanguage,
  setLanguage,
  t,
  translate,
} from '../src/core/i18n.js';

/** Testler aktif dili değiştirdiği için her testten sonra varsayılana döner. */
afterEach(() => {
  setLanguage(DEFAULT_LANGUAGE);
});

describe('Faz 49: dil sabitleri', () => {
  it('beş dili sabit sırayla tanımlar ve varsayılan Türkçedir', () => {
    expect(LANGUAGES).toEqual(['tr', 'en', 'de', 'zh', 'es']);
    expect(DEFAULT_LANGUAGE).toBe('tr');
    expect(FALLBACK_LANGUAGE).toBe('tr');
    expect(Object.isFrozen(LANGUAGES)).toBe(true);
  });

  it('her dil için yerel etiket ve <html lang> karşılığı vardır', () => {
    for (const code of LANGUAGES) {
      expect(typeof LANGUAGE_LABELS[code]).toBe('string');
      expect(LANGUAGE_LABELS[code].length).toBeGreaterThan(1);
      expect(HTML_LANG[code]).toBeTruthy();
    }
    expect(LANGUAGE_LABELS.tr).toBe('Türkçe');
    expect(LANGUAGE_LABELS.zh).toBe('中文');
    expect(HTML_LANG.zh).toBe('zh-CN');
    expect(htmlLang('zh')).toBe('zh-CN');
    expect(htmlLang('es')).toBe('es');
  });

  it('dil tercihi anahtarı sabittir (localStorage sözleşmesi)', () => {
    expect(LANGUAGE_STORAGE_KEY).toBe('tokencost_language');
  });

  it('her dilin sözlüğü vardır ve dondurulmuştur', () => {
    for (const code of LANGUAGES) {
      expect(MESSAGES[code]).toBeTruthy();
      expect(Object.isFrozen(MESSAGES)).toBe(true);
    }
  });
});

describe('Faz 49: sözlük bütünlüğü', () => {
  it('tüm dillerde aynı anahtar kümesi bulunur (eksik çeviri yok)', () => {
    const base = Object.keys(getMessages('tr')).sort();
    expect(base.length).toBeGreaterThan(100);

    for (const code of LANGUAGES) {
      const keys = Object.keys(getMessages(code)).sort();
      expect(keys).toEqual(base);
      expect(missingKeys(code)).toEqual([]);
    }
  });

  it('her çeviri boş olmayan metindir ve yer tutucular dilde korunur', () => {
    const base = Object.keys(getMessages('tr'));
    const placeholders = (value) => (String(value).match(/\{\w+\}/g) || []).sort();

    for (const code of LANGUAGES) {
      const dict = getMessages(code);
      for (const key of base) {
        const value = dict[key];
        expect(typeof value, `${code}.${key}`).toBe('string');
        expect(value.trim().length, `${code}.${key}`).toBeGreaterThan(0);
        expect(placeholders(value), `${code}.${key}`).toEqual(placeholders(getMessages('tr')[key]));
      }
    }
  });

  it('kullanıcıya görünen metinler diller arasında farklılaşır', () => {
    expect(getMessages('tr')['btn.analyze']).toBe('Analiz Et');
    expect(getMessages('en')['btn.analyze']).toBe('Analyze');
    expect(getMessages('de')['btn.analyze']).toBe('Analysieren');
    expect(getMessages('zh')['btn.analyze']).toBe('分析');
    expect(getMessages('es')['btn.analyze']).toBe('Analizar');
    expect(getMessages('tr')['table.col.totalTokens']).toBe('Toplam Token');
    expect(getMessages('en')['table.col.totalTokens']).toBe('Total tokens');
  });
});

describe('Faz 49: resolveLanguage / isSupportedLanguage', () => {
  it('bilinen kodları ve takma adları çözer', () => {
    expect(resolveLanguage('tr')).toBe('tr');
    expect(resolveLanguage('EN')).toBe('en');
    expect(resolveLanguage(' english ')).toBe('en');
    expect(resolveLanguage('zh-CN')).toBe('zh');
    expect(resolveLanguage('de_DE')).toBe('de');
    expect(resolveLanguage('Español')).toBe('es');
    expect(LANGUAGE_ALIASES.english).toBe('en');
  });

  it('tanımsız/boş girdide varsayılana (Türkçe) düşer', () => {
    expect(resolveLanguage()).toBe('tr');
    expect(resolveLanguage(null)).toBe('tr');
    expect(resolveLanguage('')).toBe('tr');
    expect(resolveLanguage('klingon')).toBe('tr');
    expect(resolveLanguage('klingon', 'en')).toBe('en');
  });

  it('isSupportedLanguage takma adları geçerli sayar, çöpü reddeder', () => {
    expect(isSupportedLanguage('de')).toBe(true);
    expect(isSupportedLanguage('Deutsch')).toBe(true);
    expect(isSupportedLanguage('zh-cn')).toBe(true);
    expect(isSupportedLanguage('xx')).toBe(false);
    expect(isSupportedLanguage('')).toBe(false);
    expect(isSupportedLanguage(undefined)).toBe(false);
  });
});

describe('Faz 49: setLanguage / getLanguage / translate', () => {
  it('aktif dili ayarlar, tanımsız girdide Türkçeye döner', () => {
    expect(getLanguage()).toBe('tr');
    expect(setLanguage('en')).toBe('en');
    expect(getLanguage()).toBe('en');
    expect(setLanguage('de')).toBe('de');
    expect(setLanguage('klingon')).toBe('tr');
    expect(getLanguage()).toBe('tr');
  });

  it('t() aktif dilde çeviri döner', () => {
    expect(t('toast.success')).toBe('Başarılı');
    setLanguage('en');
    expect(t('toast.success')).toBe('Success');
    setLanguage('zh');
    expect(t('label.language')).toBe('语言');
  });

  it('translate() dil parametresiyle aktif dilden bağımsız çalışır', () => {
    setLanguage('es');
    expect(translate('btn.clear', 'tr')).toBe(getMessages('tr')['btn.clear']);
    expect(translate('btn.clear', 'en')).toBe(getMessages('en')['btn.clear']);
    expect(translate('btn.clear', 'DE')).toBe(getMessages('de')['btn.clear']);
  });

  it('{yerTutucu} değerlerini değiştirir, bilinmeyeni korur', () => {
    setLanguage('en');
    expect(t('msg.languageChanged', { language: 'English' })).toBe('Language changed: English');
    expect(t('card.pair', { primary: '$13.80', secondary: '₺503,70' })).toBe('$13.80 / ₺503,70');
    expect(t('msg.unitRows', {})).toBe('{count} rows');
    expect(t('msg.unitRows', { other: 5 })).toBe('{count} rows');
  });

  it('bilinmeyen anahtarda anahtarın kendisini döner (arayüz boş kalmaz)', () => {
    expect(t('yok.boyle.anahtar')).toBe('yok.boyle.anahtar');
    expect(translate('yok.boyle.anahtar', 'de')).toBe('yok.boyle.anahtar');
  });

  it('eksik çeviride Türkçe yedeğe düşer (sözlük kopyası üzerinden)', () => {
    const dict = getMessages('en');
    const backup = dict['btn.clear'];
    delete dict['btn.clear'];
    try {
      expect(translate('btn.clear', 'en')).toBe(getMessages('tr')['btn.clear']);
    } finally {
      dict['btn.clear'] = backup;
    }
  });

  it('getMessages() bilinmeyen dilde Türkçe sözlüğü döner', () => {
    expect(getMessages('xx')).toBe(getMessages('tr'));
  });
});

describe('Faz 49: sayı ayırıcıları', () => {
  it('dil başına binlik/ondalık ayırıcı doğru seçilir', () => {
    expect(groupSeparator('tr')).toBe('.');
    expect(groupSeparator('en')).toBe(',');
    expect(groupSeparator('de')).toBe('.');
    expect(groupSeparator('zh')).toBe(',');
    expect(groupSeparator('es')).toBe('.');
    expect(decimalSeparator('tr')).toBe(',');
    expect(decimalSeparator('en')).toBe('.');
    expect(GROUP_SEPARATORS.es).toBe('.');
  });

  it('ayırıcılar aktif dili izler, bilinmeyen dilde Türkçeye düşer', () => {
    setLanguage('en');
    expect(groupSeparator()).toBe(',');
    expect(decimalSeparator()).toBe('.');
    setLanguage('xx');
    expect(groupSeparator()).toBe('.');
    expect(decimalSeparator()).toBe(',');
  });
});
