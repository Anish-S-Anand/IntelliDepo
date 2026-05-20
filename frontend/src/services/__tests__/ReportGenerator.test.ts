/**
 * Unit tests for ReportGenerator service
 */

import { generatePerimeterBreachReport, generateLoiteringReport, determineReportType } from '../ReportGenerator';
import type { IncidentResponse, BreachResponse } from '../depotPerimeter';

describe('ReportGenerator', () => {
  describe('generatePerimeterBreachReport', () => {
    it('should generate a complete perimeter breach report with all required fields', () => {
      // Arrange
      const incident: IncidentResponse = {
        id: 'test-incident-123',
        breach_id: 'breach-456',
        zone_id: 'A',
        severity: 'high',
        title: 'Unauthorized Entry Detected',
        description: 'Perimeter breach at north gate',
        escalation_level: 1,
        escalation_deadline: null,
        escalated_to: null,
        status: 'open',
        acknowledged_at: null,
        acknowledged_by: null,
        resolved_at: null,
        resolved_by: null,
        resolution_notes: null,
        video_archive_ref: 'video-123.mp4',
        created_at: '2024-01-15T22:45:00Z',
      };

      const breach: BreachResponse = {
        id: 'breach-456',
        zone_id: 'A',
        camera_id: 'CAM-005',
        breach_type: 'unauthorized_entry',
        severity: 'high',
        confidence: 0.95,
        snapshot_ref: 'snapshot-123.jpg',
        alert_sent: true,
        notes: null,
        detected_at: '2024-01-15T22:45:00Z',
        resolved_at: null,
        resolved_by: null,
        resolution_notes: null,
        created_at: '2024-01-15T22:45:00Z',
      };

      // Act
      const report = generatePerimeterBreachReport(incident, breach);

      // Assert - Perpetrator section
      expect(report.perpetrator).toBeDefined();
      expect(report.perpetrator.fullName).toBeTruthy();
      expect(report.perpetrator.identificationNumber).toMatch(/^[A-Z]{2}\d{6}$/);
      expect(report.perpetrator.entryTimestamp).toBeTruthy();
      expect(report.perpetrator.entryPoint).toContain('Zone A');

      // Assert - Acknowledgment section
      expect(report.acknowledgment).toBeDefined();
      expect(report.acknowledgment.officerName).toBeTruthy();
      expect(report.acknowledgment.badgeId).toMatch(/^SO-\d{4}$/);
      expect(report.acknowledgment.acknowledgedAt).toBeNull();

      // Assert - Incident section
      expect(report.incident).toBeDefined();
      expect(report.incident.severity).toBe('high');
      expect(report.incident.zoneId).toBe('A');
      expect(report.incident.cameraId).toBe('CAM-005');
      expect(report.incident.detectedAt).toBeTruthy();

      // Assert - Video evidence section
      expect(report.videoEvidence).toBeDefined();
      expect(report.videoEvidence.filename).toBe('Perimeter_Detection.mp4');
      expect(report.videoEvidence.available).toBe(true);
    });

    it('should handle missing breach data gracefully', () => {
      // Arrange
      const incident: IncidentResponse = {
        id: 'test-incident-456',
        breach_id: '',
        zone_id: 'B',
        severity: 'medium',
        title: 'Unauthorized Entry',
        description: null,
        escalation_level: 0,
        escalation_deadline: null,
        escalated_to: null,
        status: 'open',
        acknowledged_at: null,
        acknowledged_by: null,
        resolved_at: null,
        resolved_by: null,
        resolution_notes: null,
        video_archive_ref: null,
        created_at: '2024-01-15T23:00:00Z',
      };

      // Act
      const report = generatePerimeterBreachReport(incident);

      // Assert
      expect(report.perpetrator.fullName).toBeTruthy();
      expect(report.perpetrator.identificationNumber).toMatch(/^[A-Z]{2}\d{6}$/);
      expect(report.incident.zoneId).toBe('B');
      expect(report.incident.cameraId).toBe('CAM-001'); // Fallback value
      expect(report.videoEvidence.available).toBe(false);
    });

    it('should generate consistent data for the same incident ID', () => {
      // Arrange
      const incident: IncidentResponse = {
        id: 'consistent-test-789',
        breach_id: 'breach-789',
        zone_id: 'C',
        severity: 'critical',
        title: 'Unauthorized Entry',
        description: 'Test incident',
        escalation_level: 2,
        escalation_deadline: null,
        escalated_to: null,
        status: 'open',
        acknowledged_at: null,
        acknowledged_by: null,
        resolved_at: null,
        resolved_by: null,
        resolution_notes: null,
        video_archive_ref: 'video-789.mp4',
        created_at: '2024-01-15T23:30:00Z',
      };

      // Act
      const report1 = generatePerimeterBreachReport(incident);
      const report2 = generatePerimeterBreachReport(incident);

      // Assert - Data should be identical
      expect(report1.perpetrator.fullName).toBe(report2.perpetrator.fullName);
      expect(report1.perpetrator.identificationNumber).toBe(report2.perpetrator.identificationNumber);
      expect(report1.acknowledgment.officerName).toBe(report2.acknowledgment.officerName);
      expect(report1.acknowledgment.badgeId).toBe(report2.acknowledgment.badgeId);
    });

    it('should include acknowledged_at timestamp when incident is acknowledged', () => {
      // Arrange
      const incident: IncidentResponse = {
        id: 'acknowledged-incident-999',
        breach_id: 'breach-999',
        zone_id: 'D',
        severity: 'high',
        title: 'Unauthorized Entry',
        description: 'Acknowledged incident',
        escalation_level: 1,
        escalation_deadline: null,
        escalated_to: null,
        status: 'acknowledged',
        acknowledged_at: '2024-01-15T23:50:00Z',
        acknowledged_by: 'officer-123',
        resolved_at: null,
        resolved_by: null,
        resolution_notes: null,
        video_archive_ref: 'video-999.mp4',
        created_at: '2024-01-15T23:45:00Z',
      };

      // Act
      const report = generatePerimeterBreachReport(incident);

      // Assert
      expect(report.acknowledgment.acknowledgedAt).toBe('2024-01-15T23:50:00Z');
    });

    it('should use fallback zone_id when both incident and breach zone_id are missing', () => {
      // Arrange
      const incident: IncidentResponse = {
        id: 'no-zone-incident',
        breach_id: '',
        zone_id: '',
        severity: 'low',
        title: 'Unauthorized Entry',
        description: null,
        escalation_level: 0,
        escalation_deadline: null,
        escalated_to: null,
        status: 'open',
        acknowledged_at: null,
        acknowledged_by: null,
        resolved_at: null,
        resolved_by: null,
        resolution_notes: null,
        video_archive_ref: null,
        created_at: '2024-01-16T00:00:00Z',
      };

      // Act
      const report = generatePerimeterBreachReport(incident);

      // Assert
      expect(report.incident.zoneId).toBe('Unknown');
      expect(report.perpetrator.entryPoint).toContain('Zone Unknown');
    });
  });

  describe('determineReportType', () => {
    it('should identify perimeter breach from "unauthorized" keyword', () => {
      const incident: IncidentResponse = {
        id: 'test-1',
        breach_id: '',
        zone_id: 'A',
        severity: 'high',
        title: 'Unauthorized Entry Detected',
        description: null,
        escalation_level: 0,
        escalation_deadline: null,
        escalated_to: null,
        status: 'open',
        acknowledged_at: null,
        acknowledged_by: null,
        resolved_at: null,
        resolved_by: null,
        resolution_notes: null,
        video_archive_ref: null,
        created_at: '2024-01-15T22:00:00Z',
      };

      expect(determineReportType(incident)).toBe('perimeter_breach');
    });

    it('should identify perimeter breach from "entry" keyword', () => {
      const incident: IncidentResponse = {
        id: 'test-2',
        breach_id: '',
        zone_id: 'A',
        severity: 'high',
        title: 'Perimeter Entry Alert',
        description: null,
        escalation_level: 0,
        escalation_deadline: null,
        escalated_to: null,
        status: 'open',
        acknowledged_at: null,
        acknowledged_by: null,
        resolved_at: null,
        resolved_by: null,
        resolution_notes: null,
        video_archive_ref: null,
        created_at: '2024-01-15T22:00:00Z',
      };

      expect(determineReportType(incident)).toBe('perimeter_breach');
    });
  });
});
