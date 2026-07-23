# Implementation plan: restore full old-page parity in the React application

The old `index.html` will be treated strictly as a visual and behavioral specification. It will not be copied wholesale, rendered inside an iframe, imported as a monolithic stylesheet, or converted into one oversized React component. Each capability will be rebuilt as typed React components, feature-level styles, hooks, and Firebase repositories consistent with the current project architecture.

## Delivery chunks

Deliver this work as vertically complete, visually testable milestones. Do not group work into broad horizontal phases such as “all CSS” or “all Firebase”; each chunk must leave the application coherent and independently reviewable.

### Chunk 1 — Foundation, app shell, and onboarding

This is the recommended first milestone. It includes steps 3–5 and the shell portion of step 4:

- Design tokens, reset, 430px mobile frame, safe-area behavior, system typography, and core controls.
- Reusable headers, icons, tabs, toast/sheet plumbing, and the five-item bottom navigation.
- The complete old-style onboarding flow: emoji brand field, phone input, verification, profile name, errors/loading states, and iOS Add to Home Screen prompt.
- Existing Firebase phone authentication retained behind the rebuilt interface; no Firestore schema migration in this chunk.
- Visual comparisons at 390×844 and 430×932, plus a focused auth-flow regression test.

Do not include Feed or moment-data work in this milestone. Its completion criterion is a visually faithful, operational first-run experience and a reusable mobile application frame.

### Chunk 2 — Past-memory lifecycle

Complete the data compatibility required for past moments, then ship past-memory creation, the Memories list, memory detail, photo lightbox, editing, comments/tagging, and deletion. This corresponds primarily to steps 6, 9 (past-memory flow), 10, and 11.

### Chunk 3 — Future-plan lifecycle

Ship future-plan creation, invitations, RSVP, future-detail owner and invitee modes, editing, and event chat. This corresponds primarily to steps 9 (future-plan flow), 12, and the required portions of steps 16–17.

### Chunk 4 — Social surfaces

Ship Feed, the monthly Calendar, Profile, public profiles, friend requests, and notifications as one connected social slice. This corresponds to steps 8 and 13–16.

### Chunk 5 — Festival vertical

Ship the entire Outside Lands experience together: festival RSVP, lineup, stages, artists, personal schedule, chat, reactions, and photos. This corresponds to steps 17 and 19.

### Chunk 6 — Remaining legacy surfaces and hardening

Finish feedback, group, fantasy, and matchup screens; then complete PWA/device polish, automated coverage, the visual-parity sweep, and cleanup. This corresponds to steps 18 and 20–25.

## 1. Establish a parity contract

- Create a screen-and-interaction inventory covering every old screen:
  - Onboarding and Add to Home Screen.
  - Feed and feedback chat.
  - Calendar.
  - Past- and future-moment creation.
  - Memories and both detail modes.
  - Profile, public profiles, friends, and notifications.
  - Outside Lands lineup, schedule, chat, photos, and artist details.
  - Group detail, fantasy, and matchup screens.
  - Shared overlays such as photo viewers, reaction sheets, confirmations, and toasts.
- Record the expected initial state, empty state, populated state, loading state, and error state for each screen.
- Capture reference screenshots at 390×844 and 430×932, plus interaction-state screenshots for modals, tabs, editors, and lightboxes.
- Use this inventory as the acceptance checklist throughout the work.

## 2. Define the target architecture before porting features

Keep the existing React/Vite/TypeScript structure and expand it along these boundaries:

```text
src/
  app/                  routing, providers, app shell
  components/
    ui/                 buttons, avatars, cards, tabs, sheets, inputs
    navigation/         headers, bottom navigation, back bars
    media/              photo carousel, gallery, lightbox
    messaging/          bubbles, composer, reactions
  features/
    auth/
    feed/
    calendar/
    moments/
    profile/
    friends/
    notifications/
    festival/
    groups/
    fantasy/
  firebase/             one repository module per domain
  hooks/                reusable UI and realtime hooks
  styles/
    tokens.css
    reset.css
    shell.css
    utilities.css
  types/
  utils/
```

