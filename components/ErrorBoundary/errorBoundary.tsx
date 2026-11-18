import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../../services/themeContext';
import { useI18n } from '../../services/i18n/i18nContext';
import { useNavigator } from '../../services/navigationContext';
import { PillButton, PugMark } from '../ui';
import { space } from '../../services/theme/shape';

// What shows instead of the app when a screen throws. Try again starts over from Home, so the screen that broke
// isn't simply drawn again.
const Fallback = ({ onRetry }: { onRetry: () => void }) => {
    const { colors, type, coat } = useTheme();
    const { t } = useI18n();
    const { reset } = useNavigator();
    return (
        <View style={[styles.container, { backgroundColor: colors.background }]}>
            <PugMark coat={coat} size={72} />
            <Text accessibilityRole="header" style={[type.title, styles.text, { color: colors.textPrimary }]}>{t('crash.title')}</Text>
            <Text style={[type.body, styles.text, { color: colors.textSecondary }]}>{t('crash.message')}</Text>
            <PillButton
                label={t('crash.retry')}
                icon="home-outline"
                onPress={() => {
                    reset();
                    onRetry();
                }}
            />
        </View>
    );
};

// Without this, an error while drawing a screen closes the app in store builds
export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error: Error, info: React.ErrorInfo) {
        console.error('A screen crashed:', error, info.componentStack);
    }

    render() {
        return this.state.failed ? <Fallback onRetry={() => this.setState({ failed: false })} /> : this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: space.lg,
        padding: space.xl,
    },
    text: {
        textAlign: 'center',
    },
});
