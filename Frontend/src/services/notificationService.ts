import { API_URL } from '../config/api';

export type NotificationItem = {
  id: number;
  type: 'group_join_request' | 'channel_host_reply';
  groupId?: number | null;
  postId?: number | null;
  postCreatedAt?: string | null;
  status: 'pending' | 'accepted' | 'ignored' | string;
  createdAt: string;
  requesterUsername?: string;
  groupHashtag?: string;
  publisherUsername?: string;
  unreadCount?: number;
  readAt?: string | null;
};

export type NotificationAction = 'accept' | 'ignore';

const buildAuthHeaders = (authToken?: string) => ({
  Authorization: `Bearer ${String(authToken || '').trim()}`,
});

export const fetchNotifications = async (authToken?: string): Promise<NotificationItem[]> => {
  const token = String(authToken || '').trim();
  if (!token) {return [];}

  const response = await fetch(`${API_URL}/api/notifications`, {
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error('Unable to fetch notifications');
  }

  const data = await response.json();
  return Array.isArray(data) ? (data as NotificationItem[]) : [];
};

export const fetchUnreadNotificationsCount = async (authToken?: string): Promise<number> => {
  const token = String(authToken || '').trim();
  if (!token) {return 0;}

  const response = await fetch(`${API_URL}/api/notifications/unread-count`, {
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    throw new Error('Unable to fetch unread notifications count');
  }

  const data = await response.json();
  const count = Number(data?.count ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
};

export const markNotificationAsRead = async (authToken: string | undefined, notificationId: number) => {
  const token = String(authToken || '').trim();
  if (!token) {
    throw new Error('Missing auth token');
  }

  const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
    method: 'POST',
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(String(errorBody?.error || 'Unable to mark notification as read'));
  }
};

export const dismissChannelReplyNotification = async (authToken: string | undefined, postId: number) => {
  const token = String(authToken || '').trim();
  if (!token) {
    throw new Error('Missing auth token');
  }

  const response = await fetch(`${API_URL}/api/notifications/channel-replies/${postId}/dismiss`, {
    method: 'POST',
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(String(errorBody?.error || 'Unable to dismiss channel reply notification'));
  }
};

export const markJoinedChannelInteractionsAsRead = async (
  authToken: string | undefined,
  postId: number,
) => {
  const token = String(authToken || '').trim();
  const numericPostId = Number(postId);
  if (!token) {
    throw new Error('Missing auth token');
  }

  if (!Number.isFinite(numericPostId) || numericPostId <= 0) {
    throw new Error('Invalid postId');
  }

  const response = await fetch(`${API_URL}/api/channels/joined-interactions/${numericPostId}/read`, {
    method: 'POST',
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(String(errorBody?.error || 'Unable to mark joined channel interactions as read'));
  }
};

export const respondToGroupJoinRequest = async (
  authToken: string | undefined,
  notificationId: number,
  action: NotificationAction,
) => {
  const token = String(authToken || '').trim();
  if (!token) {
    throw new Error('Missing auth token');
  }

  const response = await fetch(`${API_URL}/api/group-requests/${notificationId}/${action}`, {
    method: 'POST',
    headers: buildAuthHeaders(token),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(String(errorBody?.error || 'Unable to update group join request'));
  }
};
