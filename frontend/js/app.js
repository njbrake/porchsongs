/**
 * Main app controller — tab routing, settings modal, initialization.
 */
const App = {
  providers: [],

  init() {
    this.initTabs();
    this.initSettings();
    ProfileManager.init();
    RewriteManager.init();
    WorkshopManager.init();
    ChatManager.init();
    LibraryManager.init();
    this.loadProviders();
  },

  // Tab switching
  initTabs() {
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        this.switchTab(tab.dataset.tab);
      });
    });
  },

  switchTab(name) {
    document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.toggle('active', c.id === `tab-${name}`));

    if (name === 'library') {
      LibraryManager.load();
    }
  },

  // Settings modal
  initSettings() {
    const modal = document.getElementById('settings-modal');
    const btn = document.getElementById('settings-btn');
    const close = modal.querySelector('.modal-close');
    const backdrop = modal.querySelector('.modal-backdrop');
    const saveBtn = document.getElementById('save-settings-btn');
    const verifyBtn = document.getElementById('verify-connection-btn');

    btn.addEventListener('click', () => {
      modal.classList.remove('hidden');
      this.populateSettingsForm();
    });

    const closeModal = () => modal.classList.add('hidden');
    close.addEventListener('click', closeModal);
    backdrop.addEventListener('click', closeModal);

    saveBtn.addEventListener('click', () => {
      this.saveSettings();
      closeModal();
    });

    verifyBtn.addEventListener('click', () => this.verifyConnection());
  },

  async loadProviders() {
    try {
      this.providers = await API.listProviders();
    } catch (err) {
      console.error('Failed to load providers:', err);
      this.providers = [];
    }
  },

  populateSettingsForm() {
    const providerSelect = document.getElementById('llm-provider');
    const savedProvider = localStorage.getItem('porchsongs_provider') || '';
    const savedModel = localStorage.getItem('porchsongs_model') || '';
    const savedKey = localStorage.getItem('porchsongs_api_key') || '';

    providerSelect.innerHTML = '<option value="">Select provider...</option>' +
      this.providers.map(p => `<option value="${p}" ${p === savedProvider ? 'selected' : ''}>${p}</option>`).join('');

    // If we have a saved model, show it in the model select
    const modelSelect = document.getElementById('llm-model');
    if (savedModel) {
      modelSelect.innerHTML = `<option value="${savedModel}" selected>${savedModel}</option>`;
    } else {
      modelSelect.innerHTML = '<option value="">Verify connection to load models</option>';
    }

    document.getElementById('llm-api-key').value = savedKey;
    this.clearVerifyStatus();
  },

  async verifyConnection() {
    const provider = document.getElementById('llm-provider').value;
    const apiKey = document.getElementById('llm-api-key').value.trim();
    const statusEl = document.getElementById('verify-status');

    if (!provider) {
      statusEl.textContent = 'Select a provider first.';
      statusEl.className = 'verify-status error';
      return;
    }
    if (!apiKey) {
      statusEl.textContent = 'Enter an API key first.';
      statusEl.className = 'verify-status error';
      return;
    }

    statusEl.textContent = 'Verifying...';
    statusEl.className = 'verify-status';

    try {
      const result = await API.verifyConnection({ provider, api_key: apiKey });
      if (result.ok) {
        statusEl.textContent = 'Connected!';
        statusEl.className = 'verify-status success';

        // Populate model dropdown
        const modelSelect = document.getElementById('llm-model');
        const savedModel = localStorage.getItem('porchsongs_model') || '';
        modelSelect.innerHTML = result.models
          .map(m => `<option value="${m}" ${m === savedModel ? 'selected' : ''}>${m}</option>`)
          .join('');
      } else {
        statusEl.textContent = result.error || 'Connection failed.';
        statusEl.className = 'verify-status error';
      }
    } catch (err) {
      statusEl.textContent = err.message;
      statusEl.className = 'verify-status error';
    }
  },

  clearVerifyStatus() {
    const el = document.getElementById('verify-status');
    el.textContent = '';
    el.className = 'verify-status';
  },

  saveSettings() {
    localStorage.setItem('porchsongs_provider', document.getElementById('llm-provider').value);
    localStorage.setItem('porchsongs_model', document.getElementById('llm-model').value);
    localStorage.setItem('porchsongs_api_key', document.getElementById('llm-api-key').value);
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
