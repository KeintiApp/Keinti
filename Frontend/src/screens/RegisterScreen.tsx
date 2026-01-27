import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  StatusBar,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Animated,
  Easing,
  Linking,
  AppState,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/MaterialIcons';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import Svg, { Defs, LinearGradient, Stop, Rect, Circle } from 'react-native-svg';
import { COUNTRIES } from '../constants/countries';
import {
  submitEmailRectification,
  checkEmailRegistered,
  checkUsernameRegistered,
  completeSupabaseProfile,
} from '../services/userService';
import { useI18n } from '../i18n/I18nProvider';
import { SUPABASE_REDIRECT_URL, isSupabaseConfigured, supabase } from '../config/supabase';

interface RegisterScreenProps {
  onBack: (options?: { noticeMessage?: string }) => void;
  onRegisterSuccess: () => void;
}

const GradientLoader = () => {
  const rotation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );

    animation.start();
    return () => animation.stop();
  }, [rotation]);

  const size = 28;
  const strokeWidth = 4;
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const dash = c * 0.7;
  const gap = c - dash;

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View style={[styles.loaderContainer, { transform: [{ rotate }] }]}>
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id="keintiSpinnerGradient" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FF7A00" stopOpacity="1" />
            <Stop offset="1" stopColor="#FFD000" stopOpacity="1" />
          </LinearGradient>
        </Defs>

        {/* pista sutil (opcional) */}
        <Rect x={0} y={0} width={0} height={0} fill="transparent" />

        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="url(#keintiSpinnerGradient)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
        />
      </Svg>
    </Animated.View>
  );
};

