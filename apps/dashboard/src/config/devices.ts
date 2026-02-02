/**
 * Device Emulator Configuration
 * Viewport and device settings for execution
 */

export interface DeviceConfig {
  id: string;
  name: string;
  category: 'mobile' | 'tablet' | 'desktop';
  viewport: {
    width: number;
    height: number;
  };
  userAgent?: string;
  deviceScaleFactor?: number;
  isMobile?: boolean;
  hasTouch?: boolean;
}

export const devices: DeviceConfig[] = [
  // Mobile - iPhone
  {
    id: 'iphone-12',
    name: 'iPhone 12',
    category: 'mobile',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
  },
  {
    id: 'iphone-13',
    name: 'iPhone 13',
    category: 'mobile',
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1',
  },
  {
    id: 'iphone-14-pro',
    name: 'iPhone 14 Pro',
    category: 'mobile',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  },
  {
    id: 'iphone-15-pro',
    name: 'iPhone 15 Pro',
    category: 'mobile',
    viewport: { width: 393, height: 852 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  },
  // Mobile - Samsung
  {
    id: 'samsung-galaxy-s21',
    name: 'Samsung Galaxy S21',
    category: 'mobile',
    viewport: { width: 360, height: 800 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36',
  },
  {
    id: 'samsung-galaxy-s22',
    name: 'Samsung Galaxy S22',
    category: 'mobile',
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-S901B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36',
  },
  {
    id: 'samsung-galaxy-s23',
    name: 'Samsung Galaxy S23',
    category: 'mobile',
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36',
  },
  // Mobile - Pixel
  {
    id: 'pixel-6',
    name: 'Pixel 6',
    category: 'mobile',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Mobile Safari/537.36',
  },
  {
    id: 'pixel-7',
    name: 'Pixel 7',
    category: 'mobile',
    viewport: { width: 412, height: 915 },
    deviceScaleFactor: 2.625,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Mobile Safari/537.36',
  },
  // Tablet
  {
    id: 'ipad-pro-11',
    name: 'iPad Pro 11"',
    category: 'tablet',
    viewport: { width: 834, height: 1194 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  },
  {
    id: 'ipad-pro-12',
    name: 'iPad Pro 12.9"',
    category: 'tablet',
    viewport: { width: 1024, height: 1366 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
  },
  {
    id: 'samsung-galaxy-tab-s8',
    name: 'Galaxy Tab S8',
    category: 'tablet',
    viewport: { width: 800, height: 1280 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (Linux; Android 12; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.127 Safari/537.36',
  },
  // Desktop
  {
    id: 'desktop-1080p',
    name: 'Desktop 1080p',
    category: 'desktop',
    viewport: { width: 1920, height: 1080 },
    isMobile: false,
    hasTouch: false,
  },
  {
    id: 'desktop-1440p',
    name: 'Desktop 1440p',
    category: 'desktop',
    viewport: { width: 2560, height: 1440 },
    isMobile: false,
    hasTouch: false,
  },
  {
    id: 'laptop-13',
    name: 'Laptop 13"',
    category: 'desktop',
    viewport: { width: 1280, height: 800 },
    isMobile: false,
    hasTouch: false,
  },
  {
    id: 'laptop-15',
    name: 'Laptop 15"',
    category: 'desktop',
    viewport: { width: 1440, height: 900 },
    isMobile: false,
    hasTouch: false,
  },
];

export interface BrowserConfig {
  id: string;
  name: string;
  icon: string;
}

export const browsers: BrowserConfig[] = [
  { id: 'chromium', name: 'Chromium', icon: 'chrome' },
  { id: 'firefox', name: 'Firefox', icon: 'firefox' },
  { id: 'webkit', name: 'WebKit (Safari)', icon: 'safari' },
];

export interface ExecutionConfig {
  deviceId: string;
  browserId: string;
  headless: boolean;
  environmentId: string;
  parallel: number;
  timeout: number;
  retries: number;
  webhookUrl?: string;
  customViewport?: { width: number; height: number };
}

export const defaultExecutionConfig: ExecutionConfig = {
  deviceId: 'desktop-1080p',
  browserId: 'chromium',
  headless: true,
  environmentId: '',
  parallel: 1,
  timeout: 30000,
  retries: 0,
};

export function getDeviceById(id: string): DeviceConfig | undefined {
  return devices.find(d => d.id === id);
}

export function getBrowserById(id: string): BrowserConfig | undefined {
  return browsers.find(b => b.id === id);
}

export function getDevicesByCategory(category: DeviceConfig['category']): DeviceConfig[] {
  return devices.filter(d => d.category === category);
}
