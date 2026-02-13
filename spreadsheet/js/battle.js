/**
 * Battle Screen Logic - Google Spreadsheet Version
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

    // Get battle parameters
    const params = getUrlParams();
    const battleId = params.get('battleId');
    const role = params.get('role');
    const islandId = params.get('islandId') || localStorage.getItem('currentIslandId');

    if (!battleId || !role) {
        showErrorModal('不正な対戦パラメータです。');
        return;
    }

    const userId = getOrCreateUserId();
    if (!userId) {
        showErrorModal('ユーザーIDが見つかりません。');
        return;
    }

    // Store island ID for cleanup
    localStorage.setItem('currentIslandId', islandId || '');

    // Initialize services
    const spreadsheetService = new SpreadsheetService();
    const webrtcService = new WebRTCService();

    // Battle state
    let battle = null;
    let offerReceived = false;
    let answerReceived = false;

    /**
     * Update status display
     */
    function updateStatus(status, text) {
        connectionIndicator.className = `indicator ${status}`;
        battleStatusText.textContent = text;
    }

    /**
     * Show error modal
     */
    function showErrorModal(message) {
        errorMessage.textContent = message;
        errorModal.classList.remove('hidden');
        cameraModal.classList.add('hidden');
    }

    /**
     * Initialize camera
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
     * Handle remote stream
     */
    function onRemoteStream(stream) {
        console.log('Remote stream received');
        console.log('Remote audio tracks:', stream.getAudioTracks().length);
        console.log('Remote video tracks:', stream.getVideoTracks().length);
        remoteVideo.srcObject = stream;
        remoteVideo.volume = 1.0;  // Ensure full volume
        remoteVideo.muted = false;  // Ensure not muted
        opponentPlaceholder.classList.add('hidden');

        // Ensure audio plays on mobile (autoplay policy)
        remoteVideo.play().catch(e => console.log('Auto-play prevented:', e));
    }

    /**
     * Handle ICE candidate
     */
    async function onIceCandidate(candidate) {
        try {
            await spreadsheetService.writeIceCandidate(battleId, candidate, userId);
        } catch (error) {
            console.error('Error writing ICE candidate:', error);
        }
    }

    /**
     * Handle connection state change
     */
    function onConnectionStateChange(state) {
        console.log('Connection state:', state);

        switch (state) {
            case 'new':
            case 'connecting':
                updateStatus('connecting', '接続中...');
                break;
            case 'connected':
                updateStatus('connected', '対戦中!');
                // Update battle status in Spreadsheet
                spreadsheetService.updateBattleStatus(battleId, 'connected').catch(console.error);
                break;
            case 'disconnected':
                updateStatus('disconnected', '接続が切断されました');
                handleDisconnect();
                break;
            case 'failed':
                updateStatus('disconnected', '接続に失敗しました');
                handleDisconnect();
                break;
        }
    }

    /**
     * Initialize WebRTC connection
     */
    async function initializeConnection() {
        updateStatus('connecting', 'WebRTC接続を初期化中...');

        webrtcService.createPeerConnection(
            onRemoteStream,
            onIceCandidate,
            onConnectionStateChange
        );

        if (role === 'creator') {
            updateStatus('connecting', 'オファーを作成中...');

            try {
                const offer = await webrtcService.createOffer();
                await spreadsheetService.writeOffer(battleId, {
                    sdp: offer.sdp,
                    type: offer.type
                }, userId);

                updateStatus('connecting', '相手の応答を待機中...');

                // Poll for answer
                spreadsheetService.startAnswerPolling(battleId, async (answer) => {
                    if (answer && !answerReceived) {
                        answerReceived = true;
                        console.log('Answer received');
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
            updateStatus('connecting', 'オファーを待機中...');

            // Poll for offer
            spreadsheetService.startOfferPolling(battleId, async (offer) => {
                if (offer && !offerReceived) {
                    offerReceived = true;
                    console.log('Offer received');

                    try {
                        updateStatus('connecting', 'アンサーを作成中...');
                        const answer = await webrtcService.handleOffer(offer);
                        await spreadsheetService.writeAnswer(battleId, {
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

        // Poll for ICE candidates
        spreadsheetService.startIceCandidatesPolling(battleId, userId, async (candidate) => {
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
        webrtcService.disconnect();
        spreadsheetService.cleanup();

        const storedIslandId = localStorage.getItem('currentIslandId');
        if (storedIslandId) {
            try {
                await spreadsheetService.endBattle(battleId, storedIslandId);
            } catch (error) {
                console.error('Error ending battle:', error);
            }
        }

        localStorage.removeItem('currentIslandId');

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
        console.log('Toggle audio button clicked');
        console.log('Local stream:', webrtcService.localStream);
        console.log('Audio tracks:', webrtcService.localStream?.getAudioTracks());
        const isEnabled = webrtcService.toggleAudio();
        console.log('Audio enabled after toggle:', isEnabled);
        updateAudioButtonState(isEnabled);
    }

    /**
     * Toggle video on/off
     */
    function toggleVideo() {
        const isEnabled = webrtcService.toggleVideo();
        updateVideoButtonState(isEnabled);

        if (!isEnabled) {
            localVideo.style.opacity = '0.3';
        } else {
            localVideo.style.opacity = '1';
        }
    }

    /**
     * Update audio button state
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

    window.addEventListener('beforeunload', () => {
        webrtcService.disconnect();
        spreadsheetService.cleanup();
    });

    // Initialize
    try {
        if (GAS_WEB_APP_URL.includes('YOUR_DEPLOYMENT_ID')) {
            showErrorModal('js/config.jsのGAS_WEB_APP_URLを設定してください。');
            return;
        }

        updateStatus('connecting', 'サーバーに接続中...');

        // Get battle info
        battle = await spreadsheetService.getBattle(battleId);
        if (!battle) {
            showErrorModal('対戦が見つかりません。');
            return;
        }

        // Verify user is part of this battle
        if (battle.creatorId !== userId && battle.joinerId !== userId) {
            showErrorModal('この対戦への参加権限がありません。');
            return;
        }

        // Store island ID for cleanup
        if (battle.islandId) {
            localStorage.setItem('currentIslandId', battle.islandId);
        }

        updateStatus('connecting', 'カメラへのアクセスを許可してください');

        // Subscribe to battle updates
        spreadsheetService.startBattlePolling(battleId, (updatedBattle) => {
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
