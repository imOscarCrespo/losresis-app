import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Icon } from "../Icon";
import { LANDLORD_PORTAL_LABEL } from "../../constants/housing";

const OPTIONS = [
  {
    id: "student",
    title: "Preparando el MIR",
    subtitle: "Estudiante de medicina",
    icon: "school",
  },
  {
    id: "resident",
    title: "Ya soy residente MIR",
    subtitle: "Médico residente en activo",
    icon: "medkit",
  },
  {
    // El registro de anunciantes ya no se hace en la app: la tarjeta sigue
    // visible pero solo redirige al portal de propietarios.
    id: "host",
    title: "Anunciante de vivienda",
    subtitle: `Publica tus pisos en ${LANDLORD_PORTAL_LABEL}`,
    icon: "home",
    external: true,
  },
];

export const OnboardingUserTypeCards = ({ selectedType, onSelect }) => {
  return (
    <View style={styles.container}>
      {OPTIONS.map((option) => {
        const isSelected = selectedType === option.id;
        return (
          <Pressable
            key={option.id}
            onPress={() => onSelect(option.id)}
            style={({ pressed }) => [
              styles.card,
              isSelected && styles.cardSelected,
              pressed && styles.cardPressed,
            ]}
          >
            <View style={styles.iconWrap}>
              <Icon name={option.icon} size={26} color="#FFFFFF" />
            </View>
            <View style={styles.textBlock}>
              <Text style={styles.title}>{option.title}</Text>
              <Text style={styles.subtitle}>{option.subtitle}</Text>
            </View>
            <View style={styles.chevron}>
              <Icon
                name={option.external ? "open-outline" : "chevron-forward"}
                size={20}
                color="#FFFFFF"
              />
            </View>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: 14,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.18)",
  },
  cardSelected: {
    backgroundColor: "rgba(255,255,255,0.22)",
    borderColor: "rgba(255,255,255,0.45)",
  },
  cardPressed: {
    backgroundColor: "rgba(255,255,255,0.2)",
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14,
  },
  textBlock: {
    flex: 1,
    paddingRight: 8,
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.75)",
  },
  chevron: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
});
