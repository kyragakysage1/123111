console.log('🚀 Script.js loading...');

// Глобальные переменные
let currentScreen = 'main-screen';
let gameState = null;
let playerStats = {
    level: 1,
    xp: 0,
    gamesPlayed: 0,
    correctAnswers: 0,
    totalAnswers: 0,
    achievements: []
};

let settings = {
    musicVolume: 50,
    difficulty: 'easy',
    autoplay: true
};

let currentGameMode = null;
let gameTimer = null;
let databaseLoaded = false;

// Переменные для отслеживания достижений
let currentStreak = 0; // Текущая серия правильных ответов
let uniqueAnimeCount = 0; // Количество уникальных аниме, которые были пройдены
let seenAnimeIds = new Set(); // Набор ID аниме, которые видел игрок

// Инициализация приложения
document.addEventListener('deviceready', initializeApp, false);
if (!window.cordova) {
    document.addEventListener('DOMContentLoaded', initializeApp);
}

async function initializeApp() {
    console.log('🚀 Инициализация приложения...');
    console.log('🔐 authManager available:', typeof window.authManager !== 'undefined');
    console.log('📀 animeDatabase available:', typeof window.animeDatabase !== 'undefined');
    console.log('🎵 audioManager available:', typeof window.audioManager !== 'undefined');

    try {
        // Сначала инициализируем менеджер авторизации
        if (window.authManager) {
            window.authManager.init();
        }

        // Инициализируем экран профиля
        if (window.profileScreen && window.profileScreen.init) {
            console.log('📱 Инициализируем profileScreen');
            window.profileScreen.init();
        }

        // Принудительно загружаем базу данных
        console.log('🔄 Принудительная загрузка базы данных...');
        const dbLoaded = await loadAnimeDatabase();
        console.log('✅ Database loaded:', dbLoaded);
        
        if (dbLoaded && window.animeDatabase) {
            console.log('📊 Anime count:', window.animeDatabase.length);
            databaseLoaded = true;
        } else {
            console.error('❌ Database loading failed');
            showErrorModal('Не удалось загрузить базу аниме. Проверьте подключение к интернету.');
            return;
        }

        // Загружаем данные пользователя с учетом авторизации
        await loadUserData();
        
        // Определяем какой экран показывать
        const isLoggedIn = window.authManager && window.authManager.isLoggedIn();
        console.log('🔐 Инициализация: isLoggedIn =', isLoggedIn);
        
        // Синхронизируем данные с БД при инициализации если авторизованы
        if (isLoggedIn && window.authManager && window.authManager.syncStatsFromDatabase) {
            console.log('🔄 Синхронизация статистики с БД при инициализации...');
            await window.authManager.syncStatsFromDatabase();
        }
        
        // Для новых пользователей показываем экран приветствия
        if (!isLoggedIn) {
            showScreen('welcome-screen');
        } else {
            showScreen('main-screen');
            updateMainScreenStats();
            loadLibrary();
        }

        // Скрываем сообщение загрузки
        const loadingElement = document.getElementById('loading-message');
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }

        if (window.audioManager) {
            window.audioManager.init();
        }

        // Добавляем обработчики кнопок профиля в хедере
        setupHeaderButtons();

        console.log('✅ Приложение инициализировано');

    } catch (error) {
        console.error('❌ Ошибка инициализации:', error);
        showErrorModal('Ошибка запуска приложения: ' + error.message);
    }
}

// Установка обработчиков кнопок в хедере
function setupHeaderButtons() {
    const profileBtn = document.getElementById('header-profile-btn');
    const logoutBtn = document.getElementById('header-logout-btn');
    const profileCard = document.getElementById('profile-card');

    if (profileBtn) {
        profileBtn.addEventListener('click', () => {
            console.log('🔐 Переход в профиль');
            showScreen('profile-screen');
        });
    }

    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            console.log('🔓 Выход из аккаунта');
            if (window.authManager) {
                window.authManager.logout();
                
                // Сбрасываем данные игрока
                playerStats = {
                    level: 1,
                    xp: 0,
                    gamesPlayed: 0,
                    correctAnswers: 0,
                    totalAnswers: 0,
                    achievements: []
                };
                
                // Очищаем сессию
                localStorage.removeItem('animeQuizStats');
                // Удаляем сохранённую сессию, чтобы пользователь вернулся на экран приветствия
                localStorage.removeItem('animeQuizSession');
                
                console.log('✅ Данные пользователя очищены');
                
                updateMainScreenStats();
                // Возвращаем пользователя на экран выбора (войти/зарегистрироваться)
                showScreen('welcome-screen');
            }
        });
    }

    // Делаем профильную карточку кликабельной
    if (profileCard) {
        profileCard.style.cursor = 'pointer';
        profileCard.addEventListener('click', () => {
            console.log('🔐 Переход в профиль из карточки');
            showScreen('profile-screen');
        });
    }
}

// Загрузка данных пользователя (с учетом авторизации)
async function loadUserData() {
    const user = window.authManager ? window.authManager.getCurrentUser() : null;
    console.log('📊 LoadUserData: Текущий пользователь:', user);
    
    if (user) {
        // Загружаем данные из профиля пользователя
        const userStats = window.authManager.getUserStats();
        console.log('📈 LoadUserData: Статистика пользователя:', userStats);
        
        if (userStats) {
            playerStats = {
                level: userStats.level || 1,
                xp: userStats.xp || 0,
                gamesPlayed: userStats.gamesPlayed || 0,
                correctAnswers: userStats.correctAnswers || 0,
                totalAnswers: userStats.totalAnswers || 0,
                achievements: userStats.achievements || []
            };
            console.log('✅ LoadUserData: playerStats обновлен:', playerStats);
        }
        
        console.log('✅ Данные пользователя загружены из профиля');
    } else {
        // Загружаем локальные данные (для гостевого режима)
        const savedStats = localStorage.getItem('animeQuizStats');
        if (savedStats) {
            playerStats = JSON.parse(savedStats);
        }
        
        const savedSettings = localStorage.getItem('animeQuizSettings');
        if (savedSettings) {
            settings = JSON.parse(savedSettings);
        }
        
        console.log('✅ Данные загружены локально (гостевой режим)');
    }
}

// Основные функции навигации
function showScreen(screenName) {
    console.log('Showing screen:', screenName);

    forceStopTimer();
    if (window.audioManager) {
        window.audioManager.stopMusic();
        window.audioManager.stopAnimeMusic();
    }

    // Скрываем все экраны
    const allScreens = document.querySelectorAll('.screen');
    allScreens.forEach(screen => {
        screen.classList.remove('active');
    });

    // Показываем нужный экран
    const targetScreen = document.getElementById(screenName);
    if (targetScreen) {
        targetScreen.classList.add('active');
    } else {
        console.error('Screen not found:', screenName);
    }

    currentScreen = screenName;

    if (screenName === 'main-screen') {
        updateMainScreenStats();
    } else if (screenName === 'stats-screen') {
        updateStatsScreen();
    } else if (screenName === 'library-screen') {
        loadLibrary();
    } else if (screenName === 'profile-screen') {
        // Обновляем данные профиля при показе
        if (window.profileScreen) {
            window.profileScreen.updateProfileData();
        }
    } else if (screenName === 'leaderboard-screen') {
        // Инициализируем лидерборд и запускаем автообновление
        if (window.leaderboardScreen) {
            window.leaderboardScreen.init();
        }
    }
}

function showGameModes() {
    showScreen('game-mode-selection-screen');
}

function showDifficultySelection(mode) {
    const modeNames = {
        'lives': 'Режим с жизнями',
        'timed': 'Режим на время'
    };
    document.getElementById('difficulty-mode-name').textContent = modeNames[mode] || mode;
    showScreen('difficulty-screen');
}

