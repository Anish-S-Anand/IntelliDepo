/**
 * Unit tests for DummyDataGenerator service
 * Tests deterministic data generation and format validation
 */

import { describe, it, expect } from 'vitest';
import {
  hashIncidentId,
  seededRandom,
  generatePerpetratorName,
  generateIdentificationNumber,
  generateBadgeId,
  generateTheftItem,
  generateEscapeRoute,
  generateBehaviorPattern,
  generatePhysicalDescription,
  generateTimestamp,
  generateOfficerName,
  generateEntryPoint,
  generateLoiteringDuration,
  generateCoverageArea,
  generateProximityToAssets,
} from '../DummyDataGenerator';

describe('DummyDataGenerator - Core Functions', () => {
  describe('hashIncidentId', () => {
    it('should generate a positive integer seed from incident ID', () => {
      const seed = hashIncidentId('incident-123');
      expect(seed).toBeGreaterThan(0);
      expect(Number.isInteger(seed)).toBe(true);
    });

    it('should generate consistent seed for same incident ID', () => {
      const seed1 = hashIncidentId('incident-123');
      const seed2 = hashIncidentId('incident-123');
      expect(seed1).toBe(seed2);
    });

    it('should generate different seeds for different incident IDs', () => {
      const seed1 = hashIncidentId('incident-123');
      const seed2 = hashIncidentId('incident-456');
      expect(seed1).not.toBe(seed2);
    });
  });

  describe('seededRandom', () => {
    it('should generate a number between 0 and 1', () => {
      const random = seededRandom(12345, 0);
      expect(random).toBeGreaterThanOrEqual(0);
      expect(random).toBeLessThan(1);
    });

    it('should generate consistent values for same seed and index', () => {
      const random1 = seededRandom(12345, 0);
      const random2 = seededRandom(12345, 0);
      expect(random1).toBe(random2);
    });

    it('should generate different values for different indices', () => {
      const random1 = seededRandom(12345, 0);
      const random2 = seededRandom(12345, 1);
      expect(random1).not.toBe(random2);
    });
  });
});

describe('DummyDataGenerator - Perpetrator Data', () => {
  const testSeed = hashIncidentId('test-incident-001');

  describe('generatePerpetratorName', () => {
    it('should generate a full name', () => {
      const name = generatePerpetratorName(testSeed);
      expect(name).toBeTruthy();
      expect(name).toContain(' '); // Should have space between first and last name
      expect(name.split(' ').length).toBe(2);
    });

    it('should generate consistent name for same seed', () => {
      const name1 = generatePerpetratorName(testSeed);
      const name2 = generatePerpetratorName(testSeed);
      expect(name1).toBe(name2);
    });
  });

  describe('generateIdentificationNumber', () => {
    it('should generate ID in format XX######', () => {
      const id = generateIdentificationNumber(testSeed);
      expect(id).toMatch(/^[A-Z]{2}\d{6}$/);
    });

    it('should generate consistent ID for same seed', () => {
      const id1 = generateIdentificationNumber(testSeed);
      const id2 = generateIdentificationNumber(testSeed);
      expect(id1).toBe(id2);
    });
  });

  describe('generateBadgeId', () => {
    it('should generate badge ID in format SO-####', () => {
      const badge = generateBadgeId(testSeed);
      expect(badge).toMatch(/^SO-\d{4}$/);
    });

    it('should generate consistent badge ID for same seed', () => {
      const badge1 = generateBadgeId(testSeed);
      const badge2 = generateBadgeId(testSeed);
      expect(badge1).toBe(badge2);
    });
  });

  describe('generatePhysicalDescription', () => {
    it('should generate a physical description', () => {
      const description = generatePhysicalDescription(testSeed);
      expect(description).toBeTruthy();
      expect(description).toContain('Approximately');
      expect(description).toContain('build');
      expect(description).toContain('wearing');
    });

    it('should generate consistent description for same seed', () => {
      const desc1 = generatePhysicalDescription(testSeed);
      const desc2 = generatePhysicalDescription(testSeed);
      expect(desc1).toBe(desc2);
    });
  });
});

describe('DummyDataGenerator - Theft and Location Data', () => {
  const testSeed = hashIncidentId('test-incident-002');

  describe('generateTheftItem', () => {
    it('should generate theft item with description and value', () => {
      const item = generateTheftItem(testSeed);
      expect(item).toHaveProperty('description');
      expect(item).toHaveProperty('value');
      expect(item.description).toBeTruthy();
      expect(item.value).toMatch(/^\$[\d,]+$/); // Should be formatted as currency
    });

    it('should generate consistent item for same seed', () => {
      const item1 = generateTheftItem(testSeed);
      const item2 = generateTheftItem(testSeed);
      expect(item1).toEqual(item2);
    });
  });

  describe('generateEscapeRoute', () => {
    it('should generate escape route with zone reference', () => {
      const route = generateEscapeRoute('A', testSeed);
      expect(route).toBeTruthy();
      expect(route).toContain('via');
      expect(route).toContain('Zone');
    });

    it('should generate consistent route for same seed', () => {
      const route1 = generateEscapeRoute('A', testSeed);
      const route2 = generateEscapeRoute('A', testSeed);
      expect(route1).toBe(route2);
    });
  });

  describe('generateBehaviorPattern', () => {
    it('should generate a behavior pattern description', () => {
      const pattern = generateBehaviorPattern(testSeed);
      expect(pattern).toBeTruthy();
      expect(pattern.length).toBeGreaterThan(20); // Should be a meaningful description
    });

    it('should generate consistent pattern for same seed', () => {
      const pattern1 = generateBehaviorPattern(testSeed);
      const pattern2 = generateBehaviorPattern(testSeed);
      expect(pattern1).toBe(pattern2);
    });
  });
});

