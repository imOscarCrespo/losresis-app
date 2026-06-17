import React, { useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Linking,
} from "react-native";
import { Icon } from "../components/Icon";
import { KeyboardAwareScrollView } from "../components/KeyboardAwareScrollView";
import { KeyboardAwareTextInput } from "../components/KeyboardAwareTextInput";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import posthogLogger from "../services/posthogService";
import { COLORS } from "../constants/colors";

const CONTACT_TOPICS = [
  {
    title: "Reportar errores",
    description: "Cuéntanos qué ha fallado y en qué pantalla ocurrió.",
  },
  {
    title: "Sugerencias",
    description: "Propón mejoras de producto o ideas para nuevas funciones.",
  },
  {
    title: "Consultas generales",
    description: "Escríbenos si necesitas ayuda usando la app.",
  },
  {
    title: "Colaboraciones",
    description: "Abrimos la puerta a propuestas y proyectos conjuntos.",
  },
];

const buildInitialFormData = (userProfile) => ({
  name: userProfile?.name
    ? `${userProfile.name} ${userProfile.surname || ""}`.trim()
    : "",
  email: userProfile?.work_email || "",
  subject: "",
  message: "",
});

const ContactPill = ({ icon, label }) => (
  <View style={styles.pill}>
    <Icon name={icon} size={14} color="#670CF5" />
    <Text style={styles.pillText}>{label}</Text>
  </View>
);

const TopicCard = ({ title, description }) => (
  <View style={styles.topicCard}>
    <Text style={styles.topicTitle}>{title}</Text>
    <Text style={styles.topicDescription}>{description}</Text>
  </View>
);

