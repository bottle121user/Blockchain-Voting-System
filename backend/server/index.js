const express = require('express');
const cors = require('cors');
require('dotenv').config();

const apiRoutes = require('./routes');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Main API Router
app.use('/api', apiRoutes);

app.get('/health', (req, res) => {
    res.json({ status: 'ok', message: 'Backend Relayer API is running' });
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
