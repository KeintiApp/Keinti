import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  ActivityIndicator,
  Image,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FontAwesome from 'react-native-vector-icons/FontAwesome';
import MaskedView from '@react-native-masked-view/masked-view';
import Svg, { Defs, LinearGradient, Stop, Rect } from 'react-native-svg';
import InAppBrowser from 'react-native-inappbrowser-reborn';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { completeSupabaseProfile, exchangeSupabaseSession } from '../services/userService';
import { useI18n } from '../i18n/I18nProvider';
import PasswordResetModal from '../components/PasswordResetModal';
import { SUPABASE_REDIRECT_URL, isSupabaseConfigured, supabase } from '../config/supabase';

type MarkedSegment = { text: string; kind: 'normal' | 'highlight' };

type OAuthCallbackInfo = {
  code?: string;
  errorDescription?: string;
  accessTokenFromHash?: string;
  refreshTokenFromHash?: string;
};

const safeDecode = (value: unknown) => {
  const raw = String(value ?? '');
  if (!raw) return '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};

const extractOAuthCallbackInfo = (url: string): OAuthCallbackInfo => {
  const raw = String(url || '').trim();
  if (!raw) return {};

  const [beforeHash, hashPartRaw] = raw.split('#');
  // NOTE: The `parse` helper exists in `expo-linking`, not in React Native's `Linking`.
  // We only need query params here, so we parse them manually.
  const qp: Record<string, string> = {};
  const queryIndex = String(beforeHash || '').indexOf('?');
  const queryPart = queryIndex >= 0 ? String(beforeHash || '').slice(queryIndex + 1) : '';
  if (queryPart) {
    try {
      const params = new URLSearchParams(queryPart);
      params.forEach((value, key) => {
        qp[String(key)] = String(value);
      });
    } catch {
      // ignore
    }
  }

  const codeFromQuery = qp?.code ? String(qp.code) : '';
  const errorFromQuery = qp?.error_description ? String(qp.error_description) : '';

  const hashPart = String(hashPartRaw || '').trim();
  let accessTokenFromHash = '';
  let refreshTokenFromHash = '';
  let errorFromHash = '';
  let codeFromHash = '';

  if (hashPart) {
    try {
      const params = new URLSearchParams(hashPart);
      accessTokenFromHash = params.get('access_token') || '';
      refreshTokenFromHash = params.get('refresh_token') || '';
      errorFromHash = params.get('error_description') || '';
      codeFromHash = params.get('code') || '';
    } catch {
      // ignore
    }
  }

  const code = codeFromQuery || codeFromHash || undefined;
  const errorDescription = safeDecode(errorFromQuery || errorFromHash) || undefined;

  return {
    code,
    errorDescription,
    accessTokenFromHash: accessTokenFromHash || undefined,
    refreshTokenFromHash: refreshTokenFromHash || undefined,
  };
};

const waitForSupabaseOAuthCallback = async (timeoutMs = 120_000): Promise<string> => {
  const matchesRedirect = (u: string) => {
    const raw = String(u || '').trim();
    if (!raw) return false;
    return raw.startsWith(SUPABASE_REDIRECT_URL) || raw.startsWith(`${SUPABASE_REDIRECT_URL}/`);
  };

  // Handle cold-start callback.
  const initialUrl = await Linking.getInitialURL().catch(() => null);
  if (initialUrl && matchesRedirect(initialUrl)) {
    return initialUrl;
  }

  return await new Promise<string>((resolve, reject) => {
    const id = setTimeout(() => {
      sub.remove();
      reject(new Error('Tiempo de espera agotado. Vuelve a intentarlo.'));
    }, Math.max(1000, timeoutMs));

    const handler = ({ url }: { url: string }) => {
      if (!matchesRedirect(url)) {
        return;
      }
      clearTimeout(id);
      sub.remove();
      resolve(url);
    };

    const sub = Linking.addEventListener('url', handler);
  });
};

const parseMarkedText = (raw: string): MarkedSegment[] => {
  const value = String(raw ?? '');
  if (!value) return [{ text: '', kind: 'normal' }];

  const segments: MarkedSegment[] = [];
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

const GradientText = ({
  children,
  style,
  fallbackColor = '#FFB74D',
}: {
  children: string;
  style?: any;
  fallbackColor?: string;
}) => {
  const [layout, setLayout] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const gradientId = 'gradientTextFill';

  useEffect(() => {
    // When the text changes (e.g. language switch), we must re-measure.
    // Otherwise the MaskedView keeps the previous width/height and clips the new text.
    setLayout({ width: 0, height: 0 });
  }, [children]);

  const onLayout = (e: any) => {
    const w = Math.ceil(e?.nativeEvent?.layout?.width || 0);
    const h = Math.ceil(e?.nativeEvent?.layout?.height || 0);
    if (!w || !h) return;
    if (layout.width === w && layout.height === h) return;
    setLayout({ width: w, height: h });
  };

  if (!layout.width || !layout.height) {
    return (
      <Text onLayout={onLayout} style={[style, { color: fallbackColor }]}>
        {children}
      </Text>
    );
  }

  return (
    <MaskedView
      style={{ width: layout.width, height: layout.height }}
      maskElement={
        <View style={{ backgroundColor: 'transparent' }}>
          <Text style={style}>{children}</Text>
        </View>
      }
    >
      <Svg width={layout.width} height={layout.height}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FF9800" stopOpacity="1" />
            <Stop offset="1" stopColor="#FFEB3B" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width={layout.width} height={layout.height} fill={`url(#${gradientId})`} />
      </Svg>
    </MaskedView>
  );
};

const GradientGoogleIcon = ({ size = 18 }: { size?: number }) => {
  const gradientId = 'googleIconGradient';
  return (
    <MaskedView
      style={{ width: size, height: size }}
      maskElement={
        <View style={{ backgroundColor: 'transparent' }}>
          <FontAwesome name="google" size={size} color="#000" />
        </View>
      }
    >
      <Svg width={size} height={size} viewBox="0 0 24 24">
        <Defs>
          {/* Same gradient used in FrontScreen.tsx (chatGradient) */}
          <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#FF9800" stopOpacity="1" />
            <Stop offset="1" stopColor="#FFEB3B" stopOpacity="1" />
          </LinearGradient>
        </Defs>
        <Rect x="0" y="0" width="24" height="24" fill={`url(#${gradientId})`} />
      </Svg>
    </MaskedView>
  );
};

interface SocialNetwork {
  id: string;
  link: string;
}

interface LoginScreenProps {
  onLogin: (
    email: string,
    profilePhotoUri?: string,
    username?: string,
    socialNetworks?: SocialNetwork[],
    token?: string,
    nationality?: string,
    preferredLanguage?: string,
    accountVerified?: boolean
  ) => void;
  onNavigateToRegister: () => void;
  noticeMessage?: string;
  noticeToken?: number;
}

const LoginScreen = ({ onLogin, onNavigateToRegister, noticeMessage, noticeToken }: LoginScreenProps) => {
  const androidTopInset = Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0;
  const { t, language, setLanguage } = useI18n();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [googleErrorMessage, setGoogleErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const infoTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const googleErrorTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [suppressNotices, setSuppressNotices] = useState(false);
  const lastNoticeTokenRef = useRef<number | null>(null);

  const [resetVisible, setResetVisible] = useState(false);

  const forgotPasswordSegments = useMemo(
    () => parseMarkedText(String(t('common.forgotPassword') || '')),
    [t, language]
  );

  const screenDisabled = isLoading || isGoogleLoading;

  useEffect(() => {
    if (!noticeMessage || !noticeToken) {
      return;
    }

    // Avoid re-processing the same notice multiple times.
    if (lastNoticeTokenRef.current === noticeToken) {
      return;
    }

    // Avoid showing external notices (e.g. email-confirmation) during OAuth flows or
    // while we are displaying Google-related errors.
    if (suppressNotices || isGoogleLoading || !!googleErrorMessage) {
      // Mark as consumed so it doesn't pop up later when suppression ends.
      lastNoticeTokenRef.current = noticeToken;
      return;
    }

    lastNoticeTokenRef.current = noticeToken;

    setInfoMessage(noticeMessage);
    if (infoTimeoutRef.current) {
      clearTimeout(infoTimeoutRef.current);
    }
    infoTimeoutRef.current = setTimeout(() => {
      setInfoMessage('');
    }, 5000);

    return () => {
      if (infoTimeoutRef.current) {
        clearTimeout(infoTimeoutRef.current);
        infoTimeoutRef.current = null;
      }
    };
  }, [noticeMessage, noticeToken, suppressNotices, isGoogleLoading, googleErrorMessage]);

  // Validar que ambos campos estén completos
  const isFormValid = email.trim().length > 0 && password.length > 0;

  const openResetModal = () => setResetVisible(true);

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMessage(t('login.fillAllFields'));
      return;
    }

    const supabaseClient = supabase;
    if (!isSupabaseConfigured() || !supabaseClient) {
      setErrorMessage('Falta configurar Supabase (SUPABASE_URL / SUPABASE_ANON_KEY) en el frontend');
      return;
    }

    setIsLoading(true);
    setErrorMessage(''); // Limpiar mensaje de error anterior
    setGoogleErrorMessage('');

    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        throw new Error(error.message || 'No se pudo iniciar sesión');
      }

      const accessToken = data?.session?.access_token;
      if (!accessToken) {
        throw new Error('No se obtuvo access_token');
      }

      const pendingKeyForEmail = (e: string) => `keinti:pendingSignup:${String(e || '').trim().toLowerCase()}`;

      const tryCompleteProfileFromPending = async () => {
        const normalizedEmail = String(email || '').trim().toLowerCase();
        if (!normalizedEmail) return null;
        const raw = await AsyncStorage.getItem(pendingKeyForEmail(normalizedEmail)).catch(() => null);
        if (!raw) return null;

        let pending: any = null;
        try {
          pending = JSON.parse(raw);
        } catch {
          pending = null;
        }

        const username = String(pending?.username || '').trim();
        const birthDate = String(pending?.birthDate || '').trim();
        const gender = String(pending?.gender || '').trim();
        const nationality = String(pending?.nationality || '').trim();

        if (!username || !birthDate || !nationality) {
          return null;
        }

        const completed = await completeSupabaseProfile(accessToken, {
          username,
          birthDate,
          gender,
          nationality,
        });

        await AsyncStorage.removeItem(pendingKeyForEmail(normalizedEmail)).catch(() => {});
        return completed;
      };

      try {
        const exchanged = await exchangeSupabaseSession(accessToken);
        onLogin(
          exchanged.user.email,
          exchanged.user.profile_photo_uri || undefined,
          exchanged.user.username,
          (exchanged.user.social_networks as any) || [],
          exchanged.token,
          exchanged.user.nationality,
          exchanged.user.preferred_language,
          !!exchanged.user.account_verified
        );
      } catch (err: any) {
        const apiCode = err?.code || err?.details?.code;
        if (apiCode === 'PROFILE_NOT_FOUND') {
          const completed = await tryCompleteProfileFromPending();
          if (completed?.token) {
            onLogin(
              completed.user.email,
              completed.user.profile_photo_uri || undefined,
              completed.user.username,
              (completed.user.social_networks as any) || [],
              completed.token,
              completed.user.nationality,
              completed.user.preferred_language,
              !!completed.user.account_verified
            );
            return;
          }

          throw new Error(
            language === 'es'
              ? 'Tu cuenta existe, pero el perfil no está completado. Vuelve a registrarte y confirma el email desde el móvil.'
              : 'Your account exists, but the profile is not completed. Go back to signup and confirm the email on your phone.'
          );
        }

        throw err;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      const lower = String(message || '').toLowerCase();
      // Si backend devuelve un motivo (p.ej. cuenta bloqueada), lo mostramos.
      if (message && message.toLowerCase().includes('cuenta bloqueada')) {
        setErrorMessage(message);
      } else if (lower.includes('no se pudo conectar al servidor') || lower.includes('network request failed') || lower.includes('failed to fetch')) {
        setErrorMessage(message || (language === 'es' ? 'No se pudo conectar al servidor.' : 'Could not connect to the server.'));
      } else if (lower.includes('email not confirmed') || (lower.includes('confirm') && lower.includes('email'))) {
        setErrorMessage(language === 'es' ? 'Confirma tu email antes de iniciar sesión.' : 'Please confirm your email before signing in.');
      } else if (lower.includes('invalid login credentials')) {
        setErrorMessage(
          language === 'es'
            ? 'Credenciales inválidas. Si ya confirmaste el email, usa "¿Olvidaste tu contraseña?" para establecer una contraseña.'
            : 'Invalid credentials. If you already confirmed the email, use "Forgot your password?" to set a password.'
        );
      } else {
        setErrorMessage(t('login.invalidCredentials'));
        setTimeout(() => {
          setErrorMessage('');
        }, 1400);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const supabaseClient = supabase;
    if (!isSupabaseConfigured() || !supabaseClient) {
      setGoogleErrorMessage('Falta configurar Supabase (SUPABASE_URL / SUPABASE_ANON_KEY) en el frontend');
      return;
    }

    setSuppressNotices(true);
    setInfoMessage('');
    setIsGoogleLoading(true);
    setGoogleErrorMessage('');
    setErrorMessage('');

    if (googleErrorTimeoutRef.current) {
      clearTimeout(googleErrorTimeoutRef.current);
      googleErrorTimeoutRef.current = null;
    }

    try {
      const { data, error } = await supabaseClient.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: SUPABASE_REDIRECT_URL,
          // Some environments need these scopes explicitly; safe to keep.
          scopes: 'email profile',
          // Force the account chooser UI (similar to Spotify UX) instead of silently reusing
          // the last signed-in Google session.
          queryParams: {
            prompt: 'select_account',
          },
        },
      } as any);

      if (error) {
        throw new Error(error.message || 'No se pudo abrir Google');
      }

      const authUrl = (data as any)?.url ? String((data as any).url) : '';
      if (!authUrl) {
        throw new Error('No se pudo generar la URL de autenticación');
      }

      let callbackUrl: string | null = null;
      const available = await InAppBrowser.isAvailable().catch(() => false);

      // Prefer Custom Tabs / SFSafariViewController when available.
      // Fallback to external browser + deep-link callback.
      if (available) {
        try {
          const result = await InAppBrowser.openAuth(authUrl, SUPABASE_REDIRECT_URL, {
            showTitle: false,
            enableUrlBarHiding: true,
            enableDefaultShare: false,
            // iOS-only, ignored elsewhere
            ephemeralWebSession: true,
          } as any);

          if ((result as any)?.type === 'success' && (result as any)?.url) {
            callbackUrl = String((result as any).url);
          } else if ((result as any)?.type === 'cancel') {
            return;
          }
        } catch {
          // Ignore and fallback to Linking-based flow.
        }
      }

      if (!callbackUrl) {
        const canOpen = await Linking.canOpenURL(authUrl).catch(() => true);
        if (!canOpen) {
          throw new Error(language === 'es'
            ? 'No se pudo abrir el navegador para iniciar sesión con Google.'
            : 'Could not open a browser to sign in with Google.');
        }

        await Linking.openURL(authUrl);
        callbackUrl = await waitForSupabaseOAuthCallback();
      }

      if (!callbackUrl) {
        throw new Error('No se recibió callback de autenticación');
      }

      const callbackInfo = extractOAuthCallbackInfo(callbackUrl);
      if (callbackInfo.errorDescription) {
        throw new Error(callbackInfo.errorDescription);
      }

      // PKCE flow: extract `code` and exchange for session (preferred).
      // Fallback: implicit hash tokens (rare, but supported).
      const code = callbackInfo.code;
      if (!code && !(callbackInfo.accessTokenFromHash && callbackInfo.refreshTokenFromHash)) {
        throw new Error('OAuth cancelado o inválido');
      }

      // IMPORTANT:
      // The app also has a global deep-link handler (App.tsx) that may exchange the same code.
      // If that happens first, this exchange can fail with PKCE/verifier errors.
      // Treat that failure as non-fatal and continue if we already have a valid session.
      let accessToken: string | null = null;
      try {
        if (code) {
          const { data: sessionData, error: exchangeError } = await supabaseClient.auth.exchangeCodeForSession(code);
          if (!exchangeError) {
            accessToken = sessionData?.session?.access_token || null;
          }
        } else if (callbackInfo.accessTokenFromHash && callbackInfo.refreshTokenFromHash) {
          const { error: sessionError } = await supabaseClient.auth.setSession({
            access_token: callbackInfo.accessTokenFromHash,
            refresh_token: callbackInfo.refreshTokenFromHash,
          });
          if (!sessionError) {
            const session = (await supabaseClient.auth.getSession().catch(() => null))?.data?.session || null;
            accessToken = session?.access_token || null;
          }
        }
      } catch {
        // non-fatal; we'll try to read the current session below
      }

      if (!accessToken) {
        const session = (await supabaseClient.auth.getSession().catch(() => null))?.data?.session || null;
        accessToken = session?.access_token || null;
      }

      if (!accessToken) {
        throw new Error('No se obtuvo access_token');
      }

      try {
        const response = await exchangeSupabaseSession(accessToken);
        onLogin(
          response.user.email,
          response.user.profile_photo_uri || undefined,
          response.user.username,
          response.user.social_networks as any,
          response.token,
          response.user.nationality,
          response.user.preferred_language,
          !!response.user.account_verified
        );
      } catch (err: any) {
        const apiCode = err?.code || err?.details?.code;
        if (apiCode === 'PROFILE_NOT_FOUND') {
          // Ensure we don't keep an authenticated Supabase session for non-registered users.
          await supabaseClient.auth.signOut().catch(() => {});
          setGoogleErrorMessage(t('login.googleNotRegistered'));
          googleErrorTimeoutRef.current = setTimeout(() => {
            setGoogleErrorMessage('');
            googleErrorTimeoutRef.current = null;
          }, 4000);
          return;
        }

        throw err;
      }
    } catch (err) {
      const rawMessage = err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google';
      const lower = String(rawMessage || '').toLowerCase();
      const message = lower.includes('pkce') && lower.includes('code verifier')
        ? t('login.googlePkceMissing')
        : rawMessage;
      setGoogleErrorMessage(message);
      googleErrorTimeoutRef.current = setTimeout(() => {
        setGoogleErrorMessage('');
        googleErrorTimeoutRef.current = null;
      }, 4000);
    } finally {
      setIsGoogleLoading(false);
      setSuppressNotices(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar
        backgroundColor="#000000"
        barStyle="light-content"
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}>
        <View style={styles.content}>
          <View style={[styles.languageSwitcher, { top: 6 + androidTopInset }]}>
            <View style={[styles.languagePill, screenDisabled && styles.languagePillDisabled]}>
              <TouchableOpacity
                onPress={() => setLanguage('en')}
                activeOpacity={0.85}
                disabled={screenDisabled || language === 'en'}
                style={[styles.languagePillOption, language === 'en' && styles.languagePillOptionActive]}
              >
                <Text style={[styles.languagePillText, language === 'en' && styles.languagePillTextActive]}>EN</Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setLanguage('es')}
                activeOpacity={0.85}
                disabled={screenDisabled || language === 'es'}
                style={[styles.languagePillOption, language === 'es' && styles.languagePillOptionActive]}
              >
                <Text style={[styles.languagePillText, language === 'es' && styles.languagePillTextActive]}>ES</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Logo o título de la app */}
          <View style={styles.headerContainer}>
            <Image
              source={require('../../assets/images/logokeinti.png')}
              style={styles.logo}
              resizeMode="contain"
            />
          </View>

          {/* Formulario de inicio de sesión */}
          <View style={styles.formContainer}>
            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('login.email')}</Text>
              <TextInput
                style={styles.input}
                placeholder={t('login.emailPlaceholder')}
                placeholderTextColor="#989898ff"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoComplete="email"
                editable={!screenDisabled}
              />
            </View>

            <View style={styles.inputContainer}>
              <Text style={styles.label}>{t('login.password')}</Text>
              <View style={styles.passwordContainer}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder={t('login.passwordPlaceholder')}
                  placeholderTextColor="#989898ff"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  editable={!screenDisabled}
                />
                <TouchableOpacity
                  style={styles.eyeIcon}
                  onPress={() => setShowPassword(!showPassword)}
                  activeOpacity={0.7}
                  disabled={screenDisabled}>
                  <Icon
                    name={showPassword ? 'visibility' : 'visibility-off'}
                    size={18}
                    color="#ffb039ff"
                  />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.forgotPassword}
              onPress={openResetModal}
              activeOpacity={0.85}
              disabled={screenDisabled}
            >
              <View style={styles.forgotPasswordRow}>
                {forgotPasswordSegments.map((seg, idx) =>
                  seg.kind === 'highlight' ? (
                    <GradientText key={`forgot:${idx}`} style={styles.forgotPasswordTextHighlight}>
                      {seg.text}
                    </GradientText>
                  ) : (
                    <Text key={`forgot:${idx}`} style={[styles.forgotPasswordText, styles.forgotPasswordTextMuted]}>
                      {seg.text}
                    </Text>
                  )
                )}
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.loginButton,
                !isFormValid && styles.loginButtonDisabled,
              ]}
              onPress={handleLogin}
              activeOpacity={0.8}
              disabled={!isFormValid || screenDisabled}>
              {isLoading ? (
                <ActivityIndicator color="#FF9800" size="small" />
              ) : (
                <Text style={[
                  styles.loginButtonText,
                  !isFormValid && styles.loginButtonTextDisabled
                ]}>{t('login.signIn')}</Text>
              )}
            </TouchableOpacity>

            {/* Mensaje de error */}
            {errorMessage ? (
              <Text style={styles.errorText}>{errorMessage}</Text>
            ) : null}

            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>{t('common.or')}</Text>
              <View style={styles.dividerLine} />
            </View>

            <TouchableOpacity
              style={[styles.googleButton, (isLoading || isGoogleLoading) && styles.googleButtonDisabled]}
              onPress={handleGoogleLogin}
              activeOpacity={0.85}
              disabled={isLoading || isGoogleLoading}
            >
              {isGoogleLoading ? (
                <ActivityIndicator color="#FF9800" size="small" />
              ) : (
                <View style={styles.googleButtonInner}>
                  <GradientGoogleIcon size={18} />
                  <Text style={styles.googleButtonText}>Iniciar con Google</Text>
                </View>
              )}
            </TouchableOpacity>

            {googleErrorMessage ? (
              <Text style={styles.googleErrorText}>{googleErrorMessage}</Text>
            ) : null}

            <View style={styles.signupContainer}>
              <Text style={styles.signupText}>{t('login.noAccount')}</Text>
              <TouchableOpacity onPress={onNavigateToRegister} disabled={screenDisabled}>
                <GradientText style={styles.signupLink}>{t('login.signUp')}</GradientText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {isGoogleLoading ? (
        <View style={styles.fullScreenLoadingOverlay} pointerEvents="auto">
          <ActivityIndicator color="#FF9800" size="large" />
        </View>
      ) : null}

      {infoMessage && !googleErrorMessage && !isGoogleLoading ? (
        <View style={styles.toastContainer} pointerEvents="none">
          <Text style={styles.toastText}>{infoMessage}</Text>
        </View>
      ) : null}

      <PasswordResetModal
        visible={resetVisible}
        onClose={() => setResetVisible(false)}
        initialEmail={email}
        disabled={screenDisabled}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  languageSwitcher: {
    position: 'absolute',
    top: 6,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    zIndex: 10,
  },
  languagePill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 999,
    padding: 2,
  },
  languagePillDisabled: {
    opacity: 0.6,
  },
  languagePillOption: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  languagePillOptionActive: {
    backgroundColor: '#1e1e1e',
  },
  languagePillText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: '#5D4037',
  },
  languagePillTextActive: {
    color: '#FFB74D',
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 26,
  },
  logo: {
    width: 180,
    height: 180,
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 18,
    color: '#ffffffff',
  },
  formContainer: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffffff',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#1e1e1eff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#ffffffff',
    borderColor: '#FFB74D',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e1e1eff',
    borderRadius: 12,
    borderColor: '#FFB74D',
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
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  forgotPasswordText: {
    color: '#ffffffff',
    fontSize: 14,
    fontWeight: 'normal',
  },
  forgotPasswordTextMuted: {
    color: '#ffffffff',
  },
  forgotPasswordTextHighlight: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  loginButton: {
    backgroundColor: '#000000ff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: '#FFB74D',
    borderWidth: 2,
    borderColor: '#ff9900ff',
    shadowOffset: {
      width: 2,
      height: 2,
    },
    shadowOpacity: 4.2,
    shadowRadius: 2,
    elevation: 4,
  },
  loginButtonDisabled: {
    backgroundColor: '#000000ff',
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#5e3b06ff',
  },
  loginButtonText: {
    color: '#FFB74D',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginButtonTextDisabled: {
    color: '#4E342E',
  },
  errorText: {
    marginTop: 12,
    color: '#D84315',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  googleErrorText: {
    marginTop: 10,
    color: '#D84315',
    fontSize: 11,
    fontWeight: 'normal',
    textAlign: 'center',
  },
  toastContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 18,
    backgroundColor: '#0f0f0fff',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#232323ff',
    zIndex: 20,
  },
  toastText: {
    color: '#ffffffff',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  fullScreenLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 999,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 32,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#5D4037',
  },
  dividerText: {
    marginHorizontal: 16,
    color: '#5D4037',
    fontSize: 14,
  },
  googleButton: {
    backgroundColor: '#111111',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  googleButtonDisabled: {
    opacity: 0.6,
  },
  googleButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  signupContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  signupText: {
    color: '#ffffffff',
    fontSize: 14,
  },
  signupLink: {
    fontSize: 14,
    fontWeight: 'bold',
  },
});

export default LoginScreen;
