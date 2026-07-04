const path = require('path');

module.exports = {
  dependencies: {
    'react-native-ui-lib': {
      platforms: {
        android: {
          packageImportPath:
            'import com.wix.reactnativeuilib.highlighterview.HighlighterViewPackage;\n' +
            'import com.wix.reactnativeuilib.keyboardinput.KeyboardInputPackage;\n' +
            'import com.wix.reactnativeuilib.textinput.TextInputDelKeyHandlerPackage;\n' +
            'import com.wix.reactnativeuilib.wheelpicker.WheelPickerPackage;',
          packageInstance:
            'new HighlighterViewPackage(), new WheelPickerPackage(), new TextInputDelKeyHandlerPackage(), new KeyboardInputPackage(getApplication())',
        },
      },
    },
  },
};
