let notificationNavigationHandler = null;
// El push con el que se abrió la app llega antes de que el Dashboard registre su
// handler: se guarda y se le entrega en cuanto lo registra.
let pendingNotificationPayload = null;

export function setNotificationNavigationHandler(handler) {
  notificationNavigationHandler = handler;

  if (handler && pendingNotificationPayload) {
    const data = pendingNotificationPayload;
    pendingNotificationPayload = null;
    handler(data);
  }

  return () => {
    if (notificationNavigationHandler === handler) {
      notificationNavigationHandler = null;
    }
  };
}

export function routeNotificationPayload(data) {
  if (!data) return;
  if (!notificationNavigationHandler) {
    pendingNotificationPayload = data;
    return;
  }
  notificationNavigationHandler(data);
}
