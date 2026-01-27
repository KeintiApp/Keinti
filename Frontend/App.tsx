import React, { useEffect, useState } from 'react';
import { Image, Linking, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LoginScreen from './src/screens/LoginScreen';
import RegisterScreen from './src/screens/RegisterScreen';
import FrontScreen from './src/screens/FrontScreen';
import Configuration from './src/screens/Configuration';
import { I18nProvider } from './src/i18n/I18nProvider';
import { type Language } from './src/i18n/translations';
import mobileAds from 'react-native-google-mobile-ads';
import { clearKeintiAuthSession, loadKeintiAuthSession, saveKeintiAuthSession } from './src/services/authSessionStorage';
import { completeSupabaseProfile, exchangeSupabaseSession, getAccountAuthStatus, getMyPersonalData, getUserByUsername } from './src/services/userService';
import { isSupabaseConfigured, supabase } from './src/config/supabase';

interface SocialNetwork {
  id: string;
  link: string;
}

type Screen = 'login' | 'register' | 'front' | 'configuration';

function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('login');
  const [isBootstrapping, setIsBootstrapping] = useState<boolean>(true);
  const [userEmail, setUserEmail] = useState<string>('');
  const [username, setUsername] = useState<string>('');
  const [profilePhotoUri, setProfilePhotoUri] = useState<string | undefined>();
  const [socialNetworks, setSocialNetworks] = useState<SocialNetwork[]>([]);
  const [authToken, setAuthToken] = useState<string>('');
  const [nationality, setNationality] = useState<string>('');
  const [language, setLanguage] = useState<Language>('en');
  const [accountVerified, setAccountVerified] = useState<boolean>(false);
  const [loginNotice, setLoginNotice] = useState<{ message: string; token: number } | null>(null);

  const pendingKeyForEmail = (e: string) => `keinti:pendingSignup:${String(e || '').trim().toLowerCase()}`;

  useEffect(() => {
    // Safe to call multiple times, but we only do it once.
    mobileAds()
      .initialize()
      .catch(err => {
        console.warn('AdMob init failed:', err);
      });
  }, []);

  // Global deep-link handler for Supabase PKCE callbacks.
  // Needed for email confirmation links (Confirm your email) because the app may open on Login.
  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      return;
    }

    let cancelled = false;

    const tryFinalizePendingSignup = async (accessToken: string) => {
      const session = (await supabase!.auth.getSession().catch(() => null))?.data?.session || null;
      const sessionEmail = session?.user?.email ? String(session.user.email).trim().toLowerCase() : '';
      if (!sessionEmail) return null;

      const raw = await AsyncStorage.getItem(pendingKeyForEmail(sessionEmail)).catch(() => null);
      if (!raw) return null;

      let pending: any = null;
      try {
        pending = JSON.parse(raw);
      } catch {
        pending = null;
      }

      const password = String(pending?.password || '');
      const username = String(pending?.username || '').trim();
      const birthDate = String(pending?.birthDate || '').trim();
      const gender = String(pending?.gender || '').trim();
      const nationality = String(pending?.nationality || '').trim();

      if (!username || !birthDate || !nationality) {
        // Pending data is incomplete; don't block the user.
        return null;
      }

      // Set password so email+password login works.
      if (password) {
        const { error: updateError } = await supabase!.auth.updateUser({ password });
        if (updateError) {
          // If this fails, still attempt profile completion.
          // Supabase may return this when re-applying the same password (e.g. user already had it).
          const msg = String(updateError.message || '').toLowerCase();
          const isSamePassword =
            msg.includes('should be different') ||
            msg.includes('different from the old password') ||
            msg.includes('same password');

          if (!isSamePassword) {
            console.warn('Supabase updateUser(password) failed:', updateError.message);
          }
        }
      }

      const completed = await completeSupabaseProfile(accessToken, {
        username,
        birthDate,
        gender,
        nationality,
      });

      await AsyncStorage.removeItem(pendingKeyForEmail(sessionEmail)).catch(() => {});
      return completed;
    };

    const handleSupabaseCallback = async (url: string) => {
      if (cancelled) return;
      const raw = String(url || '').trim();
      if (!raw) return;

      let parsed: URL;
      try {
        parsed = new URL(raw);
      } catch {
        return;
      }

      const errorDescription = parsed.searchParams.get('error_description');
      if (errorDescription) {
        console.warn('Supabase callback error_description:', errorDescription);
        if (!cancelled) {
          setLoginNotice({
            message: decodeURIComponent(errorDescription),
            token: Date.now(),
          });
        }
        return;
      }

      const code = parsed.searchParams.get('code');
      const hash = String(parsed.hash || '').replace(/^#/, '');

      // Supabase often includes a `type` query param for email confirmation flows (e.g. signup).
      // We use it to avoid showing signup-related notices for OAuth callbacks.
      const typeFromQuery = String(parsed.searchParams.get('type') || '').trim().toLowerCase();
      const typeFromHash = (() => {
        if (!hash) return '';
        try {
          return String(new URLSearchParams(hash).get('type') || '').trim().toLowerCase();
        } catch {
          return '';
        }
      })();
      const supabaseCallbackType = typeFromQuery || typeFromHash;
      const isSignupConfirmation = supabaseCallbackType === 'signup' || supabaseCallbackType === 'invite';

      // Some Supabase flows may return tokens in the hash.
      const trySetSessionFromHash = async () => {
        if (!hash) return;
        const params = new URLSearchParams(hash);
        const access_token = params.get('access_token');
        const refresh_token = params.get('refresh_token');
        if (access_token && refresh_token) {
          const { error } = await supabase!.auth.setSession({
            access_token,
            refresh_token,
          });
          if (error) {
            console.warn('supabase.auth.setSession from hash failed:', error.message);
          }
        }
      };

      if (code) {
        try {
          await supabase!.auth.exchangeCodeForSession(code);
        } catch (err) {
          // If the code was already exchanged, we may still have a valid session.
          console.warn('exchangeCodeForSession failed (non-fatal):', err);
        }
      } else {
        await trySetSessionFromHash().catch(() => {});
      }

      const session = (await supabase!.auth.getSession().catch(() => null))?.data?.session || null;
      const accessToken = session?.access_token;
      if (!accessToken) {
        // If we can't get a token, there's nothing to exchange/finalize.
        return;
      }

      // 1) If this was a signup confirmation, finalize pending profile + set password, then log in.
      try {
        const completed = await tryFinalizePendingSignup(accessToken);
        if (completed?.token && !cancelled) {
          handleLogin(
            completed.user.email,
            completed.user.profile_photo_uri || undefined,
            completed.user.username,
            completed.user.social_networks as any,
            completed.token,
            completed.user.nationality,
            completed.user.preferred_language,
            !!completed.user.account_verified
          );
          return;
        }
      } catch (err) {
        console.warn('Pending signup finalization failed:', err);
        // Continue with normal session exchange.
      }

      // 2) Otherwise, treat as a normal Supabase login (e.g. OAuth) and exchange to backend.
      try {
        const exchanged = await exchangeSupabaseSession(accessToken);
        if (cancelled) return;
        handleLogin(
          exchanged.user.email,
          exchanged.user.profile_photo_uri || undefined,
          exchanged.user.username,
          exchanged.user.social_networks as any,
          exchanged.token,
          exchanged.user.nationality,
          exchanged.user.preferred_language,
          !!exchanged.user.account_verified
        );
      } catch (err) {
        // If this fails we keep user on login.
        // PROFILE_NOT_FOUND is expected when an OAuth user hasn't completed in-app registration.
        const apiCode = (err as any)?.code || (err as any)?.details?.code;
        if (apiCode === 'PROFILE_NOT_FOUND') {
          return;
        }

        // Avoid noisy WARN logs in production builds.
        if (__DEV__) {
          const msg = err instanceof Error ? err.message : String(err || '');
          console.log('exchangeSupabaseSession after deep-link failed:', msg);
        }

        // Only show the email-confirmed notice for actual signup confirmation callbacks.
        if (!cancelled && isSignupConfirmation) {
          setLoginNotice({
            message: language === 'es'
              ? 'Email confirmado. Ahora inicia sesión.'
              : 'Email confirmed. Please sign in.',
            token: Date.now(),
          });
        }
      }
    };

    const checkInitial = async () => {
      const initialUrl = await Linking.getInitialURL().catch(() => null);
      if (cancelled) return;
      if (initialUrl) {
        await handleSupabaseCallback(initialUrl);
      }
    };

    const sub = Linking.addEventListener('url', ({ url }) => {
      handleSupabaseCallback(url);
    });

    checkInitial();

    return () => {
      cancelled = true;
      sub.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;

    const isLikelyAuthError = (err: unknown) => {
      const message = err instanceof Error ? err.message : String(err || '');
      const m = message.toLowerCase();
      return (
        m.includes('token') ||
        m.includes('jwt') ||
        m.includes('unauthorized') ||
        m.includes('no autorizado') ||
        m.includes('sesion') ||
        m.includes('sesión')
      );
    };

    const applySessionToState = (input: {
      token: string;
      email: string;
      username?: string;
      profilePhotoUri?: string;
      socialNetworks?: SocialNetwork[];
      nationality?: string;
      preferredLanguage?: string;
      accountVerified?: boolean;
    }) => {
      setLoginNotice(null);
      setAuthToken(String(input.token || '').trim());
      setUserEmail(String(input.email || '').trim());
      setUsername(String(input.username || ''));
      setProfilePhotoUri(input.profilePhotoUri);
      setSocialNetworks(Array.isArray(input.socialNetworks) ? input.socialNetworks : []);
      setNationality(String(input.nationality || ''));
      setAccountVerified(!!input.accountVerified);

      const normalized = String(input.preferredLanguage || '').trim().toLowerCase();
      if (normalized === 'es' || normalized === 'en') {
        setLanguage(normalized as Language);
      }

      setCurrentScreen('front');
    };

    const applyStoredSessionOptimistically = (stored: any) => {
      if (!stored?.token) return;
      applySessionToState({
        token: stored.token,
        email: stored.user?.email || '',
        username: stored.user?.username,
        profilePhotoUri: stored.user?.profilePhotoUri,
        socialNetworks: (stored.user?.socialNetworks as any) || [],
        nationality: stored.user?.nationality,
        preferredLanguage: stored.user?.preferredLanguage,
        accountVerified: !!stored.user?.accountVerified,
      });
    };

    const forceToLogin = async (notice?: string) => {
      await clearKeintiAuthSession().catch(() => {});
      if (!cancelled) {
        setUserEmail('');
        setUsername('');
        setProfilePhotoUri(undefined);
        setSocialNetworks([]);
        setAuthToken('');
        setNationality('');
        setLanguage('en');
        setAccountVerified(false);
        setCurrentScreen('login');
        if (notice) {
          setLoginNotice({ message: notice, token: Date.now() });
        } else {
          setLoginNotice(null);
        }
      }
    };

    const hydrateFromBackendToken = async (token: string, fallback?: {
      preferredLanguage?: 'es' | 'en';
      nationality?: string;
      username?: string;
      profilePhotoUri?: string;
      socialNetworks?: SocialNetwork[];
      accountVerified?: boolean;
      email?: string;
    }) => {
      const cleanToken = String(token || '').trim();
      if (!cleanToken) return false;

      const me = await getMyPersonalData(cleanToken);
      const email = String(me.email || '').trim() || String(fallback?.email || '').trim();
      const uname = (me.username ? String(me.username).trim() : '') || String(fallback?.username || '');

      let profile = fallback?.profilePhotoUri;
      let socials = Array.isArray(fallback?.socialNetworks) ? fallback?.socialNetworks : [];

      if (uname) {
        try {
          const userProfile = await getUserByUsername(uname);
          profile = userProfile?.profile_photo_uri ? String(userProfile.profile_photo_uri) : profile;
          socials = Array.isArray(userProfile?.social_networks) ? (userProfile.social_networks as SocialNetwork[]) : socials;
        } catch {
          // non-fatal
        }
      }

      let verified = !!fallback?.accountVerified;
      try {
        const status = await getAccountAuthStatus(cleanToken);
        verified = status?.account_verified === true;
      } catch {
        // non-fatal
      }

      if (cancelled) return false;

      applySessionToState({
        token: cleanToken,
        email,
        username: uname,
        profilePhotoUri: profile,
        socialNetworks: socials,
        nationality: me.nationality ? String(me.nationality) : (fallback?.nationality || ''),
        preferredLanguage: fallback?.preferredLanguage,
        accountVerified: verified,
      });

      saveKeintiAuthSession({
        token: cleanToken,
        user: {
          email,
          username: uname || undefined,
          profilePhotoUri: profile,
          socialNetworks: socials,
          nationality: me.nationality ? String(me.nationality) : fallback?.nationality,
          preferredLanguage: fallback?.preferredLanguage,
          accountVerified: verified,
        },
      }).catch(() => {});

      return true;
    };

    const bootstrap = async () => {
      // Goal: show UI fast. Don't block on network.
      const stored = await loadKeintiAuthSession().catch(() => null);

      if (stored?.token && !cancelled) {
        // Immediate optimistic restore to Front.
        applyStoredSessionOptimistically(stored);
        setIsBootstrapping(false);

        // Refresh/validate in background.
        hydrateFromBackendToken(stored.token, {
          email: stored.user?.email,
          username: stored.user?.username,
          profilePhotoUri: stored.user?.profilePhotoUri,
          socialNetworks: stored.user?.socialNetworks as any,
          nationality: stored.user?.nationality,
          preferredLanguage: stored.user?.preferredLanguage,
          accountVerified: stored.user?.accountVerified,
        }).catch(async (err) => {
          if (isLikelyAuthError(err)) {
            await forceToLogin(language === 'es' ? 'Sesión expirada. Inicia sesión de nuevo.' : 'Session expired. Please sign in again.');
          }
        });
        return;
      }

      // No stored backend session: show Login immediately.
      if (!cancelled) {
        setIsBootstrapping(false);
      }

      // Background: if user logged in with Google previously, Supabase may have a persisted session.
      if (isSupabaseConfigured() && supabase) {
        supabase.auth
          .getSession()
          .then(async ({ data }) => {
            const accessToken = data?.session?.access_token;
            if (!accessToken || cancelled) return;

            const exchanged = await exchangeSupabaseSession(accessToken);
            if (cancelled) return;

            const preferredLanguage = String(exchanged.user?.preferred_language || '').trim().toLowerCase();
            const normalizedPreferredLanguage =
              preferredLanguage === 'es' || preferredLanguage === 'en' ? (preferredLanguage as 'es' | 'en') : undefined;

            applySessionToState({
              token: exchanged.token,
              email: exchanged.user.email,
              username: exchanged.user.username,
              profilePhotoUri: exchanged.user.profile_photo_uri || undefined,
              socialNetworks: (exchanged.user.social_networks as any) || [],
              nationality: exchanged.user.nationality,
              preferredLanguage: normalizedPreferredLanguage,
              accountVerified: !!exchanged.user.account_verified,
            });

            await saveKeintiAuthSession({
              token: exchanged.token,
              user: {
                email: exchanged.user.email,
                username: exchanged.user.username,
                profilePhotoUri: exchanged.user.profile_photo_uri || undefined,
                socialNetworks: (exchanged.user.social_networks as any) || [],
                nationality: exchanged.user.nationality,
                preferredLanguage: normalizedPreferredLanguage,
                accountVerified: !!exchanged.user.account_verified,
              },
            });
          })
          .catch(() => {
            // ignore
          });
      }
    };

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  function handleLogin(
    email: string,
    photoUri?: string,
    user?: string,
    socials?: SocialNetwork[],
    token?: string,
    userNationality?: string,
    preferredLanguage?: string,
    isAccountVerified?: boolean,
  ) {
    setLoginNotice(null);
    setUserEmail(email);
    setUsername(user || '');
    setProfilePhotoUri(photoUri);
    setSocialNetworks(socials || []);
    setNationality(userNationality || '');
    setAccountVerified(!!isAccountVerified);

    const normalized = (preferredLanguage || '').toString().trim().toLowerCase();
    if (normalized === 'es' || normalized === 'en') {
      setLanguage(normalized as Language);
    }
    
    if (token) {
      setAuthToken(token);
    } else {
      console.warn('No se recibió token en el login');
    }

    if (token) {
      const normalized = (preferredLanguage || '').toString().trim().toLowerCase();
      saveKeintiAuthSession({
        token,
        user: {
          email,
          username: user || undefined,
          profilePhotoUri: photoUri,
          socialNetworks: socials || [],
          nationality: userNationality || undefined,
          preferredLanguage: normalized === 'es' || normalized === 'en' ? (normalized as any) : undefined,
          accountVerified: !!isAccountVerified,
        },
      }).catch(() => {});
    }
    
    setCurrentScreen('front');
  }

  const handleRegisterSuccess = () => {
    setLoginNotice(null);
    setCurrentScreen('login');
  };

  const handleLogout = () => {
    setLoginNotice(null);
    setUserEmail('');
    setUsername('');
    setProfilePhotoUri(undefined);
    setSocialNetworks([]);
    setAuthToken('');
    setLanguage('en');
    setAccountVerified(false);
    setCurrentScreen('login');

    clearKeintiAuthSession().catch(() => {});
    if (isSupabaseConfigured() && supabase) {
      supabase.auth.signOut().catch(() => {});
    }
  };

  return (
    <I18nProvider language={language} setLanguage={setLanguage}>
      {isBootstrapping ? (
        <SafeAreaView style={styles.bootContainer}>
          <View style={styles.bootCenter}>
            <Image
              source={require('./assets/images/logokeinti3.png')}
              style={styles.bootLogo}
              resizeMode="contain"
            />
          </View>
        </SafeAreaView>
      ) : null}

      {!isBootstrapping && currentScreen === 'login' && (
        <LoginScreen
          onLogin={handleLogin}
          onNavigateToRegister={() => {
            setLoginNotice(null);
            setCurrentScreen('register');
          }}
          noticeMessage={loginNotice?.message}
          noticeToken={loginNotice?.token}
        />
      )}

      {!isBootstrapping && currentScreen === 'register' && (
        <RegisterScreen
          onBack={(options) => {
            if (options?.noticeMessage) {
              setLoginNotice({ message: options.noticeMessage, token: Date.now() });
            } else {
              setLoginNotice(null);
            }
            setCurrentScreen('login');
          }}
          onRegisterSuccess={handleRegisterSuccess}
        />
      )}

      {!isBootstrapping && currentScreen === 'front' && (
        <FrontScreen
          userEmail={userEmail}
          username={username}
          initialProfilePhotoUri={profilePhotoUri}
          initialSocialNetworks={socialNetworks}
          onProfilePhotoUriChange={setProfilePhotoUri}
          onSocialNetworksChange={setSocialNetworks}
          nationality={nationality}
          accountVerified={accountVerified}
          onLogout={handleLogout}
          giveAways={[]}
          authToken={authToken}
          onNavigateToConfiguration={() => setCurrentScreen('configuration')}
        />
      )}

      {!isBootstrapping && currentScreen === 'configuration' && (
        <Configuration
          onBack={() => setCurrentScreen('front')}
          authToken={authToken}
          onLogout={handleLogout}
          onAccountVerifiedChange={(v) => setAccountVerified(!!v)}
        />
      )}
    </I18nProvider>
  );
}

const styles = StyleSheet.create({
  bootContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  bootCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  bootLogo: {
    width: 148,
    height: 148,
  },
});

export default App;
