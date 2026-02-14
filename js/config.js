// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyDo4lHXDtFc1eaG-RJiGj0q5PioTzYpMWE",
    authDomain: "onepiece-web-a1c05.firebaseapp.com",
    projectId: "onepiece-web-a1c05",
    storageBucket: "onepiece-web-a1c05.firebasestorage.app",
    messagingSenderId: "977136307911",
    appId: "1:977136307911:web:5a1989e8b6373bf7d4f8e2"
};

// STUN Servers for WebRTC
const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
];

// Island Configuration
const ISLAND_CONFIG = [
    { id: 'east-blue', name: 'East Blue Island', description: 'Where the journey begins' },
    { id: 'grand-line', name: 'Grand Line Island', description: 'The pirate\'s paradise' },
    { id: 'new-world', name: 'New World Island', description: 'For the strongest pirates' },
    { id: 'wano', name: 'Wano Country', description: 'Land of the samurai' },
    { id: 'skypiea', name: 'Skypiea Island', description: 'Island in the sky' }
];

// Media constraints for mobile
const MEDIA_CONSTRAINTS = {
    video: {
        facingMode: 'user',
        width: { ideal: 640, max: 1280 },
        height: { ideal: 480, max: 720 }
    },
    audio: true
};

// Legacy alias
const VIDEO_CONSTRAINTS = MEDIA_CONSTRAINTS;

// View Mode Configuration
const VIEW_MODE_CONFIG = {
    default: 'normal',  // 'normal' | 'opponent-only' | 'spectator'
    modes: ['normal', 'opponent-only', 'spectator']
};

// Recording Configuration
const RECORDING_CONFIG = {
    target: 'local',           // 'local' | 'remote' | 'combined'
    chunkInterval: 10000,      // 10秒ごとにチャンク生成
    includeAudio: true,
    uploadToStorage: true,     // true: Firebase Storage, false: メモリ蓄積
    maxDurationMs: 60 * 60 * 1000,  // 最大録画時間: 1時間
};

/**
 * Get supported MIME type for MediaRecorder
 * iOS Safari: MP4/H264, Chrome/Firefox: WebM/VP9
 * @returns {string} Supported MIME type
 */
function getSupportedMimeType() {
    const types = [
        'video/webm;codecs=vp9,opus',   // Chrome/Firefox (preferred)
        'video/webm;codecs=vp8,opus',   // Older browsers
        'video/webm',                    // Generic WebM
        'video/mp4;codecs=h264,aac',    // iOS Safari
        'video/mp4',                     // Generic MP4
    ];
    for (const type of types) {
        if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
            return type;
        }
    }
    return '';
}

/**
 * Get file extension based on MIME type
 * @param {string} mimeType - MIME type
 * @returns {string} File extension
 */
function getFileExtension(mimeType) {
    if (mimeType.includes('mp4')) return 'mp4';
    return 'webm';
}
