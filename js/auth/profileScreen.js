console.log('🔐 profileScreen.js loading...');

class ProfileScreen {
    constructor() {
        this.profileContainer = null;
        this.statsContainer = null;
        this.achievementsContainer = null;
    }

    init() {
        this.profileContainer = document.getElementById('profile-container');
        this.statsContainer = document.getElementById('profile-stats');
        this.achievementsContainer = document.getElementById('profile-achievements');

        // Кнопка "Назад"
        const backButton = document.querySelector('#profile-screen .back-btn');
        if (backButton) {
            backButton.addEventListener('click', () => {
                if (window.showScreen) {
                    window.showScreen('main-screen');
                }
            });
        }

        // Кнопка "Достижения"
        const achievementsBtn = document.getElementById('achievements-btn');
        if (achievementsBtn) {
            achievementsBtn.addEventListener('click', () => {
                this.showAchievementsModal();
            });
        }

        // Кнопка закрытия модалки достижений
        const achievementsModalClose = document.getElementById('achievements-modal-close');
        if (achievementsModalClose) {
            achievementsModalClose.addEventListener('click', () => {
                this.closeAchievementsModal();
            });
        }

        // Закрытие модалки при клике на фон
        const modal = document.getElementById('achievements-modal');
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    this.closeAchievementsModal();
                }
            });
        }

        // Кнопка "Выйти"
        const logoutButton = document.getElementById('logout-button');
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                if (window.authManager) {
                    window.authManager.logout();
                    
                    // Сбрасываем данные игрока
                    if (window.playerStats) {
                        window.playerStats = {
                            level: 1,
                            xp: 0,
                            gamesPlayed: 0,
                            correctAnswers: 0,
                            totalAnswers: 0,
                            achievements: []
                        };
                    }
                    
                    // Очищаем сессию
                    localStorage.removeItem('animeQuizStats');
                    
                    console.log('✅ Выход из аккаунта');
                    
                    if (window.updateMainScreenStats) {
                        window.updateMainScreenStats();
                    }
                    
                    if (window.showScreen) {
                        window.showScreen('login-screen');
                    }
                }
            });
        }

        // Обновляем данные при показе экрана
        this.updateProfileData();

        // Инициализируем менеджер друзей
        if (window.friendsManager && window.friendsManager.init) {
            window.friendsManager.init();
        }
    }

    updateProfileData() {
        const user = window.authManager.getCurrentUser();
        
        if (!user) {
            this.showNotLoggedIn();
            return;
        }

        this.showUserProfile(user);
        this.updateStats();
        this.updateAchievements();
    }

    showUserProfile(user) {
        if (!this.profileContainer) return;

        const avatarImage = user.avatar_url ? `<img src="${user.avatar_url}" alt="Аватар" class="user-avatar-image">` : 
                           `<div class="user-avatar-large">${user.username.charAt(0).toUpperCase()}</div>`;

        this.profileContainer.innerHTML = `
            <div class="profile-header">
                <div class="user-avatar-container">
                    ${avatarImage}
                    <label for="avatar-upload" class="avatar-upload-btn" title="Загрузить аватар">
                        📷
                    </label>
                    <input 
                        type="file" 
                        id="avatar-upload" 
                        accept="image/*" 
                        style="display: none;"
                    >
                </div>
                <div class="user-info">
                    <h3>${user.username}</h3>
                    <p>${user.email}</p>
                    <p class="join-date">Зарегистрирован: ${new Date(user.created_at).toLocaleDateString('ru-RU')}</p>
                </div>
            </div>
        `;

        // Добавляем обработчик загрузки аватара
        const avatarInput = document.getElementById('avatar-upload');
        if (avatarInput) {
            avatarInput.addEventListener('change', (e) => this.handleAvatarUpload(e, user));
        }
    }

    updateStats() {
        const stats = window.authManager.getUserStats();
        
        if (!stats || !this.statsContainer) return;

        const accuracy = stats.totalAnswers > 0 ? 
            Math.round((stats.correctAnswers / stats.totalAnswers) * 100) : 0;

        this.statsContainer.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <h3>Уровень</h3>
                    <span class="stat-value">${stats.level}</span>
                </div>
                <div class="stat-card">
                    <h3>Опыт</h3>
                    <span class="stat-value">${stats.xp}/${stats.level * 100}</span>
                </div>
                <div class="stat-card">
                    <h3>Игр сыграно</h3>
                    <span class="stat-value">${stats.gamesPlayed}</span>
                </div>
                <div class="stat-card">
                    <h3>Точность</h3>
                    <span class="stat-value">${accuracy}%</span>
                </div>
                <div class="stat-card">
                    <h3>Правильных ответов</h3>
                    <span class="stat-value">${stats.correctAnswers}</span>
                </div>
                <div class="stat-card">
                    <h3>Всего ответов</h3>
                    <span class="stat-value">${stats.totalAnswers}</span>
                </div>
            </div>
        `;
    }

    updateAchievements() {
        // Метод больше не используется - достижения отображаются в модалке
    }

    showAchievementsModal() {
        const stats = window.authManager.getUserStats();
        const modal = document.getElementById('achievements-modal');
        const grid = document.getElementById('achievements-modal-grid');
        const statsDiv = document.getElementById('achievements-stats');

        if (!modal || !grid) return;

        const allAchievements = [
            // Достижения по количеству игр
            { id: 'first_game', name: 'Первый шаг', description: 'Сыграйте свою первую игру', icon: '🎮' },
            { id: 'ten_games', name: 'Ветеран', description: 'Сыграйте 10 игр', icon: '🎖️' },
            { id: 'fifty_games', name: 'Опытный игрок', description: 'Сыграйте 50 игр', icon: '⭐' },
            { id: 'hundred_games', name: 'Маньяк квизов', description: 'Сыграйте 100 игр', icon: '🔥' },
            { id: 'five_hundred_games', name: 'Легенда', description: 'Сыграйте 500 игр', icon: '👑' },

            // Достижения по точности
            { id: 'perfect_round', name: 'Идеальный раунд', description: 'Ответьте правильно на 10 вопросов подряд', icon: '💯' },
            { id: 'ninety_percent', name: 'Мастер', description: 'Достигните 90% точности в игре', icon: '🎯' },
            { id: 'hundred_percent', name: 'Совершенство', description: 'Достигните 100% точности в игре', icon: '✨' },

            // Достижения по очкам
            { id: 'thousand_points', name: 'Высокий счёт', description: 'Наберите 1000 очков в одной игре', icon: '💫' },
            { id: 'five_thousand', name: 'Чемпион', description: 'Наберите 5000 очков в одной игре', icon: '🏆' },
            { id: 'ten_thousand', name: 'Король', description: 'Наберите 10000 очков в одной игре', icon: '👑' },

            // Достижения по правильным ответам
            { id: 'ten_correct', name: 'Начинающий', description: 'Дайте 10 правильных ответов', icon: '📚' },
            { id: 'fifty_correct', name: 'Эксперт', description: 'Дайте 50 правильных ответов', icon: '🧠' },
            { id: 'hundred_correct', name: 'Гений', description: 'Дайте 100 правильных ответов', icon: '🚀' },
            { id: 'thousand_correct', name: 'Мудрец', description: 'Дайте 1000 правильных ответов', icon: '🌟' },

            // Достижения по уровню
            { id: 'level_five', name: 'Начинающий', description: 'Достигните уровня 5', icon: '📈' },
            { id: 'level_ten', name: 'Продвинутый', description: 'Достигните уровня 10', icon: '📊' },
            { id: 'level_twenty', name: 'Профессионал', description: 'Достигните уровня 20', icon: '💼' },
            { id: 'level_fifty', name: 'Титан', description: 'Достигните уровня 50', icon: '🗻' },

            // Достижения по режимам
            { id: 'infinite_master', name: 'Бесконечный', description: 'Сыграйте 10 игр в бесконечном режиме', icon: '♾️' },
            { id: 'timed_warrior', name: 'Спидран', description: 'Сыграйте 10 игр в режиме на время', icon: '⏱️' },
            { id: 'lives_survivor', name: 'Выживший', description: 'Сыграйте 10 игр в режиме с жизнями', icon: '❤️' },
            { id: 'marathon_hero', name: 'Марафонец', description: 'Сыграйте 10 игр в режиме марафон', icon: '🏃' },

            // Достижения за серии
            { id: 'five_streak', name: 'Пожар!', description: 'Получите серию из 5 правильных ответов', icon: '🔥' },
            { id: 'ten_streak', name: 'Невероятно!', description: 'Получите серию из 10 правильных ответов', icon: '⚡' },
            { id: 'twenty_streak', name: 'Сверхчеловек', description: 'Получите серию из 20 правильных ответов', icon: '💥' },

            // Достижения за анимэ
            { id: 'know_five_anime', name: 'Поклонник анимэ', description: 'Узнайте 5 различных аниме', icon: '🎨' },
            { id: 'know_twenty_anime', name: 'Любитель анимэ', description: 'Узнайте 20 различных аниме', icon: '🎬' },
            { id: 'know_fifty_anime', name: 'Историк анимэ', description: 'Узнайте 50 различных аниме', icon: '📺' },
            { id: 'know_hundred_anime', name: 'Энциклопедия', description: 'Узнайте 100 различных аниме', icon: '📖' },

            // Специальные достижения
            { id: 'early_bird', name: 'Ранняя птица', description: 'Сыграйте в 6 утра', icon: '🌅' },
            { id: 'night_owl', name: 'Сова', description: 'Сыграйте в 3 ночи', icon: '🦉' },
            { id: 'lucky_seven', name: 'Счастливое число', description: 'Получите ровно 7 баллов', icon: '7️⃣' },
            { id: 'comeback_king', name: 'Король комбэков', description: 'Выиграйте после 3 ошибок подряд', icon: '🔄' },
            { id: 'speed_demon', name: 'Демон скорости', description: 'Ответьте за 2 секунды', icon: '💨' },

            // Социальные достижения
            { id: 'top_ten', name: 'Топ-10', description: 'Попадите в топ-10 лучших игроков', icon: '🥇' },
            { id: 'top_five', name: 'Топ-5', description: 'Попадите в топ-5 лучших игроков', icon: '🥈' },
            { id: 'first_place', name: 'Первое место', description: 'Станьте лучшим игроком', icon: '🥇' },

            // Достижения за активность
            { id: 'daily_player', name: 'Регулярный игрок', description: 'Играйте 7 дней подряд', icon: '📅' },
            { id: 'weekend_warrior', name: 'Боец выходного', description: 'Сыграйте 10 игр за выходной', icon: '⚔️' },
            { id: 'all_nighter', name: 'Ночной боец', description: 'Играйте более 5 часов подряд', icon: '🌙' },

            // Остальные достижения до 50
            { id: 'ace_player', name: 'Ас', description: 'Выигрывайте 10 игр подряд', icon: '🎯' },
            { id: 'unstoppable', name: 'Неостановимый', description: 'Выигрывайте 25 игр подряд', icon: '⚡' },
            { id: 'collector', name: 'Коллекционер', description: 'Разблокируйте 25 достижений', icon: '🎁' },
            { id: 'completionist', name: 'Завершитель', description: 'Разблокируйте все достижения', icon: '🏅' }
        ];

        // Подсчитываем разблокированные достижения
        const unlockedCount = stats && stats.achievements ? stats.achievements.length : 0;
        const totalCount = allAchievements.length;
        const percentage = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

        // Показываем статистику
        if (statsDiv) {
            statsDiv.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div>
                        <strong>Разблокировано: ${unlockedCount} из ${totalCount}</strong>
                    </div>
                    <div style="font-size: 18px; font-weight: bold; color: #10b981;">
                        ${percentage}%
                    </div>
                </div>
                <div style="width: 100%; height: 8px; background: rgba(124, 58, 237, 0.2); border-radius: 4px; margin-top: 8px; overflow: hidden;">
                    <div style="height: 100%; background: linear-gradient(90deg, #10b981, #34d399); width: ${percentage}%; border-radius: 4px; transition: width 0.3s ease;"></div>
                </div>
            `;
        }

        grid.innerHTML = '';

        // Сортируем достижения: разблокированные в начало
        const sortedAchievements = allAchievements.sort((a, b) => {
            const aUnlocked = stats && stats.achievements && stats.achievements.includes(a.id) ? 1 : 0;
            const bUnlocked = stats && stats.achievements && stats.achievements.includes(b.id) ? 1 : 0;
            return bUnlocked - aUnlocked; // Разблокированные первыми (1 > 0)
        });

        sortedAchievements.forEach((achievement, index) => {
            const isUnlocked = stats && stats.achievements && stats.achievements.includes(achievement.id);
            const achievementElement = document.createElement('div');
            achievementElement.className = isUnlocked ? 'achievement unlocked' : 'achievement locked';
            achievementElement.style.animationDelay = `${index * 30}ms`;
            achievementElement.title = `${achievement.name}: ${achievement.description}`;
            achievementElement.innerHTML = `
                <div class="achievement-icon">
                    ${isUnlocked ? achievement.icon : '🔒'}
                </div>
                <div class="achievement-content">
                    <strong>${achievement.name}</strong>
                    <small>${achievement.description}</small>
                </div>
            `;
            grid.appendChild(achievementElement);
        });

        modal.style.display = 'flex';
    }

    closeAchievementsModal() {
        const modal = document.getElementById('achievements-modal');
        if (modal) {
            modal.style.display = 'none';
        }
    }

    async handleAvatarUpload(event, user) {
        const file = event.target.files[0];
        if (!file) return;

        // Проверяем размер файла (максимум 5MB)
        const maxSize = 5 * 1024 * 1024;
        if (file.size > maxSize) {
            alert('Размер файла не должен превышать 5MB');
            return;
        }

        // Проверяем тип файла
        if (!file.type.startsWith('image/')) {
            alert('Пожалуйста, выберите изображение');
            return;
        }

        // Показываем редактор фотографии
        this.showImageEditor(file, user);
    }

    showImageEditor(file, user) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const imageData = e.target.result;

            // Создаем модальное окно редактора
            const modal = document.createElement('div');
            modal.id = 'image-editor-modal';
            modal.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.95);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 2000;
                animation: fadeIn 0.3s ease-in-out;
            `;

            modal.innerHTML = `
                <div style="
                    background: linear-gradient(135deg, #0f0f0f 0%, #1a0b2e 100%);
                    border-radius: 20px;
                    border: 2px solid #7c3aed;
                    max-width: 90%;
                    width: 600px;
                    max-height: 90vh;
                    overflow-y: auto;
                    box-shadow: 0 20px 60px rgba(124, 58, 237, 0.4);
                    padding: 30px;
                    animation: modalSlideUp 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
                ">
                    <h2 style="color: #e9d5ff; margin-top: 0; margin-bottom: 20px;">✏️ Редактирование аватара</h2>

                    <div style="
                        background: rgba(0, 0, 0, 0.5);
                        border-radius: 15px;
                        padding: 20px;
                        margin-bottom: 20px;
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        max-height: 600px;
                        overflow: auto;
                    ">
                        <canvas id="image-editor-canvas" style="
                            border-radius: 10px;
                        "></canvas>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; color: #c4b5fd; margin-bottom: 10px; font-weight: 600;">
                            🔄 Поворот и отражение
                        </label>
                        <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px;">
                            <button id="rotate-left-btn" style="
                                background: linear-gradient(135deg, #7c3aed, #8b5cf6);
                                color: white;
                                border: none;
                                padding: 12px 20px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: 600;
                                transition: all 0.3s ease;
                            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                ↺ Влево
                            </button>
                            <button id="rotate-right-btn" style="
                                background: linear-gradient(135deg, #7c3aed, #8b5cf6);
                                color: white;
                                border: none;
                                padding: 12px 20px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: 600;
                                transition: all 0.3s ease;
                            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                ↻ Вправо
                            </button>
                            <button id="flip-horizontal-btn" style="
                                background: linear-gradient(135deg, #7c3aed, #8b5cf6);
                                color: white;
                                border: none;
                                padding: 12px 20px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: 600;
                                transition: all 0.3s ease;
                            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                ↔️ Отразить Г
                            </button>
                            <button id="flip-vertical-btn" style="
                                background: linear-gradient(135deg, #7c3aed, #8b5cf6);
                                color: white;
                                border: none;
                                padding: 12px 20px;
                                border-radius: 8px;
                                cursor: pointer;
                                font-weight: 600;
                                transition: all 0.3s ease;
                            " onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'">
                                ↕️ Отразить В
                            </button>
                        </div>
                    </div>

                    <div style="margin-bottom: 20px;">
                        <label style="display: block; color: #c4b5fd; margin-bottom: 10px; font-weight: 600;">
                            ✂️ Обрезка
                        </label>
                        <p style="color: #a78bfa; font-size: 14px; margin: 0;">
                            Выберите квадратную область на изображении, перетаскивая рамку
                        </p>
                    </div>

                    <div style="
                        display: flex;
                        gap: 10px;
                    ">
                        <button id="cancel-edit-btn" style="
                            background: transparent;
                            color: #c4b5fd;
                            border: 2px solid #7c3aed;
                            padding: 14px 24px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: 600;
                            flex: 1;
                            transition: all 0.3s ease;
                        " onmouseover="this.style.background='rgba(124, 58, 237, 0.1)'" onmouseout="this.style.background='transparent'">
                            ✕ Отмена
                        </button>
                        <button id="save-edit-btn" style="
                            background: linear-gradient(135deg, #7c3aed, #8b5cf6);
                            color: white;
                            border: none;
                            padding: 14px 24px;
                            border-radius: 8px;
                            cursor: pointer;
                            font-weight: 600;
                            flex: 1;
                            transition: all 0.3s ease;
                        " onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 10px 25px rgba(124, 58, 237, 0.5)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                            ✓ Загрузить
                        </button>
                    </div>
                </div>
            `;

            document.body.appendChild(modal);

            // Инициализируем редактор
            const editor = new ImageEditor(imageData, modal, user, this);
            editor.init();
        };
        reader.readAsDataURL(file);
    }

    showNotLoggedIn() {
        if (this.profileContainer) {
            this.profileContainer.innerHTML = `
                <div class="not-logged-in">
                    <h3>Вы не вошли в систему</h3>
                    <p>Войдите или зарегистрируйтесь, чтобы увидеть свой профиль</p>
                    <button class="btn" onclick="showScreen('login-screen')">
                        Войти
                    </button>
                    <button class="btn secondary-btn" onclick="showScreen('register-screen')">
                        Зарегистрироваться
                    </button>
                </div>
            `;
        }
    }
}

// Создаем глобальный экземпляр
window.profileScreen = new ProfileScreen();

// Класс для редактирования изображений
class ImageEditor {
    constructor(imageData, modal, user, profileScreen) {
        this.imageData = imageData;
        this.modal = modal;
        this.user = user;
        this.profileScreen = profileScreen;
        this.canvas = modal.querySelector('#image-editor-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.rotation = 0;
        this.flipH = false;
        this.flipV = false;
        this.cropX = 0;
        this.cropY = 0;
        this.cropSize = 200; // Default square crop size
        this.img = new Image();
        this.isDragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.isCropping = true; // Start with cropping overlay enabled
        this.isResizing = false;
        this.resizeHandle = null;
        this.minCropSize = 50;
    }

    init() {
        this.img.onload = () => {
            const container = this.canvas.parentElement;
            const containerWidth = container.clientWidth - 40; // account for padding
            const containerHeight = 600 - 40; // max-height minus padding

            // Calculate scale to fit container while maintaining aspect ratio
            this.scale = Math.min(containerWidth / this.img.width, containerHeight / this.img.height, 1);
            this.canvas.width = this.img.width * this.scale;
            this.canvas.height = this.img.height * this.scale;

            this.updateCrop();
            this.redraw();
            this.attachEventListeners();
        };
        this.img.src = this.imageData;
    }

    updateCrop() {
        // Set initial crop size and position to center of image
        this.cropSize = Math.min(this.canvas.width, this.canvas.height, 200);
        this.cropX = Math.max(0, (this.canvas.width - this.cropSize) / 2);
        this.cropY = Math.max(0, (this.canvas.height - this.cropSize) / 2);
    }

    redraw() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.save();

        // Apply rotation and flip
        this.ctx.translate(this.canvas.width / 2, this.canvas.height / 2);
        this.ctx.rotate((this.rotation * Math.PI) / 180);
        this.ctx.scale(this.flipH ? -1 : 1, this.flipV ? -1 : 1);
        this.ctx.translate(-this.canvas.width / 2, -this.canvas.height / 2);

        // Draw the full image
        this.ctx.drawImage(this.img, 0, 0, this.canvas.width, this.canvas.height);

        this.ctx.restore();

        // Draw crop overlay only if cropping is enabled
        if (this.isCropping) {
            this.drawCropOverlay();
        }
    }

    drawCropOverlay() {
        // Semi-transparent overlay
        this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Clear the crop area
        this.ctx.globalCompositeOperation = 'destination-out';
        this.ctx.fillRect(this.cropX, this.cropY, this.cropSize, this.cropSize);
        this.ctx.globalCompositeOperation = 'source-over';

        // Draw crop border
        this.ctx.strokeStyle = '#7c3aed';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(this.cropX, this.cropY, this.cropSize, this.cropSize);

        // Draw corner handles
        this.ctx.fillStyle = '#7c3aed';
        const handleSize = 8;
        const corners = [
            [this.cropX, this.cropY],
            [this.cropX + this.cropSize - handleSize, this.cropY],
            [this.cropX, this.cropY + this.cropSize - handleSize],
            [this.cropX + this.cropSize - handleSize, this.cropY + this.cropSize - handleSize]
        ];
        corners.forEach(([x, y]) => {
            this.ctx.fillRect(x, y, handleSize, handleSize);
        });
    }

    attachEventListeners() {
        const container = this.canvas.parentElement;

        // Кнопки поворота
        const rotateLeftBtn = this.modal.querySelector('#rotate-left-btn');
        const rotateRightBtn = this.modal.querySelector('#rotate-right-btn');
        rotateLeftBtn.addEventListener('click', () => {
            this.rotation -= 90;
            if (this.rotation < 0) this.rotation += 360;
            this.redraw();
        });
        rotateRightBtn.addEventListener('click', () => {
            this.rotation += 90;
            if (this.rotation >= 360) this.rotation -= 360;
            this.redraw();
        });

        // Кнопки отражения
        const flipHorizontalBtn = this.modal.querySelector('#flip-horizontal-btn');
        const flipVerticalBtn = this.modal.querySelector('#flip-vertical-btn');
        flipHorizontalBtn.addEventListener('click', () => {
            this.flipH = !this.flipH;
            this.redraw();
        });
        flipVerticalBtn.addEventListener('click', () => {
            this.flipV = !this.flipV;
            this.redraw();
        });

        // Mouse events for dragging crop area
        this.canvas.addEventListener('mousedown', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left + container.scrollLeft;
            const y = e.clientY - rect.top + container.scrollTop;

            // Check for resize handles first
            const handleSize = 8;
            const corners = [
                { x: this.cropX, y: this.cropY, handle: 'top-left' },
                { x: this.cropX + this.cropSize - handleSize, y: this.cropY, handle: 'top-right' },
                { x: this.cropX, y: this.cropY + this.cropSize - handleSize, handle: 'bottom-left' },
                { x: this.cropX + this.cropSize - handleSize, y: this.cropY + this.cropSize - handleSize, handle: 'bottom-right' }
            ];

            for (const corner of corners) {
                if (x >= corner.x && x <= corner.x + handleSize &&
                    y >= corner.y && y <= corner.y + handleSize) {
                    this.isResizing = true;
                    this.resizeHandle = corner.handle;
                    this.dragOffsetX = x;
                    this.dragOffsetY = y;
                    e.preventDefault();
                    return;
                }
            }

            // Check for dragging the crop area
            if (x >= this.cropX && x <= this.cropX + this.cropSize &&
                y >= this.cropY && y <= this.cropY + this.cropSize) {
                this.isDragging = true;
                this.dragOffsetX = x - this.cropX;
                this.dragOffsetY = y - this.cropY;
                e.preventDefault();
            }
        });

        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left + container.scrollLeft;
            const y = e.clientY - rect.top + container.scrollTop;

            if (this.isResizing) {
                const deltaX = x - this.dragOffsetX;
                const deltaY = y - this.dragOffsetY;

                switch (this.resizeHandle) {
                    case 'top-left':
                        this.cropX = Math.max(0, Math.min(this.cropX + deltaX, this.cropX + this.cropSize - this.minCropSize));
                        this.cropY = Math.max(0, Math.min(this.cropY + deltaY, this.cropY + this.cropSize - this.minCropSize));
                        this.cropSize -= deltaX;
                        this.cropSize -= deltaY;
                        break;
                    case 'top-right':
                        this.cropY = Math.max(0, Math.min(this.cropY + deltaY, this.cropY + this.cropSize - this.minCropSize));
                        this.cropSize += deltaX;
                        this.cropSize -= deltaY;
                        break;
                    case 'bottom-left':
                        this.cropX = Math.max(0, Math.min(this.cropX + deltaX, this.cropX + this.cropSize - this.minCropSize));
                        this.cropSize -= deltaX;
                        this.cropSize += deltaY;
                        break;
                    case 'bottom-right':
                        this.cropSize += deltaX;
                        this.cropSize += deltaY;
                        break;
                }

                // Ensure crop size stays within bounds
                this.cropSize = Math.max(this.minCropSize, Math.min(this.cropSize, this.canvas.width - this.cropX, this.canvas.height - this.cropY));
                this.dragOffsetX = x;
                this.dragOffsetY = y;
                this.redraw();
                e.preventDefault();
            } else if (this.isDragging) {
                this.cropX = Math.max(0, Math.min(x - this.dragOffsetX, this.canvas.width - this.cropSize));
                this.cropY = Math.max(0, Math.min(y - this.dragOffsetY, this.canvas.height - this.cropSize));
                this.redraw();
                e.preventDefault();
            }
        });

        this.canvas.addEventListener('mouseup', () => {
            this.isDragging = false;
            this.isResizing = false;
            this.resizeHandle = null;
        });

        this.canvas.addEventListener('mouseleave', () => {
            this.isDragging = false;
            this.isResizing = false;
            this.resizeHandle = null;
        });

        // Кнопка отмены
        const cancelBtn = this.modal.querySelector('#cancel-edit-btn');
        cancelBtn.addEventListener('click', () => {
            this.modal.remove();
        });

        // Кнопка сохранения
        const saveBtn = this.modal.querySelector('#save-edit-btn');
        saveBtn.addEventListener('click', async () => {
            await this.uploadImage();
        });
    }

    async uploadImage() {
        // Create a new canvas for the cropped image
        const croppedCanvas = document.createElement('canvas');
        const croppedCtx = croppedCanvas.getContext('2d');
        croppedCanvas.width = this.cropSize;
        croppedCanvas.height = this.cropSize;

        // Apply transformations and draw cropped portion
        croppedCtx.save();
        croppedCtx.translate(this.cropSize / 2, this.cropSize / 2);
        croppedCtx.rotate((this.rotation * Math.PI) / 180);
        croppedCtx.scale(this.flipH ? -1 : 1, this.flipV ? -1 : 1);
        croppedCtx.translate(-this.cropSize / 2, -this.cropSize / 2);

        // Calculate the source rectangle from the original image
        const scaleX = this.img.width / this.canvas.width;
        const scaleY = this.img.height / this.canvas.height;
        const sourceX = this.cropX * scaleX;
        const sourceY = this.cropY * scaleY;
        const sourceW = this.cropSize * scaleX;
        const sourceH = this.cropSize * scaleY;

        croppedCtx.drawImage(
            this.img,
            sourceX, sourceY, sourceW, sourceH,
            0, 0, this.cropSize, this.cropSize
        );
        croppedCtx.restore();

        // Конвертируем cropped canvas в blob
        croppedCanvas.toBlob(async (blob) => {
            const uploadBtn = document.querySelector('.avatar-upload-btn');
            if (uploadBtn) {
                uploadBtn.textContent = '⏳';
            }

            try {
                console.log('🔐 Начало процесса загрузки аватара');
                console.log('👤 Пользователь:', this.user);
                
                // Инициализируем Supabase клиент — предпочитаем уже инициализированный client из AuthManager
                let supabaseClient = null;
                if (window.authManager && window.authManager.supabase) {
                    supabaseClient = window.authManager.supabase;
                } else if (typeof window.supabase !== 'undefined' && window.supabase.createClient) {
                    supabaseClient = window.supabase.createClient(
                        'https://udigewfsgwiawjdechgv.supabase.co',
                        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkaWdld2ZzZ3dpYXdqZGVjaGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NDU5MTUsImV4cCI6MjA3OTMyMTkxNX0.wN5UL_dIxH004hcw5Je3Za_uFlC28_CfGwdUmWEM0Kc'
                    );
                }

                if (!supabaseClient) {
                    throw new Error('Supabase не инициализирован — убедитесь, что AuthManager инициализирован или добавьте client');
                }

                // Предварительная проверка bucket
                try {
                    const { data: listData, error: listError } = await supabaseClient.storage
                        .from('avatars')
                        .list('', { limit: 1 });

                    if (listError) {
                        if (String(listError.message).toLowerCase().includes('bucket not found')) {
                            throw new Error("Bucket 'avatars' не найден. Создайте bucket в Supabase Dashboard → Storage → Create new bucket с именем 'avatars' и сделайте его public.");
                        } else {
                            console.warn('Предупреждение при проверке bucket avatars:', listError);
                        }
                    }
                } catch (err) {
                    throw err;
                }

                // Генерируем уникальное имя файла
                const timestamp = Date.now();
                const randomStr = Math.random().toString(36).substring(7);
                const fileName = `${this.user.id}/${timestamp}-${randomStr}.jpg`;

                console.log('📤 Загрузка аватара на Supabase Storage:', fileName);

                // Загружаем файл в Supabase Storage
                const { data, error } = await supabaseClient.storage
                    .from('avatars')
                    .upload(fileName, blob, {
                        cacheControl: '3600',
                        upsert: false,
                        contentType: 'image/jpeg'
                    });

                if (error) {
                    console.error('❌ Ошибка загрузки файла:', error);
                    if (String(error.message).toLowerCase().includes('bucket not found')) {
                        throw new Error("Ошибка загрузки файла: bucket 'avatars' не найден. Перейдите в Supabase Dashboard → Storage → Create new bucket и создайте 'avatars' (public).");
                    }
                    throw new Error('Ошибка загрузки файла: ' + error.message);
                }

                console.log('✅ Файл загружен:', data);

                // Получаем публичную ссылку на файл
                const { data: publicUrlData } = supabaseClient.storage
                    .from('avatars')
                    .getPublicUrl(fileName);

                const avatarUrl = publicUrlData.publicUrl;
                console.log('🔗 Публичная ссылка:', avatarUrl);

                // Обновляем аватар в профиле пользователя в БД
                console.log('🔄 Попытка обновить БД для пользователя:', this.user.id);
                console.log('📝 Новый avatar_url:', avatarUrl);
                
                const { data: updateData, error: updateError } = await supabaseClient
                    .from('users')
                    .update({ avatar_url: avatarUrl })
                    .eq('id', this.user.id)
                    .select();

                console.log('📊 Результат обновления:');
                console.log('updateData:', updateData);
                console.log('updateError:', updateError);

                if (updateError) {
                    console.error('❌ Ошибка обновления профиля:', updateError);
                    console.error('📋 Детали ошибки:', {
                        message: updateError.message,
                        code: updateError.code,
                        details: updateError.details,
                        hint: updateError.hint
                    });
                    throw new Error('Ошибка сохранения в БД: ' + updateError.message);
                }

                console.log('✅ Профиль обновлен в БД');

                // Обновляем информацию пользователя в authManager
                if (window.authManager) {
                    window.authManager.updateUserAvatar(this.user.id, avatarUrl);
                }

                // Обновляем UI
                this.profileScreen.updateProfileData();
                
                if (uploadBtn) {
                    uploadBtn.textContent = '📷';
                }

                // Закрываем редактор
                this.modal.remove();

                alert('✅ Аватар успешно загружен!');

            } catch (error) {
                console.error('❌ Ошибка загрузки аватара:', error);
                alert('Ошибка при загрузке аватара: ' + error.message);
                if (uploadBtn) {
                    uploadBtn.textContent = '📷';
                }
            }
        }, 'image/jpeg', 0.95);
    }
}

// Инициализируем при загрузке
document.addEventListener('DOMContentLoaded', () => {
    console.log('📱 ProfileScreen: DOMContentLoaded');
    try {
        if (window.profileScreen && window.profileScreen.init) {
            window.profileScreen.init();
        }
    } catch (error) {
        console.error('❌ Ошибка инициализации ProfileScreen:', error);
    }
});

// Обновляем профиль при показе экрана
document.addEventListener('screenChange', (event) => {
    if (event.detail.screenName === 'profile-screen') {
        if (window.profileScreen && window.profileScreen.updateProfileData) {
            window.profileScreen.updateProfileData();
        }
    }
});

console.log('✅ profileScreen.js loaded successfully');