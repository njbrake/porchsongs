/**
 * Profile form logic.
 */
const ProfileManager = {
  currentProfile: null,

  init() {
    const form = document.getElementById('profile-form');
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.save();
    });
    this.load();
  },

  async load() {
    try {
      const profiles = await API.listProfiles();
      // Find default or first profile
      const defaultProfile = profiles.find(p => p.is_default) || profiles[0];
      if (defaultProfile) {
        this.currentProfile = defaultProfile;
        this.fillForm(defaultProfile);
        this.updateBadge(defaultProfile.name);
      }
    } catch (err) {
      console.error('Failed to load profiles:', err);
    }
  },

  fillForm(profile) {
    document.getElementById('profile-id').value = profile.id || '';
    document.getElementById('profile-name').value = profile.name || '';
    document.getElementById('profile-location-type').value = profile.location_type || 'suburb';
    document.getElementById('profile-location-desc').value = profile.location_description || '';
    document.getElementById('profile-occupation').value = profile.occupation || '';
    document.getElementById('profile-hobbies').value = profile.hobbies || '';
    document.getElementById('profile-family').value = profile.family_situation || '';
    document.getElementById('profile-routine').value = profile.daily_routine || '';
    document.getElementById('profile-references').value = profile.custom_references || '';
  },

  getFormData() {
    return {
      name: document.getElementById('profile-name').value.trim(),
      location_type: document.getElementById('profile-location-type').value,
      location_description: document.getElementById('profile-location-desc').value.trim() || null,
      occupation: document.getElementById('profile-occupation').value.trim() || null,
      hobbies: document.getElementById('profile-hobbies').value.trim() || null,
      family_situation: document.getElementById('profile-family').value.trim() || null,
      daily_routine: document.getElementById('profile-routine').value.trim() || null,
      custom_references: document.getElementById('profile-references').value.trim() || null,
      is_default: true,
    };
  },

  async save() {
    const data = this.getFormData();
    if (!data.name) {
      alert('Please enter a name.');
      return;
    }

    const status = document.getElementById('profile-save-status');

    try {
      const existingId = document.getElementById('profile-id').value;
      let profile;
      if (existingId) {
        profile = await API.updateProfile(existingId, data);
      } else {
        profile = await API.createProfile(data);
      }
      this.currentProfile = profile;
      document.getElementById('profile-id').value = profile.id;
      this.updateBadge(profile.name);
      status.textContent = 'Saved!';
      setTimeout(() => { status.textContent = ''; }, 2000);
    } catch (err) {
      status.textContent = '';
      alert('Failed to save profile: ' + err.message);
    }
  },

  updateBadge(name) {
    document.getElementById('active-profile-badge').textContent = name;
  },

  getActiveProfileId() {
    return this.currentProfile ? this.currentProfile.id : null;
  },
};