// Функции игры с проверкой авторизации
function startGameWithStartScreen(mode, difficulty = '') {
    console.log('🎮 Starting game with mode:', mode, 'difficulty:', difficulty);
    
    // Проверяем авторизацию
    if (!window.authManager || !window.authManager.isLoggedIn()) {
        // Показываем модальное окно авторизации
        if (window.authManager) {
            window.authManager.showAuthModal();
        } else {
            alert('Для игры необходимо войти в аккаунт!');
            showScreen('login-screen');
        }
        return;
    }
    
    if (!isDatabaseLoaded()) {
        console.error('❌ Database not loaded - animeDatabase:', window.animeDatabase);
        alert('База аниме ещё не загружена. Подождите немного или нажмите "Обновить базу".');
        return;
    }

    console.log('📊 Database loaded with', window.animeDatabase.length, 'anime');

    // Создаем экземпляр режима игры
    let gameModeInstance;
    switch(mode) {
        case 'infinite':
            gameModeInstance = new InfiniteMode();
            break;
        case 'timed':
            gameModeInstance = new TimedMode();
            break;
        case 'lives':
            gameModeInstance = new LivesMode();
            break;
        case 'marathon':
            gameModeInstance = new MarathonMode();
            break;
        case 'multiplayer':
            gameModeInstance = new MultiplayerMode();
            break;
        default:
            gameModeInstance = new InfiniteMode();
    }

    console.log('🎯 Game mode instance created:', gameModeInstance);

    window.currentGameMode = gameModeInstance;
    currentGameMode = gameModeInstance;

    // Сразу запускаем игру без стартового экрана
    currentGameMode.startGame(difficulty);
}

function forceStopTimer() {
    if (gameTimer) {
        clearInterval(gameTimer);
        gameTimer = null;
    }
    if (window.gameState && window.gameState.timer) {
        clearInterval(window.gameState.timer);
        window.gameState.timer = null;
    }
}

// Функции статистики и достижений
function checkLevelUp() {
    const xpNeeded = playerStats.level * 100;
    if (playerStats.xp >= xpNeeded) {
        playerStats.level++;
        playerStats.xp = playerStats.xp - xpNeeded;
        
        // Сохраняем в профиль если авторизован
        if (window.authManager && window.authManager.isLoggedIn()) {
            window.authManager.updateUserStats({
                level: playerStats.level,
                xp: playerStats.xp
            });
        } else {
            // Сохраняем локально для гостя
            saveStats();
        }
        
        showLevelUpMessage();
    }
}

function showLevelUpMessage() {
    alert(`🎊 Поздравляем! Вы достигли уровня ${playerStats.level}!`);
}

function updateMainScreenStats() {
    // Обновляем статистику на главном экране
    try {
        // Получаем элементы
        const profileCard = document.getElementById('profile-card');
        
        // Проверяем авторизацию
        const isLoggedIn = window.authManager && window.authManager.isLoggedIn();
        const user = isLoggedIn ? window.authManager.getCurrentUser() : null;
        
        console.log('🔐 UpdateMainScreenStats - isLoggedIn:', isLoggedIn, 'user:', user?.username || 'null');
        
        // ПРОФИЛЬНАЯ КАРТОЧКА
        if (profileCard) {
            if (isLoggedIn && user) {
                // Показываем профиль
                profileCard.style.display = 'block';
                
                // Заполняем данные профиля
                const profileUsername = document.getElementById('profile-username');
                const profileEmail = document.getElementById('profile-email');
                const profileLevel = document.getElementById('profile-level');
                const profileGames = document.getElementById('profile-games');
                const profileAccuracy = document.getElementById('profile-accuracy');
                const profileAvatarImg = document.getElementById('profile-avatar-img');
                const profileAvatarPlaceholder = document.getElementById('profile-avatar-placeholder');
                
                if (profileUsername) profileUsername.textContent = user.username || 'Пользователь';
                if (profileEmail) profileEmail.textContent = user.email || 'email@example.com';
                
                // Статистика
                const levelElement = document.getElementById('level');
                const xpElement = document.getElementById('xp');
                const gamesElement = document.getElementById('total-games');
                
                if (levelElement) levelElement.textContent = playerStats.level;
                if (xpElement) xpElement.textContent = `${playerStats.xp}/${playerStats.level * 100}`;
                if (gamesElement) gamesElement.textContent = playerStats.gamesPlayed;
                
                if (profileLevel) profileLevel.textContent = playerStats.level;
                if (profileGames) profileGames.textContent = playerStats.gamesPlayed;
                
                const accuracy = playerStats.totalAnswers > 0 ?
                    Math.round((playerStats.correctAnswers / playerStats.totalAnswers) * 100) : 0;
                if (profileAccuracy) profileAccuracy.textContent = accuracy + '%';
                
                // Аватар
                if (user.avatar_url) {
                    if (profileAvatarImg) {
                        profileAvatarImg.src = user.avatar_url;
                        profileAvatarImg.style.display = 'block';
                    }
                    if (profileAvatarPlaceholder) {
                        profileAvatarPlaceholder.style.display = 'none';
                    }
                } else {
                    if (profileAvatarImg) profileAvatarImg.style.display = 'none';
                    if (profileAvatarPlaceholder) {
                        profileAvatarPlaceholder.style.display = 'flex';
                        profileAvatarPlaceholder.textContent = user.username?.charAt(0)?.toUpperCase() || 'У';
                    }
                }
                
                console.log('✅ Профиль показан для:', user.username);
            } else {
                // Скрываем профиль для гостей
                profileCard.style.display = 'none';
                console.log('✅ Профиль скрыт (гость)');
            }
        }
        
        // КНОПКИ И СТАТИСТИКА В ХЕДЕРЕ
        const userButtons = document.getElementById('user-buttons');
        const usernameDisplay = document.getElementById('username-display');
        const userCircle = document.getElementById('user-circle');
        const userStats = document.getElementById('user-stats');
        
        if (isLoggedIn && user) {
            if (userButtons) userButtons.style.display = 'flex';
            if (usernameDisplay) usernameDisplay.textContent = user.username;
            if (userCircle) userCircle.textContent = user.username.charAt(0).toUpperCase();
            if (userStats) userStats.style.display = 'grid';
        } else {
            if (userButtons) userButtons.style.display = 'none';
            if (usernameDisplay) usernameDisplay.textContent = '';
            if (userCircle) userCircle.textContent = '';
            if (userStats) userStats.style.display = 'none';
        }
        
        console.log('✅ UpdateMainScreenStats завершена');
    } catch (error) {
        console.error('❌ Ошибка в updateMainScreenStats:', error);
    }
}

function updateStatsScreen() {
    document.getElementById('stats-level').textContent = playerStats.level;
    document.getElementById('stats-xp').textContent = `${playerStats.xp}/${playerStats.level * 100}`;
    document.getElementById('stats-games-played').textContent = playerStats.gamesPlayed;
    document.getElementById('stats-correct-answers').textContent = playerStats.correctAnswers;
    document.getElementById('stats-total-answers').textContent = playerStats.totalAnswers;

    const accuracy = playerStats.totalAnswers > 0 ?
        Math.round((playerStats.correctAnswers / playerStats.totalAnswers) * 100) : 0;
    document.getElementById('stats-accuracy').textContent = accuracy + '%';

    updateAchievementsUI();
}

