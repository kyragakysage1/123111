console.log('🔐 uiComponents.js loading...');

class AuthUIComponents {
    constructor() {
        this.userCircle = null;
        this.usernameDisplay = null;
        this.authButtons = null;
        this.userButtons = null;
    }

    init() {
        this.userCircle = document.getElementById('user-circle');
        this.usernameDisplay = document.getElementById('username-display');
        this.authButtons = document.getElementById('auth-buttons');
        this.userButtons = document.getElementById('user-buttons');

        // Добавляем обработчики для кнопок авторизации
        this.addAuthButtonListeners();
        
        // Обновляем UI при изменении состояния авторизации
        this.updateUI();
    }

    addAuthButtonListeners() {
        // Кнопка "Войти" в хедере
        const loginButton = document.getElementById('header-login-btn');
        if (loginButton) {
            loginButton.addEventListener('click', () => {
                if (window.showScreen) {
                    window.showScreen('login-screen');
                }
            });
        }

        // Кнопка "Зарегистрироваться" в хедере
        const registerButton = document.getElementById('header-register-btn');
        if (registerButton) {
            registerButton.addEventListener('click', () => {
                if (window.showScreen) {
                    window.showScreen('register-screen');
                }
            });
        }

        // Кнопка "Профиль" в хедере
        const profileButton = document.getElementById('header-profile-btn');
        if (profileButton) {
            profileButton.addEventListener('click', () => {
                if (window.showScreen) {
                    window.showScreen('profile-screen');
                }
            });
        }

        // Кнопка "Выйти" в хедере
        const logoutButton = document.getElementById('header-logout-btn');
        if (logoutButton) {
            logoutButton.addEventListener('click', () => {
                window.authManager.logout();
                // Обновляем интерфейс после выхода
                if (window.updateMainScreenStats) {
                    window.updateMainScreenStats();
                }
            });
        }

        // Клик по кружку с ником
        if (this.userCircle) {
            this.userCircle.addEventListener('click', () => {
                if (window.showScreen) {
                    window.showScreen('profile-screen');
                }
            });
        }

        // Клик по имени пользователя
        if (this.usernameDisplay) {
            this.usernameDisplay.addEventListener('click', () => {
                if (window.showScreen) {
                    window.showScreen('profile-screen');
                }
            });
        }
    }

    updateUI() {
        const isLoggedIn = window.authManager && window.authManager.isLoggedIn();
        const user = window.authManager ? window.authManager.getCurrentUser() : null;
        const authHeader = document.getElementById('auth-header') || document.querySelector('.auth-header');

        if (isLoggedIn && user) {
            // Показываем информацию пользователя и хедер
            if (authHeader) authHeader.style.display = 'flex';
            if (this.userCircle) {
                // Показываем аватар если он есть, иначе букву
                if (user.avatar_url) {
                    this.userCircle.innerHTML = `<img src="${user.avatar_url}" alt="Аватар" style="width: 100%; height: 100%; border-radius: 50%; object-fit: cover;">`;
                } else {
                    this.userCircle.textContent = user.username.charAt(0).toUpperCase();
                }
                this.userCircle.style.display = 'flex';
                this.userCircle.title = `Профиль: ${user.username}`;
            }
            if (this.usernameDisplay) {
                this.usernameDisplay.textContent = user.username;
                this.usernameDisplay.style.display = 'block';
            }
            if (this.authButtons) this.authButtons.style.display = 'none';
            if (this.userButtons) this.userButtons.style.display = 'flex';
        } else {
            // Скрываем хедер для неавторизованных
            if (authHeader) authHeader.style.display = 'none';
            if (this.userCircle) {
                this.userCircle.style.display = 'none';
            }
            if (this.usernameDisplay) {
                this.usernameDisplay.style.display = 'none';
            }
            if (this.authButtons) this.authButtons.style.display = 'flex';
            if (this.userButtons) this.userButtons.style.display = 'none';
        }
        
        // Обновляем главный экран
        this.updateMainScreen(isLoggedIn);
    }

    updateMainScreen(isLoggedIn) {
        const guestMessage = document.getElementById('guest-message');
        const userStats = document.getElementById('user-stats');
        const gameButtons = document.getElementById('game-buttons');
        const authButtonsMain = document.getElementById('auth-buttons-main');
        const welcomeText = document.querySelector('#main-screen .container p');
        
        if (isLoggedIn) {
            // Пользователь авторизован
            if (guestMessage) guestMessage.style.display = 'none';
            if (userStats) userStats.style.display = 'grid';
            if (gameButtons) gameButtons.style.display = 'flex';
            if (authButtonsMain) authButtonsMain.style.display = 'none';
            
            if (welcomeText) {
                welcomeText.textContent = 'Угадай аниме по опенингу!';
                welcomeText.style.color = '#c4b5fd';
            }
            
            // Прячем преимущества регистрации
            const benefits = document.getElementById('registration-benefits');
            if (benefits) {
                benefits.style.display = 'none';
            }
        } else {
            // Пользователь не авторизован
            if (guestMessage) guestMessage.style.display = 'block';
            if (userStats) userStats.style.display = 'none';
            if (gameButtons) gameButtons.style.display = 'flex';
            if (authButtonsMain) authButtonsMain.style.display = 'block';
            
            if (welcomeText) {
                welcomeText.textContent = 'Угадай аниме по опенингу!';
                welcomeText.style.color = '#c4b5fd';
            }
        }
        
        // Обновляем статистику (всегда вызываем)
        if (window.updateMainScreenStats) {
            window.updateMainScreenStats();
        }
    }

