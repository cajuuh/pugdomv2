import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Account } from './mastodon/types';

// Screens that open on top of the tabs. Links and lists join in later phases.
// An account route can carry the account we already have, so its profile shows at once.
export type Route =
    | { name: 'thread'; statusId: string }
    | { name: 'settings' }
    | { name: 'account'; accountId: string; account?: Account }
    | { name: 'hashtag'; tag: string }
    | { name: 'link'; url: string; title?: string }
    | { name: 'feedEditor' }
    | { name: 'listEditor'; listId?: string };

// Each entry gets its own key, so the same screen can sit in the stack twice (thread → other → same thread)
export interface StackEntry {
    key: string;
    route: Route;
}

// Hidden screens stay mounted to keep their scroll position, so the stack has a limit
export const MAX_STACK_DEPTH = 10;

// The account copy carried by a route doesn't make it a different screen
const routeIdentity = (route: Route) => {
    if (route.name === 'account') return { name: route.name, accountId: route.accountId };
    if (route.name === 'hashtag') return { name: route.name, tag: route.tag.toLowerCase() };
    if (route.name === 'link') return { name: route.name, url: route.url };
    return route;
};
export const sameRoute = (a: Route, b: Route) => JSON.stringify(routeIdentity(a)) === JSON.stringify(routeIdentity(b));

// Adds a screen on top, unless it's already the top one; past the limit the oldest screen goes
export const pushRoute = (stack: StackEntry[], route: Route, key: string): StackEntry[] => {
    const top = stack[stack.length - 1];
    if (top && sameRoute(top.route, route)) return stack;
    return [...stack, { key, route }].slice(-MAX_STACK_DEPTH);
};

interface Navigator {
    stack: StackEntry[];
    push: (route: Route) => void;
    pop: () => void;
    reset: () => void;
}

// Without a provider (component tests) navigation does nothing
const NavigationContext = createContext<Navigator>({ stack: [], push: () => {}, pop: () => {}, reset: () => {} });

export const NavigationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [stack, setStack] = useState<StackEntry[]>([]);
    const nextKey = useRef(0);

    const push = useCallback((route: Route) => {
        setStack(current => pushRoute(current, route, `screen-${nextKey.current++}`));
    }, []);
    const pop = useCallback(() => setStack(current => current.slice(0, -1)), []);
    const reset = useCallback(() => setStack(current => (current.length ? [] : current)), []);

    const value = useMemo(() => ({ stack, push, pop, reset }), [stack, push, pop, reset]);
    return <NavigationContext.Provider value={value}>{children}</NavigationContext.Provider>;
};

export const useNavigator = () => useContext(NavigationContext);
