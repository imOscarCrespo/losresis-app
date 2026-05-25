-- Activar Supabase Realtime para group_messages.
-- La tabla es compartida por chats de grupo y chats directos (kind='direct').
-- Sin esto, el cliente recibe status SUBSCRIBED en el canal pero nunca llegan
-- eventos INSERT, así que los mensajes nuevos no aparecen hasta salir del chat
-- y volver a entrar.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'group_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime
      ADD TABLE public.group_messages;
  END IF;
END
$$;

-- REPLICA IDENTITY FULL para que los payloads de UPDATE/DELETE incluyan todas
-- las columnas. Los INSERT que escucha hoy el cliente ya llegan completos con
-- la identidad por defecto; esto deja preparado el terreno por si en el futuro
-- se añade edición o borrado de mensajes en vivo.
ALTER TABLE public.group_messages REPLICA IDENTITY FULL;
