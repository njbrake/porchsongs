import { useState, useEffect } from 'react';

export default function ProfileTab({ profile, onSave }) {
  const [form, setForm] = useState({
    name: '',
    location_type: 'suburb',
    location_description: '',
    occupation: '',
    hobbies: '',
    family_situation: '',
    daily_routine: '',
    custom_references: '',
  });
  const [status, setStatus] = useState('');

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || '',
        location_type: profile.location_type || 'suburb',
        location_description: profile.location_description || '',
        occupation: profile.occupation || '',
        hobbies: profile.hobbies || '',
        family_situation: profile.family_situation || '',
        daily_routine: profile.daily_routine || '',
        custom_references: profile.custom_references || '',
      });
    }
  }, [profile]);

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) {
      alert('Please enter a name.');
      return;
    }
    try {
      const data = {
        ...form,
        name: form.name.trim(),
        location_description: form.location_description.trim() || null,
        occupation: form.occupation.trim() || null,
        hobbies: form.hobbies.trim() || null,
        family_situation: form.family_situation.trim() || null,
        daily_routine: form.daily_routine.trim() || null,
        custom_references: form.custom_references.trim() || null,
        is_default: true,
      };
      await onSave(data);
      setStatus('Saved!');
      setTimeout(() => setStatus(''), 2000);
    } catch (err) {
      alert('Failed to save profile: ' + err.message);
    }
  };

  return (
    <div>
      <div className="profile-intro">
        <h2>Your Profile</h2>
        <p>Tell us about your life so we can make songs feel like yours.</p>
      </div>
      <form className="profile-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Display Name</label>
          <input type="text" value={form.name} onChange={e => handleChange('name', e.target.value)} required placeholder="Your name" />
        </div>
        <div className="form-group">
          <label>Where do you live?</label>
          <select value={form.location_type} onChange={e => handleChange('location_type', e.target.value)}>
            <option value="suburb">Suburb</option>
            <option value="city">City</option>
            <option value="small-town">Small Town</option>
            <option value="rural">Rural</option>
          </select>
        </div>
        <div className="form-group">
          <label>Describe your area</label>
          <textarea rows="2" value={form.location_description} onChange={e => handleChange('location_description', e.target.value)}
            placeholder="e.g., Quiet cul-de-sac in a suburb outside Austin, big oak trees, neighbor kids always playing..." />
        </div>
        <div className="form-group">
          <label>Occupation</label>
          <input type="text" value={form.occupation} onChange={e => handleChange('occupation', e.target.value)}
            placeholder="e.g., Software engineer, teacher, nurse..." />
        </div>
        <div className="form-group">
          <label>Hobbies</label>
          <textarea rows="2" value={form.hobbies} onChange={e => handleChange('hobbies', e.target.value)}
            placeholder="e.g., Acoustic guitar, grilling, coaching Little League..." />
        </div>
        <div className="form-group">
          <label>Family Situation</label>
          <textarea rows="2" value={form.family_situation} onChange={e => handleChange('family_situation', e.target.value)}
            placeholder="e.g., Married, two kids (8 and 5), golden retriever named Max..." />
        </div>
        <div className="form-group">
          <label>Daily Routine</label>
          <textarea rows="2" value={form.daily_routine} onChange={e => handleChange('daily_routine', e.target.value)}
            placeholder="e.g., Morning coffee on the patio, commute on I-35, evening walks around the neighborhood..." />
        </div>
        <div className="form-group">
          <label>Custom References</label>
          <textarea rows="2" value={form.custom_references} onChange={e => handleChange('custom_references', e.target.value)}
            placeholder="e.g., My old Tacoma, the park on Elm Street, Friday night pizza at Luigi's..." />
        </div>
        <div className="form-actions">
          <button type="submit" className="btn primary">Save Profile</button>
          {status && <span className="save-status">{status}</span>}
        </div>
      </form>
    </div>
  );
}
