const express = require('express');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { authenticateToken } = require('../middlewares/auth');

const router = express.Router();

// Создание предмета
// протестировано
router.post('/subjects', authenticateToken, async (req, res) => {
    const { title, description } = req.body;
    const userId = req.user.id;

    try {
        const result = await pool.query(`
      INSERT INTO subjects (title, user_id, description)
      VALUES ($1, $2, $3)
      RETURNING *;
    `, [title, userId, description]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получение списка предметов (свои и подписки)
// протестировано
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

// Получение одного предмета по ID (если пользователь владеет или подписан)
router.get('/subjects/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const subjectId = parseInt(req.params.id);

    try {
        // Проверяем, принадлежит ли предмет пользователю или он подписан на него
        const result = await pool.query(`
            SELECT s.* FROM subjects s
            LEFT JOIN subscriptions sub ON s.id = sub.subject_id AND sub.user_id = $1
            WHERE s.id = $2 AND (s.user_id = $1 OR sub.user_id IS NOT NULL)
        `, [userId, subjectId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Subject not found or access denied' });
        }

        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// DELETE /api/subjects/:id
router.delete('/subjects/:id', authenticateToken, async (req, res) => {
    const userId = req.user.id;
    const subjectId = parseInt(req.params.id);

    if (isNaN(subjectId)) {
        return res.status(400).json({ error: 'Invalid subject ID' });
    }

    try {
        // Проверяем, что предмет существует и принадлежит пользователю
        const result = await pool.query(`
            SELECT * FROM subjects
            WHERE id = $1 AND user_id = $2
        `, [subjectId, userId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Subject not found or access denied' });
        }

        // Удаляем предмет
        await pool.query('DELETE FROM subjects WHERE id = $1', [subjectId]);

        res.json({ message: 'Subject deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Подписка по коду
// протестировано
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

        console.log(userTasks);

        for (t of userTasks) {
            await pool.query(`
      INSERT INTO user_subject_tasks (user_id, subject_task_id, is_done, is_passed)
      VALUES ($1, $2, $3, $4)`,[t.user_id, t.subject_task_id, t.is_done, t.is_passed]);
        }


        res.status(201).json(task.rows[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Получение задач предмета с индивидуальными статусами
// протестировано
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


// Отметка задачи как выполненной
// протестировано
router.put('/subjects/:subjectId/tasks/:taskId/done', authenticateToken, async (req, res) => {
    const subjectId = parseInt(req.params.subjectId);
    const taskId = parseInt(req.params.taskId);
    const userId = req.user.id;
    const { isDone } = req.body;

    // Проверка доступа к предмету
    const subjectCheck = await pool.query(`
        SELECT * FROM subjects 
        WHERE id = $1 
        AND (user_id = $2 OR EXISTS (SELECT 1 FROM subscriptions WHERE subject_id = $1 AND user_id = $2));
    `, [subjectId, userId]);

    if (subjectCheck.rows.length === 0) {
        return res.status(403).send('Нет доступа к предмету');
    }

    // Проверка существования задачи
    const taskCheck = await pool.query(`
        SELECT * FROM subject_tasks 
        WHERE id = $1 AND subject_id = $2;
    `, [taskId, subjectId]);

    if (taskCheck.rows.length === 0) {
        return res.sendStatus(404);
    }

    // Обновление статуса is_done
    await pool.query(`
        UPDATE user_subject_tasks 
        SET is_done = $3 
        WHERE subject_task_id = $1 AND user_id = $2;
    `, [taskId, userId, isDone]);

    res.sendStatus(200);
});

// Отметка задачи как сданной
router.put('/subjects/:subjectId/tasks/:taskId/pass', authenticateToken, async (req, res) => {
    const subjectId = parseInt(req.params.subjectId);
    const taskId = parseInt(req.params.taskId);
    const userId = req.user.id;
    const { isPassed } = req.body;

    // Проверка доступа к предмету
    const subjectCheck = await pool.query(`
        SELECT * FROM subjects 
        WHERE id = $1 
        AND (user_id = $2 OR EXISTS (SELECT 1 FROM subscriptions WHERE subject_id = $1 AND user_id = $2));
    `, [subjectId, userId]);

    if (subjectCheck.rows.length === 0) {
        return res.status(403).send('Нет доступа к предмету');
    }

    // Проверка существования задачи
    const taskCheck = await pool.query(`
        SELECT * FROM subject_tasks 
        WHERE id = $1 AND subject_id = $2;
    `, [taskId, subjectId]);

    if (taskCheck.rows.length === 0) {
        return res.sendStatus(404);
    }

    // Обновление статуса is_done

    try {
        await pool.query(`
        UPDATE user_subject_tasks 
        SET is_passed = $3 
        WHERE subject_task_id = $1 AND user_id = $2;
    `, [taskId, userId, isPassed]);
    } catch (err){
        res.status(500).json({ error: err.message });
    }

    res.sendStatus(200);
});

// Обновление задачи для всех, если владелец
router.put('/subjects/:subjectId/tasks/:taskId', authenticateToken, async (req, res) => {
    const subjectId = parseInt(req.params.subjectId);
    const taskId = parseInt(req.params.taskId);
    const userId = req.user.id;
    const { title, description, deadline } = req.body;

    // Проверка: является ли пользователь владельцем предмета
    // const subjectCheck = await pool.query(`
    //     SELECT * FROM subjects
    //     WHERE id = $1 AND user_id = $2;
    // `, [subjectId, userId]);
    //
    // if (subjectCheck.rows.length === 0) {
    //     return res.status(403).send('Только владелец может обновить задачу для всех');
    // }

    // Проверка существования задачи
    const taskCheck = await pool.query(`
        SELECT * FROM subject_tasks 
        WHERE id = $1 AND subject_id = $2;
    `, [taskId, subjectId]);

    if (taskCheck.rows.length === 0) {
        return res.sendStatus(404);
    }

    // Обновление задачи для всех
    await pool.query(`
        UPDATE subject_tasks 
        SET 
            title = COALESCE($3, title),
            description = COALESCE($4, description),
            deadline = COALESCE($5, deadline)
        WHERE id = $1 AND subject_id = $2;
    `, [taskId, subjectId, title, description, deadline]);

    res.sendStatus(200);
});

// Удаление задачи для всех (только владелец)
router.delete('/subjects/:subjectId/tasks/:taskId', authenticateToken, async (req, res) => {
    const subjectId = parseInt(req.params.subjectId);
    const taskId = parseInt(req.params.taskId);
    const userId = req.user.id;

    // Проверка: является ли пользователь владельцем предмета
    // const subjectCheck = await pool.query(`
    //     SELECT * FROM subjects
    //     WHERE id = $1 AND user_id = $2;
    // `, [subjectId, userId]);
    //
    // if (subjectCheck.rows.length === 0) {
    //     return res.status(403).send('Только владелец может удалить задачу');
    // }

    // Проверка существования задачи
    const taskCheck = await pool.query(`
        SELECT * FROM subject_tasks 
        WHERE id = $1 AND subject_id = $2;
    `, [taskId, subjectId]);

    if (taskCheck.rows.length === 0) {
        return res.sendStatus(404);
    }

    // Удаление связанных записей в user_subject_tasks
    await pool.query(`
        DELETE FROM user_subject_tasks 
        WHERE subject_task_id = $1;
    `, [taskId]);

    // Удаление задачи из subject_tasks
    await pool.query(`
        DELETE FROM subject_tasks 
        WHERE id = $1 AND subject_id = $2;
    `, [taskId, subjectId]);

    res.sendStatus(200);
});

module.exports = router;