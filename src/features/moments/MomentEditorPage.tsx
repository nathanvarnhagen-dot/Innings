import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { useAuth } from '../../app/AuthProvider';
import { createMoment, uploadMomentPhoto } from '../../firebase/moments';

const schema = z.object({
  kind: z.enum(['past', 'future']),
  title: z.string().trim().min(2, 'Give this moment a name.'),
  date: z.string().min(1, 'Choose a date.'),
  location: z.string().trim().optional(),
  vibe: z.string().trim().optional(),
  caption: z.string().trim().max(500).optional(),
  highlight: z.string().trim().max(300).optional(),
  people: z.string().optional(),
  public: z.boolean(),
});
type FormValues = z.infer<typeof schema>;

export function MomentEditorPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [saveError, setSaveError] = useState('');
  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { kind: 'past', date: new Date().toISOString().slice(0, 10), public: false },
  });
  const kind = useWatch({ control, name: 'kind' });

  async function submit(values: FormValues) {
    setSaveError('');
    try {
      const photos = await Promise.all(files.map((file) => uploadMomentPhoto(user!.uid, file)));
      const people = values.people?.split(',').map((name) => name.trim()).filter(Boolean) ?? [];
      await createMoment(user!.uid, { ...values, location: values.location ?? '', vibe: values.vibe ?? '', caption: values.caption ?? '', highlight: values.highlight ?? '', dedication: '', people, taggedUids: [], photos, theme: kind === 'future' ? 'linear-gradient(135deg,#ff6b6b,#845ef7)' : undefined, rsvps: {}, kind: values.kind });
      navigate('/memories');
    } catch { setSaveError('This moment could not be saved. Check your connection and try again.'); }
  }

  return <main className="page editor-page">
    <header className="editor-header"><button onClick={() => navigate(-1)}>Cancel</button><h1>New moment</h1><span /></header>
    <form onSubmit={handleSubmit(submit)} className="moment-form">
      <fieldset className="segmented"><label><input type="radio" value="past" {...register('kind')} />Memory</label><label><input type="radio" value="future" {...register('kind')} />Plan</label></fieldset>
      <label>What’s the moment?<input {...register('title')} placeholder={kind === 'future' ? 'Outside Lands with the crew' : 'Walk-off at Oracle Park'} />{errors.title && <small>{errors.title.message}</small>}</label>
      <div className="form-grid"><label>Date<input type="date" {...register('date')} />{errors.date && <small>{errors.date.message}</small>}</label><label>Vibe<input {...register('vibe')} placeholder="Game, concert…" /></label></div>
      <label>Location<input {...register('location')} placeholder="Where is it happening?" /></label>
      <label>{kind === 'future' ? 'Who’s invited?' : 'Who was there?'}<input {...register('people')} placeholder="Names, separated by commas" /></label>
      <label>{kind === 'future' ? 'What should everyone know?' : 'Tell the story'}<textarea rows={4} {...register('caption')} placeholder="The detail you never want to forget…" /></label>
      {kind === 'past' && <label>Your highlight<textarea rows={2} {...register('highlight')} placeholder="The moment inside the moment" /></label>}
      <label className="file-field">Photos<input type="file" accept="image/*" multiple onChange={(e) => setFiles(Array.from(e.target.files ?? []))} /><span>{files.length ? `${files.length} selected` : 'Choose photos'}</span></label>
      {kind === 'future' && <label className="check-field"><input type="checkbox" {...register('public')} /><span>Visible to friends</span></label>}
      {saveError && <p className="form-error">{saveError}</p>}
      <button className="primary-button" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : kind === 'future' ? 'Send the invite' : 'Save this memory'}</button>
    </form>
  </main>;
}
