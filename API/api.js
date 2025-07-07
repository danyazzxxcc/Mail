require('dotenv').config();
const { simpleParser } = require('mailparser');
const nodemailer = require('nodemailer');
const Imap = require('imap-simple');
const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { Pool } = require('pg');
const cors = require('cors');

const app = express();
const PORT = 3000; 
const HOST = '0.0.0.0';

app.use(cors({
    origin: 'http://localhost:3001',
    credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

console.log("DATABASE_URL >>>", process.env.DATABASE_URL);

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
});


const algorithm = 'aes-256-cbc';
const secretKey = Buffer.from(process.env.SECRET_KEY, 'hex');

function encrypt(text) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, secretKey, iv);
    const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(encryptedText) {
    const [ivHex, encryptedHex] = encryptedText.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, secretKey, iv);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
}

app.post('/api/register', async (req, res) => {
    const { login, password, email, password_email } = req.body;

    console.log('---------- РЕГИСТРАЦИЯ ----------');
    console.log('Получен запрос на регистрацию');
    console.log('Почта:', login);

    if (!login || !password || !email || !password_email) {
        return res.status(400).json({ success: false, message: 'Все поля обязательны!' });
    }

    const SearchUser = await pool.query('SELECT * FROM users WHERE login = $1', [login]);
    if (SearchUser.rows.length > 0) {
        return res.status(400).json({ success: false, message: 'Пользователь с таким логином уже существует' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const encryptedPasswordEmail = encrypt(password_email);

    await pool.query(
        'INSERT INTO users (login, password, email, password_email) VALUES ($1, $2, $3, $4)',
        [login, hashedPassword, email, encryptedPasswordEmail]
    );

    res.status(201).json({ success: true, message: 'Регистрация успешна!' });
    console.log('Регистрация успешно завершилась! Пользователь:', login, 'был успешно зарегистрирован');
});

app.post('/api/login', async (req, res) => {
    try {
        const { login, password } = req.body;

        console.log('------------- ВХОД --------------');
        console.log('Получен запрос на вход');
        console.log('Данные:', req.body);

        if (!login || !password) {
            return res.status(400).json({ success: false, message: 'Все поля обязательны!' });
        }

        const SearchUser = await pool.query('SELECT * FROM users WHERE login = $1', [login]);
        if (SearchUser.rows.length === 0) {
            console.log('Неверный логин или пароль')
            return res.status(400).json({ success: false, message: 'Неверный логин или пароль' });
        }

        const user = SearchUser.rows[0];
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
            console.log('Неверный логин или пароль')
            return res.status(401).json({ success: false, message: 'Неверный логин или пароль!' });
        }

        const user_data = {
            id: user.id,
            login: user.login,
            password: user.password,
            email: user.email,
        };

        res.status(200).json({
            success: true,
            message: 'Вход успешен!',
            user_data: user_data
        });
        console.log('Вход успешен, пользователь:', login);
    } catch (error) {
        console.error('Ошибка аутентификации:', error);
        res.status(500).json({ success: false, message: 'Ошибка сервера!' });
    }
});

app.post('/api/send_mail', async (req, res) => {
    try {
        const { id, to, subject, text } = req.body;

        console.log('------- ОТПРАВКА ПИСЬМА --------');
        console.log('Получен запрос на отправку письма');
        console.log('ID пользователя: ', id, '  пользователю: ', to);

        if (!id || !to || !subject || !text) {
            return res.status(400).json({ success: false, message: 'Отсутствуют данные' });
        }

        const result = await pool.query('SELECT email, password_email FROM users WHERE id = $1', [id]);
        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Пользователь не найден' });
        }

        const user = result.rows[0];
        const from = user.email;
        const decryptedPassword = decrypt(user.password_email);

        const transporter = nodemailer.createTransport({
            host: "smtp.yandex.ru",
            port: 465,
            secure: true,
            auth: {
                user: from,
                pass: decryptedPassword,
            },
        });

        const info = await transporter.sendMail({
            from: from,
            to: to,
            subject: subject,
            text: text,
        });

        console.log('Письмо отправлено: ', info.messageId);

        try {
            await pool.query(
                `INSERT INTO emails (fromm, too, subject, body, sent_at, status, user_id)
                 VALUES ($1, $2, $3, $4, NOW(), $5, $6)`,
                [from, to, subject, text, 'sent', id]
            );
            console.log('Письмо успешно сохранено в базе');
        } catch (dbError) {
            console.error('Ошибка при сохранении письма в базе: ', dbError);
            return res.status(500).json({ success: false, message: 'Ошибка сохранения письма в базе' });
        }

        res.status(200).json({ success: true, message: 'Письмо отправлено и сохранено' });
        console.log('Пользователь с id:', id, 'успешно отправил письмо пользователю:', to);

    } catch (error) {
        console.error('Ошибка отправки письма: ', error);
        res.status(500).json({ success: false, message: 'Ошибка сервера!' });
    }
});

app.post('/api/email_adress', async (req, res) => {
    const { id } = req.body;

    console.log('-- ЗАПРОС НЕДАВНИХ ОТПРАВИТЕЛЕЙ --');
    console.log('Получен запрос на получение недавних получателей');
    console.log('ID пользователя: ', id);

    const result = await pool.query('SELECT too FROM emails WHERE user_id = $1', [id]);
    res.json(result.rows.map(row => row.too));
});

app.post('/api/load_eamail', async (req, res) => {
  try {
    const { id, criteria } = req.body;

    if (!id) return res.status(400).json({ success: false, message: 'Отсутствуют данные' });

    const result = await pool.query('SELECT email, password_email FROM users WHERE id = $1', [id]);
    if (result.rows.length === 0) return res.status(404).json({ success: false, message: 'Пользователь не найден' });

    const user = result.rows[0];
    const from = user.email;
    const decryptedPassword = decrypt(user.password_email);

    const config = {
      imap: {
        user: from,
        password: decryptedPassword,
        host: 'imap.yandex.ru',
        port: 993,
        tls: true,
        authTimeout: 3000
      }
    };

    const connection = await Imap.connect(config);
    await connection.openBox('INBOX');

    const searchCriteria = Array.isArray(criteria) && criteria.length
      ? criteria
      : ['ALL'];

    const fetchOptions = { bodies: [''], markSeen: false };
    const messages = await connection.search(searchCriteria, fetchOptions);

    if (messages.length === 0) {
      await connection.end();
      return res.status(200).json({ success: true, message: 'Писем нет', emails: [] });
    }

    const emails = [];

    for (const item of messages) {
      const all = item.parts.find(part => part.which === '');
      const raw = all.body;

      const parsed = await simpleParser(raw);

      emails.push({
        uid: item.attributes.uid,
        from: parsed.from.text,
        subject: parsed.subject,
        date: parsed.date,
        text: parsed.text,
        html: parsed.html,
      });
    }

    await connection.end();
    return res.status(200).json({ success: true, emails });

  } catch (err) {
    console.error('Ошибка при получении писем:', err);
    return res.status(500).json({ success: false, message: 'Ошибка сервера при получении писем' });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});
