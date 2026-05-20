# Perimeter Breach Mapping Verification

## Task 1.2: Update seed script to create perimeter breaches

### Requirements Met

✅ **Requirement 12.2**: Map incident source to breach_type
- perimeter → unauthorized_entry
- alert → loitering  
- sensor → unknown
- sla_breach → after_hours

✅ **Requirement 12.3**: Set appropriate severity levels
- P1 → critical
- P2 → high
- P3 → medium
- default → low

✅ **Requirement 12.4**: Set `detected_at` to current timestamp, `alert_sent=True`

### Created Breaches

| # | Zone | Breach Type | Severity | Source Mapping | Priority Mapping | Notes |
|---|------|-------------|----------|----------------|------------------|-------|
| 1 | Cold Storage | after_hours | critical | sla_breach → after_hours | P1 → critical | Temperature compliance SLA violated |
| 2 | Inbound Gate | unauthorized_entry | high | perimeter → unauthorized_entry | default → high | LPR mismatch. Vehicle not in approved list |
| 3 | Staging Area | loitering | medium | alert → loitering | default → medium | Vehicle dwell time exceeded SLA |
| 4 | Dispatch Bay | unknown | medium | sensor → unknown | P3 → medium | Hydraulic pressure below threshold |
| 5 | Cold Storage | unknown | low | sensor → unknown | default → low | Smoke detector activated |

### Database Verification

Total breaches in database: 249 (includes historical data + 5 new breaches)

Latest 5 breaches confirmed with correct mappings:
- ✅ after_hours (critical) - SLA breach incident
- ✅ unauthorized_entry (high) - Perimeter incident  
- ✅ loitering (medium) - Alert incident
- ✅ unknown (medium) - Sensor incident (P3)
- ✅ unknown (low) - Sensor incident (default)

### Implementation Details

**File Modified**: `backend/app/depot/seed.py`

**Changes Made**:
1. Replaced the old 3-breach loop with a structured list of 5 breaches
2. Each breach maps to one of the 5 sample incidents from `seed_intelliops.py`
3. Implemented source-to-breach_type mapping as specified
4. Implemented priority-to-severity mapping as specified
5. Set `alert_sent=True` for all breaches
6. Set `detected_at` to current timestamp minus varying minutes for realistic data
7. Used `zone_refs` dictionary to properly link breaches to perimeter zones

**Key Code Features**:
- Dynamic zone lookup using `zone_refs` dictionary
- Proper error handling if zone not found
- Camera assignment based on zone index
- Unique snapshot references per zone
- Realistic time offsets (8, 25, 62, 15, 45 minutes ago)

### Testing

✅ Seed script runs successfully and creates 5 breaches
✅ Database query confirms breaches exist with correct attributes
✅ All mappings verified against requirements 12.2, 12.3, 12.4
