import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Share,
  Modal,
  Pressable,
} from "react-native";
import { Icon } from "../components/Icon";
import * as Clipboard from "expo-clipboard";
import { KeyboardAwareScrollView } from "../components/KeyboardAwareScrollView";
import { KeyboardAwareTextInput } from "../components/KeyboardAwareTextInput";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { Button } from "../components/Button";
import { ProfileHeaderAvatar } from "../components/ProfileHeaderAvatar";
import { useEmailReviewStatus } from "../hooks/useEmailReviewStatus";
import { signOut, getCurrentUser } from "../services/authService";
import { deleteUserAccount } from "../services/userService";
import {
  getActiveRaffle,
  checkReferralAlreadyApplied,
  applyReferralCode,
} from "../services/referralService";
import {
  isBiometricEnabled,
  setBiometricEnabled,
  checkBiometricAvailability,
} from "../services/biometricService";
import { getResidentConnectionCount } from "../services/connectionsService";
import { getMyFeedStats } from "../services/feedService";
import {
  getHospitalByIdFromCatalog,
  getSpecialityByIdFromCatalog,
} from "../services/staticCatalogService";
import { MOCK_SOURCES } from "../services/mirProjectionService";
import { COLORS } from "../constants/colors";
import { formatResidentTransitionDeadline } from "../utils/residentAccess";
import {
  getProfileRoleLine,
  getProfileStatusChip,
  shouldShowConnectionsLine,
} from "../utils/profileHeader";
import posthogLogger from "../services/posthogService";
import Constants from "expo-constants";

const CHIP_TONES = {
  pending: {
    bg: "#FEF3C7",
    border: "#FCD34D",
    text: "#B45309",
    icon: "#D97706",
  },
  danger: { bg: "#FEE2E2", border: "#FCA5A5", text: "#B91C1C", icon: "#DC2626" },
  info: { bg: "#DBEAFE", border: "#BFDBFE", text: "#1D4ED8", icon: "#2563EB" },
  warning: {
    bg: "#FFEDD5",
    border: "#FDBA74",
    text: "#C2410C",
    icon: "#EA580C",
  },
};

