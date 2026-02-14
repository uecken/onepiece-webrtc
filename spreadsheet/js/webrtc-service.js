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
     * Start recording
     * @param {string} target - Recording target: 'local', 'remote', or 'combined'
     * @returns {boolean} Success
     */
    startRecording(target = RECORDING_CONFIG.target) {
        if (this.isRecording) {
            console.warn('Already recording');
            return false;
        }

        this.recordingTarget = target;
        let stream;

        switch (target) {
            case 'local':
                stream = this.localStream;
                break;
            case 'remote':
                stream = this.remoteStream;
                break;
            case 'combined':
                stream = this.createCombinedStream();
                break;
            default:
                console.error('Invalid recording target:', target);
                return false;
        }

        if (!stream) {
            console.error('No stream available for recording:', target);
            return false;
        }

        try {
            const mimeType = RECORDING_CONFIG.mimeType;
            const options = MediaRecorder.isTypeSupported(mimeType)
                ? { mimeType }
                : { mimeType: 'video/webm' };

            this.mediaRecorder = new MediaRecorder(stream, options);
            this.recordingChunks = [];

            this.mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    this.recordingChunks.push(event.data);
                }
            };

            this.mediaRecorder.onerror = (event) => {
                console.error('MediaRecorder error:', event.error);
                this.stopRecording();
            };

            this.mediaRecorder.start(RECORDING_CONFIG.chunkInterval);
            this.isRecording = true;
            console.log('Recording started:', target);
            return true;
        } catch (error) {
            console.error('Error starting recording:', error);
            return false;
        }
    }

    /**
     * Stop recording
     * @returns {Promise<{blob: Blob, target: string}>} Recording data
     */
    stopRecording() {
        return new Promise((resolve, reject) => {
            if (!this.isRecording || !this.mediaRecorder) {
                reject(new Error('Not recording'));
                return;
            }

            this.mediaRecorder.onstop = () => {
                const blob = new Blob(this.recordingChunks, { type: 'video/webm' });
                const result = { blob, target: this.recordingTarget };

                // Cleanup combined stream resources
                if (this.recordingTarget === 'combined') {
                    this.cleanupCombinedStream();
                }

                this.recordingChunks = [];
                this.isRecording = false;
                console.log('Recording stopped:', this.recordingTarget);
                resolve(result);
            };

            this.mediaRecorder.stop();
        });
    }

    /**
     * Create combined stream from local and remote videos
     * @returns {MediaStream} Combined media stream
     */
    createCombinedStream() {
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

        // Draw frames to canvas
        const drawFrame = () => {
            if (!this.isRecording) return;

            const ctx = this.combinedContext;
            const width = this.combinedCanvas.width;
            const height = this.combinedCanvas.height / 2;

            // Draw remote video on top
            ctx.drawImage(remoteVideoEl, 0, 0, width, height);

            // Draw local video on bottom (mirrored)
            ctx.save();
            ctx.translate(width, height);
            ctx.scale(-1, 1);
            ctx.drawImage(localVideoEl, 0, 0, width, height);
            ctx.restore();

            this.animationFrameId = requestAnimationFrame(drawFrame);
        };

        // Start drawing when videos are ready
        Promise.all([
            new Promise(r => localVideoEl.onloadedmetadata = r),
            new Promise(r => remoteVideoEl.onloadedmetadata = r)
        ]).then(() => {
            drawFrame();
        });

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
        const filename = `battle_${timestamp}_${target}.webm`;

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
     * Check if recording is in progress
     * @returns {boolean} Is recording
     */
    getRecordingState() {
        return this.isRecording;
    }
}
