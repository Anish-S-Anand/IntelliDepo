# IntelliDepot Client Demo Guide

## Overview
This guide will help you effectively demonstrate the three core features of IntelliDepot to clients: **Incidents**, **Inventory**, and **Heatmap**. Each section includes business value, key capabilities, and a step-by-step demo script.

---

## 🚨 1. Incident Management (IntelliOps™)

### Business Value
**Problem Solved:** Manual incident tracking, delayed escalations, and lack of audit trails lead to slow response times and compliance issues.

**IntelliDepot Solution:** 
- Automated incident creation from sensors, cameras, and SLA breaches
- AI-powered severity classification (P1-P4 priority levels)
- Auto-escalation with configurable rules
- Multi-channel notifications (In-App, Email, SMS, WhatsApp)
- Complete audit trail for compliance

### Key Capabilities

#### 1. **Automated Incident Creation**
- **Source Integration:** Incidents are automatically created from:
  - SLA breaches (when shipments exceed thresholds)
  - Perimeter breaches (unauthorized access detected)
  - Sensor alerts (temperature, humidity, equipment failures)
  - Vision system alerts (camera offline, detection anomalies)
  - Manual operator submissions

#### 2. **AI-Powered Severity Classification**
- **Intelligent Prioritization:** Natural Language Processing analyzes incident titles and descriptions
- **Priority Levels:**
  - **P1 (Critical):** 5-minute response time - Fire, security breaches, injuries
  - **P2 (High):** 15-minute response time - Equipment failures, SLA breaches
  - **P3 (Medium):** 1-hour response time - Delays, warnings, maintenance
  - **P4 (Low):** 4-hour response time - Routine notifications, info logs

#### 3. **Auto-Escalation Engine**
- **Rule-Based Escalation:** Configurable rules automatically escalate unacknowledged incidents
- **Escalation Chain:** 
  1. Shift Supervisor (Tier 1)
  2. Operations Manager (Tier 2)
  3. Site Director (Tier 3)
- **Deadline Tracking:** Each incident has an escalation deadline based on priority

#### 4. **Multi-Channel Notifications**
- **Delivery Channels:** In-App popups, Email, SMS, WhatsApp, Push notifications
- **Real-Time Delivery:** WebSocket-based instant notifications to connected operators
- **Status Tracking:** Sent, delivered, read status for each notification

#### 5. **Resolution Workflow**
- **Lifecycle States:** Open → Acknowledged → In Progress → Resolved → Closed
- **Resolution Checklist:** Document steps taken to resolve incidents
- **Audit Trail:** Immutable log of every state change and action

### Demo Script

#### **Setup (Before Client Arrives)**
```bash
# Ensure both servers are running
# Backend: http://localhost:8000
# Frontend: http://localhost:3000
```

#### **Demo Flow (10-15 minutes)**

**1. Dashboard Overview (2 minutes)**
```
Navigate to: http://localhost:3000/depot/incidents

Key Points to Highlight:
- "Here's our Incident Management dashboard - all active incidents in one view"
- "You can see incidents color-coded by priority: Red (P1), Orange (P2), Yellow (P3), Green (P4)"
- "Notice the real-time status: Open, Acknowledged, Escalated, Resolved"
```

**2. Create Manual Incident (3 minutes)**
```
Click: "Create Incident" button

Demo Scenario: "Equipment Malfunction - Conveyor Belt"
- Title: "Conveyor belt motor overheating in Zone A"
- Description: "Temperature sensor shows 85°C, belt speed reduced to 50%"
- Type: Equipment
- Source: Sensor
- Zone: Zone A

Key Points:
- "The system automatically classified this as P2 (High priority) based on keywords"
- "Severity score calculated: 0.75 (High confidence)"
- "Assigned to: Shift Supervisor automatically"
- "Escalation deadline: 15 minutes from now"
```

**3. Acknowledge Incident (2 minutes)**
```
Click on the newly created incident
Click: "Acknowledge" button
Enter reason: "Maintenance team dispatched to Zone A"

Key Points:
- "Real-time notification sent to Shift Supervisor via WebSocket popup"
- "Status changed from Open → Acknowledged"
- "Audit trail automatically logged who acknowledged and when"
- "Escalation timer paused upon acknowledgment"
```