- Use React Query for server state.
- Use React Hook Form and Zod for forms.
- Use local React state or reducers for transient multi-step UI.
- Keep navigation state in React Router.
- Keep Firebase calls out of visual components.
- Do not make `legacy.css` the production stylesheet. Re-express required styling through the new token and component system, then remove `legacy.css` once parity is reached.

## 3. Rebuild the visual foundation

- Replace the current DM Sans-based global styling with the old system-font stack.
- Restore the 430px application width, full-height mobile shell, deep-indigo outer background, safe-area padding, and mobile overflow behavior.
- Create tokens for:
  - Indigo, deep indigo, lavender, backgrounds, borders, text colors, win/loss colors.
  - Card radii, input radii, shadows, spacing, typography, and transitions.
- Build reusable UI primitives:
  - `Button`, `IconButton`, `TextButton`.
  - `Card`, `Avatar`, `AvatarStack`, `Badge`, `Chip`.
  - `Tabs`, `Sheet`, `Modal`, `Toast`.
  - `TextField`, `TextArea`, `Toggle`, `PhotoPicker`.
  - `EmptyState`, `PrivacyBanner`, `LoadingState`.
- Build an internal SVG icon set matching the thin outlined icons in the old page rather than relying on text glyphs such as `♡`, `○`, and `▦`.
- Verify primitives against isolated component examples before rebuilding pages.

## 4. Restore the application shell and navigation

- Update `AppShell` to reproduce the old five-item bottom navigation:
  - Feed.
  - Calendar.
  - Raised circular Create button.
  - Memories.
  - Profile.
- Restore the pill-shaped active navigation treatment and exact active/inactive icon behavior.
- Introduce reusable light and dark page headers, status-bar spacing, back buttons, notification indicators, and tab bars.
- Add routes for all currently missing destinations, including:
  - Feedback group.
  - Public user profile.
  - Group detail.
  - Future-moment detail/edit modes.
  - Festival stage and artist details where route state is beneficial.
  - Fantasy and matchup.
- Preserve React Router instead of recreating the old global `nav()` function.
- Add route-transition opacity where it contributes to parity without hiding every page in the DOM.

## 5. Rebuild onboarding and authentication

- Split `OnboardingPage` into:
  - `OnboardingBrand`.
  - `PhoneStep`.
  - `VerificationStep`.
  - `ProfileStep`.
  - `AddToHomeScreenPage`.
- Restore the old visual hierarchy:
  - Atmospheric emoji background.
  - Innings wordmark.
  - Uppercase tagline.
  - Mission copy.
  - Bottom-anchored white form.
  - `🇺🇸 +1` country control.
  - Privacy reassurance and lock icon.
- Format phone input as the user types while continuing to submit normalized digits.
- Preserve invisible Firebase reCAPTCHA and phone authentication.
- Explicitly destroy/recreate the verifier between attempts to prevent duplicate verifier failures.
- Restore distinct validation, sending, verification, and failure messages.
- Detect iOS standalone mode and show the old Add to Home Screen instructions after first-time profile creation.
- Add accessible focus movement when advancing between onboarding steps.

## 6. Expand the domain model and Firebase repositories

- Extend the TypeScript types to cover everything used by the old experience:
  - Profile photos, interests, custom vibes, invite code, festival RSVP, artist RSVPs, and profile metadata.
  - Past-memory comments and tagged users.
  - Future invitees, visibility, RSVP records, theme, and guest metadata.
  - Friend requests.
  - Chat messages and reactions.
  - Festival photos.
  - Notifications with actionable targets.
- Add runtime-safe Firestore converters instead of broadly casting document fields.
- Separate Firebase access into repositories such as:
  - `moments.ts`.
  - `profiles.ts`.
  - `friends.ts`.
  - `chats.ts`.
  - `festival.ts`.
  - `notifications.ts`.
