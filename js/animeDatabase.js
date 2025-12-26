console.log('📀 animeDatabase.js loading...');

// Глобальная переменная для базы данных
window.animeDatabase = [];
let supabaseClient = null;

// Инициализация Supabase
function initSupabase() {
    if (supabaseClient) {
        return true;
    }
    
    try {
        // Проверяем, что Supabase доступен глобально
        if (typeof window.supabase !== 'undefined') {
            supabaseClient = window.supabase.createClient(
                'https://udigewfsgwiawjdechgv.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkaWdld2ZzZ3dpYXdqZGVjaGd2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM3NDU5MTUsImV4cCI6MjA3OTMyMTkxNX0.wN5UL_dIxH004hcw5Je3Za_uFlC28_CfGwdUmWEM0Kc'
            );
            console.log('✅ Supabase клиент инициализирован');
            return true;
        } else {
            console.log('❌ Supabase не загружен');
            return false;
        }
    } catch (error) {
        console.error('❌ Ошибка инициализации Supabase:', error);
        return false;
    }
}

async function loadAnimeDatabase() {
    console.log('🌐 Загрузка базы аниме...');
    
    // Сначала пробуем загрузить с Supabase
    const supabaseLoaded = await loadFromSupabase();
    
    if (supabaseLoaded) {
        console.log('✅ База загружена с Supabase:', window.animeDatabase.length, 'записей');
        return true;
    } else {
        // Если Supabase не доступен, используем резервную базу
        console.log('🔄 Supabase недоступен, используем резервную базу...');
        return loadBackupDatabase();
    }
}

async function loadFromSupabase() {
    if (!initSupabase()) {
        console.log('❌ Supabase не инициализирован');
        return false;
    }
    
    try {
        console.log('🔄 Загрузка данных с Supabase...');
        
        const { data, error } = await supabaseClient
            .from('anime_database')
            .select('*')
            .order('id');
        
        if (error) {
            console.error('❌ Ошибка Supabase:', error);
            return false;
        }
        
        if (data && data.length > 0) {
            // ОЧЕНЬ ВАЖНО: присваиваем глобальной переменной
            window.animeDatabase = data;
            console.log('📊 Загружено записей с Supabase:', window.animeDatabase.length);
            
            // Логируем первые 5 аниме для отладки
            console.log('📋 Первые 5 аниме:', window.animeDatabase.slice(0, 5).map(a => a.title));
            return true;
        } else {
            console.log('⚠️ В Supabase нет данных или таблица пуста');
            return false;
        }
    } catch (error) {
        console.error('❌ Ошибка загрузки с Supabase:', error);
        return false;
    }
}

