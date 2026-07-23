import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './AuthProvider';
import { AppShell } from '../components/AppShell';
import { LoadingScreen } from '../components/LoadingScreen';
import { OnboardingPage } from '../features/auth/OnboardingPage';
import { FeedPage } from '../features/feed/FeedPage';
import { CalendarPage } from '../features/calendar/CalendarPage';
import { MemoriesPage } from '../features/moments/MemoriesPage';
import { MomentEditorPage } from '../features/moments/MomentEditorPage';
import { MomentDetailPage } from '../features/moments/MomentDetailPage';
import { ProfilePage } from '../features/profile/ProfilePage';
import { FestivalPage } from '../features/festival/FestivalPage';
import { NotificationsPage } from '../features/notifications/NotificationsPage';
import { AddToHomeScreenPage } from '../features/auth/AddToHomeScreenPage';

export default function App() {
  const { user, profile, loading } = useAuth();
  if (loading) return <LoadingScreen />;
  if (!user || !profile) return <OnboardingPage />;

  return <Routes>
    <Route element={<AppShell />}>
      <Route index element={<FeedPage />} />
      <Route path="calendar" element={<CalendarPage />} />
      <Route path="memories" element={<MemoriesPage />} />
      <Route path="moments/new" element={<MomentEditorPage />} />
      <Route path="profile" element={<ProfilePage />} />
    </Route>
    <Route path="moments/:kind/:momentId" element={<MomentDetailPage />} />
    <Route path="festival" element={<FestivalPage />} />
    <Route path="notifications" element={<NotificationsPage />} />
    <Route path="add-to-home" element={<AddToHomeScreenPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>;
}
