import React from 'react';
import Svg, { Circle, Ellipse } from 'react-native-svg';
import { useTheme } from '../../services/themeContext';
import { CoatKey, pugMarkColors } from '../../services/theme/coats';

interface PugMarkProps {
    coat: CoatKey;
    size?: number;
}

// A small pug face in a coat's accent, used as the coat swatch
export const PugMark: React.FC<PugMarkProps> = ({ coat, size = 36 }) => {
    const { isDark } = useTheme();
    const { face, mask } = pugMarkColors(coat, isDark);

    return (
        <Svg width={size} height={size} viewBox="0 0 32 32" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <Ellipse cx={6.5} cy={10} rx={4} ry={5} transform="rotate(-25 6.5 10)" fill={mask} />
            <Ellipse cx={25.5} cy={10} rx={4} ry={5} transform="rotate(25 25.5 10)" fill={mask} />
            <Circle cx={16} cy={17} r={12} fill={face} />
            <Ellipse cx={16} cy={22} rx={7.5} ry={6} fill={mask} />
            <Circle cx={11} cy={14.5} r={1.9} fill={mask} />
            <Circle cx={21} cy={14.5} r={1.9} fill={mask} />
        </Svg>
    );
};