- Retain compatibility with the old Firestore collections and field shapes so existing data remains visible.
- Support legacy data-URL photos when reading existing records, but upload all new photos to Firebase Storage.
- Add required Firestore indexes and document expected security-rule behavior.
- Centralize query keys and mutation invalidation.

## 7. Create a development fixture and authenticated visual-test mode

- Add a development-only repository/provider that supplies representative profiles, friends, memories, plans, chats, notifications, and festival data.
- Ensure this mode cannot be enabled in production builds.
- Use it to inspect authenticated screens without requiring repeated real SMS authentication or mutating production Firebase data.
- Prepare fixtures for empty, populated, owner, invitee, unread, and error scenarios.
- Use the same components with either fixture or Firebase repositories so test mode cannot drift into a separate UI.

## 8. Rebuild the Feed

- Match the old Feed header, logo treatment, notification button, spacing, background, and bottom navigation.
- Restore the Outside Lands and feedback banners with their original gradients, density, and click targets.
- Query:
  - The user’s moments.
  - Moments in which the user is tagged.
  - Public future moments owned by accepted friends.
- Recreate separate feed cards for:
  - Past memories.
  - Future invitations with RSVP controls.
  - Friend activity.
  - Empty feed guidance.
- Make RSVP controls update optimistically without triggering card navigation.
- Restore unread notification pip behavior.
- Verify long names, missing photos, and mixed past/future content.

## 9. Split the Create flow into past and future workflows

Replace the current single generic form with a route-level chooser and two independent multi-step forms.

### Past memory

- Step 1: main photo, title, date, vibe, custom vibe, and additional photos.
- Step 2: people who attended, friend tagging, manual names, and invite-by-text.
- Step 3: personal highlight with example prompts.
- Step 4: dedication/“remember someone” selection and final preview.
- Preserve progress indicators, Back/Next behavior, validation, and draft state.
- Compress previews locally, then upload original or appropriately resized files through Storage.
- Persist newly entered custom vibes to the profile.
- Save the memory only at the final step and navigate to its completed detail view.

### Future plan

- Step 1: title, date, location, theme, and vibe.
- Step 2: friend selection, invite-by-text, visibility toggle, and final submission.
- Restore theme swatches and gradient preview.
- Save tagged user IDs separately from display names.
- Create appropriate invitation notifications.
- Prevent double submission and retain the draft after recoverable upload errors.

## 10. Rebuild Memories

- Restore the old header, privacy banner, tabs, scroll behavior, and spacing.
- Show upcoming moments in the dedicated future section.
- Show past memories newest first using the old snapshot-card design:
  - Photo or ballpark-style fallback.
  - Score/title overlay.
  - People and date.
  - Caption.
  - Highlight panel.
- Restore the old empty and sample/fixture states without mixing sample data into production queries.
- Add pagination or sensible query limits without changing the visible first-load behavior.

## 11. Rebuild past-memory detail and editing

- Create separate view and edit components rather than building HTML strings dynamically.
- Restore:
  - Dark photo-led presentation.
  - Cross-fading photo rotation.
  - Position indicators.
  - Full-screen lightbox.
  - Swipe/next/previous navigation.
  - “Save all” behavior where supported.
  - People, caption, highlight, and dedication sections.
  - Comments.
- Add edit controls for text, people, and photos.
- Support tagging friends and notifying newly tagged users.
- Permit deletion only for the owner and use an app-styled confirmation sheet.
- Handle shared memories by loading from the owner’s nested moment collection.
- Return to the originating feed/profile/memories route after closing.

## 12. Rebuild future-moment detail and editing

- Render owner and invitee modes distinctly.
- Restore:
  - Gradient hero.
  - Date, location, vibe, and host.
  - Guest and RSVP summaries.
  - Going/Maybe/Can’t go actions.
  - Moment chat.
