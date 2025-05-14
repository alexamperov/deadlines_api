const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// Создание предмета
router.post('/subjects', authenticateToken, async (req, res) => {
    const { title } = req.body;
    const userId = req.user.id;

    try {
        const result = await pool.query(`
      INSERT INTO subjects (title, user_id)
      VALUES ($1, $2)
      RETURNING *;
    `, [title, userId]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получение списка предметов (свои и подписки)
router.get('/subjects', authenticateToken, async (req, res) => {
    const userId = req.user.id;

    try {
        // Свои предметы
        const owned = await pool.query(`
      SELECT * FROM subjects
      WHERE user_id = $1;
    `, [userId]);

        // Предметы, на которые подписан
        const subscribedSubjects = await pool.query(`
      SELECT s.* FROM subjects s
      JOIN subscriptions sub ON s.id = sub.subject_id
      WHERE sub.user_id = $1;
    `, [userId]);

        res.json([...owned.rows, ...subscribedSubjects.rows]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Подписка по коду
router.post('/subjects/:subjectId/subscribe', authenticateToken, async (req, res) => {
    const { invitationCode } = req.body;
    const subjectId = parseInt(req.params.subjectId);
    const userId = req.user.id;

    try {
        const subject = await pool.query(`
      SELECT * FROM subjects
      WHERE id = $1 AND invitation_code = $2;
    `, [subjectId, invitationCode]);

        if (!subject.rows.length) return res.status(400).send('Invalid code');

        await pool.query(`
      INSERT INTO subscriptions (user_id, subject_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING;
    `, [userId, subjectId]);

        res.sendStatus(201);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Создание задачи в предмете
router.post('/subjects/:subjectId/tasks', authenticateToken, async (req, res) => {
    const { title, description, deadline } = req.body;
    const subjectId = parseInt(req.params.subjectId);
    const userId = req.user.id;

    try {
        // Проверка прав
        const subject = await pool.query(`
      SELECT * FROM subjects
      WHERE id = $1;
    `, [subjectId]);

        if (!subject.rows.length) return res.sendStatus(404);

        const isOwner = subject.rows[0].user_id === userId;
        const isSubscribed = await pool.query(`
      SELECT * FROM subscriptions
      WHERE user_id = $1 AND subject_id = $2;
    `, [userId, subjectId]);

        if (!isOwner && !isSubscribed.rows.length) return res.sendStatus(403);

        // Создание задачи
        const task = await pool.query(`
      INSERT INTO subject_tasks (title, description, deadline, subject_id)
      VALUES ($1, $2, $3, $4)
      RETURNING *;
    `, [title, description, deadline, subjectId]);

        // Создание индивидуальных статусов для всех участников
        const users = [
            subject.rows[0].user_id,
            ...(await pool.query(`
        SELECT user_id FROM subscriptions
        WHERE subject_id = $1;
      `, [subjectId])).rows.map(row => row.user_id)
        ];

        const userTasks = users.map(user => ({
            user_id: user,
            subject_task_id: task.rows[0].id,
            is_done: false,
            is_passed: false
        }));

        await pool.query(`
      INSERT INTO user_subject_tasks (user_id, subject_task_id, is_done, is_passed)
      VALUES ${userTasks.map(() => `($1, $2, $3, $4)`).join(',')}
    `, [].concat(...userTasks.map(t => [t.user_id, t.subject_task_id, t.is_done, t.is_passed])));

        res.status(201).json(task.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получение задач предмета с индивидуальными статусами
router.get('/subjects/:subjectId/tasks', authenticateToken, async (req, res) => {
    const subjectId = parseInt(req.params.subjectId);
    const userId = req.user.id;

    try {
        // Проверка доступа
        const subject = await pool.query(`
      SELECT * FROM subjects
      WHERE id = $1;
    `, [subjectId]);

        if (!subject.rows.length) return res.sendStatus(404);

        const isOwner = subject.rows[0].user_id === userId;
        const isSubscribed = await pool.query(`
      SELECT * FROM subscriptions
      WHERE user_id = $1 AND subject_id = $2;
    `, [userId, subjectId]);

        if (!isOwner && !isSubscribed.rows.length) return res.sendStatus(403);

        // Получение задач с индивидуальными статусами
        const tasks = await pool.query(`
      SELECT 
        st.*, 
        ust.is_done, 
        ust.is_passed
      FROM subject_tasks st
      LEFT JOIN user_subject_tasks ust 
        ON st.id = ust.subject_task_id AND ust.user_id = $1
      WHERE st.subject_id = $2;
    `, [userId, subjectId]);

        res.json(tasks.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;