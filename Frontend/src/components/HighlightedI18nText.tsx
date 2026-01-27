import React, { useMemo } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useI18n } from '../i18n/I18nProvider';
import { type TranslationKey } from '../i18n/translations';

type Segment = { text: string; kind: 'normal' | 'highlight' };

const parseMarkedText = (raw: string): Segment[] => {
  const value = String(raw ?? '');
  if (!value) return [{ text: '', kind: 'normal' }];

  const segments: Segment[] = [];
  const re = /\[\[(.+?)\]\]/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = re.exec(value))) {
    const start = match.index;
    const full = match[0] || '';
    const inner = match[1] || '';

    if (start > lastIndex) {
      segments.push({ text: value.slice(lastIndex, start), kind: 'normal' });
    }

    if (inner) {
      segments.push({ text: inner, kind: 'highlight' });
    }

    lastIndex = start + full.length;
  }

  if (lastIndex < value.length) {
    segments.push({ text: value.slice(lastIndex), kind: 'normal' });
  }

  if (segments.length === 0) {
    return [{ text: value, kind: 'normal' }];
  }

  return segments;
};

type HighlightedI18nTextProps = {
  i18nKey: TranslationKey;
  style?: StyleProp<TextStyle>;
  mutedStyle?: StyleProp<TextStyle>;
  highlightStyle?: StyleProp<TextStyle>;
};

const HighlightedI18nText = ({ i18nKey, style, mutedStyle, highlightStyle }: HighlightedI18nTextProps) => {
  const { t } = useI18n();

  const raw = String(t(i18nKey) || '');
  const segments = useMemo(() => parseMarkedText(raw), [raw]);

  const normal = mutedStyle ?? style;
  const highlight = highlightStyle ?? style;

  return (
    <Text style={style}>
      {segments.map((seg, idx) => (
        <Text key={`${i18nKey}:${idx}`} style={seg.kind === 'highlight' ? highlight : normal}>
          {seg.text}
        </Text>
      ))}
    </Text>
  );
};

export default HighlightedI18nText;
