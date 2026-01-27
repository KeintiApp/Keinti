import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { useI18n } from '../i18n/I18nProvider';
import {
  checkEmailRegistered,
  confirmPasswordReset,
  requestPasswordResetCode,
  verifyPasswordResetCode,
} from '../services/userService';

type PasswordResetModalProps = {
  visible: boolean;
  onClose: () => void;
  initialEmail?: string;
  disabled?: boolean;
};

const isValidEmailFormat = (value: string) => {
  const v = String(value || '').trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
};

const isStrongPassword = (pass: string) => {
  const value = String(pass || '');
  if (value.length < 10) return false;
  if (value.length > 20) return false;
  const letterRegex = /[a-zA-Z]/;
  const numberRegex = /\d/;
  const specialCharRegex = /[!@#$%^&*(),.?\":{}|<>]/;
  return letterRegex.test(value) && numberRegex.test(value) && specialCharRegex.test(value);
};

const PasswordResetModal = ({ visible, onClose, initialEmail, disabled }: PasswordResetModalProps) => {
  const { t } = useI18n();

  const [step, setStep] = useState<'email' | 'code' | 'newPassword'>('email');
  const [email, setEmail] = useState('');
  const [emailRegistered, setEmailRegistered] = useState<boolean | null>(null);
  const [emailChecking, setEmailChecking] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [sending, setSending] = useState(false);
  const [info, setInfo] = useState('');

  const [code, setCode] = useState('');
  const [codeError, setCodeError] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [resetToken, setResetToken] = useState('');

  const [newPassword1, setNewPassword1] = useState('');
  const [newPassword2, setNewPassword2] = useState('');
  const [changing, setChanging] = useState(false);
  const [changeError, setChangeError] = useState('');

  const emailDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetInternalState = () => {
    setStep('email');
    setEmail(String(initialEmail || '').trim());
    setEmailRegistered(null);
    setEmailChecking(false);
    setEmailError('');
    setSending(false);
    setInfo('');
    setCode('');
    setCodeError('');
    setVerifying(false);
    setResetToken('');
    setNewPassword1('');
    setNewPassword2('');
    setChanging(false);
    setChangeError('');
  };

  useEffect(() => {
    if (!visible) return;

    resetInternalState();

    return () => {
      if (emailDebounceRef.current) {
        clearTimeout(emailDebounceRef.current);
        emailDebounceRef.current = null;
      }
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current);
        closeTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    if (step !== 'email') return;

    if (emailDebounceRef.current) {
      clearTimeout(emailDebounceRef.current);
      emailDebounceRef.current = null;
    }

    setEmailError('');
    setEmailRegistered(null);

    const trimmed = String(email || '').trim();
    if (!trimmed) return;

    if (!isValidEmailFormat(trimmed)) {
      setEmailRegistered(false);
      setEmailError(t('login.resetInvalidEmail'));
      return;
    }

    emailDebounceRef.current = setTimeout(async () => {
      setEmailChecking(true);
      try {
        const result = await checkEmailRegistered(trimmed);
        setEmailRegistered(result.registered);
        if (!result.registered) {
          setEmailError(t('login.resetEmailNotRegistered'));
        }
      } catch (e: any) {
        setEmailRegistered(null);
        setEmailError(e?.message || 'No se pudo comprobar el email');
      } finally {
        setEmailChecking(false);
      }
    }, 450);

    return () => {
      if (emailDebounceRef.current) {
        clearTimeout(emailDebounceRef.current);
        emailDebounceRef.current = null;
      }
    };
  }, [visible, step, email, t]);

  const safeClose = () => {
    if (sending || verifying || changing) return;
    onClose();
  };

  const getNewPasswordError = () => {
    if (!newPassword1) return '';
    if (String(newPassword1).length > 20) return t('validation.passwordMaxLength');
    if (String(newPassword1).length < 10) return t('validation.passwordMinLength');
    const letterRegex = /[a-zA-Z]/;
    if (!letterRegex.test(String(newPassword1))) return t('validation.passwordNeedsLetter');
    const numberRegex = /\d/;
    if (!numberRegex.test(String(newPassword1))) return t('validation.passwordNeedsNumber');
    const specialCharRegex = /[!@#$%^&*(),.?\":{}|<>]/;
    if (!specialCharRegex.test(String(newPassword1))) return t('validation.passwordNeedsSpecial');
    return '';
  };

  const getRepeatPasswordError = () => {
    if (!newPassword2) return '';
    if (newPassword2 !== newPassword1) return t('validation.passwordsDontMatch');
    return '';
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={safeClose}>
      <TouchableWithoutFeedback onPress={safeClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.panel}>
              <View style={styles.headerRow}>
                <Text style={styles.title}>{t('login.resetTitle')}</Text>
                <TouchableOpacity onPress={safeClose} disabled={sending || verifying || changing} activeOpacity={0.8}>
                  <MaterialIcons name="close" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              {step === 'email' ? (
                <>
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
                      editable={!disabled && !sending}
                    />
                    {emailChecking ? <Text style={styles.hintText}>{t('common.check')}...</Text> : null}
                    {emailError ? <Text style={styles.errorText}>{emailError}</Text> : null}
                  </View>

                  <View style={styles.buttonsRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.buttonSecondary]}
                      activeOpacity={0.8}
                      disabled={sending || emailChecking}
                      onPress={safeClose}
                    >
                      <Text style={styles.buttonSecondaryText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.button,
                        styles.buttonPrimary,
                        (!isValidEmailFormat(email) || emailRegistered !== true || sending) && styles.buttonDisabled,
                      ]}
                      activeOpacity={0.85}
                      disabled={!isValidEmailFormat(email) || emailRegistered !== true || sending}
                      onPress={async () => {
                        const trimmed = String(email || '').trim();
                        if (!isValidEmailFormat(trimmed) || emailRegistered !== true) return;
                        if (sending) return;

                        setSending(true);
                        setEmailError('');
                        setInfo('');
                        try {
                          await requestPasswordResetCode(trimmed);
                          setStep('code');
                        } catch (e: any) {
                          setEmailError(e?.message || 'No se pudo enviar el código');
                        } finally {
                          setSending(false);
                        }
                      }}
                    >
                      {sending ? (
                        <ActivityIndicator color="#000000" />
                      ) : (
                        <Text style={styles.buttonPrimaryText}>{t('login.resetSend')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              {step === 'code' ? (
                <>
                  <Text style={styles.infoText}>{t('login.resetCodeSent')}</Text>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>{t('login.resetCodeLabel')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder="XXXXXXXX"
                      placeholderTextColor="#989898ff"
                      value={code}
                      onChangeText={(v) => setCode(String(v || '').toUpperCase())}
                      autoCapitalize="characters"
                      editable={!disabled && !verifying && !changing}
                      maxLength={8}
                    />
                    {codeError ? <Text style={styles.errorText}>{codeError}</Text> : null}
                  </View>

                  <View style={styles.buttonsRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.buttonSecondary]}
                      activeOpacity={0.8}
                      disabled={verifying || changing}
                      onPress={() => {
                        if (verifying || changing) return;
                        setStep('email');
                        setCode('');
                        setCodeError('');
                        setResetToken('');
                        setInfo('');
                      }}
                    >
                      <Text style={styles.buttonSecondaryText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.button,
                        styles.buttonPrimary,
                        (String(code || '').trim().length !== 8 || verifying) && styles.buttonDisabled,
                      ]}
                      activeOpacity={0.85}
                      disabled={String(code || '').trim().length !== 8 || verifying}
                      onPress={async () => {
                        const trimmedEmail = String(email || '').trim();
                        const cleanCode = String(code || '').trim().toUpperCase();
                        if (cleanCode.length !== 8) return;
                        if (verifying) return;

                        setVerifying(true);
                        setCodeError('');
                        setChangeError('');
                        try {
                          const result = await verifyPasswordResetCode({ email: trimmedEmail, code: cleanCode });
                          if (!result?.resetToken) {
                            throw new Error('No se pudo iniciar el cambio de contraseña');
                          }
                          setResetToken(String(result.resetToken));
                          setInfo('');
                          setStep('newPassword');
                        } catch (e: any) {
                          setCodeError(e?.message || 'Código incorrecto');
                        } finally {
                          setVerifying(false);
                        }
                      }}
                    >
                      {verifying ? (
                        <ActivityIndicator color="#000000" />
                      ) : (
                        <Text style={styles.buttonPrimaryText}>{t('login.resetVerify')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </>
              ) : null}

              {step === 'newPassword' ? (
                <>
                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>{t('login.resetNewPasswordLabel')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('login.passwordPlaceholder')}
                      placeholderTextColor="#989898ff"
                      value={newPassword1}
                      onChangeText={setNewPassword1}
                      maxLength={20}
                      secureTextEntry
                      autoCapitalize="none"
                      editable={!disabled && !changing}
                    />
                    {getNewPasswordError() ? <Text style={styles.errorText}>{getNewPasswordError()}</Text> : null}
                  </View>

                  <View style={styles.inputContainer}>
                    <Text style={styles.label}>{t('login.resetRepeatNewPasswordLabel')}</Text>
                    <TextInput
                      style={styles.input}
                      placeholder={t('register.confirmPasswordPlaceholder')}
                      placeholderTextColor="#989898ff"
                      value={newPassword2}
                      onChangeText={setNewPassword2}
                      maxLength={20}
                      secureTextEntry
                      autoCapitalize="none"
                      editable={!disabled && !changing}
                    />
                    {getRepeatPasswordError() ? <Text style={styles.errorText}>{getRepeatPasswordError()}</Text> : null}
                  </View>

                  {changeError ? <Text style={styles.errorText}>{changeError}</Text> : null}

                  <View style={styles.buttonsRow}>
                    <TouchableOpacity
                      style={[styles.button, styles.buttonSecondary]}
                      activeOpacity={0.8}
                      disabled={changing}
                      onPress={safeClose}
                    >
                      <Text style={styles.buttonSecondaryText}>{t('common.cancel')}</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.button,
                        styles.buttonPrimary,
                        (!resetToken || !isStrongPassword(newPassword1) || newPassword1 !== newPassword2 || changing) &&
                          styles.buttonDisabled,
                      ]}
                      activeOpacity={0.85}
                      disabled={!resetToken || !isStrongPassword(newPassword1) || newPassword1 !== newPassword2 || changing}
                      onPress={async () => {
                        const trimmedEmail = String(email || '').trim();
                        if (!resetToken) return;
                        if (!isStrongPassword(newPassword1)) return;
                        if (newPassword1 !== newPassword2) return;
                        if (changing) return;

                        setChanging(true);
                        setChangeError('');
                        try {
                          await confirmPasswordReset({
                            email: trimmedEmail,
                            resetToken: resetToken,
                            newPassword: newPassword1,
                          });
                          setInfo(t('login.resetPasswordChanged'));

                          if (closeTimeoutRef.current) {
                            clearTimeout(closeTimeoutRef.current);
                            closeTimeoutRef.current = null;
                          }

                          closeTimeoutRef.current = setTimeout(() => {
                            onClose();
                          }, 1200);
                        } catch (e: any) {
                          setChangeError(e?.message || 'No se pudo cambiar la contraseña');
                        } finally {
                          setChanging(false);
                        }
                      }}
                    >
                      {changing ? (
                        <ActivityIndicator color="#000000" />
                      ) : (
                        <Text style={styles.buttonPrimaryText}>{t('login.resetChangePassword')}</Text>
                      )}
                    </TouchableOpacity>
                  </View>

                  {info ? <Text style={styles.infoText}>{info}</Text> : null}
                </>
              ) : null}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  panel: {
    backgroundColor: '#0f0f0fff',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#232323ff',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  title: {
    color: '#ffffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  inputContainer: {
    marginBottom: 14,
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
  hintText: {
    marginTop: 8,
    color: '#5D4037',
    fontSize: 12,
    fontWeight: '600',
  },
  infoText: {
    marginTop: 10,
    color: '#ffffffff',
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  errorText: {
    marginTop: 8,
    color: '#D84315',
    fontSize: 12,
    fontWeight: '600',
  },
  buttonsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    marginHorizontal: -5,
  },
  button: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginHorizontal: 5,
  },
  buttonPrimary: {
    backgroundColor: '#FFB74D',
  },
  buttonSecondary: {
    backgroundColor: '#000000ff',
    borderWidth: 1,
    borderColor: '#5D4037',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPrimaryText: {
    color: '#000000',
    fontSize: 13,
    fontWeight: '800',
  },
  buttonSecondaryText: {
    color: '#ffffffff',
    fontSize: 13,
    fontWeight: '700',
  },
});

export default PasswordResetModal;
