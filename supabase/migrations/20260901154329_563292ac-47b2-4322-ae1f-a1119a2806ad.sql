CREATE TABLE public.quiz_threads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'New game',
  topic TEXT,
  asked_count INTEGER NOT NULL DEFAULT 0,
  correct_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_threads TO authenticated;
GRANT ALL ON public.quiz_threads TO service_role;
ALTER TABLE public.quiz_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players manage their own games" ON public.quiz_threads FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.quiz_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  thread_id UUID NOT NULL REFERENCES public.quiz_threads(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  role TEXT NOT NULL,
  client_message_id TEXT,
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX quiz_messages_thread_created_idx ON public.quiz_messages (thread_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quiz_messages TO authenticated;
GRANT ALL ON public.quiz_messages TO service_role;
ALTER TABLE public.quiz_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Players manage their own messages" ON public.quiz_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_quiz_threads_updated_at BEFORE UPDATE ON public.quiz_threads
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();