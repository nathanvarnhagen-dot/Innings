import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../app/AuthProvider';
import { PageHeader } from '../../components/PageHeader';
import { listOwnMoments } from '../../firebase/moments';
import { formatMomentDate } from '../../utils/format';
import { Link } from 'react-router-dom';
import type { Moment } from '../../types/domain';

export function CalendarPage() {
  const { user } = useAuth();
  const { data = [] } = useQuery({ queryKey: ['moments', user!.uid], queryFn: () => listOwnMoments(user!.uid) });
  const grouped = data.reduce<Record<string, Moment[]>>((result, moment) => {
    const key = moment.date || 'Unscheduled';
    (result[key] ??= []).push(moment);
    return result;
  }, {});
  return <main className="page"><PageHeader title="Calendar" eyebrow="Your shared life" />
    <div className="timeline">{Object.entries(grouped).map(([date, moments]) => <section key={date}><time>{date === 'Unscheduled' ? date : formatMomentDate(date)}</time>{moments?.map((m) => <Link key={`${m.kind}-${m.id}`} to={`/moments/${m.kind}/${m.id}`} className="timeline-item"><span>{m.kind === 'future' ? '✦' : '♡'}</span><div><strong>{m.title}</strong><p>{m.location || m.vibe || 'Moment'}</p></div></Link>)}</section>)}</div>
    {!data.length && <div className="empty-state"><h2>Your calendar is open</h2><p>Add a past memory or plan what comes next.</p><Link className="primary-button" to="/moments/new">Add a moment</Link></div>}
  </main>;
}
