console.log('Step 1: Loading basic modules...');
const express = require('express');
const cors = require('cors');
console.log('Step 2: Basic modules loaded');

console.log('Step 3: Loading database...');
const db = require('../db');
console.log('Step 4: Database loaded');

console.log('Step 5: Loading models...');
const projectModel = require('../models/project');
console.log('Step 6: Models loaded');

console.log('Step 7: Loading routes...');
const projectRoutes = require('../routes/projects');
console.log('Step 8: Routes loaded');

console.log('Step 9: Creating app...');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.use('/api/projects', projectRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

console.log('Step 10: Starting server...');
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});