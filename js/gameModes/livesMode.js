class LivesMode {
    constructor() {
        this.name = 'lives';
        this.displayName = '❤️ С жизнями';
    }

    startGame(difficulty = 'easy') {
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
            lives: this.getLivesByDifficulty(difficulty),
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
                        <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; flex-wrap: wrap;">
                            <div style="display: flex; gap: 15px; align-items: center; flex-wrap: wrap;">
                                <span id="timer">${window.gameState.timeLeft}</span>
                                <span>Вопрос <span id="question-number">1</span></span>
                                <span>Жизни: <span id="lives">${window.gameState.lives}</span></span>
                                <span>Счёт: <span id="score">0</span></span>
                            </div>
                            
                            <!-- ГОРИЗОНТАЛЬНЫЙ РЕГУЛЯТОР ГРОМКОСТИ -->
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
                        <span id="game-mode">${this.displayName} (${window.gameState.difficulty})</span>
                    </div>

                    <div class="music-controls question-transition" style="text-align: center; margin: 50px 0;">
                        <button class="btn start-btn" onclick="startMusicForQuestion()" 
                                style="font-size: 20px; padding: 25px 40px; margin: 20px auto;">
                            🎵 Начать прослушивание
                        </button>
                        <p style="color: #c4b5fd; margin-top: 15px;">Нажмите кнопку чтобы начать слушать опенинг</p>
                    </div>

                    <div id="answers-container" style="opacity: 0; transition: opacity 0.5s ease; display: none;">
                        <div class="answers-grid" id="answers"></div>
                    </div>

                    <div class="result-stats hidden" id="result-stats">
                        <!-- Контент будет добавляться динамически после ответа -->
                    </div>

                    <div class="game-buttons">
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
        if (!window.gameState) return;

        window.gameState.currentQuestion++;
        window.gameState.musicStarted = false;
        this.updateGameHeader();

        if (window.gameState.usedAnimeIds.length >= window.animeDatabase.length) {
            window.gameState.usedAnimeIds = [];
        }

        const correctAnime = window.getRandomAnime ? window.getRandomAnime(1, window.gameState.usedAnimeIds) : null;
        if (!correctAnime) {
            alert('Ошибка загрузки аниме!');
            this.endGame();
            return;
        }

        window.gameState.usedAnimeIds.push(correctAnime.id);
        const wrongAnime = window.getRandomAnime ? window.getRandomAnime(3, [...window.gameState.usedAnimeIds, correctAnime.id]) : [];
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
        console.log('✅ Вопрос загружен, ждем старта музыки');
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
        document.getElementById('timer').textContent = window.gameState.timeLeft;
        document.getElementById('question-number').textContent = window.gameState.currentQuestion;
        document.getElementById('lives').textContent = window.gameState.lives;
        document.getElementById('score').textContent = window.gameState.score;

        const timerElement = document.getElementById('timer');
        if (window.gameState.timeLeft <= 5) {
            timerElement.classList.add('warning');
        } else {
            timerElement.classList.remove('warning');
        }
    }

    updateAnswersUI(answers, correctAnime) {
        const answersContainer = document.getElementById('answers');
        answersContainer.innerHTML = '';

        answers.forEach((anime, index) => {
            const button = document.createElement('button');
            button.className = 'answer-btn center-reveal';
            button.textContent = anime.title;
            button.style.animationDelay = `${index * 0.1}s`;
            button.onclick = () => this.checkAnswer(anime.id === correctAnime.id, correctAnime, button);
            answersContainer.appendChild(button);
        });
    }

    startMusicForQuestion() {
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

        document.getElementById('answers-container').style.display = 'block';
        setTimeout(() => {
            document.getElementById('answers-container').style.opacity = '1';
        }, 100);

        document.querySelector('.music-controls').style.display = 'none';

        if (window.audioManager) {
            window.audioManager.playMusic(window.gameState.currentMusic)
                .then(() => {
                    console.log('✅ Музыка начала воспроизводиться');
                })
                .catch(error => {
                    console.error('❌ Ошибка воспроизведения музыки:', error);
                    document.getElementById('answers-container').style.display = 'block';
                    document.getElementById('answers-container').style.opacity = '1';
                    document.querySelector('.music-controls').style.display = 'none';
                });
        }

        this.startTimer();
    }

    startTimer() {
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
                clearInterval(window.gameState.timer);
                this.handleTimeOut();
            }
        }, 1000);
    }

    handleTimeOut() {
        window.gameState.lives--;
        this.updateGameHeader();

        if (window.audioManager) {
            window.audioManager.stopMusic();
        }

        if (window.gameState.lives <= 0) {
            this.showResult(false, window.gameState.currentCorrectAnime, 0, this.getTimeByDifficulty(window.gameState.difficulty));
        } else {
            this.showResult(false, window.gameState.currentCorrectAnime, 0, this.getTimeByDifficulty(window.gameState.difficulty));
        }
    }

    checkAnswer(isCorrect, correctAnime, clickedButton) {
        // Скрываем кнопку "Отмена" после первого ответа
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

                window.gameState.lives--;
                this.updateGameHeader();
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
                    
                    const scoreElement = document.getElementById('score');
                    scoreElement.classList.add('score-update');
                    setTimeout(() => {
                        scoreElement.classList.remove('score-update');
                    }, 600);

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
        const resultContainer = document.getElementById('result-stats');
        
        let description = correctAnime.description || 'Описание отсутствует';
        if (description.length > 100) {
            description = description.substring(0, 100) + '...';
        }
        
        const isGameOver = window.gameState.lives <= 0;
        const buttonText = isGameOver ? 'Завершить игру' : 'Следующий вопрос';
        const buttonHandler = isGameOver ? 'endGame()' : 'nextQuestion()';
        
        resultContainer.innerHTML = `
            <div class="result-content">
                <h2 id="result-title" style="color: ${isCorrect ? '#00ff7f' : '#ff4757'}">
                    ${isCorrect ? '✅ Правильно!' : '❌ Неправильно!'}
                </h2>
                
                <div style="display: block; text-align: center; margin: 10px 0;">
                    <img class="poster" src="${correctAnime.image}" alt="Постер аниме" 
                         onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjIwIiBoZWlnaHQ9IjMxMSIgdmlld0JveD0iMCAwIDIyMCAzMTEiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMjAiIGhlaWdodD0iMzExIiBmaWxsPSIjMzc0MTUxIi8+Cjx0ZXh0IHg9IjExMCIgeT0iMTU1LjUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNiIgZmlsbD0iI0M0QjVGRCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+Tm8gSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=';">
                </div>
                
                <h3 id="correct-answer">${correctAnime.title}</h3>
                <p id="result-description">${description}</p>

                <div class="result-details">
                    <p>Время: <span id="time-taken">${timeTaken}</span> сек</p>
                    <p>Очки: +<span id="points-earned">${pointsEarned}</span></p>
                    <p>Жизни: <span id="remaining-lives">${window.gameState.lives}</span></p>
                    <p>Счёт: <span id="current-score">${window.gameState.score}</span></p>
                </div>

                <div class="result-buttons">
                    <button class="btn ${isGameOver ? 'secondary-btn' : 'next-btn'}" onclick="${buttonHandler}">
                        ${buttonText}
                    </button>
                </div>
            </div>
        `;

        document.getElementById('answers-container').style.display = 'none';
        resultContainer.classList.remove('hidden');
        
        if (isGameOver) {
            clearInterval(window.gameState.timer);
            if (window.audioManager) {
                window.audioManager.stopMusic();
            }
        }
    }

    nextQuestion() {
        if (window.gameState.lives <= 0) {
            this.endGame();
            return;
        }

        const resultContainer = document.getElementById('result-stats');
        resultContainer.classList.add('hidden');
        resultContainer.innerHTML = '';
        
        const answersContainer = document.getElementById('answers-container');
        answersContainer.style.opacity = '0';
        answersContainer.style.display = 'none';
        
        document.querySelector('.music-controls').style.display = 'block';

        this.loadQuestion();
    }

    endGame() {
        clearInterval(window.gameState.timer);
        if (window.audioManager) {
            window.audioManager.stopMusic();
        }

        this.showFinalStats();
        if (window.checkAchievements) window.checkAchievements();
    }

    showFinalStats() {
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
        if (finalMode) finalMode.textContent = `${this.displayName} (${window.gameState.difficulty})`;
    }

    getLivesByDifficulty(difficulty) {
        switch(difficulty) {
            case 'easy': return 5;
            case 'medium': return 3;
            case 'hard': return 1;
            default: return 3;
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

window.LivesMode = LivesMode;