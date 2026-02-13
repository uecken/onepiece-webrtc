/**
 * Battle Screen Logic
 * Handles WebRTC connection and video display
 */

document.addEventListener('DOMContentLoaded', async () => {
    // DOM Elements
    const localVideo = document.getElementById('local-video');
    const remoteVideo = document.getElementById('remote-video');
    const opponentPlaceholder = document.getElementById('opponent-placeholder');
    const connectionIndicator = document.getElementById('connection-indicator');
    const battleStatusText = document.getElementById('battle-status-text');
    const cameraModal = document.getElementById('camera-modal');
    const requestCameraBtn = document.getElementById('request-camera');
    const switchCameraBtn = document.getElementById('switch-camera');
    const endBattleBtn = document.getElementById('end-battle');
    const errorModal = document.getElementById('error-modal');
    const errorMessage = document.getElementById('error-message');
    const errorBackBtn = document.getElementById('error-back');

    // Media control elements
    const toggleAudioBtn = document.getElementById('toggle-audio');
    const toggleVideoBtn = document.getElementById('toggle-video');
    const audioOnIcon = document.getElementById('audio-on-icon');
    const audioOffIcon = document.getElementById('audio-off-icon');
    const videoOnIcon = document.getElementById('video-on-icon');
    const videoOffIcon = document.getElementById('video-off-icon');
    const cameraSelectModal = document.getElementById('camera-select-modal');
    const cameraList = document.getElementById('camera-list');
    const closeCameraModalBtn = document.getElementById('close-camera-modal');

    // Get battle parameters from URL
    const params = getUrlParams();
    const battleId = params.get('battleId');
    const role = params.get('role'); // 'creator' or 'joiner'

    // Validate parameters
    if (!battleId || !role) {
        showErrorModal('不正な対戦パラメータです。');
        return;
    }

    // Get user ID
    const userId = getOrCreateUserId();
    if (!userId) {
        showErrorModal('ユーザーIDが見つかりません。');
        return;
    }

    // Initialize services
    const firebaseService = new FirebaseService();
    const webrtcService = new WebRTCService();

    // Battle state
    let battle = null;
    let offerReceived = false;
    let answerReceived = false;

    /**
     * Update status display
     * @param {string} status - Status type
     * @param {string} text - Status text
     */
    function updateStatus(status, text) {
        connectionIndicator.className = `indicator ${status}`;
        battleStatusText.textContent = text;
    }

    /**
     * Show error modal
     * @param {string} message - Error message
     */
    function showErrorModal(message) {
        errorMessage.textContent = message;
        errorModal.classList.remove('hidden');
        cameraModal.classList.add('hidden');
    }

    /**
     * Initialize camera
     * @returns {Promise<boolean>} Success
     */
    async function initializeCamera() {
        try {
            updateStatus('connecting', 'カメラを起動中...');
            const stream = await webrtcService.requestCameraAccess();
            localVideo.srcObject = stream;
            cameraModal.classList.add('hidden');
            return true;
        } catch (error) {
            console.error('Camera error:', error);
            showErrorModal(error.message);
            return false;
        }
    }

    /**
     * Handle remote stream received
     * @param {MediaStream} stream - Remote media stream
     */
    function onRemoteStream(stream) {
        console.log('Remote stream received');
        remoteVideo.srcObject = stream;
        opponentPlaceholder.classList.add('hidden');
    }

    /**
     * Handle ICE candidate
     * @param {RTCIceCandidate} candidate - ICE candidate
     */
    async function onIceCandidate(candidate) {
        try {
            await firebaseService.writeIceCandidate(battleId, candidate, userId);
        } catch (error) {
            console.error('Error writing ICE candidate:', error);
        }
    }

    /**
     * Handle connection state change
     * @param {string} state - Connection state
     */
    function onConnectionStateChange(state) {
        console.log('Connection state changed:', state);

        switch (state) {
            case 'new':
            case 'connecting':
                updateStatus('connecting', '接続中...');
                break;
            case 'connected':
                updateStatus('connected', '対戦中!');
                // Update battle status in Firebase
                firebaseService.updateBattleStatus(battleId, 'connected').catch(console.error);
                break;
            case 'disconnected':
                updateStatus('disconnected', '接続が切断されました');
                handleDisconnect();
                break;
            case 'failed':
                updateStatus('disconnected', '接続に失敗しました');
                handleDisconnect();
                break;
            case 'closed':
                updateStatus('disconnected', '接続終了');
                break;
        }
    }

    /**
     * Initialize WebRTC connection
     */
    async function initializeConnection() {
        updateStatus('connecting', 'WebRTC接続を初期化中...');

        // Create peer connection
        webrtcService.createPeerConnection(
            onRemoteStream,
            onIceCandidate,
            onConnectionStateChange
        );

        if (role === 'creator') {
            // Creator creates and sends offer
            updateStatus('connecting', 'オファーを作成中...');

            try {
                const offer = await webrtcService.createOffer();
                await firebaseService.writeOffer(battleId, {
                    sdp: offer.sdp,
                    type: offer.type
                }, userId);

                updateStatus('connecting', '相手の応答を待機中...');

                // Listen for answer
                firebaseService.subscribeToAnswer(battleId, async (answer) => {
                    if (answer && !answerReceived) {
                        answerReceived = true;
                        console.log('Answer received from Firebase');
                        try {
                            await webrtcService.handleAnswer(answer);
                        } catch (error) {
                            console.error('Error handling answer:', error);
                        }
                    }
                });
            } catch (error) {
                console.error('Error creating offer:', error);
                showErrorModal('接続の初期化に失敗しました。');
                return;
            }
        } else {
            // Joiner waits for offer, then creates answer
            updateStatus('connecting', 'オファーを待機中...');

            firebaseService.subscribeToOffer(battleId, async (offer) => {
                if (offer && !offerReceived) {
                    offerReceived = true;
                    console.log('Offer received from Firebase');

                    try {
                        updateStatus('connecting', 'アンサーを作成中...');
                        const answer = await webrtcService.handleOffer(offer);
                        await firebaseService.writeAnswer(battleId, {
                            sdp: answer.sdp,
                            type: answer.type
                        }, userId);
                        updateStatus('connecting', '接続確立中...');
                    } catch (error) {
                        console.error('Error handling offer:', error);
                        showErrorModal('接続の確立に失敗しました。');
                    }
                }
            });
        }

        // Subscribe to ICE candidates from the other user
        firebaseService.subscribeToIceCandidates(battleId, userId, async (candidate) => {
            try {
                await webrtcService.addIceCandidate(candidate);
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
        });
    }

    /**
     * Handle disconnect
     */
    async function handleDisconnect() {
        // Cleanup WebRTC
        webrtcService.disconnect();

        // Cleanup Firebase subscriptions
        firebaseService.cleanup();

        // End battle and reset island
        if (battle && battle.islandId) {
            try {
                await firebaseService.endBattle(battleId, battle.islandId);
            } catch (error) {
                console.error('Error ending battle:', error);
            }
        }

        // Return to matching screen after delay
        updateStatus('disconnected', '島選択に戻ります...');
        setTimeout(() => {
            navigateToMatching();
        }, 2000);
    }

    /**
     * End battle manually
     */
    async function endBattle() {
        if (confirm('対戦を終了しますか?')) {
            updateStatus('disconnected', '対戦を終了中...');
            await handleDisconnect();
        }
    }

    /**
     * Switch camera (front/back toggle)
     */
    async function switchCamera() {
        const cameras = await webrtcService.getAvailableCameras();

        if (cameras.length <= 1) {
            // Only one camera, just toggle front/back
            try {
                const newStream = await webrtcService.switchCamera();
                localVideo.srcObject = newStream;
            } catch (error) {
                console.error('Camera switch failed:', error);
                alert('カメラの切り替えに失敗しました。');
            }
        } else {
            // Multiple cameras, show selection modal
            showCameraSelectModal(cameras);
        }
    }

    /**
     * Show camera selection modal
     * @param {Array} cameras - Available cameras
     */
    function showCameraSelectModal(cameras) {
        cameraList.innerHTML = '';

        cameras.forEach((camera, index) => {
            const btn = document.createElement('button');
            btn.className = 'btn camera-option';
            btn.textContent = camera.label || `カメラ ${index + 1}`;
            btn.addEventListener('click', async () => {
                try {
                    await webrtcService.switchToCamera(camera.deviceId);
                    localVideo.srcObject = webrtcService.localStream;
                    cameraSelectModal.classList.add('hidden');

                    // Update video button state
                    updateVideoButtonState(true);
                } catch (error) {
                    console.error('Camera switch failed:', error);
                    alert('カメラの切り替えに失敗しました。');
                }
            });
            cameraList.appendChild(btn);
        });

        cameraSelectModal.classList.remove('hidden');
    }

    /**
     * Toggle audio on/off
     */
    function toggleAudio() {
        const isEnabled = webrtcService.toggleAudio();
        updateAudioButtonState(isEnabled);
    }

    /**
     * Toggle video on/off
     */
    function toggleVideo() {
        const isEnabled = webrtcService.toggleVideo();
        updateVideoButtonState(isEnabled);

        // Show/hide local video preview
        if (!isEnabled) {
            localVideo.style.opacity = '0.3';
        } else {
            localVideo.style.opacity = '1';
        }
    }

    /**
     * Update audio button state
     * @param {boolean} isEnabled - Audio enabled state
     */
    function updateAudioButtonState(isEnabled) {
        if (isEnabled) {
            toggleAudioBtn.classList.add('active');
            toggleAudioBtn.classList.remove('muted');
            audioOnIcon.classList.remove('hidden');
            audioOffIcon.classList.add('hidden');
        } else {
            toggleAudioBtn.classList.remove('active');
            toggleAudioBtn.classList.add('muted');
            audioOnIcon.classList.add('hidden');
            audioOffIcon.classList.remove('hidden');
        }
    }

    /**
     * Update video button state
     * @param {boolean} isEnabled - Video enabled state
     */
    function updateVideoButtonState(isEnabled) {
        if (isEnabled) {
            toggleVideoBtn.classList.add('active');
            toggleVideoBtn.classList.remove('muted');
            videoOnIcon.classList.remove('hidden');
            videoOffIcon.classList.add('hidden');
        } else {
            toggleVideoBtn.classList.remove('active');
            toggleVideoBtn.classList.add('muted');
            videoOnIcon.classList.add('hidden');
            videoOffIcon.classList.remove('hidden');
        }
    }

    // Event Listeners
    requestCameraBtn.addEventListener('click', async () => {
        const success = await initializeCamera();
        if (success) {
            await initializeConnection();
            // Initialize media button states
            updateAudioButtonState(webrtcService.isAudioEnabled);
            updateVideoButtonState(webrtcService.isVideoEnabled);
        }
    });

    toggleAudioBtn.addEventListener('click', toggleAudio);
    toggleVideoBtn.addEventListener('click', toggleVideo);
    switchCameraBtn.addEventListener('click', switchCamera);
    endBattleBtn.addEventListener('click', endBattle);
    errorBackBtn.addEventListener('click', () => navigateToMatching());
    closeCameraModalBtn.addEventListener('click', () => cameraSelectModal.classList.add('hidden'));

    // Handle page unload
    window.addEventListener('beforeunload', () => {
        webrtcService.disconnect();
        firebaseService.cleanup();
    });

    // Handle visibility change (mobile)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            // Could pause video or show warning
            console.log('App went to background');
        }
    });

    // Initialize
    try {
        updateStatus('connecting', 'Firebaseに接続中...');
        await firebaseService.init();

        // Get battle info
        battle = await firebaseService.getBattle(battleId);
        if (!battle) {
            showErrorModal('対戦が見つかりません。');
            return;
        }

        // Verify user is part of this battle
        if (battle.creatorId !== userId && battle.joinerId !== userId) {
            showErrorModal('この対戦への参加権限がありません。');
            return;
        }

        updateStatus('connecting', 'カメラへのアクセスを許可してください');

        // Subscribe to battle updates
        firebaseService.subscribeToBattle(battleId, (updatedBattle) => {
            battle = updatedBattle;
            if (battle.status === 'ended') {
                updateStatus('disconnected', '対戦が終了しました');
                handleDisconnect();
            }
        });

    } catch (error) {
        console.error('Initialization error:', error);
        showErrorModal('初期化に失敗しました: ' + error.message);
    }
});
