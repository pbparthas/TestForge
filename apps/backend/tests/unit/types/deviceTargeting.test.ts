/**
 * Device Targeting Types Unit Tests
 */

import { describe, it, expect } from 'vitest';
import {
  DEVICE_PROFILES,
  getDeviceProfile,
  getDevicesByType,
  getDefaultDeviceTarget,
  validateDeviceTarget,
} from '../../../src/types/deviceTargeting.js';

describe('Device Targeting Types', () => {
  describe('DEVICE_PROFILES', () => {
    it('should have at least 20 device profiles', () => {
      expect(Object.keys(DEVICE_PROFILES).length).toBeGreaterThanOrEqual(20);
    });

    it('should have desktop profiles', () => {
      const desktopProfiles = Object.values(DEVICE_PROFILES).filter(p => p.type === 'desktop');
      expect(desktopProfiles.length).toBeGreaterThanOrEqual(3);
    });

    it('should have mobile profiles', () => {
      const mobileProfiles = Object.values(DEVICE_PROFILES).filter(p => p.type === 'mobile');
      expect(mobileProfiles.length).toBeGreaterThanOrEqual(10);
    });

    it('should have tablet profiles', () => {
      const tabletProfiles = Object.values(DEVICE_PROFILES).filter(p => p.type === 'tablet');
      expect(tabletProfiles.length).toBeGreaterThanOrEqual(4);
    });

    it('should have iPhone 15 Pro Max profile', () => {
      const profile = DEVICE_PROFILES['iPhone 15 Pro Max'];
      expect(profile).toBeDefined();
      expect(profile.type).toBe('mobile');
      expect(profile.viewport.width).toBe(430);
      expect(profile.viewport.height).toBe(932);
      expect(profile.isTouchEnabled).toBe(true);
    });

    it('should have Desktop 1920x1080 profile', () => {
      const profile = DEVICE_PROFILES['Desktop 1920x1080'];
      expect(profile).toBeDefined();
      expect(profile.type).toBe('desktop');
      expect(profile.viewport.width).toBe(1920);
      expect(profile.viewport.height).toBe(1080);
      expect(profile.isTouchEnabled).toBe(false);
    });
  });

  describe('getDeviceProfile', () => {
    it('should return profile for valid device name', () => {
      const profile = getDeviceProfile('iPhone 15 Pro Max');
      expect(profile).toBeDefined();
      expect(profile?.name).toBe('iPhone 15 Pro Max');
    });

    it('should return undefined for invalid device name', () => {
      const profile = getDeviceProfile('NonExistent Device');
      expect(profile).toBeUndefined();
    });
  });

  describe('getDevicesByType', () => {
    it('should return only desktop devices for desktop type', () => {
      const devices = getDevicesByType('desktop');
      expect(devices.length).toBeGreaterThan(0);
      devices.forEach(device => {
        expect(device.type).toBe('desktop');
      });
    });

    it('should return only mobile devices for mobile type', () => {
      const devices = getDevicesByType('mobile');
      expect(devices.length).toBeGreaterThan(0);
      devices.forEach(device => {
        expect(device.type).toBe('mobile');
      });
    });

    it('should return only tablet devices for tablet type', () => {
      const devices = getDevicesByType('tablet');
      expect(devices.length).toBeGreaterThan(0);
      devices.forEach(device => {
        expect(device.type).toBe('tablet');
      });
    });
  });

  describe('getDefaultDeviceTarget', () => {
    it('should return desktop 1920x1080 as default', () => {
      const target = getDefaultDeviceTarget();
      expect(target.type).toBe('desktop');
      expect(target.viewport.width).toBe(1920);
      expect(target.viewport.height).toBe(1080);
    });
  });

  describe('validateDeviceTarget', () => {
    it('should return default target when input is undefined', () => {
      const target = validateDeviceTarget(undefined);
      expect(target.type).toBe('desktop');
      expect(target.viewport.width).toBe(1920);
    });

    it('should return default target when input has no type', () => {
      const target = validateDeviceTarget({});
      expect(target.type).toBe('desktop');
    });

    it('should validate valid desktop target', () => {
      const target = validateDeviceTarget({
        type: 'desktop',
        viewport: { width: 1440, height: 900 },
      });
      expect(target.type).toBe('desktop');
      expect(target.viewport.width).toBe(1440);
    });

    it('should validate valid mobile target with all properties', () => {
      const target = validateDeviceTarget({
        type: 'mobile',
        deviceName: 'iPhone 15',
        viewport: { width: 393, height: 852 },
        userAgent: 'Mozilla/5.0...',
        isTouchEnabled: true,
        pixelRatio: 3,
      });
      expect(target.type).toBe('mobile');
      expect(target.deviceName).toBe('iPhone 15');
      expect(target.isTouchEnabled).toBe(true);
      expect(target.pixelRatio).toBe(3);
    });

    it('should throw error for invalid device type', () => {
      expect(() => validateDeviceTarget({
        type: 'invalid' as any,
        viewport: { width: 1920, height: 1080 },
      })).toThrow('Invalid device type');
    });

    it('should throw error for invalid viewport', () => {
      expect(() => validateDeviceTarget({
        type: 'desktop',
        viewport: { width: -100, height: 1080 },
      })).toThrow('Invalid viewport');
    });

    it('should throw error for missing viewport', () => {
      expect(() => validateDeviceTarget({
        type: 'desktop',
      } as any)).toThrow('Invalid viewport');
    });

    it('should round viewport dimensions', () => {
      const target = validateDeviceTarget({
        type: 'desktop',
        viewport: { width: 1920.5, height: 1080.7 },
      });
      expect(target.viewport.width).toBe(1921);
      expect(target.viewport.height).toBe(1081);
    });
  });
});
