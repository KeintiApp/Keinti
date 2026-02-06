import { API_URL } from '../config/api';

interface LoginPayload {
  email: string;
  password: string;
}

interface RegisterPayload {
  email: string;
  username: string;
  password: string;
  birthDate: string;
  gender: string;
  nationality: string;
}

type ApiErrorShape = {
  error?: string;
  code?: string;
  remainingAttempts?: number;
  lockedUntil?: string;
  expiresInSeconds?: number;
  sendCount?: number;
};

class ApiError extends Error {
  status?: number;
  code?: string;
  details?: ApiErrorShape;

  constructor(message: string, status?: number, details?: ApiErrorShape) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = details?.code;
    this.details = details;
  }
}

interface SocialNetwork {
  id: string;
  link: string;
}

export const updatePreferredLanguage = async (data: { token: string; language: 'es' | 'en' }) => {
  const response = await fetch(`${API_URL}/api/users/language`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.token}`,
    },
    body: JSON.stringify({ language: data.language }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al actualizar idioma');
  }

  return response.json();
};

export const uploadImage = async (
  imageUri: string,
  token: string,
  options?: { postId?: string | number; groupId?: string | number; timeoutMs?: number }
) => {
  try {
    const normalizeUploadUri = (raw: string) => {
      const uri = String(raw || '').trim();
      if (!uri) return uri;

      // Keep already-valid schemes.
      if (/^(https?:|content:|data:)/i.test(uri)) return uri;

      // Normalize file URIs. Some Android stacks fail when the URI is malformed
      // (e.g. `file://storage/...` treating `storage` as host, or `file:/...`).
      if (/^file:/i.test(uri)) {
        let fileUri = uri;
        // Normalize `file:/...` and `file://...` to `file:///...`
        fileUri = fileUri.replace(/^file:\/*/i, 'file:///');

        // IMPORTANT:
        // For an absolute POSIX path `/storage/...`, the canonical URI is `file:///storage/...`
        // (three slashes). Do NOT add an extra slash, otherwise you get `file:////storage/...`
        // which some Android/RN stacks fail to read when building multipart uploads.

        // Encode only spaces and a couple of unsafe chars; full encodeURI can be lossy for file paths.
        return fileUri.replace(/ /g, '%20').replace(/#/g, '%23');
      }

      // Windows absolute path -> file URI
      if (/^[A-Za-z]:\\/.test(uri)) {
        const fileUri = `file:///${uri.replace(/\\/g, '/')}`;
        return fileUri.replace(/ /g, '%20').replace(/#/g, '%23');
      }
      // Android absolute path
      if (uri.startsWith('/')) {
        const fileUri = `file://${uri}`;
        return fileUri.replace(/ /g, '%20').replace(/#/g, '%23');
      }

      // Some pickers may return absolute-like paths missing the leading slash.
      // Example: `storage/emulated/0/...` -> `/storage/emulated/0/...`
      if (/(^storage\/|^data\/|^var\/|^private\/)/i.test(uri)) {
        const fileUri = `file:///${'/' + uri}`;
        return fileUri.replace(/ /g, '%20').replace(/#/g, '%23');
      }

      return uri;
    };

    const guessMimeType = (uri: string) => {
      const u = uri.toLowerCase();
      if (u.endsWith('.png')) return 'image/png';
      if (u.endsWith('.webp')) return 'image/webp';
      if (u.endsWith('.heic')) return 'image/heic';
      if (u.endsWith('.heif')) return 'image/heif';
      if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
      return 'image/jpeg';
    };

    const normalizedUri = normalizeUploadUri(imageUri);
    const mimeType = guessMimeType(normalizedUri);
    const fileName = `upload.${mimeType.split('/')[1] || 'jpg'}`;

    // Some Android stacks are picky about file:// URI formatting.
    const finalUri = normalizedUri;

    const formData = new FormData();
    formData.append('image', {
      uri: finalUri,
      type: mimeType,
      name: fileName,
    } as any);

    if (options?.postId !== undefined && options?.postId !== null && String(options.postId).trim() !== '') {
      formData.append('postId', String(options.postId));
    }

    if (options?.groupId !== undefined && options?.groupId !== null && String(options.groupId).trim() !== '') {
      formData.append('groupId', String(options.groupId));
    }

    const controller = new AbortController();
    // En RN a veces la subida puede quedarse “colgada” por conectividad/intermitencias.
    // Un timeout hace que el usuario no espere indefinidamente.
    const requestedTimeout = Number(options?.timeoutMs);
    const timeoutMs = Number.isFinite(requestedTimeout) && requestedTimeout > 0
      ? Math.min(Math.max(requestedTimeout, 10_000), 300_000)
      : 60_000;
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        // IMPORTANT: do not set Content-Type for multipart; RN will add the boundary.
        'Accept': 'application/json',
      },
      body: formData,
      signal: controller.signal as any,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error('Error al subir imagen');
    }

    const data = await response.json();
    return `${API_URL}${data.url}`; // Retorna la URL completa
  } catch (error) {
    // AbortController timeout
    if (error instanceof Error && (error.name === 'AbortError' || /aborted/i.test(error.message))) {
      const wrapped = new Error('La subida de la imagen tardó demasiado y se canceló. Revisa tu conexión o inténtalo con una imagen más pequeña.');
      (wrapped as any).cause = error;
      console.error('Error uploading image:', wrapped);
      throw wrapped;
    }

    // Improve the common RN error to help diagnose file URI problems.
    if (error instanceof Error && /Network request failed/i.test(error.message)) {
      const hint = 'Fallo de red en la subida. Suele ocurrir si el archivo local no se puede leer (ruta inválida o con espacios sin codificar) o si el backend no es accesible.';
      const wrapped = new Error(hint);
      (wrapped as any).cause = error;
      console.error('Error uploading image:', wrapped);
      throw wrapped;
    }

    console.error('Error uploading image:', error);
    throw error;
  }
};

export const deleteDraftUploadedImageByUrl = async (
  imageUrl: string,
  token: string
): Promise<{ ok: boolean; skipped?: boolean }> => {
  const url = String(imageUrl || '').trim();
  if (!url) return { ok: false, skipped: true };

  // Only handle images served through our backend uploader.
  const match = url.match(/\/api\/upload\/image\/(\d+)(?:\?|$)/i);
  const id = match ? Number(match[1]) : NaN;
  if (!Number.isFinite(id) || id <= 0) {
    return { ok: false, skipped: true };
  }

  const response = await fetch(`${API_URL}/api/upload/image/${id}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  // Treat not-found as already deleted.
  if (response.status === 404) return { ok: true };
  if (response.ok) return { ok: true };

  // 409 can mean "still in use" or "belongs to post/group"; caller may ignore.
  const data = await response.json().catch(() => ({}));
  throw new ApiError((data as any)?.error || 'Error al eliminar imagen', response.status, data as any);
};

export const loginUser = async (credentials: LoginPayload) => {
  try {
    console.log('🔍 Intentando conectar a:', `${API_URL}/api/auth/login`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(credentials),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    console.log('✅ Respuesta recibida, status:', response.status);

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Error al iniciar sesión');
    }

    return response.json();
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        throw new Error('Tiempo de espera agotado. Verifica tu conexión a Internet.');
      }
      if (error.message === 'Network request failed') {
        throw new Error(`No se pudo conectar al servidor en ${API_URL}. Verifica que el backend esté corriendo y que tu móvil esté en la misma red WiFi.`);
      }
    }
    throw error;
  }
};

export const exchangeSupabaseSession = async (accessToken: string) => {
  const token = String(accessToken || '').trim();
  if (!token) {
    throw new Error('Token de sesión inválido');
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}/api/auth/session/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ access_token: token }),
    });
  } catch (err: any) {
    const rawMessage = err instanceof Error ? err.message : String(err || '');
    const lower = rawMessage.toLowerCase();

    if (lower.includes('network request failed') || lower.includes('failed to fetch') || lower.includes('networkerror')) {
      throw new Error(
        `No se pudo conectar al servidor (${API_URL}). ` +
          'En builds Release (Google Play) asegúrate de configurar un backend público HTTPS en Frontend/src/config/api.ts (PROD_API_URL).'
      );
    }

    throw err;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as any)?.error || 'No se pudo iniciar sesión';
    throw new ApiError(message, response.status, data as any);
  }

  return data as {
    token: string;
    user: {
      email: string;
      username?: string;
      profile_photo_uri?: string;
      social_networks?: any[];
      nationality?: string;
      preferred_language?: string;
      account_verified?: boolean;
    };
  };
};

export const completeSupabaseProfile = async (
  accessToken: string,
  params: {
    username: string;
    birthDate?: string;
    nationality?: string;
    gender?: string;
    preferred_language?: string;
  }
) => {
  const token = String(accessToken || '').trim();
  if (!token) {
    throw new Error('Token de sesión inválido');
  }

  const response = await fetch(`${API_URL}/api/auth/profile/complete`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      username: String(params?.username || '').trim(),
      birthDate: params?.birthDate,
      nationality: String(params?.nationality || '').trim(),
      gender: params?.gender,
      preferred_language: String(params?.preferred_language || '').trim(),
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = (data as any)?.error || 'No se pudo completar el perfil';
    throw new ApiError(message, response.status, data as any);
  }

  return data as {
    token: string;
    user: {
      email: string;
      username?: string;
      profile_photo_uri?: string;
      social_networks?: any[];
      nationality?: string;
      preferred_language?: string;
      account_verified?: boolean;
    };
  };
};

export const registerUser = async (userData: RegisterPayload) => {
  try {
    console.log('Intentando conectar a:', `${API_URL}/api/auth/register`);
    
    const response = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify(userData),
    });

    console.log('Respuesta recibida, status:', response.status);

    if (!response.ok) {
      const error = await response.json();
      console.error('Error del servidor:', error);
      throw new Error(error.error || 'Error al registrarse');
    }

    const result = await response.json();
    console.log('Registro exitoso:', result);
    return result;
  } catch (error) {
    console.error('Error en registerUser:', error);
    if (error instanceof TypeError && error.message === 'Network request failed') {
      throw new Error(`No se pudo conectar al servidor. Verifica que el backend esté ejecutándose en ${API_URL}`);
    }
    throw error;
  }
};

export const requestEmailVerificationCode = async (email: string) => {
  const response = await fetch(`${API_URL}/api/auth/email/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = (await response.json().catch(() => ({}))) as ApiErrorShape & {
    ok?: boolean;
    expiresInSeconds?: number;
    sendCount?: number;
  };

  if (!response.ok) {
    throw new ApiError(data?.error || 'No se pudo enviar el código', response.status, data);
  }

  return data;
};

export const checkEmailRegistered = async (email: string) => {
  const url = `${API_URL}/api/auth/email/is-registered?email=${encodeURIComponent(String(email || '').trim())}`;
  const response = await fetch(url, { method: 'GET' });

  const data = (await response.json().catch(() => ({}))) as ApiErrorShape & { registered?: boolean };

  if (!response.ok) {
    throw new ApiError(data?.error || 'No se pudo comprobar el email', response.status, data);
  }

  return { registered: data?.registered === true };
};

export const checkUsernameRegistered = async (username: string) => {
  const url = `${API_URL}/api/auth/username/is-registered?username=${encodeURIComponent(String(username || '').trim())}`;
  const response = await fetch(url, { method: 'GET' });

  const data = (await response.json().catch(() => ({}))) as ApiErrorShape & { registered?: boolean };

  if (!response.ok) {
    throw new ApiError(data?.error || 'No se pudo comprobar el nombre de usuario', response.status, data);
  }

  return { registered: data?.registered === true };
};

export const verifyEmailVerificationCode = async (params: { email: string; code: string }) => {
  const response = await fetch(`${API_URL}/api/auth/email/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await response.json().catch(() => ({}))) as ApiErrorShape & { ok?: boolean; verified?: boolean };

  if (!response.ok) {
    throw new ApiError(data?.error || 'No se pudo verificar el código', response.status, data);
  }

  return data;
};

export const requestPasswordResetCode = async (email: string) => {
  const response = await fetch(`${API_URL}/api/auth/password-reset/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = (await response.json().catch(() => ({}))) as ApiErrorShape & {
    ok?: boolean;
    expiresInSeconds?: number;
    sendCount?: number;
  };

  if (!response.ok) {
    throw new ApiError(data?.error || 'No se pudo enviar el código', response.status, data);
  }

  return data;
};

export const verifyPasswordResetCode = async (params: { email: string; code: string }) => {
  const response = await fetch(`${API_URL}/api/auth/password-reset/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await response.json().catch(() => ({}))) as ApiErrorShape & {
    ok?: boolean;
    verified?: boolean;
    resetToken?: string;
    resetTokenExpiresInSeconds?: number;
  };

  if (!response.ok) {
    throw new ApiError(data?.error || 'No se pudo verificar el código', response.status, data);
  }

  return data;
};

export const confirmPasswordReset = async (params: { email: string; resetToken: string; newPassword: string }) => {
  const response = await fetch(`${API_URL}/api/auth/password-reset/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = (await response.json().catch(() => ({}))) as ApiErrorShape & { ok?: boolean };
  if (!response.ok) {
    throw new ApiError(data?.error || 'No se pudo cambiar la contraseña', response.status, data);
  }
  return data;
};

export const cancelEmailVerificationCode = async (email: string) => {
  const response = await fetch(`${API_URL}/api/auth/email/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });

  const data = (await response.json().catch(() => ({}))) as ApiErrorShape & { ok?: boolean };
  if (!response.ok) {
    throw new ApiError(data?.error || 'No se pudo cancelar la verificación', response.status, data);
  }
  return data;
};

export interface SignupAttemptsStatus {
  attemptsUsed: number;
  maxAttempts: number;
  locked: boolean;
  lockedUntil: string | null;
}

/**
 * Called when the 5-minute confirmation timer expires without the user
 * clicking the confirmation link. Records the failed attempt on the backend,
 * deletes the unconfirmed Supabase Auth user, and returns updated attempt info.
 */
export const cancelExpiredSignup = async (email: string): Promise<SignupAttemptsStatus & { ok: boolean }> => {
  const response = await fetch(`${API_URL}/api/auth/signup/cancel-expired`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: String(email || '').trim() }),
  });

  const data = (await response.json().catch(() => ({}))) as ApiErrorShape & SignupAttemptsStatus & { ok?: boolean };
  if (!response.ok) {
    throw new ApiError(data?.error || 'No se pudo cancelar el registro expirado', response.status, data);
  }
  return data as SignupAttemptsStatus & { ok: boolean };
};

