-- ============================================
-- ТАБЛИЦА ДЛЯ СОХРАНЕНИЯ ВОПРОСОВ (ОДИНАКОВЫЕ ДЛЯ ОБОИХ ИГРОКОВ)
-- ============================================

-- Добавляем поле для сохранения вопросов сессии (JSON с IDs аниме)
ALTER TABLE public.multiplayer_sessions 
ADD COLUMN IF NOT EXISTS shared_anime_ids jsonb DEFAULT '[]'::jsonb;

-- Индекс для быстрого поиска по session ID
CREATE INDEX IF NOT EXISTS idx_multiplayer_sessions_id 
ON public.multiplayer_sessions(id);

-- ============================================
-- ТАБЛИЦА ДЛЯ ОТСЛЕЖИВАНИЯ ОТВЕТОВ КАЖДОГО ИГРОКА
-- ============================================

CREATE TABLE IF NOT EXISTS public.multiplayer_answers (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    session_id uuid NOT NULL REFERENCES public.multiplayer_sessions(id) ON DELETE CASCADE,
    user_id uuid NOT NULL,
    question_number INTEGER NOT NULL,
    anime_id INTEGER NOT NULL,
    is_correct BOOLEAN NOT NULL,
    time_taken REAL NOT NULL, -- в секундах
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_multiplayer_answers_session 
ON public.multiplayer_answers(session_id);

CREATE INDEX IF NOT EXISTS idx_multiplayer_answers_user 
ON public.multiplayer_answers(user_id);

-- ============================================
-- ОТКЛЮЧАЕМ RLS ДЛЯ ТЕСТИРОВАНИЯ (если нужно)
-- ============================================

ALTER TABLE public.multiplayer_answers DISABLE ROW LEVEL SECURITY;

-- ============================================
-- ПРИМЕЧАНИЯ:
-- ============================================
-- 1. shared_anime_ids хранит JSON массив с IDs аниме в порядке их вывода
--    Пример: [123, 456, 789, ...]
-- 
-- 2. Когда хост загружает первый вопрос, он сохраняет ID в shared_anime_ids
--    Когда гость загружает вопрос, он использует сохраненный ID из shared_anime_ids
-- 
-- 3. multiplayer_answers таблица отслеживает ответы каждого игрока
--    для будущих статистик и анализа