export default function ProfileScreen({
  userProfile,
  onSignOut,
  onProfileUpdated,
  onSectionChange,
}) {
  const userId = userProfile?.id || null;

  const { request: emailReviewRequest } = useEmailReviewStatus(userId);

  // Biometría
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricType, setBiometricType] = useState(null);
  const [loadingBiometric, setLoadingBiometric] = useState(false);

  // Conexiones (solo residentes)
  const [connectionCount, setConnectionCount] = useState(null);

  // Métricas de feed (solo residentes): publicaciones propias y Chapós recibidos.
  const [feedStats, setFeedStats] = useState(null);

  // Referido
  const FIVE_MINUTES_MS = 5 * 60 * 1000;
  const userCreatedAtRaw = userProfile?.created_at;
  const userCreatedAtMs = userCreatedAtRaw
    ? new Date(userCreatedAtRaw).getTime()
    : NaN;
  const showReferralApplySection =
    !Number.isNaN(userCreatedAtMs) &&
    Date.now() - userCreatedAtMs < FIVE_MINUTES_MS;

  const [referralCodeInput, setReferralCodeInput] = useState("");
  const [applyingReferralCode, setApplyingReferralCode] = useState(false);
  const [referralApplyMessage, setReferralApplyMessage] = useState(null);
  const [activeRaffle, setActiveRaffle] = useState(null);
  const [loadingActiveRaffle, setLoadingActiveRaffle] = useState(false);
  const [referralAlreadyApplied, setReferralAlreadyApplied] = useState(false);
  const [showReferralCodeModal, setShowReferralCodeModal] = useState(false);

  useEffect(() => {
    posthogLogger.logScreen("ProfileScreen");
  }, []);

  useEffect(() => {
    const loadBiometricState = async () => {
      const enabled = await isBiometricEnabled();
      setBiometricEnabledState(enabled);
      const availability = await checkBiometricAvailability();
      setBiometricAvailable(availability.available);
      setBiometricType(availability.type);
    };
    loadBiometricState();
  }, []);

  useEffect(() => {
    let cancelled = false;
    if (!shouldShowConnectionsLine(userProfile)) {
      setConnectionCount(null);
      return;
    }
    const loadCount = async () => {
      const { success, count } = await getResidentConnectionCount();
      if (!cancelled && success) {
        setConnectionCount(count);
      }
    };
    const loadStats = async () => {
      const { success, postsCount, chaposReceived } = await getMyFeedStats();
      if (!cancelled && success) {
        setFeedStats({ postsCount, chaposReceived });
      }
    };
    loadCount();
    loadStats();
    return () => {
      cancelled = true;
    };
  }, [userProfile?.is_resident, userId]);

  useEffect(() => {
    if (!showReferralApplySection || !userId) return;

    const run = async () => {
      setLoadingActiveRaffle(true);
      try {
        const { success, raffle, error: raffleError } = await getActiveRaffle();
        if (raffleError || !success) {
          setActiveRaffle(null);
          setLoadingActiveRaffle(false);
          return;
        }
        setActiveRaffle(raffle ?? null);
        if (raffle) {
          const { alreadyApplied } = await checkReferralAlreadyApplied(
            raffle.id,
            userId
          );
          setReferralAlreadyApplied(alreadyApplied);
        }
      } finally {
        setLoadingActiveRaffle(false);
      }
    };
    run();
  }, [showReferralApplySection, userId]);

  const handleBiometricToggle = async () => {
    if (!biometricAvailable) {
      Alert.alert(
        "Biometría no disponible",
        "Tu dispositivo no soporta autenticación biométrica o no está configurada."
      );
      return;
    }

    setLoadingBiometric(true);
    try {
      const newValue = !biometricEnabled;
      const result = await setBiometricEnabled(newValue);
      if (result.success) {
        setBiometricEnabledState(newValue);
        Alert.alert(
          newValue ? "Biometría activada" : "Biometría desactivada",
          newValue
            ? "Ahora podrás usar Face ID/Touch ID para iniciar sesión rápidamente."
            : "Ya no se usará biometría para iniciar sesión."
        );
      } else {
        Alert.alert(
          "Error",
          result.error || "No se pudo cambiar el estado de la biometría."
        );
      }
    } catch (error) {
      Alert.alert(
        "Error",
        error.message || "Ocurrió un error al cambiar la configuración."
      );
    } finally {
      setLoadingBiometric(false);
    }
  };

  const handleShareReferralCode = async () => {
    const code = userProfile?.referral_code;
    if (!code) return;
    try {
      await Share.share({ message: code, title: "Mi código de referido" });
    } catch (err) {
      if (err.message !== "User did not share") {
        console.error("Error sharing referral code:", err);
      }
    }
  };

  const handleCopyReferralCode = async () => {
    const code = userProfile?.referral_code;
    if (!code) return;
    try {
      await Clipboard.setStringAsync(code);
      Alert.alert("Código copiado", "Tu código promocional se ha copiado.");
    } catch (error) {
      console.error("Error copying referral code:", error);
      Alert.alert("Error", "No se pudo copiar el código. Inténtalo de nuevo.");
    }
  };

  const handleApplyReferralCode = async () => {
    const normalized = referralCodeInput.trim().toUpperCase();
    const formatOk = /^[A-Z]{5}$/.test(normalized);
    if (!formatOk) {
      setReferralApplyMessage({
        type: "error",
        text: "El código debe tener exactamente 5 letras mayúsculas.",
      });
      return;
    }

    if (!userId) return;

    if (!activeRaffle) {
      setReferralApplyMessage({
        type: "error",
        text: "No hay ninguna promoción activa en este momento.",
      });
      return;
    }

    setApplyingReferralCode(true);
    setReferralApplyMessage(null);

    try {
      const { success, error } = await applyReferralCode(
        userId,
        normalized,
        activeRaffle
      );

      if (!success) {
        setReferralApplyMessage({
          type: "error",
          text: error || "Error al aplicar el código. Inténtalo de nuevo.",
        });
        setApplyingReferralCode(false);
        return;
      }

      setReferralApplyMessage({
        type: "success",
        text: "¡Código aplicado correctamente! Ya participas en la promoción.",
      });
      setReferralCodeInput("");
      setReferralAlreadyApplied(true);
    } catch (err) {
      console.error("Error applying referral code:", err);
      setReferralApplyMessage({
        type: "error",
        text: "Error inesperado. Inténtalo de nuevo.",
      });
    } finally {
      setApplyingReferralCode(false);
    }
  };

  const handleSignOut = async () => {
    Alert.alert("Cerrar Sesión", "¿Estás seguro de que quieres cerrar sesión?", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Cerrar Sesión",
        style: "destructive",
        onPress: async () => {
          try {
            const { success, error } = await signOut();
            if (!success) {
              Alert.alert(
                "Error",
                error || "No se pudo cerrar sesión. Inténtalo de nuevo."
              );
              return;
            }
            if (onSignOut) {
              await onSignOut();
            }
          } catch (error) {
            console.error("Error al cerrar sesión:", error);
            Alert.alert("Error", "Error al cerrar sesión. Inténtalo de nuevo.");
          }
        },
      },
    ]);
  };

  const handleDeleteAccount = async () => {
    Alert.alert(
      "Eliminar Cuenta",
      "¿Estás seguro de que quieres eliminar tu cuenta? Esta acción no se puede deshacer y se eliminarán todos tus datos.",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            try {
              const { success: userSuccess, user: currentUser } =
                await getCurrentUser();
              if (!userSuccess || !currentUser?.id) {
                Alert.alert(
                  "Error",
                  "No se pudo obtener la información del usuario."
                );
                return;
              }

              const { success, error } = await deleteUserAccount(currentUser.id);
              if (!success) {
                Alert.alert(
                  "Error",
                  error || "No se pudo eliminar la cuenta. Inténtalo de nuevo."
                );
                return;
              }

              const { success: signOutSuccess, error: signOutError } =
                await signOut();
              if (!signOutSuccess) {
                console.error(
                  "Error al cerrar sesión después de eliminar:",
                  signOutError
                );
              }
              if (onSignOut) {
                await onSignOut();
              }
            } catch (error) {
              console.error("Error al eliminar cuenta:", error);
              Alert.alert(
                "Error",
                "Error al eliminar la cuenta. Inténtalo de nuevo."
              );
            }
          },
        },
      ]
    );
  };

  const fullName = useMemo(() => {
    const parts = [userProfile?.name, userProfile?.surname]
      .map((p) => (p || "").trim())
      .filter(Boolean);
    return parts.join(" ") || "Tu perfil";
  }, [userProfile?.name, userProfile?.surname]);

  const roleLine = useMemo(() => {
    if (!userProfile) return "";
    const specialityName = getSpecialityByIdFromCatalog(
      userProfile.speciality_id
    )?.name;
    const hospitalName = getHospitalByIdFromCatalog(userProfile.hospital_id)?.name;
    const academyName = MOCK_SOURCES.find(
      (s) => s.id === userProfile.mir_academy
    )?.name;
    return getProfileRoleLine(userProfile, {
      specialityName,
      hospitalName,
      academyName,
    });
  }, [
    userProfile?.speciality_id,
    userProfile?.hospital_id,
    userProfile?.mir_academy,
    userProfile?.resident_year,
    userProfile?.is_resident,
    userProfile?.is_doctor,
    userProfile?.is_student,
    userProfile?.is_host,
  ]);

  const statusChip = useMemo(
    () =>
      getProfileStatusChip(userProfile, emailReviewRequest, {
        deadlineLabel: formatResidentTransitionDeadline(
          userProfile?.resident_transition_expires_at
        ),
      }),
    [userProfile, emailReviewRequest]
  );

  const showConnections = shouldShowConnectionsLine(userProfile);

  if (!userProfile) {
    return (
      <View style={styles.loadingScreen}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.PRIMARY} />
          <Text style={styles.loadingText}>Cargando perfil...</Text>
        </View>
      </View>
    );
  }

  const handleStatusChipPress = () => {
    if (!statusChip?.actionable) return;
    onSectionChange?.("profileEdit", { autoFocusWorkEmail: true });
  };

  const tone = statusChip ? CHIP_TONES[statusChip.tone] || CHIP_TONES.pending : null;

  return (
    <HeroScreenLayout
      containerStyle={styles.safeArea}
      title="Mi perfil"
      contentStyle={styles.contentSurface}
      headerStyle={styles.heroHeader}
    >
      <KeyboardAwareScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollViewContent}
        bottomPadding={32}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.contentInner}>
          {/* Cabecera tipo LinkedIn */}
          <View style={styles.headerCard}>
            <ProfileHeaderAvatar
              userId={userId}
              avatarUrl={userProfile?.avatar_url}
              onAvatarUpdated={() => onProfileUpdated?.()}
            />

            <Text style={styles.fullName}>{fullName}</Text>

            {statusChip ? (
              <TouchableOpacity
                activeOpacity={statusChip.actionable ? 0.7 : 1}
                disabled={!statusChip.actionable}
                onPress={handleStatusChipPress}
                style={[
                  styles.statusChip,
                  { backgroundColor: tone.bg, borderColor: tone.border },
                ]}
              >
                <Icon name={statusChip.icon} size={15} color={tone.icon} />
                <Text style={[styles.statusChipText, { color: tone.text }]}>
                  {statusChip.label}
                </Text>
                {statusChip.actionable ? (
                  <Icon name="chevron-forward" size={14} color={tone.icon} />
                ) : null}
              </TouchableOpacity>
            ) : null}

            {roleLine ? <Text style={styles.roleLine}>{roleLine}</Text> : null}

            {showConnections ? (
              <View style={styles.metricsRow}>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => onSectionChange?.("myConnections")}
                  style={styles.metric}
                >
                  <Text style={styles.metricValue}>
                    {connectionCount ?? "—"}
                  </Text>
                  <Text style={styles.metricLabel}>
                    {connectionCount === 1 ? "conexión" : "conexiones"}
                  </Text>
                </TouchableOpacity>

                <View style={styles.metricDivider} />

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => onSectionChange?.("myPosts")}
                  style={styles.metric}
                >
                  <Text style={styles.metricValue}>
                    {feedStats?.postsCount ?? "—"}
                  </Text>
                  <Text style={styles.metricLabel}>
                    {feedStats?.postsCount === 1
                      ? "publicación"
                      : "publicaciones"}
                  </Text>
                </TouchableOpacity>

                <View style={styles.metricDivider} />

                <View style={styles.metric}>
                  <Text style={styles.metricValue}>
                    {feedStats?.chaposReceived ?? "—"}
                  </Text>
                  <Text style={styles.metricLabel}>
                    {feedStats?.chaposReceived === 1 ? "Chapó" : "Chapós"}
                  </Text>
                </View>
              </View>
            ) : null}

            <Button
              title="Editar perfil"
              onPress={() => onSectionChange?.("profileEdit")}
              variant="primary"
              style={styles.editButton}
            />
          </View>

          {/* Aplicar código de referido (solo recién registrados) */}
          {showReferralApplySection && (loadingActiveRaffle || activeRaffle) && (
            <View style={styles.referralSection}>
              <Text style={styles.referralSectionTitle}>
                ¿Tienes un código de quien te invitó?
              </Text>
              <Text style={styles.referralSectionHint}>
                Introduce el código de 5 letras para participar en la promoción
                actual.
              </Text>
              {loadingActiveRaffle ? (
                <View style={styles.referralLoadingRow}>
                  <ActivityIndicator size="small" color={COLORS.PRIMARY} />
                  <Text style={styles.referralLoadingText}>
                    Cargando promociones...
                  </Text>
                </View>
              ) : referralAlreadyApplied ? (
                <View style={styles.referralSuccessRow}>
                  <Icon name="checkmark-circle" size={22} color="#047857" />
                  <Text style={styles.referralSuccessText}>
                    Ya has aplicado un código para esta promoción.
                  </Text>
                </View>
              ) : (
                <View style={styles.referralInputRow}>
                  <View style={styles.referralInputContainer}>
                    <KeyboardAwareTextInput
                      style={styles.referralCodeInput}
                      placeholder="ABCDE"
                      placeholderTextColor="#94A3B8"
                      value={referralCodeInput}
                      onChangeText={(text) =>
                        setReferralCodeInput(
                          text
                            .replace(/[^A-Za-z]/g, "")
                            .toUpperCase()
                            .slice(0, 5)
                        )
                      }
                      maxLength={5}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      editable={!applyingReferralCode}
                      keyboardAwareOptions={{ extraScrollSpace: 36 }}
                    />
                  </View>
                  <Button
                    title={applyingReferralCode ? "Aplicando..." : "Aplicar código"}
                    onPress={handleApplyReferralCode}
                    loading={applyingReferralCode}
                    disabled={
                      applyingReferralCode ||
                      referralCodeInput.trim().length !== 5
                    }
                    variant="primary"
                    style={styles.referralApplyButton}
                  />
                </View>
              )}
              {referralApplyMessage && (
                <View
                  style={[
                    styles.messageContainer,
                    referralApplyMessage.type === "success"
                      ? styles.messageSuccess
                      : styles.messageError,
                  ]}
                >
                  <Text
                    style={[
                      styles.messageText,
                      referralApplyMessage.type === "success"
                        ? styles.messageTextSuccess
                        : styles.messageTextError,
                    ]}
                  >
                    {referralApplyMessage.text}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Ajustes */}
          <View style={styles.settingsCard}>
            <View style={styles.securityOption}>
              <View style={styles.securityOptionContent}>
                <Icon
                  name={
                    biometricType === "Face ID" ? "lock-closed" : "finger-print"
                  }
                  size={24}
                  color={biometricAvailable ? COLORS.PRIMARY : COLORS.TEXT_LIGHT}
                  style={styles.securityIcon}
                />
                <View style={styles.securityTextContainer}>
                  <Text style={styles.securityTitle}>
                    {biometricType || "Autenticación biométrica"}
                  </Text>
                  <Text style={styles.securityDescription}>
                    {biometricAvailable
                      ? "Inicia sesión rápidamente usando tu " +
                        (biometricType || "biometría") +
                        " sin introducir tus credenciales cada vez."
                      : "Tu dispositivo no soporta autenticación biométrica o no está configurada."}
                  </Text>
                </View>
              </View>
              <TouchableOpacity
                onPress={handleBiometricToggle}
                disabled={!biometricAvailable || loadingBiometric}
                style={[
                  styles.toggleSwitch,
                  biometricEnabled && styles.toggleSwitchActive,
                  (!biometricAvailable || loadingBiometric) &&
                    styles.toggleSwitchDisabled,
                ]}
              >
                {loadingBiometric ? (
                  <ActivityIndicator size="small" color={COLORS.WHITE} />
                ) : (
                  <View
                    style={[
                      styles.toggleCircle,
                      biometricEnabled && styles.toggleCircleActive,
                    ]}
                  />
                )}
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => onSectionChange?.("notificationSettings")}
              activeOpacity={0.7}
            >
              <View style={styles.settingsRowContent}>
                <Icon
                  name="notifications-outline"
                  size={24}
                  color={COLORS.PRIMARY}
                  style={styles.securityIcon}
                />
                <Text style={styles.settingsRowTitle}>Notificaciones</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={COLORS.TEXT_LIGHT} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => setShowReferralCodeModal(true)}
              activeOpacity={0.7}
            >
              <View style={styles.settingsRowContent}>
                <Icon
                  name="gift-outline"
                  size={24}
                  color={COLORS.PRIMARY}
                  style={styles.securityIcon}
                />
                <Text style={styles.settingsRowTitle}>Código promocional</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={COLORS.TEXT_LIGHT} />
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.settingsRow}
              onPress={() => onSectionChange?.("contacto")}
              activeOpacity={0.7}
            >
              <View style={styles.settingsRowContent}>
                <Icon
                  name="mail-outline"
                  size={24}
                  color={COLORS.PRIMARY}
                  style={styles.securityIcon}
                />
                <Text style={styles.settingsRowTitle}>Contacto</Text>
              </View>
              <Icon name="chevron-forward" size={20} color={COLORS.TEXT_LIGHT} />
            </TouchableOpacity>
          </View>

          {/* Cuenta */}
          <View style={styles.actionsContainer}>
            <Button
              title="Cerrar sesión"
              onPress={handleSignOut}
              variant="secondary"
              style={styles.signOutButton}
            />
            <Button
              title="Eliminar cuenta"
              onPress={handleDeleteAccount}
              variant="secondary"
              style={styles.deleteAccountButton}
              textStyle={styles.deleteAccountButtonText}
            />
          </View>

          <View style={styles.versionContainer}>
            <Text style={styles.versionText}>
              Versión {Constants.expoConfig?.version || "N/A"}
            </Text>
          </View>
        </View>
      </KeyboardAwareScrollView>

      <Modal
        visible={showReferralCodeModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowReferralCodeModal(false)}
      >
        <Pressable
          style={styles.referralModalOverlay}
          onPress={() => setShowReferralCodeModal(false)}
        >
          <Pressable
            style={styles.referralModalSheet}
            onPress={(event) => event.stopPropagation()}
          >
            <View style={styles.referralModalHandle} />
            <View style={styles.referralModalHeader}>
              <View>
                <Text style={styles.referralModalTitle}>Código promocional</Text>
                <Text style={styles.referralModalSubtitle}>
                  Compártelo o cópialo cuando quieras.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowReferralCodeModal(false)}
                activeOpacity={0.7}
                style={styles.referralModalCloseButton}
              >
                <Icon name="close" size={20} color="#64748B" />
              </TouchableOpacity>
            </View>

            {userProfile?.referral_code ? (
              <>
                <View style={styles.referralCodeCard}>
                  <Text style={styles.referralCodeLabel}>Tu código</Text>
                  <Text style={styles.referralCodeValue}>
                    {userProfile.referral_code}
                  </Text>
                </View>
                <View style={styles.referralModalActions}>
                  <Button
                    title="Copiar código"
                    onPress={handleCopyReferralCode}
                    variant="primary"
                    style={styles.referralModalPrimaryButton}
                  />
                  <Button
                    title="Compartir"
                    onPress={handleShareReferralCode}
                    variant="secondary"
                    style={styles.referralModalSecondaryButton}
                  />
                </View>
              </>
            ) : (
              <View style={styles.referralEmptyCard}>
                <Icon name="gift-outline" size={24} color={COLORS.PRIMARY} />
                <Text style={styles.referralEmptyTitle}>
                  Tu código todavía no está disponible
                </Text>
                <Text style={styles.referralEmptyText}>
                  En cuanto lo tengamos listo, aparecerá aquí para que puedas
                  copiarlo o compartirlo.
                </Text>
              </View>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  heroHeader: {
    marginBottom: 0,
  },
  contentSurface: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  scrollView: {
    flex: 1,
  },
  scrollViewContent: {
    paddingBottom: 32,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 16,
  },
  loadingScreen: {
    flex: 1,
    backgroundColor: "#F8F9FE",
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 14,
    fontSize: 15,
    color: "#64748B",
    fontWeight: "600",
  },
  headerCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: "#E8EAF3",
    alignItems: "center",
  },
  fullName: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1B0977",
    marginTop: 14,
    textAlign: "center",
  },
  statusChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    marginTop: 12,
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: "700",
    flexShrink: 1,
  },
  roleLine: {
    fontSize: 15,
    fontWeight: "600",
    color: "#475569",
    marginTop: 12,
    textAlign: "center",
    lineHeight: 21,
  },
  metricsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "stretch",
    marginTop: 16,
  },
  metric: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 4,
  },
  metricDivider: {
    width: 1,
    alignSelf: "stretch",
    marginVertical: 4,
    backgroundColor: "#E8EAF3",
  },
  metricValue: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1B0977",
  },
  metricLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },
  editButton: {
    marginTop: 18,
    alignSelf: "stretch",
  },
  settingsCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8EAF3",
    gap: 12,
  },
  securityOption: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
  },
  securityOptionContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
  },
  securityIcon: {
    marginRight: 12,
  },
  securityTextContainer: {
    flex: 1,
  },
  securityTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B0977",
    marginBottom: 4,
  },
  securityDescription: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
  },
  settingsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    backgroundColor: "#F8FAFC",
    borderRadius: 18,
  },
  settingsRowContent: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  settingsRowTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B0977",
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E5E5EA",
    justifyContent: "center",
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: COLORS.PRIMARY,
  },
  toggleSwitchDisabled: {
    opacity: 0.5,
  },
  toggleCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  toggleCircleActive: {
    transform: [{ translateX: 20 }],
  },
  actionsContainer: {
    marginTop: 4,
    gap: 12,
  },
  signOutButton: {
    flex: 1,
  },
  deleteAccountButton: {
    flex: 1,
    backgroundColor: "#DC2626",
  },
  deleteAccountButtonText: {
    color: "#FFFFFF",
  },
  versionContainer: {
    alignItems: "center",
    paddingVertical: 20,
    marginTop: 8,
  },
  versionText: {
    fontSize: 11,
    color: "#8E8E93",
    fontWeight: "400",
  },
  referralSection: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 20,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  referralSectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 8,
  },
  referralSectionHint: {
    fontSize: 13,
    color: "#64748B",
    marginBottom: 16,
    lineHeight: 20,
  },
  referralLoadingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 8,
  },
  referralLoadingText: {
    fontSize: 14,
    color: "#64748B",
  },
  referralSuccessRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  referralSuccessText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#047857",
  },
  referralInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  referralInputContainer: {
    flex: 1,
    minWidth: 100,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  referralCodeInput: {
    paddingVertical: 14,
    fontSize: 18,
    fontWeight: "700",
    color: "#1B0977",
    letterSpacing: 4,
  },
  referralApplyButton: {
    minWidth: 140,
  },
  messageContainer: {
    padding: 16,
    borderRadius: 18,
    marginTop: 16,
  },
  messageSuccess: {
    backgroundColor: "#D1FAE5",
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  messageError: {
    backgroundColor: "#FEE2E2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextSuccess: {
    color: "#047857",
  },
  messageTextError: {
    color: "#DC2626",
  },
  referralModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.36)",
    justifyContent: "flex-end",
  },
  referralModalSheet: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
  },
  referralModalHandle: {
    width: 44,
    height: 5,
    borderRadius: 999,
    backgroundColor: "#D6DDE8",
    alignSelf: "center",
    marginBottom: 18,
  },
  referralModalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 20,
  },
  referralModalTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 4,
  },
  referralModalSubtitle: {
    fontSize: 14,
    color: "#64748B",
    lineHeight: 20,
  },
  referralModalCloseButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#F1F5F9",
    alignItems: "center",
    justifyContent: "center",
  },
  referralCodeCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: "#F8F5FF",
    borderWidth: 1,
    borderColor: "#E9DDFE",
    marginBottom: 18,
  },
  referralCodeLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748B",
    marginBottom: 10,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  referralCodeValue: {
    fontSize: 30,
    fontWeight: "800",
    letterSpacing: 6,
    color: "#1B0977",
    textAlign: "center",
  },
  referralModalActions: {
    gap: 12,
  },
  referralModalPrimaryButton: {
    width: "100%",
  },
  referralModalSecondaryButton: {
    width: "100%",
  },
  referralEmptyCard: {
    borderRadius: 20,
    padding: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    alignItems: "flex-start",
    gap: 10,
  },
  referralEmptyTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1B0977",
  },
  referralEmptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
});
