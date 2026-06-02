# External Service Dependencies

This document describes the external services required for the Incident Acknowledgment Notifications feature.

## Overview

The notification system integrates with external services to deliver multi-channel notifications when incidents are acknowledged. These services must be configured and accessible for the notification features to function properly.

## Required External Services

### 1. WhatsApp Business API

**Purpose**: Send WhatsApp messages to assigned personnel when incidents are acknowledged.

**Service Options**:
- WhatsApp Business API (Direct)
- Twilio WhatsApp API
- Other WhatsApp Business Solution Providers

**Configuration Requirements**:
- API Base URL
- Authentication Token/API Key
- Sender Phone Number (WhatsApp Business Number)

**Environment Variables**:
```bash
WHATSAPP_API_BASE=https://api.whatsapp.com/v1  # or Twilio endpoint
WHATSAPP_API_TOKEN=your_api_token_here
WHATSAPP_SENDER_NUMBER=+1234567890
```

**API Rate Limits**:
- Varies by provider
- Typical: 80 messages per second (Twilio)
- 1000 messages per second (WhatsApp Cloud API)

**Message Constraints**:
- Maximum message length: 4096 characters
- Phone numbers must be in E.164 format (+[country][number])

**Dependencies**:
- Python package: `httpx>=0.28.0` (already in requirements.txt)

**Documentation**:
- WhatsApp Cloud API: https://developers.facebook.com/docs/whatsapp/cloud-api
- Twilio WhatsApp API: https://www.twilio.com/docs/whatsapp

---

### 2. SMTP Server (Email Service)

**Purpose**: Send email notifications to assigned personnel when incidents are acknowledged.

**Service Options**:
- Internal SMTP Server
- Gmail SMTP
- SendGrid
- AWS SES (Simple Email Service)
- Mailgun
- Other SMTP providers

**Configuration Requirements**:
- SMTP Host
- SMTP Port (typically 587 for TLS, 465 for SSL)
- Username/Authentication
- Password/API Key
- Sender Email Address
- Email Domain

**Environment Variables**:
```bash
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@example.com
SMTP_PASSWORD=your_app_password
EMAIL_SENDER_ADDRESS=notifications@example.com
EMAIL_DOMAIN=example.com
```

**Email Constraints**:
- Subject line: Recommended max 78 characters
- Email size: Varies by provider (typically 10-25 MB)
- Rate limits: Varies by provider

**Dependencies**:
- Python package: `aiosmtplib>=3.0.0` (already in requirements.txt)
- Python package: `jinja2>=3.1.0` (already in requirements.txt, used for email template rendering)

**Security Considerations**:
- Use TLS/SSL encryption (port 587 or 465)
- Store credentials in secure environment variables or secrets manager
- Use app-specific passwords for Gmail
- Consider using OAuth2 for enhanced security

**Documentation**:
- Gmail SMTP: https://support.google.com/mail/answer/7126229
- SendGrid: https://docs.sendgrid.com/for-developers/sending-email/integrating-with-the-smtp-api
- AWS SES: https://docs.aws.amazon.com/ses/latest/dg/send-email-smtp.html

---

## Service Configuration Validation

The system validates configuration at startup:

1. **WhatsApp Service**:
   - Checks for required environment variables
   - Validates phone number format
   - Tests API connectivity (optional health check)

2. **Email Service**:
   - Checks for required environment variables
   - Validates SMTP port range (0-65535)
   - Validates email address format
   - Tests SMTP connection (optional health check)

3. **Graceful Degradation**:
   - If a service is misconfigured, that notification channel is disabled
   - Other channels continue to function
   - Configuration errors are logged for administrator review

---

## Testing External Services

### WhatsApp API Testing

```bash
# Test WhatsApp API connectivity
curl -X POST https://api.whatsapp.com/v1/messages \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "to": "+1234567890",
    "from": "YOUR_SENDER_NUMBER",
    "body": "Test message"
  }'
```

### SMTP Testing

```python
# Test SMTP connection
import asyncio
import aiosmtplib
from email.mime.text import MIMEText

async def test_smtp():
    message = MIMEText("Test email")
    message["Subject"] = "Test"
    message["From"] = "sender@example.com"
    message["To"] = "recipient@example.com"
    
    async with aiosmtplib.SMTP(hostname="smtp.gmail.com", port=587, use_tls=True) as smtp:
        await smtp.login("username", "password")
        await smtp.send_message(message)
        print("Email sent successfully")

asyncio.run(test_smtp())
```

---

## Monitoring and Troubleshooting

### Common Issues

1. **WhatsApp API Errors**:
   - Invalid phone number format → Ensure E.164 format
   - Authentication failure → Verify API token
   - Rate limit exceeded → Implement backoff/retry logic
   - Message too long → Truncate to 4096 characters

2. **SMTP Errors**:
   - Connection timeout → Check firewall/network settings
   - Authentication failure → Verify credentials
   - TLS/SSL errors → Verify port and encryption settings
   - Recipient rejected → Verify email address format

### Logging

All notification attempts are logged to:
- **Database**: `notification_logs` table (if database is available)
- **Application Logs**: Structured logs with delivery status

### Metrics to Monitor

- Notification success rate per channel
- Average delivery time
- API error rates
- Connection failures
- Rate limit hits

---

## Production Deployment Checklist

- [ ] WhatsApp Business API account created and verified
- [ ] WhatsApp sender number registered and approved
- [ ] SMTP server configured and tested
- [ ] Environment variables set in production environment
- [ ] Credentials stored in secure secrets manager
- [ ] Rate limits configured appropriately
- [ ] Monitoring and alerting set up for notification failures
- [ ] Email templates tested and validated
- [ ] Phone number and email validation implemented
- [ ] Fallback mechanisms tested (graceful degradation)

---

## Security Best Practices

1. **Credential Management**:
   - Never commit credentials to version control
   - Use environment variables or secrets manager
   - Rotate credentials regularly
   - Use least-privilege access

2. **Data Privacy**:
   - Mask phone numbers and emails in application logs
   - Comply with GDPR/data protection regulations
   - Implement opt-out mechanisms if required
   - Secure notification content (no sensitive data in messages)

3. **Network Security**:
   - Use TLS/SSL for all external API calls
   - Validate SSL certificates
   - Implement request timeouts
   - Use secure DNS resolution

---

## Support and Resources

For issues with external services:
- WhatsApp Business API: Contact your WhatsApp Business Solution Provider
- SMTP/Email: Contact your email service provider support
- Internal issues: Check application logs and database notification records

For feature-specific issues:
- Review the Incident Acknowledgment Notifications spec in `.kiro/specs/incident-acknowledgment-notifications/`
- Check the design document for architecture details
- Review requirements document for acceptance criteria
