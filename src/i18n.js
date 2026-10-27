/**
 * English and Turkish UI strings. English is the default language; a key missing
 * in Turkish falls back to English. Placeholders look like {name}.
 * @module i18n
 */

/** Supported languages; the first one is the default. */
export const LANGUAGES = Object.freeze(['en', 'tr']);

const EN = {
  'app.title': 'Color Palette Generator',
  'action.generate': 'Generate',
  'action.generateHint': 'Press Space for a new palette',
  'action.undo': 'Undo',
  'controls.label': 'Palette settings',
  'tools.label': 'Tools',
  'tools.contrast': 'Contrast',
  'tools.saved': 'Saved',
  'swatches.label': 'Palette',
  'swatch.label': 'Color {index}: {name}',
  'swatch.faceLabel': 'Edit color {index}: {hex}, {name}',
  'swatch.lock': 'Lock color',
  'swatch.unlock': 'Unlock color',
  'swatch.edit': 'Edit color',
  'swatch.drag': 'Drag or use the arrow keys to reorder',
  'swatch.copy': 'Copy HEX',
  'swatch.copied': '{hex} copied',
  'swatch.shades': 'Show shades',
  'harmony.label': 'Harmony',
  'harmony.analogous': 'Analogous',
  'harmony.complementary': 'Complementary',
  'harmony.split-complementary': 'Split complementary',
  'harmony.triadic': 'Triadic',
  'harmony.tetradic': 'Tetradic',
  'harmony.monochromatic': 'Monochromatic',
  'harmony.random': 'Random harmonious',
  'base.label': 'Base color',
  'base.placeholder': 'Auto, or e.g. #3b82f6',
  'base.clear': 'Clear base color',
  'count.label': 'Colors',
  'count.decrease': 'Fewer colors',
  'count.increase': 'More colors',
  'picker.title': 'Edit color',
  'picker.input': 'HEX, RGB, HSL, HSV or OKLCH',
  'picker.invalid': 'Not a valid color',
  'picker.space': 'Color space',
  'picker.hue': 'Hue',
  'picker.saturation': 'Saturation',
  'picker.lightness': 'Lightness',
  'picker.chroma': 'Chroma',
  'picker.gamut': 'Outside sRGB, so the chroma is reduced to fit',
  'picker.notations': 'Notations',
  'picker.copyHint': 'Click a value to copy it',
  'notation.hex': 'HEX',
  'notation.rgb': 'RGB',
  'notation.hsl': 'HSL',
  'notation.hsv': 'HSV',
  'notation.oklch': 'OKLCH',
  'contrast.title': 'Contrast checker',
  'contrast.foreground': 'Text',
  'contrast.background': 'Background',
  'contrast.swap': 'Swap colors',
  'contrast.ratio': 'Contrast ratio',
  'contrast.pair': '{fg} on {bg}',
  'contrast.level': 'Level',
  'contrast.aa': 'AA',
  'contrast.aaa': 'AAA',
  'contrast.normalText': 'Normal text',
  'contrast.largeText': 'Large text',
  'contrast.pass': 'Pass',
  'contrast.fail': 'Fail',
  'contrast.sampleShort': 'Aa',
  'contrast.sample': 'The quick brown fox jumps over the lazy dog',
  'contrast.white': 'White',
  'contrast.black': 'Black',
  'shades.title': 'Shade scale',
  'shades.hint': 'Click a shade to copy its HEX',
  'shades.base': 'Base',
  'export.title': 'Export',
  'export.formats': 'Format',
  'export.tab.css': 'CSS',
  'export.tab.json': 'JSON',
  'export.tab.tailwind': 'Tailwind',
  'export.tab.svg': 'SVG',
  'export.css': 'Copy CSS',
  'export.json': 'Copy JSON',
  'export.tailwind': 'Copy Tailwind',
  'export.svg': 'Download SVG',
  'export.previewAlt': 'Preview of the SVG swatch strip',
  'export.copied': 'Copied to clipboard',
  'export.downloaded': 'palette.svg downloaded',
  'copy.failed': 'Copying failed. Select the text and copy it yourself.',
  'share.button': 'Share',
  'share.copied': 'Link copied',
  'saved.title': 'Saved palettes',
  'saved.save': 'Save palette',
  'saved.saved': 'Palette saved',
  'saved.notStored': 'Saved for this visit only: browser storage is unavailable',
  'saved.empty': 'No saved palettes yet',
  'saved.loadLabel': 'Load palette {colors}',
  'saved.loaded': 'Palette loaded',
  'saved.delete': 'Delete palette',
  'saved.meta': '{count} colors · {date}',
  'dialog.close': 'Close',
  'lang.toggle': 'TR',
  'lang.toggleLabel': 'TR – switch to Turkish',
  'footer.license': 'MIT',
  'footer.source': 'Source on GitHub',
};