function checkAchievements() {
    console.log('🏆 checkAchievements called');
    
    if (!window.authManager || !window.authManager.isLoggedIn()) {
        console.log('❌ checkAchievements: Пользователь не авторизован');
        return; // Достижения только для авторизованных
    }

    const achievements = [];
    const currentStats = window.authManager.getUserStats();
    const unlockedAchievements = currentStats.achievements || [];

    console.log('📊 checkAchievements: Текущие статы:', playerStats);
    console.log('📊 checkAchievements: Разблокированные:', unlockedAchievements);

    // Достижения по количеству игр
    if (playerStats.gamesPlayed >= 1 && !unlockedAchievements.includes('first_game')) {
        achievements.push('first_game');
    }
    if (playerStats.gamesPlayed >= 10 && !unlockedAchievements.includes('ten_games')) {
        achievements.push('ten_games');
    }
    if (playerStats.gamesPlayed >= 50 && !unlockedAchievements.includes('fifty_games')) {
        achievements.push('fifty_games');
    }
    if (playerStats.gamesPlayed >= 100 && !unlockedAchievements.includes('hundred_games')) {
        achievements.push('hundred_games');
    }
    if (playerStats.gamesPlayed >= 500 && !unlockedAchievements.includes('five_hundred_games')) {
        achievements.push('five_hundred_games');
    }

    // Достижения по точности
    if (gameState && gameState.correctAnswers >= 10 && gameState.currentQuestion >= 10) {
        const accuracy = Math.round((gameState.correctAnswers / gameState.currentQuestion) * 100);
        if (accuracy === 100 && !unlockedAchievements.includes('perfect_round')) {
            achievements.push('perfect_round');
        }
    }
    
    if (playerStats.totalAnswers > 0) {
        const totalAccuracy = Math.round((playerStats.correctAnswers / playerStats.totalAnswers) * 100);
        if (totalAccuracy >= 90 && !unlockedAchievements.includes('ninety_percent')) {
            achievements.push('ninety_percent');
        }
        if (totalAccuracy === 100 && playerStats.totalAnswers >= 10 && !unlockedAchievements.includes('hundred_percent')) {
            achievements.push('hundred_percent');
        }
    }

    // Достижения по очкам
    if (gameState && gameState.score >= 1000 && !unlockedAchievements.includes('thousand_points')) {
        achievements.push('thousand_points');
    }
    if (gameState && gameState.score >= 5000 && !unlockedAchievements.includes('five_thousand')) {
        achievements.push('five_thousand');
    }
    if (gameState && gameState.score >= 10000 && !unlockedAchievements.includes('ten_thousand')) {
        achievements.push('ten_thousand');
    }

    // Достижения по правильным ответам
    if (playerStats.correctAnswers >= 10 && !unlockedAchievements.includes('ten_correct')) {
        achievements.push('ten_correct');
    }
    if (playerStats.correctAnswers >= 50 && !unlockedAchievements.includes('fifty_correct')) {
        achievements.push('fifty_correct');
    }
    if (playerStats.correctAnswers >= 100 && !unlockedAchievements.includes('hundred_correct')) {
        achievements.push('hundred_correct');
    }
    if (playerStats.correctAnswers >= 1000 && !unlockedAchievements.includes('thousand_correct')) {
        achievements.push('thousand_correct');
    }

    // Достижения по уровню
    if (playerStats.level >= 5 && !unlockedAchievements.includes('level_five')) {
        achievements.push('level_five');
    }
    if (playerStats.level >= 10 && !unlockedAchievements.includes('level_ten')) {
        achievements.push('level_ten');
    }
    if (playerStats.level >= 20 && !unlockedAchievements.includes('level_twenty')) {
        achievements.push('level_twenty');
    }
    if (playerStats.level >= 50 && !unlockedAchievements.includes('level_fifty')) {
        achievements.push('level_fifty');
    }

    // Достижения по режимам (проверяем текущий режим)
    if (window.currentGameMode) {
        const modeType = window.currentGameMode.modeType || window.currentGameMode.type;
        if (modeType === 'infinite' && playerStats.gamesPlayed >= 10 && !unlockedAchievements.includes('infinite_master')) {
            achievements.push('infinite_master');
        }
        if (modeType === 'timed' && playerStats.gamesPlayed >= 10 && !unlockedAchievements.includes('timed_warrior')) {
            achievements.push('timed_warrior');
        }
        if (modeType === 'lives' && playerStats.gamesPlayed >= 10 && !unlockedAchievements.includes('lives_survivor')) {
            achievements.push('lives_survivor');
        }
        if (modeType === 'marathon' && playerStats.gamesPlayed >= 10 && !unlockedAchievements.includes('marathon_hero')) {
            achievements.push('marathon_hero');
        }
    }

    // Достижения за серии (нужна отдельная переменная для отслеживания)
    if (window.currentStreak >= 5 && !unlockedAchievements.includes('five_streak')) {
        achievements.push('five_streak');
    }
    if (window.currentStreak >= 10 && !unlockedAchievements.includes('ten_streak')) {
        achievements.push('ten_streak');
    }
    if (window.currentStreak >= 20 && !unlockedAchievements.includes('twenty_streak')) {
        achievements.push('twenty_streak');
    }

    // Достижения за анимэ (нужно отслеживать количество уникальных аниме)
    if (window.uniqueAnimeCount >= 5 && !unlockedAchievements.includes('know_five_anime')) {
        achievements.push('know_five_anime');
    }
    if (window.uniqueAnimeCount >= 20 && !unlockedAchievements.includes('know_twenty_anime')) {
        achievements.push('know_twenty_anime');
    }
    if (window.uniqueAnimeCount >= 50 && !unlockedAchievements.includes('know_fifty_anime')) {
        achievements.push('know_fifty_anime');
    }
    if (window.uniqueAnimeCount >= 100 && !unlockedAchievements.includes('know_hundred_anime')) {
        achievements.push('know_hundred_anime');
    }

    // Простые специальные достижения
    if (!unlockedAchievements.includes('ace_player')) {
        achievements.push('ace_player');
    }
    if (!unlockedAchievements.includes('collector')) {
        achievements.push('collector');
    }

    // Добавляем новые достижения в список
    const newAchievements = achievements.filter(id => !unlockedAchievements.includes(id));
    
    if (newAchievements.length > 0) {
        const updatedAchievements = [...unlockedAchievements, ...newAchievements];
        console.log('✅ checkAchievements: Новые достижения:', newAchievements);
        console.log('✅ checkAchievements: Обновленный список:', updatedAchievements);
        
        // Сохраняем в authManager
        window.authManager.userStats.achievements = updatedAchievements;
        window.authManager.updateUserStats({
            achievements: updatedAchievements
        });

        // Сохраняем в localStorage
        const sessionData = JSON.parse(localStorage.getItem('animeQuizSession') || '{}');
        if (sessionData.userStats) {
            sessionData.userStats.achievements = updatedAchievements;
            localStorage.setItem('animeQuizSession', JSON.stringify(sessionData));
            console.log('✅ checkAchievements: Сохранено в localStorage');
        }

        console.log('🏆 Новые достижения разблокированы:', newAchievements);

        // Показываем уведомление
        const achievementMessage = document.getElementById('achievement-message');
        if (achievementMessage) {
            const achievementNames = {
                'first_game': 'Первый шаг',
                'ten_games': 'Ветеран',
                'fifty_games': 'Опытный игрок',
                'hundred_games': 'Маньяк квизов',
                'perfect_round': 'Идеальный раунд',
                'ninety_percent': 'Мастер',
                'hundred_percent': 'Совершенство',
                'thousand_points': 'Высокий счёт',
                'ten_correct': 'Начинающий',
                'fifty_correct': 'Эксперт',
                'hundred_correct': 'Гений',
                'thousand_correct': 'Мудрец',
                'level_five': 'Начинающий уровень',
                'level_ten': 'Продвинутый',
                'level_twenty': 'Профессионал',
                'level_fifty': 'Титан',
                'ace_player': 'Ас',
                'collector': 'Коллекционер'
            };

            if (newAchievements.length === 1) {
                achievementMessage.innerHTML = `<h3>🎉 Новое достижение!</h3><p>${achievementNames[newAchievements[0]] || newAchievements[0]}</p>`;
            } else {
                achievementMessage.innerHTML = '<h3>🎉 Новые достижения!</h3>';
                newAchievements.forEach(id => {
                    achievementMessage.innerHTML += `<p>✅ ${achievementNames[id] || id}</p>`;
                });
            }
        }
    } else {
        console.log('ℹ️ checkAchievements: Новых достижений нет');
    }
}


