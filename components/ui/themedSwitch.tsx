import React from 'react';
import { Switch, SwitchProps } from 'react-native';
import { useTheme } from '../../services/themeContext';

export const ThemedSwitch: React.FC<Omit<SwitchProps, 'trackColor' | 'ios_backgroundColor'>> = props => {
    const { colors } = useTheme();
    return (
        <Switch
            trackColor={{ true: colors.accentColor, false: colors.borderColor }}
            ios_backgroundColor={colors.borderColor}
            {...props}
        />
    );
};