- Allow the owner to edit title, date, location, theme, vibe, visibility, and invitees.
- Permit adding and removing invited friends.
- Notify newly invited users.
- Add owner-only deletion with correct query invalidation and navigation.
- Ensure RSVP state stays synchronized across Feed, Memories, Calendar, and detail views.

## 13. Rebuild Calendar as the old monthly calendar

- Replace the current grouped timeline with:
  - Monthly grid.
  - Previous/next month controls.
  - Today and selected-day treatments.
  - Colored moment dots.
  - Past/upcoming/festival legend.
  - Selected-day event cards beneath the grid.
- Include both owned and tagged future moments.
- Include the Outside Lands calendar entry.
- Support month boundaries, leap years, multiple events per day, and unscheduled records.
- Preserve the compact fixed calendar area and independently scrolling day list.

## 14. Restore Profile and social identity

- Rebuild the profile hero with photo carousel/avatar fallback, name, location, and edit action.
- Restore statistics and weekly-streak calculations from social moments.
- Add profile-photo upload, deletion, selection, and preview behavior.
- Restore interest chips, quick picks, custom interest creation, and removal.
- Restore the “My teams” or moment-derived identity area.
- Add invite-code presentation and SMS sharing through the Web Share API or an `sms:` fallback.
- Preserve the privacy explanation.
- Keep sign-out available in a secondary settings area without displacing the old visible hierarchy.

## 15. Implement public profiles and friend requests

- Add a `/people/:uid` profile route using the same profile primitives.
- Display public photos, interests, stats, and shared/social context.
- Add friend-state handling:
  - No relationship.
  - Outgoing pending.
  - Incoming pending.
  - Accepted.
- Implement send, accept, and decline mutations through `friends.ts`.
- Open public profiles from member strips, chats, notifications, and invitee lists.
- Make friend mutations immediately update all affected controls.

## 16. Complete notifications and invitations

- Match the old notification header, unread styling, avatars, typography, and relative timestamps.
- Subscribe or refetch appropriately so the notification pip stays current.
- On notification activation:
  - Mark it read.
  - Navigate to the relevant profile, memory, event, or friend request.
- Generate notifications for moment tags, future invitations, and supported social actions.
- Restore SMS invite behavior in a shared `shareInvite` utility used throughout the app.

## 17. Build reusable realtime chat and reaction components

- Create a generic chat system with:
  - `ChatThread`.
  - `MessageBubble`.
  - `MessageComposer`.
  - `ReactionBadges`.
  - `ReactionSheet`.
- Support realtime Firestore subscriptions, sending, author names, timestamps, and automatic scrolling.
- Restore mine/theirs bubble shapes and light/dark themes.
- Open reactions through double-click/double-tap or a visible accessible action.
- Support reaction toggling.
- Allow users to delete only their own messages.
- Reuse the system for:
  - Feedback chat.
  - Future-moment chat.
  - Outside Lands chat.
  - Artist chat.
  - Group chat.

## 18. Rebuild the feedback group

- Add the dark feedback route linked from the Feed banner.
- Reproduce its title, description, chat background, bubble styling, and fixed composer.
- Store messages in the existing `feedbackChat` collection.
- Apply the shared reaction and deletion behavior.
- Preserve safe-area spacing around the composer.

## 19. Rebuild the full Outside Lands experience

Split the existing `FestivalPage` into dedicated components and hooks:

- Festival header and member strip.
- First-visit RSVP overlay.
- Lineup tab.
- “Your Festival” tab.
- Chat tab.
- Photos tab.
- Day selector.
- Stage overview.
- Stage-detail schedule.
- Artist detail sheet/page.
- Personal schedule.

Implement the old behavior:

