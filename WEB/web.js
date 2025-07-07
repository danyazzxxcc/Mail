const { secret } = require('./config');
const cookieParser = require('cookie-parser');
const express = require('express');
const path = require('path');
const cors = require('cors');
const app = express();
const PORT = 3001;
const HOST = '0.0.0.0';

app.use(cors({
    origin: 'http://localhost:3000', 
    credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({  limit: '10mb', extended: true }));
app.use(cookieParser(secret));

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));
app.set('views', path.join(__dirname, 'views'));


// Middleware проверки авторизации
function checkAuth(req, res, next) {
  // Пути, доступные без авторизации
  const openPaths = ['/auth', '/auth_post', '/reg', '/'];

  // Если запрошенный путь в списке разрешённых — пропускаем
  if (openPaths.includes(req.path)) {
    return next();
  }

  // Проверяем наличие cookie 'id'
  if (!req.cookies.id) {
    return res.redirect('/auth');
  }
  next();
}
app.use(checkAuth);

app.get('/', (req, res) => {
  res.status(200).type('text/html');
  res.render('main.ejs', { title: 'Авторизация' });
});

app.get('/auth', (req, res) => {
  res.status(200).type('text/html');
  res.render('auth.ejs', { title: 'Авторизация' });
});

app.post('/auth_post', async (req, res) => {
  const { login, password } = req.body;

  console.log('Вход пользователя:', login, 'Данные пользователя:', req.body); 

  try {
    const response = await fetch('http://api:3000/api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password }),
      credentials: 'include'
    });

    const data = await response.json();

    if (data.success) {  
        res.cookie('id', data.user_data.id, {
          maxAge: 7 * 24 * 60 * 60 * 1000,
          httpOnly: false,
          secure: false,  // Для разработки с HTTP (для HTTPS нужно установить true)
          sameSite: "Strict"
      });
    

      res.redirect('/account');
    } else {
      res.status(400).render('auth', { message: data.message });
    }
  } catch (error) {
    console.error('Ошибка:', error);
    res.status(500).render('auth', { message: 'Ошибка сервера' });
  }
});

app.get('/reg', (req, res) => {
  res.status(200).type('text/html');
  res.render('reg.ejs', { title: 'Авторизация' });
});

app.get('/account', (req, res) => {
  res.status(200).type('text/html');
  res.render('account.ejs', { title: 'Авторизация' });
});

app.post('/send', (req, res) => {
  const {subject, body} = req.body;

  res.render('send_email.ejs', {
    subject: subject,
    body: body
  });
});

app.get('/send', (req, res) => {
  const subject = req.query.subject || '';
  const body = req.query.body || '';
  res.render('send_email', { subject, body });
});

// Ошибки

// Обработчик для 404 - если маршрут не найден
app.use((req, res, next) => {
  res.status(404).render('error', { errorCode: 404 });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  const status = err.status || 500;
  res.status(status).render('error', { errorCode: status });
});

app.listen(PORT, HOST, () => {
  console.log(`Server running at http://${HOST}:${PORT}`);
});