function updateAchievementsUI() {
    const achievementsContainer = document.getElementById('achievements');
    if (!achievementsContainer) return;

    achievementsContainer.innerHTML = '';

    const allAchievements = [
        { id: 'high_scorer', name: 'Высокий счёт', description: 'Наберите 1000 очков в одной игре' },
        { id: 'consistency', name: 'Стабильность', description: 'Дайте 10 правильных ответов подряд' },
        { id: 'veteran', name: 'Ветеран', description: 'Сыграйте 10 игр' },
        { id: 'expert', name: 'Эксперт', description: 'Дайте 50 правильных ответов' }
    ];

    allAchievements.forEach(achievement => {
        const isUnlocked = playerStats.achievements.includes(achievement.id);
        const achievementElement = document.createElement('div');
        achievementElement.className = isUnlocked ? 'achievement unlocked' : 'achievement locked';
        achievementElement.innerHTML = `
            <strong>${achievement.name}</strong><br>
            <small>${achievement.description}</small>
            ${isUnlocked ? '✅' : '🔒'}
        `;
        achievementsContainer.appendChild(achievementElement);
    });
}

// Настройки
function saveSettings() {
    settings.difficulty = document.getElementById('difficulty').value;
    settings.autoplay = document.getElementById('autoplay').checked;

    // Сохраняем в профиль если авторизован
    if (window.authManager && window.authManager.isLoggedIn()) {
        window.authManager.updateUserSettings(settings);
    } else {
        // Сохраняем локально
        localStorage.setItem('animeQuizSettings', JSON.stringify(settings));
    }
    
    alert('Настройки сохранены! ✅');
    showScreen('main-screen');
}

function loadSettings() {
    // Сначала пробуем загрузить из профиля
    if (window.authManager && window.authManager.isLoggedIn()) {
        const userSettings = window.authManager.getUserSettings();
        if (userSettings) {
            settings = userSettings;
            if (document.getElementById('difficulty')) {
                document.getElementById('difficulty').value = settings.difficulty;
                document.getElementById('autoplay').checked = settings.autoplay;
            }
            return;
        }
    }
    
    // Иначе загружаем локальные настройки
    const saved = localStorage.getItem('animeQuizSettings');
    if (saved) {
        settings = JSON.parse(saved);
        if (document.getElementById('difficulty')) {
            document.getElementById('difficulty').value = settings.difficulty;
            document.getElementById('autoplay').checked = settings.autoplay;
        }
    }
}

function resetProgress() {
    if (confirm('Вы уверены, что хотите сбросить весь прогресс? Это действие нельзя отменить.')) {
        playerStats = {
            level: 1,
            xp: 0,
            gamesPlayed: 0,
            correctAnswers: 0,
            totalAnswers: 0,
            achievements: []
        };
        
        // Сбрасываем в профиле если авторизован
        if (window.authManager && window.authManager.isLoggedIn()) {
            window.authManager.updateUserStats({
                level: 1,
                xp: 0,
                games_played: 0,
                correct_answers: 0,
                total_answers: 0,
                achievements: []
            });
        } else {
            // Сохраняем локально
            saveStats();
        }
        
        updateMainScreenStats();
        alert('Прогресс сброшен! 🔄');
    }
}

function saveStats() {
    // Сохраняем в профиль если авторизован
    if (window.authManager && window.authManager.isLoggedIn()) {
        window.authManager.updateUserStats({
            level: playerStats.level,
            xp: playerStats.xp,
            games_played: playerStats.gamesPlayed,
            correct_answers: playerStats.correctAnswers,
            total_answers: playerStats.totalAnswers,
            achievements: playerStats.achievements
        });
    } else {
        // Сохраняем локально
        localStorage.setItem('animeQuizStats', JSON.stringify(playerStats));
    }
}

function loadStats() {
    // Статистика загружается через loadUserData()
}

// Библиотека
function loadLibrary() {
    console.log('Loading library...');
    const libraryContainer = document.getElementById('anime-library');
    if (!libraryContainer) {
        console.error('Library container not found');
        return;
    }

    if (!isDatabaseLoaded()) {
        libraryContainer.innerHTML = '<p>Загрузка базы аниме...</p>';
        return;
    }

    libraryContainer.innerHTML = '';
    const allAnime = [...window.animeDatabase].sort((a, b) => a.title.localeCompare(b.title));

    allAnime.forEach(anime => {
        const animeElement = document.createElement('div');
        animeElement.className = 'library-item';
        animeElement.style.cursor = 'pointer';
        animeElement.onclick = () => showAnimeDetails(anime.id);

        animeElement.innerHTML = `
            <img src="${anime.image}" alt="${anime.title}" class="library-poster"
                 onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA2MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjMUEwQjJFIi8+Cjx0ZXh0IHg9IjMwIiB5PSI0MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmaWxsPSIjQzRCNUZEIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj5JbWc8L3RleHQ+Cjwvc3ZnPgo=';">
            <div class="library-info">
                <h4>${anime.title}</h4>
                <p>${anime.description}</p>
                <small>${anime.year} | ${anime.genre.join(', ')}</small>
            </div>
            <div style="margin-left: auto; color: #8b5cf6; font-size: 12px;">
                ▶️
            </div>
        `;
        libraryContainer.appendChild(animeElement);
    });

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-genre') === 'all') {
            btn.classList.add('active');
        }
    });
}

