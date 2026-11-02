import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { HeroScreenLayout } from "../../HeroScreenLayout";
import { FloatingActionButton } from "../../FloatingActionButton";
import { Icon } from "../../Icon";
import { COLORS } from "../../../constants/colors";
import { ResiNotesSheet, SheetOption } from "../ResiNotesSheet";
import { createManualFlashcard, flashcardErrorMessage, listFlashcards } from "../../../services/flashcardService";
import { cardDisplayState, filterCards, formatNextReview, localDateString } from "../../../utils/flashcards";
import { CardEditorSheet, PrimaryButton, SecondaryButton, SourceMeta, StateChip, flashcardStyles as fs } from "./FlashcardParts";

/**
 * «Mis tarjetas» (ClickUp 124b4z9w0z0): todas las tarjetas con su apunte de
 * origen, estado y próximo repaso. Buscar, filtrar por estado y por carpeta, y
 * crear una a mano con el botón +.
 */

const TABS = [
  { key: "all", label: "Todas" },
  { key: "active", label: "Activas" },
  { key: "suspended", label: "Suspendidas" },
  { key: "review", label: "Por revisar" },
];

export const MyCardsView = ({ userId, library, onBack, onOpenCard, onCreateFromNotes, onSettings }) => {
  const [state, setState] = useState({ loading: true, error: null, cards: [] });
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [folderId, setFolderId] = useState(null);
  const [folderSheet, setFolderSheet] = useState(false);
  const [manual, setManual] = useState(false);

  const folderName = useCallback(
    (id) => (id ? library.folders.find((f) => f.id === id)?.name || null : null),
    [library.folders]
  );

  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));
    try {
      const cards = await listFlashcards(userId);
      setState({ loading: false, error: null, cards });
    } catch {
      setState({ loading: false, error: "No se han podido cargar tus tarjetas. Revisa tu conexión.", cards: [] });
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const today = localDateString();
  const counts = useMemo(() => {
    const c = { all: 0, active: 0, suspended: 0, review: 0 };
    state.cards.forEach((card) => {
      c.all += 1;
      const s = cardDisplayState(card);
      if (s === "active") c.active += 1;
      else if (s === "suspended") c.suspended += 1;
      else c.review += 1;
    });
    return c;
  }, [state.cards]);
  const visible = useMemo(() => filterCards(state.cards, { tab, query, folderId }), [state.cards, tab, query, folderId]);
  const usedFolders = useMemo(() => {
    const ids = new Set(state.cards.map((c) => c.source?.folder_id).filter(Boolean));
    return library.folders.filter((f) => ids.has(f.id)).sort((a, b) => a.name.localeCompare(b.name, "es"));
  }, [state.cards, library.folders]);

  const submitManual = async (values) => {
    try {
      await createManualFlashcard(userId, values);
    } catch (error) {
      error.userMessage = flashcardErrorMessage(error);
      throw error;
    }
    setManual(false);
    load();
  };

  const renderCard = ({ item: card }) => {
    const state = cardDisplayState(card);
    return (
      <TouchableOpacity
        style={[fs.card, styles.row]}
        onPress={() => onOpenCard(card.id)}
        accessibilityRole="button"
        testID={`flashcards-card-${card.id}`}
      >
        <Text style={styles.question} numberOfLines={3}>
          {card.question}
        </Text>
        <SourceMeta card={card} folderName={folderName(card.source?.folder_id)} />
        <View style={styles.rowFooter}>
          <StateChip card={card} />
          {state === "active" ? (
            <Text style={styles.next}>Próximo repaso: {formatNextReview(card.due_on, today).toLowerCase()}</Text>
          ) : null}
        </View>
      </TouchableOpacity>
    );
  };

  const header = (
    <>
      <View style={styles.search}>
        <Icon name="search" size={20} color={COLORS.TEXT_LIGHT} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar tarjetas…"
          placeholderTextColor={COLORS.TEXT_LIGHT}
          style={styles.searchInput}
          accessibilityLabel="Buscar tarjetas"
          testID="flashcards-search"
        />
        <TouchableOpacity
          onPress={() => setFolderSheet(true)}
          accessibilityRole="button"
          accessibilityLabel="Filtrar por carpeta"
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Icon name="options-outline" size={22} color={folderId ? COLORS.PRIMARY : COLORS.TEXT_LIGHT} />
        </TouchableOpacity>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs}>
        {TABS.filter((t) => t.key !== "review" || counts.review > 0).map((t) => {
          const active = tab === t.key;
          return (
            <TouchableOpacity
              key={t.key}
              style={[styles.tab, active && styles.tabActive]}
              onPress={() => setTab(t.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              testID={`flashcards-tab-${t.key}`}
            >
              <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {t.label} ({counts[t.key]})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      {folderId ? (
        <TouchableOpacity style={styles.folderFilter} onPress={() => setFolderId(null)} accessibilityRole="button">
          <Icon name="folder-outline" size={16} color={COLORS.PRIMARY} />
          <Text style={styles.folderFilterText}>{folderName(folderId)}</Text>
          <Icon name="close" size={16} color={COLORS.PRIMARY} />
        </TouchableOpacity>
      ) : null}
    </>
  );

  const renderEmpty = () => {
    if (state.loading) {
      return (
        <View style={fs.center}>
          <ActivityIndicator color={COLORS.PRIMARY} />
        </View>
      );
    }
    if (state.error) {
      return (
        <View style={fs.center}>
          <Text style={fs.emptyText}>{state.error}</Text>
          <SecondaryButton label="Reintentar" onPress={load} />
        </View>
      );
    }
    if (!state.cards.length) {
      return (
        <View style={fs.center} testID="flashcards-none">
          <Icon name="cards-outline" size={40} color={COLORS.PRIMARY} />
          <Text style={fs.emptyTitle}>Todavía no tienes tarjetas</Text>
          <Text style={fs.emptyText}>Empieza creando tarjetas desde uno de tus apuntes.</Text>
          <PrimaryButton label="Crear tarjetas" onPress={onCreateFromNotes} />
        </View>
      );
    }
    return (
      <View style={fs.center}>
        <Text style={fs.emptyText}>{query ? "Ninguna tarjeta coincide con tu búsqueda." : "No hay tarjetas aquí."}</Text>
      </View>
    );
  };

  return (
    <HeroScreenLayout
      title="Mis tarjetas"
      onBack={onBack}
      rightSlot={
        onSettings ? (
          <TouchableOpacity
            style={styles.headerButton}
            onPress={onSettings}
            accessibilityRole="button"
            accessibilityLabel="Configuración de repaso"
            testID="flashcards-settings"
          >
            <Icon name="settings-outline" size={22} color={COLORS.PRIMARY} />
          </TouchableOpacity>
        ) : null
      }
      overlay={
        <>
          <FloatingActionButton
            onPress={() => setManual(true)}
            style={styles.fab}
            testID="flashcards-new-manual"
            accessibilityLabel="Crear una tarjeta a mano"
          />
          <CardEditorSheet
            visible={manual}
            title="Nueva tarjeta"
            initial={null}
            notice="Las tarjetas que creas a mano se identifican como manuales."
            onSubmit={submitManual}
            onClose={() => setManual(false)}
          />
          <ResiNotesSheet visible={folderSheet} title="Filtrar por carpeta" onClose={() => setFolderSheet(false)}>
            <SheetOption
              icon="grid-outline"
              label="Todas las carpetas"
              onPress={() => {
                setFolderId(null);
                setFolderSheet(false);
              }}
            />
            {usedFolders.map((f) => (
              <SheetOption
                key={f.id}
                emoji={f.emoji || "📁"}
                label={f.name}
                onPress={() => {
                  setFolderId(f.id);
                  setFolderSheet(false);
                }}
              />
            ))}
          </ResiNotesSheet>
        </>
      }
    >
      <FlatList
        data={state.loading || state.error ? [] : visible}
        keyExtractor={(c) => c.id}
        renderItem={renderCard}
        ListHeaderComponent={header}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={fs.content}
        keyboardShouldPersistTaps="handled"
        onRefresh={load}
        refreshing={false}
        initialNumToRender={15}
        windowSize={7}
      />
    </HeroScreenLayout>
  );
};

const styles = StyleSheet.create({
  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.WHITE,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  searchInput: { flex: 1, fontSize: 16, color: COLORS.TEXT_DARK, paddingVertical: 0 },
  tabs: { gap: 8, paddingVertical: 12 },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: COLORS.WHITE,
    borderWidth: 1,
    borderColor: COLORS.BORDER,
  },
  tabActive: { backgroundColor: COLORS.PRIMARY, borderColor: COLORS.PRIMARY },
  tabText: { fontSize: 14, fontWeight: "600", color: COLORS.TEXT_MEDIUM },
  tabTextActive: { color: COLORS.WHITE },
  folderFilter: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: COLORS.PRIMARY_LIGHT,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 10,
  },
  folderFilterText: { fontSize: 13, fontWeight: "700", color: COLORS.PRIMARY },
  row: { gap: 8 },
  question: { fontSize: 15, fontWeight: "700", color: COLORS.PRIMARY_DARK, lineHeight: 21 },
  rowFooter: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  next: { fontSize: 12, color: COLORS.TEXT_LIGHT },
  fab: { bottom: 28 },
});

export default MyCardsView;
