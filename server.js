require('dotenv').config();
const express = require('express');
const session = require('express-session');
const MongoStore = require('connect-mongo');
const path = require('path');
const connectDatabase = require('./config/database');

if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
  throw new Error('SESSION_SECRET must contain at least 32 characters.');
}
if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');

const app = express();
app.disable('x-powered-by');
if (process.env.NODE_ENV === 'production') app.set('trust proxy', 1);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false, limit: '32kb' }));
app.use(express.json({ limit: '32kb' }));
app.use(session({
  name: 'library.sid', secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.MONGODB_URI }),
  cookie: { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', maxAge: 8 * 60 * 60 * 1000 }
}));
app.use((req, res, next) => {
  res.locals.user = req.session.user || null;
  res.locals.notice = req.session.notice;
  res.locals.currentPath = req.path;
  delete req.session.notice;
  next();
});
app.use(require('./middleware/csrf'));
app.get('/', (req, res) => res.redirect(req.session.user ? `/${req.session.user.role}/dashboard` : '/login'));
app.use('/', require('./routes/auth'));
app.use('/user', require('./routes/user'));
app.use('/manager', require('./routes/manager'));
app.use('/api', require('./routes/api'));
app.use((req, res) => {
  if (req.originalUrl.startsWith('/api/')) return res.status(404).json({ error: 'Not found.' });
  res.status(404).render('error', { message: 'Page not found.' });
});
app.use((error, req, res, next) => {
  let status = error.status || 500;
  let message = status === 500 ? 'Something went wrong. Please try again.' : error.message;
  if (error.name === 'ValidationError') { status = 400; message = Object.values(error.errors).map(item => item.message).join(' '); }
  if (error.name === 'CastError') { status = 400; message = 'Invalid identifier or value.'; }
  if (error.code === 11000) { status = 409; message = 'This email, ISBN, or active borrowing request already exists.'; }
  if (status === 500) console.error(error);
  if (req.originalUrl.startsWith('/api/')) return res.status(status).json({ error: message });
  res.status(status).render('error', { message });
});

connectDatabase().then(() => Promise.all([
  require('./models/User').init(), require('./models/Book').init(), require('./models/BorrowRecord').init()
])).then(() => {
  app.listen(process.env.PORT || 3000, () => console.log(`Library app listening on port ${process.env.PORT || 3000}`));
}).catch(error => { console.error('Could not connect to MongoDB:', error.message); process.exit(1); });
