export function isMobile() {
    // Check multiple indicators for mobile devices
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    
    // Check for mobile user agents - this is the most reliable indicator
    const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
    if (mobileRegex.test(userAgent)) {
        return true;
    }
    
    // Check for tablet user agents that should be considered mobile
    const tabletRegex = /iPad|Android.*Tablet|Tablet.*Android/i;
    if (tabletRegex.test(userAgent)) {
        return true;
    }
    
    // Check screen size - but be more strict
    const isSmallScreen = window.innerWidth <= 768 && window.innerHeight <= 1024;
    
    // Check if it has BOTH touch and mouse support (likely a touchscreen laptop/desktop)
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const hasMouse = window.matchMedia && window.matchMedia("(hover: hover)").matches;
    const hasFinePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    
    // If it has both mouse hover capability and fine pointer, it's likely a desktop with touchscreen
    if (hasTouch && (hasMouse || hasFinePointer)) {
        return false; // Desktop with touchscreen
    }
    
    // Only consider it mobile if it's a small screen AND has touch but NO mouse/fine pointer
    return hasTouch && isSmallScreen && !hasMouse && !hasFinePointer;
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

// Debug function to log device detection details
export function debugDeviceDetection() {
    const userAgent = navigator.userAgent || navigator.vendor || window.opera;
    const hasTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const hasMouse = window.matchMedia && window.matchMedia("(hover: hover)").matches;
    const hasFinePointer = window.matchMedia && window.matchMedia("(pointer: fine)").matches;
    const hasCoarsePointer = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    
    console.log('Device Detection Debug:', {
        userAgent: userAgent,
        screenSize: `${window.innerWidth}x${window.innerHeight}`,
        hasTouch: hasTouch,
        maxTouchPoints: navigator.maxTouchPoints,
        hasMouse: hasMouse,
        hasFinePointer: hasFinePointer,
        hasCoarsePointer: hasCoarsePointer,
        detected: getDeviceType()
    });
}