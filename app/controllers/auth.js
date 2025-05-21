const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const {transporter} = require("../email");
const {redisClient} = require("../redis");

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

// POST /api/forgot-password
exports.forgotPassword = async (req, res) => {
    try {
        const { email } = req.body;

        // Проверка существования пользователя
        const user = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (!user.rows.length) return res.status(404).json({ error: 'User not found' });

        // Генерация кода
        const code = Math.floor(1000 + Math.random() * 9000);

        // Сохранение в Redis
        await redisClient.set(`reset_code:${email}`, code, 'EX', 300); // 5 минут

        // Отправка email
        await transporter.sendMail({
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Восстановление пароля',
            text: `Ваш код: ${code}`
        });

        res.json({ message: 'Verification code sent' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};
// POST /api/verify-code
exports.verifyCode = async (req, res) => {
    try {
        const { email, code } = req.body;

        // Проверка кода в Redis
        const storedCode = await redisClient.get(`reset_code:${email}`);
        if (storedCode !== code) return res.status(400).json({ error: 'Invalid code' });

        // Установка флага на 1 час
        await redisClient.set(`email_verified:${email}`, 'true', 'EX', 3600); // 1 час

        // Удаление использованного кода
        await redisClient.del(`reset_code:${email}`);

        res.json({ message: 'Email verified successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

// POST /api/verify-code
exports.verifyCode = async (req, res) => {
    try {
        const { email, code } = req.body;

        // Проверка кода в Redis
        const storedCode = await redisClient.get(`reset_code:${email}`);
        if (storedCode !== code) return res.status(400).json({ error: 'Invalid code' });

        // Установка флага на 1 час
        await redisClient.set(`email_verified:${email}`, 'true', 'EX', 3600); // 1 час

        // Удаление использованного кода
        await redisClient.del(`reset_code:${email}`);

        res.json({ message: 'Email verified successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = router;