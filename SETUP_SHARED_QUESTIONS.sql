-- ============================================
-- ДОБАВЛЯЕМ ПОЛЕ ДЛЯ СИНХРОНИЗАЦИИ ВОПРОСОВ В NORMAL MODE
-- Выполни этот SQL в Supabase SQL Editor
-- ============================================

-- Добавляем столбец для сохранения полных данных вопросов
ALTER TABLE public.multiplayer_sessions
ADD COLUMN IF NOT EXISTS shared_questions jsonb DEFAULT '[]'::jsonb;

-- Комментарий: Это поле хранит полные данные каждого вопроса:
-- [
--   {
--     "correctId": 123,
--     "wrongIds": [456, 789, 101],
--     "order": [456, 123, 789, 101],
--     "correctAnimeTitle": "Anime Title",
--     "correctAnimeMusic": "music_url"
--   },
--   ...
-- ]
