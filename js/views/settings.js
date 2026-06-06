/**
 * Investment Portfolio Manager — Settings Tab View
 * Handles themes, backup import/export, and Google Sheets synchronization settings.
 */

const SettingsView = (() => {

  // ─── LIFECYCLE HOOKS ──────────────────────────────────────────────
  function onEnter() {
    bindEvents();
    loadSettingsValues();
  }

  function onLeave() {
    // Nothing to do
  }

  // ─── BINDINGS & EVENT HANDLERS ────────────────────────────────────
  function bindEvents() {
    // Theme toggle
    const themeBtn = document.getElementById('settings-theme-toggle');
    if (themeBtn) {
      themeBtn.addEventListener('click', () => {
        ThemeManager.toggle();
        if (window.App && window.App.showToast) {
          window.App.showToast('Theme updated', 'info');
        }
      });
    }

    // Storage mode selector
    const modeGroup = document.getElementById('settings-mode-group');
    if (modeGroup) {
      modeGroup.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-toggle');
        if (!btn) return;

        modeGroup.querySelectorAll('.btn-toggle').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const mode = btn.dataset.mode;
        const configArea = document.getElementById('sheets-config-area');
        if (configArea) {
          configArea.style.display = mode === 'sheets' ? 'block' : 'none';
        }

        StorageManager.updateSettings({ storageMode: mode });
      });
    }

    // Sync button
    const syncBtn = document.getElementById('btn-sync-sheets');
    if (syncBtn) {
      syncBtn.addEventListener('click', handleSheetsSync);
    }

    // Export button
    const exportBtn = document.getElementById('btn-export-data');
    if (exportBtn) {
      exportBtn.addEventListener('click', handleExport);
    }

    // Import button & hidden input
    const importBtn = document.getElementById('btn-import-data');
    const importInput = document.getElementById('import-file-input');
    if (importBtn && importInput) {
      importBtn.addEventListener('click', () => importInput.click());
      importInput.addEventListener('change', handleImport);
    }

    // Clear db button
    const clearBtn = document.getElementById('btn-clear-db');
    if (clearBtn) {
      clearBtn.addEventListener('click', handleClearDB);
    }

    // Inputs blur to save settings automatically
    const sheetsUrlInput = document.getElementById('settings-sheets-url');
    const sheetsKeyInput = document.getElementById('settings-sheets-key');

    if (sheetsUrlInput) {
      sheetsUrlInput.addEventListener('blur', () => {
        StorageManager.updateSettings({ sheetsUrl: sheetsUrlInput.value.trim() });
      });
    }
    if (sheetsKeyInput) {
      sheetsKeyInput.addEventListener('blur', () => {
        StorageManager.updateSettings({ sheetsKey: sheetsKeyInput.value.trim() });
      });
    }
  }

  // ─── UTILITIES & LOADERS ──────────────────────────────────────────
  function loadSettingsValues() {
    const settings = StorageManager.getSettings();

    // Set active storage mode btn
    const modeGroup = document.getElementById('settings-mode-group');
    if (modeGroup) {
      modeGroup.querySelectorAll('.btn-toggle').forEach(btn => {
        if (btn.dataset.mode === settings.storageMode) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    // Show config area if sheets mode
    const configArea = document.getElementById('sheets-config-area');
    if (configArea) {
      configArea.style.display = settings.storageMode === 'sheets' ? 'block' : 'none';
    }

    // Populate input fields
    const sheetsUrlInput = document.getElementById('settings-sheets-url');
    const sheetsKeyInput = document.getElementById('settings-sheets-key');
    
    if (sheetsUrlInput) sheetsUrlInput.value = settings.sheetsUrl || '';
    if (sheetsKeyInput) sheetsKeyInput.value = settings.sheetsKey || '';

    // Update status text
    const statusEl = document.getElementById('sheets-conn-status');
    if (statusEl) {
      if (settings.storageMode === 'sheets' && settings.sheetsUrl) {
        statusEl.textContent = 'Sync configuration saved. Click Sync to connect.';
        statusEl.className = 'connection-status pending';
      } else {
        statusEl.textContent = 'Disconnected';
        statusEl.className = 'connection-status';
      }
    }
  }

  // ─── ACTION IMPLEMENTATIONS ───────────────────────────────────────
  async function handleSheetsSync() {
    const statusEl = document.getElementById('sheets-conn-status');
    const sheetsUrlInput = document.getElementById('settings-sheets-url');
    const sheetsKeyInput = document.getElementById('settings-sheets-key');

    if (!statusEl || !sheetsUrlInput) return;

    const url = sheetsUrlInput.value.trim();
    const key = sheetsKeyInput ? sheetsKeyInput.value.trim() : '';

    if (!url) {
      statusEl.textContent = 'Connection Error: Please enter Web App URL';
      statusEl.className = 'connection-status error';
      return;
    }

    // Save values first
    StorageManager.updateSettings({ sheetsUrl: url, sheetsKey: key });

    statusEl.textContent = 'Connecting & Synchronizing...';
    statusEl.className = 'connection-status pending';

    try {
      await StorageManager.syncWithSheets();
      statusEl.textContent = 'Success: Synchronized with Google Sheets';
      statusEl.className = 'connection-status success';
      if (window.App && window.App.showToast) window.App.showToast('Successfully synced Google Sheets!', 'success');
      
      // Force reload overview pages
      DashboardView.onEnter();
    } catch (err) {
      console.error(err);
      statusEl.textContent = `Sync Failed: ${err.message}`;
      statusEl.className = 'connection-status error';
      if (window.App && window.App.showToast) window.App.showToast(`Sheets Sync Failed: ${err.message}`, 'error');
    }
  }

  function handleExport() {
    try {
      const dataStr = StorageManager.exportJSON();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const fileName = `portfolio-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
      
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      link.click();
      
      URL.revokeObjectURL(url);
      
      if (window.App && window.App.showToast) window.App.showToast('Backup generated and downloading', 'success');
    } catch (err) {
      console.error(err);
      if (window.App && window.App.showToast) window.App.showToast('Export failed', 'error');
    }
  }

  function handleImport(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target.result;
        await StorageManager.importJSON(content);
        if (window.App && window.App.showToast) window.App.showToast('Backup database restored successfully!', 'success');
        
        setTimeout(() => {
          Router.navigate('#dashboard');
          window.location.reload();
        }, 1000);
      } catch (err) {
        if (window.App && window.App.showToast) window.App.showToast(`Import failed: ${err.message}`, 'error');
      }
    };
    reader.readAsText(file);
  }

  function handleClearDB() {
    const msg = 'WARNING:\nThis will permanently wipe all local transactions, snapshots, and watchlist records.\nThis action is irreversible.\n\nType "RESET" to confirm:';
    const response = prompt(msg);
    if (response === 'RESET') {
      StorageManager.clearAll();
      WatchlistManager.clearAll();
      if (window.App && window.App.showToast) window.App.showToast('All transaction histories wiped successfully', 'success');
      
      setTimeout(() => {
        Router.navigate('#dashboard');
        window.location.reload();
      }, 1000);
    }
  }

  return {
    onEnter,
    onLeave
  };
})();