/**
 * Check whether an email is locked due to too many failed signup attempts.
 */
export const getSignupAttemptsStatus = async (email: string): Promise<SignupAttemptsStatus> => {
  const encoded = encodeURIComponent(String(email || '').trim());
  const response = await fetch(`${API_URL}/api/auth/signup/attempts-status?email=${encoded}`, {
    method: 'GET',
    headers: { 'Content-Type': 'application/json' },
  });

  const data = (await response.json().catch(() => ({}))) as ApiErrorShape & SignupAttemptsStatus;
  if (!response.ok) {
    throw new ApiError(data?.error || 'No se pudo verificar el estado de intentos', response.status, data);
  }
  return data;
};

export const submitEmailRectification = async (params: { email: string; message: string }) => {
  const response = await fetch(`${API_URL}/api/auth/email/rectification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: String(params?.email || '').trim(),
      message: String(params?.message || '').trim(),
    }),
  });

  const data = (await response.json().catch(() => ({}))) as ApiErrorShape & { ok?: boolean };
  if (!response.ok) {
    throw new ApiError(data?.error || 'No se pudo enviar la rectificación', response.status, data);
  }

  return data;
};

export const updateProfilePhoto = async (data: {token: string; photoUri: string}) => {
  const normalizeUploadUri = (raw: string) => {
    const uri = String(raw || '').trim();
    if (!uri) return uri;

    // Keep already-valid schemes.
    if (/^(https?:|content:|data:)/i.test(uri)) return uri;

    // Normalize file URIs.
    if (/^file:/i.test(uri)) {
      let fileUri = uri;
      // Normalize `file:/...` and `file://...` to `file:///...`
      fileUri = fileUri.replace(/^file:\/*/i, 'file:///');
      return fileUri.replace(/ /g, '%20').replace(/#/g, '%23');
    }

    // Windows absolute path -> file URI
    if (/^[A-Za-z]:\\/.test(uri)) {
      const fileUri = `file:///${uri.replace(/\\/g, '/')}`;
      return fileUri.replace(/ /g, '%20').replace(/#/g, '%23');
    }

    // Android absolute path
    if (uri.startsWith('/')) {
      const fileUri = `file://${uri}`;
      return fileUri.replace(/ /g, '%20').replace(/#/g, '%23');
    }

    // Some pickers may return absolute-like paths missing the leading slash.
    if (/(^storage\/|^data\/|^var\/|^private\/)/i.test(uri)) {
      const fileUri = `file:///${'/' + uri}`;
      return fileUri.replace(/ /g, '%20').replace(/#/g, '%23');
    }

    return uri;
  };

  const guessMimeType = (uri: string) => {
    const u = uri.toLowerCase();
    if (u.endsWith('.png')) return 'image/png';
    if (u.endsWith('.webp')) return 'image/webp';
    if (u.endsWith('.heic')) return 'image/heic';
    if (u.endsWith('.heif')) return 'image/heif';
    if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
    return 'image/jpeg';
  };

  const finalUri = normalizeUploadUri(data.photoUri);
  const mimeType = guessMimeType(finalUri);
  const fileName = `profile.${mimeType.split('/')[1] || 'jpg'}`;

  const formData = new FormData();
  formData.append('photo', {
    uri: finalUri,
    type: mimeType,
    name: fileName,
  } as any);

  const response = await fetch(`${API_URL}/api/users/profile-photo`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${data.token}`,
      // IMPORTANT: do not set Content-Type for multipart; RN will add the boundary.
      'Accept': 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al actualizar foto');
  }

  return response.json();
};

export const updateSocialNetworks = async (data: {
  token: string;
  socialNetworks: SocialNetwork[];
}) => {
  const response = await fetch(`${API_URL}/api/users/social-networks`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${data.token}`,
    },
    body: JSON.stringify({social_networks: data.socialNetworks}),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Error al actualizar redes sociales');
  }

  return response.json();
};


export type AccountAuthStatusResponse = {
  selfie: {
    status: 'not_submitted' | 'pending' | 'accepted' | 'failed';
    submitted_at: string | null;
    reviewed_at: string | null;
    fail_reason: string | null;
    blocked?: boolean;
    blocked_reason?: string | null;
  };
  totp: {
    enabled: boolean;
    enabled_at: string | null;
  };
  account_verified: boolean;
  account_verified_at: string | null;
  account_verified_expires_at?: string | null;
  keinti_verified?: boolean;
  keinti_verified_at?: string | null;
  step2_available: boolean;
};

export const getAccountAuthStatus = async (token: string): Promise<AccountAuthStatusResponse> => {
  const response = await fetch(`${API_URL}/api/account-auth/status`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al obtener estado');
  }

  return response.json();
};

export const verifyKeintiAccount = async (
  token: string
): Promise<{ ok: boolean; keinti_verified: boolean; keinti_verified_at?: string | null; alreadyVerified?: boolean }> => {
  const response = await fetch(`${API_URL}/api/account-auth/keinti/verify`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error((data as any)?.error || 'No se pudo verificar');
  }

  return data;
};

export const recordIntimidadesOpen = async (token: string, postId: string | number): Promise<{ ok: boolean; counted: boolean }> => {
  const id = Number(postId);
  const response = await fetch(`${API_URL}/api/posts/${id}/intimidades/open`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al registrar apertura');
  }

  return response.json();
};

export const getMyIntimidadesOpensProgress = async (token: string): Promise<{ total: number }> => {
  const response = await fetch(`${API_URL}/api/posts/me/intimidades/opens-progress`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al obtener progreso');
  }

  return response.json();
};

export const getMyProfilePublishesProgress = async (token: string): Promise<{ total: number }> => {
  const response = await fetch(`${API_URL}/api/posts/me/profile/publishes-progress`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al obtener progreso');
  }

  return response.json();
};

export const getMyChannelJoinsProgress = async (token: string): Promise<{ total: number }> => {
  const response = await fetch(`${API_URL}/api/channels/me/joins-progress`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al obtener progreso');
  }

  return response.json();
};

export const getMyGroupsActiveMembersProgress = async (
  token: string
): Promise<{ groupsCreated: number; activeMembers: number }> => {
  const response = await fetch(`${API_URL}/api/groups/me/active-members-progress`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al obtener progreso');
  }

  return response.json();
};

export const uploadAccountSelfie = async (imageUri: string, token: string) => {
  const normalizeUploadUri = (raw: string) => {
    const uri = String(raw || '').trim();
    if (!uri) return uri;
    if (/^(https?:|content:|data:)/i.test(uri)) return uri;
    if (/^file:/i.test(uri)) {
      let fileUri = uri;
      fileUri = fileUri.replace(/^file:\/*/i, 'file:///');
      return fileUri.replace(/ /g, '%20').replace(/#/g, '%23');
    }
    if (/^[A-Za-z]:\\/.test(uri)) {
      const fileUri = `file:///${uri.replace(/\\/g, '/')}`;
      return fileUri.replace(/ /g, '%20').replace(/#/g, '%23');
    }
    if (uri.startsWith('/')) {
      const fileUri = `file://${uri}`;
      return fileUri.replace(/ /g, '%20').replace(/#/g, '%23');
    }
    return uri;
  };

  const guessMimeType = (uri: string) => {
    const u = uri.toLowerCase();
    if (u.endsWith('.png')) return 'image/png';
    if (u.endsWith('.webp')) return 'image/webp';
    if (u.endsWith('.heic')) return 'image/heic';
    if (u.endsWith('.heif')) return 'image/heif';
    if (u.endsWith('.jpg') || u.endsWith('.jpeg')) return 'image/jpeg';
    return 'image/jpeg';
  };

  const finalUri = normalizeUploadUri(imageUri);
  const mimeType = guessMimeType(finalUri);
  const fileName = `selfie.${mimeType.split('/')[1] || 'jpg'}`;

  const formData = new FormData();
  formData.append('selfie', {
    uri: finalUri,
    type: mimeType,
    name: fileName,
  } as any);

  const response = await fetch(`${API_URL}/api/account-auth/selfie`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al subir selfie');
  }

  return response.json();
};

export type AdminPendingSelfieItem = {
  email: string;
  username?: string;
  submitted_at: string | null;
  image_url?: string | null;
  image_path?: string | null;
  selfie_image_id?: number | null;
};

export const getAdminPendingAccountSelfies = async (token: string): Promise<{ items: AdminPendingSelfieItem[] }> => {
  const response = await fetch(`${API_URL}/api/account-auth/admin/pending-selfies`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as any)?.error || 'Error al obtener selfies pendientes');
  }

  const raw = Array.isArray((data as any)?.items) ? (data as any).items : [];
  const items: AdminPendingSelfieItem[] = raw.map((it: any) => ({
    email: String(it?.email || '').trim(),
    username: it?.username ? String(it.username).trim() : undefined,
    submitted_at: it?.submitted_at ?? null,
    image_url: it?.image_url ?? null,
    image_path: it?.image_path ?? null,
    selfie_image_id: Number.isFinite(Number(it?.selfie_image_id)) ? Number(it.selfie_image_id) : null,
  })).filter((it: AdminPendingSelfieItem) => !!it.email);

  return { items };
};

