const { clearTestQueryClients } = require('./testUtils/queryClient');

// Drop cached queries (and any in-flight fetches) between tests
afterEach(() => clearTestQueryClients());
