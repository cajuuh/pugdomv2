import { buildColors, DEFAULT_COAT } from '../services/theme/coats';
import { buildType } from '../services/theme/typography';

// What useTheme() returns in component tests: Apricot light with the brand fonts loaded.
// Built from the theme modules, not themeContext, because tests mock themeContext.
export const mockTheme = {
    colors: buildColors(DEFAULT_COAT, false, true),
    type: buildType(true),
    isDark: false,
};
