/**
 * Investment Analyzer / Portfolio Manager — SPA Router
 * Hash-based routing to toggle between tabs and run lifecycle hooks
 */

const Router = (() => {
  const routes = {};
  let currentRoute = null;

  function register(route, options = {}) {
    // options: { sectionId, onEnter, onLeave }
    routes[route] = {
      sectionId: options.sectionId,
      onEnter: options.onEnter || null,
      onLeave: options.onLeave || null
    };
  }

  function handleRoute() {
    const hash = window.location.hash || '#dashboard';
    const activeRoute = routes[hash] ? hash : '#dashboard';

    // If route didn't change, do nothing (unless it's initial page load)
    if (currentRoute === activeRoute) return;

    const oldRoute = currentRoute;
    currentRoute = activeRoute;

    // Call onLeave for previous route
    if (oldRoute && routes[oldRoute] && routes[oldRoute].onLeave) {
      try {
        routes[oldRoute].onLeave();
      } catch (err) {
        console.error(`Error in onLeave for ${oldRoute}:`, err);
      }
    }

    // Update URL hash if it's different
    if (window.location.hash !== activeRoute) {
      window.location.hash = activeRoute;
      return; // hashchange event will trigger handleRoute again
    }

    // Toggle DOM sections
    Object.keys(routes).forEach(r => {
      const section = document.getElementById(routes[r].sectionId);
      if (section) {
        if (r === activeRoute) {
          section.classList.add('active');
        } else {
          section.classList.remove('active');
        }
      }
    });

    // Update navigation active states
    document.querySelectorAll('.bottom-nav__item').forEach(item => {
      const href = item.getAttribute('href');
      if (href === activeRoute) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    // Scroll to top of the content
    window.scrollTo({ top: 0, behavior: 'instant' });

    // Call onEnter for new route
    if (routes[activeRoute] && routes[activeRoute].onEnter) {
      try {
        routes[activeRoute].onEnter();
      } catch (err) {
        console.error(`Error in onEnter for ${activeRoute}:`, err);
      }
    }
  }

  function init() {
    window.addEventListener('hashchange', handleRoute);
    handleRoute();
  }

  function navigate(route) {
    window.location.hash = route;
  }

  function getCurrentRoute() {
    return currentRoute;
  }

  return {
    register,
    init,
    navigate,
    getCurrentRoute
  };
})();