describe('DummyDataGenerator - Timestamp Generation', () => {
  const testSeed = hashIncidentId('test-incident-003');
  const baseTime = new Date('2024-01-15T10:00:00Z');

  describe('generateTimestamp', () => {
    it('should generate a formatted timestamp', () => {
      const timestamp = generateTimestamp(baseTime, 0, testSeed);
      expect(timestamp).toBeTruthy();
      // Should match format like "Jan 15, 2024, 10:00 AM"
      expect(timestamp).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} (AM|PM)$/);
    });

    it('should generate consistent timestamp for same seed', () => {
      const ts1 = generateTimestamp(baseTime, 0, testSeed);
      const ts2 = generateTimestamp(baseTime, 0, testSeed);
      expect(ts1).toBe(ts2);
    });

    it('should apply offset correctly', () => {
      const ts1 = generateTimestamp(baseTime, 0, testSeed);
      const ts2 = generateTimestamp(baseTime, 60, testSeed + 1); // 60 minutes later
      expect(ts1).not.toBe(ts2);
    });

    it('should add ±5 minutes variance using seeded random', () => {
      // Test with multiple seeds to verify variance is applied
      const timestamps = Array.from({ length: 10 }, (_, i) => {
        const ts = generateTimestamp(baseTime, 0, testSeed + i);
        const parsed = new Date(ts);
        return parsed.getTime();
      });

      // At least some timestamps should be different due to variance
      const uniqueTimestamps = new Set(timestamps);
      expect(uniqueTimestamps.size).toBeGreaterThan(1);
    });

    it('should ensure timestamps are within 24 hours of base time', () => {
      // Test with various offsets
      const offsets = [-1440, -720, -360, 0, 360, 720, 1440]; // -24h to +24h in minutes
      
      offsets.forEach(offset => {
        const timestamp = generateTimestamp(baseTime, offset, testSeed);
        const parsed = new Date(timestamp);
        const diffMs = Math.abs(parsed.getTime() - baseTime.getTime());
        const diffHours = diffMs / (1000 * 60 * 60);
        
        // With ±5 minutes variance, should still be within ~24 hours
        expect(diffHours).toBeLessThanOrEqual(24.5); // Allow small buffer for variance
      });
    });

    it('should format output as "MMM DD, YYYY, HH:MM AM/PM"', () => {
      const timestamp = generateTimestamp(baseTime, 0, testSeed);
      
      // Verify format components
      const parts = timestamp.split(', ');
      expect(parts.length).toBe(3); // "MMM DD", "YYYY", "HH:MM AM/PM"
      
      // Check month and day
      expect(parts[0]).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
      
      // Check year
      expect(parts[1]).toMatch(/^\d{4}$/);
      
      // Check time with AM/PM
      expect(parts[2]).toMatch(/^\d{1,2}:\d{2} (AM|PM)$/);
    });

    it('should handle negative offsets correctly', () => {
      const timestamp = generateTimestamp(baseTime, -60, testSeed); // 1 hour before
      const parsed = new Date(timestamp);
      
      // Should be earlier than base time (accounting for variance)
      const diffMs = baseTime.getTime() - parsed.getTime();
      const diffMinutes = diffMs / (1000 * 60);
      
      // Should be approximately 60 minutes earlier (±5 minutes variance)
      expect(diffMinutes).toBeGreaterThan(50); // At least 50 minutes earlier
      expect(diffMinutes).toBeLessThan(70); // At most 70 minutes earlier
    });

    it('should handle positive offsets correctly', () => {
      const timestamp = generateTimestamp(baseTime, 120, testSeed); // 2 hours later
      const parsed = new Date(timestamp);
      
      // Should be later than base time (accounting for variance)
      const diffMs = parsed.getTime() - baseTime.getTime();
      const diffMinutes = diffMs / (1000 * 60);
      
      // Should be approximately 120 minutes later (±5 minutes variance)
      expect(diffMinutes).toBeGreaterThan(110); // At least 110 minutes later
      expect(diffMinutes).toBeLessThan(130); // At most 130 minutes later
    });

    it('should handle edge case of midnight crossing', () => {
      const midnightBase = new Date('2024-01-15T23:55:00Z');
      const timestamp = generateTimestamp(midnightBase, 10, testSeed); // 10 minutes later crosses midnight
      
      expect(timestamp).toBeTruthy();
      expect(timestamp).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} (AM|PM)$/);
    });

    it('should handle different dates correctly', () => {
      const dates = [
        new Date('2024-01-01T12:00:00Z'), // New Year
        new Date('2024-06-15T12:00:00Z'), // Mid-year
        new Date('2024-12-31T12:00:00Z'), // End of year
      ];

      dates.forEach(date => {
        const timestamp = generateTimestamp(date, 0, testSeed);
        expect(timestamp).toBeTruthy();
        expect(timestamp).toMatch(/^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2} (AM|PM)$/);
      });
    });
  });
});

