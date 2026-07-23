import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { MomentCard } from '../../components/MomentCard';
import { PageHeader } from '../../components/PageHeader';
import { listOwnMoments } from '../../firebase/moments';

export function FeedPage() {
  const { user, profile } = useAuth();
  const moments = useQuery({ queryKey: ['moments', user!.uid], queryFn: () => listOwnMoments(user!.uid) });
  return <main className="page">
    <PageHeader title="Innings" eyebrow={`Welcome back, ${profile!.name.split(' ')[0]}`} action={<Link className="icon-button" to="/notifications" aria-label="Notifications">♢</Link>} />
    <Link to="/festival" className="feature-banner"><div><strong>Outside Lands 2026</strong><span>Build your lineup with friends</span></div><b>→</b></Link>
    <section className="section-heading"><div><h2>Your moments</h2><p>Past memories and plans with your people.</p></div><Link to="/moments/new">Add</Link></section>
    {moments.isLoading && <p className="muted center">Loading moments…</p>}
    {moments.isError && <p className="error-state">Moments could not be loaded.</p>}
    <div className="card-list">{moments.data?.map((moment) => <MomentCard key={`${moment.kind}-${moment.id}`} moment={moment} />)}</div>
    {!moments.isLoading && !moments.data?.length && <div className="empty-state"><span>♡</span><h2>Every moment starts somewhere</h2><p>Save a memory or invite friends to something coming up.</p><Link className="primary-button" to="/moments/new">Create a moment</Link></div>}
  </main>;
}
