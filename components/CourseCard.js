import React, { memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Icon } from "./Icon";
import { COLORS } from "../constants/colors";
import { formatShortDate } from "../utils/dateUtils";
import { openURL } from "../utils/courseUtils";

/**
 * Componente de tarjeta de curso
 * Memoizado para optimizar el rendimiento
 */
export const CourseCard = memo(({ course, onPress, isMine = false }) => {
  const handleRegister = (e) => {
    e.stopPropagation();
    openURL(course.registration_url);
  };

  const formatDateRange = () => {
    if (course.event_dates.length === 1) {
      return formatShortDate(course.event_dates[0]);
    }
    return `${formatShortDate(course.event_dates[0])} - ${formatShortDate(
      course.event_dates[course.event_dates.length - 1]
    )}`;
  };

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      {/* Course Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Icon name="school" size={24} color={COLORS.PRIMARY} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title} numberOfLines={2}>
              {course.title}
            </Text>
            {course.organization && (
              <Text style={styles.organization} numberOfLines={1}>
                {course.organization}
              </Text>
            )}
          </View>
        </View>
      </View>

      {/* Course Details */}
      <View style={styles.details}>
        {/* Dates */}
        <View style={styles.detailRow}>
          <Icon name="calendar" size={16} color={COLORS.GRAY} />
          <Text style={styles.detailText}>
            {formatDateRange()}
            {course.event_dates.length > 1 && (
              <Text style={styles.detailSubtext}>
                {" "}
                ({course.event_dates.length} días)
              </Text>
            )}
          </Text>
        </View>

        {/* Teaching Hours */}
        {course.teaching_hours && (
          <View style={styles.detailRow}>
            <Icon name="time" size={16} color={COLORS.GRAY} />
            <Text style={styles.detailText}>{course.teaching_hours}</Text>
          </View>
        )}

        {/* Venue */}
        {course.venue_name && (
          <View style={styles.detailRow}>
            <Icon name="location" size={16} color={COLORS.GRAY} />
            <Text style={styles.detailText} numberOfLines={1}>
              {course.venue_name}
            </Text>
          </View>
        )}

        {/* Hospital */}
        {course.hospital && (
          <View style={styles.detailRow}>
            <Icon name="business" size={16} color={COLORS.GRAY} />
            <Text style={styles.detailText} numberOfLines={1}>
              {course.hospital.name} - {course.hospital.city}
            </Text>
          </View>
        )}

        {/* Specialty */}
        {course.speciality && (
          <View style={styles.detailRow}>
            <Icon name="school" size={16} color={COLORS.PURPLE} />
            <Text style={styles.detailTextSpecialty}>
              {course.speciality.name}
            </Text>
          </View>
        )}
      </View>

      {/* Course Footer */}
      <View style={styles.footer}>
        <View style={styles.footerLeft}>
          {/* Price */}
          {course.price_text && (
            <View style={styles.priceContainer}>
              <Icon name="cash" size={16} color={COLORS.SUCCESS} />
              <Text style={styles.priceText} numberOfLines={1}>
                {course.price_text}
              </Text>
            </View>
          )}

          {/* Seats */}
          {course.seats_available && (
            <View style={styles.seatsContainer}>
              <Icon name="people" size={16} color={COLORS.PRIMARY} />
              <Text style={styles.seatsText}>
                {course.seats_available} plazas
              </Text>
            </View>
          )}
        </View>

        {/* Registration Link - siempre visible, no se empuja fuera */}
        {course.registration_url && (
          <TouchableOpacity
            onPress={handleRegister}
            style={styles.registrationButton}
          >
            <Icon name="link" size={16} color={COLORS.PRIMARY} />
            <Text style={styles.registrationButtonText}>Inscribirse</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Course Code */}
      {course.course_code && (
        <Text style={styles.courseCode}>Código: {course.course_code}</Text>
      )}
    </TouchableOpacity>
  );
});

CourseCard.displayName = "CourseCard";

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.WHITE,
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  cardUpcoming: {
    borderWidth: 2,
    borderColor: COLORS.ORANGE + "40",
    backgroundColor: COLORS.ORANGE + "08",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  headerLeft: {
    flex: 1,
    flexDirection: "row",
    gap: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.PRIMARY + "15",
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: "bold",
    color: COLORS.GRAY_DARK,
    marginBottom: 4,
  },
  organization: {
    fontSize: 14,
    color: COLORS.GRAY,
  },
  mineBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: COLORS.PRIMARY + "10",
  },
  mineBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.PRIMARY,
  },
  upcomingBadge: {
    backgroundColor: COLORS.ORANGE,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  upcomingBadgeText: {
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.WHITE,
  },
  details: {
    gap: 8,
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  detailText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.GRAY,
  },
  detailSubtext: {
    fontSize: 12,
    color: COLORS.GRAY,
  },
  detailTextSpecialty: {
    flex: 1,
    fontSize: 14,
    color: COLORS.PURPLE,
    fontWeight: "500",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.BORDER,
  },
  footerLeft: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
  },
  priceContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 1,
    minWidth: 0,
  },
  priceText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.SUCCESS,
    flexShrink: 1,
  },
  seatsContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seatsText: {
    fontSize: 14,
    color: COLORS.PRIMARY,
  },
  registrationButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flexShrink: 0,
  },
  registrationButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.PRIMARY,
  },
  courseCode: {
    fontSize: 12,
    color: COLORS.GRAY,
    textAlign: "right",
    marginTop: 8,
  },
});
