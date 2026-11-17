const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const ejs = require('ejs');

const book = { _id: 'book1', title: 'Example', author: 'Author', isbn: '123', category: 'Fiction', type: 'Physical Book', description: 'A book', totalCopies: 2, availableCopies: 1, shelfLocation: 'A1' };
const member = { id: 'user1', name: 'Example User', role: 'user' };
const manager = { id: 'manager1', name: 'Example Manager', role: 'manager' };
const record = { _id: 'record1', book, user: member, requestDate: new Date(), status: 'pending' };

async function render(view, locals) {
  return ejs.renderFile(path.join(__dirname, '..', 'views', `${view}.ejs`), {
    user: null, notice: null, csrfToken: 'token', ...locals
  });
}

test('all views render for member and manager states', async () => {
  const cases = [
    ['auth', { mode: 'login' }], ['auth', { mode: 'register' }],
    ['dashboard', { user: member, records: [record], stats: [['Titles', 1]] }],
    ['dashboard', { user: manager, records: [record], stats: [['Titles', 1]] }],
    ['books', { user: member, books: [book], search: '', manager: false }],
    ['books', { user: manager, books: [book], search: '', manager: true }],
    ['book-detail', { user: member, book }],
    ['book-form', { user: manager, book: null }], ['book-form', { user: manager, book }],
    ['records', { user: member, records: [record], manager: false, heading: 'My borrowing' }],
    ['records', { user: manager, records: [record], manager: true, heading: 'Requests' }],
    ['users', { user: manager, users: [{ ...member, createdAt: new Date() }] }],
    ['error', { message: 'Not found' }]
  ];
  for (const [view, locals] of cases) assert.match(await render(view, locals), /<!doctype html>/i, view);
});

test('templates escape book and user input', async () => {
  const html = await render('book-detail', { user: member, book: { ...book, title: '<script>alert(1)</script>' } });
  assert.doesNotMatch(html, /<script>alert/);
  assert.match(html, /&lt;script&gt;/);
});

test('navigation marks the active catalogue section', async () => {
  const html = await render('books', {
    user: manager, books: [], search: '', manager: true, currentPath: '/manager/books'
  });
  assert.match(html, /href="\/manager\/books" aria-current="page"/);
});