    // Создание HTML для хедера с авторизацией
    createAuthHeaderHTML() {
        return `
            <div class="auth-header">
                <div class="user-info" style="display: flex; align-items: center; gap: 10px;">
                    <div class="user-circle" id="user-circle">
                        <!-- Буква имени будет добавлена через JS -->
                    </div>
                    <span class="username" id="username-display">
                        <!-- Имя пользователя будет добавлено через JS -->
                    </span>
                </div>
                
                <div class="auth-buttons" id="auth-buttons" style="display: none;">
                    <button class="btn auth-btn" id="header-login-btn">
                        Войти
                    </button>
                    <button class="btn secondary-btn auth-btn" id="header-register-btn">
                        Регистрация
                    </button>
                </div>
                
                <div class="user-buttons" id="user-buttons" style="display: none;">
                    <button class="btn auth-btn" id="header-profile-btn">
                        Профиль
                    </button>
                    <button class="btn secondary-btn auth-btn" id="header-logout-btn">
                        Выйти
                    </button>
                </div>
            </div>
        `;
    }

    // Создание HTML для экрана входа
    createLoginScreenHTML() {
        return `
            <div id="login-screen" class="screen">
                <div class="container">
                    <h2>Вход в систему</h2>
                    <p>Войдите в свой аккаунт</p>
                    
                    <form id="login-form" class="auth-form">
                        <div class="form-group">
                            <label for="login-username">Имя пользователя или Email:</label>
                            <input type="text" id="login-username" placeholder="Введите логин или email" required>
                        </div>
                        
                        <div class="form-group">
                            <label for="login-password">Пароль:</label>
                            <input type="password" id="login-password" placeholder="Введите пароль" required>
                        </div>
                        
                        <div id="login-error" class="error-message"></div>
                        
                        <div id="login-loading" class="loading" style="display: none;">
                            <div class="spinner"></div>
                        </div>
                        
                        <button type="submit" class="btn start-btn" style="width: 100%;">
                            Войти
                        </button>
                    </form>
                    
                    <div class="auth-links">
                        <p>Нет аккаунта? <a href="#" id="go-to-register">Зарегистрироваться</a></p>
                    </div>
                    
                    <button class="btn secondary-btn back-btn" style="margin-top: 20px;">
                        Назад
                    </button>
                </div>
            </div>
        `;
    }

    // Создание HTML для экрана регистрации
    createRegisterScreenHTML() {
        return `
            <div id="register-screen" class="screen">
                <div class="container">
                    <h2>Регистрация</h2>
                    <p>Создайте новый аккаунт</p>
                    
                    <form id="register-form" class="auth-form">
                        <div class="form-group">
                            <label for="register-username">Имя пользователя:</label>
                            <input type="text" id="register-username" placeholder="Введите логин (3-20 символов)" required>
                            <div id="username-error" class="field-error"></div>
                        </div>
                        
                        <div class="form-group">
                            <label for="register-email">Email:</label>
                            <input type="email" id="register-email" placeholder="Введите email" required>
                            <div id="email-error" class="field-error"></div>
                        </div>
                        
                        <div class="form-group">
                            <label for="register-password">Пароль:</label>
                            <input type="password" id="register-password" placeholder="Минимум 6 символов" required>
                            <div id="password-error" class="field-error"></div>
                        </div>
                        
                        <div class="form-group">
                            <label for="register-confirm-password">Подтвердите пароль:</label>
                            <input type="password" id="register-confirm-password" placeholder="Повторите пароль" required>
                            <div id="confirm-password-error" class="field-error"></div>
                        </div>
                        
                        <div id="register-error" class="error-message"></div>
                        <div id="register-success" class="success-message"></div>
                        
                        <div id="register-loading" class="loading" style="display: none;">
                            <div class="spinner"></div>
                        </div>
                        
                        <button type="submit" class="btn start-btn" style="width: 100%;">
                            Зарегистрироваться
                        </button>
                    </form>
                    
                    <div class="auth-links">
                        <p>Уже есть аккаунт? <a href="#" id="go-to-login">Войти</a></p>
                    </div>
                    
                    <button class="btn secondary-btn back-btn" style="margin-top: 20px;">
                        Назад
                    </button>
                </div>
            </div>
        `;
    }

    // Создание HTML для экрана профиля
    createProfileScreenHTML() {
        return `
            <div id="profile-screen" class="screen">
                <div class="container">
                    <h2>Мой профиль</h2>
                    
                    <div id="profile-container">
                        <!-- Данные профиля будут загружены динамически -->
                    </div>
                    
                    <div class="profile-section">
                        <h3>Статистика</h3>
                        <div id="profile-stats">
                            <!-- Статистика будет загружена динамически -->
                        </div>
                    </div>
                    
                    <div class="profile-section">
                        <h3>Достижения</h3>
                        <div id="profile-achievements" class="achievements-grid">
                            <!-- Достижения будут загружены динамически -->
                        </div>
                    </div>
                    
                    <button class="btn secondary-btn" id="logout-button" style="margin-top: 20px;">
                        Выйти из аккаунта
                    </button>
                    
                    <button class="btn back-btn" style="margin-top: 10px;">
                        Назад
                    </button>
                </div>
            </div>
        `;
    }
}

// Создаем глобальный экземпляр
window.authUIComponents = new AuthUIComponents();

// Инициализируем при загрузке
document.addEventListener('DOMContentLoaded', () => {
    window.authUIComponents.init();
});

console.log('✅ uiComponents.js loaded successfully');