const TR = {
  'app.title': 'Renk Paleti Oluşturucu',
  'action.generate': 'Oluştur',
  'action.generateHint': 'Yeni palet için Boşluk tuşuna basın',
  'action.undo': 'Geri al',
  'controls.label': 'Palet ayarları',
  'tools.label': 'Araçlar',
  'tools.contrast': 'Kontrast',
  'tools.saved': 'Kayıtlı',
  'swatches.label': 'Palet',
  'swatch.label': '{index}. renk: {name}',
  'swatch.faceLabel': '{index}. rengi düzenle: {hex}, {name}',
  'swatch.lock': 'Rengi kilitle',
  'swatch.unlock': 'Kilidi aç',
  'swatch.edit': 'Rengi düzenle',
  'swatch.drag': 'Sıralamak için sürükleyin ya da ok tuşlarını kullanın',
  'swatch.copy': 'HEX kodunu kopyala',
  'swatch.copied': '{hex} kopyalandı',
  'swatch.shades': 'Tonları göster',
  'harmony.label': 'Uyum',
  'harmony.analogous': 'Analog',
  'harmony.complementary': 'Tamamlayıcı',
  'harmony.split-complementary': 'Bölünmüş tamamlayıcı',
  'harmony.triadic': 'Üçlü',
  'harmony.tetradic': 'Dörtlü',
  'harmony.monochromatic': 'Monokromatik',
  'harmony.random': 'Rastgele uyumlu',
  'base.label': 'Ana renk',
  'base.placeholder': 'Otomatik ya da örn. #3b82f6',
  'base.clear': 'Ana rengi temizle',
  'count.label': 'Renk sayısı',
  'count.decrease': 'Daha az renk',
  'count.increase': 'Daha fazla renk',
  'picker.title': 'Rengi düzenle',
  'picker.input': 'HEX, RGB, HSL, HSV veya OKLCH',
  'picker.invalid': 'Geçerli bir renk değil',
  'picker.space': 'Renk uzayı',
  'picker.hue': 'Ton',
  'picker.saturation': 'Doygunluk',
  'picker.lightness': 'Açıklık',
  'picker.chroma': 'Kroma',
  'picker.gamut': 'sRGB dışında, bu yüzden kroma sığacak kadar azaltıldı',
  'picker.notations': 'Gösterimler',
  'picker.copyHint': 'Kopyalamak için bir değere tıklayın',
  'notation.hex': 'HEX',
  'notation.rgb': 'RGB',
  'notation.hsl': 'HSL',
  'notation.hsv': 'HSV',
  'notation.oklch': 'OKLCH',
  'contrast.title': 'Kontrast denetimi',
  'contrast.foreground': 'Metin',
  'contrast.background': 'Arka plan',
  'contrast.swap': 'Renkleri değiştir',
  'contrast.ratio': 'Kontrast oranı',
  'contrast.pair': '{bg} üzerinde {fg}',
  'contrast.level': 'Düzey',
  'contrast.aa': 'AA',
  'contrast.aaa': 'AAA',
  'contrast.normalText': 'Normal metin',
  'contrast.largeText': 'Büyük metin',
  'contrast.pass': 'Geçti',
  'contrast.fail': 'Kaldı',
  'contrast.sampleShort': 'Aa',
  'contrast.sample': 'Pijamalı hasta yağız şoföre çabucak güvendi',
  'contrast.white': 'Beyaz',
  'contrast.black': 'Siyah',
  'shades.title': 'Ton skalası',
  'shades.hint': 'HEX kodunu kopyalamak için bir tona tıklayın',
  'shades.base': 'Ana',
  'export.title': 'Dışa aktar',
  'export.formats': 'Biçim',
  'export.tab.css': 'CSS',
  'export.tab.json': 'JSON',
  'export.tab.tailwind': 'Tailwind',
  'export.tab.svg': 'SVG',
  'export.css': 'CSS kopyala',
  'export.json': 'JSON kopyala',
  'export.tailwind': 'Tailwind kopyala',
  'export.svg': 'SVG indir',
  'export.previewAlt': 'SVG renk şeridinin önizlemesi',
  'export.copied': 'Panoya kopyalandı',
  'export.downloaded': 'palette.svg indirildi',
  'copy.failed': 'Kopyalanamadı. Metni seçip kendiniz kopyalayın.',
  'share.button': 'Paylaş',
  'share.copied': 'Bağlantı kopyalandı',
  'saved.title': 'Kayıtlı paletler',
  'saved.save': 'Paleti kaydet',
  'saved.saved': 'Palet kaydedildi',
  'saved.notStored': 'Yalnızca bu ziyaret için kaydedildi: tarayıcı depolaması kullanılamıyor',
  'saved.empty': 'Henüz kayıtlı palet yok',
  'saved.loadLabel': '{colors} paletini yükle',
  'saved.loaded': 'Palet yüklendi',
  'saved.delete': 'Paleti sil',
  'saved.meta': '{count} renk · {date}',
  'dialog.close': 'Kapat',
  'lang.toggle': 'EN',
  'lang.toggleLabel': 'EN – İngilizceye geç',
  'footer.license': 'MIT',
  'footer.source': "Kaynak kodu GitHub'da",
};

/** All strings by language. */
export const STRINGS = Object.freeze({ en: Object.freeze(EN), tr: Object.freeze(TR) });

/**
 * Turns any stored value into a supported language code ('en' by default).
 * @param {unknown} value
 * @returns {'en'|'tr'}
 */
export function normalizeLanguage(value) {
  return LANGUAGES.includes(value) ? value : LANGUAGES[0];
}

/**
 * The language the TR/EN toggle switches to.
 * @param {string} language
 * @returns {'en'|'tr'}
 */
export function otherLanguage(language) {
  return normalizeLanguage(language) === 'en' ? 'tr' : 'en';
}

/**
 * Looks up a UI string and fills its {placeholders}.
 * @param {string} language 'en' or 'tr'
 * @param {string} key e.g. 'action.generate'
 * @param {Record<string, string|number>} [params]
 * @returns {string} the English text when the key is missing in Turkish, the key itself when unknown
 */
export function translate(language, key, params = {}) {
  return lookup(normalizeLanguage(language), key).replace(/\{(\w+)\}/g, (placeholder, name) =>
    Object.hasOwn(params, name) ? String(params[name]) : placeholder,
  );
}

function lookup(language, key) {
  if (Object.hasOwn(STRINGS[language], key)) return STRINGS[language][key];
  return Object.hasOwn(STRINGS.en, key) ? STRINGS.en[key] : String(key);
}
