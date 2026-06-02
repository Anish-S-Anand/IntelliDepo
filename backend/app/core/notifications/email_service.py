"""
Intelli Platform — Email Notification Service

Sends email notifications about incident acknowledgments.
Requirements: 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 8.3, 8.4, 8.5, 8.6, 9.3, 12.2
"""
import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from datetime import datetime, timezone
from typing import NamedTuple
import uuid

from app.core.notifications.incident_schemas import (
    IncidentNotificationData,
    SendResult
)


class EmailContent(NamedTuple):
    """Email content with both HTML and plain text versions."""
    html: str
    plain_text: str


class EmailService:
    """
    Service for sending email notifications about incident acknowledgments.
    
    This service renders email templates and sends emails via SMTP.
    """
    
    def __init__(
        self,
        smtp_host: str,
        smtp_port: int,
        smtp_username: str,
        smtp_password: str,
        sender_address: str,
        email_domain: str,
        use_tls: bool = True,
        enabled: bool = True
    ):
        """
        Initialize email service.
        
        Args:
            smtp_host: SMTP server hostname
            smtp_port: SMTP server port
            smtp_username: SMTP authentication username
            smtp_password: SMTP authentication password
            sender_address: Email address to use as sender
            email_domain: Domain for generating Message-IDs
            use_tls: Whether to use TLS encryption
            enabled: Whether email notifications are enabled
        """
        self.smtp_host = smtp_host
        self.smtp_port = smtp_port
        self.smtp_username = smtp_username
        self.smtp_password = smtp_password
        self.sender_address = sender_address
        self.email_domain = email_domain
        self.use_tls = use_tls
        self.enabled = enabled
    
    def render_email_template(self, incident: IncidentNotificationData) -> EmailContent:
        """
        Render HTML and plain text email from incident data.
        
        Args:
            incident: Incident notification data
            
        Returns:
            EmailContent with both HTML and plain text versions
        """
        # Sanitize data for HTML (basic escaping)
        def escape_html(text: str) -> str:
            return (text
                    .replace("&", "&amp;")
                    .replace("<", "&lt;")
                    .replace(">", "&gt;")
                    .replace('"', "&quot;")
                    .replace("'", "&#x27;"))
        
        # Plain text version
        plain_parts = [
            f"Incident Acknowledged",
            f"",
            f"Title: {incident.title}",
            f"Priority: {incident.priority}",
            f"Assigned to: {incident.assigned_to}",
            f"Acknowledged by: {incident.acknowledged_by}",
            f"Time: {incident.acknowledged_at.strftime('%Y-%m-%d %H:%M:%S %Z')}",
        ]
        
        if incident.zone:
            plain_parts.append(f"Zone: {incident.zone}")
        
        if incident.incident_type:
            plain_parts.append(f"Type: {incident.incident_type}")
        
        if incident.description:
            plain_parts.append(f"")
            plain_parts.append(f"Description:")
            plain_parts.append(incident.description)
        
        plain_text = "\n".join(plain_parts)
        
        # HTML version with styling
        html_parts = [
            "<!DOCTYPE html>",
            "<html>",
            "<head>",
            "<meta charset='UTF-8'>",
            "<style>",
            "body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }",
            ".container { max-width: 600px; margin: 0 auto; padding: 20px; }",
            ".header { background-color: #f44336; color: white; padding: 20px; border-radius: 5px 5px 0 0; }",
            ".content { background-color: #f9f9f9; padding: 20px; border: 1px solid #ddd; border-radius: 0 0 5px 5px; }",
            ".field { margin-bottom: 10px; }",
            ".label { font-weight: bold; color: #555; }",
            ".priority { display: inline-block; padding: 5px 10px; border-radius: 3px; font-weight: bold; }",
            ".priority-P1 { background-color: #f44336; color: white; }",
            ".priority-P2 { background-color: #ff9800; color: white; }",
            ".priority-P3 { background-color: #ffc107; color: black; }",
            ".priority-P4 { background-color: #4caf50; color: white; }",
            "</style>",
            "</head>",
            "<body>",
            "<div class='container'>",
            "<div class='header'>",
            f"<h2>🚨 Incident Acknowledged</h2>",
            "</div>",
            "<div class='content'>",
            f"<div class='field'><span class='label'>Title:</span> {escape_html(incident.title)}</div>",
            f"<div class='field'><span class='label'>Priority:</span> <span class='priority priority-{incident.priority}'>{incident.priority}</span></div>",
            f"<div class='field'><span class='label'>Assigned to:</span> {escape_html(incident.assigned_to)}</div>",
            f"<div class='field'><span class='label'>Acknowledged by:</span> {escape_html(incident.acknowledged_by)}</div>",
            f"<div class='field'><span class='label'>Time:</span> {incident.acknowledged_at.strftime('%Y-%m-%d %H:%M:%S %Z')}</div>",
        ]
        
        if incident.zone:
            html_parts.append(f"<div class='field'><span class='label'>Zone:</span> {escape_html(incident.zone)}</div>")
        
        if incident.incident_type:
            html_parts.append(f"<div class='field'><span class='label'>Type:</span> {escape_html(incident.incident_type)}</div>")
        
        if incident.description:
            html_parts.append(f"<div class='field' style='margin-top: 20px;'>")
            html_parts.append(f"<span class='label'>Description:</span>")
            html_parts.append(f"<p>{escape_html(incident.description)}</p>")
            html_parts.append(f"</div>")
        
        html_parts.extend([
            "</div>",
            "</div>",
            "</body>",
            "</html>"
        ])
        
        html = "\n".join(html_parts)
        
        return EmailContent(html=html, plain_text=plain_text)
    
    async def send_incident_acknowledgment(
        self,
        recipient_email: str,
        incident_data: IncidentNotificationData
    ) -> SendResult:
        """
        Send email notification about incident acknowledgment.
        
        Args:
            recipient_email: Recipient email address
            incident_data: Structured incident information
            
        Returns:
            SendResult with message_id and delivery status
        """
        timestamp = datetime.now(timezone.utc)
        
        # If email is disabled, return success without sending
        if not self.enabled:
            return SendResult(
                success=True,
                message_id="email_disabled",
                error=None,
                timestamp=timestamp
            )
        
        try:
            # Render email content
            email_content = self.render_email_template(incident_data)
            
            # Prepare email message
            message = MIMEMultipart("alternative")
            message["Subject"] = f"[{incident_data.priority}] Incident Acknowledged: {incident_data.title}"
            message["From"] = self.sender_address
            message["To"] = recipient_email
            message_id = f"<{uuid.uuid4()}@{self.email_domain}>"
            message["Message-ID"] = message_id
            
            # Attach plain text and HTML versions
            message.attach(MIMEText(email_content.plain_text, "plain"))
            message.attach(MIMEText(email_content.html, "html"))
            
            # Send via SMTP
            async with aiosmtplib.SMTP(
                hostname=self.smtp_host,
                port=self.smtp_port,
                use_tls=self.use_tls
            ) as smtp:
                # Only login if credentials are provided
                if self.smtp_username and self.smtp_password:
                    await smtp.login(self.smtp_username, self.smtp_password)
                await smtp.send_message(message)
            
            return SendResult(
                success=True,
                message_id=message_id,
                error=None,
                timestamp=timestamp
            )
        
        except aiosmtplib.SMTPException as e:
            return SendResult(
                success=False,
                message_id=None,
                error=f"SMTP error: {str(e)}",
                timestamp=timestamp
            )
        except Exception as e:
            return SendResult(
                success=False,
                message_id=None,
                error=f"Unexpected error: {str(e)}",
                timestamp=timestamp
            )
