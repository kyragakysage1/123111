console.log('🏆 leaderboard.js loading...');

class LeaderboardScreen {
    constructor() {
        this.container = null;
        this.currentFilter = 'level';
        this.autoUpdateInterval = null;
        this.lastLeaderboardData = null; // Сохраняем последние данные для сравнения
        this.isInitialLoad = true; // Флаг для первоначальной загрузки
        this.isInitialized = false; // Флаг инициализации обработчиков
    }

    init() {
        console.log('🔄 LeaderboardScreen.init() called');
        
        // Ждём пока контейнер будет доступен
        this.container = document.getElementById('leaderboard-container');
        console.log('📍 Container found:', this.container ? 'yes' : 'no');

        // Инициализируем обработчики только один раз
        if (!this.isInitialized) {
            console.log('🔧 Инициализация обработчиков');
            
            // Кнопка "Назад" - ищем все back-btn в лидерборде
            const leaderboardScreen = document.getElementById('leaderboard-screen');
            console.log('📍 Leaderboard-screen found:', leaderboardScreen ? 'yes' : 'no');
            
            if (leaderboardScreen) {
                const backButtons = leaderboardScreen.querySelectorAll('.back-btn');
                console.log('🔍 Найдено кнопок "Назад":', backButtons.length);
                
                backButtons.forEach((backButton, index) => {
                    console.log(`⚙️ Добавляю обработчик на кнопку Назад #${index}`);
                    backButton.addEventListener('click', (e) => {
                        console.log('👆 Клик на кнопку Назад');
                        this.stopAutoUpdate(); // Остановить автообновление при выходе
                        if (window.showScreen) {
                            window.showScreen('main-screen');
                        }
                    });
                });
            }

            // Обработчики фильтров
            const filterButtons = document.querySelectorAll('#leaderboard-screen .filter-btn');
            console.log('🎯 Найдено фильтр-кнопок:', filterButtons.length);
            
            filterButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    filterButtons.forEach(b => b.classList.remove('active'));
                    e.target.classList.add('active');
                    this.currentFilter = e.target.getAttribute('data-filter');
                    console.log('🔄 Фильтр изменен на:', this.currentFilter);
                    this.isInitialLoad = true; // Сбрасываем флаг при смене фильтра
                    this.lastLeaderboardData = null; // Очищаем кэш при смене фильтра
                    this.loadLeaderboard();
                });
            });

            this.isInitialized = true;
            console.log('✅ LeaderboardScreen: Обработчики инициализированы');
        }

        console.log('📊 Загрузка лидеров...');
        this.loadLeaderboard();
        this.startAutoUpdate(); // Запускаем автообновление
    }

    async loadLeaderboard() {
        if (!this.container) return;

        // Показываем загрузку только при первоначальной загрузке
        if (this.isInitialLoad) {
            this.container.innerHTML = '<p style="text-align: center; color: #a78bfa;">⏳ Загрузка лидеров...</p>';
            console.log('🔄 LeaderboardScreen: Начало загрузки данных');
        }

        try {
            // Получаем данные пользователей из базы
            const users = await this.getAllUsersData();
            console.log('✅ LeaderboardScreen: Получено пользователей:', users.length);
            
            if (!users || users.length === 0) {
                console.warn('⚠️ LeaderboardScreen: Нет данных для отображения');
                if (this.isInitialLoad) {
                    this.container.innerHTML = '<p style="text-align: center; color: #a78bfa;">Нет данных для отображения</p>';
                }
                return;
            }
            
            // Сортируем в зависимости от выбранного фильтра
            const sortedUsers = this.sortUsers(users, this.currentFilter);
            
            // Сериализуем данные для сравнения
            const currentDataJSON = JSON.stringify(sortedUsers);
            
            // Проверяем, изменились ли данные
            if (this.lastLeaderboardData !== currentDataJSON || this.isInitialLoad) {
                this.lastLeaderboardData = currentDataJSON;
                this.displayLeaderboard(sortedUsers);
                this.isInitialLoad = false;
                console.log('📊 LeaderboardScreen: Данные обновлены');
            } else {
                console.log('✅ LeaderboardScreen: Изменений не найдено');
            }
        } catch (error) {
            console.error('❌ LeaderboardScreen: Ошибка при загрузке лидеров:', error);
            if (this.isInitialLoad) {
                this.container.innerHTML = '<p style="text-align: center; color: #ff4757;">Ошибка при загрузке данных</p>';
            }
        }
    }

    // Запустить автообновление каждые 2 секунды
    startAutoUpdate() {
        console.log('🔄 LeaderboardScreen: Запуск автообновления');
        
        // Очищаем предыдущий интервал если он есть
        if (this.autoUpdateInterval) {
            clearInterval(this.autoUpdateInterval);
        }

        // Обновляем каждые 2 секунды
        this.autoUpdateInterval = setInterval(async () => {
            if (this.container && document.getElementById('leaderboard-screen').classList.contains('active')) {
                await this.loadLeaderboard();
            }
        }, 2000);
    }

    // Остановить автообновление
    stopAutoUpdate() {
        if (this.autoUpdateInterval) {
            clearInterval(this.autoUpdateInterval);
            this.autoUpdateInterval = null;
            console.log('⏹️ LeaderboardScreen: Автообновление остановлено');
        }
    }

    async getAllUsersData() {
        console.log('🔄 getAllUsersData() started');
        const users = [];
        
        // Проверяем авторизацию
        if (!window.authManager) {
            console.warn('⚠️ authManager not available');
            return users;
        }
        
        console.log('✅ authManager available');
        
        // Получаем текущего пользователя
        let currentUserId = null;
        if (window.authManager.isLoggedIn()) {
            const currentUser = window.authManager.getCurrentUser();
            const stats = window.authManager.getUserStats();
            
            console.log('👤 Current user:', currentUser?.username, 'Stats:', stats);
            
            if (currentUser && stats) {
                currentUserId = currentUser.id;
                users.push({
                    id: currentUser.id,
                    username: currentUser.username,
                    avatar_url: currentUser.avatar_url,
                    level: stats.level,
                    xp: stats.xp,
                    gamesPlayed: stats.gamesPlayed,
                    correctAnswers: stats.correctAnswers,
                    totalAnswers: stats.totalAnswers,
                    accuracy: stats.totalAnswers > 0 ? 
                        Math.round((stats.correctAnswers / stats.totalAnswers) * 100) : 0
                });
                console.log('✅ Текущий пользователь добавлен:', currentUser.username);
            }
        } else {
            console.warn('⚠️ User not logged in');
        }

        // Получаем Supabase клиент из AuthManager
        let supabaseClient = null;
        if (window.authManager && window.authManager.supabase) {
            supabaseClient = window.authManager.supabase;
            console.log('📦 Supabase клиент получен из authManager');
        } else {
            console.warn('⚠️ Supabase клиент не найден в authManager');
            return users;
        }

        // Загружаем всех пользователей из таблицы users
        try {
            console.log('🔄 Загрузка пользователей из Supabase...');
            
            const { data: allUsers, error } = await supabaseClient
                .from('users')
                .select('*')
                .limit(100);

            console.log('📊 Ответ от Supabase:');
            console.log('   - Ошибка:', error);
            console.log('   - Пользователей:', allUsers?.length || 0);
            console.log('   - Данные:', allUsers);

            if (error) {
                console.error('❌ Ошибка загрузки пользователей:', error);
                alert('Ошибка загрузки таблицы лидеров: ' + error.message);
                return users;
            }

            if (!allUsers || allUsers.length === 0) {
                console.warn('⚠️ Нет пользователей в БД или таблица пуста');
                return users;
            }

            console.log('✅ Загружено пользователей:', allUsers.length);

            // Добавляем каждого пользователя в список
            allUsers.forEach(user => {
                // Пропускаем текущего пользователя (он уже добавлен в начале)
                if (user.id === currentUserId) {
                    console.log('⏭️ Пропускаем текущего пользователя:', user.username);
                    return;
                }

                const userData = {
                    id: user.id,
                    username: user.username || 'Unknown',
                    avatar_url: user.avatar_url || null,
                    level: user.level || 1,
                    xp: user.xp || 0,
                    gamesPlayed: user.games_played || 0,
                    correctAnswers: user.correct_answers || 0,
                    totalAnswers: user.total_answers || 0,
                    accuracy: (user.total_answers || 0) > 0 ? 
                        Math.round((user.correct_answers / user.total_answers) * 100) : 0
                };

                users.push(userData);
                console.log('✅ Добавлен пользователь:', user.username, userData);
            });

        } catch (error) {
            console.error('❌ Ошибка при загрузке пользователей из Supabase:', error);
            alert('Ошибка при загрузке таблицы лидеров: ' + error.message);
        }

        console.log('📈 Всего пользователей в лидер борде:', users.length);
        return users;
    }

    sortUsers(users, filter) {
        const sorted = [...users];
        
        switch(filter) {
            case 'level':
                sorted.sort((a, b) => b.level - a.level);
                break;
            case 'xp':
                sorted.sort((a, b) => b.xp - a.xp);
                break;
            case 'games':
                sorted.sort((a, b) => b.gamesPlayed - a.gamesPlayed);
                break;
            case 'accuracy':
                sorted.sort((a, b) => b.accuracy - a.accuracy);
                break;
        }
        
        return sorted;
    }

    displayLeaderboard(users) {
        if (!this.container) return;

        console.log('🏆 Отображение лидер борда. Пользователей:', users.length);

        this.container.innerHTML = '';

        if (users.length === 0) {
            this.container.innerHTML = '<p style="text-align: center; color: #a78bfa;">Нет данных для отображения</p>';
            return;
        }

        users.forEach((user, index) => {
            const rank = index + 1;
            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : '';
            
            let statValue = '';
            let statLabel = '';
            
            switch(this.currentFilter) {
                case 'level':
                    statValue = user.level;
                    statLabel = 'Уровень';
                    break;
                case 'xp':
                    statValue = user.xp;
                    statLabel = 'Опыт';
                    break;
                case 'games':
                    statValue = user.gamesPlayed;
                    statLabel = 'Игр';
                    break;
                case 'accuracy':
                    statValue = user.accuracy + '%';
                    statLabel = 'Точность';
                    break;
            }

            const rankClass = rank <= 3 ? `top${rank}` : '';
            const avatar = user.avatar_url ? 
                `<img src="${user.avatar_url}" alt="Аватар" style="width: 30px; height: 30px; border-radius: 50%; object-fit: cover; margin-right: 10px;">` :
                '';

            const itemHTML = `
                <div class="leaderboard-item" style="cursor: pointer; transition: all 0.3s ease;" data-user-id="${user.id}" data-user-name="${user.username}" data-level="${user.level}" data-xp="${user.xp}" data-games="${user.gamesPlayed}" data-correct="${user.correctAnswers}" data-total="${user.totalAnswers}" data-accuracy="${user.accuracy}" data-avatar="${user.avatar_url || ''}">
                    <div class="leaderboard-rank ${rankClass}">
                        ${medal || rank}
                    </div>
                    <div class="leaderboard-user">
                        <div style="display: flex; align-items: center;">
                            ${avatar}
                            <div class="leaderboard-username">${user.username}</div>
                        </div>
                        <div class="leaderboard-info">
                            Уровень ${user.level} • ${user.gamesPlayed} игр • ${user.accuracy}%
                        </div>
                    </div>
                    <div class="leaderboard-value">
                        <div class="leaderboard-stat">${statValue}</div>
                        <div class="leaderboard-label">${statLabel}</div>
                    </div>
                </div>
            `;

            this.container.insertAdjacentHTML('beforeend', itemHTML);
        });

        // Добавляем обработчики клика к элементам лидеров
        const items = this.container.querySelectorAll('.leaderboard-item');
        items.forEach(item => {
            item.addEventListener('click', () => {
                const userId = item.getAttribute('data-user-id');
                const userName = item.getAttribute('data-user-name');
                const level = parseInt(item.getAttribute('data-level'));
                const xp = parseInt(item.getAttribute('data-xp'));
                const games = parseInt(item.getAttribute('data-games'));
                const correct = parseInt(item.getAttribute('data-correct'));
                const total = parseInt(item.getAttribute('data-total'));
                const accuracy = parseInt(item.getAttribute('data-accuracy'));
                const avatar = item.getAttribute('data-avatar');

                this.showUserProfile(userId, userName, level, xp, games, correct, total, accuracy, avatar);
            });
        });
    }

    // Показать профиль пользователя в модальном окне
    showUserProfile(userId, username, level, xp, gamesPlayed, correctAnswers, totalAnswers, accuracy, avatarUrl) {
        const accuracy_value = totalAnswers > 0 ? accuracy : 0;
        const xpNeeded = level * 100;
        
        const profileHTML = `
            <div id="user-profile-modal" style="position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0, 0, 0, 0.7); display: flex; align-items: center; justify-content: center; z-index: 10000;">
                <div style="background: linear-gradient(135deg, #1a0b2e 0%, #2d1b3d 100%); border: 1px solid #7c3aed; border-radius: 15px; padding: 30px; max-width: 400px; width: 90%; box-shadow: 0 0 30px rgba(124, 58, 237, 0.5);">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <div style="font-size: 60px; margin-bottom: 15px;">
                            ${avatarUrl ? `<img src="${avatarUrl}" alt="${username}" style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; border: 2px solid #7c3aed; cursor: pointer; transition: transform 0.3s ease, box-shadow 0.3s ease; box-shadow: 0 0 10px rgba(124, 58, 237, 0.5);" onmouseover="this.style.transform='scale(1.15)'; this.style.boxShadow='0 0 20px rgba(124, 58, 237, 0.8)';" onmouseout="this.style.transform='scale(1)'; this.style.boxShadow='0 0 10px rgba(124, 58, 237, 0.5)';" onclick="expandUserPhoto('${avatarUrl.replace(/'/g, "\\'")}')" title="Клик для увеличения">` : '<span style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); width: 80px; height: 80px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: 36px; margin: 0 auto;">' + username.charAt(0).toUpperCase() + '</span>'}
                        </div>
                        <h2 style="color: #c4b5fd; margin: 15px 0; word-break: break-word;">${username}</h2>
                    </div>

                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
                        <div style="background: rgba(124, 58, 237, 0.2); padding: 15px; border-radius: 10px; border-left: 3px solid #7c3aed;">
                            <div style="color: #a78bfa; font-size: 12px; margin-bottom: 5px;">УРОВЕНЬ</div>
                            <div style="color: #c4b5fd; font-size: 24px; font-weight: bold;">${level}</div>
                        </div>
                        <div style="background: rgba(124, 58, 237, 0.2); padding: 15px; border-radius: 10px; border-left: 3px solid #7c3aed;">
                            <div style="color: #a78bfa; font-size: 12px; margin-bottom: 5px;">ОПЫТ</div>
                            <div style="color: #c4b5fd; font-size: 24px; font-weight: bold;">${xp}</div>
                        </div>
                        <div style="background: rgba(124, 58, 237, 0.2); padding: 15px; border-radius: 10px; border-left: 3px solid #7c3aed;">
                            <div style="color: #a78bfa; font-size: 12px; margin-bottom: 5px;">ИГРЫ</div>
                            <div style="color: #c4b5fd; font-size: 24px; font-weight: bold;">${gamesPlayed}</div>
                        </div>
                        <div style="background: rgba(124, 58, 237, 0.2); padding: 15px; border-radius: 10px; border-left: 3px solid #7c3aed;">
                            <div style="color: #a78bfa; font-size: 12px; margin-bottom: 5px;">ТОЧНОСТЬ</div>
                            <div style="color: #c4b5fd; font-size: 24px; font-weight: bold;">${accuracy_value}%</div>
                        </div>
                    </div>

                    <div style="background: rgba(124, 58, 237, 0.1); padding: 15px; border-radius: 10px; margin: 20px 0;">
                        <div style="color: #a78bfa; font-size: 12px; margin-bottom: 5px;">ПРОГРЕСС</div>
                        <div style="display: flex; gap: 10px; align-items: center;">
                            <div style="flex: 1; height: 8px; background: rgba(124, 58, 237, 0.3); border-radius: 4px; overflow: hidden;">
                                <div style="width: ${(xp / xpNeeded) * 100}%; height: 100%; background: linear-gradient(90deg, #7c3aed, #a78bfa); transition: width 0.3s ease;"></div>
                            </div>
                            <div style="color: #a78bfa; font-size: 12px; white-space: nowrap;">${xp}/${xpNeeded}</div>
                        </div>
                    </div>

                    <div style="color: #a78bfa; font-size: 12px; text-align: center; margin: 15px 0; padding: 10px; background: rgba(124, 58, 237, 0.1); border-radius: 8px;">
                        ✅ ${correctAnswers} правильных из ${totalAnswers} ответов
                    </div>

                    <button onclick="document.getElementById('user-profile-modal').remove()" style="width: 100%; padding: 12px; background: linear-gradient(135deg, #7c3aed, #8b5cf6); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: bold; transition: all 0.3s ease;">
                        Закрыть
                    </button>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', profileHTML);
    }
}

