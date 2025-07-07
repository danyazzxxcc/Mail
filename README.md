# 📬 ПОЧТОВИК — Почтовый сервис с API, WEB и поддержкой ИИ

**ПОЧТОВИК** — это почтовый сервис, позволяющий вручную или с помощью искусственного интеллекта (ИИ) создавать, читать и сохранять письма. Все отправленные письма сохраняются в базе данных. Проект разделён на два приложения:

- `WEB` — клиентская часть (интерфейс для пользователей)
- `API` — серверная часть (обработка писем, работа с базой данных, ИИ)

Проект можно легко развернуть через Docker.

---

## 📁 Структура проекта

/MAIL
│
├── API/ # Серверная часть 
│ ├── Dockerfile # Docker-конфигурация для API
│ ├── .env # Файл окружения (Перед использованием замените данные!)
│ └── api.js # Исходный код API
│
├── WEB/ # Веб-интерфейс (HTML, EJS, JS, CSS)
│ └── public # Папка где хранятся стили CSS
│ │  └── css # Cтили CSS
│ ├── views # Папка где хранятся страницы проекта
│ └── web.js # Исходный код web.js
│
├── docker-compose.yml # Файл для запуска проекта через Docker
└── README.md # Документация проекта


---

## ⚙️ Возможности

- ✉️ Создание писем вручную
- 🤖 Генерация писем с помощью ИИ
- 📬 Просмотр отправленных писем
- 🧠 Интеграция с AI (например, OpenAI)
- 🗃 Сохранение всех писем в PostgreSQL
- 👤 Авторизация пользователей (опционально)

---


## 🚀 Быстрый старт с Docker

> Убедитесь, что у вас установлены **Docker** и **Docker Compose**.

### 1. Отредактируйте файл .env

Перейдите в папку API/ и откройте файл .env. Замените значения на свои при необходимости:

# .env.example
# Данные подключения к PostgreSQL
DB_USER=your_postgres_user
DB_HOST=your_postgres_host
DB_NAME=your_database_name
DB_PASSWORD=your_password
DB_PORT=5432

# Полная строка подключения (опционально, если используется ORM или прямое подключение)
DATABASE_URL=postgres://your_postgres_user:your_password@your_postgres_host:5432/your_database_name

# Секретный ключ для токенов, сессий или шифрования
SECRET_KEY=your_secret_key

# API-ключ для интеграции с  ИИ
# Cайт для получения ключа https://openrouter.ai/qwen/qwen3-235b-a22b:free

OPENAI_API_KEY=your_openai_api_key

### 2. Отредактируйте файл .env

# docker-compose.yml.example

version: '3.8'  # Версия Docker Compose

services:
  web:
    build: ./WEB                 # Путь к Dockerfile фронтенда
    ports:
      - "3001:3001"              # внешний:внутренний порт (WEB-интерфейс)
    depends_on:
      - api
    networks:
      - app_network

  api:
    build: ./API                 # Путь к Dockerfile API
    depends_on: 
      - postgres
    ports:
      - "3000:3000"              # внешний:внутренний порт (API)
    env_file:
      - ./API/.env               # Файл переменных окружения
    networks:
      - app_network

  postgres:
    image: postgres:14           # Образ PostgreSQL
    restart: always
    environment:
      POSTGRES_USER: your_user           # Замените на свой логин
      POSTGRES_PASSWORD: your_password   # Замените на свой пароль
      POSTGRES_DB: your_db_name          # Замените на имя базы данных
    volumes:
      - pgdata:/var/lib/postgresql/data  # Хранение данных
    networks:
      - app_network

networks:
  app_network:
    driver: bridge

volumes:
  pgdata:


### 3. Запустите проект

Из корневой папки MAIL выполните:

```bash  

docker-compose up --build

```

### 4. Откройте проект 

API будет доступен на: http://localhost:3000
WEB-интерфейс — на: http://localhost:3001