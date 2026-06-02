# Testing the Incident Notification Feature

## ✅ Servers are Running

- **Backend**: http://localhost:8000
- **Frontend**: http://localhost:3000

## 🧪 How to Test the Feature

### Step 1: Open the Application
1. Open your browser (Chrome, Edge, or Firefox)
2. Navigate to: **http://localhost:3000**
3. Log in to the application

### Step 2: Navigate to Incidents Page
1. Click on **"Incidents"** in the left sidebar
2. You should see the Incidents & Alerts page

### Step 3: Acknowledge an Incident
1. Find any incident with status "Open" or "Critical"
2. Click the **"Acknowledge"** button (orange button)
3. Wait for the acknowledgment to process

### Step 4: Verify the Enhanced Popup
You should now see a popup with:

✅ **Success Icon** - Green checkmark in a circle

📋 **Title**: "Incident Acknowledged Successfully!"

👤 **Assigned To Section** showing:
- The person assigned to solve the problem
- Example: "Security Supervisor" or "Shift Supervisor"

📱 **Notifications Sent** showing:
- WhatsApp icon (📱) if WhatsApp notification was sent
- Email icon (📧) if Email notification was sent

📊 **Notification Status** showing:
- Detailed status for each notification channel
- Example: "whatsapp: Sent to Security Supervisor"
- Example: "email: Sent to Security Supervisor"
- Example: "supervisor: Notified Shift Supervisor"

### Step 5: Check Backend Logs
1. The backend terminal should show logs like:
   ```
   📱 WhatsApp notification sent to: Security Supervisor
   📧 Email notification sent to: Security Supervisor
   ```

## 🔍 What to Look For

### In the Popup:
- ✅ Green success icon at the top
- 👤 "ASSIGNED TO" section with the person's name
- 📱 WhatsApp notification indicator
- 📧 Email notification indicator
- Detailed notification status for each channel

### In the Backend Logs:
- Log entries showing WhatsApp notifications sent
- Log entries showing Email notifications sent
- Incident acknowledgment confirmation

## 🐛 Troubleshooting

### If you don't see the changes:

1. **Hard Refresh the Browser**:
   - Windows/Linux: `Ctrl + Shift + R`
   - Mac: `Cmd + Shift + R`

2. **Clear Browser Cache**:
   - Chrome: Press `F12` → Right-click refresh button → "Empty Cache and Hard Reload"
   - Edge: Press `F12` → Right-click refresh button → "Empty Cache and Hard Reload"

3. **Check if servers are running**:
   ```powershell
   # Check backend
   curl http://localhost:8000/health
   
   # Check frontend
   curl http://localhost:3000
   ```

4. **Restart the servers** (if needed):
   - The servers are already running in background processes
   - They should auto-reload when files change

## 📝 API Testing (Advanced)

You can also test the API directly:

```powershell
# Get list of incidents
curl http://localhost:8000/depot/vision/perimeter/incidents/active

# Acknowledge an incident (replace {incident_id} with actual ID)
curl -X PATCH http://localhost:8000/depot/vision/perimeter/incidents/{incident_id}/acknowledge `
  -H "Content-Type: application/json" `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -d '{"reason": "Test acknowledgment"}'
```

The response should include:
```json
{
  "incident": { ... },
  "assigned_to": "Security Supervisor",
  "notifications_sent": ["whatsapp", "email"],
  "notification_details": {
    "whatsapp": "Sent to Security Supervisor",
    "email": "Sent to Security Supervisor",
    "supervisor": "Notified Shift Supervisor"
  }
}
```

## ✨ Expected Behavior

1. **When you click "Acknowledge"**:
   - The incident status changes to "acknowledged"
   - WhatsApp notification is sent to the assigned person
   - Email notification is sent to the assigned person
   - Supervisor is notified (if different from assigned person)
   - A beautiful popup appears showing all the details

2. **The popup shows**:
   - Who is assigned to solve the problem
   - Which notifications were sent successfully
   - Detailed status of each notification

3. **Backend logs**:
   - Show notification attempts
   - Show success/failure for each channel
   - Include incident ID and assigned person

## 🎯 Success Criteria

✅ Popup appears after acknowledging an incident
✅ Popup shows assigned person's name
✅ Popup shows WhatsApp and Email notification indicators
✅ Popup shows detailed notification status
✅ Backend logs show notification attempts
✅ Incident status changes to "acknowledged"

## 📞 Need Help?

If you're still not seeing the changes:
1. Make sure you're on the correct page (Incidents page)
2. Try acknowledging a different incident
3. Check the browser console for any errors (F12 → Console tab)
4. Check the backend terminal for any error messages
5. Ensure you've done a hard refresh (Ctrl + Shift + R)