export type AdminBlockedSelfieItem = {
  email: string;
  username?: string;
  blocked_at: string | null;
  reason: string | null;
};

export const getAdminBlockedAccountSelfies = async (token: string): Promise<{ items: AdminBlockedSelfieItem[] }> => {
  const response = await fetch(`${API_URL}/api/account-auth/admin/blocked-selfies`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as any)?.error || 'Error al obtener bloqueos');
  }

  const raw = Array.isArray((data as any)?.items) ? (data as any).items : [];
  const items: AdminBlockedSelfieItem[] = raw.map((it: any) => ({
    email: String(it?.email || '').trim(),
    username: it?.username ? String(it.username).trim() : undefined,
    blocked_at: it?.blocked_at ?? null,
    reason: it?.reason ?? null,
  })).filter((it: AdminBlockedSelfieItem) => !!it.email);

  return { items };
};

export type AdminSelfieReviewAction = 'accepted' | 'failed' | 'blocked' | 'unblocked';

export const adminReviewAccountSelfie = async (
  token: string,
  params: { email: string; action: AdminSelfieReviewAction; reason?: string }
): Promise<{ ok: boolean }> => {
  const response = await fetch(`${API_URL}/api/account-auth/admin/selfie-review`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      email: params.email,
      action: params.action,
      reason: params.reason,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error((data as any)?.error || 'Error al aplicar revisión');
  }

  return data as any;
};

