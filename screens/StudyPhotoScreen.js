import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";
import { HeroScreenLayout } from "../components/HeroScreenLayout";
import { Icon } from "../components/Icon";
import { SelectFilter } from "../components/SelectFilter";
import { COLORS } from "../constants/colors";
import { getSpecialitiesCatalog } from "../services/staticCatalogService";
import posthogLogger from "../services/posthogService";
import {
  analyzeStudyPhoto,
  deleteStudyCard,
  extractCardSummary,
  getStudyCards,
  getStudyPhotoUrl,
  removeStudyPhoto,
  saveStudyCard,
  updateStudyCardTags,
  uploadStudyPhoto,
} from "../services/studyPhotoService";

const PRIMARY = COLORS.PRIMARY;
const DANGER = "#EF4444";

const DISCLAIMER =
  "Explicaciones generadas con IA. Pueden contener errores: contrasta siempre con tus apuntes y fuentes oficiales.";

const TABS = [
  { key: "analyze", label: "Analizar", icon: "camera-outline" },
  { key: "cards", label: "Mis tarjetas", icon: "bookmark-outline" },
];

// Mini-render de markdown (mismo enfoque que ClinicalAssistantScreen: sin
// librería, solo ###, listas y **negrita**, que es lo que pide el prompt).
const splitBoldSegments = (text) =>
  text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);

const InlineFormattedText = ({ text, style }) => (
  <Text style={style}>
    {splitBoldSegments(text).map((segment, index) =>
      segment.startsWith("**") && segment.endsWith("**") ? (
        <Text key={index} style={styles.mdBold}>
          {segment.slice(2, -2)}
        </Text>
      ) : (
        <Text key={index}>{segment}</Text>
      )
    )}
  </Text>
);

