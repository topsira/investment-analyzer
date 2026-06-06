/**
 * Investment Portfolio Manager / PortPro — Main Controller
 * Bootstraps all storage, watchlist, theme, router, and views
 */

const App = (() => {

  const DOM = {};

  function init() {
    DOM.toastContainer = document.getElementById('toast-container');
    DOM.headerThemeToggle = document.getElementById('theme-toggle');

    // Init Theme Manager
    ThemeManager.init();

    // Listen to theme alterations to adjust colors in views and charts
    ThemeManager.onChange(() => {
      ChartModule.updateTheme();

      const activeRoute = Router.getCurrentRoute();
      if (activeRoute === '#dashboard') {
        DashboardView.onEnter();
      } else if (activeRoute === '#analysis') {
        AnalysisView.onEnter();
      } else if (activeRoute === '#analytics') {
        AnalyticsView.onEnter();
      } else if (activeRoute === '#markets') {
        MarketsView.onEnter();
      }
    });

    if (DOM.headerThemeToggle) {
      DOM.headerThemeToggle.addEventListener('click', () => ThemeManager.toggle());
    }

    // Init Watchlist horizontal container
    const watchlistEl = document.getElementById('watchlist');
    if (watchlistEl) {
      WatchlistManager.init(watchlistEl, (symbol) => {
        // Trigger load if user selects from horizontal watchlist pill on technical analysis tab
        if (Router.getCurrentRoute() === '#analysis') {
          AnalysisView.loadAsset(symbol);
        }
      });
    }

    // Initialize Storage (loads local + option sheets connection)
    StorageManager.init().then(() => {

      // Register SPA Routing sections
      Router.register('#dashboard', {
        sectionId: 'dashboard-tab',
        onEnter: () => DashboardView.onEnter(),
        onLeave: () => DashboardView.onLeave()
      });

      Router.register('#analysis', {
        sectionId: 'analysis-tab',
        onEnter: () => AnalysisView.onEnter(),
        onLeave: () => AnalysisView.onLeave()
      });

      Router.register('#markets', {
        sectionId: 'markets-tab',
        onEnter: () => MarketsView.onEnter(),
        onLeave: () => MarketsView.onLeave()
      });

      Router.register('#transactions', {
        sectionId: 'transactions-tab',
        onEnter: () => TransactionsView.onEnter(),
        onLeave: () => TransactionsView.onLeave()
      });

      Router.register('#analytics', {
        sectionId: 'analytics-tab',
        onEnter: () => AnalyticsView.onEnter(),
        onLeave: () => AnalyticsView.onLeave()
      });

      Router.register('#settings', {
        sectionId: 'settings-tab',
        onEnter: () => SettingsView.onEnter(),
        onLeave: () => SettingsView.onLeave()
      });

      // Launch router navigation listener
      Router.init();

      // Background watchlist prices loader
      WatchlistManager.updateAllWatchlistPrices();
    });
  }

  /**
   * Displays floating alert notifications in the bottom right corner
   * @param {string} message - Text payload
   * @param {string} type - 'info' | 'success' | 'error'
   */
  function showToast(message, type = 'info') {
    if (!DOM.toastContainer) DOM.toastContainer = document.getElementById('toast-container');
    if (!DOM.toastContainer) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span>${message}</span>
      <button class="toast__close" onclick="this.parentElement.remove()">✕</button>
    `;

    DOM.toastContainer.appendChild(toast);

    // Auto-destruct after 4.5 seconds
    setTimeout(() => {
      if (toast.parentElement) {
        toast.style.opacity = '0';
        toast.style.transform = 'translateY(16px)';
        setTimeout(() => toast.remove(), 300);
      }
    }, 4500);
  }

  // DOM Bootstrapping trigger
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  const publicApi = { showToast };
  window.App = publicApi;

  return publicApi;
})();
