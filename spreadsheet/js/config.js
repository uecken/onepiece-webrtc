// Configuration for Google Spreadsheet Version

// TODO: Replace with your Google Apps Script Web App URL
const GAS_WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbyCsihPBoDfNm4VZNOML44GmljkmHK7Ud3PN265UZ56qOzYOlj72iFRJq-3033a8IlR/exec';

// Polling interval (milliseconds)
const POLLING_INTERVAL = 5000;  // 5 seconds

// STUN Servers for WebRTC
const STUN_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
];

// Island Configuration (for display purposes)
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
    target: 'local',  // 'local' | 'remote' | 'combined'
    format: 'webm',
    mimeType: 'video/webm;codecs=vp9,opus',
    includeAudio: true,
    chunkInterval: 1000  // milliseconds
};