**4. Show Auto-Escalation Rules (2 minutes)**
```
Navigate to: Incident Rules section

Key Points:
- "These are configurable auto-escalation rules"
- "Example: P1 incidents escalate after 5 minutes if not acknowledged"
- "P2 incidents escalate after 15 minutes"
- "Escalation automatically moves to next tier in the chain"
```

**5. Resolve Incident (3 minutes)**
```
Click: "Resolve" button
Resolution Notes: "Motor cooling fan replaced, temperature normalized to 45°C"
Resolution Steps:
- ✅ Maintenance team inspected motor
- ✅ Replaced faulty cooling fan
- ✅ Tested belt operation at full speed
- ✅ Temperature monitoring resumed

Key Points:
- "Complete resolution checklist documented for audit purposes"
- "Status changed to Resolved with timestamp"
- "Automatic notification sent to all stakeholders"
```

**6. Audit Trail (2 minutes)**
```
Click: "View Audit Trail" on the resolved incident

Key Points:
- "Every action is immutably logged for compliance"
- "Who created, who acknowledged, who resolved, when each action occurred"
- "This audit trail is critical for ISO certifications and compliance audits"
```

### ROI Talking Points
- **Reduced Response Time:** 60% faster incident resolution with auto-escalation
- **Compliance Ready:** Complete audit trails for ISO 9001, ISO 27001, SOC 2
- **Zero Missed Incidents:** Automated creation from all sources
- **Accountability:** Clear assignment and escalation chain

---

## 📦 2. Inventory Management

### Business Value
**Problem Solved:** Manual stock tracking, stockouts, overstocking, and lack of real-time visibility lead to operational inefficiencies and lost revenue.

**IntelliDepot Solution:**
- Real-time inventory tracking across all depot zones
- Automated low-stock and out-of-stock alerts
- SKU management with barcode lookup
- Stock movement history and audit trails
- Zone-level inventory visibility

### Key Capabilities

#### 1. **SKU Management**
- **Master Data:** Centralized SKU repository with barcode support
- **Categorization:** Organize by Safety, Tools, Raw Materials, Finished Goods
- **Attributes:** Name, SKU code, barcode, category, unit of measure

#### 2. **Inventory Tracking**
- **Zone-Level Tracking:** Track stock levels per warehouse zone
- **Real-Time Updates:** Instant visibility into current quantities
- **Stock Status:** Normal, Low Stock, Out of Stock indicators
- **Reorder Levels:** Configurable thresholds per item

#### 3. **Stock Movements**
- **Movement Types:** IN (receiving), OUT (dispatch), TRANSFER (inter-zone), ADJUSTMENT (cycle count)
- **Audit Trail:** Complete history of all stock movements
- **Negative Prevention:** System prevents stock from going below zero

#### 4. **Low Stock Alerts**
- **Automated Monitoring:** System continuously checks against reorder levels
- **Visual Indicators:** Red/Yellow/Green status on dashboard
- **Reporting:** Generate low-stock reports on demand

### Demo Script

#### **Demo Flow (10-12 minutes)**

**1. Inventory Dashboard (2 minutes)**
```
Navigate to: http://localhost:3000/depot/inventory

Key Points:
- "This is your real-time inventory command center"
- "See all SKUs with current stock levels across all zones"
- "Color-coded status: Green (healthy), Yellow (low stock), Red (out of stock)"
- "Search and filter by category, zone, or status"
```

**2. Create New SKU (2 minutes)**
```
Click: "Add SKU" button

Demo Scenario: "Industrial Safety Gloves"
- SKU Code: IND-GLOVES-001
- Name: Heavy Duty Industrial Gloves
- Category: Safety Equipment
- Unit: Pairs
- Barcode: 1234567890123

Key Points:
- "SKU is now in the master catalog"
- "Can be tracked across multiple zones"
- "Barcode enables mobile scanning for quick lookups"
```

**3. Add Inventory Item (3 minutes)**
```
Click: "Add Stock" for the new SKU

Demo Data:
- SKU: IND-GLOVES-001
- Zone: Zone A (Storage Bay A1)
- Quantity: 250 pairs
- Reorder Level: 50 pairs
- Unit Cost: $12.50

Key Points:
- "Now tracking 250 pairs in Zone A"
- "Reorder alert triggers automatically when stock falls below 50"
- "Utilization calculation: if max capacity is 500, we're at 50% utilization"
```