const ExplanationMarkdown = ({ content }) => {
  const lines = (content || "").split("\n");

  return (
    <View>
      {lines.map((rawLine, index) => {
        const line = rawLine.trim();
        if (!line) return null;

        const headingMatch = line.match(/^#{1,3}\s+(.*)$/);
        if (headingMatch) {
          return (
            <Text key={index} style={styles.mdHeading}>
              {headingMatch[1]}
            </Text>
          );
        }

        const bulletMatch = line.match(/^[-*]\s+(.*)$/);
        if (bulletMatch) {
          return (
            <View key={index} style={styles.mdBulletRow}>
              <Text style={styles.mdBulletDot}>•</Text>
              <InlineFormattedText
                text={bulletMatch[1]}
                style={styles.mdBulletText}
              />
            </View>
          );
        }

        return (
          <InlineFormattedText key={index} text={line} style={styles.mdParagraph} />
        );
      })}
    </View>
  );
};

// Formulario de clasificación (especialidad + temas) compartido entre el flujo
// de guardado y la edición desde el detalle de una tarjeta.
const TagEditor = ({
  title,
  speciality,
  onSpecialityChange,
  topics,
  onTopicsChange,
  topicDraft,
  onTopicDraftChange,
  specialityOptions,
}) => {
  const addTopic = () => {
    const topic = (topicDraft || "").trim();
    onTopicDraftChange("");
    if (!topic) return;
    if (topics.length >= 5) return;
    if (topics.some((t) => t.toLowerCase() === topic.toLowerCase())) return;
    onTopicsChange([...topics, topic]);
  };

  return (
    <View style={styles.tagForm}>
      {title ? <Text style={styles.tagFormTitle}>{title}</Text> : null}
      <SelectFilter
        label="Especialidad"
        value={speciality}
        onSelect={(value) => onSpecialityChange(value || null)}
        options={specialityOptions}
        placeholder="Sin especialidad"
      />
      <View style={styles.topicInputRow}>
        <TextInput
          style={styles.topicInput}
          value={topicDraft}
          onChangeText={onTopicDraftChange}
          placeholder="Añade un tema (p. ej. Arritmias)"
          placeholderTextColor="#94A3B8"
          maxLength={30}
          returnKeyType="done"
          onSubmitEditing={addTopic}
        />
        <TouchableOpacity
          style={styles.topicAddBtn}
          onPress={addTopic}
          activeOpacity={0.8}
        >
          <Icon name="add" size={18} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      {topics.length > 0 && (
        <View style={styles.topicChipsRow}>
          {topics.map((topic) => (
            <TouchableOpacity
              key={topic}
              style={styles.topicChip}
              onPress={() => onTopicsChange(topics.filter((t) => t !== topic))}
              activeOpacity={0.8}
            >
              <Text style={styles.topicChipText}>{topic}</Text>
              <Icon name="close" size={12} color={PRIMARY} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
};

export default function StudyPhotoScreen({ userProfile, onBack }) {
  const userId = userProfile?.id;

  const [activeTab, setActiveTab] = useState("analyze");

  // Flujo de análisis.
  const [imageUri, setImageUri] = useState(null);
  const [imagePath, setImagePath] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [content, setContent] = useState("");
  const [analysisDone, setAnalysisDone] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Clasificación de la tarjeta antes de guardarla.
  const [cardSpeciality, setCardSpeciality] = useState(null);
  const [topics, setTopics] = useState([]);
  const [topicDraft, setTopicDraft] = useState("");

  // Tarjetas guardadas.
  const [cards, setCards] = useState([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [selectedCard, setSelectedCard] = useState(null);
  const [deletingCard, setDeletingCard] = useState(false);
  // Edición de etiquetas desde el detalle de una tarjeta.
  const [editSpeciality, setEditSpeciality] = useState(null);
  const [editTopics, setEditTopics] = useState([]);
  const [editTopicDraft, setEditTopicDraft] = useState("");
  const [savingTags, setSavingTags] = useState(false);
  // Filtros de la lista de tarjetas (se combinan entre sí).
  const [filterSpeciality, setFilterSpeciality] = useState(null);
  const [filterTopic, setFilterTopic] = useState(null);

  const specialityOptions = useMemo(
    () =>
      getSpecialitiesCatalog().map((s) => ({ value: s.name, label: s.name })),
    []
  );

  // Para limpiar del bucket la foto subida si se sale sin guardar tarjeta.
  const pendingCleanupRef = useRef({ path: null });
  // Origen de la foto en curso ("camera" | "gallery"), solo para analítica.
  const imageSourceRef = useRef(null);

  useEffect(() => {
    posthogLogger.logScreen("StudyPhotoScreen");
    posthogLogger.capture("study_photo_opened");
    return () => {
      if (pendingCleanupRef.current.path) {
        removeStudyPhoto(pendingCleanupRef.current.path);
      }
    };
  }, []);

  const loadCards = async () => {
    if (!userId) return;
    setLoadingCards(true);
    const res = await getStudyCards(userId);
    if (res.success) setCards(res.cards);
    setLoadingCards(false);
  };

  useEffect(() => {
    if (activeTab === "cards") {
      setSelectedCard(null);
      loadCards();
    }
  }, [activeTab]);

  const discardPendingUpload = () => {
    if (pendingCleanupRef.current.path) {
      removeStudyPhoto(pendingCleanupRef.current.path);
      pendingCleanupRef.current.path = null;
    }
  };

  const resetAnalysis = () => {
    discardPendingUpload();
    setImageUri(null);
    setImagePath(null);
    setContent("");
    setAnalysisDone(false);
    setSaved(false);
    setCardSpeciality(null);
    setTopics([]);
    setTopicDraft("");
  };


  const applyPickedImage = (result, source) => {
    if (result.canceled || !result.assets?.length) return;
    resetAnalysis();
    setImageUri(result.assets[0].uri);
    imageSourceRef.current = source;
  };

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permiso necesario",
        "Necesitamos acceso a tu galería para subir la foto de la pregunta."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: false,
      quality: 0.7,
    });

    applyPickedImage(result, "gallery");
  };

  const handleTakePhoto = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permiso necesario",
        "Necesitamos acceso a la cámara para hacer la foto de la pregunta."
      );
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ["images"],
      quality: 0.7,
    });

    applyPickedImage(result, "camera");
  };

  const handleAnalyze = async () => {
    if (!imageUri || analyzing) return;

    setAnalyzing(true);
    setContent("");
    setAnalysisDone(false);
    setSaved(false);
    posthogLogger.capture("study_photo_analysis_started", {
      source: imageSourceRef.current,
    });

    try {
      let path = imagePath;
      if (!path) {
        const upload = await uploadStudyPhoto(userId, imageUri);
        if (!upload.success) {
          posthogLogger.capture("study_photo_analysis_failed", {
            stage: "upload",
          });
          Alert.alert(
            "No se pudo subir la imagen",
            upload.error || "Inténtalo de nuevo."
          );
          return;
        }
        path = upload.path;
        setImagePath(path);
        pendingCleanupRef.current.path = path;
      }

      const res = await analyzeStudyPhoto({
        imagePath: path,
        onChunk: (_chunk, accumulated) => setContent(accumulated),
      });

      if (!res.success) {
        posthogLogger.capture("study_photo_analysis_failed", {
          stage: "analysis",
        });
        Alert.alert(
          "No se pudo analizar la imagen",
          res.error || "Inténtalo de nuevo."
        );
        return;
      }

      setContent(res.content);
      setAnalysisDone(true);
      posthogLogger.capture("study_photo_analysis_completed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSaveCard = async () => {
    if (!analysisDone || saving || saved) return;

    setSaving(true);
    const res = await saveStudyCard({
      userId,
      imagePath,
      explanation: content,
      extractedQuestion: extractCardSummary(content),
      speciality: cardSpeciality,
      topics,
    });
    setSaving(false);

    if (!res.success) {
      Alert.alert(
        "No se pudo guardar la tarjeta",
        res.error || "Inténtalo de nuevo."
      );
      return;
    }

    // La imagen ya pertenece a una tarjeta: no hay que limpiarla al salir.
    pendingCleanupRef.current.path = null;
    setSaved(true);
    posthogLogger.capture("study_photo_card_saved", {
      has_speciality: Boolean(cardSpeciality),
      topics_count: topics.length,
    });
  };

  const openCard = (card) => {
    setSelectedCard(card);
    setEditSpeciality(card.speciality || null);
    setEditTopics(card.topics || []);
    setEditTopicDraft("");
  };

  const tagsDirty =
    selectedCard &&
    ((editSpeciality || null) !== (selectedCard.speciality || null) ||
      JSON.stringify(editTopics) !==
        JSON.stringify(selectedCard.topics || []));

  const handleSaveTags = async () => {
    if (!selectedCard || savingTags) return;

    setSavingTags(true);
    const res = await updateStudyCardTags(userId, selectedCard.id, {
      speciality: editSpeciality,
      topics: editTopics,
    });
    setSavingTags(false);

    if (!res.success) {
      Alert.alert(
        "No se pudieron guardar los cambios",
        res.error || "Inténtalo de nuevo."
      );
      return;
    }

    setCards((prev) => prev.map((c) => (c.id === res.card.id ? res.card : c)));
    setSelectedCard(res.card);
    posthogLogger.capture("study_photo_card_updated", {
      has_speciality: Boolean(res.card.speciality),
      topics_count: (res.card.topics || []).length,
    });
  };

  const confirmDeleteCard = (card) => {
    Alert.alert(
      "Eliminar tarjeta",
      "Se borrará la explicación y su imagen. ¿Seguro?",
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Eliminar",
          style: "destructive",
          onPress: async () => {
            setDeletingCard(true);
            const res = await deleteStudyCard(userId, card);
            setDeletingCard(false);
            if (!res.success) {
              Alert.alert(
                "No se pudo eliminar",
                res.error || "Inténtalo de nuevo."
              );
              return;
            }
            posthogLogger.capture("study_photo_card_deleted");
            setSelectedCard(null);
            setCards((prev) => prev.filter((c) => c.id !== card.id));
          },
        },
      ]
    );
  };

  const renderTabs = () => (
    <View style={styles.tabsRow}>
      {TABS.map((tab) => {
        const active = activeTab === tab.key;
        return (
          <TouchableOpacity
            key={tab.key}
            style={[styles.tabBtn, active && styles.tabBtnActive]}
            onPress={() => setActiveTab(tab.key)}
            activeOpacity={0.8}
          >
            <Icon
              name={tab.icon}
              size={16}
              color={active ? "#FFFFFF" : PRIMARY}
            />
            <Text style={[styles.tabText, active && styles.tabTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );

  const renderAnalyzeTab = () => (
    <>
      {!imageUri && (
        <View style={styles.emptyBox}>
          <Icon name="camera-outline" size={40} color="#94A3B8" />
          <Text style={styles.emptyTitle}>¿Una pregunta se te resiste?</Text>
          <Text style={styles.emptyText}>
            Sube una foto de la pregunta o del apunte que no entiendas y te lo
            explicamos paso a paso, sin jerga.
          </Text>
        </View>
      )}

      {imageUri && (
        <View style={styles.imagePreviewWrap}>
          <Image
            source={{ uri: imageUri }}
            style={styles.imagePreview}
            resizeMode="contain"
          />
        </View>
      )}

      <View style={styles.pickRow}>
        <TouchableOpacity
          style={[styles.secondaryBtn, styles.pickBtn, analyzing && styles.btnDisabled]}
          onPress={handleTakePhoto}
          disabled={analyzing}
          activeOpacity={0.8}
        >
          <Icon name="camera-outline" size={18} color={PRIMARY} />
          <Text style={styles.secondaryBtnText}>Hacer foto</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.secondaryBtn, styles.pickBtn, analyzing && styles.btnDisabled]}
          onPress={handlePickImage}
          disabled={analyzing}
          activeOpacity={0.8}
        >
          <Icon name="images-outline" size={18} color={PRIMARY} />
          <Text style={styles.secondaryBtnText}>
            {imageUri ? "Cambiar foto" : "Galería"}
          </Text>
        </TouchableOpacity>
      </View>

      {imageUri && !analysisDone && (
        <TouchableOpacity
          style={[styles.primaryBtn, analyzing && styles.btnDisabled]}
          onPress={handleAnalyze}
          disabled={analyzing}
          activeOpacity={0.8}
        >
          {analyzing ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Icon name="sparkles-outline" size={18} color="#FFFFFF" />
          )}
          <Text style={styles.primaryBtnText}>
            {analyzing ? "Analizando..." : "Analizar"}
          </Text>
        </TouchableOpacity>
      )}

      {!!content && (
        <View style={styles.resultCard}>
          <ExplanationMarkdown content={content} />
          {analyzing && (
            <ActivityIndicator
              size="small"
              color={PRIMARY}
              style={styles.streamingIndicator}
            />
          )}
        </View>
      )}

      {analyzing && !content && (
        <View style={styles.resultCard}>
          <View style={styles.thinkingRow}>
            <ActivityIndicator size="small" color={PRIMARY} />
            <Text style={styles.thinkingText}>Leyendo tu imagen...</Text>
          </View>
        </View>
      )}

      {analysisDone && (
        <>
          {!saved && (
            <TagEditor
              title="Clasifica tu tarjeta (opcional)"
              speciality={cardSpeciality}
              onSpecialityChange={setCardSpeciality}
              topics={topics}
              onTopicsChange={setTopics}
              topicDraft={topicDraft}
              onTopicDraftChange={setTopicDraft}
              specialityOptions={specialityOptions}
            />
          )}

          <TouchableOpacity
            style={[
              styles.primaryBtn,
              (saving || saved) && styles.btnDisabled,
            ]}
            onPress={handleSaveCard}
            disabled={saving || saved}
            activeOpacity={0.8}
          >
            <Icon
              name={saved ? "checkmark-circle" : "bookmark-outline"}
              size={18}
              color="#FFFFFF"
            />
            <Text style={styles.primaryBtnText}>
              {saved
                ? "Guardada en Mis tarjetas ✓"
                : saving
                ? "Guardando..."
                : "Guardar como tarjeta"}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryBtn}
            onPress={resetAnalysis}
            activeOpacity={0.8}
          >
            <Icon name="refresh-outline" size={18} color={PRIMARY} />
            <Text style={styles.secondaryBtnText}>Nueva consulta</Text>
          </TouchableOpacity>
        </>
      )}
    </>
  );

  const renderCardDetail = () => (
    <>
      <View style={styles.imagePreviewWrap}>
        <Image
          source={{ uri: getStudyPhotoUrl(selectedCard.image_path) }}
          style={styles.imagePreview}
          resizeMode="contain"
        />
      </View>

      <TagEditor
        title="Etiquetas"
        speciality={editSpeciality}
        onSpecialityChange={setEditSpeciality}
        topics={editTopics}
        onTopicsChange={setEditTopics}
        topicDraft={editTopicDraft}
        onTopicDraftChange={setEditTopicDraft}
        specialityOptions={specialityOptions}
      />

      {tagsDirty && (
        <TouchableOpacity
          style={[styles.primaryBtn, savingTags && styles.btnDisabled]}
          onPress={handleSaveTags}
          disabled={savingTags}
          activeOpacity={0.8}
        >
          <Icon name="checkmark-circle" size={18} color="#FFFFFF" />
          <Text style={styles.primaryBtnText}>
            {savingTags ? "Guardando..." : "Guardar cambios"}
          </Text>
        </TouchableOpacity>
      )}

      <View style={styles.resultCard}>
        <ExplanationMarkdown content={selectedCard.explanation} />
      </View>

      <TouchableOpacity
        style={[styles.dangerBtn, deletingCard && styles.btnDisabled]}
        onPress={() => confirmDeleteCard(selectedCard)}
        disabled={deletingCard}
        activeOpacity={0.8}
      >
        <Icon name="trash-outline" size={18} color={DANGER} />
        <Text style={styles.dangerBtnText}>
          {deletingCard ? "Eliminando..." : "Eliminar tarjeta"}
        </Text>
      </TouchableOpacity>
    </>
  );

  const renderCardsTab = () => {
    if (selectedCard) return renderCardDetail();

    if (loadingCards) {
      return (
        <ActivityIndicator size="large" color={PRIMARY} style={styles.loader} />
      );
    }

    if (cards.length === 0) {
      return (
        <View style={styles.emptyBox}>
          <Icon name="bookmark-outline" size={36} color="#94A3B8" />
          <Text style={styles.emptyText}>
            Aún no has guardado tarjetas. Analiza una foto y guarda la
            explicación para repasarla cuando quieras.
          </Text>
        </View>
      );
    }

    const specialities = [
      ...new Set(cards.map((c) => c.speciality).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "es"));
    const allTopics = [
      ...new Set(cards.flatMap((c) => c.topics || []).filter(Boolean)),
    ].sort((a, b) => a.localeCompare(b, "es"));

    // Si un filtro apunta a un valor que ya no existe (p. ej. tras borrar la
    // última tarjeta de un tema), se ignora para no dejar la lista vacía.
    const activeSpeciality = specialities.includes(filterSpeciality)
      ? filterSpeciality
      : null;
    const activeTopic = allTopics.includes(filterTopic) ? filterTopic : null;

    const visibleCards = cards.filter(
      (c) =>
        (!activeSpeciality || c.speciality === activeSpeciality) &&
        (!activeTopic || (c.topics || []).includes(activeTopic))
    );

    return (
      <>
        {(specialities.length > 0 || allTopics.length > 0) && (
          <>
            <View style={styles.filtersRow}>
              <SelectFilter
                label="Especialidad"
                value={activeSpeciality}
                onSelect={(value) => setFilterSpeciality(value || null)}
                options={specialities.map((s) => ({ value: s, label: s }))}
                placeholder="Todas"
                style={styles.filterItem}
              />
              <SelectFilter
                label="Tema"
                value={activeTopic}
                onSelect={(value) => setFilterTopic(value || null)}
                options={allTopics.map((t) => ({ value: t, label: t }))}
                placeholder="Todos"
                style={styles.filterItem}
              />
            </View>
            {(activeSpeciality || activeTopic) && (
              <Text style={styles.filterResultText}>
                {visibleCards.length === 1
                  ? "1 tarjeta"
                  : `${visibleCards.length} tarjetas`}
              </Text>
            )}
          </>
        )}

        {visibleCards.length === 0 ? (
          <View style={styles.emptyBox}>
            <Icon name="bookmark-outline" size={36} color="#94A3B8" />
            <Text style={styles.emptyText}>
              No hay tarjetas con estos filtros.
            </Text>
          </View>
        ) : null}

        {visibleCards.map((card) => (
          <TouchableOpacity
            key={card.id}
            style={styles.cardRow}
            onPress={() => openCard(card)}
            activeOpacity={0.8}
          >
            <Image
              source={{ uri: getStudyPhotoUrl(card.image_path) }}
              style={styles.cardThumb}
              resizeMode="cover"
            />
            <View style={styles.cardBody}>
              <Text style={styles.cardMeta}>
                {[
                  new Date(card.created_at).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  }),
                  card.speciality,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
              <Text style={styles.cardQuestion} numberOfLines={3}>
                {card.extracted_question || "Explicación guardada"}
              </Text>
              {(card.topics || []).length > 0 && (
                <Text style={styles.cardTopics} numberOfLines={1}>
                  {(card.topics || []).map((t) => `#${t}`).join("  ")}
                </Text>
              )}
            </View>
            <View style={styles.cardChevron}>
              <Icon name="chevron-forward" size={16} color="#94A3B8" />
            </View>
          </TouchableOpacity>
        ))}
      </>
    );
  };

  const inCardDetail = activeTab === "cards" && Boolean(selectedCard);

  return (
    <HeroScreenLayout
      title={inCardDetail ? "Tarjeta de estudio" : "Explícamelo fácil"}
      subtitle={
        inCardDetail
          ? new Date(selectedCard.created_at).toLocaleDateString("es-ES", {
              day: "numeric",
              month: "long",
              year: "numeric",
            })
          : "Sube la foto de una pregunta y entiéndela de una vez"
      }
      onBack={inCardDetail ? () => setSelectedCard(null) : onBack}
      bottomContent={inCardDetail ? null : renderTabs()}
      keyboardAvoiding
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {activeTab === "analyze" && renderAnalyzeTab()}
        {activeTab === "cards" && renderCardsTab()}

        <Text style={styles.disclaimer}>{DISCLAIMER}</Text>
      </ScrollView>
    </HeroScreenLayout>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
    paddingTop: 16,
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "rgba(103,12,245,0.08)",
  },
  tabBtnActive: {
    backgroundColor: PRIMARY,
  },
  tabText: {
    color: PRIMARY,
    fontSize: 13,
    fontWeight: "600",
  },
  tabTextActive: {
    color: "#FFFFFF",
  },
  emptyBox: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 16,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1E293B",
    textAlign: "center",
  },
  emptyText: {
    fontSize: 14,
    color: "#64748B",
    textAlign: "center",
    lineHeight: 20,
  },
  imagePreviewWrap: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#F1F5F9",
    marginBottom: 12,
  },
  imagePreview: {
    width: "100%",
    height: 220,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: PRIMARY,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 10,
  },
  primaryBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  secondaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.PRIMARY_SOFT,
    borderRadius: 12,
    paddingVertical: 13,
    marginBottom: 10,
  },
  secondaryBtnText: {
    color: PRIMARY,
    fontSize: 15,
    fontWeight: "700",
  },
  dangerBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    borderRadius: 12,
    paddingVertical: 13,
    marginTop: 4,
    marginBottom: 10,
  },
  dangerBtnText: {
    color: DANGER,
    fontSize: 15,
    fontWeight: "700",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  pickRow: {
    flexDirection: "row",
    gap: 10,
  },
  pickBtn: {
    flex: 1,
  },
  resultCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  streamingIndicator: {
    marginTop: 10,
  },
  thinkingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  thinkingText: {
    fontSize: 14,
    color: "#64748B",
  },
  mdHeading: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1E293B",
    marginTop: 12,
    marginBottom: 6,
  },
  mdParagraph: {
    fontSize: 14,
    color: "#334155",
    lineHeight: 21,
    marginBottom: 6,
  },
  mdBold: {
    fontWeight: "700",
    color: "#1E293B",
  },
  mdBulletRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 4,
    paddingRight: 8,
  },
  mdBulletDot: {
    color: PRIMARY,
    fontSize: 14,
    lineHeight: 21,
  },
  mdBulletText: {
    flex: 1,
    fontSize: 14,
    color: "#334155",
    lineHeight: 21,
  },
  loader: {
    marginTop: 32,
  },
  cardRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 12,
    marginBottom: 10,
    gap: 12,
  },
  cardThumb: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: "#F1F5F9",
  },
  cardBody: {
    flex: 1,
  },
  cardMeta: {
    fontSize: 12,
    color: "#94A3B8",
    marginBottom: 4,
  },
  cardQuestion: {
    fontSize: 14,
    color: "#1E293B",
    lineHeight: 19,
  },
  cardChevron: {
    paddingLeft: 4,
  },
  cardTopics: {
    fontSize: 12,
    color: PRIMARY,
    marginTop: 4,
  },
  tagForm: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    padding: 14,
    marginBottom: 12,
  },
  tagFormTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1E293B",
    marginBottom: 10,
  },
  topicInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 10,
  },
  topicInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 14,
    color: "#1E293B",
    backgroundColor: "#F8FAFC",
  },
  topicAddBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 10,
    padding: 10,
  },
  topicChipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
    marginBottom: 2,
  },
  topicChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.PRIMARY_SOFT,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  topicChipText: {
    fontSize: 12,
    fontWeight: "600",
    color: PRIMARY,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingTop: 12,
    borderWidth: 1,
    borderColor: "rgba(103,12,245,0.08)",
    shadowColor: "#0F172A",
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  filterItem: {
    flex: 1,
  },
  filterResultText: {
    fontSize: 12,
    color: "#64748B",
    marginBottom: 8,
  },
  disclaimer: {
    fontSize: 11,
    color: "#94A3B8",
    textAlign: "center",
    marginTop: 16,
    lineHeight: 16,
  },
});
