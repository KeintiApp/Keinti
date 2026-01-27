import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
  InteractionManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ImageCropPicker, {ImageOrVideo} from 'react-native-image-crop-picker';

interface ProfilePhotoEditProps {
  imageUri: string;
  onBack: () => void;
  onSave: (croppedImage: CroppedImageResult) => Promise<void> | void;
}

interface CroppedImageResult {
  uri: string;
  width: number;
  height: number;
  mime?: string | null;
}

const PREVIEW_SIZE = 260;

const ProfilePhotoEdit = ({imageUri, onBack, onSave}: ProfilePhotoEditProps) => {
  const [croppedImage, setCroppedImage] = useState<ImageOrVideo | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [_isLoadingCropper, setIsLoadingCropper] = useState(true);

  const toDisplayUri = useCallback((path: string) => {
    if (!path) {
      return '';
    }

    return path.startsWith('file://') ? path : `file://${path}`;
  }, []);

  const openNativeCropper = useCallback(async (sourcePath?: string) => {
    setIsLoadingCropper(true);
    setCroppedImage(null); // Resetear la imagen recortada al abrir el cropper

    try {
      const basePath = sourcePath ?? imageUri;

      // Normalizar la ruta
      let sanitizedPath = basePath;

      // Eliminar el prefijo file:// si existe
      if (sanitizedPath.startsWith('file://')) {
        sanitizedPath = sanitizedPath.replace('file://', '');
      }

      // Mantener content:// si existe (para URIs de galería en Android)
      if (!basePath.startsWith('content://') && !basePath.startsWith('/')) {
        // Si no tiene ningún prefijo válido, no hacer nada
        sanitizedPath = basePath;
      }

      const result = await ImageCropPicker.openCropper({
        path: sanitizedPath,
        mediaType: 'photo',
        cropping: true,
        cropperCircleOverlay: true,
        avoidEmptySpaceAroundImage: true,
        width: 600,
        height: 600,
        compressImageQuality: 0.9,
        includeBase64: false,
        writeTempFile: true, // Forzar escritura en archivo temporal
        cropperToolbarTitle: 'Ajusta tu foto',
        cropperToolbarColor: '#1a1a1a',
        cropperToolbarWidgetColor: '#FFFFFF',
        cropperActiveWidgetColor: '#FFB74D',
        loadingLabelText: 'Procesando...',
        cropperCancelText: 'Cancelar',
        cropperChooseText: 'Confirmar',
        cropperRotateButtonsHidden: false,
        cropperChooseColor: '#FFB74D',
        cropperCancelColor: '#FFFFFF',
        hideBottomControls: false,
        enableRotationGesture: true,
        freeStyleCropEnabled: false,
      });

      setCroppedImage(result);
    } catch (error) {
      const cropError = error as {code?: string; message?: string};

      if (cropError?.code === 'E_PICKER_CANCELLED') {
        // Usuario canceló, simplemente volver atrás sin logs
        onBack();
      } else {
        // Solo mostrar error si es un error real, no una cancelación
        console.error('Error al recortar imagen:', error);
        Alert.alert(
          'Error',
          'No se pudo recortar la imagen. Por favor, intenta de nuevo.',
          [
            {
              text: 'OK',
              onPress: onBack,
            },
          ]
        );
      }
    } finally {
      setIsLoadingCropper(false);
    }
  }, [imageUri, onBack]);

  useEffect(() => {
    // Importante: diferir la apertura del cropper para permitir que el loader
    // se renderice antes de lanzar el módulo nativo (evita pantalla “sin feedback”).
    const task = InteractionManager.runAfterInteractions(() => {
      openNativeCropper();
    });

    return () => {
      task.cancel();
      ImageCropPicker.clean().catch(() => undefined);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Array vacío para que solo se ejecute al montar

  const handleApply = useCallback(async () => {
    if (!croppedImage?.path) {
      return;
    }

    try {
      setIsProcessing(true);

      await Promise.resolve(
        onSave({
          uri: toDisplayUri(croppedImage.path),
          width: croppedImage.width ?? 0,
          height: croppedImage.height ?? 0,
          mime: croppedImage.mime,
        }),
      );
    } finally {
      setIsProcessing(false);
    }
  }, [croppedImage, onSave, toDisplayUri]);

  const handleRecrop = useCallback(() => {
    const nextPath = croppedImage?.path ?? imageUri;
    openNativeCropper(nextPath);
  }, [croppedImage, imageUri, openNativeCropper]);

  const previewUri = useMemo(() => {
    if (croppedImage?.path) {
      return toDisplayUri(croppedImage.path);
    }

    return toDisplayUri(imageUri);
  }, [croppedImage, imageUri, toDisplayUri]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={'#000000'} barStyle={'light-content'} />
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={onBack} activeOpacity={0.7}>
          <Icon name={'arrow-back'} size={22} color={'#FFFFFF'} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Ajusta tu foto de perfil</Text>
        <TouchableOpacity
          style={[styles.headerButton, (!croppedImage || isProcessing) && styles.headerButtonDisabled]}
          onPress={handleApply}
          activeOpacity={croppedImage && !isProcessing ? 0.7 : 1}
          disabled={!croppedImage || isProcessing}>
          {isProcessing ? (
            <ActivityIndicator size={'small'} color={'#FFB74D'} />
          ) : (
            <Icon name={'check'} size={22} color={'#FFB74D'} />
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.previewContainer}>
        {!croppedImage ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size={'large'} color={'#FFFFFF'} />
          </View>
        ) : (
          <>
            <View style={styles.previewCircle}>
              {previewUri !== '' ? (
                <Image source={{uri: previewUri}} style={styles.previewImage} resizeMode={'cover'} />
              ) : null}
            </View>
            <TouchableOpacity style={styles.recropButton} onPress={handleRecrop} activeOpacity={0.7}>
              <Icon name={'edit'} size={18} color={'#000000'} />
              <Text style={styles.recropText}>Ajustar nuevamente</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#0a0a0a'},
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewCircle: {
    width: PREVIEW_SIZE,
    height: PREVIEW_SIZE,
    borderRadius: PREVIEW_SIZE / 2,
    borderWidth: 3,
    borderColor: '#FFB74D',
    backgroundColor: '#1a1a1a',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFB74D',
    shadowOffset: {width: 0, height: 0},
    shadowOpacity: 0.6,
    shadowRadius: 15,
    elevation: 10,
  },
  previewImage: {
    width: '100%',
    height: '100%',
  },
  recropButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    marginTop: 28,
    backgroundColor: '#FFB74D',
    borderWidth: 0,
    shadowColor: '#FFB74D',
    shadowOffset: {width: 0, height: 4},
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
});

export default ProfilePhotoEdit;
