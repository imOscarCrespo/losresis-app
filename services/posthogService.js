/**
 * Servicio de PostHog para tracking de analytics
 * Maneja la inicialización y el registro de eventos de pantallas
 * Incluye soporte para Session Replay para capturar videos de sesiones de usuario
 */

import PostHog from "posthog-react-native";

class PostHogLogger {
  constructor() {
    this.posthog = null;
    this.isInitialized = false;
  }

  /**
   * Inicializa PostHog con las credenciales proporcionadas
   * Debe ser llamado una vez al inicio de la aplicación
   */
  initialize() {
    if (this.isInitialized) {
      console.warn("PostHog ya está inicializado");
      return;
    }

    try {
      this.posthog = new PostHog(
        "phc_FNmlb2xye4Wpq4weZyRWRynMV7lgivEnZcmk4X69XVA",
        {
          host: "https://eu.i.posthog.com",
          // Opciones adicionales para mejor tracking
          enableSessionReplay: true, // Habilitado para capturar videos de sesión
          captureApplicationLifecycleEvents: true,
          captureDeepLinks: true,
          // Modo debug para diagnosticar problemas (puedes desactivarlo en producción)
          debug: __DEV__, // Solo en modo desarrollo
          // Configuración específica de Session Replay
          sessionReplayConfig: {
            // Enmascarar inputs de texto por privacidad (ajustar según necesidades)
            maskAllTextInputs: true,
            // Enmascarar imágenes por privacidad (ajustar según necesidades)
            maskAllImages: false,
            // Enmascarar vistas sandboxed
            maskAllSandboxedViews: true,
            // Capturar logs de la consola
            captureLog: true,
            // Capturar telemetría de red
            captureNetworkTelemetry: true,
            // Delay entre capturas para optimizar rendimiento (ms)
            throttleDelayMs: 1000,
          },
        }
      );

      this.isInitialized = true;
      console.log("✅ PostHog inicializado correctamente");
      console.log("📹 Session Replay habilitado con configuración:", {
        maskAllTextInputs: true,
        maskAllImages: false,
        captureLog: true,
        captureNetworkTelemetry: true,
      });
    } catch (error) {
      console.error("❌ Error al inicializar PostHog:", error);
      console.error(
        "💡 Asegúrate de que 'posthog-react-native-session-replay' esté instalado"
      );
    }
  }

  /**
   * Registra que el usuario ha entrado en una pantalla
   * @param {string} screenName - Nombre de la pantalla
   * @param {object} properties - Propiedades adicionales opcionales
   */
  logScreen(screenName, properties = {}) {
    if (!this.isInitialized || !this.posthog) {
      console.warn(
        "PostHog no está inicializado. No se puede registrar la pantalla:",
        screenName
      );
      return;
    }

    try {
      this.posthog.screen(screenName, {
        ...properties,
        timestamp: new Date().toISOString(),
      });
      // console.log(`📊 PostHog: Pantalla registrada - ${screenName}`);
    } catch (error) {
      console.error("❌ Error al registrar pantalla en PostHog:", error);
    }
  }

  /**
   * Registra un evento personalizado
   * @param {string} eventName - Nombre del evento
   * @param {object} properties - Propiedades del evento
   */
  capture(eventName, properties = {}) {
    if (!this.isInitialized || !this.posthog) {
      console.warn(
        "PostHog no está inicializado. No se puede capturar el evento:",
        eventName
      );
      return;
    }

    try {
      this.posthog.capture(eventName, properties);
      // console.log(`📊 PostHog: Evento capturado - ${eventName}`);
    } catch (error) {
      console.error("❌ Error al capturar evento en PostHog:", error);
    }
  }

  /**
   * Identifica al usuario con un ID único
   * @param {string} userId - ID único del usuario
   * @param {object} properties - Propiedades del usuario
   */
  identify(userId, properties = {}) {
    if (!this.isInitialized || !this.posthog) {
      console.warn(
        "PostHog no está inicializado. No se puede identificar al usuario"
      );
      return;
    }

    try {
      this.posthog.identify(userId, properties);
      // console.log(`📊 PostHog: Usuario identificado - ${userId}`);
    } catch (error) {
      console.error("❌ Error al identificar usuario en PostHog:", error);
    }
  }

  /**
   * Resetea la identificación del usuario (útil para logout)
   */
  reset() {
    if (!this.isInitialized || !this.posthog) {
      return;
    }

    try {
      this.posthog.reset();
      // console.log("📊 PostHog: Usuario reseteado");
    } catch (error) {
      console.error("❌ Error al resetear PostHog:", error);
    }
  }
}

// Exportar una instancia singleton
export default new PostHogLogger();
