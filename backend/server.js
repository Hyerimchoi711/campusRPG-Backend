require('dotenv').config();
const express = require('express');
const authRoutes = require('./routes/auth');
const kakaoAuthRoutes = require('./routes/kakaoAuth');
const meRoutes = require('./routes/me');
const gameApi = require('./routes/gameApi');
const friendsRoutes = require('./routes/friends');
const usersRoutes = require('./routes/users');
const { createCorsMiddleware } = require('./corsOptions');
const { registerSwagger } = require('./swagger');

const app = express();
// 기본 5555: macOS에서 AirPlay가 5000을 점유하는 경우가 많음 (.env의 PORT로 덮어씀)
const PORT = process.env.PORT || 8888;

// Middleware
app.use(createCorsMiddleware());
app.use(express.json());

// 인증·프로필 (JWT)
app.use('/api/auth', authRoutes);
app.use('/api/auth/kakao', kakaoAuthRoutes);
app.use('/api/me', meRoutes);
app.use('/api/friends', friendsRoutes);
app.use('/api/users', usersRoutes);
// 상점·지갑·인벤토리·헬스 (gameApi는 /api 하위에 마운트)
app.use('/api', gameApi);

registerSwagger(app);

// Basic Route
app.get('/', (req, res) => {
  res.send('Campus Life RPG API is running!');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
  console.log(`Swagger index: http://localhost:${PORT}/docs`);
});