**4. Stock Movement - Dispatch (2 minutes)**
```
Click: "Adjust Stock" on IND-GLOVES-001

Movement Type: OUT (Dispatch)
Quantity Delta: -75 pairs
Reason: "Shipped to customer ABC Manufacturing"

Key Points:
- "Real-time update: 250 → 175 pairs remaining"
- "Movement logged with timestamp and reason"
- "System prevents negative stock (can't dispatch more than available)"
```

**5. Low Stock Alert (2 minutes)**
```
Adjust stock again to trigger low stock alert
Dispatch another: -130 pairs

Result: Now at 45 pairs (below reorder level of 50)

Key Points:
- "Automatic low stock alert triggered"
- "Status changed from Green to Yellow"
- "Appears in Low Stock Report for procurement team"
- "Can configure email notifications to purchasing team"
```

**6. Zone View (2 minutes)**
```
Click on "Zone A" to see all inventory in that zone

Key Points:
- "Zone-level inventory visibility for warehouse operations"
- "See all SKUs stored in this zone"
- "Total utilization percentage for capacity planning"
- "Click zone on map to jump to zone-specific inventory"
```

### ROI Talking Points
- **Prevent Stockouts:** 95% reduction in stockout incidents with automated alerts
- **Optimize Cash Flow:** Reduce excess inventory by 25% with real-time visibility
- **Faster Fulfillment:** 40% faster order processing with barcode scanning
- **Audit Ready:** Complete movement history for inventory audits

---

## 🗺️ 3. Heatmap (Spatial Analytics)

### Business Value
**Problem Solved:** Lack of visibility into space utilization, overcrowding, and inefficient warehouse layouts lead to operational bottlenecks and safety risks.

**IntelliDepot Solution:**
- Real-time space utilization heatmap across all depot zones
- Capacity monitoring with threshold alerts (Warning at 80%, Critical at 95%)
- Density analytics (objects per square meter)
- Historical trends for capacity planning
- IoT sensor integration for automated occupancy tracking

### Key Capabilities

#### 1. **Spatial Heatmap**
- **Visual Representation:** Color-coded zones showing utilization levels
- **Real-Time Updates:** Instant refresh as occupancy changes
- **Status Indicators:**
  - Green (0-79%): Normal
  - Orange (80-94%): Warning
  - Red (95-100%): Critical
  - Gray: Offline

#### 2. **Zone Management**
- **Zone Definition:** Create zones with code, name, type (storage, staging, loading, cold storage)
- **Capacity Limits:** Set max capacity per zone (bags, pallets, vehicles)
- **Polygon Mapping:** Define zone boundaries on warehouse floor plan
- **Camera Assignment:** Link cameras to zones for vision-based occupancy

#### 3. **Capacity Monitoring**
- **Live Occupancy:** Current occupancy vs. max capacity
- **Utilization %:** Real-time percentage calculation
- **Threshold Alerts:** Automatic alerts at 80% (warning) and 95% (critical)
- **Alert Channels:** RabbitMQ, WebSocket, Email/SMS integration

#### 4. **Density Analytics**
- **Density Calculation:** Objects per square meter
- **Density Levels:**
  - Low: < 0.15 objects/m²
  - Medium: 0.15 - 0.29 objects/m²
  - High: 0.30 - 0.39 objects/m²
  - Critical: ≥ 0.40 objects/m²

#### 5. **Historical Trends**
- **Time-Series Data:** Occupancy snapshots every 15 minutes
- **Trend Charts:** Visualize utilization over days/weeks/months
- **Capacity Planning:** Identify peak periods and growth patterns

#### 6. **IoT Sensor Integration**
- **Sensor Types:** Temperature, humidity, occupancy, weight, motion
- **Batch Ingestion:** MQTT protocol support for IoT sensor data
- **Anomaly Detection:** Automatic flagging of out-of-range readings

### Demo Script

#### **Demo Flow (12-15 minutes)**

