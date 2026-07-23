import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { listNotifications, markNotificationRead } from '../../firebase/notifications';

export function NotificationsPage() {
  const { user } = useAuth(); const navigate = useNavigate();
  const { data = [], isLoading } = useQuery({ queryKey: ['notifications', user!.uid], queryFn: () => listNotifications(user!.uid) });
  return <main className="standalone-page"><header className="simple-header"><button onClick={() => navigate(-1)}>← Back</button><h1>Notifications</h1><span /></header>
    <div className="notification-list">{isLoading && <p>Loading…</p>}{data.map((item) => <button key={item.id} className={item.read ? '' : 'unread'} onClick={() => markNotificationRead(item.id)}><span>{item.type === 'friend_request' ? '○' : '♡'}</span><div><strong>{item.text}</strong><time>{new Date(item.ts).toLocaleDateString()}</time></div></button>)}</div>
    {!isLoading && !data.length && <div className="empty-state"><h2>You’re all caught up</h2><p>Invites, tags, and friend activity will appear here.</p></div>}
  </main>;
}