function showAnimeDetails(animeId) {
    const anime = getAnimeById(animeId);
    if (!anime) return;

    const modalHtml = `
        <div id="anime-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.9);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
            animation: fadeIn 0.3s ease-in-out;
        ">
            <div style="
                background: #1a0b2e;
                padding: 25px;
                border-radius: 16px;
                border: 2px solid #7c3aed;
                max-width: 90%;
                max-height: 90%;
                overflow-y: auto;
                text-align: center;
                position: relative;
            ">
                <button onclick="closeAnimeModal()" style="
                    position: absolute;
                    top: 15px;
                    right: 15px;
                    background: none;
                    border: none;
                    color: #c4b5fd;
                    font-size: 24px;
                    cursor: pointer;
                    padding: 5px;
                ">×</button>

                <img src="${anime.image}" alt="${anime.title}"
                     style="width: 150px; height: 200px; object-fit: cover; border-radius: 12px; margin-bottom: 15px; border: 2px solid #7c3aed;"
                     onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTUwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDE1MCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxyZWN0IHdpZHRoPSIxNTAiIGhlaWdodD0iMjAwIiBmaWxsPSIjMUEwQjJFIi8+Cjx0ZXh0IHg9Ijc1IiB5PSIxMDAiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIxNCIgZmlsbD0iI0M0QjVGRCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSI+Tm8gSW1hZ2U8L3RleHQ+Cjwvc3ZnPgo=';">

                <h3 style="color: #e9d5ff; margin-bottom: 10px;">${anime.title}</h3>
                <p style="color: #c4b5fd; margin-bottom: 8px;">${anime.description}</p>
                <p style="color: #a78bfa; margin-bottom: 15px;">Год: ${anime.year} | Жанры: ${anime.genre.join(', ')}</p>

                <div class="music-controls" style="margin: 20px 0;">
                    <button class="btn" onclick="playAnimeMusic('${anime.music}', ${anime.id})"
                            style="background: linear-gradient(135deg, #10b981, #34d399); margin: 5px;">
                        ▶️ Прослушать опенинг
                    </button>
                    <button class="btn secondary-btn" onclick="stopAnimeMusic()"
                            style="margin: 5px;">
                        ⏹️ Остановить
                    </button>
                </div>

                <div id="music-status-${anime.id}" style="
                    color: #c4b5fd;
                    font-size: 14px;
                    margin-top: 10px;
                    min-height: 20px;
                "></div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function closeAnimeModal() {
    const modal = document.getElementById('anime-modal');
    if (modal) {
        modal.remove();
    }
    if (window.audioManager) {
        window.audioManager.stopAnimeMusic();
    }
}

function playAnimeMusic(musicUrl, animeId) {
    if (window.audioManager) {
        window.audioManager.playAnimeMusic(musicUrl, animeId);
    }
}

function stopAnimeMusic() {
    if (window.audioManager) {
        window.audioManager.stopAnimeMusic();
    }
}

// Поиск и фильтрация
function searchAnime() {
    const searchTerm = document.getElementById('search-input').value.toLowerCase().trim();
    const items = document.getElementsByClassName('library-item');

    if (searchTerm === '') {
        for (let item of items) {
            item.style.display = 'flex';
        }
        return;
    }

    let foundCount = 0;
    for (let item of items) {
        const title = item.querySelector('h4').textContent.toLowerCase();
        const description = item.querySelector('p').textContent.toLowerCase();
        const genres = item.querySelector('small').textContent.toLowerCase();

        if (title.includes(searchTerm) || description.includes(searchTerm) || genres.includes(searchTerm)) {
            item.style.display = 'flex';
            foundCount++;
        } else {
            item.style.display = 'none';
        }
    }

    const libraryContainer = document.getElementById('anime-library');
    if (foundCount === 0 && libraryContainer) {
        const existingMessage = libraryContainer.querySelector('.no-results-message');
        if (existingMessage) {
            existingMessage.remove();
        }

        const noResults = document.createElement('div');
        noResults.className = 'no-results-message';
        noResults.style.textAlign = 'center';
        noResults.style.color = '#c4b5fd';
        noResults.style.padding = '40px';
        noResults.innerHTML = `
            <p>🔍 Не найдено аниме по запросу "${searchTerm}"</p>
            <button class="btn secondary-btn" onclick="document.getElementById('search-input').value = ''; searchAnime();"
                    style="margin-top: 15px;">
                Очистить поиск
            </button>
        `;
        libraryContainer.appendChild(noResults);
    } else {
        const existingMessage = libraryContainer.querySelector('.no-results-message');
        if (existingMessage) {
            existingMessage.remove();
        }
    }
}

function filterAnime(genre) {
    console.log('Filtering anime by genre:', genre);

    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.getAttribute('data-genre') === genre) {
            btn.classList.add('active');
        }
    });

    const libraryContainer = document.getElementById('anime-library');
    if (!libraryContainer) return;

    if (!isDatabaseLoaded()) {
        libraryContainer.innerHTML = '<p>Загрузка базы аниме...</p>';
        return;
    }

    libraryContainer.innerHTML = '';
    let filteredAnime = [];

    if (genre === 'all') {
        filteredAnime = [...window.animeDatabase];
    } else {
        const russianGenre = getRussianGenreName(genre);
        filteredAnime = window.animeDatabase.filter(anime => {
            if (!anime.genre || !Array.isArray(anime.genre)) return false;
            return anime.genre.some(g => g.toLowerCase().includes(russianGenre.toLowerCase()));
        });
    }

    filteredAnime.sort((a, b) => a.title.localeCompare(b.title));

    if (filteredAnime.length === 0) {
        libraryContainer.innerHTML = `
            <div style="text-align: center; color: #c4b5fd; padding: 40px;">
                <p>😔 Не найдено аниме в категории "${getGenreName(genre)}"</p>
                <button class="btn secondary-btn" onclick="filterAnime('all')"
                        style="margin-top: 15px;">
                    Показать все аниме
                </button>
            </div>
        `;
    } else {
        filteredAnime.forEach(anime => {
            const animeElement = document.createElement('div');
            animeElement.className = 'library-item';
            animeElement.style.cursor = 'pointer';
            animeElement.onclick = () => showAnimeDetails(anime.id);

            animeElement.innerHTML = `
                <img src="${anime.image}" alt="${anime.title}" class="library-poster"
                     onerror="this.onerror=null; this.src='data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iODAiIHZpZXdCb3g9IjAgMCA2MCA4MCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjYwIiBoZWlnaHQ9IjgwIiBmaWxsPSIjMUEwQjJFIi8+Cjx0ZXh0IHg9IjMwIiB5PSI0MCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiBmb250LXNpemU9IjEwIiBmaWxsPSIjQzRCNUZEIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkb21pbmFudC1iYXNlbGluZT0ibWlkZGxlIj5JbWc8L3RleHQ+Cjwvc3ZnPgo=';">
                <div class="library-info">
                    <h4>${anime.title}</h4>
                    <p>${anime.description}</p>
                    <small>${anime.year} | ${anime.genre.join(', ')}</small>
                </div>
                <div style="margin-left: auto; color: #8b5cf6; font-size: 12px;">
                    ▶️
                </div>
            `;
            libraryContainer.appendChild(animeElement);
        });
    }
}

function getRussianGenreName(englishGenre) {
    const genreMap = {
        'all': 'все',
        'shonen': 'шонен',
        'fantasy': 'фэнтези',
        'comedy': 'комедия',
        'drama': 'драма',
        'action': 'экшен',
        'adventure': 'приключения',
        'romance': 'романтика',
        'sci-fi': 'фантастика',
        'horror': 'ужасы',
        'psychological': 'психологический',
        'detective': 'детектив',
        'sport': 'спорт',
        'supernatural': 'сверхъестественное',
        'isekai': 'исекай',
        'sliceoflife': 'повседневность'
    };
    return genreMap[englishGenre] || englishGenre;
}

function getGenreName(genreKey) {
    const genreNames = {
        'all': 'Все',
        'shonen': 'Шонен',
        'fantasy': 'Фэнтези',
        'comedy': 'Комедия',
        'drama': 'Драма',
        'action': 'Экшен',
        'adventure': 'Приключения',
        'romance': 'Романтика',
        'sci-fi': 'Фантастика',
        'horror': 'Ужасы',
        'psychological': 'Психологический',
        'detective': 'Детектив',
        'sport': 'Спорт',
        'supernatural': 'Сверхъестественное',
        'isekai': 'Исекай',
        'sliceoflife': 'Повседневность'
    };
    return genreNames[genreKey] || genreKey;
}

function showErrorModal(message) {
    const existingModal = document.getElementById('error-modal');
    if (existingModal) {
        existingModal.remove();
    }

    const errorHtml = `
        <div id="error-modal" style="
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        ">
            <div style="
                background: #1a0b2e;
                padding: 30px;
                border-radius: 15px;
                border: 2px solid #ff4757;
                max-width: 80%;
                text-align: center;
            ">
                <h3 style="color: #ff4757; margin-bottom: 15px;">⚠️ Ошибка</h3>
                <p style="color: #e9d5ff; margin-bottom: 20px;">${message}</p>
                <button onclick="location.reload()" style="
                    background: #7c3aed;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    cursor: pointer;
                ">Перезапустить</button>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', errorHtml);
}

