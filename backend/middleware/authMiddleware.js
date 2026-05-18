import jwt from 'jsonwebtoken';

export const requireAdmin = (req, res, next) => {
  const header = req.headers.authorization;

  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Admin autentifikatsiya talab qilinadi' });
  }

  const token = header.slice(7);

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Ruxsat yo\'q' });
    }
    req.admin = payload;
    return next();
  } catch {
    return res.status(401).json({ success: false, message: 'Token yaroqsiz yoki muddati tugagan' });
  }
};
