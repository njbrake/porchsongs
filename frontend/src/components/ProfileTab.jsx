import { useState, useEffect } from 'react';

export default function ProfileTab({ profile, onSave }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (profile) {
      setName(profile.name || '');
      setDescription(profile.description || '');
    }
  }, [profile]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      await onSave({
        name: name.trim(),
        description: description.trim() || null,
        is_default: true,
      });
      setStatus('Saved!');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      setStatus('Error: ' + err.message);
    }
  };

  return (
    <div>
      <div className="profile-intro">
        <h2>Your Rewriting Preferences</h2>
        <p>Describe yourself and your life — every song rewrite will use this to personalize the lyrics for you.</p>
      </div>
      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Name</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            required
            placeholder="Your name"
          />
        </div>
        <div className="form-group">
          <label>About you (used in every rewrite)</label>
          <textarea
            rows="8"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder={"Anything the LLM should know when rewriting lyrics for you.\n\ne.g., I live in a quiet suburb outside Austin with my wife and two kids (8 and 5). I drive a Subaru Outback, work in software, play acoustic guitar on the porch most evenings. I like cycling, grilling, and coaching Little League. My dog Max is a golden retriever."}
          />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn primary">Save</button>
          {status && <span className="save-status">{status}</span>}
        </div>
      </form>
    </div>
  );
}
