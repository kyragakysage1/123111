class MultiplayerMode {
    constructor() {
        this.name = 'multiplayer';
        this.displayName = '👥 Мультиплеер';
        this.isHost = false;
        this.maxQuestions = 10;
        this.hostReady = false;
        this.guestReady = false;
        this.gameEnded = false; // Флаг чтобы не вызывать завершение дважды
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
        console.log('🚀 Запуск как гость:', inviteData);
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
                    
                    // Если гость присоединился, показываем хосту экран готовности
                    if (newStatus === 'guest_joined' && self.isHost) {
                        self.showReadyToStartScreen();
                    }
                    
                    // Если игра началась
                    if (newStatus === 'in_progress') {
                        if (!window.gameState || window.gameState.gameMode !== 'multiplayer') {
                            self.startGame('easy');
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
        console.log('👂 Настройка слушателя старта игры');
        
        const client = window.authManager?.supabase;
        if (!client) return;

        const channel = client
            .channel(`game-start:${sessionId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'multiplayer_sessions',
                    filter: `id=eq.${sessionId}`
                },
                payload => {
                    if (payload.new.status === 'in_progress') {
                        console.log('🎮 Начало игры');
                        this.startGame('easy');
                    }
                }
            )
            .subscribe();

        console.log('✅ Слушатель старта настроен');
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
                    console.log('✅ Игра началась (fallback)');
                    clearInterval(interval);
                    this.startGame('easy');
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
        console.log('🎯 Показ экрана готовности к старту для хоста');
        
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
                        
                        <div style="display: flex; gap: 20px; justify-content: center; margin-top: 30px; flex-wrap: wrap;">
                            <button class="btn start-btn" onclick="startMultiplayerGameNow()" 
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
        this.loadQuestion();
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
                        ${this.isHost ? '<button class="btn secondary-btn" onclick="endGame()">Завершить игру</button>' : ''}
                        ${this.isHost ? '<button class="btn secondary-btn" onclick="showScreen(\'game-modes-screen\')" style="margin-top: 10px;">Отмена</button>' : ''}
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
        console.log('📝 Загрузка вопроса для мультиплеера');
        
        if (!window.gameState) {
            console.error('❌ gameState не определен');
            return;
        }

        window.gameState.currentQuestion++;
        window.gameState.musicStarted = false;
        this.updateGameHeader();

        if (!window.animeDatabase || window.animeDatabase.length === 0) {
            console.error('❌ База аниме пуста');
            alert('База аниме не загружена! Попробуйте обновить библиотеку.');
            this.endGame();
            return;
        }

        if (window.gameState.usedAnimeIds.length >= window.animeDatabase.length) {
            console.log('🔄 Все аниме использованы, сбрасываем список');
            window.gameState.usedAnimeIds = [];
        }

        const correctAnime = window.getRandomAnime ? window.getRandomAnime(1, window.gameState.usedAnimeIds) : null;
        if (!correctAnime) {
            console.error('❌ Не удалось получить правильное аниме');
            alert('Ошибка загрузки аниме!');
            this.endGame();
            return;
        }

        console.log('🎯 Правильное аниме:', correctAnime.title);

        window.gameState.usedAnimeIds.push(correctAnime.id);

        const wrongAnime = window.getRandomAnime ? window.getRandomAnime(3, [...window.gameState.usedAnimeIds, correctAnime.id]) : [];
        console.log('❌ Неправильные варианты:', wrongAnime.map(a => a.title));

        const allAnswers = [correctAnime, ...wrongAnime];
        if (window.shuffleArray) window.shuffleArray(allAnswers);

        this.updateAnswersUI(allAnswers, correctAnime);
        
        window.gameState.currentMusic = correctAnime.music;
        window.gameState.currentCorrectAnime = correctAnime;

        document.getElementById('answers-container').style.opacity = '0';
        document.getElementById('answers-container').style.display = 'none';
        document.getElementById('result-stats').classList.add('hidden');
        document.getElementById('result-stats').innerHTML = '';
        
        document.querySelector('.music-controls').style.display = 'block';

        this.animateQuestionTransition();
        console.log('✅ Вопрос загружен, ожидание старта музыки');
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
        const scoreElement = document.getElementById('score');
        
        if (timerElement) timerElement.textContent = window.gameState.timeLeft;
        if (questionElement) questionElement.textContent = window.gameState.currentQuestion;
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
        
        if (!window.gameState || !window.gameState.currentMusic) {
            console.error('❌ Музыка не загружена');
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
                    <button class="btn ready-btn" onclick="markPlayerReady()" style="margin: 10px 0;">✓ Готов</button>
                    ${this.isHost ? '<button class="btn secondary-btn" onclick="endGame()">Завершить игру</button>' : ''}
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
        console.log('⏭️ Переход к следующему вопросу');
        console.log(`📊 Текущий вопрос: ${window.gameState.currentQuestion}, Максимум: ${window.gameState.maxQuestions}`);

        // Проверяем, достигли ли мы лимита вопросов
        if (window.gameState.currentQuestion >= window.gameState.maxQuestions) {
            console.log('✅ Достигнут лимит вопросов! Заканчиваем игру.');
            this.endGame();
            return;
        }

        const resultContainer = document.getElementById('result-stats');
        if (resultContainer) {
            resultContainer.classList.add('hidden');
            resultContainer.innerHTML = '';
        }
        
        document.querySelector('.music-controls').style.display = 'block';
        
        // Загружаем вопрос
        this.loadQuestion();
        
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
                    console.log('⏱️ Обратный отчет завершен, вызываю nextQuestion()');
                    this.nextQuestion();
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
function startMultiplayerGameNow() {
    console.log('🎮 Запуск мультиплеера хостом');
    if (window.currentGameMode && typeof window.currentGameMode.startGame === 'function') {
        // Закрываем экран готовности
        const readyScreen = document.getElementById('multiplayer-ready-to-start-screen');
        if (readyScreen) readyScreen.remove();
        
        // Обновляем статус сессии на in_progress
        if (window.currentGameMode.gameSessionId) {
            window.currentGameMode.updateGameSession(window.currentGameMode.gameSessionId, { status: 'in_progress' })
                .then(() => {
                    console.log('✅ Статус обновлен на in_progress');
                    window.currentGameMode.startGame('easy');
                })
                .catch(error => {
                    console.error('❌ Ошибка обновления статуса:', error);
                    window.currentGameMode.startGame('easy');
                });
        } else {
            window.currentGameMode.startGame('easy');
        }
    }
}
