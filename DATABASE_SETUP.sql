-- ============================================
-- ОТКЛЮЧАЕМ RLS ДЛЯ ТЕСТИРОВАНИЯ
-- Выполни ТОЛЬКО этот SQL в Supabase SQL Editor
-- ============================================

-- Отключаем RLS (Row Level Security)
ALTER TABLE public.multiplayer_invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.multiplayer_sessions DISABLE ROW LEVEL SECURITY;

-- Удаляем все старые политики
DROP POLICY IF EXISTS "Users can view invites sent to them" ON public.multiplayer_invites;
DROP POLICY IF EXISTS "Users can insert invites" ON public.multiplayer_invites;
DROP POLICY IF EXISTS "Users can insert their own invites" ON public.multiplayer_invites;
DROP POLICY IF EXISTS "Users can update their invites" ON public.multiplayer_invites;
DROP POLICY IF EXISTS "Users can view their own sessions" ON public.multiplayer_sessions;
DROP POLICY IF EXISTS "Users can insert their sessions" ON public.multiplayer_sessions;
DROP POLICY IF EXISTS "Users can update their sessions" ON public.multiplayer_sessions;
