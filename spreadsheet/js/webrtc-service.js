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
}
