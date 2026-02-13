/**
 * Matching Screen Logic
 * Handles island selection and waiting for opponents
 */

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const islandsListEl = document.getElementById('islands-list');
    const waitingModal = document.getElementById('waiting-modal');
    const waitingIslandName = document.getElementById('waiting-island-name');
    const cancelWaitingBtn = document.getElementById('cancel-waiting');
    const connectionStatus = document.getElementById('connection-status');
    const statusDot = document.getElementById('status-dot');
    const userIdDisplay = document.getElementById('user-id-display');

    // Get or create user ID
    const userId = getOrCreateUserId();
    userIdDisplay.textContent = userId.substring(0, 12) + '...';

    // Initialize Firebase service
    const firebaseService = new FirebaseService();

    // Current state
    let currentIslandId = null;
    let islandSubscription = null;

    /**
     * Render islands list
     * @param {Array} islands - Islands data
     */
    function renderIslands(islands) {
        // Clear loading state
        islandsListEl.innerHTML = '';

        if (islands.length === 0) {
            islandsListEl.innerHTML = '<p class="no-islands">島がありません</p>';
            return;
        }

        islands.forEach(island => {
            const islandCard = document.createElement('div');
            islandCard.className = `island-card ${getStatusClass(island.status)}`;
            islandCard.dataset.islandId = island.id;

            // Check if this user is waiting in this island
            const isOwnWaiting = island.waitingUser === userId;

            // Create elements safely (XSS prevention)
            const imageDiv = document.createElement('div');
            imageDiv.className = 'island-image';
            const iconDiv = document.createElement('div');
            iconDiv.className = 'island-icon';
            iconDiv.textContent = getIslandEmoji(island.id);
            imageDiv.appendChild(iconDiv);

            const infoDiv = document.createElement('div');
            infoDiv.className = 'island-info';

            const nameEl = document.createElement('h3');
            nameEl.className = 'island-name';
            nameEl.textContent = island.name;

            const descEl = document.createElement('p');
            descEl.className = 'island-description';
            descEl.textContent = island.description || '';

            const statusEl = document.createElement('span');
            statusEl.className = `status-badge ${getStatusClass(island.status)}`;
            statusEl.textContent = isOwnWaiting ? 'あなたが待機中' : getStatusText(island.status);

            infoDiv.appendChild(nameEl);
            infoDiv.appendChild(descEl);
            infoDiv.appendChild(statusEl);

            islandCard.appendChild(imageDiv);
            islandCard.appendChild(infoDiv);

            // Add click handler
            if (!isOwnWaiting) {
                islandCard.addEventListener('click', () => handleIslandClick(island));
            }

            islandsListEl.appendChild(islandCard);
        });
    }

    /**
     * Get island emoji based on ID
     * @param {string} islandId - Island ID
     * @returns {string} Emoji
     */
    function getIslandEmoji(islandId) {
        const emojis = {
            'east-blue': '🌊',
            'grand-line': '⚓',
            'new-world': '🔥',
            'wano': '⛩️',
            'skypiea': '☁️'
        };
        return emojis[islandId] || '🏝️';
    }

    /**
     * Handle island card click
     * @param {Object} island - Island data
     */
    async function handleIslandClick(island) {
        // Can't join if in battle
        if (island.status === 'in_battle') {
            alert('この島では対戦中です。他の島を選んでください。');
            return;
        }

        // If someone is waiting, join them
        if (island.status === 'waiting' && island.waitingUser !== userId) {
            try {
                // Create battle
                const battleId = await firebaseService.createBattle(
                    island.id,
                    island.waitingUser,
                    userId
                );

                // Navigate to battle screen as joiner
                navigateToBattle(battleId, 'joiner');
            } catch (error) {
                console.error('Error joining battle:', error);
                showError('対戦への参加に失敗しました。もう一度お試しください。');
            }
            return;
        }

        // Enter empty island and wait
        try {
            currentIslandId = island.id;
            await firebaseService.enterIsland(island.id, userId);

            // Show waiting modal
            waitingIslandName.textContent = island.name;
            waitingModal.classList.remove('hidden');

            // Subscribe to island changes to detect when someone joins
            islandSubscription = firebaseService.subscribeToIsland(island.id, async (updatedIsland) => {
                // Check if battle started
                if (updatedIsland.status === 'in_battle' && updatedIsland.currentBattleId) {
                    // Navigate to battle screen as creator
                    navigateToBattle(updatedIsland.currentBattleId, 'creator');
                }

                // Check if we were removed (someone else took over)
                if (updatedIsland.status === 'empty' ||
                    (updatedIsland.status === 'waiting' && updatedIsland.waitingUser !== userId)) {
                    waitingModal.classList.add('hidden');
                    currentIslandId = null;
                }
            });

        } catch (error) {
            console.error('Error entering island:', error);
            showError('島への入室に失敗しました。もう一度お試しください。');
            currentIslandId = null;
        }
    }

    /**
     * Cancel waiting
     */
    async function cancelWaiting() {
        if (currentIslandId) {
            try {
                await firebaseService.leaveIsland(currentIslandId, userId);
            } catch (error) {
                console.error('Error leaving island:', error);
            }
            currentIslandId = null;
        }

        // Unsubscribe from island updates
        if (islandSubscription) {
            islandSubscription();
            islandSubscription = null;
        }

        waitingModal.classList.add('hidden');
    }

    /**
     * Update connection status display
     * @param {boolean} connected - Connection state
     */
    function updateConnectionStatus(connected) {
        if (connected) {
            statusDot.classList.add('connected');
            connectionStatus.textContent = '接続済み';
        } else {
            statusDot.classList.remove('connected');
            connectionStatus.textContent = '接続中...';
        }
    }

    // Event Listeners
    cancelWaitingBtn.addEventListener('click', cancelWaiting);

    // Handle page unload - leave island if waiting
    window.addEventListener('beforeunload', async (event) => {
        if (currentIslandId) {
            // Use sendBeacon for reliable cleanup
            const data = JSON.stringify({
                action: 'leave',
                islandId: currentIslandId,
                userId: userId
            });
            // Note: For production, you'd need a backend endpoint
            // For now, we'll rely on Firebase rules and TTL
            await firebaseService.leaveIsland(currentIslandId, userId);
        }
    });

    // Handle visibility change (mobile browser tab switch)
    document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'hidden' && currentIslandId) {
            // Optional: Leave island when app goes to background
            // Uncomment if you want this behavior:
            // await cancelWaiting();
        }
    });

    // Initialize
    try {
        await firebaseService.init();
        updateConnectionStatus(true);

        // Subscribe to islands
        firebaseService.subscribeToIslands((islands) => {
            renderIslands(islands);
        });

    } catch (error) {
        console.error('Initialization error:', error);
        updateConnectionStatus(false);
        islandsListEl.innerHTML = `
            <div class="error-state">
                <p>接続エラー</p>
                <p class="error-detail">${error.message}</p>
                <button class="btn primary" onclick="location.reload()">再読み込み</button>
            </div>
        `;
    }
});
