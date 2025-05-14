const express = require('express');
const cors = require('cors');
const subjectsRouter = require('./controllers/subjects');
const authRouter = require('./controllers/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRouter);
app.use('/api', subjectsRouter);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});