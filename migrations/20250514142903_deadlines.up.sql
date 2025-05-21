-- Users
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email varchar(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL
);

-- Subjects
CREATE TABLE subjects (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(255) NOT NULL,
    invitation_code UUID DEFAULT gen_random_uuid(),
    created_at TIMESTAMP DEFAULT NOW(),
    user_id INT REFERENCES users(id) NOT NULL
);

-- Subscriptions
CREATE TABLE subscriptions (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) NOT NULL,
    subject_id INT REFERENCES subjects(id) NOT NULL
);

-- SubjectTasks (общие задачи)
CREATE TABLE subject_tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    deadline TIMESTAMP NOT NULL,
    subject_id INT REFERENCES subjects(id) NOT NULL
);

-- UserSubjectTasks (индивидуальные статусы задач)
CREATE TABLE user_subject_tasks (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id) NOT NULL,
    subject_task_id INT REFERENCES subject_tasks(id) NOT NULL,
    is_done BOOLEAN DEFAULT false,
    is_passed BOOLEAN DEFAULT false
);

-- PersonalTasks
CREATE TABLE personal_tasks (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    is_done BOOLEAN DEFAULT false,
    user_id INT REFERENCES users(id) NOT NULL
);