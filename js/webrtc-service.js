/**
 * WebRTC Service
 * Handles WebRTC peer connection and media streams
 */
class WebRTCService {
    constructor() {
        this.peerConnection = null;
        this.localStream = null;
        this.remoteStream = null;
        this.isCreator = false;
        this.onRemoteStreamCallback = null;
        this.onIceCandidateCallback = null;
        this.onConnectionStateChangeCallback = null;
        // Media state
        this.isAudioEnabled = true;
        this.isVideoEnabled = true;
        this.currentDeviceId = null;
        this.availableCameras = [];

        // Recording state
        this.mediaRecorder = null;
        this.recordingChunks = [];
        this.recordingTarget = 'local';
        this.isRecording = false;
        this.combinedStream = null;
        this.combinedCanvas = null;
        this.combinedContext = null;
        this.animationFrameId = null;

        // Storage upload state
        this.firebaseService = null;
        this.battleId = null;
        this.chunkIndex = 0;
        this.recordingStartTime = null;
        this.totalRecordedSize = 0;
        this.onRecordingProgressCallback = null;
    }

    /**
     * Request camera access
     * @returns {Promise<MediaStream>} Local media stream
     */
    async requestCameraAccess() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
            console.log('Camera access granted');

            // Check audio tracks
            const audioTracks = this.localStream.getAudioTracks();
            console.log('Audio tracks:', audioTracks.length);
            if (audioTracks.length > 0) {
                this.isAudioEnabled = audioTracks[0].enabled;
                console.log('Audio enabled:', this.isAudioEnabled);
            } else {
                this.isAudioEnabled = false;
                console.warn('No audio tracks available');
            }

            // Check video tracks
            const videoTracks = this.localStream.getVideoTracks();
            console.log('Video tracks:', videoTracks.length);
            if (videoTracks.length > 0) {
                this.isVideoEnabled = videoTracks[0].enabled;
            }

