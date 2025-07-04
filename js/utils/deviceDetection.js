export function isMobile() {
    // Check multiple indicators for mobile devices
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    
    // Check for mobile user agents
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    if (mobileRegex.test(userAgent)) {
        return true;
    }
    
    // Check for touch support
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    
    // Check screen size and orientation
    const isSmallScreen = window.innerWidth <= 768 || window.innerHeight <= 768;
    
    // Check if device has coarse pointer (touchscreen)
    const hasCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    
    // Consider it mobile if:
    // 1. Has touch support AND (small screen OR coarse pointer)
    // 2. Or if it's explicitly a mobile user agent
    return hasTouch && (isSmallScreen || hasCoarsePointer);
}

export function isTablet() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const tabletRegex = /iPad|Android(?!.*Mobile)|Tablet/i;
    return tabletRegex.test(userAgent) && window.innerWidth > 768 && window.innerWidth <= 1024;
}

export function getDeviceType() {
    if (isMobile()) return 'mobile';
    if (isTablet()) return 'tablet';
    return 'desktop';
}