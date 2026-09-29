import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Avatar, Card, PillButton, PugMark, SectionLabel, SegmentedPill, SegmentOption, ThemedSwitch } from '../../components/ui';
import { ThemeType, useTheme } from '../../services/themeContext';
import { COATS, getCoat } from '../../services/theme/coats';
import { useThemedStyles } from '../../services/theme/useThemedStyles';
import { SettingsHeader } from './header';
import { makeAppearanceStyles } from './styles';

const MODES: SegmentOption<ThemeType>[] = [
    { value: 'light', label: 'Light' },
    { value: 'dark', label: 'Dark' },
    { value: 'system', label: 'System' },
];

interface AppearanceProps {
    onBack: () => void;
}

const Appearance: React.FC<AppearanceProps> = ({ onBack }) => {
    const { colors, type, theme, setTheme, coat, setCoat, tint, setTint } = useTheme();
    const styles = useThemedStyles(makeAppearanceStyles);
    const coatName = getCoat(coat).name;

    return (
        <>
            <SettingsHeader title="Appearance" onBack={onBack} backLabel="Back to settings" />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <SectionLabel style={styles.sectionLabel}>Preview</SectionLabel>
                {/* A sample post drawn with the live tokens; read as one element and not interactive */}
                <Card style={styles.preview} accessible accessibilityLabel={`Preview of the ${coatName} coat`} pointerEvents="none">
                    <View style={styles.previewAuthor}>
                        <Avatar name="Joon Reyes" size={38} />
                        <View style={styles.previewNames}>
                            <Text style={[type.name, styles.previewName]}>Joon Reyes</Text>
                            <Text style={[type.meta, styles.previewHandle]}>@joon@pug.town</Text>
                        </View>
                        <PillButton label="Follow" size="small" onPress={() => {}} />
                    </View>
                    <Text style={[type.body, styles.previewBody]}>
                        Trying Pugdom in {coatName}. <Text style={[type.name, styles.previewTag]}>#pugsofmastodon</Text>
                    </Text>
                    <View style={styles.pollBar}>
                        <View style={styles.pollFill} />
                        <View style={styles.pollLabels}>
                            <Text style={[type.name, styles.pollOption]}>In a sunbeam</Text>
                            <Text style={[type.name, styles.pollPercent]}>64%</Text>
                        </View>
                    </View>
                    <View style={styles.previewActions}>
                        <View style={styles.previewAction}>
                            <Ionicons name="arrow-undo-outline" size={18} color={colors.textMuted} />
                            <Text style={[type.meta, styles.previewCount]}>6</Text>
                        </View>
                        <View style={styles.previewAction}>
                            <Ionicons name="repeat" size={18} color={colors.textMuted} />
                            <Text style={[type.meta, styles.previewCount]}>2</Text>
                        </View>
                        <View style={styles.previewAction}>
                            <Ionicons name="star" size={18} color={colors.accentText} />
                            <Text style={[type.meta, styles.previewCountActive]}>19</Text>
                        </View>
                    </View>
                </Card>

                <SectionLabel style={styles.sectionLabel}>Mode</SectionLabel>
                <SegmentedPill options={MODES} value={theme} onChange={setTheme} />

                <View style={styles.coatHeader}>
                    <SectionLabel>Coat</SectionLabel>
                    <Text style={[type.meta, styles.coatHint]}>Pug coats and a few friends</Text>
                </View>
                <View accessibilityRole="radiogroup" style={styles.coatGrid}>
                    {COATS.map(option => {
                        const selected = option.key === coat;
                        return (
                            <Pressable
                                key={option.key}
                                onPress={() => setCoat(option.key)}
                                accessibilityRole="radio"
                                accessibilityLabel={option.name}
                                accessibilityState={{ checked: selected }}
                                style={[styles.coat, selected && styles.coatSelected]}
                            >
                                <PugMark coat={option.key} />
                                <Text style={[type.name, styles.coatName]}>{option.name}</Text>
                            </Pressable>
                        );
                    })}
                </View>

                <Card style={styles.tintRow}>
                    <View style={styles.tintText}>
                        <Text style={[type.name, styles.tintLabel]}>Tint surfaces with coat</Text>
                        <Text style={[type.meta, styles.tintDetail]}>Warms the background and cards, not only buttons</Text>
                    </View>
                    <ThemedSwitch value={tint} onValueChange={setTint} accessibilityLabel="Tint surfaces with coat" />
                </Card>
            </ScrollView>
        </>
    );
};

export default Appearance;
