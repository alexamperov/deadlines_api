const express = require('express');
const { Pool } = require('pg');
const pool = require('../db');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// 1. Получение всех персональных задач
router.get('/personal-tasks', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        const tasks = await pool.query(`
            SELECT * FROM personal_tasks 
            WHERE user_id = $1 
            ORDER BY created_at DESC;
        `, [userId]);

        res.json(tasks.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 2. Создание персональной задачи
router.post('/personal-tasks', authenticateToken, async (req, res) => {
    const { title} = req.body; // Описание необязательно
    const userId = req.user.id;

    try {
        // const result = await pool.query(`
        //     INSERT INTO personal_tasks (title, description, user_id)
        //     VALUES ($1, $2, $3)
        //     RETURNING *;
        // `, [title, description, userId]);

        const result = await pool.query(`
            INSERT INTO personal_tasks (title, user_id)
            VALUES ($1, $2)
            RETURNING *;
        `, [title, userId]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 3. Получение конкретной персональной задачи
router.get('/personal-tasks/:taskId', authenticateToken, async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    const userId = req.user.id;

    try {
        const task = await pool.query(`
            SELECT * FROM personal_tasks 
            WHERE id = $1 AND user_id = $2;
        `, [taskId, userId]);

        if (task.rows.length === 0) {
            return res.sendStatus(404);
        }

        res.json(task.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 4. Обновление персональной задачи
router.put('/personal-tasks/:taskId', authenticateToken, async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    const userId = req.user.id;
    const { title, description } = req.body;

    try {
        const taskCheck = await pool.query(`
            SELECT * FROM personal_tasks 
            WHERE id = $1 AND user_id = $2;
        `, [taskId, userId]);

        if (taskCheck.rows.length === 0) {
            return res.sendStatus(404);
        }

        // Используем CASE для обновления только переданных полей
        await pool.query(`
            UPDATE personal_tasks 
            SET 
                title = CASE WHEN $3 IS NOT NULL THEN $3 ELSE title END,
                description = CASE WHEN $4 IS NOT NULL THEN $4 ELSE description END
            WHERE id = $1 AND user_id = $2;
        `, [taskId, userId, title, description]);

        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Отметка персональной задачи как выполненной
router.put('/personal-tasks/:taskId/done', authenticateToken, async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    const userId = req.user.id;
    const { isDone } = req.body; // true/false

    try {
        // Проверка наличия задачи у пользователя
        const taskCheck = await pool.query(`
            SELECT * FROM personal_tasks 
            WHERE id = $1 AND user_id = $2;
        `, [taskId, userId]);

        if (taskCheck.rows.length === 0) {
            return res.sendStatus(404);
        }

        // Обновление статуса
        await pool.query(`
            UPDATE personal_tasks 
            SET is_done = $3 
            WHERE id = $1 AND user_id = $2;
        `, [taskId, userId, isDone]);

        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// 5. Удаление персональной задачи
router.delete('/personal-tasks/:taskId', authenticateToken, async (req, res) => {
    const taskId = parseInt(req.params.taskId);
    const userId = req.user.id;

    try {
        const taskCheck = await pool.query(`
            SELECT * FROM personal_tasks 
            WHERE id = $1 AND user_id = $2;
        `, [taskId, userId]);

        if (taskCheck.rows.length === 0) {
            return res.sendStatus(404);
        }

        await pool.query(`
            DELETE FROM personal_tasks 
            WHERE id = $1 AND user_id = $2;
        `, [taskId, userId]);

        res.sendStatus(200);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;