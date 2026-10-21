import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { radii, space } from '../../services/theme/shape';
import { canSchedule, defaultScheduleTime } from '../../services/mastodon/scheduledStatuses';
import { IconButton, PillButton } from '../ui';
import { BottomSheet } from './optionSheet';

// Two weeks of days to pick from
const DAYS = 14;
const MINUTE_STEP = 5;

const pad = (value: number) => String(value).padStart(2, '0');
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

// "Tue, Oct 21, 09:00" in the app's language
export const formatScheduleTime = (at: Date, locale: string) =>
    `${at.toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' })}, ${pad(at.getHours())}:${pad(at.getMinutes())}`;

interface ScheduleSheetProps {
    visible: boolean;
    // The time already chosen, if any
    value: Date | null;
    onSchedule: (at: Date) => void;
    // Shown when there's a time to take back
    onClear?: () => void;
    onClose: () => void;
}

// When to publish: a day from the next two weeks, then the hour and the minute (in steps of five).
// Built in JavaScript so it ships over the air; the system date picker would need a new build.
export const ScheduleSheet: React.FC<ScheduleSheetProps> = ({ visible, value, onSchedule, onClear, onClose }) => {
    const { colors, type } = useTheme();
    const i18n = useI18n();
    const { t, locale } = i18n;
    const [at, setAt] = useState(() => value ?? defaultScheduleTime());

    useEffect(() => {
        if (visible) setAt(value ?? defaultScheduleTime());
    }, [visible, value]);

    const now = new Date();
    const days = Array.from({ length: DAYS }, (_, n) => {
        const day = new Date(now);
        day.setDate(now.getDate() + n);
        return day;
    });
    const dayLabel = (day: Date, n: number) =>
        n === 0 ? t('schedule.today') : n === 1 ? t('schedule.tomorrow') : day.toLocaleDateString(locale, { weekday: 'short', day: 'numeric' });

    const pickDay = (day: Date) => {
        const next = new Date(at);
        next.setFullYear(day.getFullYear(), day.getMonth(), day.getDate());
        setAt(next);
    };
    // Hours wrap within the day; minutes wrap within the hour
    const stepHour = (by: number) => {
        const next = new Date(at);
        next.setHours((at.getHours() + by + 24) % 24);
        setAt(next);
    };
    const stepMinute = (by: number) => {
        const next = new Date(at);
        next.setMinutes((at.getMinutes() + by + 60) % 60);
        setAt(next);
    };
    const valid = canSchedule(at);

    const stepper = (label: string, shown: string, step: (by: number) => void, by: number) => (
        <View style={styles.stepper}>
            <Text style={[type.label, { color: colors.textSecondary }]}>{label}</Text>
            <View style={styles.stepperRow}>
                <IconButton icon="remove" accessibilityLabel={t('schedule.earlier', { unit: label })} onPress={() => step(-by)} />
                <Text style={[type.title, styles.stepperValue, { color: colors.textPrimary }]} accessibilityLabel={`${label} ${shown}`}>
                    {shown}
                </Text>
                <IconButton icon="add" accessibilityLabel={t('schedule.later', { unit: label })} onPress={() => step(by)} />
            </View>
        </View>
    );

    return (
        <BottomSheet visible={visible} title={t('schedule.title')} subtitle={formatScheduleTime(at, locale)} onClose={onClose}>
            <Text style={[type.label, styles.section, { color: colors.textSecondary }]}>{t('schedule.day')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.days} style={styles.daysScroll}>
                {days.map((day, n) => {
                    const selected = sameDay(day, at);
                    return (
                        <Pressable
                            key={day.toDateString()}
                            onPress={() => pickDay(day)}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: selected }}
                            style={[
                                styles.day,
                                { borderColor: selected ? colors.accentColor : colors.borderColor, backgroundColor: selected ? colors.accentColor : colors.cardBackground },
                            ]}
                        >
                            <Text style={[type.label, { color: selected ? colors.buttonTextColor : colors.textPrimary }]}>{dayLabel(day, n)}</Text>
                        </Pressable>
                    );
                })}
            </ScrollView>
            <View style={styles.time}>
                {stepper(t('schedule.hour'), pad(at.getHours()), stepHour, 1)}
                <Text style={[type.title, styles.colon, { color: colors.textMuted }]}>:</Text>
                {stepper(t('schedule.minute'), pad(at.getMinutes()), stepMinute, MINUTE_STEP)}
            </View>
            {!valid && <Text style={[type.meta, styles.warning, { color: colors.accentText }]}>{t('schedule.tooSoon')}</Text>}
            <View style={styles.buttons}>
                <PillButton
                    label={t('schedule.confirm')}
                    icon="calendar"
                    disabled={!valid}
                    onPress={() => {
                        onSchedule(at);
                        onClose();
                    }}
                />
                {onClear && (
                    <PillButton
                        label={t('schedule.clear')}
                        variant="ghost"
                        onPress={() => {
                            onClear();
                            onClose();
                        }}
                    />
                )}
            </View>
        </BottomSheet>
    );
};

const styles = StyleSheet.create({
    section: {
        paddingHorizontal: space.lg,
        marginTop: space.sm,
    },
    daysScroll: {
        flexGrow: 0,
        flexShrink: 0,
    },
    days: {
        gap: space.sm,
        paddingHorizontal: space.lg,
        paddingVertical: space.sm,
    },
    day: {
        borderWidth: 1,
        borderRadius: radii.pill,
        paddingHorizontal: space.md,
        paddingVertical: space.sm,
    },
    time: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'center',
        gap: space.md,
        marginTop: space.md,
    },
    stepper: {
        alignItems: 'center',
        gap: space.xs,
    },
    stepperRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.xs,
    },
    stepperValue: {
        minWidth: 48,
        textAlign: 'center',
    },
    colon: {
        paddingBottom: space.sm,
    },
    warning: {
        textAlign: 'center',
        marginTop: space.sm,
        paddingHorizontal: space.lg,
    },
    buttons: {
        gap: space.sm,
        paddingHorizontal: space.lg,
        marginTop: space.lg,
    },
});
