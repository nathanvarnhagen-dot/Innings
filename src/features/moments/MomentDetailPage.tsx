import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../app/AuthProvider';
import { listOwnMoments, removeMoment, setRsvp } from '../../firebase/moments';
import { formatMomentDate } from '../../utils/format';
import type { MomentKind, Rsvp } from '../../types/domain';

export function MomentDetailPage() {
  const { kind, momentId } = useParams<{ kind: MomentKind; momentId: string }>();
  const { user } = useAuth(); const navigate = useNavigate(); const queryClient = useQueryClient();
  const query = useQuery({ queryKey: ['moments', user!.uid], queryFn: () => listOwnMoments(user!.uid) });
  const moment = query.data?.find((m) => m.id === momentId && m.kind === kind);
  const remove = useMutation({ mutationFn: () => removeMoment(moment!), onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['moments'] }); navigate('/memories'); } });
  const rsvp = useMutation({ mutationFn: (value: Rsvp) => setRsvp(moment!.id, user!.uid, value), onSuccess: () => queryClient.invalidateQueries({ queryKey: ['moments'] }) });
  if (query.isLoading) return <main className="brand-screen">Loading…</main>;
  if (!moment) return <main className="brand-screen"><p>Moment not found.</p><button onClick={() => navigate('/memories')}>Back to memories</button></main>;
  return <main className={`detail-page ${moment.kind}`} style={moment.theme ? { background: moment.theme } : undefined}>
    <header><button onClick={() => navigate(-1)}>← Back</button><button className="danger-link" onClick={() => window.confirm('Delete this moment?') && remove.mutate()}>Delete</button></header>
    {moment.photos.length > 0 && <div className="photo-grid">{moment.photos.map((photo) => <img key={photo} src={photo} alt="Moment" />)}</div>}
    <article><span className="badge">{moment.kind === 'future' ? 'Upcoming' : moment.vibe || 'Memory'}</span><h1>{moment.title}</h1><p className="detail-meta">{formatMomentDate(moment.date)}{moment.location ? ` · ${moment.location}` : ''}</p>
      {moment.people.length > 0 && <p className="people">With {moment.people.join(', ')}</p>}
      {moment.caption && <p className="detail-caption">{moment.caption}</p>}
      {moment.highlight && <blockquote>✦ {moment.highlight}</blockquote>}
      {moment.kind === 'future' && <div className="rsvp-row">{(['going', 'maybe', 'no'] as Rsvp[]).map((value) => <button key={value} onClick={() => rsvp.mutate(value)} className={moment.rsvps?.[user!.uid] === value ? 'active' : ''}>{value === 'no' ? "Can't go" : value}</button>)}</div>}
    </article>
  </main>;
}
