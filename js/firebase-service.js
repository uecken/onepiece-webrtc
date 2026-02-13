/**
 * Firebase Service
 * Handles all Firebase Firestore operations for signaling and room management
 */
class FirebaseService {
    constructor() {
        this.db = null;
        this.unsubscribers = [];
        this.initialized = false;
    }

    /**
     * Initialize Firebase
     */
    async init() {
        if (this.initialized) return;

        try {
            // Initialize Firebase app
            if (!firebase.apps.length) {
                firebase.initializeApp(firebaseConfig);
            }

            this.db = firebase.firestore();
            this.initialized = true;
            console.log('Firebase initialized successfully');

            // Initialize islands if they don't exist
            await this.initializeIslands();
        } catch (error) {
            console.error('Firebase initialization failed:', error);
            throw error;
        }
    }

    /**
     * Initialize islands in Firestore (run once or check on load)
     */
    async initializeIslands() {
        const islandsRef = this.db.collection('islands');

        for (const island of ISLAND_CONFIG) {
            const doc = await islandsRef.doc(island.id).get();
            if (!doc.exists) {
                await islandsRef.doc(island.id).set({
                    name: island.name,
                    description: island.description,
                    status: 'empty',
                    waitingUser: null,
                    users: [],
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                console.log(`Island ${island.id} created`);
            }
        }
    }

    /**
     * Subscribe to islands list changes
     * @param {Function} callback - Callback function receiving islands array
     * @returns {Function} Unsubscribe function
     */
    subscribeToIslands(callback) {
        const unsubscribe = this.db.collection('islands')
            .orderBy('createdAt')
            .onSnapshot(
                (snapshot) => {
                    const islands = [];
                    snapshot.forEach(doc => {
                        islands.push({ id: doc.id, ...doc.data() });
                    });
                    callback(islands);
                },
                (error) => {
                    console.error('Error subscribing to islands:', error);
                    showError('接続エラーが発生しました。ページをリロードしてください。');
                }
            );

        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Subscribe to a specific island
     * @param {string} islandId - Island ID
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribeToIsland(islandId, callback) {
        const unsubscribe = this.db.collection('islands').doc(islandId)
            .onSnapshot(
                (doc) => {
                    if (doc.exists) {
                        callback({ id: doc.id, ...doc.data() });
                    }
                },
                (error) => {
                    console.error('Error subscribing to island:', error);
                }
            );

        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Enter an island (start waiting)
     * @param {string} islandId - Island ID
     * @param {string} userId - User ID
     */
    async enterIsland(islandId, userId) {
        const islandRef = this.db.collection('islands').doc(islandId);

        await islandRef.update({
            status: 'waiting',
            waitingUser: userId,
            users: [userId]
        });

        console.log(`User ${userId} entered island ${islandId}`);
    }

    /**
     * Leave an island
     * @param {string} islandId - Island ID
     * @param {string} userId - User ID
     */
    async leaveIsland(islandId, userId) {
        const islandRef = this.db.collection('islands').doc(islandId);
        const doc = await islandRef.get();

        if (doc.exists && doc.data().waitingUser === userId) {
            await islandRef.update({
                status: 'empty',
                waitingUser: null,
                users: []
            });
            console.log(`User ${userId} left island ${islandId}`);
        }
    }

    /**
     * Create a battle when second user joins
     * @param {string} islandId - Island ID
     * @param {string} creatorId - User who was waiting
     * @param {string} joinerId - User who joined
     * @returns {string} Battle ID
     */
    async createBattle(islandId, creatorId, joinerId) {
        const battleId = generateBattleId();

        // Create battle document
        await this.db.collection('battles').doc(battleId).set({
            islandId: islandId,
            creatorId: creatorId,
            joinerId: joinerId,
            status: 'connecting',
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        // Update island status
        await this.db.collection('islands').doc(islandId).update({
            status: 'in_battle',
            users: [creatorId, joinerId],
            currentBattleId: battleId
        });

        console.log(`Battle ${battleId} created for island ${islandId}`);
        return battleId;
    }

    /**
     * Find battle by island and user
     * @param {string} islandId - Island ID
     * @param {string} userId - User ID
     * @returns {string|null} Battle ID
     */
    async findBattleByIsland(islandId, userId) {
        const island = await this.db.collection('islands').doc(islandId).get();
        if (island.exists && island.data().currentBattleId) {
            return island.data().currentBattleId;
        }
        return null;
    }

    /**
     * Get battle document
     * @param {string} battleId - Battle ID
     * @returns {Object|null} Battle data
     */
    async getBattle(battleId) {
        const doc = await this.db.collection('battles').doc(battleId).get();
        if (doc.exists) {
            return { id: doc.id, ...doc.data() };
        }
        return null;
    }

    /**
     * Subscribe to battle updates
     * @param {string} battleId - Battle ID
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribeToBattle(battleId, callback) {
        const unsubscribe = this.db.collection('battles').doc(battleId)
            .onSnapshot(
                (doc) => {
                    if (doc.exists) {
                        callback({ id: doc.id, ...doc.data() });
                    }
                },
                (error) => {
                    console.error('Error subscribing to battle:', error);
                }
            );

        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Write SDP offer
     * @param {string} battleId - Battle ID
     * @param {Object} offer - SDP offer
     * @param {string} userId - User ID
     */
    async writeOffer(battleId, offer, userId) {
        await this.db.collection('signaling').doc(battleId).set({
            offer: {
                sdp: offer.sdp,
                type: offer.type,
                fromUserId: userId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });

        console.log('Offer written to Firebase');
    }

    /**
     * Subscribe to offer
     * @param {string} battleId - Battle ID
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribeToOffer(battleId, callback) {
        const unsubscribe = this.db.collection('signaling').doc(battleId)
            .onSnapshot(
                (doc) => {
                    if (doc.exists && doc.data().offer) {
                        callback(doc.data().offer);
                    }
                },
                (error) => {
                    console.error('Error subscribing to offer:', error);
                }
            );

        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Write SDP answer
     * @param {string} battleId - Battle ID
     * @param {Object} answer - SDP answer
     * @param {string} userId - User ID
     */
    async writeAnswer(battleId, answer, userId) {
        await this.db.collection('signaling').doc(battleId).set({
            answer: {
                sdp: answer.sdp,
                type: answer.type,
                fromUserId: userId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }
        }, { merge: true });

        console.log('Answer written to Firebase');
    }

    /**
     * Subscribe to answer
     * @param {string} battleId - Battle ID
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribeToAnswer(battleId, callback) {
        const unsubscribe = this.db.collection('signaling').doc(battleId)
            .onSnapshot(
                (doc) => {
                    if (doc.exists && doc.data().answer) {
                        callback(doc.data().answer);
                    }
                },
                (error) => {
                    console.error('Error subscribing to answer:', error);
                }
            );

        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Write ICE candidate
     * @param {string} battleId - Battle ID
     * @param {RTCIceCandidate} candidate - ICE candidate
     * @param {string} userId - User ID
     */
    async writeIceCandidate(battleId, candidate, userId) {
        await this.db.collection('signaling').doc(battleId)
            .collection('iceCandidates').add({
                candidate: candidate.candidate,
                sdpMid: candidate.sdpMid,
                sdpMLineIndex: candidate.sdpMLineIndex,
                fromUserId: userId,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });

        console.log('ICE candidate written to Firebase');
    }

    /**
     * Subscribe to ICE candidates
     * @param {string} battleId - Battle ID
     * @param {string} excludeUserId - User ID to exclude (own candidates)
     * @param {Function} callback - Callback function
     * @returns {Function} Unsubscribe function
     */
    subscribeToIceCandidates(battleId, excludeUserId, callback) {
        const unsubscribe = this.db.collection('signaling').doc(battleId)
            .collection('iceCandidates')
            .where('fromUserId', '!=', excludeUserId)
            .onSnapshot(
                (snapshot) => {
                    snapshot.docChanges().forEach(change => {
                        if (change.type === 'added') {
                            const data = change.doc.data();
                            callback({
                                candidate: data.candidate,
                                sdpMid: data.sdpMid,
                                sdpMLineIndex: data.sdpMLineIndex
                            });
                        }
                    });
                },
                (error) => {
                    console.error('Error subscribing to ICE candidates:', error);
                }
            );

        this.unsubscribers.push(unsubscribe);
        return unsubscribe;
    }

    /**
     * Update battle status
     * @param {string} battleId - Battle ID
     * @param {string} status - New status
     */
    async updateBattleStatus(battleId, status) {
        await this.db.collection('battles').doc(battleId).update({
            status: status
        });
    }

    /**
     * End battle and cleanup
     * @param {string} battleId - Battle ID
     * @param {string} islandId - Island ID
     */
    async endBattle(battleId, islandId) {
        try {
            // Update battle status
            await this.db.collection('battles').doc(battleId).update({
                status: 'ended',
                endedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Reset island
            await this.db.collection('islands').doc(islandId).update({
                status: 'empty',
                waitingUser: null,
                users: [],
                currentBattleId: null
            });

            console.log(`Battle ${battleId} ended, island ${islandId} reset`);
        } catch (error) {
            console.error('Error ending battle:', error);
        }
    }

    /**
     * Cleanup all subscriptions
     */
    cleanup() {
        this.unsubscribers.forEach(unsubscribe => {
            try {
                unsubscribe();
            } catch (e) {
                // Ignore errors during cleanup
            }
        });
        this.unsubscribers = [];
        console.log('Firebase subscriptions cleaned up');
    }
}
