/**
 * Report Generator Service
 *
 * Generates formatted incident analysis reports for Perimeter Breach and Loitering incidents.
 * Coordinates with DummyDataGenerator to populate missing fields with realistic demonstration data.
 */

import type { IncidentResponse, BreachResponse } from './depotPerimeter';
import {
  hashIncidentId,
  seededRandom,
  generatePerpetratorName,
  generateIdentificationNumber,
  generateBadgeId,
  generateOfficerName,
  generateEntryPoint,
  generateTimestamp,
  generatePhysicalDescription,
  generateBehaviorPattern,
  generateTheftItem,
  generateEscapeRoute,
  generateLoiteringDuration,
  generateCoverageArea,
  generateProximityToAssets,
} from './DummyDataGenerator';

// ---------------------------------------------------------------------------
// Report Data Interfaces
// ---------------------------------------------------------------------------

export interface PerimeterBreachReportData {
  perpetrator: {
    fullName: string;
    identificationNumber: string;
    entryTimestamp: string;
    entryPoint: string;
  };
  acknowledgment: {
    officerName: string;
    badgeId: string;
    acknowledgedAt: string | null;
  };
  incident: {
    severity: string;
    zoneId: string;
    cameraId: string;
    detectedAt: string;
  };
  videoEvidence: {
    filename: string;
    available: boolean;
  };
}

export interface LoiteringReportData {
  perpetrator: {
    description: string;
    identificationNumber: string | null;
    behaviorPattern: string;
  };
  theftDetails: {
    itemDescription: string;
    estimatedValue: string;
    loiteringDuration: string;
    escapeRoute: string;
  };
  temporal: {
    loiteringStartTime: string;
    theftOccurrenceTime: string;
    departureTime: string;
  };
  location: {
    zoneId: string;
    cameraId: string;
    coverageArea: string;
    proximityToAssets: string;
  };
  videoEvidence: {
    filename: string;
    available: boolean;
  };
}

// ---------------------------------------------------------------------------
// Report Type Determination
// ---------------------------------------------------------------------------

/**
 * Determines the appropriate report type based on incident and breach data.
 * 
 * Checks incident title and breach_type for keywords:
 * - "unauthorized", "entry" → perimeter_breach
 * - "loitering", "theft" → loitering
 * - Other keywords → unsupported
 * 
 * @param incident - The incident data
 * @param breach - Optional breach data
 * @returns Report type: 'perimeter_breach', 'loitering', or 'unsupported'
 */
export function determineReportType(
  incident: IncidentResponse,
  breach?: BreachResponse
): 'perimeter_breach' | 'loitering' | 'unsupported' {
  // Combine title, description, and breach_type for keyword matching
  const searchText = [
    incident.title?.toLowerCase() || '',
    incident.description?.toLowerCase() || '',
    breach?.breach_type?.toLowerCase() || '',
  ].join(' ');

  // Check for perimeter breach keywords
  if (searchText.includes('unauthorized') || searchText.includes('entry')) {
    return 'perimeter_breach';
  }

  // Check for loitering keywords
  if (searchText.includes('loitering') || searchText.includes('theft')) {
    return 'loitering';
  }

  // Unsupported incident type
  return 'unsupported';
}

// ---------------------------------------------------------------------------
// Perimeter Breach Report Generation
// ---------------------------------------------------------------------------

/**
 * Generate a perimeter breach analysis report with comprehensive data.
 * 
 * Uses DummyDataGenerator for perpetrator details, acknowledgment data, and entry information.
 * Handles missing breach data gracefully with fallback values.
 * 
 * @param incident - The incident data
 * @param breach - Optional breach data
 * @returns Complete perimeter breach report data
 */
