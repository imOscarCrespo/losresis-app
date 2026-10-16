import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon } from "../Icon";
import { MotionPressable } from "../MotionPressable";
import { didCityLoadFail } from "../../services/geoCatalog";
import {
  getCityLabelByCode,
  getCountryOptions,
  searchCities,
  searchCountries,
} from "../../utils/geoSearch";
import { normalizeSearchText } from "../../utils/filterUtils";

const ACCENT = "#1B0977";
const PRIMARY = "#670CF5";
const MUTED = "#64748B";

const countryNameOf = (isoCode) =>
  getCountryOptions().find((option) => option.isoCode === isoCode)?.label || "";

/** Texto que se enseña para un valor guardado (nombre del catálogo o texto libre). */
export const getLocationDisplayLabel = (kind, value, countryCode) => {
  if (!value) return "";
  if (kind === "country") {
    return (
      getCountryOptions().find(
        (option) => normalizeSearchText(option.id) === normalizeSearchText(value)
      )?.label || value
    );
  }
  return getCityLabelByCode(countryCode, value);
};

/**
 * Selector de país o ciudad de Rotaciones Externas, a pantalla completa.
 *
 * Un toque elige y cierra. `onSelect` recibe la opción (`id` es lo que se guarda
 * en BD) o `null` si se quita la selección. En ciudades, si lo escrito no está en
 * el catálogo, se ofrece usarlo tal cual (`custom: true`) para no bloquear.
 */
