-- Añadir columna "hidden" a channel_messages para que el anfitrión pueda
-- ocultar mensajes de usuarios al resto de participantes del canal.
ALTER TABLE channel_messages
ADD COLUMN IF NOT EXISTS hidden BOOLEAN NOT NULL DEFAULT FALSE;
