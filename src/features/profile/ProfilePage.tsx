import { useState } from 'react';
import { signOut } from 'firebase/auth';
import { useAuth } from '../../app/AuthProvider';
import { PageHeader } from '../../components/PageHeader';
import { auth } from '../../firebase/client';
import { updateProfile } from '../../firebase/profiles';
import { initials } from '../../utils/format';

export function ProfilePage() {
  const { user, profile, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false); const [name, setName] = useState(profile!.name); const [location, setLocation] = useState(profile!.location ?? '');
  async function save() { await updateProfile(user!.uid, { name: name.trim(), location: location.trim() }); await refreshProfile(); setEditing(false); }
  return <main className="page"><PageHeader title="Profile" eyebrow="Your innings" action={<button className="text-button" onClick={() => setEditing(!editing)}>{editing ? 'Cancel' : 'Edit'}</button>} />
    <section className="profile-card">{profile!.profilePhotos[0] ? <img src={profile!.profilePhotos[0]} alt="" /> : <div className="profile-avatar">{initials(profile!.name)}</div>}
      {editing ? <div className="profile-form"><input value={name} onChange={(e) => setName(e.target.value)} /><input value={location} onChange={(e) => setLocation(e.target.value)} placeholder="City" /><button onClick={save}>Save profile</button></div> : <><h2>{profile!.name}</h2><p>{profile!.location || 'Add your city'}</p></>}
    </section>
    <section className="profile-section"><h2>Interests</h2><div className="chips">{profile!.interests.length ? profile!.interests.map((item) => <span key={item}>{item}</span>) : <p className="muted">No interests added yet.</p>}</div></section>
    <button className="secondary-button" onClick={() => signOut(auth)}>Sign out</button>
  </main>;
}