export const getTotpSetup = async (token: string): Promise<{ secret: string; otpauth_url: string }> => {
  const response = await fetch(`${API_URL}/api/account-auth/totp/setup`, {
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al generar configuración');
  }

  return response.json();
};

export const verifyTotpCode = async (token: string, code: string): Promise<{ account_verified: boolean }> => {
  const response = await fetch(`${API_URL}/api/account-auth/totp/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ code }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al verificar código');
  }

  return response.json();
};

export const getUserByUsername = async (username: string) => {
  const response = await fetch(`${API_URL}/api/users/profile/${username}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Usuario no encontrado');
  }

  return response.json();
};

export const deleteMyAccount = async (token: string) => {
  const response = await fetch(`${API_URL}/api/users/me`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al eliminar la cuenta');
  }

  return response.json();
};

export type MyPersonalData = {
  email: string;
  username?: string;
  birth_date: string | null;
  gender?: string;
  nationality?: string;
  gallery_permission_granted?: boolean;
  gallery_permission_updated_at?: string | null;
  is_admin?: boolean;
};

export const getMyPersonalData = async (token: string): Promise<MyPersonalData> => {
  const response = await fetch(`${API_URL}/api/users/me`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al obtener tus datos');
  }

  const data = await response.json();
  return {
    email: String(data?.email || '').trim(),
    username: data?.username ? String(data.username).trim() : undefined,
    birth_date: data?.birth_date ?? null,
    gender: data?.gender ? String(data.gender).trim() : undefined,
    nationality: data?.nationality ? String(data.nationality).trim() : undefined,
    gallery_permission_granted: (data as any)?.gallery_permission_granted === true,
    gallery_permission_updated_at:
      typeof (data as any)?.gallery_permission_updated_at === 'string' ? (data as any).gallery_permission_updated_at : null,
    is_admin: (data as any)?.is_admin === true,
  };
};

export const updateMyNationality = async (token: string, nationality: string): Promise<{ nationality: string }> => {
  const response = await fetch(`${API_URL}/api/users/me/nationality`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ nationality }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al actualizar nacionalidad');
  }

  const data = await response.json();
  return {
    nationality: String(data?.nationality || '').trim(),
  };
};