async function reloadDatabase() {
    console.log('🔄 Повторная загрузка базы аниме...');

    const loadingElement = document.getElementById('loading-message');
    if (loadingElement) {
        loadingElement.style.display = 'block';
        loadingElement.textContent = '🔄 Загрузка данных...';
        loadingElement.style.color = '#fbbf24';
    }

    try {
        const dbLoaded = await loadAnimeDatabase();

        if (dbLoaded) {
            if (loadingElement) {
                loadingElement.textContent = '✅ Библиотека обновлена!';
                loadingElement.style.color = '#00ff7f';
            }

            // Обновляем библиотеку на всех экранах
            loadLibrary();

        } else {
            if (loadingElement) {
                loadingElement.textContent = '❌ Ошибка загрузки данных';
                loadingElement.style.color = '#ff4757';
            }
        }
    } catch (error) {
        console.error('❌ Ошибка при загрузке базы:', error);
        if (loadingElement) {
            loadingElement.textContent = '❌ Ошибка загрузки данных';
            loadingElement.style.color = '#ff4757';
        }
    }

    setTimeout(() => {
        if (loadingElement) {
            loadingElement.style.display = 'none';
        }
    }, 3000);
}

// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ДЛЯ РЕЖИМОВ ИГРЫ
function getRandomAnime(count = 1, excludeIds = []) {
    if (!window.animeDatabase || window.animeDatabase.length === 0) {
        console.warn('⚠️ База аниме пуста или не загружена');
        return null;
    }
    
    let availableAnime = window.animeDatabase.filter(anime => !excludeIds.includes(anime.id));
    
    if (availableAnime.length === 0) {
        console.log('🔄 Все аниме использованы, сбрасываем исключения');
        availableAnime = [...window.animeDatabase];
    }
    
    // Если запрашиваем больше чем доступно, возвращаем все доступные
    if (count >= availableAnime.length) {
        shuffleArray(availableAnime);
        return count === 1 ? availableAnime[0] : availableAnime;
    }
    
    shuffleArray(availableAnime);
    
    if (count === 1) {
        return availableAnime[0];
    } else {
        return availableAnime.slice(0, count);
    }
}

