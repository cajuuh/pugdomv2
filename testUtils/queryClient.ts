import { QueryClient } from '@tanstack/react-query';

const clients = new Set<QueryClient>();

// No retries (failures surface immediately) and no garbage-collection timers, which would otherwise
// keep jest workers alive for minutes after the tests finish
export const createTestQueryClient = () => {
    const client = new QueryClient({
        defaultOptions: {
            queries: { retry: false, gcTime: Infinity },
            mutations: { retry: false, gcTime: Infinity },
        },
    });
    clients.add(client);
    return client;
};

export const clearTestQueryClients = () => {
    clients.forEach(client => client.clear());
    clients.clear();
};