export type DevicePermissions = {
  galleryPermissionGranted: boolean;
  updatedAt: string | null;
};

export const getMyDevicePermissions = async (token: string): Promise<DevicePermissions> => {
  const response = await fetch(`${API_URL}/api/users/me/device-permissions`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al obtener permisos del dispositivo');
  }

  const data = await response.json();
  return {
    galleryPermissionGranted: (data as any)?.galleryPermissionGranted === true,
    updatedAt: typeof (data as any)?.updatedAt === 'string' ? (data as any).updatedAt : null,
  };
};

export const setMyDevicePermissions = async (token: string, next: { galleryPermissionGranted: boolean }): Promise<DevicePermissions> => {
  const response = await fetch(`${API_URL}/api/users/me/device-permissions`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ galleryPermissionGranted: next.galleryPermissionGranted }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al actualizar permisos del dispositivo');
  }

  const data = await response.json();
  return {
    galleryPermissionGranted: (data as any)?.galleryPermissionGranted === true,
    updatedAt: typeof (data as any)?.updatedAt === 'string' ? (data as any).updatedAt : null,
  };
};

export type UiHints = {
  homeSwipeTutorialSeen: boolean;
};

export const getMyUiHints = async (token: string): Promise<UiHints> => {
  const response = await fetch(`${API_URL}/api/users/me/ui-hints`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al obtener ui-hints');
  }

  const data = await response.json();
  return {
    homeSwipeTutorialSeen: (data as any)?.homeSwipeTutorialSeen === true,
  };
};

