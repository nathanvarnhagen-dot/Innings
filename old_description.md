# Old Innings Reference

I’ve reviewed and rendered `/home/user/code/INNINGS_OLD/index.html`. I’ll use it as the visual and behavioral reference for the current implementation.

Key takeaways:

- It is designed as a mobile-first, app-like experience capped at 430px wide.
- The visual language is consistent: deep indigo, white cards, soft gray backgrounds, rounded surfaces, subtle borders, and restrained shadows.
- Navigation uses stacked full-screen views with opacity transitions rather than routes.
- The primary navigation model is Feed, Calendar, Create, Memories, and Profile.
- Onboarding is phone authentication → verification → name/profile setup → optional iOS home-screen prompt.
- “Create” branches into two distinct flows:
  - A past memory with photos, people, highlight, and dedication.
  - A future event with theme, vibe, invitations, visibility, and RSVP support.
- Memories support detail views, editing, photo rotation/lightboxes, comments, tagging, and dedications.
- Future events support owner editing, guests, RSVP states, and event chat.
- The Outside Lands experience is unusually deep: lineup/day/stage navigation, personal schedule, RSVP, chat, reactions, and shared photos.
- Social behavior includes profiles, interests, friend requests, notifications, private chats, message reactions, and invite-by-text.
- Data behavior is backed directly by Firebase Auth and Firestore.

The rendered onboarding confirms that the dark, emotional brand area dominates the screen while the practical input area is anchored at the bottom. That hierarchy appears intentional and should be preserved.

The implementation problems are mainly structural rather than conceptual:

- All CSS, markup, state, navigation, Firebase access, and feature logic live in one 5,088-line file.
- Many components are recreated with inline styles.
- Navigation and screen lifecycle behavior are embedded in one `nav()` function.
- UI is frequently constructed through HTML strings.
- Global mutable variables coordinate unrelated features.
- Persistence logic and presentation logic are tightly coupled.
- Several screens contain both prototype/sample content and live Firestore-driven content.

So the endpoint is clear: preserve the product’s flows, visual tone, interaction density, and mobile feel while replacing the single-file architecture with reusable components, explicit state boundaries, and a proper data layer.
