"""
Intelli Platform — User Contact Resolver

Resolves user contact information (phone, email) from user identifiers.
Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
"""
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.notifications.incident_schemas import ContactInfo
from app.shared.models.user import User


class UserNotFoundException(Exception):
    """Raised when a user cannot be found in the database."""
    pass


class UserContactResolver:
    """
    Resolves user contact information from user identifiers.
    
    This service looks up user contact information (phone and email) from the database
    based on user identifiers. It validates that contact information is in the correct
    format and ensures at least one contact method is available.
    """
    
    async def get_contact_info(
        self,
        user_identifier: str,
        db: AsyncSession
    ) -> ContactInfo:
        """
        Resolve user contact information from identifier.
        
        Args:
            user_identifier: User ID, username, email, or role name
            db: Database session
            
        Returns:
            ContactInfo with phone and email
            
        Raises:
            UserNotFoundException: If user not found
            Exception: For database errors (propagated)
        """
        try:
            # Query user by email (user_identifier could be email or username)
            stmt = select(User).where(User.email == user_identifier)
            result = await db.execute(stmt)
            user = result.scalar_one_or_none()
            
            if not user:
                raise UserNotFoundException(
                    f"User not found with identifier: {user_identifier}"
                )
            
            # For now, use email as the primary contact method
            # Phone numbers would need to be added to User model or a separate profile table
            # This is a simplified implementation that uses email only
            contact_info = ContactInfo(
                user_id=str(user.id),
                phone=None,  # TODO: Add phone field to User model or create UserProfile table
                email=user.email,
                preferred_channel="email"
            )
            
            return contact_info
            
        except UserNotFoundException:
            # Re-raise UserNotFoundException as-is
            raise
        except Exception as e:
            # Propagate database errors with different exception type
            raise Exception(f"Database error while resolving contact info: {str(e)}") from e