// Функция для проверки подключения к Supabase
async function testSupabaseConnection() {
    if (!initSupabase()) {
        return { success: false, error: 'Supabase не инициализирован' };
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('anime_database')
            .select('count')
            .limit(1);
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        return { success: true, message: 'Подключение к Supabase успешно' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

// Функция для добавления аниме в Supabase (для админки)
async function addAnimeToSupabase(animeData) {
    if (!initSupabase()) {
        console.error('❌ Supabase не инициализирован');
        return false;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('anime_database')
            .insert([animeData])
            .select();
        
        if (error) {
            throw error;
        }
        
        console.log('✅ Аниме добавлено в Supabase:', data);
        return true;
    } catch (error) {
        console.error('❌ Ошибка добавления аниме в Supabase:', error);
        return false;
    }
}

// Функция для массового добавления аниме
async function bulkAddAnimeToSupabase(animeList) {
    if (!initSupabase()) {
        console.error('❌ Supabase не инициализирован');
        return false;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('anime_database')
            .insert(animeList)
            .select();
        
        if (error) {
            throw error;
        }
        
        console.log('✅ Аниме добавлены в Supabase:', data.length, 'записей');
        return true;
    } catch (error) {
        console.error('❌ Ошибка массового добавления аниме в Supabase:', error);
        return false;
    }
}

// Функция для регистрации пользователя в Supabase
async function registerUserInSupabase(username, email, password) {
    if (!initSupabase()) {
        console.error('❌ Supabase не инициализирован');
        return { success: false, error: 'Supabase не инициализирован' };
    }

    try {
        // Сначала регистрируем пользователя в Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: username
                }
            }
        });

        if (authError) {
            console.error('❌ Ошибка регистрации в Auth:', authError);
            return { success: false, error: authError.message };
        }

        if (!authData.user) {
            return { success: false, error: 'Не удалось создать пользователя' };
        }

        console.log('✅ Пользователь зарегистрирован в Supabase Auth');

        // Если пользователь не аутентифицирован автоматически, входим в систему
        if (!authData.session) {
            console.log('🔄 Автоматическая аутентификация не произошла, выполняем вход...');
            const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });

            if (signInError) {
                console.error('❌ Ошибка автоматического входа:', signInError);
                return { success: false, error: 'Регистрация прошла успешно, но не удалось войти. Попробуйте войти вручную.' };
            }

            console.log('✅ Автоматический вход выполнен');
        }

        // Теперь создаем запись в таблице users
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .insert([{
                id: authData.user.id, // Используем ID из auth.users
                username: username,
                email: email,
                level: 1,
                xp: 0,
                games_played: 0,
                correct_answers: 0,
                total_answers: 0,
                achievements: [],
                difficulty: 'easy',
                music_volume: 50,
                autoplay: true
            }])
            .select()
            .single();

        if (userError) {
            console.error('❌ Ошибка создания профиля пользователя:', userError);
            // Если создание профиля не удалось, удаляем пользователя из auth
            try {
                await supabaseClient.auth.admin.deleteUser(authData.user.id);
            } catch (deleteError) {
                console.error('❌ Ошибка удаления пользователя из auth:', deleteError);
            }
            return { success: false, error: userError.message };
        }

        console.log('✅ Профиль пользователя создан в Supabase');
        return { success: true, user: userData };

    } catch (error) {
        console.error('❌ Ошибка регистрации пользователя:', error);
        return { success: false, error: error.message };
    }
}

// Функция для входа пользователя в Supabase
async function loginUserInSupabase(usernameOrEmail, password) {
    if (!initSupabase()) {
        console.error('❌ Supabase не инициализирован');
        return { success: false, error: 'Supabase не инициализирован' };
    }

    try {
        let email = usernameOrEmail;

        // Если введен username, найдем email
        if (!usernameOrEmail.includes('@')) {
            const { data: userData, error: userError } = await supabaseClient
                .from('users')
                .select('email')
                .eq('username', usernameOrEmail)
                .single();

            if (userError || !userData) {
                console.error('❌ Пользователь не найден:', userError);
                return { success: false, error: 'Пользователь не найден' };
            }

            email = userData.email;
        }

        // Входим через Supabase Auth
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });

        if (authError) {
            console.error('❌ Ошибка входа в Auth:', authError);
            return { success: false, error: authError.message };
        }

        if (!authData.user) {
            return { success: false, error: 'Не удалось войти' };
        }

        console.log('✅ Пользователь вошел в Supabase Auth');

        // Получаем профиль пользователя из таблицы users
        const { data: userData, error: userError } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', authData.user.id)
            .single();

        if (userError) {
            console.error('❌ Ошибка получения профиля пользователя:', userError);
            return { success: false, error: userError.message };
        }

        console.log('✅ Профиль пользователя получен');
        return { success: true, user: userData };

    } catch (error) {
        console.error('❌ Ошибка входа пользователя:', error);
        return { success: false, error: error.message };
    }
}

// Функция для обновления статистики пользователя в Supabase
async function updateUserStatsInSupabase(userId, statsUpdate) {
    if (!initSupabase()) {
        console.error('❌ Supabase не инициализирован');
        return { success: false, error: 'Supabase не инициализирован' };
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .update(statsUpdate)
            .eq('id', userId)
            .select()
            .single();
        
        if (error) {
            console.error('❌ Ошибка обновления статистики:', error);
            return { success: false, error: error.message };
        }
        
        console.log('✅ Статистика пользователя обновлена в Supabase');
        return { success: true, user: data };
        
    } catch (error) {
        console.error('❌ Ошибка обновления статистики:', error);
        return { success: false, error: error.message };
    }
}

