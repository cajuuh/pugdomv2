import { QueryClient } from '@tanstack/react-query';

// The app-wide client, in its own module so tests can clear it between renders of <App />
export const queryClient = new QueryClient();
