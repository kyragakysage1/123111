class InfiniteMode {
    constructor() {
        this.name = 'infinite';
        this.displayName = '♾️ Бесконечный';
    }

    startGame(difficulty = 'easy') {
        console.log('🚀 Запуск бесконечного режима, сложность:', difficulty);
        
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
            musicStarted: false
        };

        if (window.playerStats) {
            window.playerStats.gamesPlayed++;
            if (window.saveStats) window.saveStats();
        }

        this.showGameScreen();
        this.loadQuestion();
    }

    showGameScreen() {
        console.log('🎮 Показ игрового экрана бесконечного режима');
        
        const existingGameScreen = document.getElementById('game-screen');
        if (existingGameScreen) {
            existingGameScreen.remove();
        }

        // Получаем текущую громкость
        const currentVolume = window.audioManager ? window.audioManager.getCurrentVolume() : 50;

        const gameScreenHtml = `
            <div id="game-screen" class="screen">
                <div class="container">
                    <div class="game-header question-transition">
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
                            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                                <span id="timer">${window.gameState.timeLeft}</span>
                                <span>Вопрос <span id="question-number">1</span></span>
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
                        <button class="btn secondary-btn" onclick="endGame()">Завершить игру</button>
                        <button class="btn secondary-btn" onclick="showScreen('game-modes-screen')" style="margin-top: 10px;">Отмена</button>
                    </div>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', gameScreenHtml);
        showScreen('game-screen');
        
        // Настраиваем обработчик изменения громкости
        this.setupVolumeControl(currentVolume);
        console.log('✅ Игровой экран показан');
    }

    setupVolumeControl(initialVolume) {
        console.log('🔊 Настройка регулятора громкости, начальное значение:', initialVolume);
        
        const volumeSlider = document.getElementById('game-volume');
        const volumeValue = document.getElementById('game-volume-value');
        const volumeTrackFill = document.getElementById('volume-track-fill');
        
        // Устанавливаем начальное значение заполнения
        this.updateVolumeTrack(initialVolume);
        this.updateVolumeIcon(initialVolume);
        
        if (volumeSlider && volumeValue && volumeTrackFill) {
            // Обновляем отображение при изменении
            volumeSlider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value);
                volumeValue.textContent = value + '%';
                this.updateVolumeTrack(value);
                this.updateVolumeIcon(value);
                
                // Анимация пульсации
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
            // Чем выше громкость, тем больше заполнение слева направо (0-100% ширины)
            const fillWidth = volume; // 0-100
            volumeTrackFill.style.width = `${fillWidth}%`;
        }
    }

    updateVolumeIcon(volume) {
        const volumeIcon = document.getElementById('volume-icon');
        if (volumeIcon) {
            // Удаляем все классы
            volumeIcon.className = 'volume-icon';
            
            // Устанавливаем соответствующий эмодзи и класс
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
        console.log('📝 Загрузка вопроса для бесконечного режима');
        
        if (!window.gameState) {
            console.error('❌ gameState не определен');
            return;
        }

        window.gameState.currentQuestion++;
        window.gameState.musicStarted = false;
        this.updateGameHeader();

        // Проверяем базу данных
        if (!window.animeDatabase || window.animeDatabase.length === 0) {
            console.error('❌ База аниме пуста');
            alert('База аниме не загружена! Попробуйте обновить библиотеку.');
            this.endGame();
            return;
        }

        // Сбрасываем использованные ID если все аниме использованы
        if (window.gameState.usedAnimeIds.length >= window.animeDatabase.length) {
            console.log('🔄 Все аниме использованы, сбрасываем список');
            window.gameState.usedAnimeIds = [];
        }

        // Получаем правильное аниме
        const correctAnime = window.getRandomAnime ? window.getRandomAnime(1, window.gameState.usedAnimeIds) : null;
        if (!correctAnime) {
            console.error('❌ Не удалось получить правильное аниме');
            alert('Ошибка загрузки аниме!');
            this.endGame();
            return;
        }

        console.log('🎯 Правильное аниме:', correctAnime.title);

        // Добавляем ID в использованные
        window.gameState.usedAnimeIds.push(correctAnime.id);

        // Получаем неправильные варианты
        const wrongAnime = window.getRandomAnime ? window.getRandomAnime(3, [...window.gameState.usedAnimeIds, correctAnime.id]) : [];
        console.log('❌ Неправильные варианты:', wrongAnime.map(a => a.title));

        // Собираем все варианты и перемешиваем
        const allAnswers = [correctAnime, ...wrongAnime];
        if (window.shuffleArray) window.shuffleArray(allAnswers);

        // Обновляем UI вариантов ответа
        this.updateAnswersUI(allAnswers, correctAnime);
        
        // Сохраняем данные для текущего вопроса
        window.gameState.currentMusic = correctAnime.music;
        window.gameState.currentCorrectAnime = correctAnime;

        // Сбрасываем UI
        document.getElementById('answers-container').style.opacity = '0';
        document.getElementById('answers-container').style.display = 'none';
        document.getElementById('result-stats').classList.add('hidden');
        document.getElementById('result-stats').innerHTML = '';
        
        // Показываем кнопку старта музыки
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
            
            // Используем стрелочную функцию для сохранения контекста
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

        // Показываем варианты ответов с анимацией
        const answersContainer = document.getElementById('answers-container');
        if (answersContainer) {
            answersContainer.style.display = 'block';
            setTimeout(() => {
                answersContainer.style.opacity = '1';
            }, 100);
        }

        // Скрываем кнопку старта музыки
        document.querySelector('.music-controls').style.display = 'none';

        // Запускаем музыку
        if (window.audioManager) {
            window.audioManager.playMusic(window.gameState.currentMusic)
                .then(() => {
                    console.log('✅ Музыка начала воспроизводиться');
                })
                .catch(error => {
                    console.error('❌ Ошибка воспроизведения музыки:', error);
                    // Все равно показываем варианты ответов
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
        
        // Скрываем кнопку "Отмена" после первого ответа
        if (!window.gameState.firstAnswerGiven) {
            window.gameState.firstAnswerGiven = true;
            const cancelButton = document.querySelector('.game-buttons .btn:nth-child(2)');
            if (cancelButton) {
                cancelButton.style.display = 'none';
            }
        }
        
        // Останавливаем таймер и музыку
        clearInterval(window.gameState.timer);
        if (window.audioManager) {
            window.audioManager.stopMusic();
        }

        const allButtons = document.querySelectorAll('.answer-btn');
        
        // Блокируем все кнопки
        allButtons.forEach(button => {
            button.style.pointerEvents = 'none';
            if (button !== clickedButton) {
                button.classList.add('center-hide');
            }
        });

        // Анимация ответа
        setTimeout(() => {
            if (isCorrect) {
                clickedButton.classList.remove('center-reveal');
                clickedButton.classList.add('correct-answer-reveal');
            } else {
                clickedButton.classList.remove('center-reveal');
                clickedButton.classList.add('incorrect-answer-reveal');
                
                // Показываем правильный ответ
                allButtons.forEach(button => {
                    if (button.textContent === correctAnime.title) {
                        button.classList.remove('center-hide', 'center-reveal');
                        button.classList.add('correct-answer-reveal');
                        button.style.display = 'block';
                    }
                });
            }

            // Показываем результат
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
                    
                    // Анимация обновления счёта
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

        // Обновляем статистику
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
                    <button class="btn next-btn" onclick="nextQuestion()">Следующий вопрос</button>
                    <button class="btn secondary-btn" onclick="endGame()" style="margin-top: 10px;">Завершить игру</button>
                </div>
            </div>
        `;

        // Скрываем варианты ответов
        const answersContainer = document.getElementById('answers-container');
        if (answersContainer) {
            answersContainer.style.display = 'none';
        }
        
        // Показываем результат
        resultContainer.classList.remove('hidden');
        console.log('✅ Результат показан');
    }

    nextQuestion() {
        console.log('⏭️ Переход к следующему вопросу');
        
        // Скрываем результат
        const resultContainer = document.getElementById('result-stats');
        if (resultContainer) {
            resultContainer.classList.add('hidden');
            resultContainer.innerHTML = '';
        }
        
        // Показываем кнопку старта музыки
        document.querySelector('.music-controls').style.display = 'block';

        // Загружаем следующий вопрос
        this.loadQuestion();
    }

    endGame() {
        console.log('🏁 Завершение игры');
        
        clearInterval(window.gameState.timer);
        if (window.audioManager) {
            window.audioManager.stopMusic();
        }

        this.showFinalStats();
        if (window.checkAchievements) window.checkAchievements();
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

window.InfiniteMode = InfiniteMode;