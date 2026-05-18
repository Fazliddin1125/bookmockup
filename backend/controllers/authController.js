import jwt from 'jsonwebtoken';

export const adminLogin = (req, res) => {
  const { username, password } = req.body;

  const adminUser = process.env.ADMIN_USERNAME;
  const adminPass = process.env.ADMIN_PASSWORD;
  const jwtSecret = process.env.JWT_SECRET;

  if (!adminUser || !adminPass || !jwtSecret) {
    return res.status(500).json({
      success: false,
      message: 'Serverda ADMIN_USERNAME, ADMIN_PASSWORD, JWT_SECRET sozlanmagan',
    });
  }

  if (username !== adminUser || password !== adminPass) {
    return res.status(401).json({ success: false, message: 'Login yoki parol noto\'g\'ri' });
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