describe('DummyDataGenerator - Additional Functions', () => {
  const testSeed = hashIncidentId('test-incident-004');

  describe('generateOfficerName', () => {
    it('should generate a full officer name', () => {
      const name = generateOfficerName(testSeed);
      expect(name).toBeTruthy();
      expect(name).toContain(' ');
      expect(name.split(' ').length).toBe(2);
    });

    it('should generate consistent name for same seed', () => {
      const name1 = generateOfficerName(testSeed);
      const name2 = generateOfficerName(testSeed);
      expect(name1).toBe(name2);
    });
  });

  describe('generateEntryPoint', () => {
    it('should generate entry point with zone reference', () => {
      const entry = generateEntryPoint('A', testSeed);
      expect(entry).toBeTruthy();
      expect(entry).toContain('Zone A');
    });

    it('should generate consistent entry point for same seed', () => {
      const entry1 = generateEntryPoint('A', testSeed);
      const entry2 = generateEntryPoint('A', testSeed);
      expect(entry1).toBe(entry2);
    });
  });

  describe('generateLoiteringDuration', () => {
    it('should generate a duration string', () => {
      const duration = generateLoiteringDuration(testSeed);
      expect(duration).toBeTruthy();
      expect(duration).toMatch(/\d+\s*(minutes?|hours?|h|m)/);
    });

    it('should generate consistent duration for same seed', () => {
      const dur1 = generateLoiteringDuration(testSeed);
      const dur2 = generateLoiteringDuration(testSeed);
      expect(dur1).toBe(dur2);
    });
  });

  describe('generateCoverageArea', () => {
    it('should generate a coverage area description', () => {
      const area = generateCoverageArea(testSeed);
      expect(area).toBeTruthy();
      expect(area.length).toBeGreaterThan(10);
    });

    it('should generate consistent area for same seed', () => {
      const area1 = generateCoverageArea(testSeed);
      const area2 = generateCoverageArea(testSeed);
      expect(area1).toBe(area2);
    });
  });

  describe('generateProximityToAssets', () => {
    it('should generate proximity description with distance', () => {
      const proximity = generateProximityToAssets(testSeed);
      expect(proximity).toBeTruthy();
      expect(proximity).toContain('m from'); // Should contain meters
      expect(proximity).toMatch(/\d+m from/);
    });

    it('should generate consistent proximity for same seed', () => {
      const prox1 = generateProximityToAssets(testSeed);
      const prox2 = generateProximityToAssets(testSeed);
      expect(prox1).toBe(prox2);
    });
  });
});

describe('DummyDataGenerator - Edge Cases', () => {
  it('should handle empty string incident ID', () => {
    const seed = hashIncidentId('');
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(seed)).toBe(true);
  });

  it('should handle very long incident ID', () => {
    const longId = 'incident-' + 'x'.repeat(1000);
    const seed = hashIncidentId(longId);
    expect(seed).toBeGreaterThan(0);
    expect(Number.isInteger(seed)).toBe(true);
  });

  it('should handle special characters in incident ID', () => {
    const seed = hashIncidentId('incident-!@#$%^&*()');
    expect(seed).toBeGreaterThan(0);
    expect(Number.isInteger(seed)).toBe(true);
  });
});

describe('DummyDataGenerator - Deterministic Behavior', () => {
  it('should generate identical data for same incident ID across multiple calls', () => {
    const incidentId = 'test-deterministic-001';
    const seed = hashIncidentId(incidentId);

    // Generate data multiple times
    const results = Array.from({ length: 5 }, () => ({
      name: generatePerpetratorName(seed),
      id: generateIdentificationNumber(seed),
      badge: generateBadgeId(seed),
      item: generateTheftItem(seed),
      pattern: generateBehaviorPattern(seed),
    }));

    // All results should be identical
    results.forEach((result, index) => {
      if (index > 0) {
        expect(result).toEqual(results[0]);
      }
    });
  });

  it('should generate different data for different incident IDs', () => {
    const seed1 = hashIncidentId('incident-001');
    const seed2 = hashIncidentId('incident-002');

    const data1 = {
      name: generatePerpetratorName(seed1),
      id: generateIdentificationNumber(seed1),
      badge: generateBadgeId(seed1),
    };

    const data2 = {
      name: generatePerpetratorName(seed2),
      id: generateIdentificationNumber(seed2),
      badge: generateBadgeId(seed2),
    };

    // At least one field should be different
    const isDifferent = 
      data1.name !== data2.name ||
      data1.id !== data2.id ||
      data1.badge !== data2.badge;

    expect(isDifferent).toBe(true);
  });
});
