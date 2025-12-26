console.log('🔐 registerScreen.js loading...');

class RegisterScreen {
    constructor() {
        this.form = null;
        this.usernameInput = null;
        this.emailInput = null;
        this.passwordInput = null;
        this.confirmPasswordInput = null;
        this.errorElement = null;
        this.loadingElement = null;
        this.successElement = null;
    }

    init() {
        this.form = document.getElementById('register-form');
        this.usernameInput = document.getElementById('register-username');
        this.emailInput = document.getElementById('register-email');
        this.passwordInput = document.getElementById('register-password');
        this.confirmPasswordInput = document.getElementById('register-confirm-password');
        this.errorElement = document.getElementById('register-error');
        this.loadingElement = document.getElementById('register-loading');
        this.successElement = document.getElementById('register-success');

        if (this.form) {
            this.form.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // Валидация в реальном времени
        if (this.usernameInput) {
            this.usernameInput.addEventListener('input', () => this.validateUsername());
        }

        if (this.emailInput) {
            this.emailInput.addEventListener('input', () => this.validateEmail());
        }

        if (this.passwordInput) {
            this.passwordInput.addEventListener('input', () => this.validatePassword());
        }

        if (this.confirmPasswordInput) {
            this.confirmPasswordInput.addEventListener('input', () => this.validateConfirmPassword());
        }

        // Кнопка "Уже есть аккаунт"
        const loginLink = document.getElementById('go-to-login');
        if (loginLink) {
            loginLink.addEventListener('click', (e) => {
                e.preventDefault();
                if (window.showScreen) {
                    window.showScreen('login-screen');
                }
            });
        }

        // Кнопка "Назад"
        const backButton = document.querySelector('#register-screen .back-btn');
        if (backButton) {
            backButton.addEventListener('click', () => {
                if (window.showScreen) {
                    window.showScreen('welcome-screen');
                }
            });
        }
    }

    async handleRegister(event) {
        event.preventDefault();
        
        const username = this.usernameInput.value.trim();
        const email = this.emailInput.value.trim();
        const password = this.passwordInput.value;
        const confirmPassword = this.confirmPasswordInput.value;

        // Валидация
        if (!this.validateUsername(username) || 
            !this.validateEmail(email) || 
            !this.validatePassword(password) || 
            !this.validateConfirmPassword(password, confirmPassword)) {
            return;
        }

        // Показываем загрузку
        this.showLoading(true);
        this.showError('');

        try {
            // Регистрируем пользователя через authManager (простая запись в БД)
            const result = await window.authManager.register(username, email, password);
            
            if (result.success) {
                // Скрываем загрузку и показываем успех
                this.showLoading(false);
                this.showSuccess(`✅ Регистрация успешна! Добро пожаловать, ${result.user.username}!`);
                
                // Очищаем форму
                this.resetForm();
                
                // Загружаем данные пользователя
                if (window.loadUserData) {
                    await window.loadUserData();
                }

                // Обновляем интерфейс главного экрана
                if (window.updateMainScreenStats) {
                    window.updateMainScreenStats();
                }
                
                // Через 2 секунды переходим на главный экран
                setTimeout(() => {
                    if (window.showScreen) {
                        window.showScreen('main-screen');
                    }
                }, 2000);
            }

        } catch (error) {
            this.showLoading(false);
            this.showError(error.message || 'Ошибка регистрации. Попробуйте снова.');
            console.error('❌ Ошибка регистрации:', error);
        }
    }

    validateUsername(username = null) {
        const value = username || this.usernameInput.value.trim();
        const usernameRegex = /^[a-zA-Z0-9_]{3,20}$/;
        
        if (!value) {
            this.showFieldError('username', 'Введите имя пользователя');
            return false;
        }
        
        if (value.length < 3) {
            this.showFieldError('username', 'Минимум 3 символа');
            return false;
        }
        
        if (value.length > 20) {
            this.showFieldError('username', 'Максимум 20 символов');
            return false;
        }
        
        if (!usernameRegex.test(value)) {
            this.showFieldError('username', 'Только буквы, цифры и подчеркивание');
            return false;
        }
        
        this.clearFieldError('username');
        return true;
    }

    validateEmail(email = null) {
        const value = email || this.emailInput.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        
        if (!value) {
            this.showFieldError('email', 'Введите email');
            return false;
        }
        
        if (!emailRegex.test(value)) {
            this.showFieldError('email', 'Введите корректный email');
            return false;
        }
        
        this.clearFieldError('email');
        return true;
    }

    validatePassword(password = null) {
        const value = password || this.passwordInput.value;
        
        if (!value) {
            this.showFieldError('password', 'Введите пароль');
            return false;
        }
        
        if (value.length < 6) {
            this.showFieldError('password', 'Минимум 6 символов');
            return false;
        }
        
        this.clearFieldError('password');
        return true;
    }

    validateConfirmPassword(password = null, confirmPassword = null) {
        const passValue = password || this.passwordInput.value;
        const confirmValue = confirmPassword || this.confirmPasswordInput.value;
        
        if (!confirmValue) {
            this.showFieldError('confirm-password', 'Подтвердите пароль');
            return false;
        }
        
        if (passValue !== confirmValue) {
            this.showFieldError('confirm-password', 'Пароли не совпадают');
            return false;
        }
        
        this.clearFieldError('confirm-password');
        return true;
    }

    showFieldError(field, message) {
        const errorElement = document.getElementById(`${field}-error`);
        if (errorElement) {
            errorElement.textContent = message;
            errorElement.style.display = 'block';
        }
    }

    clearFieldError(field) {
        const errorElement = document.getElementById(`${field}-error`);
        if (errorElement) {
            errorElement.textContent = '';
            errorElement.style.display = 'none';
        }
    }

    showError(message) {
        if (this.errorElement) {
            this.errorElement.textContent = message;
            this.errorElement.style.display = message ? 'block' : 'none';
        }
    }

    showSuccess(message) {
        if (this.successElement) {
            this.successElement.textContent = message;
            this.successElement.style.display = 'block';
            
            // Скрываем через 3 секунды
            setTimeout(() => {
                this.successElement.style.display = 'none';
            }, 3000);
        }
    }

    showLoading(isLoading) {
        if (this.loadingElement) {
            this.loadingElement.style.display = isLoading ? 'block' : 'none';
        }
        
        if (this.form) {
            const submitButton = this.form.querySelector('button[type="submit"]');
            if (submitButton) {
                submitButton.disabled = isLoading;
                submitButton.textContent = isLoading ? 'Регистрация...' : 'Зарегистрироваться';
            }
        }
    }

    resetForm() {
        if (this.form) {
            this.form.reset();
        }
        this.showError('');
        this.showLoading(false);
        
        // Очищаем все поля ошибок
        ['username', 'email', 'password', 'confirm-password'].forEach(field => {
            this.clearFieldError(field);
        });
    }
}

// Создаем глобальный экземпляр
window.registerScreen = new RegisterScreen();

// Инициализируем при загрузке
document.addEventListener('DOMContentLoaded', () => {
    window.registerScreen.init();
});

console.log('✅ registerScreen.js loaded successfully');