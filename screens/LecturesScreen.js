import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { FloatingActionButton } from "../components/FloatingActionButton";
import { ScreenHeader } from "../components/ScreenHeader";
import { ScreenScaffold } from "../components/ScreenScaffold";
import { useLectures } from "../hooks/useLectures";
import { useHospitals } from "../hooks/useHospitals";
import { formatShortDate } from "../utils/dateUtils";
import { filterCoursesBySearch, openURL } from "../utils/courseUtils";
import posthogLogger from "../services/posthogService";

const PRIMARY = "#670CF5";
const SECONDARY = "#00BD7C";
const ACCENT = "#1B0977";
const BG_LIGHT = "#F8F9FE";
const CARD_BORDER = "#F1F5F9";
const MUTED = "#64748B";
const MUTED_LIGHT = "#94A3B8";
const DANGER = "#EF4444";

function RadioDot({ selected }) {
  return (
    <View
      style={[
        modal.radioDot,
        selected ? modal.radioDotSelected : modal.radioDotUnselected,
      ]}
    >
      {selected ? <View style={modal.radioDotInner} /> : null}
    </View>
  );
}

function FilterModal({
  visible,
  onClose,
  title,
  options,
  value,
  onSelect,
  placeholder,
}) {
  const insets = useSafeAreaInsets();
  const [search, setSearch] = useState("");
  const [tempValue, setTempValue] = useState(value);

  useEffect(() => {
    if (visible) {
      setTempValue(value);
    }
  }, [value, visible]);

  const filteredOptions = useMemo(() => {
    if (!search.trim()) return options;
    const lower = search.toLowerCase();
    return options.filter((option) => option.name.toLowerCase().includes(lower));
  }, [options, search]);

  const listData = useMemo(() => {
    const data = [];
    if (value) {
      data.push({ id: "", name: placeholder });
    }
    data.push(...filteredOptions);
    return data;
  }, [filteredOptions, placeholder, value]);

  const handleClose = useCallback(() => {
    setSearch("");
    onClose();
  }, [onClose]);

  const handleConfirm = useCallback(() => {
    onSelect(tempValue);
    setSearch("");
    onClose();
  }, [onClose, onSelect, tempValue]);

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="slide"
      onRequestClose={handleClose}
    >
      <View style={modal.container}>
        <View style={[modal.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <TouchableOpacity style={modal.backBtn} onPress={handleClose}>
            <Ionicons name="arrow-back" size={24} color={ACCENT} />
          </TouchableOpacity>
          <Text style={modal.title}>{title}</Text>
          <View style={modal.backBtn} />
        </View>

        <View style={modal.searchWrap}>
          <View style={modal.searchInner}>
            <Ionicons name="search" size={20} color={MUTED_LIGHT} />
            <TextInput
              style={modal.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder="Buscar..."
              placeholderTextColor={MUTED_LIGHT}
              returnKeyType="done"
            />
            {search.length > 0 ? (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Ionicons name="close-circle" size={18} color={MUTED_LIGHT} />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <FlatList
          data={listData}
          keyExtractor={(item, index) => `${String(item.id ?? "")}-${index}`}
          keyboardShouldPersistTaps="always"
          contentContainerStyle={modal.listContent}
          renderItem={({ item }) => {
            const isClear = item.id === "";
            const isSelected = !isClear && item.id === tempValue;

            return (
              <Pressable
                style={({ pressed }) => [
                  modal.option,
                  isSelected && modal.optionSelected,
                  isClear && modal.optionClear,
                  pressed && { opacity: 0.78 },
                ]}
                onPress={() => setTempValue(isClear ? "" : item.id)}
              >
                <Text
                  style={[
                    modal.optionName,
                    isSelected && modal.optionNameSelected,
                    isClear && modal.optionNameClear,
                  ]}
                >
                  {item.name}
                </Text>
                {isClear ? null : <RadioDot selected={isSelected} />}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <View style={modal.empty}>
              <Text style={modal.emptyText}>Sin resultados</Text>
            </View>
          }
        />

        <View
          style={[modal.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}
        >
          <TouchableOpacity
            style={modal.confirmBtn}
            onPress={handleConfirm}
            activeOpacity={0.88}
          >
            <Text style={modal.confirmText}>Confirmar selección</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

function CourseListCard({ course, isMine, onPress }) {
  const dateLabel = useMemo(() => {
    const dates = Array.isArray(course.event_dates)
      ? [...course.event_dates].sort()
      : [];
    if (dates.length === 0) return "Sin fecha";
    if (dates.length === 1) return formatShortDate(dates[0]);
    return `${formatShortDate(dates[0])} - ${formatShortDate(
      dates[dates.length - 1]
    )}`;
  }, [course.event_dates]);

  const metaBadges = [
    course.speciality?.name
      ? {
          key: "speciality",
          icon: "medkit-outline",
          text: course.speciality.name,
          tone: "purple",
        }
      : null,
    course.price_text
      ? {
          key: "price",
          icon: "cash-outline",
          text: course.price_text,
          tone: "green",
        }
      : null,
    course.seats_available
      ? {
          key: "seats",
          icon: "people-outline",
          text: `${course.seats_available} plazas`,
          tone: "blue",
        }
      : null,
  ].filter(Boolean);

  return (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.88}
      onPress={() => onPress(course)}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.cardIcon}>
          <Ionicons name="school-outline" size={22} color={PRIMARY} />
        </View>

        <View style={styles.cardHeading}>
          <View style={styles.cardTitleRow}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {course.title}
            </Text>
            {isMine ? (
              <View style={styles.mineBadge}>
                <Text style={styles.mineBadgeText}>Mío</Text>
              </View>
            ) : null}
          </View>
          {course.organization ? (
            <Text style={styles.cardOrg} numberOfLines={1}>
              {course.organization}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.cardInfoList}>
        <View style={styles.cardInfoRow}>
          <Ionicons name="calendar-outline" size={16} color={MUTED_LIGHT} />
          <Text style={styles.cardInfoText}>
            {dateLabel}
            {course.event_dates?.length > 1 ? ` · ${course.event_dates.length} días` : ""}
          </Text>
        </View>

        {course.teaching_hours ? (
          <View style={styles.cardInfoRow}>
            <Ionicons name="time-outline" size={16} color={MUTED_LIGHT} />
            <Text style={styles.cardInfoText}>{course.teaching_hours}</Text>
          </View>
        ) : null}

        {course.venue_name ? (
          <View style={styles.cardInfoRow}>
            <Ionicons name="location-outline" size={16} color={MUTED_LIGHT} />
            <Text style={styles.cardInfoText} numberOfLines={1}>
              {course.venue_name}
            </Text>
          </View>
        ) : null}

        {course.hospital ? (
          <View style={styles.cardInfoRow}>
            <Ionicons name="business-outline" size={16} color={MUTED_LIGHT} />
            <Text style={styles.cardInfoText} numberOfLines={1}>
              {course.hospital.name}
              {course.hospital.city ? ` · ${course.hospital.city}` : ""}
            </Text>
          </View>
        ) : null}
      </View>

      {metaBadges.length > 0 ? (
        <View style={styles.cardBadgesRow}>
          {metaBadges.map((badge) => (
            <View
              key={badge.key}
              style={[
                styles.metaBadge,
                badge.tone === "purple" && styles.metaBadgePurple,
                badge.tone === "green" && styles.metaBadgeGreen,
                badge.tone === "blue" && styles.metaBadgeBlue,
              ]}
            >
              <Ionicons
                name={badge.icon}
                size={14}
                color={
                  badge.tone === "purple"
                    ? PRIMARY
                    : badge.tone === "green"
                      ? SECONDARY
                      : "#2563EB"
                }
              />
              <Text
                style={[
                  styles.metaBadgeText,
                  badge.tone === "purple" && styles.metaBadgeTextPurple,
                  badge.tone === "green" && styles.metaBadgeTextGreen,
                  badge.tone === "blue" && styles.metaBadgeTextBlue,
                ]}
                numberOfLines={1}
              >
                {badge.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        {course.course_code ? (
          <Text style={styles.courseCode}>Código {course.course_code}</Text>
        ) : (
          <View />
        )}

        {course.registration_url ? (
          <TouchableOpacity
            style={styles.registerInline}
            onPress={(event) => {
              event.stopPropagation();
              openURL(course.registration_url);
            }}
          >
            <Text style={styles.registerInlineText}>Inscribirse</Text>
            <Ionicons name="arrow-forward" size={16} color={PRIMARY} />
          </TouchableOpacity>
        ) : (
          <View style={styles.registerInlineGhost}>
            <Text style={styles.registerInlineGhostText}>Ver detalle</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export const LecturesScreen = ({ userProfile, navigation, onBack }) => {
  const insets = useSafeAreaInsets();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedHospital, setSelectedHospital] = useState("");
  const defaultSpecialtyId = userProfile?.speciality_id || "";
  const [selectedSpecialty, setSelectedSpecialty] = useState(defaultSpecialtyId);
  const [openModal, setOpenModal] = useState(null);

  const {
    courses,
    loading,
    error,
    hasMore,
    setFilters,
    loadMoreCourses,
    refreshCourses,
    showMyCourses,
    setShowMyCourses,
    currentUserId,
  } = useLectures();
  const { hospitals, specialties } = useHospitals();

  useEffect(() => {
    posthogLogger.logScreen("LecturesScreen");
  }, []);

  useEffect(() => {
    if (defaultSpecialtyId && !selectedSpecialty) {
      setSelectedSpecialty(defaultSpecialtyId);
    }
  }, [defaultSpecialtyId, selectedSpecialty]);

  useEffect(() => {
    setFilters({
      hospital_id: selectedHospital,
      speciality_id: selectedSpecialty,
    });
  }, [selectedHospital, selectedSpecialty, setFilters]);

  const filteredCourses = useMemo(
    () => filterCoursesBySearch(courses, searchTerm),
    [courses, searchTerm]
  );

  const hospitalOptions = useMemo(
    () =>
      hospitals
        .filter((hospital) => hospital?.id && hospital?.name)
        .map((hospital) => ({
          id: hospital.id,
          name: hospital.name,
        })),
    [hospitals]
  );
  const specialtyOptions = useMemo(
    () =>
      specialties
        .filter((specialty) => specialty?.id && specialty?.name)
        .map((specialty) => ({
          id: specialty.id,
          name: specialty.name,
        })),
    [specialties]
  );

  const selectedHospitalName = useMemo(
    () => hospitalOptions.find((item) => item.id === selectedHospital)?.name,
    [hospitalOptions, selectedHospital]
  );
  const selectedSpecialtyName = useMemo(
    () => specialtyOptions.find((item) => item.id === selectedSpecialty)?.name,
    [selectedSpecialty, specialtyOptions]
  );

  const hasActiveFilters = Boolean(
    searchTerm ||
      selectedHospital ||
      showMyCourses ||
      (selectedSpecialty && selectedSpecialty !== defaultSpecialtyId)
  );

  const handleClearFilters = useCallback(() => {
    setSearchTerm("");
    setSelectedHospital("");
    setSelectedSpecialty(defaultSpecialtyId);
    setShowMyCourses(false);
    setFilters({
      hospital_id: "",
      speciality_id: defaultSpecialtyId,
    });
  }, [defaultSpecialtyId, setFilters, setShowMyCourses]);

  const handleCoursePress = useCallback(
    (course) => {
      navigation?.navigate?.("courseDetail", { courseId: course.id });
    },
    [navigation]
  );

  const isInitialLoading = loading && courses.length === 0;
  const courseCountLabel = `${filteredCourses.length} ${
    filteredCourses.length === 1 ? "curso" : "cursos"
  }`;
  const header = (
    <ScreenHeader
      title="Cursos"
      onBack={onBack}
      compact
      rightSlot={
        <View style={styles.countBadge}>
          <Text style={styles.countText}>
            {filteredCourses.length} {filteredCourses.length === 1 ? "CURSO" : "CURSOS"}
          </Text>
        </View>
      }
    />
  );

  return (
    <ScreenScaffold header={header} contentSurfaceStyle={styles.contentSurface}>
      <View style={styles.searchWrap}>
        <Ionicons
          name="search"
          size={20}
          color={MUTED_LIGHT}
          style={styles.searchIcon}
        />
        <TextInput
          style={styles.searchInput}
          placeholder="Buscar por título, entidad o sede"
          placeholderTextColor={MUTED_LIGHT}
          value={searchTerm}
          onChangeText={setSearchTerm}
          returnKeyType="search"
        />
        {searchTerm.length > 0 ? (
          <TouchableOpacity onPress={() => setSearchTerm("")}>
            <Ionicons name="close-circle" size={18} color={MUTED_LIGHT} />
          </TouchableOpacity>
        ) : null}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filtersScroll}
        contentContainerStyle={styles.filtersRow}
      >
        <TouchableOpacity
          style={[styles.chip, showMyCourses && styles.chipActive]}
          onPress={() => setShowMyCourses((value) => !value)}
        >
          <Ionicons
            name={showMyCourses ? "person" : "person-outline"}
            size={16}
            color={showMyCourses ? PRIMARY : ACCENT}
          />
          <Text style={[styles.chipText, showMyCourses && styles.chipTextActive]}>
            Mis cursos
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, selectedHospital && styles.chipActive]}
          onPress={() => setOpenModal("hospital")}
        >
          <Ionicons
            name="business-outline"
            size={16}
            color={selectedHospital ? PRIMARY : ACCENT}
          />
          <Text
            style={[styles.chipText, selectedHospital && styles.chipTextActive]}
            numberOfLines={1}
          >
            {selectedHospitalName || "Hospital"}
          </Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={selectedHospital ? PRIMARY : ACCENT}
          />
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.chip, selectedSpecialty && styles.chipActive]}
          onPress={() => setOpenModal("specialty")}
        >
          <Ionicons
            name="medkit-outline"
            size={16}
            color={selectedSpecialty ? PRIMARY : ACCENT}
          />
          <Text
            style={[styles.chipText, selectedSpecialty && styles.chipTextActive]}
            numberOfLines={1}
          >
            {selectedSpecialtyName || "Especialidad"}
          </Text>
          <Ionicons
            name="chevron-down"
            size={16}
            color={selectedSpecialty ? PRIMARY : ACCENT}
          />
        </TouchableOpacity>

      </ScrollView>

      {isInitialLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={PRIMARY} />
          <Text style={styles.loadingText}>Cargando cursos...</Text>
        </View>
      ) : (
        <FlatList
          data={filteredCourses}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <CourseListCard
              course={item}
              isMine={Boolean(currentUserId && item.created_by_id === currentUserId)}
              onPress={handleCoursePress}
            />
          )}
          refreshControl={
            <RefreshControl
              refreshing={loading && courses.length > 0}
              onRefresh={refreshCourses}
              tintColor={PRIMARY}
            />
          }
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: 96 + insets.bottom },
          ]}
          ListHeaderComponent={
            <>
              {error ? (
                <View style={styles.errorCard}>
                  <Ionicons name="alert-circle" size={20} color={DANGER} />
                  <Text style={styles.errorText}>{error}</Text>
                </View>
              ) : null}

              <View style={styles.sectionRow}>
                <Text style={styles.sectionLabel}>
                  {hasActiveFilters ? courseCountLabel : "Próximos cursos"}
                </Text>
                {hasActiveFilters ? (
                  <TouchableOpacity
                    style={styles.sectionAction}
                    onPress={handleClearFilters}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.sectionActionText}>Restablecer filtros</Text>
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.sectionCount}>{courseCountLabel}</Text>
                )}
              </View>
            </>
          }
          ListFooterComponent={
            filteredCourses.length > 0 ? (
              <View style={styles.footerBlock}>
                {hasMore ? (
                  <TouchableOpacity
                    style={[styles.loadMoreButton, loading && styles.buttonDisabled]}
                    onPress={loadMoreCourses}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.loadMoreText}>Cargar más cursos</Text>
                        <Ionicons name="arrow-down" size={16} color="#FFFFFF" />
                      </>
                    )}
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.footerHint}>
                    No hay más cursos activos por cargar.
                  </Text>
                )}
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <View style={styles.emptyIconWrap}>
                <Ionicons name="school-outline" size={36} color={PRIMARY} />
              </View>
              <Text style={styles.emptyTitle}>No se encontraron cursos</Text>
              <Text style={styles.emptyText}>
                Ajusta la búsqueda o cambia los filtros para ver más formaciones.
              </Text>
              {hasActiveFilters ? (
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={handleClearFilters}
                >
                  <Text style={styles.emptyButtonText}>Quitar filtros</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
        />
      )}

      <FloatingActionButton
        onPress={() => navigation?.navigate?.("createCourse")}
        icon="add"
        backgroundColor={PRIMARY}
        bottom={24 + insets.bottom}
        right={20}
      />

      <FilterModal
        visible={openModal === "hospital"}
        onClose={() => setOpenModal(null)}
        title="Filtrar por hospital"
        options={hospitalOptions}
        value={selectedHospital}
        onSelect={setSelectedHospital}
        placeholder="Todos los hospitales"
      />
      <FilterModal
        visible={openModal === "specialty"}
        onClose={() => setOpenModal(null)}
        title="Filtrar por especialidad"
        options={specialtyOptions}
        value={selectedSpecialty}
        onSelect={setSelectedSpecialty}
        placeholder="Todas las especialidades"
      />
    </ScreenScaffold>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  contentSurface: {
    flex: 1,
    backgroundColor: BG_LIGHT,
  },
  countBadge: {
    backgroundColor: `${PRIMARY}12`,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: `${PRIMARY}25`,
  },
  countText: {
    fontSize: 10,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.8,
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingLeft: 44,
    paddingRight: 16,
    position: "relative",
    marginBottom: 4,
  },
  searchIcon: {
    position: "absolute",
    left: 16,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: ACCENT,
    padding: 0,
  },
  filtersScroll: {
    flexGrow: 0,
    flexShrink: 0,
    marginTop: 6,
    marginBottom: 4,
  },
  filtersRow: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingRight: 24,
  },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#F8FAFC",
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  chipActive: {
    backgroundColor: `${PRIMARY}12`,
    borderColor: `${PRIMARY}30`,
  },
  chipText: {
    fontSize: 13,
    fontWeight: "600",
    color: ACCENT,
    flexShrink: 1,
    maxWidth: 132,
  },
  chipTextActive: {
    color: PRIMARY,
  },
  chipClear: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  chipClearText: {
    fontSize: 13,
    fontWeight: "600",
    color: DANGER,
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 72,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 15,
    color: MUTED,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
  },
  errorCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF2F2",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FECACA",
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  errorText: {
    flex: 1,
    color: DANGER,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingVertical: 8,
    paddingBottom: 10,
  },
  sectionLabel: {
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
  },
  sectionCount: {
    fontSize: 11,
    fontWeight: "700",
    color: PRIMARY,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  sectionAction: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: `${PRIMARY}10`,
    borderWidth: 1,
    borderColor: `${PRIMARY}20`,
  },
  sectionActionText: {
    fontSize: 12,
    fontWeight: "700",
    color: PRIMARY,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  cardTopRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  cardIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: `${PRIMARY}12`,
    alignItems: "center",
    justifyContent: "center",
  },
  cardHeading: {
    flex: 1,
    minWidth: 0,
  },
  cardTitleRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: ACCENT,
    lineHeight: 23,
  },
  mineBadge: {
    backgroundColor: `${SECONDARY}16`,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  mineBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: SECONDARY,
  },
  cardOrg: {
    marginTop: 4,
    fontSize: 14,
    color: MUTED,
  },
  cardInfoList: {
    gap: 10,
    marginTop: 16,
  },
  cardInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cardInfoText: {
    flex: 1,
    fontSize: 14,
    color: MUTED,
    lineHeight: 20,
  },
  cardBadgesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 14,
  },
  metaBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  metaBadgePurple: {
    backgroundColor: `${PRIMARY}10`,
  },
  metaBadgeGreen: {
    backgroundColor: `${SECONDARY}12`,
  },
  metaBadgeBlue: {
    backgroundColor: "#DBEAFE",
  },
  metaBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    maxWidth: 190,
  },
  metaBadgeTextPurple: {
    color: PRIMARY,
  },
  metaBadgeTextGreen: {
    color: SECONDARY,
  },
  metaBadgeTextBlue: {
    color: "#2563EB",
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
    gap: 12,
  },
  courseCode: {
    flex: 1,
    fontSize: 12,
    color: MUTED_LIGHT,
    fontWeight: "600",
  },
  registerInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  registerInlineText: {
    fontSize: 14,
    fontWeight: "700",
    color: PRIMARY,
  },
  registerInlineGhost: {
    paddingHorizontal: 2,
  },
  registerInlineGhostText: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
  },
  emptyContainer: {
    alignItems: "center",
    paddingVertical: 56,
    paddingHorizontal: 24,
  },
  emptyIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${PRIMARY}12`,
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: ACCENT,
    textAlign: "center",
  },
  emptyText: {
    marginTop: 8,
    fontSize: 15,
    color: MUTED,
    textAlign: "center",
    lineHeight: 22,
  },
  emptyButton: {
    marginTop: 18,
    backgroundColor: PRIMARY,
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  emptyButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  footerBlock: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 12,
  },
  loadMoreButton: {
    minWidth: 200,
    backgroundColor: PRIMARY,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  loadMoreText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  footerHint: {
    fontSize: 13,
    color: MUTED_LIGHT,
  },
});

const modal = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 14,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 18,
    fontWeight: "700",
    color: ACCENT,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: ACCENT,
    padding: 0,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  option: {
    minHeight: 58,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  optionSelected: {
    borderColor: `${PRIMARY}40`,
    backgroundColor: `${PRIMARY}10`,
  },
  optionClear: {
    backgroundColor: "#F8FAFC",
  },
  optionName: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: ACCENT,
  },
  optionNameSelected: {
    color: PRIMARY,
  },
  optionNameClear: {
    color: MUTED,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: CARD_BORDER,
  },
  confirmBtn: {
    backgroundColor: PRIMARY,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 15,
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  empty: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    color: MUTED_LIGHT,
    fontSize: 14,
  },
  radioDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
  },
  radioDotSelected: {
    borderColor: PRIMARY,
  },
  radioDotUnselected: {
    borderColor: "#CBD5E1",
  },
  radioDotInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: PRIMARY,
  },
});

export default LecturesScreen;
