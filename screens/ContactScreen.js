import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS } from "../constants/colors";

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

/**
 * Tarjeta informativa de contacto
 */
const InfoCard = ({ icon, title, subtitle, content, color = COLORS.PRIMARY }) => {
  return (
    <View style={styles.infoCard}>
      <View style={styles.infoCardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: color }]}>
          <Ionicons name={icon} size={20} color={COLORS.WHITE} />
        </View>
        <View style={styles.infoCardHeaderText}>
          <Text style={styles.infoCardTitle}>{title}</Text>
          <Text style={styles.infoCardSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {content && <Text style={styles.infoCardContent}>{content}</Text>}
    </View>
  );
};

/**
 * Tarjeta de tipo de consulta
 */
const QueryTypeCard = ({ title, description }) => {
  return (
    <View style={styles.queryTypeCard}>
      <Text style={styles.queryTypeTitle}>{title}</Text>
      <Text style={styles.queryTypeDescription}>{description}</Text>
    </View>
  );
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Pantalla de contacto
 */
export default function ContactScreen({ userProfile }) {
  const [formData, setFormData] = useState({
    name: userProfile?.name
      ? `${userProfile.name} ${userProfile.surname || ""}`.trim()
      : "",
    email: userProfile?.work_email || "",
    subject: "",
    message: "",
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Actualizar campo del formulario
  const updateField = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Limpiar mensaje cuando el usuario empiece a escribir
    if (message) setMessage(null);
  }, [message]);

  // Manejar envío del formulario
  const handleSubmit = useCallback(async () => {
    // Validar campos requeridos
    if (!formData.name.trim() || !formData.email.trim() || !formData.subject.trim() || !formData.message.trim()) {
      setMessage({
        type: "error",
        text: "Por favor, completa todos los campos del formulario",
      });
      return;
    }

    setLoading(true);
    setMessage(null);

    try {
      // Crear el contenido del email
      const emailContent = `Nombre: ${formData.name}
Email: ${formData.email}
Asunto: ${formData.subject}

Mensaje:
${formData.message}
      `;

      // Crear el mailto link
      const subject = encodeURIComponent(`[LosResis Contacto] ${formData.subject}`);
      const body = encodeURIComponent(emailContent);
      const mailtoLink = `mailto:contacto@losresis.com?subject=${subject}&body=${body}`;

      // Abrir el cliente de email
      const canOpen = await Linking.canOpenURL(mailtoLink);
      
      if (canOpen) {
        await Linking.openURL(mailtoLink);
        
        setMessage({
          type: "success",
          text: "Se ha abierto tu cliente de email. Por favor, envía el mensaje para completar el contacto.",
        });

        // Limpiar el formulario (mantener nombre y email)
        setFormData((prev) => ({
          ...prev,
          subject: "",
          message: "",
        }));
      } else {
        setMessage({
          type: "error",
          text: "No se pudo abrir el cliente de email. Por favor, envía un correo a contacto@losresis.com",
        });
      }
    } catch (error) {
      console.error("Error opening email:", error);
      setMessage({
        type: "error",
        text: "Ha ocurrido un error. Por favor, intenta de nuevo o envía un correo a contacto@losresis.com",
      });
    } finally {
      setLoading(false);
    }
  }, [formData]);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Contacto</Text>
        <Text style={styles.subtitle}>
          ¿Tienes alguna pregunta o necesitas ayuda? Estamos aquí para ti.
        </Text>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
      >
        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >

        {/* Contact Information Cards */}
        <View style={styles.infoCardsContainer}>
          <InfoCard
            icon="mail"
            title="Email de Contacto"
            subtitle="Respuesta rápida garantizada"
            content="contacto@losresis.com"
            color={COLORS.PRIMARY}
          />
          
          <View style={styles.infoCard}>
            <View style={styles.infoCardHeader}>
              <View style={[styles.iconContainer, { backgroundColor: COLORS.PURPLE }]}>
                <Ionicons name="chatbubbles" size={20} color={COLORS.WHITE} />
              </View>
              <View style={styles.infoCardHeaderText}>
                <Text style={styles.infoCardTitle}>Tipos de Consulta</Text>
                <Text style={styles.infoCardSubtitle}>
                  Reportar errores, sugerencias, etc.
                </Text>
              </View>
            </View>
            <View style={styles.queryTypesList}>
              <Text style={styles.queryTypeItem}>• Reportar errores o problemas</Text>
              <Text style={styles.queryTypeItem}>• Sugerencias de mejora</Text>
              <Text style={styles.queryTypeItem}>• Consultas generales</Text>
              <Text style={styles.queryTypeItem}>• Solicitudes de funcionalidades</Text>
            </View>
          </View>
        </View>

        {/* Contact Form */}
        <View style={styles.formCard}>
          <View style={styles.formHeader}>
            <Text style={styles.formTitle}>Envíanos un mensaje</Text>
            <Text style={styles.formSubtitle}>
              Completa el formulario y se abrirá tu cliente de email con el mensaje preparado.
            </Text>
          </View>

          {/* Success/Error Message */}
          {message && (
            <View
              style={[
                styles.messageContainer,
                message.type === "success"
                  ? styles.messageSuccess
                  : styles.messageError,
              ]}
            >
              <Ionicons
                name={message.type === "success" ? "checkmark-circle" : "alert-circle"}
                size={20}
                color={message.type === "success" ? COLORS.SUCCESS : COLORS.ERROR}
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

          {/* Form Fields */}
          <View style={styles.formFields}>
            {/* Name and Email Row */}
            <View style={styles.inputRow}>
              <View style={[styles.inputGroup, styles.inputGroupHalf]}>
                <Text style={styles.inputLabel}>Nombre *</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="person" size={20} color={COLORS.GRAY} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.name}
                    onChangeText={(text) => updateField("name", text)}
                    placeholder="Tu nombre completo"
                    placeholderTextColor={COLORS.TEXT_LIGHT}
                  />
                </View>
              </View>

              <View style={[styles.inputGroup, styles.inputGroupHalf]}>
                <Text style={styles.inputLabel}>Email *</Text>
                <View style={styles.inputContainer}>
                  <Ionicons name="mail" size={20} color={COLORS.GRAY} style={styles.inputIcon} />
                  <TextInput
                    style={styles.input}
                    value={formData.email}
                    onChangeText={(text) => updateField("email", text)}
                    placeholder="tu@email.com"
                    placeholderTextColor={COLORS.TEXT_LIGHT}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
              </View>
            </View>

            {/* Subject */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Asunto *</Text>
              <View style={styles.inputContainer}>
                <Ionicons name="document-text" size={20} color={COLORS.GRAY} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={formData.subject}
                  onChangeText={(text) => updateField("subject", text)}
                  placeholder="¿En qué podemos ayudarte?"
                  placeholderTextColor={COLORS.TEXT_LIGHT}
                />
              </View>
            </View>

            {/* Message */}
            <View style={styles.inputGroup}>
              <Text style={styles.inputLabel}>Mensaje *</Text>
              <TextInput
                style={[styles.input, styles.inputMultiline]}
                value={formData.message}
                onChangeText={(text) => updateField("message", text)}
                placeholder="Describe tu consulta, problema o sugerencia con el mayor detalle posible..."
                placeholderTextColor={COLORS.TEXT_LIGHT}
                multiline
                numberOfLines={6}
                textAlignVertical="top"
              />
            </View>

            {/* Submit Button */}
            <TouchableOpacity
              style={[styles.submitButton, loading && styles.submitButtonDisabled]}
              onPress={handleSubmit}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <>
                  <ActivityIndicator size="small" color={COLORS.WHITE} />
                  <Text style={styles.submitButtonText}>Preparando...</Text>
                </>
              ) : (
                <>
                  <Ionicons name="paper-plane" size={20} color={COLORS.WHITE} />
                  <Text style={styles.submitButtonText}>Enviar Mensaje</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Additional Information */}
        <View style={styles.additionalInfoCard}>
          <Text style={styles.additionalInfoTitle}>¿Por qué contactarnos?</Text>
          
          <View style={styles.queryTypesGrid}>
            <QueryTypeCard
              title="Reportar Problemas"
              description="Si encuentras algún error o problema en la aplicación, nos ayuda mucho que nos lo reportes para solucionarlo rápidamente."
            />
            <QueryTypeCard
              title="Sugerencias"
              description="Tu opinión es valiosa. Si tienes ideas para mejorar LosResis, nos encantaría escucharlas."
            />
            <QueryTypeCard
              title="Consultas"
              description="¿Tienes dudas sobre cómo usar alguna funcionalidad? Estamos aquí para ayudarte."
            />
            <QueryTypeCard
              title="Colaboración"
              description="Si quieres colaborar con el proyecto o tienes propuestas de colaboración, contáctanos."
            />
          </View>
        </View>

        {/* Bottom spacing */}
        <View style={styles.bottomSpacing} />
      </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.BACKGROUND_LIGHT,
  },
  header: {
    backgroundColor: COLORS.WHITE,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.BORDER,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: COLORS.TEXT_DARK,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.TEXT_MEDIUM,
    lineHeight: 20,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  infoCardsContainer: {
    gap: 12,
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 16,
    shadowColor: COLORS.BLACK,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  infoCardHeaderText: {
    flex: 1,
  },
  infoCardTitle: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.TEXT_DARK,
  },
  infoCardSubtitle: {
    fontSize: 13,
    color: COLORS.TEXT_MEDIUM,
    marginTop: 2,
  },
  infoCardContent: {
    fontSize: 16,
    fontWeight: "500",
    color: COLORS.PRIMARY,
  },
  queryTypesList: {
    gap: 8,
  },
  queryTypeItem: {
    fontSize: 14,
    color: COLORS.TEXT_MEDIUM,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 20,
    shadowColor: COLORS.BLACK,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    marginBottom: 20,
  },
  formHeader: {
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: COLORS.TEXT_DARK,
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 15,
    color: COLORS.TEXT_MEDIUM,
    lineHeight: 22,
  },
  messageContainer: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    marginBottom: 20,
  },
  messageSuccess: {
    backgroundColor: COLORS.SUCCESS_LIGHT || "#F0FDF4",
    borderWidth: 1,
    borderColor: COLORS.SUCCESS,
  },
  messageError: {
    backgroundColor: COLORS.ERROR_LIGHT || "#FEE2E2",
    borderWidth: 1,
    borderColor: COLORS.ERROR,
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  messageTextSuccess: {
    color: COLORS.SUCCESS,
  },
  messageTextError: {
    color: COLORS.ERROR,
  },
  formFields: {
    gap: 16,
  },
  inputRow: {
    flexDirection: "row",
    gap: 12,
  },
  inputGroup: {
    marginBottom: 0,
  },
  inputGroupHalf: {
    flex: 1,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: "500",
    color: COLORS.TEXT_DARK,
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.BACKGROUND_LIGHT,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: COLORS.TEXT_DARK,
  },
  inputMultiline: {
    backgroundColor: COLORS.BACKGROUND_LIGHT,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    borderRadius: 12,
    padding: 12,
    fontSize: 16,
    color: COLORS.TEXT_DARK,
    minHeight: 120,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    backgroundColor: COLORS.PRIMARY,
    borderRadius: 12,
    padding: 16,
    marginTop: 8,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
  additionalInfoCard: {
    backgroundColor: COLORS.BADGE_BLUE_BG || "#EFF6FF",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: COLORS.PRIMARY + "20",
  },
  additionalInfoTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.TEXT_DARK,
    marginBottom: 16,
  },
  queryTypesGrid: {
    gap: 16,
  },
  queryTypeCard: {
    marginBottom: 0,
  },
  queryTypeTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.TEXT_DARK,
    marginBottom: 6,
  },
  queryTypeDescription: {
    fontSize: 14,
    color: COLORS.TEXT_MEDIUM,
    lineHeight: 20,
  },
  bottomSpacing: {
    height: 32,
  },
});

