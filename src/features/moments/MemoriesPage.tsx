import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../app/AuthProvider';
import { MomentCard } from '../../components/MomentCard';
import { PageHeader } from '../../components/PageHeader';
import { listOwnMoments } from '../../firebase/moments';

export function MemoriesPage() {
  const { user } = useAuth();
  const query = useQuery({ queryKey: ['moments', user!.uid], queryFn: () => listOwnMoments(user!.uid) });
  const future = query.data?.filter((m) => m.kind === 'future') ?? [];
  const past = query.data?.filter((m) => m.kind === 'past') ?? [];
  return <main className="page"><PageHeader title="Memories" eyebrow="Created together" />
    <div className="privacy-note">🔒 Memories are private unless you choose to share them.</div>
    {future.length > 0 && <section><div className="section-heading"><h2>Upcoming</h2></div><div className="card-list">{future.map((m) => <MomentCard key={m.id} moment={m} />)}</div></section>}
    <section><div className="section-heading"><div><h2>{past.length} memories</h2><p>Your story, newest first.</p></div></div><div className="card-list">{past.map((m) => <MomentCard key={m.id} moment={m} />)}</div></section>
  </main>;
}
