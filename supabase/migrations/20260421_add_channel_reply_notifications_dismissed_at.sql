ALTER TABLE public.channel_reply_notifications
  ADD COLUMN IF NOT EXISTS dismissed_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_channel_reply_notifications_viewer_dismissed
  ON public.channel_reply_notifications (viewer_email, dismissed_at, created_at DESC);