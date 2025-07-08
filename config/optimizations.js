// Performance optimization configurations and utilities

// Object pooling for frequently created/destroyed objects
class ObjectPool {
  constructor(createFn, resetFn, initialSize = 10) {
    this.createFn = createFn;
    this.resetFn = resetFn;
    this.pool = [];
    this.active = new Set();
    
    // Pre-populate pool
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(this.createFn());
    }
  }
  
  acquire() {
    let obj;
    if (this.pool.length > 0) {
      obj = this.pool.pop();
    } else {
      obj = this.createFn();
    }
    this.active.add(obj);
    return obj;
  }
  
  release(obj) {
    if (this.active.has(obj)) {
      this.active.delete(obj);
      this.resetFn(obj);
      this.pool.push(obj);
    }
  }
  
  clear() {
    this.pool = [];
    this.active.clear();
  }
}

// Optimized loop utilities
const loopUtils = {
  // Use for...of instead of forEach for better performance
  forEachOptimized(array, callback) {
    const length = array.length;
    for (let i = 0; i < length; i++) {
      callback(array[i], i, array);
    }
  },
  
  // Optimized object iteration
  forInOptimized(obj, callback) {
    const keys = Object.keys(obj);
    const length = keys.length;
    for (let i = 0; i < length; i++) {
      const key = keys[i];
      callback(obj[key], key, obj);
    }
  },
  
  // Batch processing for large arrays
  processBatch(array, batchSize, processFunc, doneCallback) {
    let index = 0;
    
    function processBatch() {
      const endIndex = Math.min(index + batchSize, array.length);
      
      for (let i = index; i < endIndex; i++) {
        processFunc(array[i], i);
      }
      
      index = endIndex;
      
      if (index < array.length) {
        // Use setImmediate for better performance than setTimeout(0)
        setImmediate(processBatch);
      } else if (doneCallback) {
        doneCallback();
      }
    }
    
    processBatch();
  }
};

// Performance monitoring utilities
const performanceUtils = {
  markers: new Map(),
  
  mark(name) {
    this.markers.set(name, process.hrtime.bigint());
  },
  
  measure(name, startMark) {
    const start = this.markers.get(startMark);
    if (!start) return 0;
    
    const end = process.hrtime.bigint();
    const duration = Number(end - start) / 1e6; // Convert to milliseconds
    this.markers.delete(startMark);
    
    return duration;
  },
  
  // Throttle function execution
  throttle(func, delay) {
    let lastCall = 0;
    let timeout = null;
    
    return function(...args) {
      const now = Date.now();
      const timeSinceLastCall = now - lastCall;
      
      if (timeSinceLastCall >= delay) {
        lastCall = now;
        func.apply(this, args);
      } else if (!timeout) {
        timeout = setTimeout(() => {
          lastCall = Date.now();
          timeout = null;
          func.apply(this, args);
        }, delay - timeSinceLastCall);
      }
    };
  },
  
  // Debounce function execution
  debounce(func, wait) {
    let timeout;
    
    return function(...args) {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
};

// Memory optimization utilities
const memoryUtils = {
  // Efficient string concatenation for large operations
  stringBuilder: class {
    constructor() {
      this.strings = [];
    }
    
    append(str) {
      this.strings.push(str);
      return this;
    }
    
    toString() {
      return this.strings.join('');
    }
    
    clear() {
      this.strings.length = 0;
    }
  },
  
  // Object recycling
  recycleObject(obj) {
    // Clear object properties efficiently
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        delete obj[key];
      }
    }
    return obj;
  },
  
  // Efficient array clearing
  clearArray(arr) {
    arr.length = 0;
    return arr;
  }
};

// Network optimization settings
const networkOptimizations = {
  // Compress payloads above this size
  compressionThreshold: 1024,
  
  // Batch network updates
  batchInterval: 16, // ~60fps
  
  // Limit update frequency per player
  playerUpdateThrottle: 50, // ms
  
  // Maximum players to update per tick
  maxPlayersPerTick: 50,
  
  // Dead reckoning threshold
  positionThreshold: 5, // pixels
  
  // Network message priorities
  priorities: {
    CRITICAL: 0,  // Death, respawn
    HIGH: 1,      // Combat, damage
    MEDIUM: 2,    // Movement, building
    LOW: 3        // Chat, cosmetic
  }
};

// Collision optimization settings
const collisionOptimizations = {
  // Spatial hash grid size
  gridSize: 128,
  
  // Maximum collision checks per frame
  maxChecksPerFrame: 100,
  
  // Broad phase collision bounds
  boundsPadding: 50,
  
  // Skip collision for distant objects
  maxDistance: 1000
};

// Server tick optimizations
const tickOptimizations = {
  // Target tick rate
  targetTickRate: 60,
  
  // Adaptive tick rate based on load
  adaptiveTick: true,
  minTickRate: 30,
  maxTickRate: 60,
  
  // Skip processing for inactive players
  inactivePlayerThreshold: 5000, // ms
  
  // Batch size for game state updates
  updateBatchSize: 10
};

// Export all optimizations
module.exports = {
  ObjectPool,
  loopUtils,
  performanceUtils,
  memoryUtils,
  networkOptimizations,
  collisionOptimizations,
  tickOptimizations
}; 