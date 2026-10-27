import React, { useState } from "react";
import {
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Icon } from "../../Icon";
import { LibroProgressRing } from "../LibroProgressRing";
import {
  CATEGORY_STATUS,
  CLINICAL_CASE_STATUS,
  displayStatusOf,
  formatCaseDate,
  hasPortfolioTab,
  progressLabel,
} from "../../../utils/clinicalCases";

/**
 * «Casos clínicos» del Libro: dos pestañas.
 *
 *   Mi portafolio      los casos que pide el hospital para el año, con su
 *                      estado y el progreso. Solo si la plantilla pide alguno.
 *   Mis casos clínicos el registro libre del residente. Sin portafolio, es lo
 *                      único que se ve.
 *
 * Un caso pendiente se puede empezar de cero o vincular a uno que el residente
 * ya registró como libre (no se duplica: el libre pasa al portafolio).
 *
 * Modos del año (fase 4, `portfolio` de utils/yearPortfolio):
 *   specific   un renglón por caso pedido (Sant Pau).
 *   category   cada categoría con «X de N» y sus casos; en cada una se añaden
 *              o vinculan varios.
 *   minimum    sin portafolio: una tarjeta «X de N casos» encima de «Mis casos
 *              clínicos», que son los que cuentan.
 *   free       solo «Mis casos clínicos».
 */

const StatusChip = ({ status, statuses = CLINICAL_CASE_STATUS }) => {
  const config = statuses[status];
  return (
    <View style={[styles.statusChip, { backgroundColor: config.background }]}>
      <Text style={[styles.statusText, { color: config.color }]}>{config.label}</Text>
    </View>
  );
};

const caseSubtitle = (clinicalCase) => {
  if (!clinicalCase) return null;
  if (clinicalCase.status === "completed") {
    return formatCaseDate(clinicalCase.case_date) || formatCaseDate(clinicalCase.completed_at);
  }
  const edited = formatCaseDate(clinicalCase.updated_at);
  return edited ? `Última edición: ${edited}` : null;
};

const actionLabelFor = (status, readOnly) => {
  if (status === "pending") return readOnly ? "" : "Completar";
  if (status === "in_progress") return "Continuar";
  if (status === "changes_requested") return readOnly ? "Ver" : "Corregir";
  return "Ver";
};

const ProgressCard = ({ title, label, percent }) => (
  <View style={styles.progressCard}>
    <View style={styles.progressCopy}>
      <Text style={styles.progressTitle}>{title}</Text>
      <Text style={styles.progressSubtitle} testID="clinical-cases-progress">
        {label || "Sin casos obligatorios"}
      </Text>
    </View>
    {label ? <LibroProgressRing percent={percent} /> : null}
  </View>
);

