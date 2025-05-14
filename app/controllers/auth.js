const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');

const router = express.Router();

// Регистрация
router.post(
    '/register',
    async (req, res) => {

        const { username, password } = req.body;

        try {
            // Проверка существования пользователя
            const existingUser = await pool.query(`
        SELECT * FROM users
        WHERE username = $1;
      `, [username]);

            if (existingUser.rows.length) return res.status(409).send('Username exists');

            // Хеширование пароля
            const hashedPassword = await bcrypt.hash(password, 10);

            // Создание пользователя
            const user = await pool.query(`
        INSERT INTO users (username, password_hash)
        VALUES ($1, $2)
        RETURNING *;
      `, [username, hashedPassword]);

            res.status(201).json(user.rows[0]);
        } catch (err) {
            res.status(500).json({ error: err.message });
        }
    }
);

// Вход
router.post('/login', async (req, res) => {
    const { username, password } = req.body;

    try {
        const user = await pool.query(`
      SELECT * FROM users
      WHERE username = $1;
    `, [username]);

        if (!user.rows.length) return res.sendStatus(404);

        const valid = await bcrypt.compare(password, user.rows[0].password_hash);
        if (!valid) return res.sendStatus(401);

        const token = jwt.sign({ id: user.rows[0].id }, process.env.JWT_SECRET);
        res.json({ token });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;