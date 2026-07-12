const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'screens/Notifications/notifications.tsx');
let content = fs.readFileSync(file, 'utf8');

// Import SegmentedControl
content = content.replace(
  "import { View, Text, Avatar, Button } from 'react-native-ui-lib';",
  "import { View, Text, Avatar, Button, SegmentedControl } from 'react-native-ui-lib';"
);

// Add useMemo
content = content.replace(
  "import React, { useEffect, useState, useCallback } from 'react';",
  "import React, { useEffect, useState, useCallback, useMemo } from 'react';"
);

// Add states and filter logic
const stateAndFilterLogic = `
    const [activeFilter, setActiveFilter] = useState<'all' | 'mentions' | 'follows'>('all');

    const handleTabChange = (index: number) => {
        const types: ('all' | 'mentions' | 'follows')[] = ['all', 'mentions', 'follows'];
        setActiveFilter(types[index]);
    };

    const filteredNotifications = useMemo(() => {
        if (activeFilter === 'all') return notifications;
        if (activeFilter === 'mentions') return notifications.filter(n => n.type === 'mention');
        if (activeFilter === 'follows') return notifications.filter(n => n.type === 'follow');
        return notifications;
    }, [notifications, activeFilter]);
`;
content = content.replace(
  "const [hasMore, setHasMore] = useState(true);",
  "const [hasMore, setHasMore] = useState(true);" + stateAndFilterLogic
);

// Add SegmentedControl to JSX and use filteredNotifications
const oldReturn = `    return (
        <View flex style={[styles.container, { backgroundColor: colors.background }]}>
            <FlashList
                data={notifications}`;

const newReturn = `    return (
        <View flex style={[styles.container, { backgroundColor: colors.background }]}>
            <View paddingH-16 paddingV-10 style={{ zIndex: 10 }}>
                <SegmentedControl
                    segments={[{ label: 'All' }, { label: 'Mentions' }, { label: 'Follows' }]}
                    activeColor={colors.accentColor}
                    onChangeIndex={handleTabChange}
                />
            </View>
            <FlashList
                data={filteredNotifications}`;

content = content.replace(oldReturn, newReturn);

fs.writeFileSync(file, content, 'utf8');
console.log('Done modifying notifications.tsx');