function shuffleArray(array) {
    if (!array || array.length === 0) return array;
    
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function getAnimeById(id) {
    if (!window.animeDatabase || window.animeDatabase.length === 0) {
        console.warn('⚠️ База аниме пуста или не загружена');
        return null;
    }
    
    const anime = window.animeDatabase.find(anime => anime.id === id);
    if (!anime) {
        console.warn(`⚠️ Аниме с ID ${id} не найдено`);
    }
    return anime;
}

function isDatabaseLoaded() {
    return window.animeDatabase && window.animeDatabase.length > 0;
}

// ФУНКЦИЯ ДЛЯ РЕГУЛИРОВКИ ГРОМКОСТИ В ИГРЕ
function updateGameVolume(volume) {
    console.log('🔊 updateGameVolume вызвана:', volume);
    
    // Обновляем настройки
    const newVolume = parseInt(volume);
    settings.musicVolume = newVolume;
    
    // Обновляем аудио менеджер
    if (window.audioManager) {
        window.audioManager.updateVolume(newVolume);
    }
    
    // Обновляем отображение если элементы существуют
    const volumeValueElement = document.getElementById('game-volume-value');
    if (volumeValueElement) {
        volumeValueElement.textContent = newVolume + '%';
        
        // Анимация пульсации
        volumeValueElement.classList.add('volume-pulse');
        setTimeout(() => {
            volumeValueElement.classList.remove('volume-pulse');
        }, 500);
    }
    
    // Обновляем ползунок если он существует
    const volumeSlider = document.getElementById('game-volume');
    if (volumeSlider) {
        volumeSlider.value = newVolume;
    }
    
    // Обновляем заполнение дорожки
    const volumeTrackFill = document.getElementById('volume-track-fill');
    if (volumeTrackFill) {
        volumeTrackFill.style.width = `${newVolume}%`;
    }
    
    // Обновляем иконку
    const volumeIcon = document.getElementById('volume-icon');
    if (volumeIcon) {
        // Удаляем все классы
        volumeIcon.className = 'volume-icon';
        
        // Устанавливаем соответствующий эмодзи и класс
        if (newVolume === 0) {
            volumeIcon.textContent = '🔇';
            volumeIcon.classList.add('muted');
        } else if (newVolume < 30) {
            volumeIcon.textContent = '🔈';
            volumeIcon.classList.add('low');
        } else if (newVolume < 70) {
            volumeIcon.textContent = '🔉';
            volumeIcon.classList.add('medium');
        } else {
            volumeIcon.textContent = '🔊';
            volumeIcon.classList.add('high');
        }
    }
    
    // Сохраняем настройки локально
    localStorage.setItem('animeQuizSettings', JSON.stringify(settings));
    
    console.log('✅ Громкость обновлена:', newVolume + '%');
}

// ФУНКЦИИ ДЛЯ РЕЖИМОВ ИГРЫ
function startGame(mode, difficulty = '') {
    startGameWithStartScreen(mode, difficulty);
}

function skipQuestion() {
    if (window.currentGameMode && window.currentGameMode.skipQuestion) {
        window.currentGameMode.skipQuestion();
    }
}

function nextQuestion() {
    if (window.currentGameMode && window.currentGameMode.nextQuestion) {
        window.currentGameMode.nextQuestion();
    }
}

function endGame() {
    console.log('▶ endGame called');

    try {
        // Останавливаем таймер и музыку
        forceStopTimer();
        if (window.audioManager) {
            window.audioManager.stopMusic();
        }

        // Сохраняем статистику игры если авторизован
        if (window.gameState && window.authManager && window.authManager.isLoggedIn()) {
            // Обновляем общую статистику
            playerStats.gamesPlayed++;
            playerStats.correctAnswers += window.gameState.correctAnswers || 0;
            playerStats.totalAnswers += window.gameState.currentQuestion || 0;
            playerStats.xp += window.gameState.score || 0;

            // Проверяем уровень
            checkLevelUp();

            // Сохраняем в профиль
            window.authManager.updateUserStats({
                games_played: playerStats.gamesPlayed,
                correct_answers: playerStats.correctAnswers,
                total_answers: playerStats.totalAnswers,
                xp: playerStats.xp,
                level: playerStats.level
            });
        }

        // Скрываем игровой экран
        const gameScreen = document.getElementById('game-screen');
        if (gameScreen) {
            gameScreen.classList.remove('active');
        }

        // Скрываем экран результата
        const resultScreen = document.getElementById('result-screen');
        if (resultScreen) {
            resultScreen.classList.remove('active');
        }

        // Показываем финальную статистику (безопасно вызываем метод режима)
        if (window.currentGameMode && typeof window.currentGameMode.endGame === 'function') {
            try {
                window.currentGameMode.endGame();
            } catch (modeErr) {
                console.error('Error in currentGameMode.endGame:', modeErr);
            }
        }

        // Проверяем достижения
        if (window.checkAchievements) window.checkAchievements();

    } catch (err) {
        console.error('Error during endGame():', err);
        // Показываем пользователю короткое уведомление об ошибке
        try { alert('Произошла ошибка при завершении игры: ' + (err.message || err)); } catch (_) {}
    } finally {
        // Гарантированно показываем экран завершения, даже если внутри произошла ошибка
        showScreen('end-screen');
    }
}

function playGameMusic() {
    if (window.gameState && window.gameState.currentMusic && window.audioManager) {
        window.audioManager.playMusic(window.gameState.currentMusic);
    }
}

function pauseGameMusic() {
    if (window.audioManager) {
        window.audioManager.pauseMusic();
    }
}

function stopGameMusic() {
    if (window.audioManager) {
        window.audioManager.stopMusic();
    }
}

// ФУНКЦИЯ ДЛЯ ЗАПУСКА МУЗЫКИ ВОПРОСА
function startMusicForQuestion() {
    if (window.currentGameMode && window.currentGameMode.startMusicForQuestion) {
        window.currentGameMode.startMusicForQuestion();
    } else {
        console.error('❌ Game mode not available');
    }
}

// ========== МУЛЬТИПЛЕЕР ФУНКЦИИ ==========

// Показать экран настроек мультиплеера
function showMultiplayerSettingsScreen() {
    console.log('⚙️ Показ экрана настроек мультиплеера');
    showScreen('multiplayer-settings-screen');
}

// Перейти к выбору друзей после выбора количества вопросов
function proceedToMultiplayerFriends() {
    console.log('👥 Переход к выбору друзей');
    
    // Получаем значение из поля настроек
    const settingsInput = document.getElementById('multiplayer-questions-settings');
    const questionsCount = settingsInput ? parseInt(settingsInput.value) || 10 : 10;
    
    console.log('📊 Выбрано вопросов:', questionsCount);
    
    // Сохраняем это значение глобально для использования при приглашении
    window.selectedMultiplayerQuestions = questionsCount;
    window.currentMultiplayerMode = 'different'; // Устанавливаем текущий режим
    
    // Показываем экран мультиплеера со списком друзей
    showMultiplayerScreen();
}

async function showMultiplayerScreen() {
    console.log('🎮 Открытие экрана мультиплеера');
    
    // Загружаем список друзей
    const friendsList = document.getElementById('multiplayer-friends-list');
    if (!friendsList) return;

    friendsList.innerHTML = '<p style="text-align: center; color: #a78bfa;">Загрузка списка друзей...</p>';

    // Получаем список друзей
    const friends = window.friendsManager ? window.friendsManager.getAllFriends() : [];

    if (friends.length === 0) {
        friendsList.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #a78bfa;">
                <p>😢 У вас нет друзей</p>
                <p style="font-size: 12px; margin-top: 10px;">Добавьте друзей через профиль чтобы играть в мультиплеер</p>
            </div>
        `;
        showScreen('multiplayer-screen');
        return;
    }

    // Используем сохраненное значение или значение по умолчанию
    const maxQuestions = window.selectedMultiplayerQuestions || 10;
    console.log('📊 Количество вопросов для приглашения:', maxQuestions);

    const friendsHtml = friends.map(friend => {
        return `
            <div style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%); 
                        border: 1px solid #667eea; border-radius: 10px; padding: 15px; margin-bottom: 10px; 
                        display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                        <div style="width: 10px; height: 10px; border-radius: 50%; background: ${friend.status === 'online' ? '#22c55e' : '#6b7280'};"></div>
                        <strong style="color: #c4b5fd;">${friend.username}</strong>
                    </div>
                    <p style="color: #a78bfa; font-size: 12px; margin: 0;">Уровень: ${friend.level || 1}</p>
                </div>
                <button class="btn start-btn" style="padding: 8px 16px; font-size: 13px;" 
                        onclick="inviteFriendToMultiplayer('${friend.id}', ${maxQuestions})">
                    📨 Пригласить
                </button>
            </div>
        `;
    }).join('');

    friendsList.innerHTML = friendsHtml;
    showScreen('multiplayer-screen');
}

async function inviteFriendToMultiplayer(friendId, maxQuestions = 10) {
    console.log('📨 Приглашение друга:', friendId, 'Вопросов:', maxQuestions);
    
    if (!window.friendsManager) {
        alert('❌ Ошибка: менеджер друзей не инициализирован');
        return;
    }

    try {
        const inviteData = await window.friendsManager.sendMultiplayerInvite(friendId, maxQuestions);
        
        if (inviteData && inviteData.id) {
            console.log('✅ Приглашение успешно отправлено, ID:', inviteData.id);
            // Показываем экран ожидания
            const multiplayerMode = new MultiplayerMode();
            window.currentGameMode = multiplayerMode;
            
            // Сохраняем inviteId для отслеживания
            window.currentMultiplayerInviteId = inviteData.id;
            
            await multiplayerMode.startAsHost(friendId, maxQuestions);
        }
    } catch (error) {
        console.error('❌ Ошибка при приглашении:', error);
        alert('Ошибка: ' + error.message);
    }
}

// Показать экран настроек для обычного режима мультиплеера
function showMultiplayerNormalSettings() {
    console.log('⚙️ Показ экрана настроек обычного мультиплеера');
    
    // Создаём специальный экран для обычного режима
    const settingsScreen = document.createElement('div');
    settingsScreen.id = 'multiplayer-normal-settings-screen';
    settingsScreen.className = 'screen';
    
    settingsScreen.innerHTML = `
        <div class="container">
            <h2>⚙️ Настройка игры (Обычный режим)</h2>
            <p style="color: #a78bfa; margin-bottom: 30px;">Оба игрока отвечают на одни и те же вопросы</p>
            
            <div style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%); 
                        border: 1px solid #667eea; border-radius: 10px; padding: 20px; margin-bottom: 30px; max-width: 400px; margin-left: auto; margin-right: auto;">
                <div class="form-group">
                    <label for="multiplayer-normal-questions-settings" style="color: #a78bfa; display: block; margin-bottom: 10px;">📊 Количество вопросов:</label>
                    <input type="number" id="multiplayer-normal-questions-settings" min="5" max="50" value="10" 
                           style="width: 100%; padding: 12px; background: rgba(102, 126, 234, 0.1); border: 1px solid #667eea; border-radius: 5px; color: #c4b5fd; font-size: 16px;">
                    <p style="color: #9a8bce; font-size: 12px; margin-top: 8px;">Минимум 5, максимум 50 вопросов</p>
                </div>
            </div>

            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <button class="btn start-btn" onclick="proceedToMultiplayerNormalFriends()" style="padding: 12px 30px; font-size: 16px;">
                    ✓ Далее
                </button>
                <button class="btn secondary-btn" onclick="showScreen('multiplayer-type-screen')" style="padding: 12px 30px; font-size: 16px;">
                    ← Назад
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(settingsScreen);
    showScreen('multiplayer-normal-settings-screen');
}

// Перейти к выбору друзей для обычного режима
function proceedToMultiplayerNormalFriends() {
    console.log('👥 Переход к выбору друзей (Обычный режим)');
    
    const settingsInput = document.getElementById('multiplayer-normal-questions-settings');
    const questionsCount = settingsInput ? parseInt(settingsInput.value) || 10 : 10;
    
    console.log('📊 Выбрано вопросов:', questionsCount);
    
    window.selectedMultiplayerNormalQuestions = questionsCount;
    window.currentMultiplayerMode = 'normal'; // Устанавливаем текущий режим
    
    showMultiplayerNormalScreen();
}

