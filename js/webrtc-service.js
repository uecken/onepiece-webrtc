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
    }

    /**
     * Request camera access
     * @returns {Promise<MediaStream>} Local media stream
     */
    async requestCameraAccess() {
        try {
            this.localStream = await navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
            console.log('Camera access granted');
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

        // Stop current tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
        }

        // Get new stream
        try {
            const newStream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: newFacingMode },
                audio: false
            });

            // Replace track in peer connection
            const videoTrack = newStream.getVideoTracks()[0];
            const senders = this.peerConnection.getSenders();
            const videoSender = senders.find(s => s.track && s.track.kind === 'video');

            if (videoSender) {
                await videoSender.replaceTrack(videoTrack);
            }

            this.localStream = newStream;
            console.log('Camera switched to:', newFacingMode);

            return newStream;
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