// Функция для обновления настроек пользователя в Supabase
async function updateUserSettingsInSupabase(userId, settings) {
    if (!initSupabase()) {
        console.error('❌ Supabase не инициализирован');
        return { success: false, error: 'Supabase не инициализирован' };
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .update({ settings: settings })
            .eq('id', userId)
            .select()
            .single();
        
        if (error) {
            console.error('❌ Ошибка обновления настроек:', error);
            return { success: false, error: error.message };
        }
        
        console.log('✅ Настройки пользователя обновлены в Supabase');
        return { success: true, user: data };
        
    } catch (error) {
        console.error('❌ Ошибка обновления настроек:', error);
        return { success: false, error: error.message };
    }
}

// Функция для получения пользователя по ID
async function getUserById(userId) {
    if (!initSupabase()) {
        console.error('❌ Supabase не инициализирован');
        return null;
    }
    
    try {
        const { data, error } = await supabaseClient
            .from('users')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('❌ Ошибка получения пользователя:', error);
            return null;
        }
        
        return data;
        
    } catch (error) {
        console.error('❌ Ошибка получения пользователя:', error);
        return null;
    }
}

// Резервная локальная база на случай ошибок
function loadBackupDatabase() {
    try {
        window.animeDatabase = [
            {
                "id": 1,
                "title": "Наруто",
                "music": "https://raw.githubusercontent.com/kysagetests/AnimeOP/main/sounds/naruto_opening.mp3",
                "image": "https://raw.githubusercontent.com/kysagetests/AnimeOP/main/images/naruto.jpg",
                "description": "Шонен, Приключения",
                "year": 2002,
                "genre": ["Шонен", "Приключения"]
            },
            {
                "id": 2,
                "title": "Тетрадь смерти",
                "music": "https://raw.githubusercontent.com/kysagetests/AnimeOP/main/sounds/deathnote_opening.mp3",
                "image": "https://raw.githubusercontent.com/kysagetests/AnimeOP/main/images/deathnote.jpg",
                "description": "Детектив, Психологический",
                "year": 2006,
                "genre": ["Детектив", "Психологический"]
            },
            {
                "id": 3,
                "title": "Моя геройская академия",
                "music": "https://raw.githubusercontent.com/kysagetests/AnimeOP/main/sounds/mha_opening.mp3",
                "image": "https://raw.githubusercontent.com/kysagetests/AnimeOP/main/images/mha.jpg",
                "description": "Шонен, Супергерои",
                "year": 2016,
                "genre": ["Шонен", "Супергерои"]
            },
            {
                "id": 4,
                "title": "Истребитель демонов",
                "music": "https://raw.githubusercontent.com/kysagetests/AnimeOP/main/sounds/demonslayer_opening.mp3",
                "image": "https://raw.githubusercontent.com/kysagetests/AnimeOP/main/images/demonslayer.jpg",
                "description": "Шонен, Фэнтези",
                "year": 2019,
                "genre": ["Шонен", "Фэнтези"]
            },
            {
                "id": 5,
                "title": "Ван Пис",
                "music": "https://raw.githubusercontent.com/kysagetests/AnimeOP/main/sounds/onepiece_opening.mp3",
                "image": "https://raw.githubusercontent.com/kysagetests/AnimeOP/main/images/onepiece.jpg",
                "description": "Шонен, Приключения",
                "year": 1999,
                "genre": ["Шонен", "Приключения"]
            },
            {
                "id": 6,
                "title": "Токийские мстители",
                "music": "https://raw.githubusercontent.com/kysagetests/AnimeOP/main/sounds/tokyorevengers_opening.mp3",
                "image": "https://raw.githubusercontent.com/kysagetests/AnimeOP/main/images/tokyorevengers.jpg",
                "description": "Драма, Боевик",
                "year": 2021,
                "genre": ["Драма", "Боевик"]
            },
            {
                "id": 7,
                "title": "Магическая битва",
                "music": "https://raw.githubusercontent.com/kysagetests/AnimeOP/main/sounds/jujutsukaisen_opening.mp3",
                "image": "https://raw.githubusercontent.com/kysagetests/AnimeOP/main/images/jujutsukaisen.jpg",
                "description": "Шонен, Ужасы",
                "year": 2020,
                "genre": ["Шонен", "Ужасы"]
            },
            {
                "id": 8,
                "title": "Семья шпионов",
                "music": "https://raw.githubusercontent.com/kysagetests/AnimeOP/main/sounds/spyfamily_opening.mp3",
                "image": "https://raw.githubusercontent.com/kysagetests/AnimeOP/main/images/spyfamily.jpg",
                "description": "Комедия, Повседневность",
                "year": 2022,
                "genre": ["Комедия", "Повседневность"]
            }
        ];
        console.log('✅ Загружена резервная база:', window.animeDatabase.length, 'аниме');
        return true;
    } catch (error) {
        console.error('❌ Ошибка загрузки резервной базы:', error);
        window.animeDatabase = [];
        return false;
    }
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

function getAllAnime() {
    if (!window.animeDatabase || window.animeDatabase.length === 0) {
        console.warn('⚠️ База аниме пуста или не загружена');
        return [];
    }
    return window.animeDatabase;
}

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

function getAllGenres() {
    if (!window.animeDatabase || window.animeDatabase.length === 0) {
        console.warn('⚠️ База аниме пуста или не загружена');
        return [];
    }
    
    const genres = new Set();
    window.animeDatabase.forEach(anime => {
        if (anime.genre && Array.isArray(anime.genre)) {
            anime.genre.forEach(genre => genres.add(genre));
        }
    });
    return Array.from(genres).sort();
}

function getAnimeByGenre(genre) {
    if (!window.animeDatabase || window.animeDatabase.length === 0) {
        console.warn('⚠️ База аниме пуста или не загружена');
        return [];
    }
    
    return window.animeDatabase.filter(anime => 
        anime.genre && Array.isArray(anime.genre) && anime.genre.includes(genre)
    );
}

function getAnimeByYear(year) {
    if (!window.animeDatabase || window.animeDatabase.length === 0) {
        console.warn('⚠️ База аниме пуста или не загружена');
        return [];
    }
    
    return window.animeDatabase.filter(anime => anime.year === year);
}

function searchAnime(query) {
    if (!window.animeDatabase || window.animeDatabase.length === 0) {
        console.warn('⚠️ База аниме пуста или не загружена');
        return [];
    }
    
    const searchTerm = query.toLowerCase().trim();
    return window.animeDatabase.filter(anime => 
        anime.title.toLowerCase().includes(searchTerm) ||
        (anime.description && anime.description.toLowerCase().includes(searchTerm)) ||
        (anime.genre && anime.genre.some(g => g.toLowerCase().includes(searchTerm)))
    );
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function isDatabaseLoaded() {
    return window.animeDatabase && window.animeDatabase.length > 0;
}

function getDatabaseStats() {
    if (!window.animeDatabase || window.animeDatabase.length === 0) {
        return {
            total: 0,
            genres: 0,
            years: [],
            latestUpdate: new Date().toISOString(),
            source: 'none'
        };
    }
    
    return {
        total: window.animeDatabase.length,
        genres: getAllGenres().length,
        years: [...new Set(window.animeDatabase.map(a => a.year))].sort(),
        latestUpdate: new Date().toISOString(),
        source: supabaseClient ? 'supabase' : 'backup'
    };
}

// Функция для проверки доступности медиа-файлов
async function checkMediaAvailability(anime) {
    const results = {
        music: false,
        image: false
    };
    
    try {
        // Проверяем музыку
        if (anime.music) {
            const musicResponse = await fetch(anime.music, { method: 'HEAD' });
            results.music = musicResponse.ok;
        }
        
        // Проверяем изображение
        if (anime.image) {
            const imageResponse = await fetch(anime.image, { method: 'HEAD' });
            results.image = imageResponse.ok;
        }
    } catch (error) {
        console.warn(`⚠️ Ошибка проверки медиа для "${anime.title}":`, error);
    }
    
    return results;
}

// Функция для валидации базы данных
function validateDatabase() {
    if (!window.animeDatabase || window.animeDatabase.length === 0) {
        return {
            errors: ['База данных пуста или не загружена'],
            warnings: []
        };
    }
    
    const errors = [];
    const warnings = [];
    
    window.animeDatabase.forEach((anime, index) => {
        // Проверка обязательных полей
        if (!anime.id) errors.push(`Аниме ${index}: отсутствует ID`);
        if (!anime.title) errors.push(`Аниме ${index}: отсутствует название`);
        if (!anime.music) warnings.push(`Аниме "${anime.title}": отсутствует музыка`);
        if (!anime.image) warnings.push(`Аниме "${anime.title}": отсутствует изображение`);
        
        // Проверка типов данных
        if (anime.id && typeof anime.id !== 'number') errors.push(`Аниме "${anime.title}": ID должен быть числом`);
        if (anime.year && typeof anime.year !== 'number') errors.push(`Аниме "${anime.title}": год должен быть числом`);
        if (anime.genre && !Array.isArray(anime.genre)) errors.push(`Аниме "${anime.title}": жанр должен быть массивом`);
    });
    
    // Проверка уникальности ID
    const ids = window.animeDatabase.map(a => a.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    if (duplicateIds.length > 0) {
        errors.push(`Найдены повторяющиеся ID: ${duplicateIds.join(', ')}`);
    }
    
    return { errors, warnings };
}

// Сделаем функции глобальными для доступа из других файлов
window.loadAnimeDatabase = loadAnimeDatabase;
window.getAnimeById = getAnimeById;
window.getAllAnime = getAllAnime;
window.getRandomAnime = getRandomAnime;
window.getAllGenres = getAllGenres;
window.getAnimeByGenre = getAnimeByGenre;
window.getAnimeByYear = getAnimeByYear;
window.searchAnime = searchAnime;
window.isDatabaseLoaded = isDatabaseLoaded;
window.getDatabaseStats = getDatabaseStats;
window.validateDatabase = validateDatabase;
window.checkMediaAvailability = checkMediaAvailability;
window.shuffleArray = shuffleArray;
window.addAnimeToSupabase = addAnimeToSupabase;
window.bulkAddAnimeToSupabase = bulkAddAnimeToSupabase;
window.testSupabaseConnection = testSupabaseConnection;

// Функции для работы с пользователями в Supabase
window.registerUserInSupabase = registerUserInSupabase;
window.loginUserInSupabase = loginUserInSupabase;
window.updateUserStatsInSupabase = updateUserStatsInSupabase;
window.updateUserSettingsInSupabase = updateUserSettingsInSupabase;
window.getUserById = getUserById;

console.log('✅ animeDatabase.js loaded successfully');

// Глобальная функция для перезагрузки базы данных
window.reloadDatabase = async function() {
    console.log('🔄 Принудительная перезагрузка базы данных...');
    
    try {
        const success = await loadAnimeDatabase();
        if (success) {
            console.log('✅ База данных перезагружена');
            if (window.uiManager) {
                window.uiManager.updateConnectionStatus(true, '✅ База перезагружена');
            }
            return true;
        } else {
            throw new Error('Не удалось загрузить базу данных');
        }
    } catch (error) {
        console.error('❌ Ошибка перезагрузки:', error);
        if (window.uiManager) {
            window.uiManager.showDatabaseError();
        }
        return false;
    }
};

// Экспортируем функции для использования в других модулях
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        animeDatabase: window.animeDatabase,
        loadAnimeDatabase,
        getAnimeById,
        getAllAnime,
        getRandomAnime,
        getAllGenres,
        getAnimeByGenre,
        getAnimeByYear,
        searchAnime,
        isDatabaseLoaded,
        getDatabaseStats,
        validateDatabase,
        checkMediaAvailability,
        shuffleArray,
        addAnimeToSupabase,
        bulkAddAnimeToSupabase,
        testSupabaseConnection,
        registerUserInSupabase,
        loginUserInSupabase,
        updateUserStatsInSupabase,
        updateUserSettingsInSupabase,
        getUserById,
        reloadDatabase
    };
}