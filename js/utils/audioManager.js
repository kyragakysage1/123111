class AudioManager {
    constructor() {
        this.currentAudio = null;
        this.currentAnimeAudio = null;
        this.currentPlayingAnimeId = null;
        this.isPlaying = false;
        this.userInteracted = false;
        this.volume = 50; // Значение по умолчанию
    }

    init() {
        // Загружаем сохраненную громкость
        const savedSettings = localStorage.getItem('animeQuizSettings');
        if (savedSettings) {
            try {
                const settings = JSON.parse(savedSettings);
                this.volume = settings.musicVolume || 50;
            } catch (e) {
                console.log('Ошибка загрузки настроек:', e);
            }
        }
        
        // Отслеживаем любое взаимодействие пользователя с страницей
        document.addEventListener('click', () => {
            this.userInteracted = true;
        }, { once: true });
    }

    playMusic(url) {
        this.stopMusic();

        if (!url) {
            console.warn('URL музыки не указан');
            return Promise.reject('URL не указан');
        }

        return new Promise((resolve, reject) => {
            try {
                const audio = new Audio(url);
                audio.volume = this.volume / 100;
                audio.preload = 'auto';

                // Если пользователь уже взаимодействовал с страницей, пробуем воспроизвести
                if (this.userInteracted) {
                    audio.play()
                        .then(() => {
                            this.currentAudio = audio;
                            this.isPlaying = true;
                            console.log('✅ Музыка начала воспроизводиться');
                            resolve();
                        })
                        .catch(e => {
                            console.log("Ошибка воспроизведения:", e);
                            reject(e);
                        });
                } else {
                    // Если не было взаимодействия, просто создаем аудио объект
                    this.currentAudio = audio;
                    resolve();
                }

                audio.onended = () => {
                    this.isPlaying = false;
                };

                audio.onerror = () => {
                    console.log("Ошибка загрузки аудио");
                    reject(new Error('Ошибка загрузки аудио'));
                };

            } catch (error) {
                console.log("Ошибка создания аудио:", error);
                reject(error);
            }
        });
    }

    pauseMusic() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.isPlaying = false;
        }
    }

    stopMusic() {
        if (this.currentAudio) {
            this.currentAudio.pause();
            this.currentAudio.currentTime = 0;
            this.currentAudio = null;
            this.isPlaying = false;
        }
    }

    playAnimeMusic(musicUrl, animeId) {
        this.stopAnimeMusic();

        if (!musicUrl) {
            this.updateMusicStatus(animeId, '❌ URL музыки отсутствует', '#ff4757');
            return;
        }

        try {
            const audio = new Audio(musicUrl);
            audio.volume = this.volume / 100;

            audio.play().then(() => {
                this.currentAnimeAudio = audio;
                this.currentPlayingAnimeId = animeId;
                this.updateMusicStatus(animeId, '🎵 Воспроизводится...', '#00ff7f');
            }).catch(error => {
                console.log("Ошибка воспроизведения аниме музыки:", error);
                this.updateMusicStatus(animeId, '❌ Нажмите кнопку еще раз', '#ff4757');
            });

            audio.onended = () => {
                this.updateMusicStatus(animeId, '⏹️ Воспроизведение завершено', '#c4b5fd');
                this.currentAnimeAudio = null;
                this.currentPlayingAnimeId = null;
            };

            audio.onerror = () => {
                this.updateMusicStatus(animeId, '❌ Ошибка загрузки', '#ff4757');
                this.currentAnimeAudio = null;
                this.currentPlayingAnimeId = null;
            };

        } catch (error) {
            console.log("Ошибка создания аниме аудио:", error);
            this.updateMusicStatus(animeId, '❌ Ошибка воспроизведения', '#ff4757');
        }
    }

    stopAnimeMusic() {
        if (this.currentAnimeAudio) {
            this.currentAnimeAudio.pause();
            this.currentAnimeAudio.currentTime = 0;
            this.currentAnimeAudio = null;

            if (this.currentPlayingAnimeId) {
                this.updateMusicStatus(this.currentPlayingAnimeId, '⏹️ Музыка остановлена', '#c4b5fd');
                this.currentPlayingAnimeId = null;
            }
        }
    }

    updateMusicStatus(animeId, message, color) {
        const statusElement = document.getElementById(`music-status-${animeId}`);
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.style.color = color;
        }
    }

    updateVolume(volume) {
        this.volume = volume;
        const volumeLevel = volume / 100;
        
        // Обновляем громкость текущего аудио
        if (this.currentAudio) {
            this.currentAudio.volume = volumeLevel;
        }
        if (this.currentAnimeAudio) {
            this.currentAnimeAudio.volume = volumeLevel;
        }
        
        console.log(`🔊 Громкость установлена: ${volume}%`);
    }
    
    getCurrentVolume() {
        return this.volume;
    }
}

// Создаем глобальный экземпляр и инициализируем
window.audioManager = new AudioManager();
window.audioManager.init();