export const setMyUiHints = async (token: string, next: UiHints): Promise<UiHints> => {
  const response = await fetch(`${API_URL}/api/users/me/ui-hints`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ homeSwipeTutorialSeen: next.homeSwipeTutorialSeen }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al actualizar ui-hints');
  }

  const data = await response.json();
  return {
    homeSwipeTutorialSeen: (data as any)?.homeSwipeTutorialSeen === true,
  };
};

export type VerifyPasswordResult =
  | { ok: true }
  | { ok: false; attemptsRemaining?: number; locked?: boolean; lockUntil?: string; accountLocked?: boolean; message?: string };

export const verifyMyPassword = async (token: string, password: string): Promise<VerifyPasswordResult> => {
  const response = await fetch(`${API_URL}/api/users/verify-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ password }),
  });

  if (response.ok) {
    return { ok: true };
  }

  const data = await response.json().catch(() => ({}));
  return {
    ok: false,
    attemptsRemaining: typeof (data as any)?.attemptsRemaining === 'number' ? (data as any).attemptsRemaining : undefined,
    locked: (data as any)?.locked === true,
    lockUntil: typeof (data as any)?.lockUntil === 'string' ? (data as any).lockUntil : undefined,
    accountLocked: (data as any)?.accountLocked === true,
    message: (data as any)?.error ? String((data as any).error) : undefined,
  };
};

export const changeMyPassword = async (token: string, currentPassword: string, newPassword: string) => {
  const response = await fetch(`${API_URL}/api/users/change-password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ currentPassword, newPassword }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error((error as any)?.error || 'Error al cambiar contraseña');
  }

  return response.json();
};

