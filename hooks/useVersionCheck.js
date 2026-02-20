import { useState, useEffect } from 'react';
import { Platform } from 'react-native';
import { checkVersionUpdate, clearVersionCache } from '../services/versionService';
import Constants from 'expo-constants';
import * as Application from 'expo-application';

/**
 * Hook para verificar si la app necesita actualización desde Supabase
 * Usa caché en AsyncStorage para optimizar el rendimiento
 * @returns {object} { needsUpdate: boolean, currentVersion: string|null, isLoading: boolean }
 */
export const useVersionCheck = () => {
  const [needsUpdate, setNeedsUpdate] = useState(false);
  const [currentVersion, setCurrentVersion] = useState(null);
  const [updateUrl, setUpdateUrl] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const verifyVersion = async () => {
      try {
        setIsLoading(true);

        // Obtener versión actual de la app desde app.json (no del SDK)
        const expoConfigVersion = Constants.expoConfig?.version;
        const nativeVersion = Application.nativeApplicationVersion;
        const appVersion = Application.applicationVersion;
        
        // Usar expo-constants primero (lee de app.json), luego fallbacks
        const version = expoConfigVersion || nativeVersion || appVersion || null;

        console.log('🔍 [useVersionCheck] Versión detectada:', {
          expoConfigVersion: expoConfigVersion, // Versión real de app.json
          nativeApplicationVersion: nativeVersion, // Puede ser SDK version
          applicationVersion: appVersion,
          resolvedVersion: version,
          platform: Platform.OS,
        });

        setCurrentVersion(version);

        // Limpiar caché si la versión de la app cambió (para detectar nuevas actualizaciones requeridas)
        const cachedVersion = await require('@react-native-async-storage/async-storage').default.getItem('@losresis:last_app_version');
        const shouldForceRefresh = !cachedVersion || cachedVersion !== version;
        
        if (shouldForceRefresh) {
          console.log('🔄 [useVersionCheck] Versión cambió o primera vez, forzando actualización:', {
            cachedVersion,
            currentVersion: version,
          });
          await clearVersionCache();
          await require('@react-native-async-storage/async-storage').default.setItem('@losresis:last_app_version', version || '');
        }

        // Verificar versión desde Supabase (forzar refresh si la versión cambió)
        const result = await checkVersionUpdate(shouldForceRefresh);

        console.log('📱 [useVersionCheck] Resultado de verificación:', {
          needsUpdate: result.needsUpdate,
          currentVersion: result.currentVersion,
          minVersion: result.minVersion,
          updateUrl: result.updateUrl,
          error: result.error,
          fromCache: result.fromCache,
        });

        if (result.error) {
          console.warn('⚠️ [useVersionCheck] Error verificando versión:', result.error);
          // En caso de error, no mostrar banner (no bloquear la app)
          setNeedsUpdate(false);
          setUpdateUrl(null);
        } else {
          console.log('✅ [useVersionCheck] Estado final:', {
            needsUpdate: result.needsUpdate,
            willShowBanner: result.needsUpdate,
          });
          setNeedsUpdate(result.needsUpdate || false);
          setUpdateUrl(result.updateUrl || null);
        }
      } catch (error) {
        console.error('Error en useVersionCheck:', error);
        setNeedsUpdate(false);
      } finally {
        setIsLoading(false);
      }
    };

    verifyVersion();
  }, []);

  return { needsUpdate, currentVersion, updateUrl, isLoading };
};