**1. Heatmap Dashboard (3 minutes)**
```
Navigate to: http://localhost:3000/depot/heatmap

Key Points:
- "This is your warehouse spatial command center"
- "Each zone is color-coded by utilization level"
- "Green zones are healthy, orange approaching capacity, red are critical"
- "Real-time view updates as occupancy changes"
```

**2. Zone Details (2 minutes)**
```
Click on "Zone A" card

Shows:
- Zone Code: BLR-Z1
- Name: Storage Bay A1
- Current Occupancy: 910 bags
- Max Capacity: 1,200 bags
- Utilization: 76% (Warning level)
- Status: Warning

Key Points:
- "76% utilization triggered a warning alert"
- "Approaching 80% threshold"
- "Can see historical trend chart showing utilization over past 7 days"
```

**3. Create New Zone (3 minutes)**
```
Click: "Add Zone" button

Demo Data:
- Zone Code: BLR-Z7
- Name: Cold Storage Bay 1
- Zone Type: Cold Storage
- Floor: Ground
- Area: 500 m²
- Max Capacity: 800 pallets
- Cameras: CAM-017, CAM-018

Key Points:
- "New zone appears on the heatmap immediately"
- "Linked cameras will auto-update occupancy via vision system"
- "Temperature sensors can be added for cold storage monitoring"
```

**4. Update Zone Occupancy (2 minutes)**
```
Simulate receiving shipment to Zone A:
Current: 910 bags → Update to: 1,150 bags

Result:
- Utilization: 76% → 96% (Critical!)
- Status: Warning → Critical
- Color: Orange → Red

Key Points:
- "Capacity alert automatically triggered!"
- "Alert sent via multiple channels: WebSocket popup, RabbitMQ queue, Email/SMS"
- "Operations manager receives critical alert for immediate action"
- "System prevents over-capacity situations"
```

**5. Density Analytics (2 minutes)**
```
Click: "View Density Analytics"

Shows:
- Zone A: 0.32 objects/m² (High density)
- Zone B: 0.15 objects/m² (Medium density)
- Zone C: 0.08 objects/m² (Low density)

Key Points:
- "Density analytics help optimize warehouse layout"
- "Zone A is high-density, may need expansion or redistribution"
- "Zone C is underutilized, can relocate stock from Zone A"
```

**6. Historical Trends (3 minutes)**
```
Click: "Historical Data" for Zone A

View:
- 7-day utilization trend chart
- Peak hours: 2pm-4pm daily
- Gradual increase from 65% to 76% over the week

Key Points:
- "Trend analysis for capacity planning"
- "Predict when zone will reach full capacity"
- "Identify seasonal patterns for resource allocation"
- "Export data for executive reports and forecasting"
```

**7. IoT Sensor Integration (2 minutes)**
```
Navigate to: Sensor Readings section

Show:
- Temperature sensors in Cold Storage zones
- Occupancy sensors at zone entrances
- Motion sensors for perimeter security

Demo:
- Ingest sensor reading: Zone A, Temperature, 22.5°C
- Show anomaly detection: Temperature > 50°C flagged automatically

Key Points:
- "IoT sensors provide real-time environmental monitoring"
- "Automated alerts for temperature excursions in cold storage"
- "Occupancy sensors auto-update zone capacity"
- "Integration with MQTT brokers for scalability"
```

### ROI Talking Points
- **Increase Capacity:** 20-30% improvement in space utilization
- **Prevent Congestion:** Proactive alerts prevent bottlenecks
- **Safety Compliance:** Avoid overcrowding and safety violations
- **Data-Driven Planning:** Historical trends guide expansion decisions

---

## 🎯 Integrated Demo Scenario (Advanced)

### **End-to-End Workflow (15 minutes)**

**Scenario:** Large shipment arrival causes capacity issues, triggering automated incident response

**Step 1: Shipment Arrival**
```
1. Navigate to Heatmap
2. Simulate shipment: Zone A receives 300 new bags
3. Occupancy: 910 → 1,210 bags (exceeds capacity of 1,200!)
```

**What Happens:**
- ✅ Heatmap turns Zone A red (Critical - 101% utilization)
- ✅ Capacity alert automatically created
- ✅ System publishes alert to RabbitMQ queue

