import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ImageCropPicker from 'react-native-image-crop-picker';

import { useI18n } from '../i18n/I18nProvider';
import type { TranslationKey } from '../i18n/translations';

type AspectRatioValue = '3:4';

interface CarouselImageEditorProps {
  imageUri: string;
  onBack: () => void;
  onSave: () => Promise<void> | void;
  currentIndex?: number;
  totalImages?: number;
  thumbnails?: string[];
  onSelectImage?: (index: number) => void;
  onTempSave?: (index: number, croppedImage: CroppedImageResult) => void;
  activeImageIndex?: number | null;
  initialAspectRatio?: AspectRatioValue;
  onAddImage?: () => void;
  allowAddMore?: boolean;
  onRemoveImage?: (index: number) => void;
}

interface CroppedImageResult {
  uri: string;
  width: number;
  height: number;
  mime?: string | null;
  aspectRatio: AspectRatioValue;
}

const PREVIEW_MAX_WIDTH = Dimensions.get('window').width;
const ASPECT_RATIO_PRESETS: Record<AspectRatioValue, { label: string; width: number; height: number; ratio: number }> = {
  '3:4': { label: '3:4', width: 900, height: 1200, ratio: 3 / 4 },
};

const ANDROID_TOP_INSET = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;

const CarouselImageEditor = ({
  imageUri,
  onBack,
  onSave,
  currentIndex = 0,
  totalImages = 1,
  thumbnails = [],
  onSelectImage,
  onTempSave,
  activeImageIndex = null,
  initialAspectRatio = '3:4',
  onAddImage,
  allowAddMore = false,
  onRemoveImage,
}: CarouselImageEditorProps) => {
  const { t } = useI18n();
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewPath, setPreviewPath] = useState(imageUri);
  const [selectedRatio, setSelectedRatio] = useState<AspectRatioValue>(initialAspectRatio);
  const [previewAspectRatio, setPreviewAspectRatio] = useState<AspectRatioValue>(initialAspectRatio);

  const formatTemplate = useCallback((template: string, params: Record<string, string | number>) => {
    return Object.entries(params).reduce((acc, [key, value]) => {
      return acc.split(`{${key}}`).join(String(value));
    }, template);
  }, []);

  const toDisplayUri = useCallback((path: string) => {
    if (!path) {
      return '';
    }

    return path.startsWith('file://') ? path : `file://${path}`;
  }, []);

  const openNativeCropper = useCallback(async (sourcePath?: string) => {

    try {
      const basePath = sourcePath ?? imageUri;
      const ratioConfig = ASPECT_RATIO_PRESETS[selectedRatio];

      let sanitizedPath = basePath;

      if (sanitizedPath.startsWith('file://')) {
        sanitizedPath = sanitizedPath.replace('file://', '');
      }

      if (!basePath.startsWith('content://') && !basePath.startsWith('/')) {
        sanitizedPath = basePath;
      }

      const result = await ImageCropPicker.openCropper({
        path: sanitizedPath,
        mediaType: 'photo',
        cropping: true,
        cropperCircleOverlay: false, // Recorte cuadrado, no circular
        avoidEmptySpaceAroundImage: true,
        width: ratioConfig.width,
        height: ratioConfig.height,
        // Algo menos de calidad reduce mucho el tamaño final sin pérdida apreciable.
        compressImageQuality: 0.85,
        forceJpg: true,
        includeBase64: false,
        writeTempFile: true,
        cropperToolbarTitle: t('carouselEditor.adjustImage' as TranslationKey),
        cropperToolbarColor: '#1a1a1a',
        cropperToolbarWidgetColor: '#FFFFFF',
        cropperActiveWidgetColor: '#FFB74D',
        loadingLabelText: t('carouselEditor.processing' as TranslationKey),
        cropperCancelText: t('common.cancel' as TranslationKey),
        cropperChooseText: t('common.confirm' as TranslationKey),
        cropperRotateButtonsHidden: false,
        cropperChooseColor: '#FFB74D',
        cropperCancelColor: '#FFFFFF',
        hideBottomControls: false,
        enableRotationGesture: true,
        freeStyleCropEnabled: false,
      });

      if (result?.path) {
        setPreviewPath(result.path);
        setPreviewAspectRatio(selectedRatio);
        const formatted: CroppedImageResult = {
          uri: toDisplayUri(result.path),
          width: result.width ?? 0,
          height: result.height ?? 0,
          mime: result.mime,
          aspectRatio: selectedRatio,
        };

        if (typeof activeImageIndex === 'number' && onTempSave) {
          onTempSave(activeImageIndex, formatted);
        }
      }
    } catch (error) {
      const cropError = error as { code?: string; message?: string };

      if (cropError?.code === 'E_PICKER_CANCELLED') {
        // Usuario canceló el recorte, no hacemos nada para mantenernos en el editor
        console.log('Recorte cancelado por el usuario');
      } else {
        console.error('Error al recortar imagen:', error);
        Alert.alert(
          t('carouselEditor.errorTitle' as TranslationKey),
          t('carouselEditor.cropErrorBody' as TranslationKey),
          [
            {
              text: t('carouselEditor.ok' as TranslationKey),
              onPress: onBack,
            },
          ]
        );
      }
    }
  }, [activeImageIndex, imageUri, onBack, onTempSave, selectedRatio, t, toDisplayUri]);

  useEffect(() => {
    setPreviewPath(imageUri);
  }, [imageUri]);

  useEffect(() => {
    setSelectedRatio(initialAspectRatio);
    setPreviewAspectRatio(initialAspectRatio);
  }, [initialAspectRatio]);

  useEffect(() => {
    return () => {
      ImageCropPicker.clean().catch(() => undefined);
    };
  }, []);

  const handleApply = useCallback(async () => {
    try {
      setIsProcessing(true);

      await Promise.resolve(onSave());
    } finally {
      setIsProcessing(false);
    }
  }, [onSave]);

  const handleRecrop = useCallback(() => {
    const nextPath = previewPath ?? imageUri;
    openNativeCropper(nextPath);
  }, [imageUri, openNativeCropper, previewPath]);

  const previewUri = useMemo(() => {
    return previewPath ? toDisplayUri(previewPath) : '';
  }, [previewPath, toDisplayUri]);

  const previewFrameStyle = useMemo(() => {
    const aspect = ASPECT_RATIO_PRESETS[previewAspectRatio].ratio;
    const width = PREVIEW_MAX_WIDTH;
    const height = width / aspect;
    return [styles.previewFrame, { width, height }];
  }, [previewAspectRatio]);

  const headerTitle = useMemo(() => {
    if (totalImages > 1) {
      const template = t('carouselEditor.imageCount' as TranslationKey);
      return formatTemplate(template, { current: currentIndex + 1, total: totalImages });
    }

    return t('carouselEditor.adjustImage' as TranslationKey);
  }, [currentIndex, formatTemplate, t, totalImages]);

  const handleThumbnailPress = useCallback((index: number) => {
    if (!onSelectImage) {
      return;
    }
    onSelectImage(index);
  }, [onSelectImage]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={'#000000'} barStyle={'light-content'} translucent={false} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={onBack} activeOpacity={0.7}>
          <Icon name={'arrow-back'} size={22} color={'#FFFFFF'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{headerTitle}</Text>
        <TouchableOpacity
          style={[styles.headerButton, isProcessing && styles.headerButtonDisabled]}
          onPress={handleApply}
          activeOpacity={!isProcessing ? 0.7 : 1}
          disabled={isProcessing}>
          {isProcessing ? (
            <ActivityIndicator size={'small'} color={'#FFB74D'} />
          ) : (
            <Icon name={'check'} size={22} color={'#FFB74D'} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.previewContainer}>
        <ScrollView
          style={styles.previewScroll}
          contentContainerStyle={styles.previewScrollContent}
          showsVerticalScrollIndicator={false}>
          <View style={styles.previewFrameWrapper}>
            <View style={previewFrameStyle}>
              {previewUri !== '' ? (
                <Image source={{ uri: previewUri }} style={styles.previewImage} resizeMode={'cover'} />
              ) : (
                <View style={styles.previewPlaceholder}>
                  <Text style={styles.previewPlaceholderText}>{t('carouselEditor.noPreview' as TranslationKey)}</Text>
                </View>
              )}
            </View>
          </View>
          <View style={styles.previewControls}>
            <TouchableOpacity style={styles.recropButton} onPress={handleRecrop} activeOpacity={0.7}>
              <Icon name={'edit'} size={18} color={'#000000'} />
              <Text style={styles.recropText}>{t('carouselEditor.editImage' as TranslationKey)}</Text>
            </TouchableOpacity>
            {thumbnails.length > 0 && (
              <View style={styles.thumbnailStrip}>
                {thumbnails.map((thumbUri, index) => (
                  <TouchableOpacity
                    key={`${thumbUri}-${index}`}
                    style={[
                      styles.thumbnailItem,
                      index === currentIndex && styles.thumbnailItemActive,
                    ]}
                    onPress={() => handleThumbnailPress(index)}
                    activeOpacity={0.8}
                    disabled={!onSelectImage}>
                    {thumbUri ? (
                      <Image source={{ uri: thumbUri }} style={styles.thumbnailImage} resizeMode={'cover'} />
                    ) : (
                      <View style={styles.thumbnailPlaceholder}>
                        <Text style={styles.thumbnailPlaceholderText}>{index + 1}</Text>
                      </View>
                    )}
                    {onRemoveImage && (
                      <TouchableOpacity
                        style={styles.deleteThumbnailButton}
                        onPress={() => onRemoveImage(index)}
                        activeOpacity={0.7}>
                        <Icon name="delete" size={14} color="#FFFFFF" />
                      </TouchableOpacity>
                    )}
                  </TouchableOpacity>
                ))}
                {allowAddMore && onAddImage && (
                  <TouchableOpacity
                    style={styles.addMoreButton}
                    onPress={onAddImage}
                    activeOpacity={0.7}>
                    <Icon name="add" size={32} color="#FFFFFF" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0a0a', paddingTop: ANDROID_TOP_INSET },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1a1a1a',
    borderBottomWidth: 0,
  },
  headerButton: {
    padding: 8,
    borderRadius: 24,
    backgroundColor: '#2a2a2a',
  },
  headerButtonDisabled: {
    opacity: 0.3,
    backgroundColor: '#2a2a2a',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  previewContainer: {
    flex: 1,
    width: '100%',
  },
  previewScroll: {
    width: '100%',
  },
  previewScrollContent: {
    paddingBottom: 48,
  },
  previewFrameWrapper: {
    width: '100%',
    backgroundColor: '#000000',
  },
  previewControls: {
    width: '100%',
    paddingHorizontal: 24,
    paddingTop: 24,
    alignItems: 'center',
  },
  previewFrame: {
    borderRadius: 0,
    borderWidth: 0,
    backgroundColor: '#000000',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  previewPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  previewPlaceholderText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  recropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 10,
    backgroundColor: '#FFB74D',
    borderWidth: 0,
    shadowColor: '#FFB74D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  recropText: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '700',
    marginLeft: 8,
    letterSpacing: 0.3,
  },
  thumbnailStrip: {
    flexDirection: 'row',
    marginTop: 24,
    gap: 12,
  },
  thumbnailItem: {
    width: 64,
    height: 64,
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: '#1f1f1f',
  },
  thumbnailItemActive: {
    borderColor: '#FFB74D',
    shadowColor: '#FFB74D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 6,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  thumbnailPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2d2d2d',
  },
  thumbnailPlaceholderText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  addMoreButton: {
    width: 64,
    height: 64,
    borderRadius: 14,
    backgroundColor: '#1f1f1f',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#333',
  },
  deleteThumbnailButton: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(255, 183, 77, 0.19)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    zIndex: 10,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
});

export default CarouselImageEditor;
