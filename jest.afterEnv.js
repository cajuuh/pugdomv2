const { clearTestQueryClients } = require('./testUtils/queryClient');

// Drop cached queries (and any in-flight fetches) between tests
afterEach(() => clearTestQueryClients());

// Dialogs and toasts live in a module-level store; start each test without any
const { resetDialogs } = require('./services/dialog');
afterEach(() => resetDialogs());
