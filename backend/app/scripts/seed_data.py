"""
Seed the database with sample data for development/demo.
Run: python -m app.scripts.seed_data
"""

import asyncio
import random
from datetime import datetime, timezone, timedelta
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import AsyncSessionLocal
from app.models.models import (
    User, UserRole, Category, KBArticle, Ticket, TicketMessage,
    TicketEvent, TicketEventType, TicketStatus, Priority,
    ChatSession, ChatMessage, Notification,
)
from app.core.security import hash_password


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        existing = await db.execute(select(func.count(User.id)))
        if existing.scalar() and existing.scalar() > 0:
            print("Database already has data. Skipping seed.")
            return

        # --- Users ---
        admin = User(
            name="Admin User",
            email="admin@example.com",
            password_hash=hash_password("admin123"),
            role=UserRole.ADMIN,
        )
        agent1 = User(
            name="Alice Agent",
            email="alice@example.com",
            password_hash=hash_password("agent123"),
            role=UserRole.AGENT,
        )
        agent2 = User(
            name="Bob Agent",
            email="bob@example.com",
            password_hash=hash_password("agent123"),
            role=UserRole.AGENT,
        )
        user1 = User(
            name="Charlie Customer",
            email="charlie@example.com",
            password_hash=hash_password("user123"),
            role=UserRole.USER,
        )
        user2 = User(
            name="Diana Customer",
            email="diana@example.com",
            password_hash=hash_password("user123"),
            role=UserRole.USER,
        )
        db.add_all([admin, agent1, agent2, user1, user2])
        await db.flush()
        print("Created 5 users (admin, agent1, agent2, user1, user2)")

        # --- Categories ---
        categories = [
            Category(name="Account & Billing", description="Account setup, billing, subscriptions"),
            Category(name="Technical Support", description="Bug reports, system issues, troubleshooting"),
            Category(name="Feature Requests", description="Feature suggestions and feedback"),
            Category(name="General Inquiry", description="General questions and information"),
        ]
        db.add_all(categories)
        await db.flush()
        print(f"Created {len(categories)} categories")

        # --- KB Articles ---
        articles_data = [
            ("Getting Started Guide", "Welcome to our platform! This guide will help you get started with the basics.\n\n## Creating an Account\n1. Visit the registration page\n2. Enter your email and create a password\n3. Verify your email address\n4. Complete your profile\n\n## Navigating the Dashboard\nOnce logged in, you'll see the main dashboard with quick access to your tickets, knowledge base, and AI chat assistant.", categories[3].id),
            ("How to Reset Your Password", "Follow these steps to reset your password:\n\n1. Go to the login page\n2. Click 'Forgot Password'\n3. Enter your registered email\n4. Check your email for the reset link\n5. Click the link and set a new password\n\nYour new password must be at least 8 characters long.", categories[0].id),
            ("Understanding Ticket Priority Levels", "Tickets are categorized by priority to help us serve you better:\n\n- **Low**: Non-urgent questions or minor feature requests\n- **Medium**: Standard issues that need attention (default)\n- **High**: Critical issues blocking your work\n\nHigh priority tickets are automatically flagged for immediate agent attention.", categories[1].id),
            ("Common Error Codes", "Here are common error codes and their meanings:\n\n- **E001**: Authentication failed - check your credentials\n- **E002**: Session expired - please log in again\n- **E003**: Rate limit exceeded - wait a few minutes\n- **E004**: Invalid input - check your data format\n- **E005**: Service unavailable - our team has been notified", categories[1].id),
            ("How to Submit a Feature Request", "We love hearing your ideas! To submit a feature request:\n\n1. Open a new ticket\n2. Set category to 'Feature Requests'\n3. Describe your idea in detail\n4. Include any relevant examples or use cases\n\nOur team reviews all feature requests monthly.", categories[2].id),
            ("Billing and Subscription FAQ", "Frequently asked questions about billing:\n\n**Q: When am I billed?**\nA: Billing occurs on the 1st of each month.\n\n**Q: Can I change my plan?**\nA: Yes, you can upgrade or downgrade anytime from Settings.\n\n**Q: Do you offer refunds?**\nA: We offer prorated refunds within 14 days of payment.", categories[0].id),
            ("Platform System Requirements", "Supported browsers:\n- Chrome 90+\n- Firefox 88+\n- Safari 14+\n- Edge 90+\n\nInternet is required. We recommend a minimum connection speed of 5 Mbps for optimal performance.", categories[1].id),
            ("Security Best Practices", "Keep your account secure:\n\n1. Use a strong, unique password\n2. Enable two-factor authentication (coming soon)\n3. Never share your login credentials\n4. Log out from shared devices\n5. Report suspicious activity immediately", categories[1].id),
            ("How to Close Your Account", "To close your account:\n\n1. Go to Account Settings\n2. Scroll to 'Danger Zone'\n3. Click 'Close Account'\n4. Confirm your decision\n\nNote: This action is irreversible. All your data will be permanently deleted within 30 days.", categories[0].id),
            ("Troubleshooting Connection Issues", "If you're experiencing connection issues:\n\n1. Check your internet connection\n2. Clear your browser cache\n3. Disable VPN/proxy temporarily\n4. Try a different browser\n5. Check our status page for outages\n\nIf the issue persists, contact support.", categories[1].id),
            ("API Integration Guide", "Our REST API allows you to integrate with your existing tools.\n\n## Authentication\nAll API requests require a Bearer token in the Authorization header.\n\n## Endpoints\n- `GET /api/v1/tickets` - List your tickets\n- `POST /api/v1/tickets` - Create a ticket\n- `GET /api/v1/kb/articles` - Search knowledge base\n\n## Rate Limits\n- 100 requests per minute per user\n- 1000 requests per hour per user", categories[1].id),
            ("Using the AI Chat Assistant", "Our AI chat assistant can help you:\n\n- Answer common questions\n- Search knowledge base articles\n- Generate ticket summaries\n- Draft replies to tickets\n\nSimply type your question in the AI Chat page and the assistant will respond with relevant information.", categories[3].id),
            ("Ticket Status Guide", "Understanding ticket statuses:\n\n- **Open**: Your ticket has been submitted\n- **In Progress**: An agent is working on it\n- **Waiting**: We need more information from you\n- **Resolved**: A solution has been provided\n- **Closed**: The ticket is complete\n\nYou can reopen closed tickets if needed.", categories[3].id),
            ("How to Attach Files to Tickets", "You can attach files to support tickets:\n\nSupported formats: PDF, DOCX, TXT, PNG, JPG\nMaximum file size: 10 MB\n\nTo attach a file:\n1. Create or open a ticket\n2. Click the attachment button\n3. Select your file\n4. Submit the ticket", categories[1].id),
            ("Notification Settings Guide", "Customize your notification preferences:\n\n1. Go to Settings > Notifications\n2. Toggle email notifications on/off\n3. Toggle browser notifications on/off\n4. Choose which events trigger notifications\n\nYou can change these settings anytime.", categories[3].id),
            ("Understanding the Dashboard Analytics", "The admin dashboard provides:\n\n- Total ticket count\n- Tickets by status breakdown\n- Average response time\n- Agent performance metrics\n- Category distribution\n- Monthly trends\n\nAll metrics update in real-time.", categories[3].id),
            ("Two-Factor Authentication Setup", "Two-factor authentication adds an extra layer of security.\n\n*Note: This feature is coming soon and will be available in the next release.*", categories[1].id),
            ("How to Search the Knowledge Base", "Use the knowledge base search to find articles:\n\n1. Navigate to Knowledge Base\n2. Type keywords in the search bar\n3. Filter by category\n4. Click on articles to read them\n\nThe search uses full-text matching across titles and content.", categories[3].id),
            ("Report a Bug", "To report a bug:\n\n1. Create a new ticket\n2. Set category to 'Technical Support'\n3. Describe what happened\n4. Include steps to reproduce\n5. Add screenshots if possible\n\nOur team investigates all reported bugs promptly.", categories[1].id),
            ("Platform Updates and Changelog", "Stay up to date with the latest platform changes.\n\n## Recent Updates\n- v1.2.0: New AI chat features\n- v1.1.0: Ticket timelines and file attachments\n- v1.0.0: Initial release\n\nCheck this space for future updates.", categories[3].id),
            ("How to Change Your Email Address", "To change your email:\n\n1. Go to Account Settings\n2. Click on your current email\n3. Enter the new email address\n4. Verify the new email\n5. Confirm the change\n\nA verification link will be sent to your new address.", categories[0].id),
            ("Managing Multiple Tickets", "Tips for managing multiple tickets:\n\n1. Use the search and filter options\n2. Sort by priority or status\n3. Use the category filter\n4. Check assigned tickets first\n5. Batch close resolved tickets\n\nAgents can use the admin ticket view for full oversight.", categories[3].id),
            ("Data Privacy and GDPR Compliance", "We take data privacy seriously:\n\n- All data is encrypted at rest and in transit\n- You can request data export anytime\n- Account deletion removes all personal data within 30 days\n- We never share your data with third parties\n- GDPR compliant since launch", categories[3].id),
            ("Setting Up Email Notifications", "To set up email notifications:\n\n1. Go to Settings\n2. Under Notifications, enable email alerts\n3. Choose which events trigger emails\n4. Save your preferences\n\nYou'll receive email notifications for ticket updates, assignments, and replies.", categories[0].id),
            ("Mobile Access Guide", "Our platform is fully responsive and works on mobile devices.\n\nFeatures available on mobile:\n- View and manage tickets\n- Search knowledge base\n- Chat with AI assistant\n- Receive notifications\n- Update profile settings\n\nNo app download required - just use your mobile browser.", categories[3].id),
        ]

        articles = []
        for title, body, cat_id in articles_data:
            article = KBArticle(
                title=title,
                body=body,
                category_id=cat_id,
                created_by_id=admin.id,
                is_published=True,
                published_at=datetime.now(timezone.utc) - timedelta(days=random.randint(1, 60)),
            )
            articles.append(article)
        db.add_all(articles)
        await db.flush()
        print(f"Created {len(articles)} KB articles")

        # --- Tickets ---
        ticket_subjects = [
            ("Cannot log into my account", user1.id, Priority.HIGH, agent1.id),
            ("Payment not processed", user1.id, Priority.MEDIUM, agent2.id),
            ("Feature request: Dark mode", user2.id, Priority.LOW, None),
            ("Error E003 on dashboard", user2.id, Priority.HIGH, agent1.id),
            ("How do I reset my password?", user1.id, Priority.LOW, None),
            ("Billing invoice for last month", user2.id, Priority.MEDIUM, agent2.id),
            ("API rate limiting issue", user1.id, Priority.HIGH, agent1.id),
            ("Account deletion request", user2.id, Priority.MEDIUM, None),
            ("Integration with Slack", user2.id, Priority.LOW, agent1.id),
            ("Slow loading times", user1.id, Priority.HIGH, agent2.id),
        ]

        statuses = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.WAITING, TicketStatus.RESOLVED, TicketStatus.CLOSED]
        tickets = []
        for subject, creator_id, priority, assigned_to_id in ticket_subjects:
            created_at = datetime.now(timezone.utc) - timedelta(days=random.randint(1, 30), hours=random.randint(0, 23))
            status = random.choice(statuses)
            resolved_at = None
            if status in (TicketStatus.RESOLVED, TicketStatus.CLOSED):
                resolved_at = created_at + timedelta(days=random.randint(1, 5))
            ticket = Ticket(
                subject=subject,
                description=f"This is a sample ticket regarding: {subject}",
                status=status,
                priority=priority,
                category_id=random.choice(categories).id,
                created_by_id=creator_id,
                assigned_to_id=assigned_to_id,
                created_at=created_at,
                updated_at=resolved_at or created_at,
                resolved_at=resolved_at,
            )
            tickets.append(ticket)
        db.add_all(tickets)
        await db.flush()
        print(f"Created {len(tickets)} tickets")

        # --- Ticket Messages ---
        msg_texts = [
            "I'm having trouble with this issue. Can you help?",
            "Thank you for reaching out. Let me look into this for you.",
            "I've tried the steps you suggested but the problem persists.",
            "Could you please provide more details? A screenshot would be helpful.",
            "I've attached the error log for your reference.",
            "Our team is working on a fix. We'll update you shortly.",
            "The issue has been resolved on our end. Please verify.",
            "Thank you for the update. Everything is working now.",
            "I'm following up on this ticket. Any updates?",
            "We've released a patch that should address this issue.",
        ]
        messages = []
        for ticket in tickets:
            num_msgs = random.randint(1, 4)
            for i in range(num_msgs):
                sender_id = ticket.created_by_id if i % 2 == 0 else (ticket.assigned_to_id or admin.id)
                is_internal = False
                if sender_id != ticket.created_by_id and random.random() < 0.2:
                    is_internal = True
                msg = TicketMessage(
                    ticket_id=ticket.id,
                    sender_id=sender_id,
                    message=random.choice(msg_texts),
                    is_internal=is_internal,
                    created_at=ticket.created_at + timedelta(hours=random.randint(1, 48) * (i + 1)),
                )
                messages.append(msg)
        db.add_all(messages)
        await db.flush()
        print(f"Created {len(messages)} ticket messages")

        # --- Ticket Events ---
        events = []
        for ticket in tickets:
            events.append(TicketEvent(
                ticket_id=ticket.id,
                user_id=ticket.created_by_id,
                event_type=TicketEventType.CREATED,
                new_value=ticket.status.value,
                description="Ticket created",
                created_at=ticket.created_at,
            ))
            if ticket.assigned_to_id:
                events.append(TicketEvent(
                    ticket_id=ticket.id,
                    user_id=admin.id,
                    event_type=TicketEventType.ASSIGNED,
                    old_value="unassigned",
                    new_value=ticket.assigned_to_id,
                    description=f"Assigned to agent",
                    created_at=ticket.created_at + timedelta(minutes=random.randint(5, 120)),
                ))
            if ticket.status in (TicketStatus.RESOLVED, TicketStatus.CLOSED):
                events.append(TicketEvent(
                    ticket_id=ticket.id,
                    user_id=ticket.assigned_to_id or admin.id,
                    event_type=TicketEventType.RESOLVED,
                    old_value=TicketStatus.IN_PROGRESS.value,
                    new_value=TicketStatus.RESOLVED.value,
                    created_at=ticket.resolved_at or ticket.created_at,
                ))
            if ticket.status == TicketStatus.CLOSED and ticket.resolved_at:
                events.append(TicketEvent(
                    ticket_id=ticket.id,
                    user_id=ticket.created_by_id,
                    event_type=TicketEventType.CLOSED,
                    old_value=TicketStatus.RESOLVED.value,
                    new_value=TicketStatus.CLOSED.value,
                    created_at=ticket.resolved_at + timedelta(hours=random.randint(1, 24)),
                ))
        db.add_all(events)
        await db.flush()
        print(f"Created {len(events)} ticket events")

        # --- Chat Sessions ---
        session1 = ChatSession(user_id=user1.id, title="Account setup help")
        session2 = ChatSession(user_id=user2.id, title="Password reset")
        session3 = ChatSession(user_id=user1.id, title="API documentation")
        db.add_all([session1, session2, session3])
        await db.flush()

        chat_msgs = []
        for session, user_q, ai_q in [
            (session1, "How do I set up my account?", "Welcome! To set up your account, start by completing your profile with your name and contact information. Then explore the dashboard to familiarize yourself with the features."),
            (session1, "Can I change my email?", "Yes, you can change your email in Account Settings. Click on your current email, enter the new one, and verify it through the confirmation link we'll send."),
            (session2, "I forgot my password", "No worries! Click 'Forgot Password' on the login page, enter your registered email, and we'll send you a reset link. Remember to check your spam folder if you don't see it."),
            (session2, "Thanks, that worked!", "Great to hear! If you need any more help, feel free to ask. You can also browse our knowledge base for more guides."),
            (session3, "What API endpoints are available?", "We offer REST API endpoints for tickets, knowledge base articles, and user management. Check the API Integration Guide in our knowledge base for full documentation."),
        ]:
            chat_msgs.append(ChatMessage(
                session_id=session.id,
                role="user",
                content=user_q,
                created_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 72)),
            ))
            chat_msgs.append(ChatMessage(
                session_id=session.id,
                role="assistant",
                content=ai_q,
                created_at=datetime.now(timezone.utc) - timedelta(hours=random.randint(1, 72)),
            ))
        db.add_all(chat_msgs)
        await db.flush()
        print(f"Created {len(chat_msgs)} chat messages")

        # --- Notifications ---
        notifications = [
            Notification(
                user_id=user1.id,
                title="Ticket created",
                message="Your ticket 'Cannot log into my account' has been created",
                link=f"/dashboard/tickets/{tickets[0].id}",
            ),
            Notification(
                user_id=user1.id,
                title="Ticket updated",
                message="Your ticket 'Payment not processed' status changed to in_progress",
                link=f"/dashboard/tickets/{tickets[1].id}",
            ),
            Notification(
                user_id=user2.id,
                title="New reply",
                message="Agent replied to your ticket 'Error E003 on dashboard'",
                link=f"/dashboard/tickets/{tickets[3].id}",
            ),
            Notification(
                user_id=agent1.id,
                title="New ticket assigned",
                message="Ticket 'Cannot log into my account' has been assigned to you",
                link=f"/dashboard/tickets/{tickets[0].id}",
            ),
            Notification(
                user_id=agent2.id,
                title="New ticket assigned",
                message="Ticket 'Payment not processed' has been assigned to you",
                link=f"/dashboard/tickets/{tickets[1].id}",
            ),
        ]
        db.add_all(notifications)
        await db.flush()
        print(f"Created {len(notifications)} notifications")

        await db.commit()
        print("\n✅ Seed complete!")
        print(f"   Users: 5 (admin/admin123, alice/agent123, bob/agent123, charlie/user123, diana/user123)")
        print(f"   Categories: {len(categories)}")
        print(f"   KB Articles: {len(articles)}")
        print(f"   Tickets: {len(tickets)}")
        print(f"   Messages: {len(messages)}")
        print(f"   Chat Sessions: 3")
        print(f"   Notifications: {len(notifications)}")


async def main() -> None:
    try:
        await seed()
    except Exception as e:
        print(f"❌ Seed failed: {e}")
        raise


if __name__ == "__main__":
    asyncio.run(main())
