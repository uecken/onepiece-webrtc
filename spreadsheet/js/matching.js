/**
 * Matching Screen Logic - Google Spreadsheet Version
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

    // Initialize Spreadsheet service
    const spreadsheetService = new SpreadsheetService();

    // Current state
    let currentIslandId = null;
    let islandPollingId = null;

    /**
     * Render islands list
     * @param {Array} islands - Islands data
     */
    function renderIslands(islands) {
        islandsListEl.innerHTML = '';

        if (islands.length === 0) {
            islandsListEl.innerHTML = '<p class="no-islands">島がありません</p>';
            return;
        }

        islands.forEach(island => {
            const islandCard = document.createElement('div');
            islandCard.className = `island-card ${getStatusClass(island.status)}`;
            islandCard.dataset.islandId = island.id;

            const isOwnWaiting = island.waitingUser === userId;

            islandCard.innerHTML = `
                <div class="island-image">
                    <div class="island-icon">${getIslandEmoji(island.id)}</div>
                </div>
                <div class="island-info">
                    <h3 class="island-name">${island.name}</h3>
                    <p class="island-description">${getIslandDescription(island.id)}</p>
                    <span class="status-badge ${getStatusClass(island.status)}">
                        ${isOwnWaiting ? 'あなたが待機中' : getStatusText(island.status)}
                    </span>
                </div>
            `;

            if (!isOwnWaiting) {
                islandCard.addEventListener('click', () => handleIslandClick(island));
            }

            islandsListEl.appendChild(islandCard);
        });
    }

    /**
     * Get island emoji
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
     * Get island description
     */
    function getIslandDescription(islandId) {
        const config = ISLAND_CONFIG.find(i => i.id === islandId);
        return config ? config.description : '';
    }

    /**
     * Handle island card click
     */
    async function handleIslandClick(island) {
        if (island.status === 'in_battle') {
            alert('この島では対戦中です。他の島を選んでください。');
            return;
        }

        if (island.status === 'waiting' && island.waitingUser !== userId) {
            try {
                const battleId = await spreadsheetService.createBattle(
                    island.id,
                    island.waitingUser,
                    userId
                );
                navigateToBattle(battleId, 'joiner');
            } catch (error) {
                console.error('Error joining battle:', error);
                showError('対戦への参加に失敗しました。');
            }
            return;
        }

        try {
            currentIslandId = island.id;
            await spreadsheetService.enterIsland(island.id, userId);

            waitingIslandName.textContent = island.name;
            waitingModal.classList.remove('hidden');

            // Start polling for island updates
            islandPollingId = spreadsheetService.startIslandPolling(island.id, async (updatedIsland) => {
                if (!updatedIsland) return;

                if (updatedIsland.status === 'in_battle' && updatedIsland.currentBattleId) {
                    navigateToBattle(updatedIsland.currentBattleId, 'creator');
                }

                if (updatedIsland.status === 'empty' ||
                    (updatedIsland.status === 'waiting' && updatedIsland.waitingUser !== userId)) {
                    waitingModal.classList.add('hidden');
                    currentIslandId = null;
                }
            });

        } catch (error) {
            console.error('Error entering island:', error);
            showError('島への入室に失敗しました。');
            currentIslandId = null;
        }
    }

    /**
     * Cancel waiting
     */
    async function cancelWaiting() {
        if (currentIslandId) {
            try {
                await spreadsheetService.leaveIsland(currentIslandId, userId);
            } catch (error) {
                console.error('Error leaving island:', error);
            }
            currentIslandId = null;
        }

        spreadsheetService.stopAllPolling();
        waitingModal.classList.add('hidden');

        // Restart islands polling
        spreadsheetService.startIslandsPolling((islands) => {
            renderIslands(islands);
        });
    }

    /**
     * Update connection status display
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

    window.addEventListener('beforeunload', async () => {
        if (currentIslandId) {
            await spreadsheetService.leaveIsland(currentIslandId, userId);
        }
        spreadsheetService.cleanup();
    });

    // Initialize
    try {
        // Check if GAS URL is configured
        if (GAS_WEB_APP_URL.includes('YOUR_DEPLOYMENT_ID')) {
            islandsListEl.innerHTML = `
                <div class="error-state">
                    <p>設定エラー</p>
                    <p class="error-detail">js/config.jsのGAS_WEB_APP_URLを設定してください。<br>
                    詳細はREADME.mdを参照してください。</p>
                </div>
            `;
            return;
        }

        updateConnectionStatus(true);

        // Start polling for islands
        spreadsheetService.startIslandsPolling((islands) => {
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