- Festival-level Going/Maybe/No RSVP.
- Friday/Saturday/Sunday switching.
- Stage-specific schedules.
- Going/Maybe artist responses.
- Personal schedule derived from artist responses.
- Artist attendee list.
- Artist-specific realtime chat.
- Apple Music artist lookup/link with a safe fallback.
- Festival group chat and reactions.
- Shared photo upload, lightbox, swipe navigation, selection mode, select-all, download, save-all, and owner deletion.
- Preserve the distinctive dark purple festival visual system independently from the main light application theme.

## 20. Restore remaining group, fantasy, and matchup screens

- Rebuild the old group detail screen with:
  - Dark group header.
  - Member strip.
  - Conversation tabs.
  - Realtime chat.
- Recreate the fantasy league screen and matchup detail screen as separate routes and feature components.
- Separate static league/sample configuration from UI markup so it can later be replaced by live data.
- Match score cards, standings, win/loss treatments, tabs, and navigation.
- Confirm whether every control in the old prototype was functional; implement equivalent behavior for functional controls and preserve display-only controls as display-only.

## 21. Restore overlays, motion, and tactile behavior

- Centralize toast messages, confirmation sheets, bottom sheets, photo lightboxes, and message reaction sheets.
- Restore:
  - 220ms screen fades.
  - Live indicator pulsing.
  - Photo cross-fades.
  - Tab transitions.
  - Sticky/fixed composers and bottom navigation.
- Respect `prefers-reduced-motion`.
- Lock background scrolling while a modal or lightbox is open.
- Preserve focus and return it to the triggering control when overlays close.

## 22. Complete PWA and device-specific behavior

- Match the old title, theme color, app name, portrait orientation, and standalone appearance.
- Create proper icon assets instead of retaining a large embedded data URI.
- Verify service-worker update behavior and offline shell loading.
- Handle safe areas on iPhones.
- Ensure browser mode and installed PWA mode both lay out correctly.
- Confirm that Add to Home Screen guidance appears only where relevant.

## 23. Add automated coverage as each feature lands

- Add unit tests for:
  - Date formatting and calendar generation.
  - Weekly streak calculations.
  - Phone normalization.
  - RSVP aggregation.
  - Friend-state derivation.
  - Firestore converters.
- Add component tests for:
  - Onboarding transitions.
  - Create-flow validation and back navigation.
  - RSVP selection.
  - Profile editing.
  - Reaction toggling.
- Add repository tests against Firebase emulators or mocked SDK boundaries.
- Add end-to-end tests for the critical journeys:
  - New-user onboarding.
  - Create and edit a past memory.
  - Create and RSVP to a future plan.
  - Browse Calendar and Memories.
  - Friend request lifecycle.
  - Chat and reactions.
  - Festival schedule and photos.

## 24. Perform visual parity testing feature-by-feature

For every completed screen:

- Render the old and new versions at the same viewport and state.
- Compare structure, spacing, typography, colors, radii, icon weight, scrolling, fixed controls, and transitions.
- Capture screenshots for empty and populated states.
- Fix differences before moving the feature to “complete.”
- Test at 320px, 390px, 430px, and desktop-centered widths.
- Test iOS Safari-like safe areas and Android Chrome behavior.
- Run accessibility checks for labels, focus order, contrast, reduced motion, and keyboard operation without intentionally changing the old visual appearance.

## 25. Remove transitional and duplicate code

Once all parity checks pass:

- Delete `src/styles/legacy.css`.
- Remove old placeholder glyph icons and superseded generic page styles.
- Remove obsolete components and Firebase helpers replaced by domain repositories.
- Eliminate duplicated colors, gradients, and spacing values.
- Ensure no feature uses inline HTML construction or direct DOM manipulation.
- Ensure no component calls Firebase directly.
- Run `npm run lint`, `npm test`, and `npm run build`.
- Complete a final walkthrough against the parity contract before declaring the migration finished.

The key implementation rule throughout is: reproduce the old product, not the old source. Visual values, text, state transitions, and data behavior should be deliberately translated into the current component/repository architecture; the 5,088-line document itself must never become an imported dependency or a new monolithic React file.
