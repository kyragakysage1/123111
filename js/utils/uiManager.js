
class UIManager {
    updateGameHeader() {
        if (!window.gameState) return;
        
        const timerElement = document.getElementById('timer');
        const questionElement = document.getElementById('question-number');
        const scoreElement = document.getElementById('score');
        
        if (timerElement) {
            if (window.gameState.gameMode === 'timed') {
                const minutes = Math.floor(window.gameState.timeLeft / 60);
                const seconds = window.gameState.timeLeft % 60;
                timerElement.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
            } else {
                timerElement.textContent = window.gameState.timeLeft;
            }
        }
        
        if (questionElement) {
            questionElement.textContent = window.gameState.currentQuestion;
        }
        
        if (scoreElement) {
            scoreElement.textContent = window.gameState.score;
        }
    }

    updateGameInfo() {
        if (!window.gameState) return;
        
        const modeElement = document.getElementById('game-mode');
        const livesElement = document.getElementById('lives');
        
        if (modeElement) {
            const modeNames = {
                'infinite': '♾️ Бесконечный',
                'lives': '❤️ С жизнями', 
                'timed': '⏱️ На время',
                'marathon': '🏃‍♂️ Марафон'
            };
            modeElement.textContent = modeNames[window.gameState.gameMode] || window.gameState.gameMode;
        }
        
        if (livesElement) {
            if (window.gameState.lives > 0) {
                livesElement.style.display = 'block';
                livesElement.innerHTML = `❤️ ${window.gameState.lives}`;
            } else {
                livesElement.style.display = 'none';
            }
        }
    }

    updateAnswersUI(answers, correctAnime) {
        const answersContainer = document.getElementById('answers');
        if (!answersContainer) return;
        
        answersContainer.innerHTML = '';
        
        // Сохраняем ссылку на текущий режим игры для использования в обработчиках
        const currentMode = window.currentGameMode;
        const correctAnimeId = correctAnime.id;
        
        answers.forEach(anime => {
            const button = document.createElement('button');
            button.className = 'answer-btn';
            button.textContent = anime.title;
            
            // Используем замыкание для передачи правильных параметров
            button.onclick = function() {
                const isCorrect = anime.id === correctAnimeId;
                console.log('Answer clicked:', anime.title, 'Correct:', isCorrect);
                if (currentMode && currentMode.checkAnswer) {
                    currentMode.checkAnswer(isCorrect, correctAnime);
                } else {
                    console.error('Game mode not found or checkAnswer method missing');
                }
            };
            
            answersContainer.appendChild(button);
        });
    }

    showResult(isCorrect, correctAnime, pointsEarned, timeTaken) {
        // Останавливаем таймер и музыку
        if (window.forceStopTimer) window.forceStopTimer();
        if (window.audioManager) window.audioManager.stopMusic();
        
        const resultTitle = document.getElementById('result-title');
        const correctAnswer = document.getElementById('correct-answer');
        const resultDescription = document.getElementById('result-description');
        const resultImage = document.getElementById('result-image');
        const timeTakenElement = document.getElementById('time-taken');
        const xpEarnedElement = document.getElementById('xp-earned');
        const currentScoreElement = document.getElementById('current-score');
        const livesInfo = document.getElementById('result-lives');
        
        if (resultTitle) {
            resultTitle.textContent = isCorrect ? '✅ Правильно!' : '❌ Неправильно';
            resultTitle.style.color = isCorrect ? '#00ff7f' : '#ff4757';
        }
        
        if (correctAnswer) {
            correctAnswer.textContent = correctAnime.title;
        }
        
        if (resultDescription) {
            resultDescription.textContent = correctAnime.description || 'Описание отсутствует';
        }
        
        if (resultImage) {
            resultImage.src = correctAnime.image;
            resultImage.onerror = function() {
                this.onerror = null;
                this.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjI4MCIgdmlld0JveD0iMCAwIDIwMCAyODAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIyMDAiIGhlaWdodD0iMjgwIiBmaWxsPSIjMUEwQjJFIi8+Cjx0ZXh0IHg9IjEwMCIgeT0iMTQwIiBmb250LWZhbWlseT0iQXJpYWwsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZpbGw9IiNDNEI1RkQiIHRleHQtYW5jaG9yPSJtaWRkbGUiIGRvbWluYW50LWJhc2VsaW5lPSJtaWRkbGUiPk5vIEltYWdlPC90ZXh0Pgo8L3N2Zz4K';
            };
        }
        
        if (timeTakenElement) {
            timeTakenElement.textContent = timeTaken;
        }
        
        if (xpEarnedElement) {
            xpEarnedElement.textContent = pointsEarned;
        }
        
        if (currentScoreElement) {
            currentScoreElement.textContent = window.gameState ? window.gameState.score : 0;
        }
        
        if (livesInfo) {
            if (window.gameState && window.gameState.gameMode === 'lives' && window.gameState.lives > 0) {
                livesInfo.style.display = 'block';
                livesInfo.innerHTML = `Осталось жизней: ${'❤️'.repeat(window.gameState.lives)} ${window.gameState.lives}`;
            } else {
                livesInfo.style.display = 'none';
            }
        }
        
        if (window.showScreen) {
            window.showScreen('result-screen');
        }
    }

    updateMainScreenStats() {
        const levelElement = document.getElementById('level');
        const xpElement = document.getElementById('xp');
        const totalGamesElement = document.getElementById('total-games');
        
        if (levelElement && window.playerStats) {
            levelElement.textContent = window.playerStats.level || 1;
        }
        
        if (xpElement && window.playerStats) {
            const level = window.playerStats.level || 1;
            const xp = window.playerStats.xp || 0;
            xpElement.textContent = `${xp}/${level * 100}`;
        }
        
        if (totalGamesElement && window.playerStats) {
            totalGamesElement.textContent = window.playerStats.gamesPlayed || 0;
        }
    }

    // Новый метод для показа ошибок загрузки
    showDatabaseError() {
        const errorHtml = `
            <div style="
                background: rgba(239, 68, 68, 0.1);
                border: 1px solid #ef4444;
                border-radius: 12px;
                padding: 20px;
                margin: 20px 0;
                text-align: center;
                color: #fecaca;
            ">
                <h3 style="color: #f87171; margin-bottom: 10px;">❌ Ошибка загрузки</h3>
                <p>Не удалось загрузить базу аниме. Проверьте подключение к интернету.</p>
                <button onclick="reloadDatabase()" class="btn" style="margin-top: 10px;">
                    🔄 Повторить попытку
                </button>
            </div>
        `;
        
        const mainScreen = document.getElementById('main-screen');
        if (mainScreen) {
            const existingError = mainScreen.querySelector('.database-error');
            if (existingError) existingError.remove();
            
            const errorDiv = document.createElement('div');
            errorDiv.className = 'database-error';
            errorDiv.innerHTML = errorHtml;
            mainScreen.querySelector('.container').appendChild(errorDiv);
        }
    }

    // Метод для обновления статуса подключения
    updateConnectionStatus(isConnected, message) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.style.color = isConnected ? '#00ff7f' : '#fbbf24';
        }
    }
}

// Создаем глобальный экземпляр
window.uiManager = new UIManager();