export function LocationPickerModal({
  visible,
  onClose,
  kind,
  countryCode,
  value,
  onSelect,
  title,
  allowClear = false,
  clearLabel,
  knownCities,
}) {
  const insets = useSafeAreaInsets();
  const inputRef = useRef(null);
  const [search, setSearch] = useState("");
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const isCity = kind === "city";

  useEffect(() => {
    if (!visible) {
      setSearch("");
      setKeyboardVisible(false);
      return undefined;
    }
    const show = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      () => setKeyboardVisible(true)
    );
    const hide = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => setKeyboardVisible(false)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [visible]);

  const result = useMemo(() => {
    if (!visible) return null;
    if (isCity) return searchCities(countryCode, search, { knownCities });
    return { sections: searchCountries(search), customCity: null };
  }, [countryCode, isCity, knownCities, search, visible]);

  const isSearching = search.trim().length > 0;
  const selectedKey = normalizeSearchText(value);

  const sections = useMemo(() => {
    if (!result) return [];
    const list = result.sections.filter((section) => section.data.length > 0);
    if (allowClear && value && !isSearching) {
      list.unshift({
        key: "clear",
        title: null,
        data: [{ id: "", label: clearLabel, isClear: true }],
      });
    }
    if (result.customCity) {
      list.push({
        key: "custom",
        title: null,
        data: [{ id: result.customCity, label: result.customCity, custom: true }],
      });
    }
    return list;
  }, [allowClear, clearLabel, isSearching, result, value]);

  const countryName = isCity ? countryNameOf(countryCode) : "";
  const hasFeatured = isCity && !isSearching && sections.some((s) => s.key === "featured");
  const cityLoadFailed = isCity && didCityLoadFail(countryCode);

  const handlePick = (option) => {
    Keyboard.dismiss();
    onSelect?.(option.isClear ? null : option);
    onClose?.();
  };

  const renderHint = () => {
    if (!result) return null;
    let text = null;
    if (cityLoadFailed) {
      text = isSearching
        ? null
        : `No pudimos cargar las ciudades de ${countryName}. Escribe el nombre de tu ciudad y la usaremos tal cual.`;
    } else if (isCity && !isSearching) {
      text = result.totalCities
        ? `Escribe para buscar entre ${result.totalCities.toLocaleString("es-ES")} ciudades de ${countryName}.`
        : `No tenemos ciudades de ${countryName} en el catálogo. Escribe el nombre de tu ciudad y la usaremos tal cual.`;
    } else if (isCity && result.customCity) {
      text = result.sections[0]?.data.length
        ? null
        : `No encontramos «${search.trim()}» en ${countryName}, pero puedes usarla igualmente.`;
    } else if (!isCity && isSearching && !sections.length) {
      text = `No encontramos ningún país con «${search.trim()}». Prueba con otro nombre.`;
    }
    if (!text) return null;
    return (
      <View style={styles.hint}>
        <Icon
          name={cityLoadFailed ? "alert-circle-outline" : "search-outline"}
          size={18}
          color={MUTED}
        />
        <Text style={styles.hintText}>{text}</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
      onShow={() => inputRef.current?.focus()}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={[styles.header, { paddingTop: Math.max(insets.top, 16) }]}>
          <MotionPressable
            style={styles.backBtn}
            onPress={onClose}
            scaleTo={0.92}
            pressedOpacity={0.75}
            accessibilityLabel="Volver"
          >
            <Icon name="arrow-back" size={24} color={ACCENT} />
          </MotionPressable>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          <View style={styles.backBtn} />
        </View>

        <View style={styles.searchWrap}>
          <View style={styles.searchInner}>
            <Icon name="search-outline" size={20} color="#94A3B8" />
            <TextInput
              ref={inputRef}
              testID={`location-picker-search-${kind}`}
              style={styles.searchInput}
              value={search}
              onChangeText={setSearch}
              placeholder={isCity ? "Busca tu ciudad" : "Busca un país"}
              placeholderTextColor="#94A3B8"
              autoCorrect={false}
              spellCheck={false}
              autoCapitalize="words"
              returnKeyType="search"
              clearButtonMode="never"
            />
            {isSearching ? (
              <TouchableOpacity
                style={styles.searchClearButton}
                onPress={() => setSearch("")}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityLabel="Borrar búsqueda"
              >
                <Icon name="close-circle" size={20} color="#94A3B8" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        <SectionList
          sections={sections}
          keyExtractor={(item, index) => `${item.custom ? "custom" : "opt"}:${item.id}:${index}`}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          stickySectionHeadersEnabled={false}
          initialNumToRender={20}
          contentContainerStyle={{
            paddingBottom: keyboardVisible ? 12 : Math.max(insets.bottom, 16),
          }}
          // Con destinos habituales, el aviso va debajo para que se vean sin cerrar el teclado.
          ListHeaderComponent={hasFeatured ? null : renderHint()}
          renderSectionHeader={({ section }) =>
            section.title ? (
              <Text style={styles.sectionTitle}>{section.title}</Text>
            ) : null
          }
          renderItem={({ item }) => {
            const isSelected =
              !item.isClear && !item.custom && normalizeSearchText(item.id) === selectedKey;
            return (
              <MotionPressable
                style={[
                  styles.option,
                  isSelected && styles.optionSelected,
                  item.isClear && styles.optionClear,
                ]}
                onPress={() => handlePick(item)}
                testID={
                  item.custom
                    ? "location-option-custom"
                    : item.isClear
                    ? "location-option-clear"
                    : `location-option-${item.id}`
                }
                scaleTo={0.985}
                pressedOpacity={0.9}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
              >
                {item.custom ? (
                  <Icon name="add-circle-outline" size={20} color={PRIMARY} />
                ) : null}
                <View style={styles.optionBody}>
                  <Text
                    style={[
                      styles.optionName,
                      isSelected && styles.optionNameSelected,
                      item.isClear && styles.optionNameClear,
                      item.custom && styles.optionNameCustom,
                    ]}
                    numberOfLines={2}
                  >
                    {item.custom ? `Usar «${item.label}» como ciudad` : item.label}
                  </Text>
                </View>
                {isSelected ? (
                  <Icon name="checkmark-circle" size={22} color={PRIMARY} />
                ) : null}
              </MotionPressable>
            );
          }}
          ListFooterComponent={
            hasFeatured ? (
              renderHint()
            ) : result?.hasMore ? (
              <Text style={styles.footerHint}>
                Hay más resultados. Sigue escribiendo para afinar la búsqueda.
              </Text>
            ) : null
          }
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

/**
 * Campo de formulario (etiqueta + botón) que abre el selector. Mismo aspecto que
 * `SelectFilter` para que el formulario no cambie de estilo.
 */
export function LocationSelectField({
  label,
  kind,
  value,
  countryCode,
  onSelect,
  placeholder,
  disabled = false,
  knownCities,
  testID,
}) {
  const [open, setOpen] = useState(false);
  const display = getLocationDisplayLabel(kind, value, countryCode);

  return (
    <View style={styles.field}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TouchableOpacity
        testID={testID}
        style={[styles.fieldButton, disabled && styles.fieldButtonDisabled]}
        onPress={() => !disabled && setOpen(true)}
        activeOpacity={disabled ? 1 : 0.7}
        disabled={disabled}
      >
        <Text
          style={[styles.fieldText, !display && styles.fieldTextPlaceholder]}
          numberOfLines={1}
        >
          {display || placeholder}
        </Text>
        <Icon name="chevron-down" size={18} color={ACCENT} />
      </TouchableOpacity>

      <LocationPickerModal
        visible={open}
        onClose={() => setOpen(false)}
        kind={kind}
        countryCode={countryCode}
        value={value}
        onSelect={onSelect}
        title={label}
        knownCities={knownCities}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    letterSpacing: -0.2,
    color: ACCENT,
  },
  searchWrap: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  searchInner: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: "#F8FAFC",
    paddingHorizontal: 14,
    minHeight: 52,
    gap: 10,
  },
  searchInput: {
    flex: 1,
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "500",
    paddingVertical: 14,
  },
  searchClearButton: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  hint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
    padding: 14,
    borderRadius: 14,
    backgroundColor: "#F8FAFC",
  },
  hintText: {
    flex: 1,
    color: MUTED,
    fontSize: 14,
    fontWeight: "500",
    lineHeight: 20,
  },
  sectionTitle: {
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 6,
    color: MUTED,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  option: {
    minHeight: 56,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E2E8F0",
    backgroundColor: "#FFFFFF",
  },
  optionSelected: {
    backgroundColor: "#F8F5FF",
  },
  optionClear: {
    backgroundColor: "#F8FAFC",
  },
  optionBody: {
    flex: 1,
  },
  optionName: {
    color: "#0F172A",
    fontSize: 15,
    fontWeight: "600",
  },
  optionNameSelected: {
    fontWeight: "800",
    color: ACCENT,
  },
  optionNameClear: {
    color: MUTED,
  },
  optionNameCustom: {
    color: PRIMARY,
    fontWeight: "700",
  },
  footerHint: {
    paddingHorizontal: 18,
    paddingVertical: 16,
    color: MUTED,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
  },
  field: {
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "700",
    color: ACCENT,
    marginBottom: 8,
  },
  fieldButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    minHeight: 52,
    backgroundColor: "#F8FAFC",
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  fieldButtonDisabled: {
    backgroundColor: "#EEF2F7",
    opacity: 0.6,
  },
  fieldText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
    color: "#0F172A",
    marginRight: 8,
  },
  fieldTextPlaceholder: {
    color: "#94A3B8",
  },
});
