import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { POST_TTL_MS } from '../config/postTtl';
import { useI18n } from '../i18n/I18nProvider';
import type { Language, TranslationKey } from '../i18n/translations';
import {
  dismissChannelReplyNotification,
  fetchNotifications,
  markNotificationAsRead,
  respondToGroupJoinRequest as submitGroupJoinRequestResponse,
  type NotificationItem,
} from '../services/notificationService';

interface NotificationScreenProps {
  onBack: () => void;
  authToken?: string;
  onNotificationsChanged?: () => void;
  onGroupJoinAccepted?: (payload: { groupHashtag: string; requesterUsername: string }) => void;
  onChannelReplyNavigate?: (payload: { postId: number; publisherUsername: string }) => void;
}

const parseServerDate = (value: Date | string) => {
  if (value instanceof Date) {return value;}

  const raw = String(value);
  const hasTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(raw);
  if (hasTimezone) {return new Date(raw);}

  const normalized = raw.includes(' ') ? raw.replace(' ', 'T') : raw;
  const looksLikeIsoNoTz = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?$/.test(normalized);
  if (looksLikeIsoNoTz) {return new Date(`${normalized}Z`);}

  return new Date(raw);
};

const getRemainingTime = (createdAt: Date | string) => {
  const created = parseServerDate(createdAt);
  if (!Number.isFinite(created.getTime())) {return 'Tiempo agotado';}

  const now = new Date();
  const expiration = new Date(created.getTime() + POST_TTL_MS);
  const diff = expiration.getTime() - now.getTime();

  if (diff <= 0) {return 'Tiempo agotado';}

  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (hours > 0) {
    return `Falta ${hours} ${hours === 1 ? 'hora' : 'horas'}`;
  }

  const displayMinutes = minutes === 0 ? 1 : minutes;
  return `Falta ${displayMinutes} ${displayMinutes === 1 ? 'minuto' : 'minutos'}`;
};

const formatRemainingTimeForDisplay = (
  raw: string,
  t: (key: TranslationKey) => string,
) => {
  if (raw === 'Tiempo agotado') {return t('chat.timeExpired' as TranslationKey);}

  const match = raw.match(/^Falta\s+(\d+)\s+(hora|horas|minuto|minutos)$/i);
  if (!match) {return raw;}

  const value = Number(match[1]);
  if (!Number.isFinite(value)) {return raw;}

  const unitRaw = match[2].toLowerCase();
  const isHour = unitRaw.startsWith('hora');
  const unitKey = (isHour
    ? (value === 1 ? 'chat.hour' : 'chat.hours')
    : (value === 1 ? 'chat.minute' : 'chat.minutes')) as TranslationKey;

  return `${t('chat.remainingPrefix' as TranslationKey)} ${value} ${t(unitKey)}`;
};

const formatTemplate = (template: string, vars: Record<string, string>) => (
  template.replace(/\{(\w+)\}/g, (_, key) => (vars[key] ?? ''))
);

const formatUsernameWithAt = (raw?: string | null) => {
  const trimmed = String(raw || '').trim();
  if (!trimmed) {return '@usuario';}
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
};

const GradientBorder = ({ gradientId, borderRadius }: { gradientId: string; borderRadius: number }) => (
  <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    <Svg width="100%" height="100%">
      <Defs>
        <LinearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0" stopColor="#FF9800" stopOpacity="1" />
          <Stop offset="1" stopColor="#FFEB3B" stopOpacity="1" />
        </LinearGradient>
      </Defs>
      <Rect
        x="1"
        y="1"
        width="99%"
        height="99%"
        rx={borderRadius}
        ry={borderRadius}
        fill="transparent"
        stroke={`url(#${gradientId})`}
        strokeWidth="2"
      />
    </Svg>
  </View>
);

