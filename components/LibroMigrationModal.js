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
import { Icon } from "./Icon";

/**
 * Migrar a la plantilla: sustituir el Libro propio de un año por el Libro oficial.
 *
 * Es destructivo e irreversible (borra el libro propio del año con todo lo
 * registrado dentro), así que aquí se ofrece descargar el libro completo en PDF
 * antes de consumarlo. NO es obligatorio descargarlo: el residente decide.
 *
 * Es un modal propio y no un Alert.alert a propósito. El PDF acaba en el share
 * sheet del sistema, y un Alert no sobrevive a que se abra encima: el residente
 * perdería el sitio y tendría que volver a empezar. Este modal sigue montado
 * cuando el share sheet se cierra, y se queda marcado que ya lo descargó.
 */
export const LibroMigrationModal = ({
  visible,
  onClose,
  onExportPdf,
  onConfirm,
  residencyYear,
  incomingSections = [],
  recordedEntries = 0,
  migrating = false,
}) => {
  const [exporting, setExporting] = useState(false);
  const [downloaded, setDownloaded] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Cada vez que se abre se empieza de cero: si no, un "ya lo descargué" de la vez
  // anterior le haría creer que tiene una copia de lo que hay ahora.
  useEffect(() => {
    if (!visible) return;
    setExporting(false);
    setDownloaded(false);
    setConfirming(false);
  }, [visible]);

  const hasSomethingToLose = recordedEntries > 0;

  const handleExport = async () => {
    setExporting(true);
    try {
      const ok = await onExportPdf?.();
      if (ok !== false) setDownloaded(true);
    } finally {
      setExporting(false);
    }
  };

  const handleConfirm = () => {
    // Con algo que perder se pide un segundo toque. Sin nada que perder, migrar es
    // inocuo y pedir dos confirmaciones solo enseña a confirmar sin leer.
    if (hasSomethingToLose && !confirming) {
      setConfirming(true);
      return;
    }
    onConfirm?.();
  };

  const busy = migrating || exporting;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.overlayTouchable}
          activeOpacity={1}
          onPress={busy ? undefined : onClose}
        />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.title}>
                {`Cambiar al libro oficial de R${residencyYear}`}
              </Text>
              <Text style={styles.subtitle}>
                Tu tutor ha publicado el libro de tu especialidad para este año.
              </Text>
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              disabled={busy}
            >
              <Icon name="close" size={18} color="#475569" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.body}
            contentContainerStyle={styles.bodyContent}
            showsVerticalScrollIndicator={false}
          >
            {incomingSections.length ? (
              <View style={styles.block}>
                <Text style={styles.blockTitle}>Lo que incluye su libro</Text>
                <Text style={styles.blockText}>
                  {incomingSections.join(", ")}.
                </Text>
              </View>
            ) : null}

            <View style={[styles.block, hasSomethingToLose && styles.blockDanger]}>
              <View style={styles.blockHeader}>
                <Icon
                  name={hasSomethingToLose ? "warning-outline" : "information-circle-outline"}
                  size={16}
                  color={hasSomethingToLose ? "#B45309" : "#475569"}
                />
                <Text
                  style={[
                    styles.blockTitle,
                    hasSomethingToLose && styles.blockTitleDanger,
                  ]}
                >
                  {hasSomethingToLose ? "Lo que vas a perder" : "Qué va a pasar"}
                </Text>
              </View>
              <Text style={styles.blockText}>
                {hasSomethingToLose
                  ? `Tu libro de R${residencyYear} se sustituye por el de tu tutor, y con él se borran los ${recordedEntries} registros que tienes dentro. No se puede deshacer.`
                  : `Tu libro de R${residencyYear} se sustituye por el de tu tutor. No tienes registros dentro, así que no pierdes nada.`}
              </Text>
            </View>

            <TouchableOpacity
              style={[styles.pdfButton, downloaded && styles.pdfButtonDone]}
              onPress={handleExport}
              disabled={busy}
              activeOpacity={0.85}
            >
              {exporting ? (
                <ActivityIndicator size="small" color="#670CF5" />
              ) : (
                <Icon
                  name={downloaded ? "checkmark-circle" : "document-text-outline"}
                  size={18}
                  color={downloaded ? "#059669" : "#670CF5"}
                />
              )}
              <View style={styles.pdfCopy}>
                <Text
                  style={[styles.pdfTitle, downloaded && styles.pdfTitleDone]}
                >
                  {exporting
                    ? "Generando tu PDF..."
                    : downloaded
                      ? "Ya tienes tu libro descargado"
                      : "Descargar mi libro en PDF"}
                </Text>
                <Text style={styles.pdfText}>
                  {downloaded
                    ? "Puedes volver a descargarlo si quieres otra copia."
                    : "Todo tu libro, de todos tus años y apartados."}
                </Text>
              </View>
            </TouchableOpacity>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={[
                styles.confirmButton,
                hasSomethingToLose && styles.confirmButtonDanger,
                busy && styles.confirmButtonDisabled,
              ]}
              onPress={handleConfirm}
              disabled={busy}
              activeOpacity={0.85}
            >
              {migrating ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.confirmButtonText}>
                  {!hasSomethingToLose
                    ? "Cambiar al libro de mi tutor"
                    : confirming
                      ? "Sí, borrar mis registros y cambiar"
                      : "Cambiar y perder mis registros"}
                </Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onClose}
              disabled={busy}
            >
              <Text style={styles.cancelButtonText}>
                {confirming ? "No, dejarlo como está" : "Ahora no"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default LibroMigrationModal;

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.35)",
    justifyContent: "flex-end",
  },
  overlayTouchable: {
    flex: 1,
  },
  sheet: {
    maxHeight: "88%",
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
    gap: 12,
  },
  headerCopy: {
    flex: 1,
  },
  title: {
    fontSize: 21,
    fontWeight: "800",
    color: "#1B0977",
  },
  subtitle: {
    marginTop: 6,
    fontSize: 13,
    color: "#64748B",
    lineHeight: 19,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F8FAFC",
  },
  body: {
    maxHeight: 360,
  },
  bodyContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
    gap: 12,
  },
  block: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
    gap: 6,
  },
  blockDanger: {
    backgroundColor: "#FFFBEB",
    borderColor: "#FDE68A",
  },
  blockHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  blockTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#1B0977",
  },
  blockTitleDanger: {
    color: "#B45309",
  },
  blockText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 19,
  },
  pdfButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 18,
    padding: 14,
    borderWidth: 1,
    borderColor: "#DDD6FE",
    backgroundColor: "#F5F3FF",
  },
  pdfButtonDone: {
    borderColor: "#A7F3D0",
    backgroundColor: "#ECFDF5",
  },
  pdfCopy: {
    flex: 1,
    gap: 2,
  },
  pdfTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#670CF5",
  },
  pdfTitleDone: {
    color: "#047857",
  },
  pdfText: {
    fontSize: 12,
    color: "#64748B",
    lineHeight: 17,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 4,
  },
  confirmButton: {
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#670CF5",
  },
  confirmButtonDanger: {
    backgroundColor: "#DC2626",
  },
  confirmButtonDisabled: {
    opacity: 0.6,
  },
  confirmButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  cancelButton: {
    height: 46,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelButtonText: {
    color: "#64748B",
    fontSize: 14,
    fontWeight: "600",
  },
});
