import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useI18n } from '../i18n/I18nProvider';
import type { Language } from '../i18n/translations';

type LanguageSelectorProps = {
  value: Language;
  onSelect: (language: Language) => void | Promise<void>;
  disabled?: boolean;
  compact?: boolean;
};

const LANGUAGE_ORDER: Language[] = ['es', 'en', 'fr', 'pt'];

const LanguageSelector = ({ value, onSelect, disabled = false, compact = false }: LanguageSelectorProps) => {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  const options = useMemo(
    () => [
      { code: 'es' as Language, label: t('language.spanish'), shortLabel: 'ES' },
      { code: 'en' as Language, label: t('language.english'), shortLabel: 'EN' },
      { code: 'fr' as Language, label: t('language.french'), shortLabel: 'FR' },
      { code: 'pt' as Language, label: t('language.portuguese'), shortLabel: 'PT' },
    ],
    [t],
  );

  const selected = options.find((option) => option.code === value) || options[0];
  const hiddenOptions = LANGUAGE_ORDER
    .filter((code) => code !== value)
    .map((code) => options.find((option) => option.code === code))
    .filter((option): option is (typeof options)[number] => !!option);

  const handlePress = async (language: Language) => {
    setOpen(false);
    if (language === value) {
      return;
    }
    await onSelect(language);
  };

  return (
    <View style={[styles.root, compact && styles.rootCompact]}>
      <TouchableOpacity
        activeOpacity={0.85}
        disabled={disabled}
        onPress={() => setOpen((prev) => !prev)}
        style={[styles.trigger, compact && styles.triggerCompact, disabled && styles.disabled]}
      >
        <View style={styles.triggerTextBlock}>
          <Text style={[styles.triggerShortCode, compact && styles.triggerShortCodeCompact]}>{selected.shortLabel}</Text>
          <Text style={[styles.triggerLabel, compact && styles.triggerLabelCompact]} numberOfLines={1}>{selected.label}</Text>
        </View>
        <MaterialIcons name={open ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={compact ? 18 : 20} color="#FFB74D" />
      </TouchableOpacity>

      {open ? (
        <View style={[styles.menu, compact && styles.menuCompact]}>
          {hiddenOptions.map((option, index) => (
            <TouchableOpacity
              key={option.code}
              activeOpacity={0.85}
              disabled={disabled}
              onPress={() => void handlePress(option.code)}
              style={[styles.option, index === hiddenOptions.length - 1 && styles.optionLast]}
            >
              <Text style={styles.optionShortCode}>{option.shortLabel}</Text>
              <Text style={styles.optionLabel}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    minWidth: 154,
    position: 'relative',
  },
  rootCompact: {
    minWidth: 132,
  },
  trigger: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#111111',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  triggerCompact: {
    minHeight: 40,
    borderRadius: 14,
    paddingVertical: 8,
  },
  triggerTextBlock: {
    flexShrink: 1,
  },
  triggerShortCode: {
    color: '#FFB74D',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  triggerShortCodeCompact: {
    fontSize: 10,
  },
  triggerLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  triggerLabelCompact: {
    fontSize: 12,
  },
  menu: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A2A',
    backgroundColor: '#0B0B0B',
    overflow: 'hidden',
  },
  menuCompact: {
    borderRadius: 14,
  },
  option: {
    paddingHorizontal: 12,
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: '#1E1E1E',
  },
  optionLast: {
    borderBottomWidth: 0,
  },
  optionShortCode: {
    color: '#8C8C8C',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  optionLabel: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  disabled: {
    opacity: 0.6,
  },
});

export default LanguageSelector;