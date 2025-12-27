class MultiplayerNormalMode {
    constructor() {
        this.name = 'multiplayer_normal';
        this.displayName = '👥 Мультиплеер (Обычный)';
        this.isHost = false;
        this.maxQuestions = 10;
        this.hostReady = false;
        this.guestReady = false;
        this.gameEnded = false; // Флаг чтобы не вызвать завершение дважды
        this.sharedQuestions = []; // Полные данные вопросов (correctId, wrongIds, order) для обоих игроков
        this.guestQuestionsLoaded = false; // Флаг что гость загрузил вопросы
        this.gameStarted = false; // Флаг что игра уже запущена
        this.questionsLoadedFromDB = false; // Флаг что вопросы уже загружены из БД (чтобы не загружать дважды)
    }

    // Для совместимости с фреймворком
    startAsHost(friendId, maxQuestions = 10) {
        console.log('🚀 Запуск как хост:', friendId, 'вопросов:', maxQuestions);
        this.isHost = true;
        this.maxQuestions = maxQuestions;
        this.friendId = friendId;
        
        // Получаем текущего пользователя
        const currentUser = window.authManager?.getCurrentUser();
        if (!currentUser) {
            console.error('❌ Пользователь не авторизован');
            alert('Ошибка: пользователь не авторизован!');
            return;
        }

        // Создаем сессию в БД
        this.createGameSession(currentUser.id, friendId, maxQuestions)
            .then(session => {
                console.log('✅ Сессия создана:', session.id);
                this.gameSessionId = session.id;
                window.currentMultiplayerSessionId = session.id;
                
                this.showWaitingScreen();
                this.setupGameSessionListener(session.id);
                this.setupHostSessionCheckFallback(session.id);
            })
            .catch(error => {
                console.error('❌ Ошибка создания сессии:', error);
                alert('Ошибка создания сессии!');
            });
    }

    startAsGuest(inviteData) {
        console.log('🚀 Запуск как гость (ОБЫЧНЫЙ режим):', inviteData);
        this.isHost = false;
        this.maxQuestions = inviteData.max_questions || 10;
        
        // Получаем текущего пользователя
        const currentUser = window.authManager?.getCurrentUser();
        if (!currentUser) {
            console.error('❌ Пользователь не авторизован');
            alert('Ошибка: пользователь не авторизован!');
            return;
        }
        
        // Ищем сессию по хосту и гостю
        this.getGameSessionByUsers(inviteData.from_user_id, currentUser.id)
            .then(session => {
                if (session) {
                    console.log('✅ Сессия найдена:', session.id);
                    this.gameSessionId = session.id;
                    window.currentMultiplayerSessionId = session.id;
                    
                    // Загружаем полные данные вопросов из сессии (если они уже были сохранены)
                    if (session.shared_questions) {
                        try {
                            const questionsData = typeof session.shared_questions === 'string' 
                                ? JSON.parse(session.shared_questions) 
                                : session.shared_questions;
                            this.sharedQuestions = questionsData;
                            console.log('📥 ГОСТЬ: Загруженные вопросы при старте:', this.sharedQuestions.length, 'штук');
                        } catch (e) {
                            console.error('❌ Ошибка парсинга общих вопросов:', e);
                            this.sharedQuestions = [];
                        }
                    } else {
                        console.log('📋 ГОСТЬ: Вопросы еще не сгенерированы, инициализирую пустой массив');
                        this.sharedQuestions = [];
                    }
                    
                    // Обновляем статус на guest_joined
                    this.updateGameSession(session.id, { status: 'guest_joined' });
                    
                    this.showReadyScreen();
                    this.setupGameSessionListener(session.id);
                    this.setupGameStartListener(session.id);
                    this.setupGuestGameStartFallback(session.id);
                }
            })
            .catch(error => {
                console.error('❌ Ошибка поиска сессии:', error);
                alert('Ошибка поиска сессии!');
            });
    }

    // ============ СЛУШАТЕЛИ РЕАЛ-ТАЙМА ============

    setupGameSessionListener(sessionId) {
        console.log('👂 Настройка слушателя сессии:', sessionId);
        
        const client = window.authManager?.supabase;
        if (!client) return;

        const self = this;
        let lastHostReady = false;
        let lastGuestReady = false;
        
        // Сохраняем канал в переменную класса
        this.gameChannel = client
            .channel(`session:${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'multiplayer_sessions',
                    filter: `id=eq.${sessionId}`
                },
                payload => {
                    const newStatus = payload.new.status;
                    const newHostReady = payload.new.host_ready || false;
                    const newGuestReady = payload.new.guest_ready || false;
                    
                    console.log('🔔 ОБНОВЛЕНИЕ ПОЛУЧЕНО:');
                    console.log('   - status:', newStatus);
                    console.log('   - host_ready:', newHostReady, '(было:', lastHostReady, ')');
                    console.log('   - guest_ready:', newGuestReady, '(было:', lastGuestReady, ')');
                    console.log('   - isHost:', self.isHost);
                    console.log('   - shared_questions in payload:', !!payload.new.shared_questions);
                    
                    // ГОСТЬ: Синхронизируем вопросы от хоста в реал-тайме
                    if (!self.isHost && payload.new.shared_questions && !self.questionsLoadedFromDB) {
                        try {
                            const questionsData = typeof payload.new.shared_questions === 'string'
                                ? JSON.parse(payload.new.shared_questions)
                                : payload.new.shared_questions;
                            
                            // Проверяем что вопросы загружены полностью (количество совпадает)
                            if (questionsData && questionsData.length > 0) {
                                self.sharedQuestions = questionsData;
                                self.questionsLoadedFromDB = true; // Отмечаем что вопросы загружены
                                console.log('🔄 ГОСТЬ: Получены вопросы от хоста в real-time:');
                                console.log('   - Всего вопросов:', self.sharedQuestions.length);
                                console.log('   - Установлен флаг questionsLoadedFromDB = true');
                                if (self.sharedQuestions.length > 0) {
                                    console.log('   - Первый вопрос:', self.sharedQuestions[0].correctAnimeTitle);
                                    console.log('   - Последний вопрос:', self.sharedQuestions[self.sharedQuestions.length - 1].correctAnimeTitle);
                                }
                            }
                        } catch (e) {
                            console.error('❌ Ошибка парсинга общих вопросов:', e);
                            console.error('   - Пришли данные:', payload.new.shared_questions);
                        }
                    }
                    
                    // Если гость присоединился, показываем хосту экран готовности
                    if (newStatus === 'guest_joined' && self.isHost) {
                        self.showReadyToStartScreen();
                    }
                    
                    // Если игра началась
                    if (newStatus === 'in_progress') {
                        console.log('📢 Статус: in_progress (игра началась)');
                        
                        // ГОСТЬ: Синхронизируемся с хостом
                        if (!self.isHost && !self.gameStarted) {
                            console.log('👤 ГОСТЬ: Игра началась, проверяю готовность вопросов');
                            
                            // Если вопросы уже пришли через real-time update
                            if (self.sharedQuestions && self.sharedQuestions.length > 0) {
                                console.log('✅ ГОСТЬ: Вопросы уже загружены через real-time, запускаю игру');
                                self.gameStarted = true;
                                self.startGame('easy');
                                // Небольшая задержка для синхронизации с хостом
                                setTimeout(() => {
                                    console.log('🎬 ГОСТЬ: Запускаю первый вопрос (real-time)');
                                    self.nextQuestion();
                                }, 100);
                            } else {
                                // Если вопросы еще не пришли - загружаем из БД
                                console.log('⏳ ГОСТЬ: Вопросы еще не пришли, загружаю из БД...');
                                const loadQuestionsForGuest = async (attempt = 1) => {
                                    try {
                                        await self.loadSharedQuestionsFromDB();
                                        console.log('✅ ГОСТЬ: Вопросы загружены из БД (попытка', attempt, ')');
                                        console.log('   - Всего вопросов:', self.sharedQuestions?.length);
                                        
                                        if (!self.gameStarted) {
                                            self.gameStarted = true;
                                            self.startGame('easy');
                                            // Задержка чтобы синхронизироваться с хостом
                                            setTimeout(() => {
                                                console.log('🎬 ГОСТЬ: Запускаю первый вопрос (из БД)');
                                                self.nextQuestion();
                                            }, 100);
                                        }
                                    } catch (error) {
                                        console.error('❌ ГОСТЬ: Ошибка загрузки вопросов (попытка', attempt, '):', error);
                                        if (attempt < 5) {
                                            console.log('👂 ГОСТЬ: Повторяю попытку через 300мс...');
                                            setTimeout(() => loadQuestionsForGuest(attempt + 1), 300);
                                        } else {
                                            alert('Ошибка загрузки вопросов после 5 попыток!');
                                            self.endGame();
                                        }
                                    }
                                };
                                
                                loadQuestionsForGuest();
                            }
                        }
                    }
                    // Если игра завершена
                    if (newStatus === 'completed' && !self.gameEnded) {
                        console.log('🏁 ПОЛУЧЕНО: Игра завершена для обоих игроков');
                        self.gameEnded = true; // Устанавливаем флаг чтобы не вызвать дважды
                        clearInterval(window.gameState?.timer);
                        if (window.audioManager) {
                            window.audioManager.stopMusic();
                        }
                        self.showFinalStats();
                        if (window.checkAchievements) window.checkAchievements();
                    }

                    // Обновляем состояние готовности
                    self.hostReady = newHostReady;
                    self.guestReady = newGuestReady;
                    
                    console.log('📋 Состояние готовности - host:', self.hostReady, 'guest:', self.guestReady);
                    
                    // Проверяем если оба готовы и хотя бы один статус изменился
                    const hostReadyChanged = newHostReady !== lastHostReady;
                    const guestReadyChanged = newGuestReady !== lastGuestReady;
                    
                    if (newHostReady && newGuestReady && (hostReadyChanged || guestReadyChanged) && window.gameState) {
                        console.log('✅ ОБА ИГРОКА ГОТОВЫ! (host изменился:', hostReadyChanged, ', guest изменился:', guestReadyChanged, ')');
                        self.checkIfBothReady();
                    }
                    
                    // Обновляем последние известные значения
                    lastHostReady = newHostReady;
                    lastGuestReady = newGuestReady;
                }
            )
            .subscribe((status) => {
                console.log('📡 Статус подписки на канал:', status);
            });
        
        console.log('✅ Слушатель сессии настроен');
    }    setupGameStartListener(sessionId) {
        console.log('👂 Настройка слушателя старта игры (Normal режим не использует)');
        // В Normal режиме startGame вызывается из checkIfBothReady после обратного отчета
        // Эта функция оставлена для совместимости, но не используется
    }

    setupHostSessionCheckFallback(sessionId) {
        console.log('⏲️ Настройка fallback проверки');
        
        let checkCount = 0;
        const maxChecks = 600;

        const interval = setInterval(async () => {
            checkCount++;
            if (checkCount > maxChecks) {
                clearInterval(interval);
                console.log('❌ Timeout ожидания гостя');
                return;
            }

            try {
                const session = await this.getGameSession(sessionId);
                if (session && session.status === 'guest_joined') {
                    console.log('✅ Гость присоединился (fallback)');
                    clearInterval(interval);
                    this.showReadyToStartScreen();
                }
            } catch (error) {
                console.error('❌ Ошибка проверки:', error);
            }
        }, 1000);

        window.hostSessionCheckInterval = interval;
    }

    setupGuestGameStartFallback(sessionId) {
        console.log('⏲️ Настройка fallback проверки старта');
        
        let checkCount = 0;
        const maxChecks = 600;

        const interval = setInterval(async () => {
            checkCount++;
            if (checkCount > maxChecks) {
                clearInterval(interval);
                console.log('❌ Timeout ожидания старта');
                return;
            }

            try {
                const session = await this.getGameSession(sessionId);
                if (session && session.status === 'in_progress') {
                    console.log('✅ Игра началась (fallback для гостя)');
                    clearInterval(interval);
                    
                    // Гость загружает вопросы и запускает игру (но только если не запущена еще)
                    if (!this.isHost && !this.gameStarted) {
                        try {
                            await this.loadSharedQuestionsFromDB();
                            console.log('✅ Вопросы загружены (fallback)');
                            this.gameStarted = true;
                            this.startGame('easy');
                            this.nextQuestion();
                        } catch (error) {
                            console.error('❌ Ошибка в fallback:', error);
                            alert('Ошибка загрузки игры!');
                            this.endGame();
                        }
                    }
                }
            } catch (error) {
                console.error('❌ Ошибка проверки:', error);
            }
        }, 1000);

        window.guestGameStartInterval = interval;
    }

    // ============ МЕТОДЫ БД ============

    async getGameSession(sessionId) {
        console.log('📋 Получение сессии:', sessionId);
        try {
            const client = window.authManager?.supabase;
            if (!client) throw new Error('Supabase not initialized');
            const { data, error } = await client
                .from('multiplayer_sessions')
                .select('*')
                .eq('id', sessionId)
                .limit(1);

            if (error) throw error;
            return data && data.length > 0 ? data[0] : null;
        } catch (error) {
            console.error('❌ Ошибка получения сессии:', error);
            return null;
        }
    }

    async getGameSessionByUsers(hostId, guestId) {
        console.log('📋 Поиск сессии между:', hostId, guestId);
        try {
            const client = window.authManager?.supabase;
            if (!client) throw new Error('Supabase not initialized');
            const { data, error } = await client
                .from('multiplayer_sessions')
                .select('*')
                .eq('host_id', hostId)
                .eq('guest_id', guestId)
                .in('status', ['waiting_acceptance', 'waiting_guest', 'guest_joined', 'in_progress'])
                .order('created_at', { ascending: false })
                .limit(1);

            if (error) throw error;
            return data && data.length > 0 ? data[0] : null;
        } catch (error) {
            console.error('❌ Ошибка поиска сессии:', error);
            return null;
        }
    }

    async createGameSession(hostId, guestId, maxQuestions) {
        console.log('➕ Создание новой сессии');
        try {
            const client = window.authManager?.supabase;
            if (!client) throw new Error('Supabase not initialized');
            const { data, error } = await client
                .from('multiplayer_sessions')
                .insert([
                    {
                        host_id: hostId,
                        guest_id: guestId,
                        max_questions: maxQuestions,
                        host_score: 0,
                        guest_score: 0,
                        current_question_index: 0,
                        status: 'waiting_guest',
                        created_at: new Date()
                    }
                ])
                .select();

            if (error) throw error;
            return data && data.length > 0 ? data[0] : null;
        } catch (error) {
            console.error('❌ Ошибка создания сессии:', error);
            throw error;
        }
    }

    async updateGameSession(sessionId, updates) {
        console.log('✏️ Обновление сессии:', sessionId, updates);
        try {
            const client = window.authManager?.supabase;
            if (!client) throw new Error('Supabase not initialized');
            const { data, error } = await client
                .from('multiplayer_sessions')
                .update(updates)
                .eq('id', sessionId)
                .select();

            if (error) throw error;
            return data && data.length > 0 ? data[0] : null;
        } catch (error) {
            console.error('❌ Ошибка обновления сессии:', error);
            throw error;
        }
    }

    async getGameSessionData(sessionId) {
        console.log('📋 Получение данных сессии:', sessionId);
        try {
            const client = window.authManager?.supabase;
            if (!client) throw new Error('Supabase not initialized');
            const { data, error } = await client
                .from('multiplayer_sessions')
                .select('host_score, guest_score, host_id, guest_id')
                .eq('id', sessionId)
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('❌ Ошибка получения данных сессии:', error);
            throw error;
        }
    }

    async loadSharedQuestionsFromDB() {
        console.log('🔄 Загрузка общих вопросов из БД');
        
        // Если вопросы уже загружены, не загружаем повторно
        if (this.questionsLoadedFromDB && this.sharedQuestions.length > 0) {
            console.log('✅ Вопросы уже загружены ранее, пропускаю повторную загрузку');
            return;
        }
        
        try {
            const client = window.authManager?.supabase;
            if (!client) throw new Error('Supabase not initialized');
            if (!this.gameSessionId) throw new Error('Game session ID not set');
            
            const { data, error } = await client
                .from('multiplayer_sessions')
                .select('shared_questions')
                .eq('id', this.gameSessionId)
                .single();

            if (error) throw error;
            
            if (data && data.shared_questions) {
                try {
                    const questionsData = typeof data.shared_questions === 'string'
                        ? JSON.parse(data.shared_questions)
                        : data.shared_questions;
                    this.sharedQuestions = questionsData;
                    this.questionsLoadedFromDB = true; // Отмечаем что вопросы загружены
                    console.log('✅ ГОСТЬ: Загружено из БД:', questionsData.length, 'вопросов');
                    console.log('   - Первый вопрос:', questionsData[0]?.correctAnimeTitle);
                    console.log('   - Последний вопрос:', questionsData[questionsData.length - 1]?.correctAnimeTitle);
                    console.log('   - this.sharedQuestions после загрузки:', this.sharedQuestions.length);
                } catch (e) {
                    console.error('❌ Ошибка парсинга:', e);
                    throw e;
                }
            } else {
                console.warn('⚠️ shared_questions пусто в БД');
                this.sharedQuestions = [];
            }
        } catch (error) {
            console.error('❌ Ошибка загрузки вопросов из БД:', error);
            throw error;
        }
    }

    showWaitingScreen() {
        console.log('⏳ Показ экрана ожидания для хоста');
        
        const existingScreen = document.getElementById('multiplayer-waiting-screen');
        if (existingScreen) {
            existingScreen.remove();
        }

        const screenHtml = `
            <div id="multiplayer-waiting-screen" class="screen">
                <div class="container" style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 80vh;">
                    <div style="text-align: center;">
                        <div style="font-size: 60px; margin-bottom: 20px; animation: pulse 1.5s ease-in-out infinite;">⏳</div>
                        <h2>Ожидание гостя...</h2>
                        <p style="color: #c4b5fd; margin: 20px 0;">Приглашение отправлено</p>
                        <p style="color: #a78bfa; margin: 10px 0; font-size: 16px;">📊 Игра на ${this.maxQuestions} вопросов</p>
                        
                        <button class="btn secondary-btn" onclick="showScreen('game-modes-screen')" style="margin-top: 30px;">
                            Отмена
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', screenHtml);
        showScreen('multiplayer-waiting-screen');
    }

    showReadyScreen() {
        console.log('✅ Показ экрана готовности для гостя');
        
        const existingScreen = document.getElementById('multiplayer-ready-screen');
        if (existingScreen) {
            existingScreen.remove();
        }

        const screenHtml = `
            <div id="multiplayer-ready-screen" class="screen">
                <div class="container" style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 80vh;">
                    <div style="text-align: center;">
                        <div style="font-size: 60px; margin-bottom: 20px;">✅</div>
                        <h2>Вы присоединились</h2>
                        <p style="color: #c4b5fd; margin: 20px 0;">Ожидаем начала игры...</p>
                        <p style="color: #a78bfa; margin: 10px 0; font-size: 16px;">📊 Игра на ${this.maxQuestions} вопросов</p>
                        
                        <button class="btn secondary-btn" onclick="showScreen('game-modes-screen')" style="margin-top: 30px;">
                            Отмена
                        </button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', screenHtml);
        showScreen('multiplayer-ready-screen');
    }

    showReadyToStartScreen() {
        console.log('🎯 Показ экрана готовности к старту для хоста (ОБЫЧНЫЙ режим)');
        
        const existingScreen = document.getElementById('multiplayer-ready-to-start-screen');
        if (existingScreen) {
            existingScreen.remove();
        }

        const screenHtml = `
            <div id="multiplayer-ready-to-start-screen" class="screen">
                <div class="container" style="display: flex; flex-direction: column; justify-content: center; align-items: center; height: 80vh;">
                    <div style="text-align: center;">
                        <div style="font-size: 60px; margin-bottom: 20px;">🎯</div>
                        <h2>Противник присоединился</h2>
                        <p style="color: #c4b5fd; margin: 20px 0;">Готовы начать игру?</p>
                        <p style="color: #a78bfa; margin: 10px 0; font-size: 16px;">📊 Игра на ${this.maxQuestions} вопросов (ОДИНАКОВЫЕ вопросы)</p>
                        
                        <div style="display: flex; gap: 20px; justify-content: center; margin-top: 30px; flex-wrap: wrap;">
                            <button class="btn start-btn" onclick="startMultiplayerNormalGameNow()" 
                                    style="font-size: 18px; padding: 20px 40px;">
                                ▶️ Начать игру
                            </button>
                            <button class="btn secondary-btn" onclick="showScreen('game-modes-screen')" 
                                    style="font-size: 18px; padding: 20px 40px;">
                                ❌ Отмена
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', screenHtml);
        showScreen('multiplayer-ready-to-start-screen');
    }

    startGame(difficulty = 'easy') {
        console.log('🚀 Запуск мультиплеера, сложность:', difficulty);
        console.log('📊 Всего вопросов:', this.maxQuestions);
        
        // Сбрасываем флаг загрузки вопросов для новой игры
        this.questionsLoadedFromDB = false;
        
        window.gameState = {
            score: 0,
            currentQuestion: 0,
            timeLeft: this.getTimeByDifficulty(difficulty),
            timer: null,
            currentMusic: null,
            correctAnswers: 0,
            startTime: Date.now(),
            currentCorrectAnime: null,
            usedAnimeIds: [],
            lives: 0,
            gameMode: this.name,
            difficulty: difficulty,
            musicStarted: false,
            maxQuestions: this.maxQuestions
        };

        if (window.playerStats) {
            window.playerStats.gamesPlayed++;
            if (window.saveStats) window.saveStats();
        }

        // Обновляем статус в БД, если это хост
        if (this.isHost) {
            this.updateGameSession(this.gameSessionId, { 
                status: 'in_progress'
            }).catch(error => {
                console.error('❌ Ошибка обновления статуса игры:', error);
            });
        }

        this.showGameScreen();
        // НЕ вызываем loadQuestion здесь! Она будет вызвана из nextQuestion() после генерации вопросов
        console.log('✅ startGame завершен, ожидаем checkIfBothReady для генерации вопросов');
    }

    generateAllQuestions() {
        console.log('🎲 Генерирую ВСЕ вопросы сразу для обоих игроков');
        
        if (!window.animeDatabase || window.animeDatabase.length === 0) {
            console.error('❌ База аниме пуста!');
            return false;
        }

        try {
            this.sharedQuestions = [];
            const usedAnimeIds = [];

            for (let i = 0; i < this.maxQuestions; i++) {
                console.log(`🔄 Генерирую вопрос ${i + 1}/${this.maxQuestions}`);
                
                // Выбираем правильный ответ (getRandomAnime при count=1 возвращает объект, не массив)
                const correctAnimeResult = window.getRandomAnime(1, usedAnimeIds);
                if (!correctAnimeResult) {
                    console.error(`❌ Не удалось выбрать правильный ответ для вопроса ${i + 1}`);
                    return false;
                }
                
                // correctAnimeResult может быть объект или массив из одного элемента
                const correctAnime = Array.isArray(correctAnimeResult) ? correctAnimeResult[0] : correctAnimeResult;
                
                if (!correctAnime || !correctAnime.id) {
                    console.error(`❌ Неправильный формат аниме для вопроса ${i + 1}:`, correctAnime);
                    return false;
                }
                
                usedAnimeIds.push(correctAnime.id);

                // Выбираем неправильные ответы
                const wrongAnime = window.getRandomAnime(3, [...usedAnimeIds]);
                if (!wrongAnime || wrongAnime.length < 3) {
                    console.error(`❌ Недостаточно аниме для неправильных ответов в вопросе ${i + 1}`);
                    console.log(`   - Нужно: 3, Получено: ${wrongAnime?.length || 0}`);
                    return false;
                }

                // Создаем массив всех ответов
                const allAnswers = [correctAnime, ...wrongAnime];
                
                // Перемешиваем ответы
                if (window.shuffleArray) {
                    window.shuffleArray(allAnswers);
                }

                // Сохраняем вопрос
                const questionData = {
                    correctId: correctAnime.id,
                    wrongIds: wrongAnime.map(a => a.id),
                    order: allAnswers.map(a => a.id),
                    correctAnimeTitle: correctAnime.title,
                    correctAnimeMusic: correctAnime.music
                };

                this.sharedQuestions.push(questionData);
                console.log(`   ✅ Вопрос ${i + 1}: ${correctAnime.title} (порядок: ${questionData.order.join(', ')})`);
            }

            console.log('✅ ВСЕ вопросы сгенерированы! Всего:', this.sharedQuestions.length);
            return true;
        } catch (error) {
            console.error('❌ Ошибка при генерации вопросов:', error);
            return false;
        }
    }

    showGameScreen() {
        console.log('🎮 Показ игрового экрана мультиплеера');
        
        const existingGameScreen = document.getElementById('game-screen');
        if (existingGameScreen) {
            existingGameScreen.remove();
        }

        const currentVolume = window.audioManager ? window.audioManager.getCurrentVolume() : 50;

        const gameScreenHtml = `
            <div id="game-screen" class="screen">
                <div class="container">
                    <div class="game-header question-transition">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                                <span id="timer">${window.gameState.timeLeft}</span>
                                <span>Вопрос <span id="question-number">1</span>/<span id="max-questions">${window.gameState.maxQuestions}</span></span>
                                <span>Счёт: <span id="score">0</span></span>
                            </div>
                            
                            <!-- ГОРИЗОНТАЛЬНЫЙ РЕГУЛЯТОР ГРОМКОСТИ (на 40% меньше) -->
                            <div class="volume-container">
                                <div class="volume-icon" title="Громкость" id="volume-icon">
                                    🔊
                                </div>
                                <div class="volume-slider-container">
                                    <div class="volume-slider-wrapper">
                                        <div class="volume-track"></div>
                                        <div class="volume-track-fill" id="volume-track-fill"></div>
                                        <input type="range" 
                                               class="volume-slider"
                                               id="game-volume" 
                                               min="0" 
                                               max="100" 
                                               value="${currentVolume}"
                                               oninput="updateGameVolume(this.value)">
                                    </div>
                                    <div class="volume-value-display" id="game-volume-value">${currentVolume}%</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div class="game-info question-transition">
                        <span id="game-mode">${this.displayName}</span>
                    </div>

                    <div class="music-controls question-transition" style="text-align: center; margin: 50px 0;">
                        <button class="btn start-btn" onclick="startMusicForQuestion()" 
                                style="font-size: 20px; padding: 25px 40px; margin: 20px auto;">
                            🎵 Начать прослушивание
                        </button>
                        <p style="color: #c4b5fd; margin-top: 15px;">Нажмите кнопку чтобы начать слушать опенинг</p>
                    </div>

                    <!-- КОНТЕЙНЕР ДЛЯ ВАРИАНТОВ ОТВЕТА -->
                    <div id="answers-container" style="opacity: 0; transition: opacity 0.5s ease; display: none;">
                        <div class="answers-grid" id="answers">
                            <!-- Варианты ответов будут добавлены здесь -->
                        </div>
                    </div>

                    <div class="result-stats hidden" id="result-stats">
                        <!-- Контент будет добавляться динамически после ответа -->
                    </div>

                    <!-- КНОПКИ УПРАВЛЕНИЯ ИГРОЙ -->
                    <div class="game-buttons" style="margin-top: 30px;">
                        ${this.isHost ? '<button class="btn secondary-btn" onclick="window.endGame()">Завершить игру</button>' : ''}
                        ${this.isHost ? '<button class="btn secondary-btn" onclick="window.showScreen(\'game-modes-screen\')" style="margin-top: 10px;">Отмена</button>' : ''}
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', gameScreenHtml);
        showScreen('game-screen');
        
        this.setupVolumeControl(currentVolume);
        
        // Fallback: проверяем статус игры каждые 2 секунды
        console.log('⏱️ Запускаю fallback проверку статуса завершения');
        const gameStatusCheckInterval = setInterval(async () => {
            if (!this.gameSessionId) {
                clearInterval(gameStatusCheckInterval);
                return;
            }

            try {
                const client = window.authManager?.supabase;
                if (!client) {
                    clearInterval(gameStatusCheckInterval);
                    return;
                }

                const { data, error } = await client
                    .from('multiplayer_sessions')
                    .select('status')
                    .eq('id', this.gameSessionId)
                    .single();

                if (!error && data && data.status === 'completed' && !this.gameEnded) {
                    console.log('✅ Fallback: Обнаружено завершение игры');
                    this.gameEnded = true; // Устанавливаем флаг
                    clearInterval(gameStatusCheckInterval);
                    clearInterval(window.gameState.timer);
                    if (window.audioManager) {
                        window.audioManager.stopMusic();
                    }
                    this.showFinalStats();
                    if (window.checkAchievements) window.checkAchievements();
                }
            } catch (error) {
                console.error('❌ Ошибка fallback проверки:', error);
                clearInterval(gameStatusCheckInterval);
            }
        }, 2000);
        
        // Останавливаем fallback через 2 часа (игра точно закончится)
        setTimeout(() => {
            clearInterval(gameStatusCheckInterval);
            console.log('⏹️ Остановка fallback проверки статуса');
        }, 7200000);
        
        console.log('✅ Игровой экран показан');
    }

    setupVolumeControl(initialVolume) {
        console.log('🔊 Настройка регулятора громкости, начальное значение:', initialVolume);
        
        const volumeSlider = document.getElementById('game-volume');
        const volumeValue = document.getElementById('game-volume-value');
        const volumeTrackFill = document.getElementById('volume-track-fill');
        
        this.updateVolumeTrack(initialVolume);
        this.updateVolumeIcon(initialVolume);
        
        if (volumeSlider && volumeValue && volumeTrackFill) {
            volumeSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                volumeValue.textContent = value + '%';
                this.updateVolumeTrack(value);
                this.updateVolumeIcon(value);
                
                volumeValue.classList.add('volume-pulse');
                setTimeout(() => {
                    volumeValue.classList.remove('volume-pulse');
                }, 500);
                
                console.log('🔊 Громкость изменена:', value + '%');
            });
        }
    }

    updateVolumeTrack(volume) {
        const volumeTrackFill = document.getElementById('volume-track-fill');
        if (volumeTrackFill) {
            volumeTrackFill.style.width = `${volume}%`;
        }
    }

    updateVolumeIcon(volume) {
        const volumeIcon = document.getElementById('volume-icon');
        if (volumeIcon) {
            volumeIcon.className = 'volume-icon';
            
            if (volume === 0) {
                volumeIcon.textContent = '🔇';
                volumeIcon.classList.add('muted');
            } else if (volume < 30) {
                volumeIcon.textContent = '🔈';
                volumeIcon.classList.add('low');
            } else if (volume < 70) {
                volumeIcon.textContent = '🔉';
                volumeIcon.classList.add('medium');
            } else {
                volumeIcon.textContent = '🔊';
                volumeIcon.classList.add('high');
            }
        }
    }

    loadQuestion() {
        console.log('📝 Загрузка вопроса - НАЧАЛО');
        console.log('   - currentQuestion:', window.gameState?.currentQuestion);
        console.log('   - maxQuestions:', window.gameState?.maxQuestions);
        console.log('   - sharedQuestions длина:', this.sharedQuestions?.length);
        
        if (!window.gameState) {
            console.error('❌ gameState не определен');
            return;
        }
        
        if (!this.sharedQuestions || this.sharedQuestions.length === 0) {
            console.error('❌ sharedQuestions пустой или не определен!');
            console.error('   - this.sharedQuestions:', this.sharedQuestions);
            return;
        }

        window.gameState.musicStarted = false;
        this.updateGameHeader();

        if (!window.animeDatabase || window.animeDatabase.length === 0) {
            console.error('❌ База аниме пуста');
            alert('База аниме не загружена! Попробуйте обновить библиотеку.');
            this.endGame();
            return;
        }

        const currentQuestionNum = window.gameState.currentQuestion;
        const questionIndex = currentQuestionNum - 1; // Индекс в массиве (0-based)
        
        console.log(`🔍 Ищу вопрос: номер ${currentQuestionNum}, индекс ${questionIndex}`);
        console.log(`   - Всего вопросов в памяти: ${this.sharedQuestions.length}`);

        // Получаем данные вопроса из готового списка
        if (questionIndex < 0 || questionIndex >= this.sharedQuestions.length) {
            console.error(`❌ Индекс вопроса ${questionIndex} выходит за границы массива!`);
            console.error('   - currentQuestionNum:', currentQuestionNum);
            console.error('   - sharedQuestions.length:', this.sharedQuestions.length);
            console.error('   - sharedQuestions:', this.sharedQuestions);
            this.endGame();
            return;
        }

        const questionData = this.sharedQuestions[questionIndex];
        
        if (!questionData) {
            console.error(`❌ Вопрос с индексом ${questionIndex} равен null/undefined`);
            this.endGame();
            return;
        }
        
        console.log(`✅ Вопрос ${currentQuestionNum}: ${questionData.correctAnimeTitle}`);
        console.log('   - correctId:', questionData.correctId);
        console.log('   - wrongIds:', questionData.wrongIds);
        console.log('   - order (порядок ответов):', questionData.order);
        console.log('   - correctAnimeMusic:', questionData.correctAnimeMusic);

        // ОБА ИГРОКА: Используют одинаковые данные вопроса
        const allAnswerIds = questionData.order;
        const allAnswers = allAnswerIds.map(id => window.animeDatabase.find(a => a.id === id));
        const correctAnime = window.animeDatabase.find(a => a.id === questionData.correctId);

        if (!correctAnime) {
            console.error(`❌ Аниме с id ${questionData.correctId} не найдено в БД`);
            this.endGame();
            return;
        }

        console.log('   ✅ Порядок ответов для обоих:', allAnswerIds);

        this.updateAnswersUI(allAnswers, correctAnime);
        
        window.gameState.currentMusic = questionData.correctAnimeMusic;
        window.gameState.currentCorrectAnime = correctAnime;
        
        console.log('   - Установлена музыка:', window.gameState.currentMusic);

        document.getElementById('answers-container').style.opacity = '0';
        document.getElementById('answers-container').style.display = 'none';
        document.getElementById('result-stats').classList.add('hidden');
        document.getElementById('result-stats').innerHTML = '';
        
        document.querySelector('.music-controls').style.display = 'block';

        this.animateQuestionTransition();
        console.log(`✅ Вопрос ${currentQuestionNum} загружен с одинаковыми ответами для обоих`);
    }

    animateQuestionTransition() {
        const elements = document.querySelectorAll('.question-transition');
        elements.forEach((element, index) => {
            element.style.animation = 'none';
            setTimeout(() => {
                element.style.animation = `questionTransition 0.6s ease-out ${index * 0.1}s both`;
            }, 10);
        });
    }

    updateGameHeader() {
        const timerElement = document.getElementById('timer');
        const questionElement = document.getElementById('question-number');
        const maxQuestionsElement = document.getElementById('max-questions');
        const scoreElement = document.getElementById('score');
        
        if (timerElement) timerElement.textContent = window.gameState.timeLeft;
        if (questionElement) questionElement.textContent = window.gameState.currentQuestion;
        if (maxQuestionsElement) maxQuestionsElement.textContent = window.gameState.maxQuestions;
        if (scoreElement) scoreElement.textContent = window.gameState.score;

        if (timerElement && window.gameState.timeLeft <= 5) {
            timerElement.classList.add('warning');
        } else if (timerElement) {
            timerElement.classList.remove('warning');
        }
    }

    updateAnswersUI(answers, correctAnime) {
        console.log('🎨 Обновление UI вариантов ответа');
        
        const answersContainer = document.getElementById('answers');
        if (!answersContainer) {
            console.error('❌ Контейнер ответов не найден');
            return;
        }

        answersContainer.innerHTML = '';

        answers.forEach((anime, index) => {
            const button = document.createElement('button');
            button.className = 'answer-btn center-reveal';
            button.textContent = anime.title;
            button.style.animationDelay = `${index * 0.1}s`;
            
            button.onclick = () => {
                console.log('🎯 Выбран ответ:', anime.title);
                console.log('✅ Правильный ответ:', correctAnime.title);
                console.log('🔍 Сравнение ID:', anime.id === correctAnime.id);
                this.checkAnswer(anime.id === correctAnime.id, correctAnime, button);
            };
            
            answersContainer.appendChild(button);
            console.log(`✅ Добавлен вариант ${index + 1}: ${anime.title}`);
        });
        
        console.log('🎨 Все варианты ответов добавлены');
    }

    startMusicForQuestion() {
        console.log('🎵 Запуск музыки для вопроса');
        console.log('   - gameState:', !!window.gameState);
        console.log('   - currentMusic:', window.gameState?.currentMusic);
        console.log('   - currentCorrectAnime:', window.gameState?.currentCorrectAnime);
        
        if (!window.gameState || !window.gameState.currentMusic) {
            console.error('❌ Музыка не загружена');
            console.error('   - currentQuestion:', window.gameState?.currentQuestion);
            console.error('   - sharedQuestions длина:', window.currentGameMode?.sharedQuestions?.length);
            alert('❌ Вопрос еще не загружен. Подождите...');
            return;
        }

        if (window.gameState.musicStarted) {
            console.log('🎵 Музыка уже играет');
            return;
        }

        console.log('🎵 Запуск музыки...');
        window.gameState.musicStarted = true;

        const answersContainer = document.getElementById('answers-container');
        if (answersContainer) {
            answersContainer.style.display = 'block';
            setTimeout(() => {
                answersContainer.style.opacity = '1';
            }, 100);
        }

        document.querySelector('.music-controls').style.display = 'none';

        if (window.audioManager) {
            window.audioManager.playMusic(window.gameState.currentMusic)
                .then(() => {
                    console.log('✅ Музыка начала воспроизводиться');
                })
                .catch(error => {
                    console.error('❌ Ошибка воспроизведения музыки:', error);
                    if (answersContainer) {
                        answersContainer.style.display = 'block';
                        answersContainer.style.opacity = '1';
                    }
                    document.querySelector('.music-controls').style.display = 'none';
                });
        }

        this.startTimer();
    }

    startTimer() {
        console.log('⏱️ Запуск таймера');
        
        if (window.gameState.timer) {
            clearInterval(window.gameState.timer);
        }

        window.gameState.timeLeft = this.getTimeByDifficulty(window.gameState.difficulty);
        this.updateGameHeader();

        if (!window.gameState.musicStarted) {
            return;
        }

        window.gameState.timer = setInterval(() => {
            window.gameState.timeLeft--;
            this.updateGameHeader();

            if (window.gameState.timeLeft <= 0) {
                console.log('⏰ Время вышло!');
                clearInterval(window.gameState.timer);
                this.handleTimeOut();
            }
        }, 1000);
    }

    handleTimeOut() {
        console.log('⏰ Обработка истечения времени');
        
        if (window.audioManager) {
            window.audioManager.stopMusic();
        }
        this.showResult(false, window.gameState.currentCorrectAnime, 0, this.getTimeByDifficulty(window.gameState.difficulty));
    }

    checkAnswer(isCorrect, correctAnime, clickedButton) {
        console.log('✅ Проверка ответа:', isCorrect ? 'ПРАВИЛЬНО' : 'НЕПРАВИЛЬНО');
        
        if (!window.gameState.firstAnswerGiven) {
            window.gameState.firstAnswerGiven = true;
            const cancelButton = document.querySelector('.game-buttons .btn:nth-child(2)');
            if (cancelButton) {
                cancelButton.style.display = 'none';
            }
        }
        
        clearInterval(window.gameState.timer);
        if (window.audioManager) {
            window.audioManager.stopMusic();
        }

        const allButtons = document.querySelectorAll('.answer-btn');
        
        allButtons.forEach(button => {
            button.style.pointerEvents = 'none';
            if (button !== clickedButton) {
                button.classList.add('center-hide');
            }
        });

        setTimeout(() => {
            if (isCorrect) {
                clickedButton.classList.remove('center-reveal');
                clickedButton.classList.add('correct-answer-reveal');
            } else {
                clickedButton.classList.remove('center-reveal');
                clickedButton.classList.add('incorrect-answer-reveal');
                
                allButtons.forEach(button => {
                    if (button.textContent === correctAnime.title) {
                        button.classList.remove('center-hide', 'center-reveal');
                        button.classList.add('correct-answer-reveal');
                        button.style.display = 'block';
                    }
                });
            }

            setTimeout(() => {
                const timeTaken = this.getTimeByDifficulty(window.gameState.difficulty) - window.gameState.timeLeft;
                
                if (isCorrect) {
                    const timeBonus = Math.max(5, 30 - timeTaken);
                    const basePoints = this.getBasePointsByDifficulty(window.gameState.difficulty);
                    const pointsEarned = basePoints + timeBonus;

                    window.gameState.score += pointsEarned;
                    window.gameState.correctAnswers++;

                    if (window.playerStats) {
                        window.playerStats.correctAnswers++;
                        window.playerStats.xp += pointsEarned;
                    }

                    if (window.checkLevelUp) window.checkLevelUp();
                    
                    // Обновляем score в БД для синхронизации с гостем
                    if (this.isHost && this.gameSessionId) {
                        this.updateGameSession(this.gameSessionId, { host_score: window.gameState.score });
                    } else if (!this.isHost && this.gameSessionId) {
                        this.updateGameSession(this.gameSessionId, { guest_score: window.gameState.score });
                    }
                    
                    const scoreElement = document.getElementById('score');
                    if (scoreElement) {
                        scoreElement.classList.add('score-update');
                        setTimeout(() => {
                            scoreElement.classList.remove('score-update');
                        }, 600);
                    }

                    this.showResult(true, correctAnime, pointsEarned, timeTaken);
                } else {
                    this.showResult(false, correctAnime, 0, timeTaken);
                }
            }, 800);

        }, 300);

        if (window.playerStats) {
            window.playerStats.totalAnswers++;
        }

        if (window.saveStats) window.saveStats();
    }

    showResult(isCorrect, correctAnime, pointsEarned, timeTaken) {
        console.log('📊 Показ результата:', isCorrect ? 'Правильно' : 'Неправильно');
        
        const resultContainer = document.getElementById('result-stats');
        if (!resultContainer) {
            console.error('❌ Контейнер результата не найден');
            return;
        }
        
        let description = correctAnime.description || 'Описание отсутствует';
        if (description.length > 100) {
            description = description.substring(0, 100) + '...';
        }
        
        resultContainer.innerHTML = `
            <div class="result-content">
                <h2 id="result-title" style="color: ${isCorrect ? '#00ff7f' : '#ff4757'}">
                    ${isCorrect ? '✅ Правильно!' : '❌ Неправильно!'}
                </h2>
                
                <div style="display: block; text-align: center; margin: 10px 0;">
                    <img class="poster" src="${correctAnime.image}" alt="Постер аниме" style="max-width: 150px; border-radius: 10px; border: 2px solid #7c3aed;"
                         onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjIwIiBoZWlnaHQ9IjMxMSIgdmlld0JveD0iMCAwIDIyMCAzMTEiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMjAiIGhlaWdodD0iMzExIiBmaWxsPSIjMzc0MTUxIi8+Cjx0ZXh0IHg9IjExMCIgeT0iMTU1LjUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iI0M0QjVGRCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+Tm8gSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=';">
                </div>
                
                <h3 id="correct-answer">${correctAnime.title}</h3>
                <p id="result-description">${description}</p>

                <div class="result-details">
                    <p>Время: <span id="time-taken">${timeTaken}</span> сек</p>
                    <p>Очки: +<span id="points-earned">${pointsEarned}</span></p>
                    <p>Счёт: <span id="current-score">${window.gameState.score}</span></p>
                </div>

                <div class="result-buttons">
                    <button class="btn ready-btn" onclick="window.markPlayerReady()" style="margin: 10px 0;">✓ Готов</button>
                    ${this.isHost ? '<button class="btn secondary-btn" onclick="window.endGame()">Завершить игру</button>' : ''}
                    <p style="color: #a78bfa; text-align: center; margin-top: 15px;" data-waiting-message>⏳ Ожидаем другого игрока...</p>
                </div>
            </div>
        `;

        const answersContainer = document.getElementById('answers-container');
        if (answersContainer) {
            answersContainer.style.display = 'none';
        }
        
        resultContainer.classList.remove('hidden');
        
        // Fallback: проверяем готовность каждую секунду на случай если слушатель не сработал
        console.log('⏱️ Запускаю fallback проверку готовности каждую секунду');
        const readyCheckInterval = setInterval(async () => {
            if (!this.gameSessionId) {
                clearInterval(readyCheckInterval);
                return;
            }

            try {
                const client = window.authManager?.supabase;
                if (!client) {
                    clearInterval(readyCheckInterval);
                    return;
                }

                const { data, error } = await client
                    .from('multiplayer_sessions')
                    .select('host_ready, guest_ready')
                    .eq('id', this.gameSessionId)
                    .single();

                if (!error && data) {
                    console.log('🔍 Fallback проверка: host_ready=', data.host_ready, 'guest_ready=', data.guest_ready);
                    
                    if (data.host_ready && data.guest_ready) {
                        console.log('✅ Fallback: Оба готовы!');
                        clearInterval(readyCheckInterval);
                        this.hostReady = true;
                        this.guestReady = true;
                        this.checkIfBothReady();
                    }
                }
            } catch (error) {
                console.error('❌ Ошибка fallback проверки:', error);
                clearInterval(readyCheckInterval);
            }
        }, 1000);
        
        // Останавливаем fallback через 60 секунд
        setTimeout(() => {
            clearInterval(readyCheckInterval);
            console.log('⏹️ Остановка fallback проверки');
        }, 60000);
        
        console.log('✅ Результат показан');
    }

    nextQuestion() {
        console.log('⏭️ nextQuestion() вызвана');
        console.log(`   - isHost: ${this.isHost}`);
        console.log(`   - currentQuestion ПЕРЕД: ${window.gameState.currentQuestion}`);
        console.log(`   - maxQuestions: ${window.gameState.maxQuestions}`);
        
        // Увеличиваем счётчик вопроса
        window.gameState.currentQuestion++;
        const currentQuestionNum = window.gameState.currentQuestion;
        
        console.log(`📊 Переход на вопрос ${currentQuestionNum} из ${window.gameState.maxQuestions}`);

        // Проверяем, достигли ли мы лимита вопросов
        if (currentQuestionNum > window.gameState.maxQuestions) {
            console.log('✅ Достигнут лимит вопросов! Заканчиваем игру.');
            this.endGame();
            return;
        }

        // СРАЗУ обновляем заголовок с новым номером вопроса
        this.updateGameHeader();

        // Очищаем контейнер результатов
        const resultContainer = document.getElementById('result-stats');
        if (resultContainer) {
            resultContainer.classList.add('hidden');
            resultContainer.innerHTML = '';
        }
        
        document.querySelector('.music-controls').style.display = 'block';
        
        console.log(`⏭️ Вызываю loadQuestion() для вопроса ${currentQuestionNum}`);
        // Загружаем вопрос
        this.loadQuestion();
        console.log('⏭️ loadQuestion() завершена');
        
        // Сбрасываем флаги готовности для следующего раунда
        if (this.gameSessionId) {
            this.updateGameSession(this.gameSessionId, { 
                host_ready: false,
                guest_ready: false
            }).catch(error => {
                console.error('❌ Ошибка сброса флагов:', error);
            });
        }
    }

    markPlayerReady() {
        console.log('👉 Игрок нажал "Готов"');
        
        if (!this.gameSessionId) {
            console.error('❌ Session ID не найден');
            return;
        }

        const readyButton = document.querySelector('.ready-btn');
        if (readyButton) {
            readyButton.disabled = true;
            readyButton.style.opacity = '0.5';
            readyButton.style.cursor = 'not-allowed';
        }

        // Обновляем свой статус готовности
        const updateData = this.isHost 
            ? { host_ready: true }
            : { guest_ready: true };
        
        this.updateGameSession(this.gameSessionId, updateData)
            .then(() => {
                console.log('✅ Статус готовности обновлен');
            })
            .catch(error => {
                console.error('❌ Ошибка обновления статуса готовности:', error);
            });
    }

    checkIfBothReady() {
        console.log('🔍 Проверка готовности обоих игроков');
        console.log('   - this.hostReady:', this.hostReady);
        console.log('   - this.guestReady:', this.guestReady);
        console.log('   - window.gameState:', !!window.gameState);
        
        // Вызывается из слушателя когда получаем обновление от противника
        if (this.hostReady && this.guestReady) {
            console.log('✅ Оба игрока готовы! Обратный отчет 3, 2, 1');
            
            // КРИТИЧНО: Сбрасываем флаг загрузки вопросов для нового раунда
            console.log('🔄 СБРОС флага questionsLoadedFromDB для нового раунда');
            this.questionsLoadedFromDB = false;
            this.sharedQuestions = []; // Очищаем старые вопросы
            
            // Показываем сообщение об ожидании
            const waitMessage = document.querySelector('[data-waiting-message]');
            if (waitMessage) {
                console.log('✅ Обновляю сообщение ожидания');
                waitMessage.textContent = '✅ Все готовы!';
            } else {
                console.log('⚠️ Сообщение ожидания не найдено');
            }

            // Отключаем кнопку если она еще видна
            const readyButton = document.querySelector('.ready-btn');
            if (readyButton) {
                console.log('✅ Отключаю кнопку готовности');
                readyButton.disabled = true;
                readyButton.style.opacity = '0.5';
                readyButton.style.cursor = 'not-allowed';
            }

            // Большой обратный отчет для обоих игроков
            console.log('🎬 Показываю большой обратный отчет');
            
            // Создаём контейнер для отчета если его нет
            let countdownContainer = document.getElementById('countdown-container');
            if (!countdownContainer) {
                countdownContainer = document.createElement('div');
                countdownContainer.id = 'countdown-container';
                countdownContainer.style.cssText = `
                    position: fixed;
                    top: 50%;
                    left: 50%;
                    transform: translate(-50%, -50%);
                    font-size: 150px;
                    font-weight: bold;
                    color: #00ff7f;
                    text-shadow: 0 0 20px #00ff7f;
                    z-index: 10000;
                    animation: scaleIn 0.3s ease;
                `;
                document.body.appendChild(countdownContainer);
            }

            // Обратный отчет
            let countdown = 3;
            countdownContainer.textContent = countdown;
            
            const countdownInterval = setInterval(() => {
                countdown--;
                
                if (countdown >= 0) {
                    countdownContainer.textContent = countdown;
                }
                
                if (countdown < 0) {
                    clearInterval(countdownInterval);
                    if (countdownContainer.parentElement) {
                        countdownContainer.remove();
                    }
                    console.log('⏱️ Обратный отчет завершен');
                    
                    // ГЕНЕРИРУЕМ ВСЕ ВОПРОСЫ СРАЗУ (только хост)
                    if (this.isHost) {
                        console.log('🎲 ХОСТ: Генерирую ВСЕ вопросы сразу');
                        const success = this.generateAllQuestions();
                        if (success) {
                            console.log('💾 ХОСТ: Сохраняю все вопросы в БД');
                            const questionsJSON = JSON.stringify(this.sharedQuestions);
                            console.log(`   Размер данных: ${questionsJSON.length} символов`);
                            
                            this.updateGameSession(this.gameSessionId, { 
                                shared_questions: questionsJSON,
                                status: 'in_progress'
                            })
                            .then(() => {
                                console.log('✅ ХОСТ: Все вопросы сохранены в БД');
                                // ТОЛЬКО ПОТОМ вызываем startGame
                                this.startGame('easy');
                                this.nextQuestion();
                            })
                            .catch(error => {
                                console.error('❌ Ошибка сохранения вопросов:', error);
                                console.error('   Пытаюсь продолжить без сохранения');
                                this.startGame('easy');
                                this.nextQuestion();
                            });
                        } else {
                            console.error('❌ Ошибка генерации вопросов');
                            alert('Ошибка генерации вопросов!');
                            this.endGame();
                        }
                    } else {
                        // ГОСТЬ: Ждет когда хост сохранит вопросы в БД
                        console.log('👤 ГОСТЬ: Ожидаю вопросы от хоста');
                        
                        const loadQuestionsForGuest = (attempt = 1) => {
                            this.loadSharedQuestionsFromDB()
                                .then(() => {
                                    console.log('✅ ГОСТЬ: Вопросы загружены из БД (попытка', attempt + ')');
                                    // ГОСТЬ также вызывает startGame
                                    this.startGame('easy');
                                    this.nextQuestion();
                                })
                                .catch(error => {
                                    console.error('❌ ГОСТЬ: Ошибка загрузки вопросов (попытка', attempt + '):', error);
                                    if (attempt < 5) {
                                        // Повторяем попытку
                                        console.log('👂 ГОСТЬ: Повторяю попытку через 300мс...');
                                        setTimeout(() => loadQuestionsForGuest(attempt + 1), 300);
                                    } else {
                                        alert('Ошибка загрузки вопросов после 5 попыток!');
                                        this.endGame();
                                    }
                                });
                        };
                        
                        loadQuestionsForGuest();
                    }
                }
            }, 1000);
        } else {
            console.log('❌ Не оба готовы - это не должно было быть вызвано!');
        }
    }

    endGame() {
        console.log('🏁 Завершение игры');
        
        // Только хост может завершить игру
        if (!this.isHost) {
            console.log('⏳ Гость не может завершить игру, ждет хозяина...');
            return;
        }
        
        console.log('✅ ХОСТ: Завершаю игру для обоих игроков');
        
        clearInterval(window.gameState.timer);
        if (window.audioManager) {
            window.audioManager.stopMusic();
        }

        // Обновляем статус в БД - это скажет гостю завершить игру
        this.updateGameSession(this.gameSessionId, { status: 'completed' })
            .then(() => {
                console.log('✅ Статус обновлен в БД, гость получит сигнал');
                // Хост сразу показывает финальную статистику
                this.showFinalStats();
            })
            .catch(error => {
                console.error('❌ Ошибка завершения игры:', error);
            });
    }

    showFinalStats() {
        console.log('📈 Показ финальной статистики');
        
        // Получаем данные из БД для сравнения
        this.getGameSessionData(this.gameSessionId)
            .then(sessionData => {
                const hostScore = sessionData?.host_score || 0;
                const guestScore = sessionData?.guest_score || 0;
                
                const myScore = this.isHost ? hostScore : guestScore;
                const opponentScore = this.isHost ? guestScore : hostScore;
                
                const myAccuracy = window.gameState.currentQuestion > 0 ?
                    Math.round((window.gameState.correctAnswers / window.gameState.currentQuestion) * 100) : 0;
                
                // Определяем кто выиграл
                let result = 'Ничья!';
                let resultColor = '#a78bfa';
                
                if (myScore > opponentScore) {
                    result = '🎉 Вы выиграли!';
                    resultColor = '#22c55e';
                } else if (myScore < opponentScore) {
                    result = '😔 Противник выиграл';
                    resultColor = '#ff6b6b';
                }
                
                console.log(`📊 Статистика: Вы ${myScore}, Противник ${opponentScore}`);
                
                // Показываем экран статистики мультиплеера
                const statsScreen = document.createElement('div');
                statsScreen.id = 'multiplayer-final-stats';
                statsScreen.className = 'screen';
                statsScreen.style.cssText = 'display: flex; align-items: center; justify-content: center;';
                
                statsScreen.innerHTML = `
                    <div style="background: linear-gradient(135deg, #1a0b2e 0%, #2d1b3d 100%); border: 2px solid #7c3aed; border-radius: 15px; padding: 40px; max-width: 500px; width: 90%; box-shadow: 0 0 30px rgba(124, 58, 237, 0.5); text-align: center;">
                        <h2 style="color: ${resultColor}; margin: 20px 0; font-size: 28px;">${result}</h2>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin: 30px 0;">
                            <div style="background: rgba(124, 58, 237, 0.2); padding: 20px; border-radius: 10px; border: 1px solid #7c3aed;">
                                <div style="color: #a78bfa; font-size: 12px; margin-bottom: 10px;">ВЫ</div>
                                <div style="color: #22c55e; font-size: 32px; font-weight: bold;">${myScore}</div>
                                <div style="color: #a78bfa; font-size: 12px; margin-top: 10px;">Очков</div>
                            </div>
                            
                            <div style="background: rgba(124, 58, 237, 0.2); padding: 20px; border-radius: 10px; border: 1px solid #7c3aed;">
                                <div style="color: #a78bfa; font-size: 12px; margin-bottom: 10px;">ПРОТИВНИК</div>
                                <div style="color: #ff6b6b; font-size: 32px; font-weight: bold;">${opponentScore}</div>
                                <div style="color: #a78bfa; font-size: 12px; margin-top: 10px;">Очков</div>
                            </div>
                        </div>
                        
                        <div style="background: rgba(124, 58, 237, 0.1); padding: 15px; border-radius: 10px; margin: 20px 0;">
                            <p style="color: #a78bfa; margin: 5px 0;">Вопросов отвечено: <span style="color: #c4b5fd; font-weight: bold;">${window.gameState.currentQuestion}</span></p>
                            <p style="color: #a78bfa; margin: 5px 0;">Правильных ответов: <span style="color: #c4b5fd; font-weight: bold;">${window.gameState.correctAnswers}</span></p>
                            <p style="color: #a78bfa; margin: 5px 0;">Точность: <span style="color: #c4b5fd; font-weight: bold;">${myAccuracy}%</span></p>
                        </div>
                        
                        <button class="btn start-btn" onclick="returnToMenu()" style="margin-top: 30px; width: 100%; padding: 15px; font-size: 16px;">
                            ← Вернуться в меню
                        </button>
                    </div>
                `;
                
                document.body.appendChild(statsScreen);
                showScreen('multiplayer-final-stats');
            })
            .catch(error => {
                console.error('❌ Ошибка получения данных сессии:', error);
                // Если ошибка, показываем обычную статистику
                this.showDefaultFinalStats();
            });
    }
    
    showDefaultFinalStats() {
        console.log('📈 Показ обычной финальной статистики');
        
        const accuracy = window.gameState.currentQuestion > 0 ?
            Math.round((window.gameState.correctAnswers / window.gameState.currentQuestion) * 100) : 0;

        const finalScore = document.getElementById('final-score');
        const finalCorrect = document.getElementById('final-correct');
        const finalTotal = document.getElementById('final-total');
        const finalAccuracy = document.getElementById('final-accuracy');
        const finalMode = document.getElementById('final-mode');

        if (finalScore) finalScore.textContent = window.gameState.score;
        if (finalCorrect) finalCorrect.textContent = window.gameState.correctAnswers;
        if (finalTotal) finalTotal.textContent = window.gameState.currentQuestion;
        if (finalAccuracy) finalAccuracy.textContent = accuracy + '%';
        if (finalMode) finalMode.textContent = this.displayName;
        
        // Показываем экран финальной статистики
        console.log('🎬 Показываю final-stats-screen');
        showScreen('final-stats-screen');
        
        // Вызываем проверку достижений если функция есть
        if (window.checkAchievements) {
            setTimeout(() => {
                window.checkAchievements();
            }, 100);
        }
    }

    getTimeByDifficulty(difficulty) {
        switch(difficulty) {
            case 'easy': return 30;
            case 'medium': return 20;
            case 'hard': return 15;
            default: return 30;
        }
    }

    getBasePointsByDifficulty(difficulty) {
        switch(difficulty) {
            case 'easy': return 10;
            case 'medium': return 15;
            case 'hard': return 20;
            default: return 10;
        }
    }
}

window.MultiplayerMode = MultiplayerMode;

// Глобальная функция для запуска игры хостом
function startMultiplayerNormalGameNow() {
    console.log('🎮 Запуск мультиплеера (ОБЫЧНЫЙ режим) хостом');
    if (window.currentGameMode && typeof window.currentGameMode.startGame === 'function') {
        // Закрываем экран готовности
        const readyScreen = document.getElementById('multiplayer-ready-to-start-screen');
        if (readyScreen) readyScreen.remove();
        
        // Генерируем все вопросы ДО запуска игры
        console.log('🎲 Генерирую ВСЕ вопросы сразу (ПЕРЕД startGame)');
        const success = window.currentGameMode.generateAllQuestions();
        if (!success) {
            console.error('❌ Ошибка генерации вопросов');
            alert('Ошибка генерации вопросов!');
            return;
        }
        
        console.log('✅ Вопросы сгенерированы на ХОСТЕ:');
        console.log('   - Всего вопросов:', window.currentGameMode.sharedQuestions.length);
        if (window.currentGameMode.sharedQuestions.length > 0) {
            console.log('   - Первый вопрос:', window.currentGameMode.sharedQuestions[0]);
            console.log('   - Второй вопрос:', window.currentGameMode.sharedQuestions[1]);
        }
        
        console.log('💾 Сохраняю все вопросы в БД');
        const questionsJSON = JSON.stringify(window.currentGameMode.sharedQuestions);
        console.log(`   Размер данных: ${questionsJSON.length} символов`);
        
        // Обновляем статус сессии на in_progress
        if (window.currentGameMode.gameSessionId) {
            window.currentGameMode.updateGameSession(window.currentGameMode.gameSessionId, { 
                shared_questions: questionsJSON,
                status: 'in_progress'
            })
                .then(() => {
                    console.log('✅ Статус обновлен на in_progress, вопросы сохранены');
                    console.log('⏳ ХОСТ: Жду 500мс чтобы гость загрузил вопросы...');
                    window.currentGameMode.gameStarted = true; // Устанавливаем флаг
                    window.currentGameMode.startGame('easy');
                    
                    // Даем гостю 500мс чтобы загрузить вопросы из БД
                    setTimeout(() => {
                        console.log('🎬 ХОСТ: Запускаю первый вопрос (задержка 500мс)');
                        window.currentGameMode.nextQuestion();
                    }, 500);
                })
                .catch(error => {
                    console.error('❌ Ошибка обновления статуса:', error);
                    window.currentGameMode.gameStarted = true;
                    window.currentGameMode.startGame('easy');
                    setTimeout(() => {
                        window.currentGameMode.nextQuestion();
                    }, 500);
                });
        } else {
            window.currentGameMode.gameStarted = true;
            window.currentGameMode.startGame('easy');
            window.currentGameMode.nextQuestion();
        }
    }
}

// Функция для возврата в главное меню
function returnToMenu() {
    console.log('🏠 Возврат в главное меню');
    
    // Удаляем экран статистики мультиплеера если он есть
    const statsScreen = document.getElementById('multiplayer-final-stats');
    if (statsScreen) {
        statsScreen.remove();
    }
    
    // Переходим в главное меню
    showScreen('main-screen');
}

console.log('✅ MultiplayerNormalMode.js loaded (обычный режим с одинаковыми вопросами)');

// Глобальная функция для кнопки "Готов"
if (!window.markPlayerReady) {
    window.markPlayerReady = function() {
        console.log('🔵 markPlayerReady вызвана из multiplayerNormalMode');
        if (window.currentGameMode && typeof window.currentGameMode.markPlayerReady === 'function') {
            window.currentGameMode.markPlayerReady();
        } else {
            console.error('❌ window.currentGameMode или markPlayerReady не доступны');
        }
    };
}
