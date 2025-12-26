-- ============================================
-- ДОБАВЛЯЕМ ПОЛЕ current_question_index
-- Выполни этот SQL в Supabase SQL Editor
-- ============================================

-- Добавляем колонку current_question_index в таблицу multiplayer_sessions
ALTER TABLE public.multiplayer_sessions
ADD COLUMN IF NOT EXISTS current_question_index INTEGER DEFAULT 0;

-- Проверяем результат
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'multiplayer_sessions'
ORDER BY ordinal_position;