const RegisterScreen = ({ onBack: _onBack, onRegisterSuccess }: RegisterScreenProps) => {
  const { t } = useI18n();
  const USERNAME_MAX_LENGTH = 22; // Incluye el '@'
  const RECTIFICATION_MAX_LENGTH = 220;
  const EMAIL_CODE_MAX_SENDS = 2;
  const [step, setStep] = useState(1); // Paso 1: email, Paso 2: usuario y fecha, Paso 3: género y nacionalidad, Paso 4: contraseñas, Paso 5: código email
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [gender, setGender] = useState('');
  const [showGenderPicker, setShowGenderPicker] = useState(false);
  const [nationality, setNationality] = useState('');
  const [showNationalityPicker, setShowNationalityPicker] = useState(false);
  const [nationalitySearch, setNationalitySearch] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [showBirthDatePicker, setShowBirthDatePicker] = useState(false);

  const [emailAlreadyInUse, setEmailAlreadyInUse] = useState(false);
  const [usernameAlreadyInUse, setUsernameAlreadyInUse] = useState(false);

  const [emailVerificationCode, setEmailVerificationCode] = useState('');
  const [verificationSecondsLeft, setVerificationSecondsLeft] = useState<number>(0);
  const [verificationSendCount, setVerificationSendCount] = useState<number>(0);
  const [isVerifyingCode, setIsVerifyingCode] = useState(false);

  const [requestCodeInlineError, setRequestCodeInlineError] = useState('');

  const [isEmailLocked, setIsEmailLocked] = useState(false);
  const [rectificationText, setRectificationText] = useState('');
  const [isSendingRectification, setIsSendingRectification] = useState(false);
  const [rectificationSent, setRectificationSent] = useState(false);

  const [verifyCodeInlineError, setVerifyCodeInlineError] = useState('');
  const [verifyCodeRemainingAttempts, setVerifyCodeRemainingAttempts] = useState<number | null>(null);

  const deepLinkHandledRef = useRef(false);

  const pendingKeyForEmail = (e: string) => `keinti:pendingSignup:${String(e || '').trim().toLowerCase()}`;

  const persistPendingSignup = async () => {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return;

    const payload = {
      email: e,
      username: String(username || '').trim(),
      birthDate: String(birthDate || '').trim(),
      gender: String(gender || '').trim(),
      nationality: String(nationality || '').trim(),
      password: String(password || ''),
      createdAt: Date.now(),
    };

    await AsyncStorage.setItem(pendingKeyForEmail(e), JSON.stringify(payload));
  };

  const loadPendingSignup = async () => {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return null;

    const raw = await AsyncStorage.getItem(pendingKeyForEmail(e));
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      if (String(parsed.email || '').trim().toLowerCase() !== e) return null;
      return parsed as {
        email: string;
        username?: string;
        birthDate?: string;
        gender?: string;
        nationality?: string;
        password?: string;
        createdAt?: number;
      };
    } catch {
      return null;
    }
  };

  const clearPendingSignup = async () => {
    const e = String(email || '').trim().toLowerCase();
    if (!e) return;
    await AsyncStorage.removeItem(pendingKeyForEmail(e)).catch(() => {});
  };

  const isUiBlocked =
    isSubmitting || isVerifyingCode || isCheckingEmail || isCheckingUsername || isSendingRectification;

  const getLocalizedGender = (rawGender: string) => {
    const normalized = String(rawGender || '').trim().toLowerCase();
    if (!normalized) return '';

    if (['hombre', 'man', 'male', 'm'].includes(normalized)) return t('gender.male');
    if (['mujer', 'woman', 'female', 'f'].includes(normalized)) return t('gender.female');
    if (
      [
        'no especificar',
        'no especificado',
        'unspecified',
        'prefer not to say',
        'prefer_not_to_say',
        'none',
      ].includes(normalized)
    ) {
      return t('gender.unspecified');
    }

    return rawGender;
  };

  const handleUsernameChange = (text: string) => {
    setUsernameAlreadyInUse(false);

    // Si el usuario borra todo, permitir que esté vacío
    if (text === '') {
      setUsername('');
      return;
    }

    // Normalizar: sin espacios, siempre con '@' al inicio y con longitud máxima.
    const withoutSpaces = String(text).replace(/\s/g, '');
    const withAt = withoutSpaces.startsWith('@') ? withoutSpaces : '@' + withoutSpaces;
    const trimmed = withAt.slice(0, USERNAME_MAX_LENGTH);
    setUsername(trimmed);
  };

  const validateUsernameAvailability = async (candidate: string) => {
    const normalized = String(candidate || '').trim();
    if (!isValidUsername(normalized)) {
      setUsernameAlreadyInUse(false);
      return true;
    }

    if (isCheckingUsername || isSubmitting || isVerifyingCode) {
      return false;
    }

    setIsCheckingUsername(true);
    try {
      const result = await checkUsernameRegistered(normalized);
      setUsernameAlreadyInUse(result.registered);
      return !result.registered;
    } catch (error: any) {
      console.error('Error comprobando username:', error);
      const message = error instanceof Error ? error.message : t('register.unableToComplete');
      Alert.alert(t('register.errorTitle'), message);
      return false;
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const formatBirthDateDigits = (digits: string) => {
    const cleaned = String(digits || '').replace(/[^0-9]/g, '').slice(0, 8);
    if (cleaned.length <= 2) return cleaned;
    if (cleaned.length <= 4) return `${cleaned.slice(0, 2)}/${cleaned.slice(2)}`;
    return `${cleaned.slice(0, 2)}/${cleaned.slice(2, 4)}/${cleaned.slice(4)}`;
  };

  const parseBirthDateToDate = (value: string) => {
    const match = String(value || '').match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!match) return null;
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);
    if (month < 1 || month > 12 || day < 1 || day > 31) return null;
    const date = new Date(year, month - 1, day);
    if (
      date.getFullYear() !== year ||
      date.getMonth() !== month - 1 ||
      date.getDate() !== day
    ) {
      return null;
    }
    return date;
  };

  const getDefaultBirthDate = () => {
    const today = new Date();
    return new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  };

  const handleBirthDateChange = (text: string) => {
    const prev = birthDate;
    const prevDigits = prev.replace(/\D/g, '');
    let nextDigits = String(text || '').replace(/\D/g, '');
    const isDeleting = text.length < prev.length;

    // If the user deletes a slash, keep the deletion by removing the last digit.
    if (isDeleting && nextDigits.length === prevDigits.length) {
      nextDigits = nextDigits.slice(0, -1);
    }

    setBirthDate(formatBirthDateDigits(nextDigits));
  };

  const handleBirthDatePicked = (event: DateTimePickerEvent, selectedDate?: Date) => {
    if (Platform.OS !== 'ios') {
      setShowBirthDatePicker(false);
    }

    if (event.type === 'dismissed') {
      return;
    }

    if (selectedDate) {
      const day = String(selectedDate.getDate()).padStart(2, '0');
      const month = String(selectedDate.getMonth() + 1).padStart(2, '0');
      const year = String(selectedDate.getFullYear());
      setBirthDate(`${day}/${month}/${year}`);
    }
  };

  const isValidBirthDate = (date: string) => {
    // Verificar formato DD/MM/AAAA
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = date.match(dateRegex);

    if (!match) {
      return false;
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    // Verificar que la fecha sea válida
    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return false;
    }

    const birthDateObj = new Date(year, month - 1, day);
    const today = new Date();

    // Calcular la edad
    let age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
      age--;
    }

    // Verificar que sea mayor de 18 años
    return age >= 18;
  };

  const getBirthDateError = () => {
    if (birthDate.length === 0) {
      return '';
    }

    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = birthDate.match(dateRegex);

    if (!match) {
      if (birthDate.length === 10) {
        return t('validation.invalidDateFormat');
      }
      return '';
    }

    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10);
    const year = parseInt(match[3], 10);

    if (month < 1 || month > 12 || day < 1 || day > 31) {
      return t('validation.invalidDate');
    }

    const birthDateObj = new Date(year, month - 1, day);
    const today = new Date();

    let age = today.getFullYear() - birthDateObj.getFullYear();
    const monthDiff = today.getMonth() - birthDateObj.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDateObj.getDate())) {
      age--;
    }

    if (age < 18) {
      return t('validation.mustBeAdult');
    }

    return '';
  };

  const isValidUsername = (user: string) => {
    return user.length > 1; // Al menos @ y un carácter
  };

  const isValidPassword = (pass: string) => {
    const value = String(pass || '');
    if (value.length < 10) return false;
    if (value.length > 20) return false;
    const letterRegex = /[a-zA-Z]/;
    const numberRegex = /\d/;
    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
    return letterRegex.test(value) && numberRegex.test(value) && specialCharRegex.test(value);
  };

  const passwordsMatch = () => {
    return password === confirmPassword && password.length > 0;
  };

  const getPasswordError = () => {
    if (password.length === 0) {
      return '';
    }

    if (password.length > 20) {
      return t('validation.passwordMaxLength');
    }

    if (password.length < 10) {
      return t('validation.passwordMinLength');
    }

    const letterRegex = /[a-zA-Z]/;
    if (!letterRegex.test(password)) {
      return t('validation.passwordNeedsLetter');
    }

    const numberRegex = /\d/;
    if (!numberRegex.test(password)) {
      return t('validation.passwordNeedsNumber');
    }

    const specialCharRegex = /[!@#$%^&*(),.?":{}|<>]/;
    if (!specialCharRegex.test(password)) {
      return t('validation.passwordNeedsSpecial');
    }

    return '';
  };

  const getConfirmPasswordError = () => {
    if (confirmPassword.length === 0) {
      return '';
    }

    if (confirmPassword !== password) {
      return t('validation.passwordsDontMatch');
    }

    return '';
  };

  const isValidEmail = (emailValue: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailValue);
  };

  const isStep1Valid = isValidEmail(email);
  const isStep2Valid = isValidUsername(username) && isValidBirthDate(birthDate);
  const isStep3Valid = gender !== '' && nationality !== '';
  const isStep4Valid = isValidPassword(password) && passwordsMatch();
  // Link-only flow: code entry is optional/legacy.
  const isStep5Valid = true;

  const finalizeSupabaseRegistration = async (accessToken: string) => {
    const token = String(accessToken || '').trim();
    if (!token) {
      throw new Error('No se obtuvo access_token');
    }

    // Restore pending form data in case the app restarted before the callback.
    const pending = await loadPendingSignup();
    const finalUsername = String((pending?.username ?? username) || '').trim();
    const finalBirthDate = String((pending?.birthDate ?? birthDate) || '').trim();
    const finalGender = String((pending?.gender ?? gender) || '').trim();
    const finalNationality = String((pending?.nationality ?? nationality) || '').trim();
    const finalPassword = String((pending?.password ?? password) || '');

    // Keep state in sync so UI shows what we will save.
    if (pending) {
      if (!username && pending.username) setUsername(pending.username);
      if (!birthDate && pending.birthDate) setBirthDate(pending.birthDate);
      if (!gender && pending.gender) setGender(pending.gender);
      if (!nationality && pending.nationality) setNationality(pending.nationality);
      if (!password && pending.password) setPassword(pending.password);
    }

    if (!finalUsername || finalUsername.length < 2) {
      throw new Error(t('register.missingProfileData'));
    }
    if (!finalBirthDate) {
      throw new Error(t('register.missingProfileData'));
    }
    if (!finalNationality) {
      throw new Error(t('register.missingProfileData'));
    }

    // Password is set during signUp; avoid re-setting it here to prevent noisy warnings
    // like "New password should be different from the old password".
    // (For legacy users created without a password, the Login flow handles profile completion
    // but password should be set via "Forgot your password".)

    setIsSubmitting(true);
    await completeSupabaseProfile(token, {
      username: finalUsername,
      birthDate: finalBirthDate,
      gender: finalGender,
      nationality: finalNationality,
    });

    await clearPendingSignup();

    setShowSuccessMessage(true);

    setTimeout(() => {
      setShowSuccessMessage(false);
      onRegisterSuccess();
    }, 2000);
  };

  const maybeFinalizeFromExistingSession = async () => {
    if (!isSupabaseConfigured() || !supabase) return false;
    if (deepLinkHandledRef.current) return false;
    if (isSubmitting || isVerifyingCode) return false;

    const session = (await supabase.auth.getSession().catch(() => null))?.data?.session || null;
    const sessionEmail = session?.user?.email ? String(session.user.email).trim().toLowerCase() : '';
    const expectedEmail = String(email || '').trim().toLowerCase();

    if (!session?.access_token) return false;
    if (!sessionEmail || !expectedEmail || sessionEmail !== expectedEmail) return false;

    deepLinkHandledRef.current = true;
    setIsVerifyingCode(true);
    setVerifyCodeInlineError('');

    try {
      await finalizeSupabaseRegistration(session.access_token);
      return true;
    } finally {
      setIsSubmitting(false);
      setIsVerifyingCode(false);
    }
  };

  const handleSupabaseCallbackUrl = async (url: string) => {
    const raw = String(url || '').trim();
    if (!raw) return;
    if (!isSupabaseConfigured() || !supabase) return;

    // Only process once per registration attempt.
    if (deepLinkHandledRef.current) return;
    deepLinkHandledRef.current = true;

    setIsVerifyingCode(true);
    setVerifyCodeInlineError('');

    try {
      const parsed = new URL(raw);

      const errorDescription = parsed.searchParams.get('error_description');
      if (errorDescription) {
        throw new Error(decodeURIComponent(errorDescription));
      }

      const code = parsed.searchParams.get('code');
      if (code) {
        const { data, error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          throw new Error(error.message || 'No se pudo completar la sesión');
        }
        const accessToken = data?.session?.access_token;
        if (!accessToken) {
          throw new Error('No se obtuvo access_token');
        }
        await finalizeSupabaseRegistration(accessToken);
        return;
      }

      // Fallback: implicit flow (access_token in URL hash)
      const hash = String(parsed.hash || '').replace(/^#/, '');
      if (hash) {
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (sessionError) {
            throw new Error(sessionError.message || 'No se pudo establecer la sesión');
          }
          await finalizeSupabaseRegistration(accessToken);
          return;
        }
      }

      // If we reached here, the callback didn't include usable auth data.
      throw new Error('Enlace de verificación inválido. Solicita un nuevo email.');
    } finally {
      setIsSubmitting(false);
      setIsVerifyingCode(false);
    }
  };

  // Handle Supabase magic-link callbacks (Confirm your signup)
  useEffect(() => {
    if (step !== 5) return;

    let mounted = true;

    const checkInitial = async () => {
      const initialUrl = await Linking.getInitialURL().catch(() => null);
      if (!mounted) return;
      if (initialUrl) {
        await handleSupabaseCallbackUrl(initialUrl);
      }
    };

    const onUrl = async ({ url }: { url: string }) => {
      await handleSupabaseCallbackUrl(url);
    };

    const sub = Linking.addEventListener('url', onUrl);
    checkInitial();

    // If the user confirms via browser and comes back manually, detect the session.
    const appStateSub = AppState.addEventListener('change', async (state) => {
      if (state === 'active') {
        await maybeFinalizeFromExistingSession();
      }
    });

    return () => {
      mounted = false;
      sub.remove();
      appStateSub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const formatCountdown = (totalSeconds: number) => {
    const safe = Math.max(0, Math.floor(totalSeconds));
    const mm = String(Math.floor(safe / 60)).padStart(2, '0');
    const ss = String(safe % 60).padStart(2, '0');
    return `${mm}:${ss}`;
  };

  const resetToEmailStep = () => {
    setStep(1);
    setEmail('');
    setUsername('');
    setBirthDate('');
    setGender('');
    setNationality('');
    setPassword('');
    setConfirmPassword('');
    setEmailVerificationCode('');
    setVerificationSecondsLeft(0);
    setVerificationSendCount(0);
    setIsEmailLocked(false);
    setRectificationText('');
    setIsSendingRectification(false);
    setRectificationSent(false);
    setVerifyCodeInlineError('');
    setVerifyCodeRemainingAttempts(null);
    setShowGenderPicker(false);
    setShowNationalityPicker(false);
    setNationalitySearch('');
    setIsSubmitting(false);
    setIsVerifyingCode(false);
    setIsCheckingUsername(false);
    setUsernameAlreadyInUse(false);
    setShowSuccessMessage(false);
    setRequestCodeInlineError('');
  };

  const markEmailLocked = () => {
    setIsEmailLocked(true);
    setVerificationSecondsLeft(0);
  };

  useEffect(() => {
    if (step !== 5) {
      return;
    }
    if (verificationSecondsLeft <= 0) {
      return;
    }

    const id = setInterval(() => {
      setVerificationSecondsLeft(prev => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => clearInterval(id);
  }, [step, verificationSecondsLeft]);

  // Si el usuario deja caducar el código 2 veces (2 envíos), mostrar bloqueo + rectificación.
  useEffect(() => {
    if (step !== 5) {
      return;
    }
    if (isEmailLocked) {
      return;
    }
    if (verificationSecondsLeft !== 0) {
      return;
    }
    if (verificationSendCount < EMAIL_CODE_MAX_SENDS) {
      return;
    }

    markEmailLocked();
  }, [step, verificationSecondsLeft, verificationSendCount, isEmailLocked]);

  // Filtrar países según la búsqueda
  const filteredCountries = COUNTRIES.filter(country =>
    country.toLowerCase().includes(nationalitySearch.toLowerCase())
  );

  const handleNext = async () => {
    if (step === 1) {
      setEmailAlreadyInUse(false);

      if (!isValidEmail(email)) {
        return;
      }

      if (isCheckingEmail || isSubmitting || isVerifyingCode) {
        return;
      }

      setIsCheckingEmail(true);
      try {
        const result = await checkEmailRegistered(email);
        if (result.registered) {
          setEmailAlreadyInUse(true);
          return;
        }

        console.log('Email:', email);
        setStep(2); // Pasar al siguiente paso
      } catch (error: any) {
        console.error('Error comprobando email:', error);
        const message = error instanceof Error ? error.message : t('register.unableToComplete');
        Alert.alert(t('register.errorTitle'), message);
      } finally {
        setIsCheckingEmail(false);
      }
    } else if (step === 2) {
      if (!isStep2Valid) {
        return;
      }

      const available = await validateUsernameAvailability(username);
      if (!available) {
        return;
      }

      console.log('Usuario:', username);
      console.log('Fecha de nacimiento:', birthDate);
      setStep(3); // Pasar al paso de nacionalidad
    } else if (step === 3) {
      console.log('Género:', gender);
      console.log('Nacionalidad:', nationality);
      setStep(4); // Pasar al paso de contraseñas
    }
  };

  const handleSubmit = async () => {
    if (isSubmitting) {
      return;
    }

    if (!isSupabaseConfigured() || !supabase) {
      setRequestCodeInlineError('Falta configurar Supabase (SUPABASE_URL / SUPABASE_ANON_KEY)');
      return;
    }

    setIsSubmitting(true);
    setRequestCodeInlineError('');

    try {
      deepLinkHandledRef.current = false;
      await persistPendingSignup();
      setIsEmailLocked(false);
      setRectificationText('');
      setRectificationSent(false);

      const { error } = await supabase.auth.signUp({
        email: String(email || '').trim(),
        password: String(password || ''),
        options: {
          // Ensure the confirmation link opens the app.
          emailRedirectTo: SUPABASE_REDIRECT_URL,
        },
      } as any);

      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('rate') || msg.includes('too many') || msg.includes('limit')) {
          setRequestCodeInlineError(t('register.emailLockedRetryInline'));
          return;
        }
        throw new Error(error.message || 'No se pudo enviar el email de confirmación');
      }

      // Supabase email OTP suele caducar alrededor de 5 minutos.
      setVerificationSecondsLeft(300);
      setVerificationSendCount((prev) => prev + 1);
      setEmailVerificationCode('');
      setStep(5);
    } catch (error: any) {
      console.error('Error solicitando código (Supabase):', error);
      const message = error instanceof Error ? error.message : t('register.unableToComplete');
      Alert.alert(t('register.errorTitle'), message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyCodeAndRegister = async () => {
    // Link-only: we no longer require manual OTP entry.
    // Keep this handler as a fallback for future configs.
    if (isVerifyingCode || isSubmitting) {
      return;
    }

    if (!isSupabaseConfigured() || !supabase) {
      setVerifyCodeInlineError('Falta configurar Supabase (SUPABASE_URL / SUPABASE_ANON_KEY)');
      return;
    }

    setIsVerifyingCode(true);
    setVerifyCodeInlineError('');
    setVerifyCodeRemainingAttempts(null);

    try {
      const code = emailVerificationCode.trim();
      if (!code) {
        setVerifyCodeInlineError(t('register.codeInvalidInline'));
        return;
      }

      const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
        email: String(email || '').trim(),
        token: code,
        type: 'email',
      } as any);

      if (verifyError) {
        const msg = String(verifyError.message || '').toLowerCase();
        if (msg.includes('expired')) {
          Alert.alert(t('register.errorTitle'), t('register.codeExpired'));
          return;
        }
        setVerifyCodeInlineError(t('register.codeInvalidInline'));
        return;
      }
      const accessToken =
        verifyData?.session?.access_token || (await supabase.auth.getSession()).data?.session?.access_token;
      if (!accessToken) {
        throw new Error('No se obtuvo access_token');
      }

      await finalizeSupabaseRegistration(accessToken);
    } catch (error: any) {
      const apiCode = error?.code || error?.details?.code;
      if (apiCode === 'USERNAME_TAKEN') {
        setUsernameAlreadyInUse(true);
        Alert.alert(t('register.errorTitle'), 'El nombre de usuario ya está en uso');
        setStep(2);
        return;
      }

      console.error('Error verificando/registrando (Supabase):', error);
      const message = error instanceof Error ? error.message : t('register.unableToComplete');
      Alert.alert(t('register.errorTitle'), message);
    } finally {
      setIsSubmitting(false);
      setIsVerifyingCode(false);
    }
  };

  const handleResendCode = async () => {
    if (isSubmitting) {
      return;
    }
    if (isEmailLocked) {
      return;
    }
    if (verificationSecondsLeft > 0) {
      return;
    }

    if (!isSupabaseConfigured() || !supabase) {
      setRequestCodeInlineError('Falta configurar Supabase (SUPABASE_URL / SUPABASE_ANON_KEY)');
      return;
    }

    setIsSubmitting(true);

    try {
      deepLinkHandledRef.current = false;
      await persistPendingSignup();

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: String(email || '').trim(),
        options: {
          emailRedirectTo: SUPABASE_REDIRECT_URL,
        },
      } as any);

      if (error) {
        const msg = String(error.message || '').toLowerCase();
        if (msg.includes('rate') || msg.includes('too many') || msg.includes('limit')) {
          markEmailLocked();
          return;
        }
        throw new Error(error.message || 'No se pudo reenviar el email');
      }

      setVerificationSecondsLeft(300);
      setVerificationSendCount((prev) => prev + 1);
      setEmailVerificationCode('');
    } catch (error: any) {
      const message = error instanceof Error
        ? error.message
        : t('register.unableToComplete');
      Alert.alert(t('register.errorTitle'), message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendRectification = async () => {

    if (isSendingRectification || rectificationSent) {
      return;
    }

    const message = String(rectificationText || '').trim();
    if (!message) {
      return;
    }

    setIsSendingRectification(true);
    try {
      await submitEmailRectification({
        email: String(email || '').trim(),
        message,
      });
      setRectificationSent(true);
      Alert.alert(t('accountAuth.successTitle'), t('register.rectificationSent'));
    } catch (error: any) {
      console.error('Error enviando rectificación:', error);
      const msg = error instanceof Error ? error.message : t('register.unableToComplete');
      Alert.alert(t('register.errorTitle'), msg);
    } finally {
      setIsSendingRectification(false);
    }
  };

  const handleBack = () => {
    if (isUiBlocked) {
      return;
    }

    if (step > 1) {
      setStep((prev) => Math.max(1, prev - 1));
      return;
    }

    _onBack();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor="#000000" barStyle="light-content" />

      {/* Botón de retroceso */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleBack}
        activeOpacity={0.7}
        disabled={isUiBlocked}>
        <Icon name="arrow-back-ios" size={22} color="#ffffffff" />
      </TouchableOpacity>

      <View style={styles.flex} pointerEvents={isUiBlocked ? 'none' : 'auto'}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollViewContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <View style={styles.content}>
              {/* Formulario de registro */}
              <View style={styles.formContainer}>
              {step === 1 ? (
                // Paso 1: Email
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>{t('register.email')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('login.emailPlaceholder')}
                      placeholderTextColor="#ffffffff"
                      value={email}
                      onChangeText={(v) => {
                        setEmail(String(v || ''));
                        setEmailAlreadyInUse(false);
                        setRequestCodeInlineError('');
                      }}
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                    />

                    {emailAlreadyInUse && (
                      <Text style={styles.errorText}>{t('register.emailAlreadyInUse')}</Text>
                    )}
                  </View>
                </>
              ) : step === 2 ? (
                // Paso 2: Usuario y Fecha de nacimiento
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>{t('register.username')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('register.username')}
                      placeholderTextColor="#ffffffff"
                      value={username}
                      onChangeText={handleUsernameChange}
                      maxLength={USERNAME_MAX_LENGTH}
                      onBlur={() => {
                        void validateUsernameAvailability(username);
                      }}
                      autoCapitalize="none"
                    />

                    {usernameAlreadyInUse && (
                      <Text style={styles.errorText}>
                        {t('register.usernameAlreadyInUse').replace('{username}', username)}
                      </Text>
                    )}
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>{t('register.birthDate')}</Text>
                    <View style={styles.dateInputContainer}>
                      <TextInput
                        style={styles.dateInput}
                        placeholder={t('register.birthDatePlaceholder')}
                        placeholderTextColor="#ffffffff"
                        value={birthDate}
                        onChangeText={handleBirthDateChange}
                        keyboardType="numeric"
                        maxLength={10}
                      />
                      <TouchableOpacity
                        style={styles.dateIconButton}
                        onPress={() => setShowBirthDatePicker(true)}
                        activeOpacity={0.7}
                        disabled={isUiBlocked}>
                        <Icon name="calendar-month" size={20} color="#ffffffff" />
                      </TouchableOpacity>
                    </View>
                    {getBirthDateError() !== '' && (
                      <Text style={styles.errorText}>{getBirthDateError()}</Text>
                    )}
                    {showBirthDatePicker && (
                      <View style={{ marginTop: 8 }}>
                        <DateTimePicker
                          value={parseBirthDateToDate(birthDate) || getDefaultBirthDate()}
                          mode="date"
                          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                          maximumDate={getDefaultBirthDate()}
                          onChange={handleBirthDatePicked}
                        />
                        {Platform.OS === 'ios' && (
                          <TouchableOpacity
                            style={[styles.resendButton, { marginTop: 8 }]}
                            onPress={() => setShowBirthDatePicker(false)}
                            activeOpacity={0.8}>
                            <Text style={styles.resendButtonText}>{t('common.confirm')}</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                </>
              ) : step === 3 ? (
                // Paso 3: Género y Nacionalidad
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>{t('register.gender')}</Text>
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={() => setShowGenderPicker(!showGenderPicker)}
                      activeOpacity={0.7}>
                      <Text style={[styles.pickerButtonText, gender === '' && styles.pickerPlaceholder]}>
                        {gender ? getLocalizedGender(gender) : t('register.selectGender')}
                      </Text>
                      <Icon name={showGenderPicker ? 'expand-less' : 'expand-more'} size={24} color="#ffffffff" />
                    </TouchableOpacity>

                    {showGenderPicker && (
                      <View style={styles.genderPickerContainer}>
                        {[
                          { key: 'male', label: t('gender.male'), valueForBackend: 'Hombre' },
                          { key: 'female', label: t('gender.female'), valueForBackend: 'Mujer' },
                          { key: 'unspecified', label: t('gender.unspecified'), valueForBackend: 'No especificar' },
                        ].map(option => (
                          <TouchableOpacity
                            key={option.key}
                            style={styles.genderItem}
                            onPress={() => {
                              setGender(option.valueForBackend);
                              setShowGenderPicker(false);
                            }}
                            activeOpacity={0.7}>
                            <Text style={styles.genderItemText}>{option.label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )}
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>{t('register.nationality')}</Text>
                    <TouchableOpacity
                      style={styles.pickerButton}
                      onPress={() => setShowNationalityPicker(!showNationalityPicker)}
                      activeOpacity={0.7}>
                      <Text style={[styles.pickerButtonText, nationality === '' && styles.pickerPlaceholder]}>
                        {nationality || t('register.selectNationality')}
                      </Text>
                      <Icon name={showNationalityPicker ? 'expand-less' : 'expand-more'} size={24} color="#ffffffff" />
                    </TouchableOpacity>

                    {showNationalityPicker && (
                      <View style={styles.nationalityPickerContainer}>
                        <TextInput
                          style={styles.nationalitySearchInput}
                          placeholder={t('register.searchCountry')}
                          placeholderTextColor="#ffffffff"
                          value={nationalitySearch}
                          onChangeText={setNationalitySearch}
                          autoCapitalize="words"
                        />
                        <ScrollView style={styles.nationalityList} nestedScrollEnabled={true}>
                          {filteredCountries.length > 0 ? (
                            filteredCountries.map((country) => (
                              <TouchableOpacity
                                key={country}
                                style={styles.nationalityItem}
                                onPress={() => {
                                  setNationality(country);
                                  setShowNationalityPicker(false);
                                  setNationalitySearch('');
                                }}
                                activeOpacity={0.7}>
                                <Text style={styles.nationalityItemText}>{country}</Text>
                              </TouchableOpacity>
                            ))
                          ) : (
                            <View style={styles.noResultsContainer}>
                              <Text style={styles.noResultsText}>{t('register.noCountriesFound')}</Text>
                            </View>
                          )}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                </>
              ) : step === 4 ? (
                // Paso 4: Contraseñas
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>{t('register.password')}</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder={t('login.passwordPlaceholder')}
                        placeholderTextColor="#ffffffff"
                        value={password}
                        onChangeText={setPassword}
                        maxLength={20}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setShowPassword(!showPassword)}
                        activeOpacity={0.7}>
                        <Icon
                          name={showPassword ? 'visibility' : 'visibility-off'}
                          size={18}
                          color="#ffffffff"
                        />
                      </TouchableOpacity>
                    </View>
                    {getPasswordError() !== '' && (
                      <Text style={styles.errorText}>{getPasswordError()}</Text>
                    )}
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>{t('register.confirmPassword')}</Text>
                    <View style={styles.passwordContainer}>
                      <TextInput
                        style={styles.passwordInput}
                        placeholder={t('register.confirmPasswordPlaceholder')}
                        placeholderTextColor="#ffffffff"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        maxLength={20}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                      />
                      <TouchableOpacity
                        style={styles.eyeIcon}
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        activeOpacity={0.7}>
                        <Icon
                          name={showConfirmPassword ? 'visibility' : 'visibility-off'}
                          size={18}
                          color="#ffffffff"
                        />
                      </TouchableOpacity>
                    </View>
                    {getConfirmPasswordError() !== '' && (
                      <Text style={styles.errorText}>{getConfirmPasswordError()}</Text>
                    )}
                  </View>
                </>
              ) : step === 5 ? (
                // Paso 5: Verificación por email
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>{t('register.emailVerificationTitle')}</Text>
                    <Text style={styles.verificationHint}>
                      {t('register.emailVerificationHint')}
                      <Text style={styles.verificationHintStrong}> {email}</Text>
                    </Text>
                    <Text style={[styles.verificationHint, { marginTop: 10 }]}
                    >
                      {t('register.emailVerificationLinkHint')}
                    </Text>
                  </View>

                  <View style={styles.inputContainer}>
                    {isEmailLocked && (
                      <Text style={styles.errorText}>{t('register.emailLockedInlineError')}</Text>
                    )}
                    {!isEmailLocked && requestCodeInlineError !== '' && (
                      <Text style={styles.errorText}>{requestCodeInlineError}</Text>
                    )}
                    {verificationSecondsLeft > 0 && (
                      <Text style={styles.countdownText}>
                        {t('register.timeRemaining')}: {formatCountdown(verificationSecondsLeft)}
                      </Text>
                    )}
                  </View>

                  {isEmailLocked && (
                    <>
                      <View style={styles.inputContainer}>
                        <Text style={styles.label}>{t('register.rectificationTitle')}</Text>
                        <TextInput
                          style={styles.input}
                          placeholder={t('register.rectificationPlaceholder')}
                          placeholderTextColor="#ffffffff"
                          value={rectificationText}
                          onChangeText={(v) => {
                            setRectificationSent(false);
                            setRectificationText(String(v || '').slice(0, RECTIFICATION_MAX_LENGTH));
                          }}
                          maxLength={RECTIFICATION_MAX_LENGTH}
                          multiline
                          editable={!isSendingRectification}
                        />
                        <Text style={styles.countdownText}>
                          {String(rectificationText || '').length}/{RECTIFICATION_MAX_LENGTH}
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.nextButton,
                          ((String(rectificationText || '').trim().length === 0) || isSendingRectification || rectificationSent) && styles.nextButtonDisabled,
                        ]}
                        onPress={handleSendRectification}
                        activeOpacity={0.8}
                        disabled={(String(rectificationText || '').trim().length === 0) || isSendingRectification || rectificationSent}>
                        <Text
                          style={[
                            styles.nextButtonText,
                            ((String(rectificationText || '').trim().length === 0) || isSendingRectification || rectificationSent) && styles.nextButtonTextDisabled,
                          ]}>
                          {isSendingRectification ? t('common.loading') : t('register.rectificationSend')}
                        </Text>
                      </TouchableOpacity>
                    </>
                  )}
                </>
              ) : null}

              {step !== 5 && (
                <>
                  <TouchableOpacity
                    style={[
                      styles.nextButton,
                      ((step === 1 && !isStep1Valid) ||
                        (step === 2 && !isStep2Valid) ||
                        (step === 3 && !isStep3Valid) ||
                        (step === 4 && (!isStep4Valid || isSubmitting)) ||
                        (step === 1 && isCheckingEmail)) && styles.nextButtonDisabled,
                    ]}
                    onPress={step === 4 ? handleSubmit : handleNext}
                    activeOpacity={0.8}
                    disabled={(step === 1 && (!isStep1Valid || isCheckingEmail)) ||
                      (step === 2 && !isStep2Valid) ||
                      (step === 3 && !isStep3Valid) ||
                      (step === 4 && (!isStep4Valid || isSubmitting))}>
                    <Text style={[
                      styles.nextButtonText,
                      ((step === 1 && !isStep1Valid) ||
                        (step === 2 && !isStep2Valid) ||
                        (step === 3 && !isStep3Valid) ||
                        (step === 4 && (!isStep4Valid || isSubmitting)) ||
                        (step === 1 && isCheckingEmail)) && styles.nextButtonTextDisabled
                    ]}>
                      {step === 4
                        ? (isSubmitting ? t('register.registering') : t('register.signUp'))
                        : (isCheckingEmail ? t('common.loading') : t('register.next'))}
                    </Text>
                  </TouchableOpacity>

                  {step === 4 && requestCodeInlineError !== '' && (
                    <Text style={styles.errorText}>{requestCodeInlineError}</Text>
                  )}
                </>
              )}

              {showSuccessMessage && (step === 4 || step === 5) && (
                <View style={styles.successMessageContainer}>
                  <Text style={styles.successMessageText}>
                    {t('register.successMessage')}
                  </Text>
                  <GradientLoader />
                </View>
              )}

              {step === 4 && (
                <View style={styles.privacyTextContainer}>
                  <Text style={styles.privacyText}>
                    {t('register.privacyPrefix')}
                    <Text style={styles.privacyTextHighlight}>{t('register.privacyPolicies')}</Text>
                    {t('register.privacySuffix')}
                  </Text>
                </View>
              )}
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </View>

      {isUiBlocked && (
        <View style={styles.blockingOverlay} pointerEvents="auto">
          <GradientLoader />
        </View>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  flex: {
    flex: 1,
  },
  backButton: {
    position: 'absolute',
    top: 16,
    left: 16,
    zIndex: 10,
    padding: 8,
  },
  blockingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#000000',
    opacity: 0.65,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardView: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    flexGrow: 1,
    paddingTop: 80,
    paddingBottom: 40,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffffff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffffff',
    borderWidth: 1,
    borderColor: '#393939',
  },
  dateInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#393939',
    paddingRight: 12,
  },
  dateInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffffff',
  },
  dateIconButton: {
    padding: 8,
  },
  errorText: {
    color: '#D84315',
    fontSize: 12,
    marginTop: 6,
    marginLeft: 4,
  },
  verificationHint: {
    color: '#ffffffff',
    fontSize: 13,
    lineHeight: 18,
  },
  verificationHintStrong: {
    color: '#ffffffff',
    fontWeight: '700',
  },
  countdownText: {
    color: '#ffffffff',
    fontSize: 12,
    marginTop: 8,
    marginLeft: 4,
  },
  nextButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 24,
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  nextButtonText: {
    color: '#FFB74D',
    fontSize: 16,
    fontWeight: 'bold',
  },
  nextButtonTextDisabled: {
    color: '#ffa52e5b',
  },
  nextButtonDisabled: {
    backgroundColor: '#ffffff17',
    opacity: 0.5,
    borderWidth: 2,
    borderColor: '#ffa52e5b',
  },
  resendButton: {
    marginTop: 12,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#393939',
    backgroundColor: '#000000',
  },
  resendButtonDisabled: {
    opacity: 0.5,
  },
  resendButtonText: {
    color: '#FFB74D',
    fontSize: 14,
    fontWeight: '600',
  },
  resendButtonTextDisabled: {
    color: '#ffa52e5b',
  },
  pickerButton: {
    backgroundColor: '#000000',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#393939',
  },
  pickerButtonText: {
    fontSize: 16,
    color: '#ffffffff',
  },
  pickerPlaceholder: {
    color: '#ffffffff',
  },
  genderPickerContainer: {
    marginTop: 8,
    backgroundColor: '#353535ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#353535ff',
    overflow: 'hidden',
  },
  genderItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#000000ff',
  },
  genderItemText: {
    fontSize: 16,
    color: '#ffffffff',
  },
  nationalityPickerContainer: {
    marginTop: 8,
    backgroundColor: '#353535ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#353535ff',
    overflow: 'hidden',
  },
  nationalitySearchInput: {
    backgroundColor: '#494949ff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: '#ffffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#000000ff',
  },
  nationalityList: {
    maxHeight: 200,
  },
  nationalityItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: '#000000ff',
  },
  nationalityItemText: {
    fontSize: 16,
    color: '#ffffffff',
  },
  noResultsContainer: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  noResultsText: {
    fontSize: 14,
    color: '#FFB74D',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#000000',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#393939',
    paddingRight: 12,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffffff',
  },
  eyeIcon: {
    padding: 8,
  },
  privacyTextContainer: {
    marginTop: 16,
    paddingHorizontal: 8,
  },
  privacyText: {
    fontSize: 12,
    color: '#ffffffff',
    textAlign: 'center',
    lineHeight: 18,
  },
  privacyTextHighlight: {
    color: '#ffffffff',
    fontWeight: '600',
  },
  successMessageContainer: {
    marginTop: 14,
    alignItems: 'center',
  },
  successMessageText: {
    fontSize: 16,
    color: '#ffffffff',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  loaderContainer: {
    marginTop: 10,
  },
});

export default RegisterScreen;