export default function ContactScreen({ userProfile, onBack }) {
  const [formData, setFormData] = useState(() => buildInitialFormData(userProfile));
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    posthogLogger.logScreen("ContactScreen");
  }, []);

  useEffect(() => {
    const nextFormData = buildInitialFormData(userProfile);
    setFormData((prev) => ({
      ...prev,
      name: nextFormData.name,
      email: nextFormData.email,
    }));
  }, [userProfile]);

  const updateField = useCallback(
    (field, value) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
      if (message) setMessage(null);
    },
    [message]
  );

  const handleSubmit = useCallback(async () => {
    if (
      !formData.name.trim() ||
      !formData.email.trim() ||
      !formData.subject.trim() ||
      !formData.message.trim()
    ) {
      setMessage({
        type: "error",
        text: "Completa todos los campos antes de continuar.",
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      const emailContent = `Nombre: ${formData.name}
Email: ${formData.email}
Asunto: ${formData.subject}

Mensaje:
${formData.message}`;

      const subject = encodeURIComponent(
        `[LosResis Contacto] ${formData.subject}`
      );
      const body = encodeURIComponent(emailContent);
      const mailtoLink = `mailto:contacto@losresis.com?subject=${subject}&body=${body}`;

      const canOpen = await Linking.canOpenURL(mailtoLink);

      if (!canOpen) {
        setMessage({
          type: "error",
          text: "No se pudo abrir tu cliente de email. Escríbenos a contacto@losresis.com.",
        });
        return;
      }

      await Linking.openURL(mailtoLink);

      setMessage({
        type: "success",
        text: "Se ha abierto tu cliente de email con el mensaje preparado.",
      });

      setFormData((prev) => ({
        ...prev,
        subject: "",
        message: "",
      }));
    } catch (error) {
      console.error("Error opening email:", error);
      setMessage({
        type: "error",
        text: "Ha ocurrido un error. Inténtalo de nuevo o escribe a contacto@losresis.com.",
      });
    } finally {
      setLoading(false);
    }
  }, [formData]);

  return (
    <HeroScreenLayout
      title="Contacto"
      onBack={onBack}
      rightSlot={
        <View style={styles.headerIconCircle}>
          <Icon name="mail-outline" size={20} color="#670CF5" />
        </View>
      }
      contentStyle={styles.contentSurface}
    >
          <KeyboardAwareScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            bottomPadding={32}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.contentInner}>
              <View style={styles.heroCard}>
                <Text style={styles.heroEyebrow}>Soporte y feedback</Text>
                <Text style={styles.heroTitle}>Habla con el equipo de LosResis</Text>
                <Text style={styles.heroText}>
                  Usa este formulario para reportar errores, pedir ayuda o compartir
                  sugerencias. Prepararemos el email para que solo tengas que enviarlo.
                </Text>
                <View style={styles.pillsRow}>
                  <ContactPill icon="flash-outline" label="Respuesta rápida" />
                  <ContactPill icon="bug-outline" label="Errores" />
                  <ContactPill icon="bulb-outline" label="Ideas" />
                </View>
              </View>

              <View style={styles.infoCard}>
                <View style={styles.infoHeader}>
                  <View style={styles.infoIconWrap}>
                    <Icon name="mail-outline" size={18} color="#670CF5" />
                  </View>
                  <View style={styles.infoText}>
                    <Text style={styles.infoTitle}>Email de contacto</Text>
                    <Text style={styles.infoSubtitle}>
                      También puedes escribirnos directamente si lo prefieres.
                    </Text>
                  </View>
                </View>
                <Text style={styles.infoEmail}>contacto@losresis.com</Text>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Motivos frecuentes</Text>
                <Text style={styles.sectionText}>
                  Elige un enfoque claro en el asunto y podremos ayudarte antes.
                </Text>
                <View style={styles.topicGrid}>
                  {CONTACT_TOPICS.map((topic) => (
                    <TopicCard
                      key={topic.title}
                      title={topic.title}
                      description={topic.description}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.card}>
                <Text style={styles.sectionTitle}>Envíanos un mensaje</Text>
                <Text style={styles.sectionText}>
                  Revisa tus datos, añade contexto y abriremos tu cliente de correo.
                </Text>

                {message && (
                  <View
                    style={[
                      styles.messageBox,
                      message.type === "success"
                        ? styles.messageSuccess
                        : styles.messageError,
                    ]}
                  >
                    <Icon
                      name={
                        message.type === "success"
                          ? "checkmark-circle-outline"
                          : "alert-circle-outline"
                      }
                      size={18}
                      color={message.type === "success" ? "#047857" : "#B91C1C"}
                    />
                    <Text
                      style={[
                        styles.messageText,
                        message.type === "success"
                          ? styles.messageTextSuccess
                          : styles.messageTextError,
                      ]}
                    >
                      {message.text}
                    </Text>
                  </View>
                )}

                <View style={styles.formRow}>
                  <View style={[styles.inputGroup, styles.inputGroupHalf]}>
                    <Text style={styles.inputLabel}>Nombre *</Text>
                    <View style={styles.inputWrap}>
                      <Icon
                        name="person-outline"
                        size={18}
                        color="#64748B"
                        style={styles.inputIcon}
                      />
                      <KeyboardAwareTextInput
                        style={styles.input}
                        value={formData.name}
                        onChangeText={(text) => updateField("name", text)}
                        placeholder="Tu nombre completo"
                        placeholderTextColor="#94A3B8"
                      />
                    </View>
                  </View>

                  <View style={[styles.inputGroup, styles.inputGroupHalf]}>
                    <Text style={styles.inputLabel}>Email *</Text>
                    <View style={styles.inputWrap}>
                      <Icon
                        name="mail-outline"
                        size={18}
                        color="#64748B"
                        style={styles.inputIcon}
                      />
                      <KeyboardAwareTextInput
                        style={styles.input}
                        value={formData.email}
                        onChangeText={(text) => updateField("email", text)}
                        placeholder="tu@email.com"
                        placeholderTextColor="#94A3B8"
                        keyboardType="email-address"
                        autoCapitalize="none"
                      />
                    </View>
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Asunto *</Text>
                  <View style={styles.inputWrap}>
                    <Icon
                      name="create-outline"
                      size={18}
                      color="#64748B"
                      style={styles.inputIcon}
                    />
                    <KeyboardAwareTextInput
                      style={styles.input}
                      value={formData.subject}
                      onChangeText={(text) => updateField("subject", text)}
                      placeholder="Resume en una frase que necesitas"
                      placeholderTextColor="#94A3B8"
                    />
                  </View>
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Mensaje *</Text>
                  <KeyboardAwareTextInput
                    style={[styles.textarea, styles.inputWrap]}
                    value={formData.message}
                    onChangeText={(text) => updateField("message", text)}
                    placeholder="Describe tu consulta, el contexto y los pasos para reproducirlo si es un error."
                    placeholderTextColor="#94A3B8"
                    multiline
                    numberOfLines={7}
                    textAlignVertical="top"
                    keyboardAwareOptions={{ extraScrollSpace: 40 }}
                  />
                </View>

                <TouchableOpacity
                  style={[
                    styles.submitButton,
                    loading && styles.submitButtonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={loading}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <>
                      <ActivityIndicator size="small" color="#FFFFFF" />
                      <Text style={styles.submitButtonText}>Preparando correo...</Text>
                    </>
                  ) : (
                    <>
                      <Icon name="paper-plane-outline" size={18} color="#FFFFFF" />
                      <Text style={styles.submitButtonText}>Abrir email</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          </KeyboardAwareScrollView>
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  contentSurface: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND,
  },
  headerIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 32,
  },
  contentInner: {
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 16,
  },
  heroCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  heroEyebrow: {
    fontSize: 11,
    fontWeight: "800",
    color: "#670CF5",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 8,
  },
  heroText: {
    fontSize: 14,
    lineHeight: 21,
    color: "#64748B",
  },
  pillsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#F3E8FF",
  },
  pillText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#670CF5",
  },
  infoCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  infoHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  infoIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F3E8FF",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  infoText: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 4,
  },
  infoSubtitle: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
  },
  infoEmail: {
    fontSize: 18,
    fontWeight: "800",
    color: "#670CF5",
    marginTop: 16,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 6,
  },
  sectionText: {
    fontSize: 14,
    lineHeight: 20,
    color: "#64748B",
    marginBottom: 16,
  },
  topicGrid: {
    gap: 12,
  },
  topicCard: {
    backgroundColor: "#F8F9FE",
    borderRadius: 18,
    padding: 14,
  },
  topicTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#1B0977",
    marginBottom: 4,
  },
  topicDescription: {
    fontSize: 13,
    lineHeight: 19,
    color: "#64748B",
  },
  messageBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 18,
    padding: 14,
    marginBottom: 16,
  },
  messageSuccess: {
    backgroundColor: "#ECFDF5",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  messageError: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextSuccess: {
    color: "#047857",
  },
  messageTextError: {
    color: "#B91C1C",
  },
  formRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputGroup: {
    marginBottom: 14,
  },
  inputGroupHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: "#334155",
    marginBottom: 8,
  },
  inputWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8F9FE",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    paddingHorizontal: 14,
    minHeight: 54,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: "#0F172A",
    paddingVertical: 16,
  },
  textarea: {
    minHeight: 148,
    alignItems: "flex-start",
    paddingTop: 14,
    fontSize: 15,
    color: "#0F172A",
  },
  submitButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: "#670CF5",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 6,
  },
  submitButtonDisabled: {
    opacity: 0.75,
  },
  submitButtonText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#FFFFFF",
  },
});
