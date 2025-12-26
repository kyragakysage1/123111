console.log('👥 friendsManager.js loading...');

class FriendsManager {
    constructor() {
        this.friends = [];
        this.sentRequests = []; // Заявки отправленные текущим пользователем
        this.incomingRequests = []; // Входящие заявки
        this.blockedUsers = [];
        this.autoRefreshInterval = null;
    }

    async init() {
        console.log('👥 Инициализация FriendsManager');
        await this.loadFriendsFromDatabase();
        this.setupEventListeners();
        this.setupTabs();
        this.setupRealtimeSubscriptions();
        this.setupMultiplayerInviteListener(); // Добавляем слушатель приглашений
        this.startAutoRefresh();
    }

    startAutoRefresh() {
        // Обновляем данные каждые 10 секунд вместо 3
        this.autoRefreshInterval = setInterval(() => {
            console.log('🔄 Автообновление данных друзей...');
            this.loadFriendsFromDatabase();
            this.checkForMultiplayerInvites(); // Проверяем приглашения
            // Не вызываем displayFriends и displayRequests здесь - это вызовет мерцание
            // Вместо этого обновляем только если есть изменения
            this.updateDisplayIfChanged();
        }, 10000);
        console.log('✅ Автообновление запущено (каждые 10 сек)');
    }

    // Проверка новых приглашений на мультиплеер
    async checkForMultiplayerInvites() {
        try {
            const currentUser = window.authManager?.getCurrentUser();
            if (!currentUser) return;

            const client = window.authManager?.supabase;
            if (!client) return;

            const { data, error } = await client
                .from('multiplayer_invites')
                .select('*')
                .eq('to_user_id', currentUser.id)
                .eq('status', 'pending')
                .order('created_at', { ascending: false })
                .limit(10);

            if (error) {
                console.error('❌ Ошибка проверки приглашений:', error);
                return;
            }

            // Показываем только новые приглашения
            if (data && data.length > 0) {
                for (let invite of data) {
                    // Проверяем есть ли уже уведомление
                    if (!document.getElementById('multiplayer-invite-' + invite.id)) {
                        console.log('🔔 Найдено новое приглашение:', invite.id);
                        this.showMultiplayerInviteNotification(invite);
                    }
                }
            }
        } catch (error) {
            console.error('❌ Ошибка:', error);
        }
    }

    updateDisplayIfChanged() {
        // Проверяем, изменились ли данные перед отображением
        const friendsList = document.getElementById('friends-list');
        const requestsList = document.getElementById('requests-list');
        
        if (friendsList && friendsList.children.length !== this.friends.length) {
            this.displayFriends();
        }
        
        if (requestsList && requestsList.children.length !== this.incomingRequests.length) {
            this.displayRequests();
        }
    }

    stopAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
            console.log('⏹️ Автообновление остановлено');
        }
    }

    setupRealtimeSubscriptions() {
        const currentUser = window.authManager.getCurrentUser();
        if (!currentUser) return;

        const client = window.authManager?.supabase;
        if (!client) return;

        console.log('🔔 Настройка real-time подписок...');

        // Подписываемся на изменения в таблице friends
        const friendsChannel = client
            .channel('friends-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'friends',
                filter: `user_id=eq.${currentUser.id}`
            }, (payload) => {
                console.log('🔔 Изменение в друзьях:', payload);
                this.loadFriendsFromDatabase();
                // Обновляем только если есть видимые изменения
                setTimeout(() => this.displayFriends(), 100);
            })
            .subscribe();

        // Подписываемся на изменения в таблице friend_requests
        const requestsChannel = client
            .channel('requests-changes')
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'friend_requests',
                filter: `or(from_user_id.eq.${currentUser.id},to_user_id.eq.${currentUser.id})`
            }, (payload) => {
                console.log('🔔 Изменение в заявках:', payload);
                this.loadFriendsFromDatabase();
                // Обновляем только если есть видимые изменения
                setTimeout(() => {
                    this.displayRequests();
                    this.displayFriends();
                }, 100);
            })
            .subscribe();

        console.log('✅ Real-time подписки настроены');
    }

    async loadFriendsFromDatabase() {
        try {
            const currentUser = window.authManager.getCurrentUser();
            if (!currentUser) {
                console.log('👤 Пользователь не авторизован');
                return;
            }

            const client = window.authManager?.supabase;
            if (!client) {
                console.error('❌ Supabase client not ready');
                return;
            }

            // Получаем друзей из БД (упрощенный запрос)
            const { data: friendsData, error: friendsError } = await client
                .from('friends')
                .select('friend_id')
                .eq('user_id', currentUser.id);

            if (!friendsError && friendsData && friendsData.length > 0) {
                // Теперь получаем данные друзей
                const friendIds = friendsData.map(f => f.friend_id);
                const { data: usersData, error: usersError } = await client
                    .from('users')
                    .select('id, username, level, avatar_url, xp')
                    .in('id', friendIds);
                
                if (!usersError && usersData) {
                    this.friends = usersData.map(user => ({
                        id: user.id,
                        username: user.username,
                        level: user.level || 1,
                        avatar_url: user.avatar_url,
                        xp: user.xp || 0,
                        status: 'online',
                        lastSeen: new Date().toISOString()
                    }));
                    console.log('📋 Загружены друзья:', this.friends.length);
                }
            } else {
                this.friends = [];
                console.log('📋 Друзей не найдено');
            }

            // Получаем отправленные заявки
            const { data: sentData, error: sentError } = await client
                .from('friend_requests')
                .select('id, to_user_id, users!friend_requests_to_user_id_fkey(username)')
                .eq('from_user_id', currentUser.id)
                .eq('status', 'pending');

            if (!sentError && sentData) {
                this.sentRequests = sentData.map(r => ({
                    id: r.id,
                    targetUsername: r.users?.username || 'Unknown',
                    sentAt: new Date().toISOString()
                }));
                console.log('📤 Загружены отправленные заявки:', this.sentRequests.length);
            }

            // Получаем входящие заявки
            const { data: incomingData, error: incomingError } = await client
                .from('friend_requests')
                .select('id, from_user_id, users!friend_requests_from_user_id_fkey(username)')
                .eq('to_user_id', currentUser.id)
                .eq('status', 'pending');

            if (!incomingError && incomingData) {
                this.incomingRequests = incomingData.map(r => ({
                    id: r.id,
                    fromUsername: r.users?.username || 'Unknown',
                    createdAt: new Date().toISOString()
                }));
                console.log('📥 Загружены входящие заявки:', this.incomingRequests.length);
            }

        } catch (error) {
            console.error('Ошибка при загрузке данных друзей:', error);
        }
    }

    loadFriendsFromLocalStorage() {
        // Оставлено для совместимости, но теперь загружаем из БД
        console.log('Загрузка из localStorage (deprecated)');
    }

    saveFriendsToLocalStorage() {
        // Оставлено для совместимости, но теперь сохраняем в БД
        console.log('Сохранение в localStorage (deprecated)');
    }

    setupEventListeners() {
        const friendsBtn = document.getElementById('friends-btn');
        if (friendsBtn) {
            // Убираем старый обработчик если есть
            const newFriendsBtn = friendsBtn.cloneNode(true);
            friendsBtn.parentNode.replaceChild(newFriendsBtn, friendsBtn);
            
            newFriendsBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('👥 Нажата кнопка друзья');
                if (window.showScreen) {
                    window.showScreen('friends-screen');
                    this.displayFriends();
                }
            });
        }

        const addFriendBtn = document.getElementById('add-friend-btn');
        if (addFriendBtn) {
            // Убираем старый обработчик если есть
            const newBtn = addFriendBtn.cloneNode(true);
            addFriendBtn.parentNode.replaceChild(newBtn, addFriendBtn);
            
            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.sendFriendRequest();
            });
        }

        const friendInput = document.getElementById('friend-username-input');
        if (friendInput) {
            // Убираем старый обработчик если есть
            const newInput = friendInput.cloneNode(true);
            friendInput.parentNode.replaceChild(newInput, friendInput);
            
            newInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    e.stopPropagation();
                    this.sendFriendRequest();
                }
            });
        }

        // Обработчик кнопки "Назад" на экране друзей
        const friendsScreen = document.getElementById('friends-screen');
        if (friendsScreen) {
            const backBtn = friendsScreen.querySelector('.back-btn');
            if (backBtn) {
                backBtn.addEventListener('click', () => {
                    if (window.showScreen) {
                        window.showScreen('profile-screen');
                    }
                });
            }
        }
    }

    setupTabs() {
        const friendsTab = document.getElementById('friends-tab');
        const requestsTab = document.getElementById('requests-tab');

        if (friendsTab) {
            friendsTab.addEventListener('click', () => {
                this.switchTab('friends');
            });
        }

        if (requestsTab) {
            requestsTab.addEventListener('click', () => {
                this.switchTab('requests');
            });
        }
    }

    switchTab(tab) {
        const friendsTab = document.getElementById('friends-tab');
        const requestsTab = document.getElementById('requests-tab');
        const friendsContent = document.getElementById('friends-content');
        const requestsContent = document.getElementById('requests-content');

        // Обновляем активную вкладку
        if (tab === 'friends') {
            friendsTab?.classList.add('active');
            requestsTab?.classList.remove('active');
            friendsContent.style.display = 'block';
            requestsContent.style.display = 'none';
            this.displayFriends();
        } else {
            friendsTab?.classList.remove('active');
            requestsTab?.classList.add('active');
            friendsContent.style.display = 'none';
            requestsContent.style.display = 'block';
            this.displayRequests();
        }
    }

    async sendFriendRequest() {
        const input = document.getElementById('friend-username-input');
        const username = input.value.trim();

        if (!username) {
            alert('Введите ник друга!');
            return;
        }

        const currentUser = window.authManager.getCurrentUser();
        if (username.toLowerCase() === currentUser.username.toLowerCase()) {
            alert('❌ Вы не можете добавить себя в друзья!');
            return;
        }

        const client = window.authManager?.supabase;
        if (!client) {
            console.error('❌ Supabase client not ready');
            alert('🔌 Supabase не инициализирован. Попробуйте позже.');
            return;
        }

        try {
            // Убедимся, что текущий пользователь синхронизирован в public.users
            console.log('🔄 Проверяем синхронизацию текущего пользователя...');
            const { error: currentUserSyncError } = await client.rpc('sync_user_from_auth', { auth_user_id: currentUser.id });
            if (currentUserSyncError) {
                console.error('⚠️ Ошибка при синхронизации текущего пользователя:', currentUserSyncError);
                // Не прерываем, пользователь может быть уже синхронизирован
            }
            console.log('📤 Current user ID:', currentUser.id);
            console.log('📤 Current user:', currentUser);
            
            // Получаем ID целевого пользователя по нику
            const { data: targetUserData, error: userError } = await client
                .from('users')
                .select('id')
                .eq('username', username)
                .single();

            if (userError || !targetUserData) {
                alert('❌ Пользователь не найден!');
                console.error('User not found:', userError);
                return;
            }

            const targetUserId = targetUserData.id;
            console.log('📤 Target user ID:', targetUserId);
            
            // Синхронизируем целевого пользователя в public.users если его там нет
            console.log('🔄 Синхронизируем целевого пользователя...');
            const { error: syncError } = await client.rpc('sync_user_from_auth', { auth_user_id: targetUserId });
            if (syncError) {
                console.error('⚠️ Ошибка при синхронизации:', syncError);
                // Не прерываем процесс, т.к. пользователь может уже быть синхронизирован
            } else {
                console.log('✅ Пользователь синхронизирован');
            }
            
            // Убедимся, что оба пользователя существуют в public.users перед отправкой заявки
            const { data: currentUserCheck } = await client
                .from('users')
                .select('id')
                .eq('id', currentUser.id);
            
            console.log('🔍 Проверка текущего пользователя в public.users:', currentUserCheck);
            
            const { data: targetUserCheck } = await client
                .from('users')
                .select('id')
                .eq('id', targetUserId);
            
            console.log('🔍 Проверка целевого пользователя в public.users:', targetUserCheck);
            
            if (!currentUserCheck || currentUserCheck.length === 0) {
                console.error('❌ Текущий пользователь не найден в public.users');
                alert('❌ Ошибка: текущий пользователь не синхронизирован. Перезагрузите страницу.');
                return;
            }
            
            if (!targetUserCheck || targetUserCheck.length === 0) {
                console.error('❌ Целевой пользователь не найден в public.users');
                alert('❌ Ошибка: пользователь не может быть добавлен. Попробуйте позже.');
                return;
            }

            // Проверяем, не друзья ли уже
            const { data: friendshipData1 } = await client
                .from('friends')
                .select('id')
                .eq('user_id', currentUser.id)
                .eq('friend_id', targetUserId);

            const { data: friendshipData2 } = await client
                .from('friends')
                .select('id')
                .eq('user_id', targetUserId)
                .eq('friend_id', currentUser.id);

            if ((friendshipData1 && friendshipData1.length > 0) || (friendshipData2 && friendshipData2.length > 0)) {
                alert('❌ Этот пользователь уже в ваших друзьях!');
                return;
            }

            // Проверяем, не отправляли ли уже заявку
            const { data: existingRequest, error: checkError } = await client
                .from('friend_requests')
                .select('id, status')
                .eq('from_user_id', currentUser.id)
                .eq('to_user_id', targetUserId)
                .limit(1);

            console.log('🔍 Проверка существующих заявок:', existingRequest);
            console.log('🔍 Ошибка при проверке:', checkError);

            if (existingRequest && existingRequest.length > 0) {
                console.log('❌ Заявка уже существует в БД:', existingRequest[0]);
                alert('❌ Заявка этому пользователю уже отправлена!');
                return;
            }

            // Отправляем заявку в Supabase
            const { data: newRequest, error: insertError } = await client
                .from('friend_requests')
                .insert([
                    {
                        from_user_id: currentUser.id,
                        to_user_id: targetUserId,
                        status: 'pending'
                    }
                ])
                .select();

            if (insertError) {
                console.error('Ошибка при отправке заявки:', insertError);
                console.error('Error details:', {
                    message: insertError?.message,
                    details: insertError?.details,
                    hint: insertError?.hint,
                    code: insertError?.code
                });
                
                // Проверяем, не конфликт ли (409)
                if (insertError?.code === '23505') {
                    alert('❌ Заявка этому пользователю уже существует!');
                } else {
                    const errMsg = insertError?.message || insertError?.details || JSON.stringify(insertError);
                    alert(`❌ Ошибка при отправке заявки: ${errMsg}`);
                }
                return;
            }
            console.log('📤 Заявка отправлена:', username);
            alert(`✅ Заявка в друзья отправлена ${username}!`);
            
            input.value = '';
            await this.loadFriendsFromDatabase();
            this.displayFriends();
            this.displayRequests();

        } catch (error) {
            console.error('Ошибка при отправке заявки:', error);
            alert('❌ Ошибка при отправке заявки');
        }
    }

    async acceptRequest(requestId) {
        try {
            const client = window.authManager?.supabase;
            if (!client) {
                console.error('❌ Supabase client not ready');
                alert('🔌 Supabase не инициализирован');
                return;
            }

            // Вызываем функцию БД для принятия заявки
            const { data, error } = await client
                .rpc('accept_friend_request', { request_id: requestId });

            if (error) {
                console.error('Ошибка при принятии заявки:', error);
                alert('❌ Ошибка при принятии заявки');
                return;
            }

            console.log('✅ Заявка принята');
            await this.loadFriendsFromDatabase();
            this.displayRequests();
            this.displayFriends();

        } catch (error) {
            console.error('Ошибка:', error);
            alert('❌ Ошибка при принятии заявки');
        }
    }

    async rejectRequest(requestId) {
        try {
            const client = window.authManager?.supabase;
            if (!client) {
                console.error('❌ Supabase client not ready');
                alert('🔌 Supabase не инициализирован');
                return;
            }

            // Удаляем заявку полностью из БД вместо изменения статуса
            const { error: deleteError } = await client
                .from('friend_requests')
                .delete()
                .eq('id', requestId);

            if (deleteError) {
                console.error('Ошибка при отклонении заявки:', deleteError);
                alert('❌ Ошибка при отклонении заявки');
                return;
            }

            console.log('❌ Заявка отклонена и удалена');
            alert('✅ Заявка отклонена');
            await this.loadFriendsFromDatabase();
            this.displayRequests();

        } catch (error) {
            console.error('Ошибка:', error);
            alert('❌ Ошибка при отклонении заявки');
        }
    }

    async cancelSentRequest(requestId) {
        try {
            const client = window.authManager?.supabase;
            if (!client) {
                console.error('❌ Supabase client not ready');
                alert('🔌 Supabase не инициализирован');
                return;
            }

            // Удаляем заявку полностью из БД вместо изменения статуса
            const { error: deleteError } = await client
                .from('friend_requests')
                .delete()
                .eq('id', requestId);

            if (deleteError) {
                console.error('Ошибка при отмене заявки:', deleteError);
                alert('❌ Ошибка при отмене заявки');
                return;
            }

            console.log('❌ Заявка отменена и удалена');
            alert('✅ Заявка отменена');
            await this.loadFriendsFromDatabase();
            this.displayFriends();
            this.displayRequests();

        } catch (error) {
            console.error('Ошибка:', error);
            alert('❌ Ошибка при отмене заявки');
        }
    }

    async removeFriend(friendId) {
        if (confirm('Вы уверены? Этот друг будет удалён из ваших друзей.')) {
            try {
                const client = window.authManager?.supabase;
                if (!client) {
                    console.error('❌ Supabase client not ready');
                    alert('🔌 Supabase не инициализирован');
                    return;
                }

                const currentUser = window.authManager.getCurrentUser();
                
                // Удаляем дружбу в обе стороны
                await client
                    .from('friends')
                    .delete()
                    .eq('user_id', currentUser.id)
                    .eq('friend_id', friendId);

                await client
                    .from('friends')
                    .delete()
                    .eq('user_id', friendId)
                    .eq('friend_id', currentUser.id);

                console.log('❌ Друг удалён');
                await this.loadFriendsFromDatabase();
                this.displayFriends();

            } catch (error) {
                console.error('Ошибка:', error);
                alert('❌ Ошибка при удалении друга');
            }
        }
    }

    displayFriends() {
        const friendsList = document.getElementById('friends-list');
        const sentRequestsList = document.getElementById('sent-requests-list');
        const noFriendsMsg = document.getElementById('no-friends-message');

        if (!friendsList) return;

        // Отображаем друзей
        if (this.friends.length === 0) {
            friendsList.innerHTML = '';
            noFriendsMsg.style.display = 'block';
        } else {
            noFriendsMsg.style.display = 'none';
            friendsList.innerHTML = '';

            this.friends.forEach(friend => {
                const friendElement = document.createElement('div');
                friendElement.className = 'friend-card';
                friendElement.style.cssText = `
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 15px;
                    background: rgba(55, 48, 163, 0.1);
                    border: 1px solid rgba(124, 58, 237, 0.2);
                    border-radius: 12px;
                    backdrop-filter: blur(10px);
                    transition: all 0.3s ease;
                `;

                friendElement.innerHTML = `
                    <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                            <span style="font-size: 12px; color: #22c55e; display: inline-block;">● </span>
                            <strong style="color: #e9d5ff; font-size: 14px;">${friend.username}</strong>
                        </div>
                        <div style="display: flex; gap: 15px; font-size: 11px; color: #a78bfa;">
                            <span>🎖️ Уровень ${friend.level}</span>
                            <span id="status-${friend.id}">${this.getStatusText(friend.status)}</span>
                        </div>
                    </div>
                    <button class="btn secondary-btn" style="padding: 8px 12px; font-size: 12px; width: auto;" onclick="window.friendsManager.removeFriend('${friend.id}')">
                        Удалить
                    </button>
                `;

                friendsList.appendChild(friendElement);
            });
        }

        // Отображаем отправленные заявки
        if (sentRequestsList) {
            if (this.sentRequests.length === 0) {
                sentRequestsList.innerHTML = '';
            } else {
                sentRequestsList.innerHTML = '';

                this.sentRequests.forEach(request => {
                    const requestElement = document.createElement('div');
                    requestElement.className = 'request-card';
                    requestElement.style.cssText = `
                        display: flex;
                        align-items: center;
                        gap: 12px;
                        padding: 15px;
                        background: rgba(59, 130, 246, 0.1);
                        border: 1px solid rgba(59, 130, 246, 0.2);
                        border-radius: 12px;
                        backdrop-filter: blur(10px);
                        transition: all 0.3s ease;
                    `;

                    requestElement.innerHTML = `
                        <div style="flex: 1;">
                            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                                <span style="font-size: 12px; color: #f59e0b;">⏳ </span>
                                <strong style="color: #e9d5ff; font-size: 14px;">${request.targetUsername}</strong>
                            </div>
                            <div style="font-size: 11px; color: #a78bfa;">
                                Заявка ожидает ответа
                            </div>
                        </div>
                        <button class="btn secondary-btn" style="padding: 8px 12px; font-size: 12px; width: auto; background: rgba(239, 68, 68, 0.3); border-color: rgba(239, 68, 68, 0.5);" onclick="window.friendsManager.cancelSentRequest('${request.id}')">
                            Отменить
                        </button>
                    `;

                    sentRequestsList.appendChild(requestElement);
                });
            }
        }
    }

    displayRequests() {
        const requestsList = document.getElementById('requests-list');
        const noRequestsMsg = document.getElementById('no-requests-message');

        if (!requestsList) return;

        if (this.incomingRequests.length === 0) {
            requestsList.innerHTML = '';
            noRequestsMsg.style.display = 'block';
            return;
        }

        noRequestsMsg.style.display = 'none';
        requestsList.innerHTML = '';

        this.incomingRequests.forEach(request => {
            const requestElement = document.createElement('div');
            requestElement.className = 'incoming-request-card';
            requestElement.style.cssText = `
                display: flex;
                align-items: center;
                gap: 12px;
                padding: 15px;
                background: rgba(34, 197, 94, 0.1);
                border: 1px solid rgba(34, 197, 94, 0.2);
                border-radius: 12px;
                backdrop-filter: blur(10px);
                transition: all 0.3s ease;
            `;

            requestElement.innerHTML = `
                <div style="flex: 1;">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
                        <span style="font-size: 12px; color: #22c55e;">✨ </span>
                        <strong style="color: #e9d5ff; font-size: 14px;">${request.fromUsername}</strong>
                    </div>
                    <div style="font-size: 11px; color: #a78bfa;">
                        Хочет добавить вас в друзья
                    </div>
                </div>
                <div style="display: flex; gap: 8px;">
                    <button class="btn start-btn" style="padding: 8px 12px; font-size: 12px; width: auto;" onclick="window.friendsManager.acceptRequest('${request.id}')">
                        ✓ Принять
                    </button>
                    <button class="btn secondary-btn" style="padding: 8px 12px; font-size: 12px; width: auto; background: rgba(239, 68, 68, 0.3); border-color: rgba(239, 68, 68, 0.5);" onclick="window.friendsManager.rejectRequest('${request.id}')">
                        ✕ Отклонить
                    </button>
                </div>
            `;

            requestsList.appendChild(requestElement);
        });
    }

    getStatusDot(status) {
        const colors = {
            'online': '🟢',
            'offline': '⚫',
            'away': '🟡'
        };
        return colors[status] || '⚫';
    }

    getStatusText(status) {
        const texts = {
            'online': 'В сети',
            'offline': 'Не в сети',
            'away': 'Отошёл'
        };
        return texts[status] || 'Неизвестно';
    }

    getFriend(username) {
        return this.friends.find(f => f.username.toLowerCase() === username.toLowerCase());
    }

    getAllFriends() {
        return this.friends;
    }

    // ========== МУЛЬТИПЛЕЕР ФУНКЦИИ ==========

    // Отправить приглашение на игру в мультиплеере
    async sendMultiplayerInvite(friendId, maxQuestions = 10) {
        try {
            const currentUser = window.authManager?.getCurrentUser();
            if (!currentUser) {
                alert('Вы не авторизованы!');
                return false;
            }

            const client = window.authManager?.supabase;
            if (!client) return false;

            // Создаём приглашение на игру
            const { data, error } = await client
                .from('multiplayer_invites')
                .insert({
                    from_user_id: currentUser.id,
                    to_user_id: friendId,
                    status: 'pending',
                    max_questions: maxQuestions
                })
                .select()
                .single();

            if (error) {
                console.error('❌ Ошибка отправки приглашения:', error);
                alert('Ошибка отправки приглашения');
                return false;
            }

            console.log('✅ Приглашение отправлено:', data.id);
            alert('📨 Приглашение отправлено!');
            return data; // Возвращаем полный объект приглашения с ID
        } catch (error) {
            console.error('❌ Ошибка:', error);
            return false;
        }
    }

    // Получить входящие приглашения
    async getIncomingInvites() {
        try {
            const currentUser = window.authManager?.getCurrentUser();
            if (!currentUser) return [];

            const client = window.authManager?.supabase;
            if (!client) return [];

            const { data, error } = await client
                .from('multiplayer_invites')
                .select('*')
                .eq('to_user_id', currentUser.id)
                .eq('status', 'pending');

            if (error) {
                console.error('❌ Ошибка получения приглашений:', error);
                return [];
            }

            // Получаем информацию об отправителях
            for (let invite of data || []) {
                const sender = await this.getUserById(invite.from_user_id);
                invite.senderUsername = sender?.username || 'Неизвестный';
            }

            return data || [];
        } catch (error) {
            console.error('❌ Ошибка:', error);
            return [];
        }
    }

    // Принять приглашение на игру
    async acceptMultiplayerInvite(inviteId) {
        try {
            const client = window.authManager?.supabase;
            if (!client) return false;

            // Получаем приглашение
            const { data: invite, error: fetchError } = await client
                .from('multiplayer_invites')
                .select()
                .eq('id', inviteId)
                .single();

            if (fetchError || !invite) {
                console.error('❌ Приглашение не найдено');
                alert('Приглашение уже истекло');
                return false;
            }

            // Обновляем статус приглашения
            const { error: updateError } = await client
                .from('multiplayer_invites')
                .update({ status: 'accepted' })
                .eq('id', inviteId);

            if (updateError) {
                console.error('❌ Ошибка принятия приглашения:', updateError);
                return false;
            }

            console.log('✅ Приглашение принято');

            // Небольшая задержка чтобы гость успел присоединиться
            await new Promise(resolve => setTimeout(resolve, 500));

            // Создаём и запускаем игровую сессию
            const multiplayerMode = new MultiplayerMode();
            window.currentGameMode = multiplayerMode;
            
            await multiplayerMode.startAsGuest(invite);
            
            return true;
        } catch (error) {
            console.error('❌ Ошибка:', error);
            alert('Ошибка при принятии приглашения');
            return false;
        }
    }

    // Отклонить приглашение на игру
    async rejectMultiplayerInvite(inviteId) {
        try {
            const client = window.authManager?.supabase;
            if (!client) return false;

            const { error } = await client
                .from('multiplayer_invites')
                .update({ status: 'rejected' })
                .eq('id', inviteId);

            if (error) {
                console.error('❌ Ошибка отклонения приглашения:', error);
                return false;
            }

            console.log('✅ Приглашение отклонено');
            return true;
        } catch (error) {
            console.error('❌ Ошибка:', error);
            return false;
        }
    }

    // Получить пользователя по ID
    async getUserById(userId) {
        try {
            const client = window.authManager?.supabase;
            if (!client) return null;

            const { data, error } = await client
                .from('users')
                .select()
                .eq('id', userId)
                .single();

            if (error) {
                console.error('❌ Ошибка получения пользователя:', error);
                return null;
            }

            return data;
        } catch (error) {
            console.error('❌ Ошибка:', error);
            return null;
        }
    }

    // Слушатель для уведомлений о приглашениях
    setupMultiplayerInviteListener() {
        const currentUser = window.authManager?.getCurrentUser();
        if (!currentUser) return;

        const client = window.authManager?.supabase;
        if (!client) return;

        console.log('🔔 Настройка слушателя приглашений мультиплеера...');

        const channel = client
            .channel('multiplayer-invites')
            .on('postgres_changes', {
                event: 'INSERT',
                schema: 'public',
                table: 'multiplayer_invites',
                filter: `to_user_id=eq.${currentUser.id}`
            }, (payload) => {
                console.log('🔔 Новое приглашение на мультиплеер:', payload.new);
                this.showMultiplayerInviteNotification(payload.new);
            })
            .subscribe();

        console.log('✅ Слушатель приглашений установлен');
    }

    // Показать уведомление о приглашении
    async showMultiplayerInviteNotification(invite) {
        // Проверяем, что это не наше собственное приглашение (мы не должны видеть приглашение, которое мы отправили)
        const currentUser = window.authManager?.getCurrentUser();
        if (currentUser && invite.from_user_id === currentUser.id) {
            console.log('ℹ️ Игнорируем собственное приглашение (мы отправитель)');
            return;
        }

        // Получаем информацию об отправителе
        const sender = await this.getUserById(invite.from_user_id);
        const senderName = sender?.username || 'Неизвестный';

        // Создаём уведомление
        const notificationId = 'multiplayer-invite-' + invite.id;
        
        // Проверяем, есть ли уже уведомление
        if (document.getElementById(notificationId)) return;

        const notification = document.createElement('div');
        notification.id = notificationId;
        notification.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: linear-gradient(135deg, rgba(102, 126, 234, 0.95) 0%, rgba(118, 75, 162, 0.95) 100%);
            border: 2px solid #667eea;
            border-radius: 12px;
            padding: 20px;
            color: white;
            z-index: 10000;
            max-width: 90vw;
            width: 350px;
            box-shadow: 0 8px 32px rgba(102, 126, 234, 0.5);
            animation: slideIn 0.3s ease;
        `;

        notification.innerHTML = `
            <div style="margin-bottom: 10px;">
                <p style="margin: 0; font-weight: bold; color: #e9d5ff;">👥 ${senderName}</p>
                <p style="margin: 5px 0 0 0; color: #c4b5fd; font-size: 14px;">Приглашает на ${invite.max_questions} вопросов</p>
            </div>
            <div style="display: flex; gap: 10px;">
                <button onclick="window.friendsManager.acceptMultiplayerInvite('${invite.id}'); this.parentElement.parentElement.remove();" 
                        style="flex: 1; padding: 8px 12px; background: #22c55e; border: none; border-radius: 6px; color: white; cursor: pointer; font-weight: bold;">
                    Принять
                </button>
                <button onclick="window.friendsManager.rejectMultiplayerInvite('${invite.id}'); this.parentElement.parentElement.remove();"
                        style="flex: 1; padding: 8px 12px; background: rgba(239, 68, 68, 0.5); border: 1px solid rgba(239, 68, 68, 0.7); border-radius: 6px; color: white; cursor: pointer; font-weight: bold;">
                    Отклонить
                </button>
            </div>
        `;

        document.body.appendChild(notification);

        // Удаляем уведомление через 30 секунд
        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 30000);
    }
}

// Инициализация
console.log('🚀 Начинаем инициализацию friendsManager...');

if (!window.friendsManager) {
    window.friendsManager = new FriendsManager();
    console.log('✅ FriendsManager создан');
} else {
    console.warn('⚠️ FriendsManager уже существует');
}

console.log('✅ friendsManager.js loaded');
console.log('📋 window.friendsManager:', window.friendsManager);
