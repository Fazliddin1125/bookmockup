import jwt from 'jsonwebtoken';

export const adminLogin = (req, res) => {
  const { username, password } = req.body;

  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;
  const jwtSecret = process.env.JWT_SECRET;

  if (!adminUser || !adminPass || !jwtSecret) {
    return res.status(500).json({
      success: false,
      message: 'На сервере не настроены ADMIN_USERNAME, ADMIN_PASSWORD или JWT_SECRET',
    });
  }

  if (username !== adminUser || password !== adminPass) {
    return res.status(401).json({ success: false, message: 'Неверный логин или пароль' });
  }

  const token = jwt.sign({ role: 'admin', username }, jwtSecret, { expiresIn: '7d' });

  return res.status(200).json({
    success: true,
    data: { token, username },
  });
};

export const verifyAdmin = (req, res) => {
  return res.status(200).json({ success: true, data: { username: req.admin.username } });
};