            return this.localStream;
        } catch (error) {
            console.error('Camera access denied:', error);

            if (error.name === 'NotAllowedError') {
                throw new Error('カメラへのアクセスが拒否されました。設定からカメラの許可を有効にしてください。');
            } else if (error.name === 'NotFoundError') {
                throw new Error('カメラが見つかりません。カメラが接続されているか確認してください。');
            } else if (error.name === 'NotReadableError') {
                throw new Error('カメラが他のアプリで使用中です。他のアプリを閉じてください。');
            } else {
                throw new Error('カメラへのアクセスに失敗しました: ' + error.message);
            }
        }
    }

    /**
     * Create RTCPeerConnection
     * @param {Function} onRemoteStream - Callback when remote stream is received
     * @param {Function} onIceCandidate - Callback when ICE candidate is generated
     * @param {Function} onConnectionStateChange - Callback when connection state changes
     * @returns {RTCPeerConnection} Peer connection
     */
    createPeerConnection(onRemoteStream, onIceCandidate, onConnectionStateChange) {
        // Store callbacks
        this.onRemoteStreamCallback = onRemoteStream;
        this.onIceCandidateCallback = onIceCandidate;
        this.onConnectionStateChangeCallback = onConnectionStateChange;

        // Create peer connection
        this.peerConnection = new RTCPeerConnection({
            iceServers: STUN_SERVERS
        });

        // Add local tracks to connection
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle incoming remote tracks
        this.peerConnection.ontrack = (event) => {
            console.log('Remote track received');
            this.remoteStream = event.streams[0];
            if (this.onRemoteStreamCallback) {
                this.onRemoteStreamCallback(this.remoteStream);
            }
        };

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('ICE candidate generated');
                if (this.onIceCandidateCallback) {
                    this.onIceCandidateCallback(event.candidate);
                }
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            if (this.onConnectionStateChangeCallback) {
                this.onConnectionStateChangeCallback(this.peerConnection.connectionState);
            }
        };

        // Handle ICE connection state changes
        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);

            if (this.peerConnection.iceConnectionState === 'failed') {
                console.log('ICE connection failed, attempting restart');
                this.peerConnection.restartIce();
            }
        };

        // Handle ICE gathering state changes
        this.peerConnection.onicegatheringstatechange = () => {
            console.log('ICE gathering state:', this.peerConnection.iceGatheringState);
        };

        console.log('Peer connection created');
        return this.peerConnection;
    }

    /**
     * Create and return SDP offer (for waiting user/creator)
     * @returns {Promise<RTCSessionDescriptionInit>} SDP offer
     */
    async createOffer() {
        this.isCreator = true;

        try {
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            console.log('Offer created and set as local description');
            return offer;
        } catch (error) {
            console.error('Error creating offer:', error);
            throw error;
        }
    }

    /**
     * Handle received offer and create answer (for joining user)
     * @param {Object} offer - Received SDP offer
     * @returns {Promise<RTCSessionDescriptionInit>} SDP answer
     */
    async handleOffer(offer) {
        this.isCreator = false;

        try {
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(offer)
            );
            console.log('Offer set as remote description');

            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            console.log('Answer created and set as local description');

            return answer;
        } catch (error) {
            console.error('Error handling offer:', error);
            throw error;
        }
    }

    /**
     * Handle received answer (for waiting user/creator)
     * @param {Object} answer - Received SDP answer
     */
    async handleAnswer(answer) {
        try {
            await this.peerConnection.setRemoteDescription(
                new RTCSessionDescription(answer)
            );
            console.log('Answer set as remote description');
        } catch (error) {
            console.error('Error handling answer:', error);
            throw error;
        }
    }

    /**
     * Add received ICE candidate
     * @param {Object} candidate - ICE candidate data
     */
    async addIceCandidate(candidate) {
        try {
            if (this.peerConnection && this.peerConnection.remoteDescription) {
                await this.peerConnection.addIceCandidate(
                    new RTCIceCandidate(candidate)
                );
                console.log('ICE candidate added');
            } else {
                console.warn('Cannot add ICE candidate: no remote description');
            }
        } catch (error) {
            console.error('Error adding ICE candidate:', error);
        }
    }

    /**
     * Switch camera (front/back)
     * @returns {Promise<MediaStream>} New media stream
     */
    async switchCamera() {
        const currentFacingMode = this.localStream
            ?.getVideoTracks()[0]
            ?.getSettings()
            ?.facingMode || 'user';

        const newFacingMode = currentFacingMode === 'user' ? 'environment' : 'user';

        // Stop only video tracks (keep audio)
        if (this.localStream) {
            this.localStream.getVideoTracks().forEach(track => track.stop());
        }

        // Get new video stream only
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: newFacingMode },
                audio: false
            });

            // Replace video track in peer connection
            const videoTrack = newStream.getVideoTracks()[0];
            const senders = this.peerConnection.getSenders();
            const videoSender = senders.find(s => s.track && s.track.kind === 'video');

            if (videoSender) {
                await videoSender.replaceTrack(videoTrack);
            }

            // Update local stream - remove old video, add new video, keep audio
            const oldVideoTrack = this.localStream?.getVideoTracks()[0];
            if (oldVideoTrack) {
                this.localStream.removeTrack(oldVideoTrack);
            }
            this.localStream.addTrack(videoTrack);

            console.log('Camera switched to:', newFacingMode);

            return this.localStream;
        } catch (error) {
            console.error('Error switching camera:', error);
            throw error;
        }
    }

    /**
     * Get available cameras
     * @returns {Promise<Array>} List of video input devices
     */
    async getAvailableCameras() {
        try {
            const devices = await navigator.mediaDevices.enumerateDevices();
            this.availableCameras = devices.filter(device => device.kind === 'videoinput');
            console.log('Available cameras:', this.availableCameras.length);
            return this.availableCameras;
        } catch (error) {
            console.error('Error getting cameras:', error);
            return [];
        }
    }

    /**
     * Toggle audio on/off
     * @returns {boolean} New audio state
     */
    toggleAudio() {
        if (this.localStream) {
            const audioTracks = this.localStream.getAudioTracks();
            if (audioTracks.length === 0) {
                console.warn('No audio tracks to toggle');
                this.isAudioEnabled = false;
                return false;
            }
            audioTracks.forEach(track => {
                track.enabled = !track.enabled;
                this.isAudioEnabled = track.enabled;
            });
            console.log('Audio:', this.isAudioEnabled ? 'ON' : 'OFF');
        } else {
            console.warn('No local stream available');
            this.isAudioEnabled = false;
        }
        return this.isAudioEnabled;
    }

    /**
     * Toggle video on/off
     * @returns {boolean} New video state
     */
    toggleVideo() {
        if (this.localStream) {
            const videoTracks = this.localStream.getVideoTracks();
            videoTracks.forEach(track => {
                track.enabled = !track.enabled;
                this.isVideoEnabled = track.enabled;
            });
            console.log('Video:', this.isVideoEnabled ? 'ON' : 'OFF');
        }
        return this.isVideoEnabled;
    }

    /**
     * Switch to specific camera by device ID
     * @param {string} deviceId - Camera device ID
     * @returns {Promise<MediaStream>} New media stream
     */
    async switchToCamera(deviceId) {
        // Stop current video track
        if (this.localStream) {
            const videoTracks = this.localStream.getVideoTracks();
            videoTracks.forEach(track => track.stop());
        }

        try {
            const constraints = {
                video: {
                    deviceId: { exact: deviceId },
                    width: { ideal: 640, max: 1280 },
                    height: { ideal: 480, max: 720 }
                },
                audio: this.localStream?.getAudioTracks().length > 0
            };

            const newStream = await navigator.mediaDevices.getUserMedia(constraints);

            // Replace video track in peer connection
            const videoTrack = newStream.getVideoTracks()[0];
            if (this.peerConnection) {
                const senders = this.peerConnection.getSenders();
                const videoSender = senders.find(s => s.track && s.track.kind === 'video');
                if (videoSender) {
                    await videoSender.replaceTrack(videoTrack);
                }
            }

            // Update local stream
            const oldVideoTrack = this.localStream?.getVideoTracks()[0];
            if (oldVideoTrack) {
                this.localStream.removeTrack(oldVideoTrack);
            }
            this.localStream.addTrack(videoTrack);

            this.currentDeviceId = deviceId;
            this.isVideoEnabled = true;
            console.log('Switched to camera:', deviceId);

            return this.localStream;
        } catch (error) {
            console.error('Error switching camera:', error);
            throw error;
        }
    }

    /**
     * Get connection state
     * @returns {string} Connection state
     */
    getConnectionState() {
        return this.peerConnection?.connectionState || 'disconnected';
    }

    /**
     * Check if connected
     * @returns {boolean} Is connected
     */
    isConnected() {
        return this.peerConnection?.connectionState === 'connected';
    }

    /**
     * Disconnect and cleanup
     */
    disconnect() {
        // Stop local stream tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                track.stop();
                console.log('Local track stopped:', track.kind);
            });
            this.localStream = null;
        }

        // Stop remote stream tracks
        if (this.remoteStream) {
            this.remoteStream.getTracks().forEach(track => {
                track.stop();
                console.log('Remote track stopped:', track.kind);
            });
            this.remoteStream = null;
        }

        // Close peer connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
            console.log('Peer connection closed');
        }

        // Clear callbacks
        this.onRemoteStreamCallback = null;
        this.onIceCandidateCallback = null;
        this.onConnectionStateChangeCallback = null;

        console.log('WebRTC service disconnected and cleaned up');
    }

    /**
     * Start recording with Firebase Storage upload
     * @param {string} target - Recording target: 'local', 'remote', or 'combined'
     * @param {FirebaseService} firebaseService - Firebase service instance
     * @param {string} battleId - Battle ID for storage path
     * @param {Function} onProgress - Progress callback (time, size)
     * @param {boolean} uploadToStorage - Whether to upload to Firebase Storage (true) or keep in memory (false)
     * @param {string} viewMode - Current view mode: 'normal', 'opponent-only', or 'spectator'
     * @returns {boolean} Success
     */
    startRecording(target = RECORDING_CONFIG.target, firebaseService = null, battleId = null, onProgress = null, uploadToStorage = RECORDING_CONFIG.uploadToStorage, viewMode = 'normal') {
        if (this.isRecording) {
            console.warn('Already recording');
            return false;
        }

        this.recordingTarget = target;
        this.firebaseService = firebaseService;
        this.battleId = battleId;
        this.onRecordingProgressCallback = onProgress;
        this.uploadToStorage = uploadToStorage;
        this.currentViewMode = viewMode;
        this.chunkIndex = 0;
        this.totalRecordedSize = 0;
        this.recordingStartTime = Date.now();

        // Set isRecording early so drawFrame() loops can start
        this.isRecording = true;

        let stream;
        switch (target) {
            case 'local':
                stream = this.localStream;
                break;
            case 'remote':
                // In spectator mode, rotate remote video 180 degrees
                if (viewMode === 'spectator') {
                    stream = this.createTransformedRemoteStream();
                } else {
                    stream = this.remoteStream;
                }
                break;
            case 'combined':
                stream = this.createCombinedStream(viewMode);
                break;
            default:
                console.error('Invalid recording target:', target);
                return false;
        }

        if (!stream) {
            console.error('No stream available for recording:', target);
            this.isRecording = false;  // Reset since we set it early
            return false;
        }

        try {
            // Auto-detect supported MIME type (iOS: MP4, Android/Chrome: WebM)
            const mimeType = getSupportedMimeType();
            if (!mimeType) {
                console.error('No supported recording format');
                return false;
            }

            console.log('Using MIME type:', mimeType);
            this.mediaRecorder = new MediaRecorder(stream, { mimeType });
            this.recordingChunks = [];

            this.mediaRecorder.ondataavailable = async (event) => {
                if (event.data.size > 0) {
                    this.totalRecordedSize += event.data.size;

                    // Upload to Firebase Storage if configured
                    if (this.uploadToStorage && this.firebaseService && this.battleId) {
                        try {
                            await this.firebaseService.uploadChunk(
                                this.battleId,
                                event.data,
                                this.chunkIndex,
                                this.recordingTarget
                            );
                            this.chunkIndex++;
                        } catch (error) {
                            console.error('Failed to upload chunk, saving locally:', error);
                            this.recordingChunks.push(event.data);
                        }
                    } else {
                        // Memory mode: store in browser memory
                        this.recordingChunks.push(event.data);
                    }

                    // Report progress
                    if (this.onRecordingProgressCallback) {
                        const elapsedMs = Date.now() - this.recordingStartTime;
                        this.onRecordingProgressCallback(elapsedMs, this.totalRecordedSize);
                    }
                }
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                this.stopRecording();
            };

            this.mediaRecorder.start(RECORDING_CONFIG.chunkInterval);
            console.log('Recording started:', target, 'viewMode:', viewMode, 'Upload to Storage:', this.uploadToStorage);
            return true;
        } catch (error) {
            console.error('Error starting recording:', error);
            this.isRecording = false;  // Reset since we set it early
            this.cleanupCombinedStream();
            return false;
        }
    }

    /**
     * Stop recording
     * @returns {Promise<{blob: Blob|null, target: string, uploadedToStorage: boolean, chunkCount: number, totalSize: number, duration: number}>} Recording data
     */
    stopRecording() {
        return new Promise(async (resolve, reject) => {
            if (!this.isRecording || !this.mediaRecorder) {
                reject(new Error('Not recording'));
                return;
            }

            const duration = Date.now() - this.recordingStartTime;
            const uploadedToStorage = this.uploadToStorage && this.firebaseService && this.battleId;

            this.mediaRecorder.onstop = async () => {
                let blob = null;

                // If we have local chunks, create a blob
                if (this.recordingChunks.length > 0) {
                    const mimeType = this.recordingChunks[0].type || 'video/webm';
                    blob = new Blob(this.recordingChunks, { type: mimeType });
                }

                // Save metadata to Firebase Storage
                if (uploadedToStorage && this.firebaseService) {
                    try {
                        await this.firebaseService.saveRecordingMetadata(this.battleId, this.recordingTarget, {
                            chunkCount: this.chunkIndex,
                            totalSize: this.totalRecordedSize,
                            duration: duration,
                            createdAt: new Date().toISOString(),
                            mimeType: getSupportedMimeType()
                        });
                    } catch (error) {
                        console.error('Failed to save metadata:', error);
                    }
                }

                const result = {
                    blob,
                    target: this.recordingTarget,
                    uploadedToStorage,
                    chunkCount: this.chunkIndex,
                    totalSize: this.totalRecordedSize,
                    duration
                };

                // Cleanup combined stream resources
                if (this.recordingTarget === 'combined') {
                    this.cleanupCombinedStream();
                }

                // Reset state
                this.recordingChunks = [];
                this.isRecording = false;
                this.chunkIndex = 0;
                this.totalRecordedSize = 0;
                this.recordingStartTime = null;
                this.onRecordingProgressCallback = null;

                console.log('Recording stopped:', this.recordingTarget,
                    'Chunks:', result.chunkCount,
                    'Size:', (result.totalSize / 1024 / 1024).toFixed(2), 'MB',
                    'Duration:', Math.round(result.duration / 1000), 's');

                resolve(result);
            };

            this.mediaRecorder.stop();
        });
    }

    /**
     * Create transformed remote stream (for spectator mode recording)
     * Rotates the remote video 180 degrees
     * @returns {MediaStream} Transformed media stream
     */
    createTransformedRemoteStream() {
        if (!this.remoteStream) {
            console.error('Remote stream required for transformed recording');
            return null;
        }

        // Create canvas for transformation
        this.combinedCanvas = document.createElement('canvas');
        this.combinedCanvas.width = 640;
        this.combinedCanvas.height = 480;
        this.combinedContext = this.combinedCanvas.getContext('2d');

        // Create video element for drawing
        const remoteVideoEl = document.createElement('video');
        remoteVideoEl.srcObject = this.remoteStream;
        remoteVideoEl.muted = true;
        remoteVideoEl.play();

        // Draw frames to canvas with 180 degree rotation
        const drawFrame = () => {
            if (!this.isRecording) return;

            const ctx = this.combinedContext;
            const width = this.combinedCanvas.width;
            const height = this.combinedCanvas.height;

            // Rotate 180 degrees (for spectator mode)
            ctx.save();
            ctx.translate(width, height);
            ctx.rotate(Math.PI);
            ctx.drawImage(remoteVideoEl, 0, 0, width, height);
            ctx.restore();

            this.animationFrameId = requestAnimationFrame(drawFrame);
        };

        // Start drawing when video is ready (or immediately if already loaded)
        const startDrawing = () => {
            console.log('Starting transformed remote recording drawFrame loop (180° rotation)');
            drawFrame();
        };

        // Check if video is already ready, otherwise wait
        if (remoteVideoEl.readyState >= 2) {
            startDrawing();
        } else {
            remoteVideoEl.onloadeddata = startDrawing;
            // Fallback timeout
            setTimeout(() => {
                if (this.isRecording && !this.animationFrameId) {
                    console.log('Fallback: starting drawFrame after timeout');
                    startDrawing();
                }
            }, 100);
        }

        // Create stream from canvas
        const canvasStream = this.combinedCanvas.captureStream(30);

        // Add audio track if available
        if (RECORDING_CONFIG.includeAudio) {
            const remoteAudio = this.remoteStream.getAudioTracks()[0];
            if (remoteAudio) canvasStream.addTrack(remoteAudio.clone());
        }

        this.combinedStream = canvasStream;
        console.log('Created transformed remote stream (180° rotation)');
        return canvasStream;
    }

    /**
     * Create combined stream from local and remote videos
     * @param {string} viewMode - Current view mode for applying transformations
     * @returns {MediaStream} Combined media stream
     */
    createCombinedStream(viewMode = 'normal') {
        if (!this.localStream || !this.remoteStream) {
            console.error('Both streams required for combined recording');
            return null;
        }

        // Create canvas for combining videos
        this.combinedCanvas = document.createElement('canvas');
        this.combinedCanvas.width = 640;
        this.combinedCanvas.height = 960; // 480 * 2 for stacked videos
        this.combinedContext = this.combinedCanvas.getContext('2d');

        // Create video elements for drawing
        const localVideoEl = document.createElement('video');
        const remoteVideoEl = document.createElement('video');
        localVideoEl.srcObject = this.localStream;
        remoteVideoEl.srcObject = this.remoteStream;
        localVideoEl.muted = true;
        remoteVideoEl.muted = true;
        localVideoEl.play();
        remoteVideoEl.play();

        const isSpectatorMode = viewMode === 'spectator';

        // Draw frames to canvas
        const drawFrame = () => {
            if (!this.isRecording) return;

            const ctx = this.combinedContext;
            const width = this.combinedCanvas.width;
            const height = this.combinedCanvas.height / 2;

            // Draw remote video on top
            if (isSpectatorMode) {
                // In spectator mode, rotate remote video 180 degrees
                ctx.save();
                ctx.translate(width, height);
                ctx.rotate(Math.PI);
                ctx.drawImage(remoteVideoEl, 0, 0, width, height);
                ctx.restore();
            } else {
                // Normal mode: draw as-is
                ctx.drawImage(remoteVideoEl, 0, 0, width, height);
            }

            // Draw local video on bottom (mirrored for selfie view)
            ctx.save();
            ctx.translate(width, height);
            ctx.scale(-1, 1);
            ctx.drawImage(localVideoEl, 0, 0, width, height);
            ctx.restore();

            this.animationFrameId = requestAnimationFrame(drawFrame);
        };

        // Start drawing when videos are ready (or immediately if already loaded)
        const startDrawing = () => {
            console.log('Starting combined recording drawFrame loop, spectator mode:', isSpectatorMode);
            drawFrame();
        };

        // Check if videos are already ready, otherwise wait for metadata
        const checkReady = () => {
            if (localVideoEl.readyState >= 2 && remoteVideoEl.readyState >= 2) {
                startDrawing();
            } else {
                // Wait a bit and check again, or use events
                const onReady = () => {
                    if (localVideoEl.readyState >= 2 && remoteVideoEl.readyState >= 2) {
                        startDrawing();
                    }
                };
                localVideoEl.onloadeddata = onReady;
                remoteVideoEl.onloadeddata = onReady;
                // Also try after a short delay as fallback
                setTimeout(() => {
                    if (this.isRecording && !this.animationFrameId) {
                        console.log('Fallback: starting drawFrame after timeout');
                        startDrawing();
                    }
                }, 100);
            }
        };
        checkReady();

        // Create stream from canvas
        const canvasStream = this.combinedCanvas.captureStream(30);

        // Add audio tracks if available
        if (RECORDING_CONFIG.includeAudio) {
            const localAudio = this.localStream.getAudioTracks()[0];
            const remoteAudio = this.remoteStream.getAudioTracks()[0];
            if (localAudio) canvasStream.addTrack(localAudio.clone());
            if (remoteAudio) canvasStream.addTrack(remoteAudio.clone());
        }

        this.combinedStream = canvasStream;
        console.log('Created combined stream, spectator mode:', isSpectatorMode);
        return canvasStream;
    }

    /**
     * Cleanup combined stream resources
     */
    cleanupCombinedStream() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        if (this.combinedStream) {
            this.combinedStream.getTracks().forEach(track => track.stop());
            this.combinedStream = null;
        }
        this.combinedCanvas = null;
        this.combinedContext = null;
    }

    /**
     * Download recording
     * @param {Blob} blob - Recording blob
     * @param {string} target - Recording target for filename
     */
    downloadRecording(blob, target) {
        const timestamp = new Date().toISOString()
            .replace(/[:.]/g, '')
            .slice(0, 15);
        const ext = getFileExtension(blob.type);
        const filename = `battle_${timestamp}_${target}.${ext}`;

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('Recording downloaded:', filename);
    }

    /**
     * Get recording progress info
     * @returns {{isRecording: boolean, duration: number, size: number}}
     */
    getRecordingProgress() {
        if (!this.isRecording) {
            return { isRecording: false, duration: 0, size: 0 };
        }
        return {
            isRecording: true,
            duration: Date.now() - this.recordingStartTime,
            size: this.totalRecordedSize
        };
    }

    /**
     * Check if recording is in progress
     * @returns {boolean} Is recording
     */
    getRecordingState() {
        return this.isRecording;
    }
}