// Показать экран выбора друзей для обычного режима
async function showMultiplayerNormalScreen() {
    console.log('🎮 Открытие экрана мультиплеера (Обычный режим)');
    
    if (!window.friendsManager) {
        alert('❌ Ошибка: менеджер друзей не инициализирован');
        return;
    }
    
    const friendsList = document.getElementById('multiplayer-friends-list');
    if (!friendsList) {
        console.error('❌ Контейнер списка друзей не найден');
        return;
    }

    friendsList.innerHTML = '<p style="text-align: center; color: #a78bfa;">Загрузка списка друзей...</p>';

    const friends = window.friendsManager ? window.friendsManager.getAllFriends() : [];

    if (friends.length === 0) {
        friendsList.innerHTML = `
            <div style="text-align: center; padding: 30px; color: #a78bfa;">
                <p>😢 У вас нет друзей</p>
                <p style="font-size: 12px; margin-top: 10px;">Добавьте друзей через профиль чтобы играть в мультиплеер</p>
            </div>
        `;
        showScreen('multiplayer-screen');
        return;
    }

    const maxQuestions = window.selectedMultiplayerNormalQuestions || 10;
    console.log('📊 Количество вопросов для приглашения:', maxQuestions);

    const friendsHtml = friends.map(friend => {
        return `
            <div style="background: linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(118, 75, 162, 0.1) 100%); 
                        border: 1px solid #667eea; border-radius: 10px; padding: 15px; margin-bottom: 10px; 
                        display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
                        <div style="width: 10px; height: 10px; border-radius: 50%; background: ${friend.status === 'online' ? '#22c55e' : '#6b7280'};"></div>
                        <strong style="color: #c4b5fd;">${friend.username}</strong>
                    </div>
                    <p style="color: #a78bfa; font-size: 12px; margin: 0;">Уровень: ${friend.level || 1}</p>
                </div>
                <button class="btn start-btn" style="padding: 8px 16px; font-size: 13px;" 
                        onclick="inviteFriendToMultiplayerNormal('${friend.id}', ${maxQuestions})">
                    📨 Пригласить
                </button>
            </div>
        `;
    }).join('');

    friendsList.innerHTML = friendsHtml;
    showScreen('multiplayer-screen');
}

// Пригласить друга в обычный режим мультиплеера
async function inviteFriendToMultiplayerNormal(friendId, maxQuestions = 10) {
    console.log('📨 Приглашение друга (Обычный режим):', friendId, 'Вопросов:', maxQuestions);
    
    if (!window.friendsManager) {
        alert('❌ Ошибка: менеджер друзей не инициализирован');
        return;
    }

    // Убедимся что режим установлен
    window.currentMultiplayerMode = 'normal';
    console.log('📌 Текущий режим мультиплеера установлен:', window.currentMultiplayerMode);

    // Ждем загрузки класса MultiplayerNormalMode с retry
    let attempts = 0;
    while (typeof MultiplayerNormalMode === 'undefined' && attempts < 10) {
        console.log('⏳ Ожидание загрузки MultiplayerNormalMode... попытка', attempts + 1);
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }

    if (typeof MultiplayerNormalMode === 'undefined') {
        console.error('❌ Класс MultiplayerNormalMode не определен после 10 попыток!');
        alert('❌ Ошибка: игровой режим не загружен. Пожалуйста, обновите страницу (Ctrl+Shift+R).');
        return;
    }

    console.log('✅ MultiplayerNormalMode загружен и готов к использованию');

    try {
        // Устанавливаем режим для гостя перед отправкой приглашения
        localStorage.setItem('invitedGameMode', 'normal');
        console.log('💾 Установлен флаг для гостя в localStorage: invitedGameMode = normal');
        
        const inviteData = await window.friendsManager.sendMultiplayerInvite(friendId, maxQuestions);
        
        if (inviteData && inviteData.id) {
            console.log('✅ Приглашение успешно отправлено, ID:', inviteData.id);
            const multiplayerMode = new MultiplayerNormalMode();
            window.currentGameMode = multiplayerMode;
            
            window.currentMultiplayerInviteId = inviteData.id;
            
            await multiplayerMode.startAsHost(friendId, maxQuestions);
        }
    } catch (error) {
        console.error('❌ Ошибка при приглашении:', error);
        alert('Ошибка: ' + error.message);
    }
}

// Глобальные функции для доступа из HTML
window.showScreen = showScreen;
window.showGameModes = showGameModes;
window.showDifficultySelection = showDifficultySelection;
window.startGameWithStartScreen = startGameWithStartScreen;
window.startGame = startGame;
window.skipQuestion = skipQuestion;
window.nextQuestion = nextQuestion;
window.endGame = endGame;
window.saveSettings = saveSettings;
window.resetProgress = resetProgress;
window.searchAnime = searchAnime;
window.filterAnime = filterAnime;
window.showAnimeDetails = showAnimeDetails;
window.closeAnimeModal = closeAnimeModal;
window.playAnimeMusic = playAnimeMusic;
window.stopAnimeMusic = stopAnimeMusic;
window.reloadDatabase = reloadDatabase;
window.forceStopTimer = forceStopTimer;
window.playGameMusic = playGameMusic;
window.pauseGameMusic = pauseGameMusic;
window.stopGameMusic = stopGameMusic;
window.getRandomAnime = getRandomAnime;
window.shuffleArray = shuffleArray;
window.getAnimeById = getAnimeById;
window.isDatabaseLoaded = isDatabaseLoaded;
window.startMusicForQuestion = startMusicForQuestion;
window.updateGameVolume = updateGameVolume;
window.loadUserData = loadUserData;
window.updateMainScreenStats = updateMainScreenStats;
window.setupHeaderButtons = setupHeaderButtons;
window.showMultiplayerScreen = showMultiplayerScreen;
window.showMultiplayerSettingsScreen = showMultiplayerSettingsScreen;
window.proceedToMultiplayerFriends = proceedToMultiplayerFriends;
window.showMultiplayerNormalSettings = showMultiplayerNormalSettings;
window.proceedToMultiplayerNormalFriends = proceedToMultiplayerNormalFriends;
window.showMultiplayerNormalScreen = showMultiplayerNormalScreen;
window.inviteFriendToMultiplayer = inviteFriendToMultiplayer;
window.inviteFriendToMultiplayerNormal = inviteFriendToMultiplayerNormal;
window.markPlayerReady = function() {
    console.log('🔵 markPlayerReady вызвана');
    console.log('window.currentGameMode:', window.currentGameMode);
    
    if (!window.currentGameMode) {
        console.error('❌ window.currentGameMode не инициализирован!');
        return;
    }
    
    if (typeof window.currentGameMode.markPlayerReady !== 'function') {
        console.error('❌ markPlayerReady не является функцией в currentGameMode');
        console.error('Доступные методы:', Object.keys(window.currentGameMode));
        return;
    }
    
    window.currentGameMode.markPlayerReady();
    console.log('✅ markPlayerReady выполнена');
};

// Функция для получения статуса подключения к Supabase
window.testSupabaseConnection = testSupabaseConnection;

// Функция для получения всех пользователей (для тестирования)
window.getAllUsers = async function() {
    if (!window.authManager || !window.authManager.supabase) {
        console.error('❌ Supabase не инициализирован');
        return;
    }
    
    try {
        const { data, error } = await window.authManager.supabase
            .from('users')
            .select('id, username, email, password_hash');
        
        if (error) {
            console.error('❌ Ошибка получения пользователей:', error);
            return;
        }
        
        console.log('📊 Все пользователи в БД:', data);
        return data;
    } catch (error) {
        console.error('❌ Ошибка:', error);
    }
};

// Функция для быстрого тестирования логина
window.testLogin = async function(username, password) {
    if (!window.authManager) {
        console.error('❌ authManager не инициализирован');
        return;
    }
    
    try {
        console.log('🔐 Попытка логина с', username);
        const result = await window.authManager.login(username, password);
        console.log('✅ Результат логина:', result);
        
        if (result.success) {
            await window.loadUserData();
            window.updateMainScreenStats();
            window.showScreen('main-screen');
            console.log('✅ Экран обновлен после логина');
        }
    } catch (error) {
        console.error('❌ Ошибка логина:', error.message);
    }
};

console.log('✅ Script.js loaded successfully');