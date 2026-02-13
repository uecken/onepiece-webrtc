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
