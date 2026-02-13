/**
 * Spreadsheet Service
 * Handles all Google Apps Script API calls for signaling and room management
 */
class SpreadsheetService {
    constructor() {
        this.pollingIntervals = [];
    }

    /**
     * Make API request to Google Apps Script
     * @param {string} method - HTTP method
     * @param {Object} params - Request parameters
     * @returns {Promise<Object>} Response data
     */
    async request(method, params) {
        try {
            let url = GAS_WEB_APP_URL;
            let options = {
                method: method
            };

            if (method === 'GET') {
                // GETリクエストはシンプルリクエストにする（ヘッダーなし）
                const queryString = new URLSearchParams(params).toString();
                url += '?' + queryString;
            } else {
                // POSTリクエストはtext/plainでCORSプリフライトを回避
                options.headers = {
                    'Content-Type': 'text/plain'
                };
                options.body = JSON.stringify(params);
            }

            const response = await fetch(url, options);
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            return data;
        } catch (error) {
            console.error('API request failed:', error);
            throw error;
        }
    }

    /**
     * Get all islands
     * @returns {Promise<Array>} Islands array
     */
    async getIslands() {
        const data = await this.request('GET', { action: 'getIslands' });
        return data.islands || [];
    }

    /**
     * Get a specific island
     * @param {string} islandId - Island ID
     * @returns {Promise<Object>} Island data
     */
    async getIsland(islandId) {
        const data = await this.request('GET', { action: 'getIsland', islandId: islandId });
        return data.island;
    }

