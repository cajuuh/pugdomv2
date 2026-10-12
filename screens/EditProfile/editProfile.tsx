import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { Avatar, Card, IconButton, PillButton, SectionLabel, ThemedSwitch } from '../../components/ui';
import { ImageEditor } from '../../components/ImageEditor/imageEditor';
import { useAuth } from '../../services/authContext';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { dialog } from '../../services/dialog';
import { updateProfile } from '../../services/mastodon/accounts';
import { pickImages } from '../../services/media/pick';
import { applyEdits } from '../../services/media/edit';
import { PickedImage, prepareProfileImage } from '../../services/media/prepare';
import { ImageEdits } from '../../services/media/geometry';
import { radii, space } from '../../services/theme/shape';
import { TAB_BAR_CLEARANCE } from '../../components/TabBar/styles';

// ponytail: Mastodon's defaults; read the server's limits if one reports more fields or a longer bio
const MAX_FIELDS = 4;
const MAX_NAME = 30;
const MAX_NOTE = 500;
// What Mastodon keeps of each image; larger ones are scaled down before sending
const IMAGE_SIZES = { avatar: { width: 400, height: 400 }, header: { width: 1500, height: 500 } };
const ASPECTS = { avatar: 1, header: 3 };

type ImageKind = 'avatar' | 'header';
type Field = { name: string; value: string };

interface EditProfileProps {
    onBack: () => void;
}