export function generatePerimeterBreachReport(
  incident: IncidentResponse,
  breach?: BreachResponse
): PerimeterBreachReportData {
  // Generate deterministic seed from incident ID
  const seed = hashIncidentId(incident.id);
  
  // Parse base time from incident created_at
  const baseTime = new Date(incident.created_at);
  
  // Generate perpetrator information
  const perpetratorName = generatePerpetratorName(seed);
  const identificationNumber = generateIdentificationNumber(seed);
  
  // Generate entry timestamp (slightly before detection time)
  const entryTimestamp = generateTimestamp(baseTime, -10, seed); // 10 minutes before detection
  
  // Generate entry point using zone_id
  const zoneId = incident.zone_id || breach?.zone_id || 'Unknown';
  const entryPoint = generateEntryPoint(zoneId, seed);
  
  // Generate acknowledgment data
  const officerName = generateOfficerName(seed);
  const badgeId = generateBadgeId(seed);
  const acknowledgedAt = incident.acknowledged_at || null;
  
  // Determine camera ID
  const cameraId = breach?.camera_id || 'CAM-001';
  
  // Format detection timestamp
  const detectedAt = new Date(incident.created_at).toLocaleString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  
  // Determine video filename based on incident type
  const videoFilename = 'Perimeter_Detection.mp4';
  const videoAvailable = incident.video_archive_ref !== null;
  
  return {
    perpetrator: {
      fullName: perpetratorName,
      identificationNumber: identificationNumber,
      entryTimestamp: entryTimestamp,
      entryPoint: entryPoint,
    },
    acknowledgment: {
      officerName: officerName,
      badgeId: badgeId,
      acknowledgedAt: acknowledgedAt,
    },
    incident: {
      severity: incident.severity || 'medium',
      zoneId: zoneId,
      cameraId: cameraId,
      detectedAt: detectedAt,
    },
    videoEvidence: {
      filename: videoFilename,
      available: videoAvailable,
    },
  };
}

// ---------------------------------------------------------------------------
// Loitering Report Generation
// ---------------------------------------------------------------------------

/**
 * Generate a loitering incident analysis report with comprehensive data.
 * 
 * Uses DummyDataGenerator for perpetrator description, behavior patterns, theft details,
 * and location information. Generates temporal sequence with logical ordering.
 * Handles missing breach data gracefully with fallback values.
 * 
 * @param incident - The incident data
 * @param breach - Optional breach data
 * @returns Complete loitering report data
 */
export function generateLoiteringReport(
  incident: IncidentResponse,
  breach?: BreachResponse
): LoiteringReportData {
  // Generate deterministic seed from incident ID
  const seed = hashIncidentId(incident.id);
  
  // Parse base time from incident created_at
  const baseTime = new Date(incident.created_at);
  
  // Generate perpetrator description
  const physicalDescription = generatePhysicalDescription(seed);
  const behaviorPattern = generateBehaviorPattern(seed);
  
  // Generate identification number (may be null for unidentified perpetrators)
  // 50% chance of having identification based on seed
  const hasIdentification = seededRandom(seed, 24) > 0.5;
  const identificationNumber = hasIdentification ? generateIdentificationNumber(seed) : null;
  
  // Generate theft details
  const theftItem = generateTheftItem(seed);
  const loiteringDuration = generateLoiteringDuration(seed);
  const zoneId = incident.zone_id || breach?.zone_id || 'Unknown';
  const escapeRoute = generateEscapeRoute(zoneId, seed);
  
  // Generate temporal sequence (loitering start < theft occurrence < departure)
  // Loitering starts 30-60 minutes before detection
  const loiteringStartOffset = -30 - Math.floor(seededRandom(seed, 25) * 30);
  const loiteringStartTime = generateTimestamp(baseTime, loiteringStartOffset, seed);
  
  // Theft occurs 10-20 minutes before detection
  const theftOccurrenceOffset = -10 - Math.floor(seededRandom(seed, 26) * 10);
  const theftOccurrenceTime = generateTimestamp(baseTime, theftOccurrenceOffset, seed);
  
  // Departure occurs 2-5 minutes before detection
  const departureOffset = -2 - Math.floor(seededRandom(seed, 27) * 3);
  const departureTime = generateTimestamp(baseTime, departureOffset, seed);
  
  // Generate location data
  const cameraId = breach?.camera_id || 'CAM-002';
  const coverageArea = generateCoverageArea(seed);
  const proximityToAssets = generateProximityToAssets(seed);
  
  // Determine video filename based on incident type
  const videoFilename = 'Theft Camera .mp4';
  const videoAvailable = incident.video_archive_ref !== null;
  
  return {
    perpetrator: {
      description: physicalDescription,
      identificationNumber: identificationNumber,
      behaviorPattern: behaviorPattern,
    },
    theftDetails: {
      itemDescription: theftItem.description,
      estimatedValue: theftItem.value,
      loiteringDuration: loiteringDuration,
      escapeRoute: escapeRoute,
    },
    temporal: {
      loiteringStartTime: loiteringStartTime,
      theftOccurrenceTime: theftOccurrenceTime,
      departureTime: departureTime,
    },
    location: {
      zoneId: zoneId,
      cameraId: cameraId,
      coverageArea: coverageArea,
      proximityToAssets: proximityToAssets,
    },
    videoEvidence: {
      filename: videoFilename,
      available: videoAvailable,
    },
  };
}