    /**
     * Start polling for islands updates
     * @param {Function} callback - Callback function receiving islands array
     * @returns {number} Interval ID
     */
    startIslandsPolling(callback) {
        // Initial fetch
        this.getIslands().then(callback).catch(console.error);

        // Set up polling
        const intervalId = setInterval(async () => {
            try {
                const islands = await this.getIslands();
                callback(islands);
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, POLLING_INTERVAL);

        this.pollingIntervals.push(intervalId);
        return intervalId;
    }

    /**
     * Start polling for island updates
     * @param {string} islandId - Island ID
     * @param {Function} callback - Callback function
     * @returns {number} Interval ID
     */
    startIslandPolling(islandId, callback) {
        // Initial fetch
        this.getIsland(islandId).then(callback).catch(console.error);

        const intervalId = setInterval(async () => {
            try {
                const island = await this.getIsland(islandId);
                callback(island);
            } catch (error) {
                console.error('Island polling error:', error);
            }
        }, POLLING_INTERVAL);

        this.pollingIntervals.push(intervalId);
        return intervalId;
    }

    /**
     * Enter an island (start waiting)
     * @param {string} islandId - Island ID
     * @param {string} userId - User ID
     */
    async enterIsland(islandId, userId) {
        await this.request('POST', {
            action: 'enterIsland',
            islandId: islandId,
            userId: userId
        });
        console.log(`User ${userId} entered island ${islandId}`);
    }

    /**
     * Leave an island
     * @param {string} islandId - Island ID
     * @param {string} userId - User ID
     */
    async leaveIsland(islandId, userId) {
        await this.request('POST', {
            action: 'leaveIsland',
            islandId: islandId,
            userId: userId
        });
        console.log(`User ${userId} left island ${islandId}`);
    }

    /**
     * Create a battle
     * @param {string} islandId - Island ID
     * @param {string} creatorId - Creator user ID
     * @param {string} joinerId - Joiner user ID
     * @returns {string} Battle ID
     */
    async createBattle(islandId, creatorId, joinerId) {
        const data = await this.request('POST', {
            action: 'createBattle',
            islandId: islandId,
            creatorId: creatorId,
            joinerId: joinerId
        });
        console.log(`Battle ${data.battleId} created`);
        return data.battleId;
    }

    /**
     * Get signaling data
     * @param {string} battleId - Battle ID
     * @returns {Promise<Object>} Signaling data {offer, answer}
     */
    async getSignaling(battleId) {
        return await this.request('GET', { action: 'getSignaling', battleId: battleId });
    }

    /**
     * Start polling for signaling offer
     * @param {string} battleId - Battle ID
     * @param {Function} callback - Callback function
     * @returns {number} Interval ID
     */
    startOfferPolling(battleId, callback) {
        let lastOffer = null;

        const intervalId = setInterval(async () => {
            try {
                const data = await this.getSignaling(battleId);
                if (data.offer && JSON.stringify(data.offer) !== JSON.stringify(lastOffer)) {
                    lastOffer = data.offer;
                    callback(data.offer);
                }
            } catch (error) {
                console.error('Offer polling error:', error);
            }
        }, 1000);  // Faster polling for signaling

        this.pollingIntervals.push(intervalId);
        return intervalId;
    }

    /**
     * Start polling for signaling answer
     * @param {string} battleId - Battle ID
     * @param {Function} callback - Callback function
     * @returns {number} Interval ID
     */
    startAnswerPolling(battleId, callback) {
        let lastAnswer = null;

        const intervalId = setInterval(async () => {
            try {
                const data = await this.getSignaling(battleId);
                if (data.answer && JSON.stringify(data.answer) !== JSON.stringify(lastAnswer)) {
                    lastAnswer = data.answer;
                    callback(data.answer);
                }
            } catch (error) {
                console.error('Answer polling error:', error);
            }
        }, 1000);

        this.pollingIntervals.push(intervalId);
        return intervalId;
    }

    /**
     * Write SDP offer
     * @param {string} battleId - Battle ID
     * @param {Object} offer - SDP offer
     * @param {string} userId - User ID
     */
    async writeOffer(battleId, offer, userId) {
        await this.request('POST', {
            action: 'writeOffer',
            battleId: battleId,
            sdp: offer.sdp,
            userId: userId
        });
        console.log('Offer written to Spreadsheet');
    }

    /**
     * Write SDP answer
     * @param {string} battleId - Battle ID
     * @param {Object} answer - SDP answer
     * @param {string} userId - User ID
     */
    async writeAnswer(battleId, answer, userId) {
        await this.request('POST', {
            action: 'writeAnswer',
            battleId: battleId,
            sdp: answer.sdp,
            userId: userId
        });
        console.log('Answer written to Spreadsheet');
    }

    /**
     * Get ICE candidates
     * @param {string} battleId - Battle ID
     * @param {string} excludeUserId - User ID to exclude
     * @returns {Promise<Array>} ICE candidates
     */
    async getIceCandidates(battleId, excludeUserId) {
        const data = await this.request('GET', {
            action: 'getIceCandidates',
            battleId: battleId,
            excludeUserId: excludeUserId
        });
        return data.candidates || [];
    }

    /**
     * Start polling for ICE candidates
     * @param {string} battleId - Battle ID
     * @param {string} excludeUserId - User ID to exclude
     * @param {Function} callback - Callback for each new candidate
     * @returns {number} Interval ID
     */
    startIceCandidatesPolling(battleId, excludeUserId, callback) {
        const processedCandidates = new Set();

        const intervalId = setInterval(async () => {
            try {
                const candidates = await this.getIceCandidates(battleId, excludeUserId);
                candidates.forEach(candidate => {
                    const key = JSON.stringify(candidate);
                    if (!processedCandidates.has(key)) {
                        processedCandidates.add(key);
                        callback(candidate);
                    }
                });
            } catch (error) {
                console.error('ICE candidates polling error:', error);
            }
        }, 1000);

        this.pollingIntervals.push(intervalId);
        return intervalId;
    }

    /**
     * Write ICE candidate
     * @param {string} battleId - Battle ID
     * @param {RTCIceCandidate} candidate - ICE candidate
     * @param {string} userId - User ID
     */
    async writeIceCandidate(battleId, candidate, userId) {
        await this.request('POST', {
            action: 'writeIceCandidate',
            battleId: battleId,
            candidate: candidate.candidate,
            sdpMid: candidate.sdpMid,
            sdpMLineIndex: candidate.sdpMLineIndex,
            userId: userId
        });
        console.log('ICE candidate written to Spreadsheet');
    }

    /**
     * End battle
     * @param {string} battleId - Battle ID
     * @param {string} islandId - Island ID
     */
    async endBattle(battleId, islandId) {
        await this.request('POST', {
            action: 'endBattle',
            battleId: battleId,
            islandId: islandId
        });
        console.log(`Battle ${battleId} ended`);
    }

    /**
     * Get battle information
     * @param {string} battleId - Battle ID
     * @returns {Promise<Object|null>} Battle data or null
     */
    async getBattle(battleId) {
        const data = await this.request('GET', { action: 'getBattle', battleId: battleId });
        return data.battle;
    }

    /**
     * Update battle status
     * @param {string} battleId - Battle ID
     * @param {string} status - New status
     */
    async updateBattleStatus(battleId, status) {
        await this.request('POST', {
            action: 'updateBattleStatus',
            battleId: battleId,
            status: status
        });
        console.log(`Battle ${battleId} status updated to ${status}`);
    }

    /**
     * Start polling for battle updates
     * @param {string} battleId - Battle ID
     * @param {Function} callback - Callback function
     * @returns {number} Interval ID
     */
    startBattlePolling(battleId, callback) {
        let lastStatus = null;

        // Initial fetch
        this.getBattle(battleId).then(battle => {
            if (battle) {
                lastStatus = battle.status;
                callback(battle);
            }
        }).catch(console.error);

        const intervalId = setInterval(async () => {
            try {
                const battle = await this.getBattle(battleId);
                if (battle && battle.status !== lastStatus) {
                    lastStatus = battle.status;
                    callback(battle);
                }
            } catch (error) {
                console.error('Battle polling error:', error);
            }
        }, POLLING_INTERVAL);

        this.pollingIntervals.push(intervalId);
        return intervalId;
    }

    /**
     * Stop all polling
     */
    stopAllPolling() {
        this.pollingIntervals.forEach(id => clearInterval(id));
        this.pollingIntervals = [];
        console.log('All polling stopped');
    }

    /**
     * Cleanup
     */
    cleanup() {
        this.stopAllPolling();
    }
}
