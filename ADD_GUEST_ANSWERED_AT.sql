-- ============================================
-- ДОБАВЛЯЕМ ПОЛЕ guest_answered_at
-- Выполни этот SQL в Supabase SQL Editor
-- ============================================

-- Добавляем колонку guest_answered_at в таблицу multiplayer_sessions
ALTER TABLE public.multiplayer_sessions
ADD COLUMN IF NOT EXISTS guest_answered_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Проверяем результат
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'multiplayer_sessions'
ORDER BY ordinal_position;
