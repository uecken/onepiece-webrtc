/**
 * Firebase Service
 * Handles all Firebase Firestore operations for signaling and room management
 */
class FirebaseService {
    constructor() {
        this.db = null;
        this.storage = null;
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

            // Initialize Storage only if SDK is available (battle.html includes it)
            if (typeof firebase.storage === 'function') {
                this.storage = firebase.storage();
                console.log('Firebase initialized successfully (Firestore + Storage)');
            } else {
                this.storage = null;
                console.log('Firebase initialized successfully (Firestore only)');
            }
            this.initialized = true;

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

    // ===== Firebase Storage Methods for Recording =====

    /**
     * Upload a recording chunk to Firebase Storage
     * @param {string} battleId - Battle ID
     * @param {Blob} blob - Recording chunk blob
     * @param {number} index - Chunk index
     * @param {string} target - Recording target ('local', 'remote', 'combined')
     * @returns {Promise<string>} Download URL
     */
    async uploadChunk(battleId, blob, index, target) {
        if (!this.storage) {
            throw new Error('Firebase Storage is not initialized');
        }
        const ext = getFileExtension(blob.type);
        const paddedIndex = String(index).padStart(3, '0');
        const path = `recordings/${battleId}/${target}_chunk_${paddedIndex}.${ext}`;
        const ref = this.storage.ref(path);

        try {
            const snapshot = await ref.put(blob, {
                contentType: blob.type
            });
            const downloadUrl = await snapshot.ref.getDownloadURL();
            console.log(`Chunk ${index} uploaded:`, path);
            return downloadUrl;
        } catch (error) {
            console.error('Error uploading chunk:', error);
            throw error;
        }
    }

    /**
     * Save recording metadata
     * @param {string} battleId - Battle ID
     * @param {string} target - Recording target
     * @param {Object} metadata - Metadata object
     */
    async saveRecordingMetadata(battleId, target, metadata) {
        if (!this.storage) {
            console.warn('Firebase Storage is not initialized, skipping metadata save');
            return;
        }
        const path = `recordings/${battleId}/${target}_metadata.json`;
        const ref = this.storage.ref(path);
        const blob = new Blob([JSON.stringify(metadata)], { type: 'application/json' });

        try {
            await ref.put(blob);
            console.log('Recording metadata saved');
        } catch (error) {
            console.error('Error saving metadata:', error);
        }
    }

    /**
     * Get all recording chunk URLs for a battle
     * @param {string} battleId - Battle ID
     * @param {string} target - Recording target
     * @returns {Promise<Array<{url: string, name: string}>>} Array of chunk info
     */
    async getRecordingChunks(battleId, target) {
        if (!this.storage) {
            console.warn('Firebase Storage is not initialized');
            return [];
        }
        const folderRef = this.storage.ref(`recordings/${battleId}`);

        try {
            const result = await folderRef.listAll();
            const chunks = [];

            for (const item of result.items) {
                if (item.name.startsWith(`${target}_chunk_`)) {
                    const url = await item.getDownloadURL();
                    chunks.push({
                        url,
                        name: item.name,
                        index: parseInt(item.name.match(/_chunk_(\d+)/)?.[1] || '0')
                    });
                }
            }

            // Sort by index
            chunks.sort((a, b) => a.index - b.index);
            console.log(`Found ${chunks.length} chunks for ${target}`);
            return chunks;
        } catch (error) {
            console.error('Error getting recording chunks:', error);
            return [];
        }
    }

    /**
     * Download and merge all chunks into a single blob
     * @param {string} battleId - Battle ID
     * @param {string} target - Recording target
     * @returns {Promise<Blob|null>} Merged recording blob
     */
    async downloadAndMergeRecording(battleId, target) {
        const chunks = await this.getRecordingChunks(battleId, target);

        if (chunks.length === 0) {
            console.warn('No recording chunks found');
            return null;
        }

        try {
            const blobs = [];

            for (const chunk of chunks) {
                const response = await fetch(chunk.url);
                const blob = await response.blob();
                blobs.push(blob);
            }

            // Determine MIME type from first chunk
            const mimeType = blobs[0].type || 'video/webm';
            const mergedBlob = new Blob(blobs, { type: mimeType });
            console.log(`Merged ${blobs.length} chunks, total size: ${(mergedBlob.size / 1024 / 1024).toFixed(2)} MB`);
            return mergedBlob;
        } catch (error) {
            console.error('Error merging recording:', error);
            return null;
        }
    }

    /**
     * Delete all recording files for a battle
     * @param {string} battleId - Battle ID
     */
    async deleteRecording(battleId) {
        if (!this.storage) {
            console.warn('Firebase Storage is not initialized');
            return;
        }
        const folderRef = this.storage.ref(`recordings/${battleId}`);

        try {
            const result = await folderRef.listAll();

            for (const item of result.items) {
                await item.delete();
                console.log('Deleted:', item.name);
            }

            console.log(`Recording for battle ${battleId} deleted`);
        } catch (error) {
            console.error('Error deleting recording:', error);
        }
    }
}
