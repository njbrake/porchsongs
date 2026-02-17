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

    // Provider change updates model list
    document.getElementById('llm-provider').addEventListener('change', () => {
      this.updateModelList();
    });
  },

  async loadProviders() {
    try {
      this.providers = await API.listProviders();
    } catch (err) {
      console.error('Failed to load providers:', err);
      // Fallback defaults
      this.providers = [
        { name: 'openai', models: ['gpt-4o', 'gpt-4o-mini'] },
        { name: 'anthropic', models: ['claude-sonnet-4-5-20250929'] },
      ];
    }
  },

  populateSettingsForm() {
    const providerSelect = document.getElementById('llm-provider');
    const savedProvider = localStorage.getItem('porchsongs_provider') || 'openai';
    const savedModel = localStorage.getItem('porchsongs_model') || '';
    const savedKey = localStorage.getItem('porchsongs_api_key') || '';

    providerSelect.innerHTML = this.providers
      .map(p => `<option value="${p.name}" ${p.name === savedProvider ? 'selected' : ''}>${p.name}</option>`)
      .join('');

    this.updateModelList(savedModel);
    document.getElementById('llm-api-key').value = savedKey;
  },

  updateModelList(selectedModel) {
    const providerName = document.getElementById('llm-provider').value;
    const provider = this.providers.find(p => p.name === providerName);
    const models = provider ? provider.models : [];
    const saved = selectedModel || localStorage.getItem('porchsongs_model') || '';

    const modelSelect = document.getElementById('llm-model');
    modelSelect.innerHTML = models
      .map(m => `<option value="${m}" ${m === saved ? 'selected' : ''}>${m}</option>`)
      .join('');
  },

  saveSettings() {
    localStorage.setItem('porchsongs_provider', document.getElementById('llm-provider').value);
    localStorage.setItem('porchsongs_model', document.getElementById('llm-model').value);
    localStorage.setItem('porchsongs_api_key', document.getElementById('llm-api-key').value);
  },
};

// Boot
document.addEventListener('DOMContentLoaded', () => App.init());
