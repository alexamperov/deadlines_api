const nodemailer = require('nodemailer');
const dotenv = require('dotenv');
dotenv.config();

const transporter = nodemailer.createTransport({
    host: 'smtp.yandex.ru',
    port: 465,
    secure: true, // Использует SSL/TLS
    auth: {
        user: process.env.EMAIL_USER, // Например: "user@yandex.ru"
        pass: process.env.EMAIL_PASS  // Пароль приложения
    },
    tls: {
        // rejectUnauthorized: false // Только для тестирования, если есть проблемы с SSL
    }
});

// Проверка подключения
transporter.verify((error, success) => {
    if (error) {
        console.error('Ошибка подключения к SMTP:', error.message);
    } else {
        console.log('SMTP сервер Яндекс готов к отправке писем');
    }
});

module.exports = { transporter };