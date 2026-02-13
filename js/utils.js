// Utility Functions

/**
 * Generate a unique user ID
 * @returns {string} Unique user ID
 */
function generateUserId() {
    return 'user_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
}

/**
 * Generate a unique battle ID
 * @returns {string} Unique battle ID
 */
function generateBattleId() {
    return 'battle_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now().toString(36);
}

/**
 * Get or create user ID from localStorage
 * @returns {string} User ID
 */
function getOrCreateUserId() {
    let userId = localStorage.getItem('userId');
    if (!userId) {
        userId = generateUserId();
        localStorage.setItem('userId', userId);
    }
    return userId;
}

/**
 * Get status display text
 * @param {string} status - Island status
 * @returns {string} Display text
 */
function getStatusText(status) {
    const statusTexts = {
        'empty': '空き',
        'waiting': '対戦相手募集中',
        'in_battle': '対戦中'
    };
    return statusTexts[status] || status;
}

/**
 * Get status CSS class
 * @param {string} status - Island status
 * @returns {string} CSS class name
 */
function getStatusClass(status) {
    return status.replace('_', '-');
}

/**
 * Show error message to user
 * @param {string} message - Error message
 */
function showError(message) {
    alert(message);
    console.error(message);
}

/**
 * Show loading state
 * @param {HTMLElement} element - Element to show loading on
 * @param {boolean} isLoading - Loading state
 */
function setLoading(element, isLoading) {
    if (isLoading) {
        element.classList.add('loading');
        element.disabled = true;
    } else {
        element.classList.remove('loading');
        element.disabled = false;
    }
}

/**
 * Parse URL parameters
 * @returns {URLSearchParams} URL parameters
 */
function getUrlParams() {
    return new URLSearchParams(window.location.search);
}

/**
 * Navigate to battle screen
 * @param {string} battleId - Battle ID
 * @param {string} role - 'creator' or 'joiner'
 */
function navigateToBattle(battleId, role) {
    window.location.href = `battle.html?battleId=${encodeURIComponent(battleId)}&role=${encodeURIComponent(role)}`;
}

/**
 * Navigate to matching screen
 */
function navigateToMatching() {
    window.location.href = 'index.html';
}

/**
 * Debounce function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}