const EditProfile = ({ onBack }: EditProfileProps) => {
    const { user, updateUser } = useAuth();
    const { colors, type } = useTheme();
    const { t } = useI18n();
    const insets = useSafeAreaInsets();
    const queryClient = useQueryClient();

    // The bio and fields as typed come from `source`; the public ones are HTML
    const initial = {
        displayName: user?.display_name ?? '',
        note: user?.source?.note ?? '',
        fields: Array.from({ length: MAX_FIELDS }, (_, i): Field => user?.source?.fields?.[i] ?? { name: '', value: '' }),
        locked: !!user?.locked,
        bot: !!user?.bot,
        discoverable: !!user?.discoverable,
    };
    const [displayName, setDisplayName] = useState(initial.displayName);
    const [note, setNote] = useState(initial.note);
    const [fields, setFields] = useState(initial.fields);
    const [locked, setLocked] = useState(initial.locked);
    const [bot, setBot] = useState(initial.bot);
    const [discoverable, setDiscoverable] = useState(initial.discoverable);
    // New images, cropped in the editor
    const [images, setImages] = useState<Partial<Record<ImageKind, PickedImage>>>({});
    const [editing, setEditing] = useState<{ kind: ImageKind; image: PickedImage } | null>(null);
    const [saving, setSaving] = useState(false);

    if (!user) return null;

    const dirty =
        displayName !== initial.displayName ||
        note !== initial.note ||
        JSON.stringify(fields) !== JSON.stringify(initial.fields) ||
        locked !== initial.locked ||
        bot !== initial.bot ||
        discoverable !== initial.discoverable ||
        !!images.avatar ||
        !!images.header;

    const goBack = () => {
        if (!dirty) return onBack();
        dialog.alert(t('editProfile.discardTitle'), t('editProfile.discardMessage'), [
            { text: t('editProfile.keepEditing'), style: 'cancel' },
            { text: t('editProfile.discard'), style: 'destructive', onPress: onBack },
        ]);
    };

    const pick = async (kind: ImageKind) => {
        const [image] = await pickImages(1);
        if (image) setEditing({ kind, image });
    };

    const finishEditing = async (edits: ImageEdits) => {
        if (!editing) return;
        const cropped = await applyEdits(editing.image, edits);
        setImages(current => ({ ...current, [editing.kind]: cropped }));
        setEditing(null);
    };

    const setField = (index: number, change: Partial<Field>) =>
        setFields(current => current.map((field, i) => (i === index ? { ...field, ...change } : field)));

    const save = async () => {
        setSaving(true);
        try {
            const account = await updateProfile(
                {
                    displayName: displayName.trim(),
                    note,
                    // Filled fields first, so emptied slots in the middle don't leave gaps
                    fields: fields.filter(field => field.name.trim() || field.value.trim()),
                    locked,
                    bot,
                    discoverable,
                    avatar: images.avatar && (await prepareProfileImage(images.avatar, IMAGE_SIZES.avatar)),
                    header: images.header && (await prepareProfileImage(images.header, IMAGE_SIZES.header)),
                },
                MAX_FIELDS
            );
            updateUser(account);
            queryClient.setQueryData(['account', account.id], account);
            dialog.toast(t('editProfile.saved'));
            onBack();
        } catch (error: any) {
            console.warn('Saving the profile failed:', error);
            // Mastodon says what it rejected (a name too long, an image too big...)
            const reason = error?.response?.data?.error;
            dialog.toast(reason ? t('editProfile.failedBecause', { reason }) : t('editProfile.failed'));
        } finally {
            setSaving(false);
        }
    };

    const name = displayName || user.username;
    const headerUri = images.header?.uri ?? user.header;
    const input = [type.body, styles.input, { color: colors.textPrimary, backgroundColor: colors.inputBackground }];
    const changeButton = (kind: ImageKind) => (
        <IconButton
            icon="camera-outline"
            accessibilityLabel={t(kind === 'avatar' ? 'editProfile.changeAvatar' : 'editProfile.changeHeader')}
            onPress={() => pick(kind)}
            style={[styles.changeButton, kind === 'header' && styles.headerButton, { backgroundColor: colors.veilStrong }]}
        />
    );

    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <View style={[styles.header, { paddingTop: insets.top + 10, borderBottomColor: colors.borderColor, backgroundColor: colors.cardBackground }]}>
                <IconButton icon="arrow-back" accessibilityLabel={t('common.goBack')} onPress={goBack} />
                <Text accessibilityRole="header" style={[type.name, styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
                    {t('editProfile.title')}
                </Text>
                <PillButton label={t('editProfile.save')} size="small" onPress={save} disabled={!dirty || saving} loading={saving} />
            </View>

            <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
                <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                    <View style={[styles.banner, { backgroundColor: colors.inputBackground }]}>
                        {!!headerUri && <Image source={{ uri: headerUri }} style={StyleSheet.absoluteFill} />}
                        {changeButton('header')}
                    </View>
                    <View style={styles.avatarRow}>
                        <View style={[styles.avatarRing, { backgroundColor: colors.background }]}>
                            <Avatar name={name} uri={images.avatar?.uri ?? user.avatar} size={84} />
                        </View>
                        {/* Centred on the picture */}
                        <View style={styles.avatarButton} pointerEvents="box-none">
                            {changeButton('avatar')}
                        </View>
                    </View>

                    <SectionLabel style={styles.label}>{t('editProfile.displayName')}</SectionLabel>
                    <TextInput
                        value={displayName}
                        onChangeText={setDisplayName}
                        maxLength={MAX_NAME}
                        placeholder={user.username}
                        placeholderTextColor={colors.textMuted}
                        accessibilityLabel={t('editProfile.displayName')}
                        style={input}
                    />

                    <SectionLabel style={styles.label}>{t('editProfile.bio')}</SectionLabel>
                    <TextInput
                        value={note}
                        onChangeText={setNote}
                        maxLength={MAX_NOTE}
                        multiline
                        placeholder={t('editProfile.bioPlaceholder')}
                        placeholderTextColor={colors.textMuted}
                        accessibilityLabel={t('editProfile.bio')}
                        style={[...input, styles.bio]}
                    />
                    <Text style={[type.meta, styles.counter, { color: colors.textMuted }]}>{MAX_NOTE - note.length}</Text>

                    <SectionLabel style={styles.label}>{t('editProfile.fields')}</SectionLabel>
                    <Text style={[type.meta, styles.hint, { color: colors.textMuted }]}>{t('editProfile.fieldsHint')}</Text>
                    {fields.map((field, index) => (
                        <View key={index} style={styles.fieldRow}>
                            <TextInput
                                value={field.name}
                                onChangeText={value => setField(index, { name: value })}
                                placeholder={t('editProfile.fieldLabel')}
                                placeholderTextColor={colors.textMuted}
                                accessibilityLabel={t('editProfile.fieldLabelN', { n: index + 1 })}
                                style={[...input, styles.fieldName]}
                            />
                            <TextInput
                                value={field.value}
                                onChangeText={value => setField(index, { value })}
                                placeholder={t('editProfile.fieldValue')}
                                placeholderTextColor={colors.textMuted}
                                autoCapitalize="none"
                                accessibilityLabel={t('editProfile.fieldValueN', { n: index + 1 })}
                                style={[...input, styles.fieldValue]}
                            />
                        </View>
                    ))}

                    <Card style={styles.switches}>
                        {[
                            { label: 'editProfile.locked', hint: 'editProfile.lockedHint', value: locked, onChange: setLocked, icon: 'lock-closed-outline' },
                            { label: 'editProfile.bot', hint: 'editProfile.botHint', value: bot, onChange: setBot, icon: 'hardware-chip-outline' },
                            { label: 'editProfile.discoverable', hint: 'editProfile.discoverableHint', value: discoverable, onChange: setDiscoverable, icon: 'compass-outline' },
                        ].map((row, index) => (
                            <View key={row.label}>
                                {index > 0 && <View style={[styles.divider, { backgroundColor: colors.borderColor }]} />}
                                <View style={styles.switchRow}>
                                    <Ionicons name={row.icon as React.ComponentProps<typeof Ionicons>['name']} size={20} color={colors.accentText} />
                                    <View style={styles.switchText}>
                                        <Text style={[type.name, { color: colors.textPrimary }]}>{t(row.label as 'editProfile.locked')}</Text>
                                        <Text style={[type.meta, { color: colors.textMuted }]}>{t(row.hint as 'editProfile.lockedHint')}</Text>
                                    </View>
                                    <ThemedSwitch value={row.value} onValueChange={row.onChange} accessibilityLabel={t(row.label as 'editProfile.locked')} />
                                </View>
                            </View>
                        ))}
                    </Card>
                </ScrollView>
            </KeyboardAvoidingView>

            <ImageEditor
                visible={!!editing}
                image={editing?.image ?? null}
                aspect={editing ? ASPECTS[editing.kind] : undefined}
                onCancel={() => setEditing(null)}
                onDone={finishEditing}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingBottom: space.sm,
        paddingHorizontal: space.lg,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    title: {
        flex: 1,
    },
    content: {
        padding: space.lg,
        // The dock floats over this screen, above Android's navigation buttons
        paddingBottom: TAB_BAR_CLEARANCE,
    },
    banner: {
        aspectRatio: 3,
        borderRadius: radii.well,
        overflow: 'hidden',
    },
    changeButton: {
        borderRadius: radii.pill,
    },
    headerButton: {
        position: 'absolute',
        right: space.sm,
        bottom: space.sm,
    },
    avatarButton: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarRow: {
        marginTop: -42,
        marginLeft: space.md,
        alignSelf: 'flex-start',
    },
    avatarRing: {
        padding: 3,
        borderRadius: radii.pill,
    },
    label: {
        marginTop: space.lg,
        marginBottom: space.sm,
    },
    hint: {
        marginBottom: space.sm,
    },
    input: {
        minHeight: 48,
        paddingHorizontal: space.md,
        borderRadius: radii.input,
    },
    bio: {
        minHeight: 110,
        paddingTop: space.md,
        textAlignVertical: 'top',
    },
    counter: {
        alignSelf: 'flex-end',
        marginTop: space.xs,
    },
    fieldRow: {
        flexDirection: 'row',
        gap: space.sm,
        marginBottom: space.sm,
    },
    fieldName: {
        flex: 2,
    },
    fieldValue: {
        flex: 3,
    },
    switches: {
        marginTop: space.lg,
        paddingHorizontal: space.md,
    },
    switchRow: {
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
    },
    switchText: {
        flex: 1,
        gap: 2,
    },
    divider: {
        height: StyleSheet.hairlineWidth,
    },
});

export default EditProfile;
