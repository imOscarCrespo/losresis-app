import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../constants/colors";
import {
  getOfferings,
  purchasePackage,
  restorePurchases,
} from "../services/subscriptionService";
import posthogLogger from "../services/posthogService";

/**
 * Paywall sheet shown to hosts that hit the free-tier listing quota.
 * Reads offerings from RevenueCat; on a successful purchase, calls
 * onPurchaseSuccess and dismisses.
 */
export default function PaywallSheet({
  visible,
  userId,
  onClose,
  onPurchaseSuccess,
  source = "create_listing",
}) {
  const [offering, setOffering] = useState(null);
  const [loading, setLoading] = useState(false);
  const [purchasingId, setPurchasingId] = useState(null);
  const [restoring, setRestoring] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!visible) return;
    posthogLogger.capture("paywall_shown", { source });
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      const data = await getOfferings();
      if (cancelled) return;
      setOffering(data?.current ?? null);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, source]);

  const handleClose = () => {
    posthogLogger.capture("paywall_dismissed", { source });
    onClose?.();
  };

  const handlePurchase = async (pkg) => {
    setPurchasingId(pkg.identifier);
    setError(null);
    const result = await purchasePackage(pkg, userId);
    setPurchasingId(null);
    if (result.success) {
      onPurchaseSuccess?.(result);
      onClose?.();
      return;
    }
    if (!result.cancelled) {
      setError(result.error || "Algo salió mal. Inténtalo de nuevo.");
    }
  };

  const handleRestore = async () => {
    setRestoring(true);
    setError(null);
    const result = await restorePurchases(userId);
    setRestoring(false);
    if (result.success && result.active) {
      onPurchaseSuccess?.(result);
      onClose?.();
    } else if (!result.active) {
      setError("No hay compras previas que restaurar.");
    } else {
      setError(result.error || "No se pudieron restaurar las compras.");
    }
  };

  if (!visible) return null;

  const packages = offering?.availablePackages ?? [];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>Publica anuncios ilimitados</Text>
          <Text style={styles.subtitle}>
            Has alcanzado el límite del plan gratuito (1 anuncio activo).
            Suscríbete para publicar tantos anuncios como quieras.
          </Text>

          {loading ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={COLORS.PRIMARY} />
          ) : packages.length === 0 ? (
            <Text style={styles.errorText}>
              No se pudieron cargar los planes. Reabre el paywall o reinicia la app.
            </Text>
          ) : (
            <ScrollView style={{ marginVertical: 12 }}>
              {packages.map((pkg) => {
                const isAnnual = pkg.packageType === "ANNUAL";
                return (
                  <TouchableOpacity
                    key={pkg.identifier}
                    style={[styles.packageCard, isAnnual && styles.packageCardHighlight]}
                    onPress={() => handlePurchase(pkg)}
                    disabled={Boolean(purchasingId)}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.packageTitle}>
                        {pkg.product?.title ?? pkg.identifier}
                      </Text>
                      <Text style={styles.packageDesc}>
                        {pkg.product?.description ?? ""}
                      </Text>
                    </View>
                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.price}>{pkg.product?.priceString ?? ""}</Text>
                      {purchasingId === pkg.identifier && (
                        <ActivityIndicator size="small" color={COLORS.PRIMARY} />
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={styles.restoreButton}
            onPress={handleRestore}
            disabled={restoring}
          >
            <Text style={styles.restoreText}>
              {restoring ? "Restaurando…" : "Restaurar compras"}
            </Text>
          </TouchableOpacity>

          <Text style={styles.legal}>
            La suscripción se renueva automáticamente hasta que la canceles desde tu
            cuenta de la App Store o Google Play.
          </Text>

          <TouchableOpacity style={styles.closeButton} onPress={handleClose}>
            <Text style={styles.closeText}>Ahora no</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.WHITE,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 32,
    maxHeight: "85%",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.GRAY_MEDIUM,
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.GRAY_DARK,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.GRAY,
    textAlign: "center",
    marginTop: 8,
  },
  packageCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.GRAY_LIGHT,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  packageCardHighlight: {
    borderColor: COLORS.PRIMARY,
    backgroundColor: COLORS.PRIMARY_LIGHT,
  },
  packageTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.GRAY_DARK,
  },
  packageDesc: {
    fontSize: 13,
    color: COLORS.GRAY,
    marginTop: 2,
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.PRIMARY,
  },
  restoreButton: {
    alignSelf: "center",
    paddingVertical: 8,
    marginTop: 4,
  },
  restoreText: {
    color: COLORS.PRIMARY,
    fontSize: 14,
    fontWeight: "600",
  },
  legal: {
    fontSize: 11,
    color: COLORS.GRAY,
    textAlign: "center",
    marginTop: 12,
  },
  closeButton: {
    alignSelf: "center",
    paddingVertical: 10,
    marginTop: 8,
  },
  closeText: {
    color: COLORS.GRAY,
    fontSize: 14,
  },
  errorText: {
    color: COLORS.ERROR,
    fontSize: 13,
    textAlign: "center",
    marginVertical: 8,
  },
});
