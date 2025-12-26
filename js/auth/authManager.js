
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.userStats = null;
        this.isAuthenticated = false;
        this.supabase = null;
        this.syncInterval = null; // Для хранения интервала автосинхронизации
    }

    init() {
        // Инициализация Supabase клиента
        if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
            this.supabase = window.supabase.createClient(
                'https://udigewfsgwiawjdechgv.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkaWdld2ZzZ3dpYXdqZGVjaGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NDU5MTUsImV4cCI6MjA3OTMyMTkxNX0.wN5UL_dIxH004hcw5Je3Za_uFlC28_CfGwdUmWEM0Kc'
            );
        }

        // Проверяем сохраненную сессию
        this.checkExistingSession();
        return true;
    }

    checkExistingSession() {
        const sessionData = localStorage.getItem('animeQuizSession');
        console.log('🔐 AuthManager: Проверка существующей сессии. Data:', sessionData ? 'найдена' : 'не найдена');
        
        if (sessionData) {
            try {
                const session = JSON.parse(sessionData);
                if (session && session.user) {
                    this.currentUser = session.user;
                    this.userStats = session.userStats || {};
                    this.isAuthenticated = true;
                    console.log('✅ AuthManager: Сессия восстановлена', this.currentUser.username);
                    
                    // Запускаем автосинхронизацию при восстановлении сессии
                    this.startAutoSync(10);
                }
            } catch (error) {
                console.error('❌ Ошибка при загрузке сессии:', error);
                localStorage.removeItem('animeQuizSession');
            }
        } else {
            console.log('ℹ️ AuthManager: Сохраненная сессия не найдена');
        }
    }

    // Логин — простая проверка в БД без Supabase Auth
    async login(usernameOrEmail, password) {
        try {
            if (!this.supabase) {
                throw new Error('Supabase не инициализирован');
            }

            // Ищем пользователя по username или email
            const { data: userData, error: queryError } = await this.supabase
                .from('users')
                .select('*')
                .or(`username.eq.${usernameOrEmail},email.eq.${usernameOrEmail}`)
                .single();

            if (queryError || !userData) {
                throw new Error('Пользователь не найден');
            }

            // Проверяем пароль (простое сравнение)
            if (userData.password_hash !== password) {
                throw new Error('Неверный пароль');
            }

            // Успешная авторизация
            this.currentUser = {
                id: userData.id,
                username: userData.username,
                email: userData.email,
                avatar_url: userData.avatar_url,
                created_at: userData.created_at
            };

            // Синхронизация с auth.users: убеждаемся, что в public.users есть эта запись
            // (для совместимости с FK constraints в friend_requests и friends)
            const authSession = await this.supabase.auth.getSession();
            if (authSession?.data?.session?.user?.id) {
                const authUserId = authSession.data.session.user.id;
                
                // Проверяем, есть ли уже запись в public.users с ID из auth.users
                const { data: existingAuthUser } = await this.supabase
                    .from('users')
                    .select('id')
                    .eq('id', authUserId)
                    .single();

                if (!existingAuthUser) {
                    // Если нет — создаём запись с ID из auth.users
                    await this.supabase
                        .from('users')
                        .insert({
                            id: authUserId,
                            username: userData.username,
                            email: userData.email,
                            level: userData.level || 1,
                            xp: userData.xp || 0,
                            created_at: new Date().toISOString()
                        })
                        .single();
                    
                    console.log('✅ Синхронизирована запись в public.users для auth user:', authUserId);
                }

                // Обновляем currentUser.id на auth user ID для совместимости с FK
                this.currentUser.id = authUserId;
            }

            this.userStats = {
                level: userData.level,
                xp: userData.xp,
                gamesPlayed: userData.games_played,
                correctAnswers: userData.correct_answers,
                totalAnswers: userData.total_answers,
                achievements: userData.achievements || []
            };

            this.isAuthenticated = true;

            // Сохраняем сессию
            localStorage.setItem('animeQuizSession', JSON.stringify({
                user: this.currentUser,
                userStats: this.userStats,
                loginTime: new Date().toISOString()
            }));

            // Запускаем автосинхронизацию при успешном входе
            this.startAutoSync(10); // Синхронизируем каждые 10 секунд

            console.log('✅ AuthManager: Авторизация успешна');
            return { success: true, user: this.currentUser };

        } catch (error) {
            console.error('❌ AuthManager: Ошибка авторизации:', error);
            throw error;
        }
    }

    // Регистрация — простая запись в БД без Supabase Auth
    async register(username, email, password) {
        try {
            if (!this.supabase) {
                throw new Error('Supabase не инициализирован');
            }

            // Проверяем, не существует ли уже пользователь
            const { data: existing, error: checkError } = await this.supabase
                .from('users')
                .select('id')
                .or(`username.eq.${username},email.eq.${email}`);

            if (checkError) {
                throw new Error('Ошибка при проверке пользователя');
            }

            if (existing && existing.length > 0) {
                throw new Error('Пользователь с таким username или email уже существует');
            }

            // Генерируем UUID для пользователя (используем auth user ID если доступен)
            let userId = this.generateUUID();
            
            // Пытаемся получить ID из auth.users если уже создан
            try {
                const authSession = await this.supabase.auth.getSession();
                if (authSession?.data?.session?.user?.id) {
                    userId = authSession.data.session.user.id;
                }
            } catch (e) {
                console.log('Auth session not available yet, using generated UUID');
            }

            // Создаем нового пользователя в БД
            const { data: newUser, error: insertError } = await this.supabase
                .from('users')
                .insert({
                    id: userId,
                    username: username,
                    email: email,
                    password_hash: password, // В реальном приложении нужно использовать bcrypt!
                    level: 1,
                    xp: 0,
                    games_played: 0,
                    correct_answers: 0,
                    total_answers: 0,
                    achievements: [],
                    avatar_url: null,
                    difficulty: 'easy',
                    music_volume: 50,
                    autoplay: true,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (insertError) {
                console.error('Ошибка при создании пользователя:', insertError);
                throw new Error('Ошибка при создании пользователя');
            }

            // Сохраняем сессию
            this.currentUser = {
                id: newUser.id,
                username: newUser.username,
                email: newUser.email,
                avatar_url: newUser.avatar_url,
                created_at: newUser.created_at
            };

            this.userStats = {
                level: newUser.level,
                xp: newUser.xp,
                gamesPlayed: newUser.games_played,
                correctAnswers: newUser.correct_answers,
                totalAnswers: newUser.total_answers,
                achievements: newUser.achievements || []
            };

            this.isAuthenticated = true;

            localStorage.setItem('animeQuizSession', JSON.stringify({
                user: this.currentUser,
                userStats: this.userStats,
                loginTime: new Date().toISOString()
            }));

            // Запускаем автосинхронизацию при успешной регистрации
            this.startAutoSync(10); // Синхронизируем каждые 10 секунд

            console.log('✅ AuthManager: Регистрация успешна');
            return { success: true, user: this.currentUser };

        } catch (error) {
            console.error('❌ AuthManager: Ошибка регистрации:', error);
            throw error;
        }
    }

    // Логаут
    logout() {
        this.currentUser = null;
        this.userStats = null;
        this.isAuthenticated = false;
        localStorage.removeItem('animeQuizSession');
        this.stopAutoSync(); // Отключаем автосинхронизацию при выходе
        console.log('✅ AuthManager: Выход из аккаунта');
    }

    // Получить текущего пользователя
    getCurrentUser() {
        return this.currentUser;
    }

    // Получить статистику пользователя
    getUserStats() {
        return this.userStats;
    }

    // Проверить авторизацию
    isLoggedIn() {
        return this.isAuthenticated;
    }

    // Обновить аватар
    updateUserAvatar(userId, avatarUrl) {
        if (this.currentUser && this.currentUser.id === userId) {
            this.currentUser.avatar_url = avatarUrl;
            this.saveSession();
        }
    }

    // Обновить статистику пользователя (сохранить в Supabase и локально)
    async updateUserStats(statsData) {
        try {
            if (!this.currentUser || !this.isAuthenticated) {
                console.warn('⚠️ AuthManager: Пользователь не авторизован, статистика не сохранена');
                return false;
            }

            if (!this.supabase) {
                console.warn('⚠️ AuthManager: Supabase не инициализирован, статистика не сохранена');
                return false;
            }

            // Обновляем локальный кэш
            if (statsData.level !== undefined) this.userStats.level = statsData.level;
            if (statsData.xp !== undefined) this.userStats.xp = statsData.xp;
            if (statsData.games_played !== undefined) this.userStats.gamesPlayed = statsData.games_played;
            if (statsData.correct_answers !== undefined) this.userStats.correctAnswers = statsData.correct_answers;
            if (statsData.total_answers !== undefined) this.userStats.totalAnswers = statsData.total_answers;
            if (statsData.achievements !== undefined) this.userStats.achievements = statsData.achievements;

            // Подготавливаем данные для БД
            const updateData = {
                level: this.userStats.level,
                xp: this.userStats.xp,
                games_played: this.userStats.gamesPlayed,
                correct_answers: this.userStats.correctAnswers,
                total_answers: this.userStats.totalAnswers,
                achievements: this.userStats.achievements,
                updated_at: new Date().toISOString()
            };

            // Сохраняем в Supabase
            const { error } = await this.supabase
                .from('users')
                .update(updateData)
                .eq('id', this.currentUser.id);

            if (error) {
                console.error('❌ Ошибка при обновлении статистики:', error);
                return false;
            }

            // Сохраняем локально
            this.saveSession();
            console.log('✅ AuthManager: Статистика обновлена');
            return true;

        } catch (err) {
            console.error('❌ AuthManager: Ошибка при обновлении статистики:', err);
            return false;
        }
    }

    // Синхронизировать статистику с БД (загрузить свежие данные)
    async syncStatsFromDatabase() {
        try {
            if (!this.currentUser || !this.isAuthenticated || !this.supabase) {
                console.warn('⚠️ AuthManager: Не авторизован или Supabase не инициализирован');
                return false;
            }

            console.log('🔄 AuthManager: Синхронизация данных с БД для пользователя:', this.currentUser.username);

            const { data: userData, error } = await this.supabase
                .from('users')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (error || !userData) {
                console.warn('⚠️ AuthManager: Не удалось загрузить данные из БД:', error);
                return false;
            }

            console.log('📊 AuthManager: Данные загружены из БД:', userData);

            // Обновляем локальный кэш с данными из БД
            this.userStats = {
                level: userData.level || 1,
                xp: userData.xp || 0,
                gamesPlayed: userData.games_played || 0,
                correctAnswers: userData.correct_answers || 0,
                totalAnswers: userData.total_answers || 0,
                achievements: userData.achievements || []
            };

            // Обновляем глобальный playerStats если он существует
            if (window.playerStats) {
                window.playerStats = {
                    level: userData.level || 1,
                    xp: userData.xp || 0,
                    gamesPlayed: userData.games_played || 0,
                    correctAnswers: userData.correct_answers || 0,
                    totalAnswers: userData.total_answers || 0,
                    achievements: userData.achievements || []
                };
                console.log('✅ AuthManager: Глобальный playerStats обновлен:', window.playerStats);
            }

            // Сохраняем синхронизированные данные локально
            this.saveSession();
            console.log('✅ AuthManager: Статистика синхронизирована из БД', this.userStats);
            
            // Обновляем UI если функция доступна
            if (window.updateMainScreenStats) {
                console.log('🎨 AuthManager: Обновляем UI...');
                window.updateMainScreenStats();
            }
            
            return true;

        } catch (err) {
            console.error('❌ AuthManager: Ошибка при синхронизации статистики:', err);
            return false;
        }
    }

    // Запустить автоматическую синхронизацию статистики
    startAutoSync(intervalSeconds = 10) {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
        }

        this.syncInterval = setInterval(async () => {
            if (this.isAuthenticated) {
                await this.syncStatsFromDatabase();
            }
        }, intervalSeconds * 1000);

        console.log(`✅ AuthManager: Автосинхронизация включена (каждые ${intervalSeconds} сек)`);
    }

    // Остановить автоматическую синхронизацию
    stopAutoSync() {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
            console.log('✅ AuthManager: Автосинхронизация отключена');
        }
    }

    // Сохранить сессию
    saveSession() {
        localStorage.setItem('animeQuizSession', JSON.stringify({
            user: this.currentUser,
            userStats: this.userStats,
            loginTime: new Date().toISOString()
        }));
    }

    // Генерировать UUID
    generateUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = (Math.random() * 16) | 0;
            const v = c === 'x' ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    }
}

// Инициализация глобального экземпляра
window.authManager = new AuthManager();