**Step 2: Automatic Incident Creation**
```
4. Navigate to Incidents page
5. New incident appears automatically: "Capacity Alert - Zone A at 101%"
```

**Incident Details:**
- Priority: P2 (High)
- Source: Capacity Alert
- Zone: Zone A
- Assigned To: Shift Supervisor
- Escalation Deadline: 15 minutes

**Step 3: Operator Response**
```
6. Shift Supervisor receives WebSocket popup notification
7. Acknowledges incident: "Initiating stock redistribution to Zone C"
```

**Step 4: Stock Movement**
```
8. Navigate to Inventory page
9. Transfer 250 bags from Zone A to Zone C
10. Movement Type: TRANSFER
```

**Result:**
- Zone A: 1,210 → 960 bags (80% utilization) ✅
- Zone C: 200 → 450 bags (45% utilization) ✅

**Step 5: Resolve Incident**
```
11. Navigate back to Incidents
12. Resolve incident with notes: "250 bags transferred to Zone C, capacity normalized"
13. Resolution steps documented in checklist
```

**Step 6: Verification**
```
14. Navigate to Heatmap
15. Zone A now shows green (80% - Normal)
16. Zone C shows green (45% - Normal)
17. Both zones within safe operating limits
```

### **Key Takeaways for Client**
1. **Automated Detection:** System detected capacity issue without manual monitoring
2. **Instant Notification:** Supervisor alerted in real-time via WebSocket
3. **Structured Response:** Incident workflow guided resolution process
4. **Complete Audit Trail:** Every action logged for compliance
5. **Integrated System:** Heatmap → Incident → Inventory working seamlessly

---

## 📊 Presentation Tips

### **Before the Demo**
1. ✅ Clear all test data from previous demos
2. ✅ Seed realistic data (zones, inventory, some historical incidents)
3. ✅ Test WebSocket connections (open browser dev console to verify)
4. ✅ Have backup screenshots in case of technical issues
5. ✅ Prepare printed handouts with architecture diagram

### **During the Demo**
1. **Start with Business Pain Points:** Ask client about their current challenges
2. **Show, Don't Tell:** Let the system demonstrate value through actions
3. **Use Client's Domain Language:** Adapt zone names, SKUs to their industry
4. **Highlight Real-Time Updates:** Emphasize WebSocket-based instant notifications
5. **Address Questions Immediately:** Don't defer to "we'll follow up"

### **After the Demo**
1. **Summarize ROI:** Quantify time saved, errors prevented, compliance benefits
2. **Discuss Customization:** Explain how system adapts to their workflows
3. **Next Steps:** Pilot deployment timeline, training plan, integration scope
4. **Leave Behind:** USB drive with demo video, technical documentation, pricing

---

## 🔗 Quick Navigation Links

### Frontend URLs
- **Incidents:** http://localhost:3000/depot/incidents
- **Inventory:** http://localhost:3000/depot/inventory
- **Heatmap:** http://localhost:3000/depot/heatmap

### Backend API Docs
- **Swagger UI:** http://localhost:8000/docs
- **Incidents API:** http://localhost:8000/ops/incidents
- **Inventory API:** http://localhost:8000/depot/inventory
- **Heatmap API:** http://localhost:8000/depot/vision/cluster/heatmap

### Test Endpoints (use in Postman)
```bash
# Get all incidents
GET http://localhost:8000/ops/incidents/

# Get heatmap data
GET http://localhost:8000/depot/vision/cluster/heatmap

# Get inventory items
GET http://localhost:8000/depot/inventory/items

# Get low stock report
GET http://localhost:8000/depot/inventory/reports/low-stock
```

---

## 📞 Support & Questions

**For technical issues during demo:**
- Check browser console for WebSocket connection errors
- Verify both backend and frontend servers are running
- Clear browser cache if UI doesn't update

**For client questions:**
- Pricing: Refer to sales team for custom quotes
- Integrations: ERP (SAP, Oracle), WMS (Manhattan, HighJump), IoT (AWS IoT, Azure IoT)
- Deployment: Cloud (AWS, Azure, GCP) or On-Premise
- Compliance: ISO 9001, ISO 27001, SOC 2, GDPR ready

---

**Last Updated:** June 3, 2026
**Version:** 1.0
**Author:** IntelliDepot Product Team
