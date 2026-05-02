CREATE TABLE IF NOT EXISTS channel_reply_notifications (
  id SERIAL PRIMARY KEY,
  post_id INTEGER NOT NULL REFERENCES Post_users(id) ON DELETE CASCADE,
  channel_message_id INTEGER NOT NULL UNIQUE REFERENCES channel_messages(id) ON DELETE CASCADE,
  publisher_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  viewer_email VARCHAR(255) NOT NULL REFERENCES users(email) ON DELETE CASCADE,
  read_at TIMESTAMP,
  dismissed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_channel_reply_notifications_viewer_read
  ON channel_reply_notifications (viewer_email, read_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_reply_notifications_viewer_dismissed
  ON channel_reply_notifications (viewer_email, dismissed_at, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_channel_reply_notifications_post_id
  ON channel_reply_notifications (post_id);

ALTER TABLE IF EXISTS public.channel_reply_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deny client access" ON public.channel_reply_notifications;
CREATE POLICY "deny client access"
  ON public.channel_reply_notifications
  FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);