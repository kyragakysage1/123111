console.log('🔐 loginScreen.js loading...');

class LoginScreen {
    constructor() {
        this.form = null;
        this.usernameInput = null;
        this.passwordInput = null;
        this.errorElement = null;
        this.loadingElement = null;
        this.authManager = null;
    }

    init() {
        this.form = document.getElementById('login-form');
        this.usernameInput = document.getElementById('login-username');
        this.passwordInput = document.getElementById('login-password');
        this.errorElement = document.getElementById('login-error');
        this.loadingElement = document.getElementById('login-loading');

        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // Кнопка "Зарегистрироваться"
        const registerLink = document.getElementById('go-to-register');
        if (registerLink) {
            registerLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (window.showScreen) {
                    window.showScreen('register-screen');
                }
            });
        }

        // Кнопка "Назад"
        const backButton = document.querySelector('#login-screen .back-btn');
        if (backButton) {
            backButton.addEventListener('click', () => {
                if (window.showScreen) {
                    window.showScreen('welcome-screen');
                }
            });
        }

        // Инициализация менеджера авторизации
        if (window.authManager) {
            this.authManager = window.authManager;
            this.authManager.init();
        } else {
            console.warn('⚠️ authManager не найден. Авторизация будет работать в режиме "безопасного"');
        }
    }

    async handleLogin(event) {
        event.preventDefault();
        
        const username = this.usernameInput.value.trim();
        const password = this.passwordInput.value.trim();

        // Проверка на пустые поля
        if (!username || !password) {
            this.showError('Введите логин и пароль');
            return;
        }

        // Показываем загрузку
        this.showLoading(true);

        try {
            // Логин через authManager (простая проверка БД)
            const result = await window.authManager.login(username, password);

            if (result.success) {
                console.log('✅ LoginScreen: Авторизация успешна', result.user);
                console.log('✅ LoginScreen: authManager.isLoggedIn() =', window.authManager.isLoggedIn());
                console.log('✅ LoginScreen: authManager.getCurrentUser() =', window.authManager.getCurrentUser());
                
                this.showSuccess('✅ Вы успешно вошли в систему!');

                // Очищаем форму
                this.usernameInput.value = '';
                this.passwordInput.value = '';

                // Загружаем данные пользователя
                if (window.loadUserData) {
                    console.log('📊 LoginScreen: Загружаем данные пользователя');
                    await window.loadUserData();
                }

                // Обновляем интерфейс главного экрана
                if (window.updateMainScreenStats) {
                    console.log('🎨 LoginScreen: Обновляем интерфейс');
                    window.updateMainScreenStats();
                }

                // Переходим на главный экран
                setTimeout(() => {
                    if (window.showScreen) {
                        console.log('🖥️ LoginScreen: Переходим на главный экран');
                        window.showScreen('main-screen');
                    }
                }, 1000);
            }

        } catch (error) {
            this.showError(error.message || 'Ошибка авторизации. Попробуйте снова.');
            console.error('❌ Ошибка авторизации:', error);
        } finally {
            this.showLoading(false);
        }
    }

    showError(message) {
        this.errorElement.textContent = message;
        this.errorElement.style.display = 'block';
        this.errorElement.style.color = '#e74c3c';
    }

    showSuccess(message) {
        this.errorElement.textContent = message;
        this.errorElement.style.display = 'block';
        this.errorElement.style.color = '#27ae60';
        setTimeout(() => {
            this.errorElement.style.display = 'none';
        }, 3000);
    }

    showLoading(show) {
        this.loadingElement.style.display = show ? 'block' : 'none';
        this.form.style.pointerEvents = show ? 'none' : 'auto';
    }
}

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    const loginScreen = new LoginScreen();
    loginScreen.init();
});
