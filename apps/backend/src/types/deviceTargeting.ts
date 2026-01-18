/**
 * Device Targeting Types
 * Defines device profiles for responsive test generation
 */

export interface DeviceViewport {
  width: number;
  height: number;
}

export interface DeviceTarget {
  type: 'desktop' | 'tablet' | 'mobile';
  deviceName?: string;
  viewport: DeviceViewport;
  userAgent?: string;
  isTouchEnabled?: boolean;
  pixelRatio?: number;
}

export interface DeviceProfile {
  name: string;
  type: 'desktop' | 'tablet' | 'mobile';
  viewport: DeviceViewport;
  userAgent: string;
  isTouchEnabled: boolean;
  pixelRatio: number;
}

/**
 * Predefined device profiles
 * Based on common device specifications
 */
export const DEVICE_PROFILES: Record<string, DeviceProfile> = {
  // Desktop profiles
  'Desktop 1920x1080': {
    name: 'Desktop 1920x1080',
    type: 'desktop',
    viewport: { width: 1920, height: 1080 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    isTouchEnabled: false,
    pixelRatio: 1,
  },
  'Desktop 1440x900': {
    name: 'Desktop 1440x900',
    type: 'desktop',
    viewport: { width: 1440, height: 900 },
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    isTouchEnabled: false,
    pixelRatio: 2,
  },
  'Desktop 1366x768': {
    name: 'Desktop 1366x768',
    type: 'desktop',
    viewport: { width: 1366, height: 768 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    isTouchEnabled: false,
    pixelRatio: 1,
  },
  'Desktop 2560x1440': {
    name: 'Desktop 2560x1440',
    type: 'desktop',
    viewport: { width: 2560, height: 1440 },
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    isTouchEnabled: false,
    pixelRatio: 1,
  },

  // iPhone profiles
  'iPhone 15 Pro Max': {
    name: 'iPhone 15 Pro Max',
    type: 'mobile',
    viewport: { width: 430, height: 932 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    isTouchEnabled: true,
    pixelRatio: 3,
  },
  'iPhone 15 Pro': {
    name: 'iPhone 15 Pro',
    type: 'mobile',
    viewport: { width: 393, height: 852 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    isTouchEnabled: true,
    pixelRatio: 3,
  },
  'iPhone 15': {
    name: 'iPhone 15',
    type: 'mobile',
    viewport: { width: 393, height: 852 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    isTouchEnabled: true,
    pixelRatio: 3,
  },
  'iPhone 14': {
    name: 'iPhone 14',
    type: 'mobile',
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    isTouchEnabled: true,
    pixelRatio: 3,
  },
  'iPhone 13': {
    name: 'iPhone 13',
    type: 'mobile',
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    isTouchEnabled: true,
    pixelRatio: 3,
  },
  'iPhone SE': {
    name: 'iPhone SE',
    type: 'mobile',
    viewport: { width: 375, height: 667 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
    isTouchEnabled: true,
    pixelRatio: 2,
  },

  // iPad profiles
  'iPad Pro 12.9': {
    name: 'iPad Pro 12.9',
    type: 'tablet',
    viewport: { width: 1024, height: 1366 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    isTouchEnabled: true,
    pixelRatio: 2,
  },
  'iPad Pro 11': {
    name: 'iPad Pro 11',
    type: 'tablet',
    viewport: { width: 834, height: 1194 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    isTouchEnabled: true,
    pixelRatio: 2,
  },
  'iPad Air': {
    name: 'iPad Air',
    type: 'tablet',
    viewport: { width: 820, height: 1180 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    isTouchEnabled: true,
    pixelRatio: 2,
  },
  'iPad Mini': {
    name: 'iPad Mini',
    type: 'tablet',
    viewport: { width: 768, height: 1024 },
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
    isTouchEnabled: true,
    pixelRatio: 2,
  },

  // Android phones
  'Samsung Galaxy S24 Ultra': {
    name: 'Samsung Galaxy S24 Ultra',
    type: 'mobile',
    viewport: { width: 412, height: 915 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    isTouchEnabled: true,
    pixelRatio: 3.5,
  },
  'Samsung Galaxy S23': {
    name: 'Samsung Galaxy S23',
    type: 'mobile',
    viewport: { width: 360, height: 780 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    isTouchEnabled: true,
    pixelRatio: 3,
  },
  'Samsung Galaxy A54': {
    name: 'Samsung Galaxy A54',
    type: 'mobile',
    viewport: { width: 360, height: 800 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    isTouchEnabled: true,
    pixelRatio: 2.625,
  },
  'Google Pixel 8 Pro': {
    name: 'Google Pixel 8 Pro',
    type: 'mobile',
    viewport: { width: 412, height: 915 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    isTouchEnabled: true,
    pixelRatio: 3.5,
  },
  'Google Pixel 8': {
    name: 'Google Pixel 8',
    type: 'mobile',
    viewport: { width: 412, height: 915 },
    userAgent: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    isTouchEnabled: true,
    pixelRatio: 2.625,
  },
  'Google Pixel 7': {
    name: 'Google Pixel 7',
    type: 'mobile',
    viewport: { width: 412, height: 915 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    isTouchEnabled: true,
    pixelRatio: 2.625,
  },

  // Android tablets
  'Samsung Galaxy Tab S9': {
    name: 'Samsung Galaxy Tab S9',
    type: 'tablet',
    viewport: { width: 800, height: 1280 },
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    isTouchEnabled: true,
    pixelRatio: 2,
  },
};

/**
 * Get device profile by name
 */
export function getDeviceProfile(name: string): DeviceProfile | undefined {
  return DEVICE_PROFILES[name];
}

/**
 * Get all device profiles by type
 */
export function getDevicesByType(type: 'desktop' | 'tablet' | 'mobile'): DeviceProfile[] {
  return Object.values(DEVICE_PROFILES).filter(d => d.type === type);
}

/**
 * Get default device target (Desktop 1920x1080)
 */
export function getDefaultDeviceTarget(): DeviceTarget {
  return {
    type: 'desktop',
    viewport: { width: 1920, height: 1080 },
  };
}

/**
 * Validate and normalize device target
 */
export function validateDeviceTarget(input?: Partial<DeviceTarget>): DeviceTarget {
  if (!input || !input.type) {
    return getDefaultDeviceTarget();
  }

  if (!['desktop', 'tablet', 'mobile'].includes(input.type)) {
    throw new Error('Invalid device type. Must be: desktop, tablet, or mobile');
  }

  if (!input.viewport || input.viewport.width <= 0 || input.viewport.height <= 0) {
    throw new Error('Invalid viewport. Width and height must be positive numbers');
  }

  return {
    type: input.type,
    deviceName: input.deviceName,
    viewport: {
      width: Math.round(input.viewport.width),
      height: Math.round(input.viewport.height),
    },
    userAgent: input.userAgent,
    isTouchEnabled: input.isTouchEnabled,
    pixelRatio: input.pixelRatio,
  };
}
