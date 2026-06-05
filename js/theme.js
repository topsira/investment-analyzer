/**
 * Investment Analyzer — Theme Manager
 * Dark/Light theme toggle with localStorage persistence
 */

const ThemeManager = (() => {
  const STORAGE_KEY = 'investment-analyzer-theme';
  const DEFAULT_THEME = 'dark';

  let currentTheme = DEFAULT_THEME;
  let onChangeCallback = null;

  /**
   * Initialize theme from stored preference or default
   */
  function init() {
    const stored = localStorage.getItem(STORAGE_KEY);
    currentTheme = stored || DEFAULT_THEME;
    apply(currentTheme);
    return currentTheme;
  }

  /**
   * Apply theme to the document
   * @param {string} theme - 'dark' or 'light'
   */
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    currentTheme = theme;
    localStorage.setItem(STORAGE_KEY, theme);
    if (onChangeCallback) onChangeCallback(theme);
  }

  /**
   * Toggle between dark and light
   */
  function toggle() {
    apply(currentTheme === 'dark' ? 'light' : 'dark');
    return currentTheme;
  }

  /**
   * Get current theme
   * @returns {string}
   */
  function get() {
    return currentTheme;
  }

  /**
   * Check if dark theme is active
   * @returns {boolean}
   */
  function isDark() {
    return currentTheme === 'dark';
  }

  /**
   * Register a callback for theme changes (used by chart to update colors)
   * @param {Function} callback
   */
  function onChange(callback) {
    onChangeCallback = callback;
  }

  /**
   * Get chart color scheme based on current theme
   * @returns {object}
   */
  function getChartColors() {
    if (currentTheme === 'dark') {
      return {
        background: '#0d1117',
        textColor: '#8b949e',
        gridColor: 'rgba(48, 54, 61, 0.3)',
        crosshairColor: '#6e7681',
        upColor: '#00c853',
        downColor: '#ff1744',
        wickUpColor: '#00c853',
        wickDownColor: '#ff1744',
        volumeUpColor: 'rgba(0, 200, 83, 0.3)',
        volumeDownColor: 'rgba(255, 23, 68, 0.3)',
        sma20Color: '#ffc107',
        sma50Color: '#2196f3',
        sma200Color: '#e040fb',
        bbUpperColor: 'rgba(0, 188, 212, 0.4)',
        bbLowerColor: 'rgba(0, 188, 212, 0.4)',
        bbMiddleColor: 'rgba(0, 188, 212, 0.6)',
        rsiLineColor: '#7c4dff',
        macdLineColor: '#00bcd4',
        macdSignalColor: '#ff9800',
      };
    } else {
      return {
        background: '#ffffff',
        textColor: '#57606a',
        gridColor: 'rgba(208, 215, 222, 0.4)',
        crosshairColor: '#8b949e',
        upColor: '#1b8a3a',
        downColor: '#d32f2f',
        wickUpColor: '#1b8a3a',
        wickDownColor: '#d32f2f',
        volumeUpColor: 'rgba(27, 138, 58, 0.25)',
        volumeDownColor: 'rgba(211, 47, 47, 0.25)',
        sma20Color: '#f57c00',
        sma50Color: '#1565c0',
        sma200Color: '#9c27b0',
        bbUpperColor: 'rgba(0, 150, 170, 0.4)',
        bbLowerColor: 'rgba(0, 150, 170, 0.4)',
        bbMiddleColor: 'rgba(0, 150, 170, 0.6)',
        rsiLineColor: '#6200ea',
        macdLineColor: '#0096aa',
        macdSignalColor: '#e65100',
      };
    }
  }

  return { init, toggle, get, isDark, onChange, getChartColors };
})();