export const ClinicalCasesView = ({
  residencyYear,
  portfolio = null,
  linkableCases = [],
  readOnly = false,
  onOpenRequirement,
  onOpenCase,
  onCreateCase,
  onLinkCase,
  // La pestaña la guarda la pantalla: la vista se desmonta al abrir una ficha
  // y, al volver, el residente tiene que seguir donde estaba.
  tab: controlledTab,
  onTabChange,
}) => {
  const rows = portfolio?.rows || [];
  const categories = portfolio?.categories || [];
  const freeCases = portfolio?.freeCases || [];
  const hasPortfolio = hasPortfolioTab(portfolio);
  const [ownTab, setOwnTab] = useState("portfolio");
  const tab = controlledTab || ownTab;
  const setTab = onTabChange || setOwnTab;
  const [linkingRow, setLinkingRow] = useState(null);
  const progress = portfolio?.progress || null;
  const progressText = progressLabel(portfolio);
  const activeTab = hasPortfolio ? tab : "free";

  const handleRequirementPress = (row) => {
    if (row.clinicalCase) {
      onOpenCase?.(row.clinicalCase, row.requirement);
      return;
    }
    if (readOnly) return;
    if (!linkableCases.length) {
      onOpenRequirement?.(row.requirement);
      return;
    }
    Alert.alert(row.requirement.title, "¿Cómo quieres completar este caso?", [
      { text: "Crear un caso nuevo", onPress: () => onOpenRequirement?.(row.requirement) },
      { text: "Vincular un caso registrado", onPress: () => setLinkingRow(row) },
      { text: "Cancelar", style: "cancel" },
    ]);
  };

  const renderCaseCard = (clinicalCase, requirement = null) => {
    const status = displayStatusOf(clinicalCase);
    return (
      <TouchableOpacity
        key={clinicalCase.id}
        style={[styles.card, requirement && styles.nestedCard]}
        onPress={() => onOpenCase?.(clinicalCase, requirement)}
        activeOpacity={0.85}
        testID={`clinical-case-${requirement ? "category" : "free"}-${clinicalCase.title}`}
      >
        <View style={styles.cardCopy}>
          <Text style={styles.cardTitle}>{clinicalCase.title}</Text>
          <View style={styles.cardMeta}>
            <StatusChip status={status} />
            {caseSubtitle(clinicalCase) ? (
              <Text style={styles.cardSubtitle}>{caseSubtitle(clinicalCase)}</Text>
            ) : null}
          </View>
        </View>
        <Icon name="chevron-forward" size={16} color="#94A3B8" />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {hasPortfolio ? (
        <View style={styles.tabs}>
          {[
            { key: "portfolio", label: "Mi portafolio" },
            { key: "free", label: "Mis casos clínicos" },
          ].map((item) => {
            const active = activeTab === item.key;
            return (
              <TouchableOpacity
                key={item.key}
                style={[styles.tab, active && styles.tabActive]}
                onPress={() => setTab(item.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                testID={`clinical-cases-tab-${item.key}`}
              >
                <Text style={[styles.tabText, active && styles.tabTextActive]}>{item.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {activeTab === "portfolio" ? (
        <>
          <ProgressCard
            title="Progreso de mi portafolio"
            label={progressText}
            percent={progress?.percent || 0}
          />

          <Text style={styles.sectionLabel}>{`Análisis de casos clínicos · R${residencyYear}`}</Text>

          {categories.map((category) => {
            const statusConfig = CATEGORY_STATUS[category.status];
            const count = `${Math.min(category.done, category.minimum)} de ${category.minimum}`;
            return (
              <View
                key={category.requirement.id}
                style={styles.category}
                testID={`clinical-case-category-${category.requirement.title}`}
              >
                <View style={styles.categoryHeader}>
                  <View style={[styles.statusIcon, { backgroundColor: statusConfig.background }]}>
                    <Icon name={statusConfig.icon} size={18} color={statusConfig.color} />
                  </View>
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle}>{`${category.requirement.title} · ${count}`}</Text>
                    <View style={styles.cardMeta}>
                      <StatusChip status={category.status} statuses={CATEGORY_STATUS} />
                      {!category.requirement.is_required ? (
                        <Text style={styles.cardSubtitle}>Opcional</Text>
                      ) : null}
                    </View>
                    {category.requirement.description ? (
                      <Text style={styles.cardDescription} numberOfLines={2}>
                        {category.requirement.description}
                      </Text>
                    ) : null}
                  </View>
                </View>

                {category.cases.map((clinicalCase) =>
                  renderCaseCard(clinicalCase, category.requirement)
                )}

                {!readOnly ? (
                  <View style={styles.categoryActions}>
                    <TouchableOpacity
                      style={styles.categoryAction}
                      onPress={() => onOpenRequirement?.(category.requirement)}
                      activeOpacity={0.85}
                      testID={`clinical-case-category-add-${category.requirement.title}`}
                    >
                      <Icon name="add-circle-outline" size={16} color="#670CF5" />
                      <Text style={styles.categoryActionText}>Añadir caso</Text>
                    </TouchableOpacity>
                    {linkableCases.length ? (
                      <TouchableOpacity
                        style={styles.categoryAction}
                        onPress={() => setLinkingRow({ requirement: category.requirement })}
                        activeOpacity={0.85}
                        testID={`clinical-case-category-link-${category.requirement.title}`}
                      >
                        <Icon name="link-outline" size={16} color="#670CF5" />
                        <Text style={styles.categoryActionText}>Vincular caso</Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}

          {rows.map((row) => {
            const subtitle = caseSubtitle(row.clinicalCase);
            const statusConfig = CLINICAL_CASE_STATUS[row.status];
            return (
              <TouchableOpacity
                key={row.requirement.id}
                style={styles.card}
                onPress={() => handleRequirementPress(row)}
                activeOpacity={0.85}
                testID={`clinical-case-requirement-${row.requirement.title}`}
              >
                <View style={[styles.statusIcon, { backgroundColor: statusConfig.background }]}>
                  <Icon name={statusConfig.icon} size={18} color={statusConfig.color} />
                </View>
                <View style={styles.cardCopy}>
                  <Text style={styles.cardTitle}>{row.requirement.title}</Text>
                  <View style={styles.cardMeta}>
                    <StatusChip status={row.status} />
                    {!row.requirement.is_required ? (
                      <Text style={styles.cardSubtitle}>Opcional</Text>
                    ) : null}
                  </View>
                  {subtitle ? <Text style={styles.cardSubtitle}>{subtitle}</Text> : null}
                  {!row.clinicalCase && row.requirement.description ? (
                    <Text style={styles.cardDescription} numberOfLines={2}>
                      {row.requirement.description}
                    </Text>
                  ) : null}
                </View>
                <Text style={styles.cardAction}>
                  {actionLabelFor(row.status, readOnly)}
                </Text>
              </TouchableOpacity>
            );
          })}
        </>
      ) : (
        <>
          {portfolio?.mode === "minimum" ? (
            <ProgressCard
              title={`Casos clínicos de R${residencyYear}`}
              label={progressText}
              percent={progress?.percent || 0}
            />
          ) : null}

          {!readOnly ? (
            <TouchableOpacity
              style={styles.addButton}
              onPress={onCreateCase}
              activeOpacity={0.85}
              testID="clinical-case-add-free"
            >
              <Icon name="add-circle-outline" size={18} color="#670CF5" />
              <Text style={styles.addButtonText}>Añadir caso clínico</Text>
            </TouchableOpacity>
          ) : null}

          {freeCases.length ? (
            freeCases.map((clinicalCase) => renderCaseCard(clinicalCase))
          ) : (
            <View style={styles.empty}>
              <Icon name="clipboard-outline" size={22} color="#670CF5" />
              <Text style={styles.emptyTitle}>Todavía no has registrado casos</Text>
              <Text style={styles.emptyText}>
                Analiza los casos que te hayan marcado: descripción clínica y qué has
                aprendido de cada uno.
              </Text>
            </View>
          )}
        </>
      )}

      <Modal
        visible={!!linkingRow}
        transparent
        animationType="slide"
        onRequestClose={() => setLinkingRow(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>
              {`Vincular a «${linkingRow?.requirement.title || ""}»`}
            </Text>
            <Text style={styles.modalSubtitle}>
              Elige uno de tus casos registrados. Pasará a tu portafolio sin duplicarse.
            </Text>
            <ScrollView style={styles.modalList} contentContainerStyle={styles.modalListContent}>
              {linkableCases.map((clinicalCase) => (
                <TouchableOpacity
                  key={clinicalCase.id}
                  style={styles.card}
                  onPress={() => {
                    const row = linkingRow;
                    setLinkingRow(null);
                    onLinkCase?.(clinicalCase, row.requirement);
                  }}
                  activeOpacity={0.85}
                  testID={`clinical-case-link-${clinicalCase.title}`}
                >
                  <View style={styles.cardCopy}>
                    <Text style={styles.cardTitle}>{clinicalCase.title}</Text>
                    <View style={styles.cardMeta}>
                      <StatusChip status={displayStatusOf(clinicalCase)} />
                      {caseSubtitle(clinicalCase) ? (
                        <Text style={styles.cardSubtitle}>{caseSubtitle(clinicalCase)}</Text>
                      ) : null}
                    </View>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity style={styles.modalCancel} onPress={() => setLinkingRow(null)}>
              <Text style={styles.modalCancelText}>Cancelar</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default ClinicalCasesView;

const styles = StyleSheet.create({
  container: { gap: 10 },
  tabs: {
    flexDirection: "row",
    padding: 4,
    borderRadius: 14,
    backgroundColor: "#F1F5F9",
  },
  tab: { flex: 1, alignItems: "center", paddingVertical: 9, borderRadius: 11 },
  tabActive: { backgroundColor: "#EDE9FE" },
  tabText: { fontSize: 13, fontWeight: "700", color: "#64748B" },
  tabTextActive: { color: "#670CF5" },
  progressCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#F5F3FF",
    borderWidth: 1,
    borderColor: "#E9D5FF",
  },
  progressCopy: { flex: 1, gap: 2 },
  progressTitle: { fontSize: 14, fontWeight: "800", color: "#1B0977" },
  progressSubtitle: { fontSize: 12, color: "#6D28D9" },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#64748B",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginTop: 4,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  statusIcon: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  cardCopy: { flex: 1, gap: 4 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: "#1B0977" },
  cardMeta: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  cardSubtitle: { fontSize: 12, color: "#64748B" },
  cardDescription: { fontSize: 12, color: "#94A3B8" },
  cardAction: { fontSize: 13, fontWeight: "700", color: "#670CF5" },
  nestedCard: { marginLeft: 12 },
  category: {
    gap: 8,
    padding: 12,
    borderRadius: 20,
    backgroundColor: "#FAFAFF",
    borderWidth: 1,
    borderColor: "#E8EAF3",
  },
  categoryHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  categoryActions: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  categoryAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#C4B5FD",
    backgroundColor: "#FFFFFF",
  },
  categoryActionText: { fontSize: 13, fontWeight: "700", color: "#670CF5" },
  statusChip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  statusText: { fontSize: 11, fontWeight: "700" },
  addButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "#C4B5FD",
    backgroundColor: "#FAF5FF",
  },
  addButtonText: { fontSize: 14, fontWeight: "700", color: "#670CF5" },
  empty: {
    alignItems: "center",
    gap: 8,
    padding: 22,
    borderRadius: 20,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  emptyTitle: { fontSize: 15, fontWeight: "800", color: "#1B0977" },
  emptyText: { fontSize: 13, color: "#64748B", textAlign: "center", lineHeight: 19 },
  modalBackdrop: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(15,23,42,0.45)" },
  modalSheet: {
    maxHeight: "75%",
    padding: 18,
    paddingBottom: 30,
    gap: 8,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: "#FFFFFF",
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: "#1B0977" },
  modalSubtitle: { fontSize: 13, color: "#64748B", lineHeight: 18 },
  modalList: { marginTop: 6 },
  modalListContent: { gap: 8 },
  modalCancel: { alignItems: "center", paddingVertical: 12 },
  modalCancelText: { fontSize: 14, fontWeight: "700", color: "#64748B" },
});
