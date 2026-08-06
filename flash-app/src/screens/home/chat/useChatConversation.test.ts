import { describe, expect, it } from 'vitest';
import { stripTags } from './useChatConversation';

describe('stripTags', () => {
  it('turns <br> into a real newline so the model sees the paragraph break', () => {
    expect(stripTags('第一句<br><br>第二句')).toBe('第一句\n\n第二句');
    expect(stripTags('a<br/>b')).toBe('a\nb');
    expect(stripTags('a<BR />b')).toBe('a\nb');
  });

  it('drops the emphasis markup the scripted copy carries', () => {
    expect(stripTags('你卡住的是<b>两难</b>')).toBe('你卡住的是两难');
  });

  it('leaves plain copy untouched', () => {
    expect(stripTags('没有任何标签')).toBe('没有任何标签');
  });

  it('trims surrounding whitespace', () => {
    expect(stripTags('  <b>x</b>  ')).toBe('x');
  });

  it('strips anything tag-shaped, so no markup can reach the model as markup', () => {
    expect(stripTags('<script>alert(1)</script>安全')).toBe('alert(1)安全');
    expect(stripTags('<img src=x onerror=y>文字')).toBe('文字');
  });
});
