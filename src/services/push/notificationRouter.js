let notificationNavigationHandler = null;

export function setNotificationNavigationHandler(handler) {
  notificationNavigationHandler = handler;

  return () => {
    if (notificationNavigationHandler === handler) {
      notificationNavigationHandler = null;
    }
  };
}

export function routeNotificationPayload(data) {
  if (!notificationNavigationHandler || !data) return;
  notificationNavigationHandler(data);
}
