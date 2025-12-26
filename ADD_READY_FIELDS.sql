-- Добавляем поля готовности для синхронизации готовности игроков
ALTER TABLE multiplayer_sessions 
ADD COLUMN IF NOT EXISTS host_ready BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS guest_ready BOOLEAN DEFAULT FALSE;

-- Создаём индексы для быстрого поиска
CREATE INDEX IF NOT EXISTS idx_multiplayer_sessions_host_ready ON multiplayer_sessions(host_ready);
CREATE INDEX IF NOT EXISTS idx_multiplayer_sessions_guest_ready ON multiplayer_sessions(guest_ready);
