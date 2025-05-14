const express = require('express');
const cors = require('cors');
const subjectsRouter = require('./controllers/subjects');
const authRouter = require('./controllers/auth');
const personalTasksRouter = require('./controllers/personal-tasks');
const pool = require('./db'); // Импортируем пул

const app = express();
const PORT = process.env.PORT || 3000;

// Тестовый запрос при запуске сервера
(async () => {
    try {
        const result = await pool.query('SELECT NOW()');
        console.log('База данных доступна:', result.rows[0]);
    } catch (err) {
        console.error('Ошибка подключения к БД:', err);
        process.exit(1);
    }
})();

app.use(cors());
app.use(express.json());
app.use('/api/auth', authRouter);
app.use('/api', subjectsRouter);
app.use('/api', personalTasksRouter);

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});