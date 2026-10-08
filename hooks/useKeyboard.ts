import { useEffect, useState } from 'react';
import { Keyboard, Platform } from 'react-native';

// How much of the window the keyboard covers, measured up from the bottom edge
export const keyboardInset = (windowHeight: number, keyboardTop: number) => Math.max(windowHeight - keyboardTop, 0);

// iOS reports the keyboard before it moves, Android only after
export const useKeyboard = (windowHeight: number) => {
    const [keyboard, setKeyboard] = useState({ visible: false, inset: 0 });
    useEffect(() => {
        const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', event =>
            setKeyboard({ visible: true, inset: keyboardInset(windowHeight, event.endCoordinates.screenY) })
        );
        const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () =>
            setKeyboard({ visible: false, inset: 0 })
        );
        return () => {
            show.remove();
            hide.remove();
        };
    }, [windowHeight]);
    return keyboard;
};
