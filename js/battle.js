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

    // Settings and Recording elements
    const battleContainer = document.querySelector('.battle-container');
    const openSettingsBtn = document.getElementById('open-settings');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings');
    const toggleRecordingBtn = document.getElementById('toggle-recording');
    const downloadModal = document.getElementById('download-modal');
    const downloadRecordingBtn = document.getElementById('download-recording');
    const skipDownloadBtn = document.getElementById('skip-download');
    const recordingStatusDiv = document.getElementById('recording-status');
    const recordingTimeSpan = document.getElementById('recording-time');
    const recordingSizeSpan = document.getElementById('recording-size');

    // Debug: Check if buttons are found
    console.log('Button elements found:', {
        openSettingsBtn: !!openSettingsBtn,
        toggleRecordingBtn: !!toggleRecordingBtn,
        settingsModal: !!settingsModal
    });

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

    // Settings state
    let currentViewMode = localStorage.getItem('viewMode') || VIEW_MODE_CONFIG.default;
    let currentRecordTarget = localStorage.getItem('recordTarget') || RECORDING_CONFIG.target;
    let currentStorageMode = localStorage.getItem('storageMode') || (RECORDING_CONFIG.uploadToStorage ? 'cloud' : 'memory');
    let lastRecordingResult = null;
    let recordingTimerInterval = null;
    const storageModeWarning = document.getElementById('storage-mode-warning');

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

    // ===== View Mode Functions =====

    /**
     * Apply view mode to battle container
     * @param {string} mode - View mode ('normal', 'opponent-only', 'spectator')
     */
    function applyViewMode(mode) {
        // Remove all view mode classes
        battleContainer.classList.remove('view-normal', 'view-opponent-only', 'view-spectator');

        // Apply new view mode class
        if (mode !== 'normal') {
            battleContainer.classList.add(`view-${mode}`);
        }

        // Update settings modal buttons
        document.querySelectorAll('[data-view-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.viewMode === mode);
        });

        // Save to localStorage
        currentViewMode = mode;
        localStorage.setItem('viewMode', mode);
        console.log('View mode changed to:', mode);
    }

    /**
     * Set recording target
     * @param {string} target - Recording target ('local', 'remote', 'combined')
     */
    function setRecordTarget(target) {
        currentRecordTarget = target;
        localStorage.setItem('recordTarget', target);

        // Update settings modal buttons
        document.querySelectorAll('[data-record-target]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.recordTarget === target);
        });

        console.log('Record target changed to:', target);
    }

    /**
     * Set storage mode (cloud or memory)
     * @param {string} mode - Storage mode ('cloud' or 'memory')
     */
    function setStorageMode(mode) {
        currentStorageMode = mode;
        localStorage.setItem('storageMode', mode);

        // Update settings modal buttons
        document.querySelectorAll('[data-storage-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.storageMode === mode);
        });

        // Show/hide warning for memory mode
        if (storageModeWarning) {
            storageModeWarning.classList.toggle('hidden', mode !== 'memory');
        }

        console.log('Storage mode changed to:', mode);
    }

    // ===== Recording Functions =====

    /**
     * Format milliseconds to MM:SS
     * @param {number} ms - Milliseconds
     * @returns {string} Formatted time
     */
    function formatTime(ms) {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }

    /**
     * Format bytes to human readable
     * @param {number} bytes - Bytes
     * @returns {string} Formatted size
     */
    function formatSize(bytes) {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / 1024 / 1024).toFixed(2) + ' MB';
    }

    /**
     * Update recording progress display
     * @param {number} elapsedMs - Elapsed time in ms
     * @param {number} totalSize - Total recorded size in bytes
     */
    function onRecordingProgress(elapsedMs, totalSize) {
        recordingTimeSpan.textContent = formatTime(elapsedMs);
        recordingSizeSpan.textContent = formatSize(totalSize);
    }

    /**
     * Start recording timer interval
     */
    function startRecordingTimer() {
        recordingStatusDiv.classList.remove('hidden');
        recordingTimerInterval = setInterval(() => {
            const progress = webrtcService.getRecordingProgress();
            if (progress.isRecording) {
                onRecordingProgress(progress.duration, progress.size);
            }
        }, 1000);
    }

    /**
     * Stop recording timer interval
     */
    function stopRecordingTimer() {
        if (recordingTimerInterval) {
            clearInterval(recordingTimerInterval);
            recordingTimerInterval = null;
        }
        recordingStatusDiv.classList.add('hidden');
    }

    /**
     * Toggle recording on/off
     */
    async function toggleRecording() {
        console.log('toggleRecording called, isRecording:', webrtcService.isRecording);
        if (webrtcService.isRecording) {
            // Stop recording
            toggleRecordingBtn.classList.remove('recording');
            toggleRecordingBtn.disabled = true;

            try {
                lastRecordingResult = await webrtcService.stopRecording();
                stopRecordingTimer();

                // Show download modal if we have a recording
                if (lastRecordingResult.uploadedToStorage || lastRecordingResult.blob) {
                    downloadModal.classList.remove('hidden');
                }
            } catch (error) {
                console.error('Error stopping recording:', error);
                alert('録画の停止に失敗しました。');
            }

            toggleRecordingBtn.disabled = false;
        } else {
            // Start recording with current view mode for proper transformations
            const uploadToStorage = currentStorageMode === 'cloud';
            const success = webrtcService.startRecording(
                currentRecordTarget,
                uploadToStorage ? firebaseService : null,
                uploadToStorage ? battleId : null,
                onRecordingProgress,
                uploadToStorage,
                currentViewMode  // Pass view mode for spectator rotation
            );

            if (success) {
                toggleRecordingBtn.classList.add('recording');
                startRecordingTimer();
            } else {
                alert('録画を開始できませんでした。\nカメラが接続されているか確認してください。');
            }
        }
    }

    /**
     * Download the last recording
     */
    async function downloadLastRecording() {
        if (!lastRecordingResult) return;

        downloadRecordingBtn.disabled = true;
        downloadRecordingBtn.textContent = 'ダウンロード中...';

        try {
            let blob = lastRecordingResult.blob;

            // If uploaded to storage, download and merge chunks
            if (lastRecordingResult.uploadedToStorage && !blob) {
                blob = await firebaseService.downloadAndMergeRecording(battleId, lastRecordingResult.target);
            }

            if (blob) {
                webrtcService.downloadRecording(blob, lastRecordingResult.target);
            } else {
                alert('録画ファイルが見つかりませんでした。');
            }
        } catch (error) {
            console.error('Error downloading recording:', error);
            alert('ダウンロードに失敗しました。');
        }

        downloadRecordingBtn.disabled = false;
        downloadRecordingBtn.textContent = 'ダウンロード';
        downloadModal.classList.add('hidden');
        lastRecordingResult = null;
    }

    /**
     * Initialize settings from localStorage
     */
    function initializeSettings() {
        // Apply saved view mode
        applyViewMode(currentViewMode);

        // Apply saved record target
        setRecordTarget(currentRecordTarget);

        // Apply saved storage mode
        setStorageMode(currentStorageMode);
    }

    // Helper function to add click/touch event for mobile compatibility
    function addTapListener(element, handler) {
        if (!element) {
            console.warn('Element not found for tap listener');
            return;
        }

        // Use simple onclick - works reliably on both desktop and mobile
        // Modern browsers handle touch-to-click conversion well
        element.onclick = function(e) {
            console.log('Button clicked:', element.id || element.className);
            handler(e);
        };
    }

    // Event Listeners
    if (requestCameraBtn) {
        addTapListener(requestCameraBtn, async () => {
            const success = await initializeCamera();
            if (success) {
                await initializeConnection();
                // Initialize media button states
                updateAudioButtonState(webrtcService.isAudioEnabled);
                updateVideoButtonState(webrtcService.isVideoEnabled);
            }
        });
    }

    // Media control event listeners with null checks
    if (toggleAudioBtn) addTapListener(toggleAudioBtn, toggleAudio);
    if (toggleVideoBtn) addTapListener(toggleVideoBtn, toggleVideo);
    if (switchCameraBtn) addTapListener(switchCameraBtn, switchCamera);
    if (endBattleBtn) addTapListener(endBattleBtn, endBattle);
    if (errorBackBtn) addTapListener(errorBackBtn, () => navigateToMatching());
    if (closeCameraModalBtn) addTapListener(closeCameraModalBtn, () => cameraSelectModal.classList.add('hidden'));

    // Settings modal events with null checks
    if (openSettingsBtn) {
        addTapListener(openSettingsBtn, () => {
            console.log('Settings button clicked');
            if (settingsModal) settingsModal.classList.remove('hidden');
        });
    }
    if (closeSettingsBtn) {
        addTapListener(closeSettingsBtn, () => settingsModal.classList.add('hidden'));
    }

    // View mode selection
    document.querySelectorAll('[data-view-mode]').forEach(btn => {
        addTapListener(btn, () => applyViewMode(btn.dataset.viewMode));
    });

    // Record target selection
    document.querySelectorAll('[data-record-target]').forEach(btn => {
        addTapListener(btn, () => setRecordTarget(btn.dataset.recordTarget));
    });

    // Storage mode selection
    document.querySelectorAll('[data-storage-mode]').forEach(btn => {
        addTapListener(btn, () => setStorageMode(btn.dataset.storageMode));
    });

    // Recording events with null checks
    if (toggleRecordingBtn) {
        addTapListener(toggleRecordingBtn, toggleRecording);
        console.log('Recording button listener attached');
    } else {
        console.error('toggleRecordingBtn not found!');
    }
    if (downloadRecordingBtn) addTapListener(downloadRecordingBtn, downloadLastRecording);
    if (skipDownloadBtn) {
        addTapListener(skipDownloadBtn, () => {
            downloadModal.classList.add('hidden');
            lastRecordingResult = null;
        });
    }

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

        // Initialize settings from localStorage
        initializeSettings();

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
