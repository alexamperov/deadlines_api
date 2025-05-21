const redis = require('redis');
const dotenv = require('dotenv');
dotenv.config();

// Создаем клиент
const client = redis.createClient({
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: process.env.REDIS_PORT || 6379
});

// Явно подключаемся к Redis
client.connect().catch((err) => {
    console.error('Failed to connect to Redis:', err);
});

module.exports = client;