const NotificationScreen = ({ onBack, authToken, onNotificationsChanged, onGroupJoinAccepted, onChannelReplyNavigate }: NotificationScreenProps) => {
  const insets = useSafeAreaInsets();
  const { t, language } = useI18n();
  const localize = (messages: Partial<Record<Language, string>> & { es: string }) => messages[language] || messages.en || messages.es;
  const errorTitle = localize({ es: 'Error', en: 'Error', fr: 'Erreur', pt: 'Erro', de: 'Fehler', it: 'Errore' });

  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);

  const visibleNotifications = useMemo(
    () => notifications.filter(item => item.type === 'channel_host_reply' || (item.type === 'group_join_request' && item.status === 'pending')),
    [notifications],
  );

  const unreadNotificationsCount = useMemo(
    () => visibleNotifications.filter(item => !item.readAt).length,
    [visibleNotifications],
  );

  const loadNotifications = useCallback(async () => {
    if (!authToken) {
      setNotifications([]);
      return;
    }

    setIsLoadingNotifications(true);
    try {
      const data = await fetchNotifications(authToken);
      setNotifications(data);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    } finally {
      setIsLoadingNotifications(false);
    }
  }, [authToken]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = useCallback(async (notificationId: number) => {
    const target = notifications.find(item => item.id === notificationId);
    if (!target || target.readAt) {return true;}

    try {
      await markNotificationAsRead(authToken, notificationId);
      setNotifications(prev => prev.map(item => (
        item.id === notificationId ? { ...item, readAt: item.readAt || new Date().toISOString() } : item
      )));
      onNotificationsChanged?.();
      return true;
    } catch (error: any) {
      Alert.alert(errorTitle, error?.message || localize({
        es: 'No se pudo marcar la notificación como leída.',
        en: 'The notification could not be marked as read.',
        fr: 'Impossible de marquer la notification comme lue.',
        pt: 'Nao foi possivel marcar a notificacao como lida.',
        de: 'Die Benachrichtigung konnte nicht als gelesen markiert werden.',
        it: 'Impossibile segnare la notifica come letta.',
      }));
      return false;
    }
  }, [authToken, errorTitle, localize, notifications, onNotificationsChanged]);

  const handleOpenChannelReply = useCallback(async (notification: NotificationItem) => {
    const postId = Number(notification.postId ?? 0);
    if (!Number.isFinite(postId) || postId <= 0) {return;}

    try {
      await dismissChannelReplyNotification(authToken, postId);
    } catch (error: any) {
      Alert.alert(errorTitle, error?.message || localize({
        es: 'No se pudo eliminar la notificación del canal.',
        en: 'The channel notification could not be dismissed.',
        fr: 'Impossible de supprimer la notification du canal.',
        pt: 'Nao foi possivel remover a notificacao do canal.',
        de: 'Die Kanalbenachrichtigung konnte nicht entfernt werden.',
        it: 'Impossibile rimuovere la notifica del canale.',
      }));
      return;
    }

    setNotifications(prev => prev.filter(item => item.id !== notification.id));
    onNotificationsChanged?.();

    onChannelReplyNavigate?.({
      postId,
      publisherUsername: String(notification.publisherUsername || ''),
    });
  }, [authToken, errorTitle, localize, onChannelReplyNavigate, onNotificationsChanged]);

  const respondToGroupJoinRequest = useCallback(async (notification: NotificationItem, action: 'accept' | 'ignore') => {
    if (!authToken) {return;}

    try {
      await submitGroupJoinRequestResponse(authToken, notification.id, action);

      setNotifications(prev => prev.map(item => (
        item.id === notification.id
          ? {
            ...item,
            status: action === 'accept' ? 'accepted' : 'ignored',
            readAt: item.readAt || new Date().toISOString(),
          }
          : item
      )));
      onNotificationsChanged?.();

      if (action === 'accept') {
        onGroupJoinAccepted?.({
          groupHashtag: String(notification.groupHashtag ?? ''),
          requesterUsername: String(notification.requesterUsername ?? ''),
        });
      }
    } catch (error: any) {
      Alert.alert(errorTitle, error?.message || localize({
        es: 'No se pudo actualizar la solicitud.',
        en: 'The request could not be updated.',
        fr: 'Impossible de mettre a jour la demande.',
        pt: 'Nao foi possivel atualizar a solicitacao.',
        de: 'Die Anfrage konnte nicht aktualisiert werden.',
        it: 'Impossibile aggiornare la richiesta.',
      }));
    }
  }, [authToken, errorTitle, localize, onGroupJoinAccepted, onNotificationsChanged]);

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <View style={[styles.header, { height: 56 + insets.top, paddingTop: insets.top }]}>
        <TouchableOpacity style={styles.backButton} onPress={onBack} activeOpacity={0.7}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </TouchableOpacity>
        <Text style={styles.title}>{t('common.notifications' as TranslationKey)}</Text>
        <View style={styles.headerRightSpacer}>
          {unreadNotificationsCount > 0 ? (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{unreadNotificationsCount}</Text>
            </View>
          ) : null}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {isLoadingNotifications ? (
          <View style={styles.centerBlock}>
            <Text style={styles.mutedText}>{localize({
              es: 'Cargando...',
              en: 'Loading...',
              fr: 'Chargement...',
              pt: 'Carregando...',
              de: 'Wird geladen...',
              it: 'Caricamento...',
            })}</Text>
          </View>
        ) : visibleNotifications.length === 0 ? (
          <View style={styles.centerBlock}>
            <Text style={styles.mutedText}>{t('notifications.empty' as TranslationKey)}</Text>
          </View>
        ) : visibleNotifications.map(notification => {
          const isRead = !!notification.readAt;
          const gradientId = `notification_card_${notification.id}`;
          const isChannelReplyNotification = notification.type === 'channel_host_reply';
          const unreadReplyCount = Number(notification.unreadCount ?? 0) || 0;
          const messageText = isChannelReplyNotification
            ? localize({
              es: `Has recibido una respuesta de ${formatUsernameWithAt(notification.publisherUsername)} en su canal.`,
              en: `You received a reply from ${formatUsernameWithAt(notification.publisherUsername)} in their channel.`,
              fr: `Tu as recu une reponse de ${formatUsernameWithAt(notification.publisherUsername)} dans son canal.`,
              pt: `Recebeste uma resposta de ${formatUsernameWithAt(notification.publisherUsername)} no canal dele.`,
              de: `Du hast eine Antwort von ${formatUsernameWithAt(notification.publisherUsername)} in seinem Kanal erhalten.`,
              it: `Hai ricevuto una risposta da ${formatUsernameWithAt(notification.publisherUsername)} nel suo canale.`,
            })
            : formatTemplate(
              t('notifications.groupJoinRequestMessage' as TranslationKey),
              {
                user: String(notification.requesterUsername ?? ''),
                group: String(notification.groupHashtag ?? ''),
              },
            );

          return (
            <TouchableOpacity
              key={notification.id}
              activeOpacity={isRead ? 1 : 0.95}
              onPress={() => {
                if (!isRead) {
                  handleMarkRead(notification.id);
                }
              }}
              style={styles.cardWrap}
            >
              <View style={[styles.card, isRead ? styles.cardRead : styles.cardUnread]}>
                {!isRead ? <GradientBorder gradientId={gradientId} borderRadius={12} /> : null}

                <View style={styles.cardTopRow}>
                  <View style={styles.cardMetaRowLeft}>
                    <Text style={styles.cardMetaText}>
                      {formatRemainingTimeForDisplay(
                        getRemainingTime(notification.postCreatedAt ?? notification.createdAt),
                        t as (key: TranslationKey) => string,
                      )}
                    </Text>
                    {isChannelReplyNotification && unreadReplyCount > 0 ? (
                      <View style={styles.inlineUnreadReplyBadge}>
                        <Text style={styles.inlineUnreadReplyBadgeText}>{unreadReplyCount > 99 ? '99+' : unreadReplyCount}</Text>
                      </View>
                    ) : null}
                  </View>
                  <Text style={[styles.cardStatusText, isRead ? styles.cardStatusReadText : styles.cardStatusUnreadText]}>
                    {isRead ? t('notifications.read' as TranslationKey) : t('notifications.unread' as TranslationKey)}
                  </Text>
                </View>

                <Text style={styles.cardMessageText}>{messageText}</Text>

                <View style={styles.cardActionsRow}>
                  {isChannelReplyNotification ? (
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        handleOpenChannelReply(notification);
                      }}
                      style={[styles.actionButton, styles.acceptButton]}
                    >
                      <Text style={styles.acceptButtonText}>
                        {localize({ es: 'Ir a canal', en: 'Go to channel', fr: 'Aller au canal', pt: 'Ir para o canal', de: 'Zum Kanal', it: 'Vai al canale' })}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          if (!isRead) {
                            handleMarkRead(notification.id);
                          }
                          respondToGroupJoinRequest(notification, 'ignore');
                        }}
                        style={[styles.actionButton, styles.ignoreButton]}
                      >
                        <Text style={styles.ignoreButtonText}>{t('notifications.ignore' as TranslationKey)}</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => {
                          if (!isRead) {
                            handleMarkRead(notification.id);
                          }
                          respondToGroupJoinRequest(notification, 'accept');
                        }}
                        style={[styles.actionButton, styles.acceptButton]}
                      >
                        <Text style={styles.acceptButtonText}>{t('notifications.accept' as TranslationKey)}</Text>
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    backgroundColor: '#000000',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  headerRightSpacer: {
    width: 40,
    minHeight: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  headerBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff38',
  },
  headerBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  content: {
    paddingHorizontal: 16,
    paddingVertical: 20,
    paddingBottom: 30,
  },
  centerBlock: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  mutedText: {
    color: 'rgba(255,255,255,0.6)',
  },
  cardWrap: {
    marginBottom: 12,
  },
  card: {
    backgroundColor: '#1E1E1E',
    borderRadius: 12,
    padding: 14,
    overflow: 'hidden',
    position: 'relative',
  },
  cardRead: {
    borderWidth: 1,
    borderColor: '#333333',
  },
  cardUnread: {
    borderWidth: 0,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  cardMetaRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  cardMetaText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
  },
  inlineUnreadReplyBadge: {
    minWidth: 18,
    height: 18,
    paddingHorizontal: 5,
    borderRadius: 9,
    marginLeft: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: '#FFB74D',
  },
  inlineUnreadReplyBadgeText: {
    color: '#FFB74D',
    fontSize: 10,
    fontWeight: '800',
  },
  cardStatusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardStatusReadText: {
    color: 'rgba(255,255,255,0.6)',
  },
  cardStatusUnreadText: {
    color: '#FFB74D',
  },
  cardMessageText: {
    color: '#FFFFFF',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12,
  },
  cardActionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  ignoreButton: {
    borderWidth: 1,
    borderColor: '#FFB74D',
    backgroundColor: 'transparent',
  },
  ignoreButtonText: {
    color: '#FFB74D',
    fontWeight: '700',
  },
  acceptButton: {
    backgroundColor: '#FFB74D',
  },
  acceptButtonText: {
    color: '#000000',
    fontWeight: '700',
  },
});

export default NotificationScreen;