// Создаем глобальный экземпляр
window.leaderboardScreen = new LeaderboardScreen();

// Инициализируем при загрузке
document.addEventListener('DOMContentLoaded', () => {
    if (window.leaderboardScreen) {
        window.leaderboardScreen.init();
    }
});

// Отслеживаем видимость экрана лидерборда
const observer = new MutationObserver(() => {
    const leaderboardScreen = document.getElementById('leaderboard-screen');
    if (leaderboardScreen) {
        const isActive = leaderboardScreen.classList.contains('active');
        if (isActive && window.leaderboardScreen && !window.leaderboardScreen.autoUpdateInterval) {
            // Экран стал активным — запускаем автообновление
            window.leaderboardScreen.startAutoUpdate();
        } else if (!isActive && window.leaderboardScreen) {
            // Экран деактивирован — останавливаем автообновление
            window.leaderboardScreen.stopAutoUpdate();
        }
    }
});

// Наблюдаем за изменениями в атрибуте class экранов
const screens = document.querySelectorAll('.screen');
screens.forEach(screen => {
    observer.observe(screen, { attributes: true, attributeFilter: ['class'] });
});

// Функция для увеличения фотографии пользователя
window.expandUserPhoto = function(photoUrl) {
    const expandedModal = document.createElement('div');
    expandedModal.id = 'expanded-photo-modal';
    expandedModal.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0, 0, 0, 0.95);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 10001;
    `;
    
    expandedModal.innerHTML = `
        <div style="position: relative; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;">
            <img src="${photoUrl}" alt="Увеличенная фотография" style="max-width: 90vw; max-height: 90vh; border-radius: 15px; object-fit: contain;">
            <button onclick="document.getElementById('expanded-photo-modal').remove()" style="position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: 60px; height: 60px; background: linear-gradient(135deg, #7c3aed, #8b5cf6); color: white; border: none; border-radius: 50%; cursor: pointer; font-size: 28px; transition: all 0.3s ease; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 15px rgba(124, 58, 237, 0.4);">
                ✕
            </button>
            <div onclick="document.getElementById('expanded-photo-modal').remove()" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; z-index: -1; cursor: pointer;"></div>
        </div>
    `;
    
    document.body.appendChild(expandedModal);
};

