# 1. Берём официальный образ Node.js (легковесный)
FROM node:18-slim

# 2. Рабочая директория внутри контейнера
WORKDIR /app

# 3. Копируем package*.json и ставим зависимости
COPY package*.json ./
RUN npm install --production

# 4. Копируем весь код
COPY . .

# 5. Открываем порт 3000
EXPOSE 3001

# 6. Запускаем приложение
CMD ["npm", "start"]