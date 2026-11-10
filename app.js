const $ = selector => document.querySelector(selector);
const progressKey = 'query-field-ec-complete-v2';
const drafts = new Map();
const total = lessons.filter(lesson => !lesson.free && !lesson.optional).length;
let current = 0, SQL, courseDB, practiceDB, sandboxDB;
let done = new Set();
try {
  const saved = localStorage.getItem(progressKey);
  if (saved !== null) done = new Set(JSON.parse(saved));
  else {
    const previous = JSON.parse(localStorage.getItem('query-field-ec-complete-v1') || '[]');
    done = new Set(previous.filter(i => Number.isInteger(i) && i >= 0 && i < 9).map(i => i + 1));
    localStorage.setItem(progressKey, JSON.stringify([...done]));
  }
} catch {}
function newDatabase() {
  const db = new SQL.Database();
  db.run('PRAGMA foreign_keys=ON');
  db.run(seed);
  return db;
}
function activeDB() {
  if (lessons[current].free) {
    if (!sandboxDB) {
      sandboxDB = new SQL.Database(practiceDB.export());
      practiceDB.run('PRAGMA foreign_keys=ON');
      sandboxDB.run('PRAGMA foreign_keys=ON');
    }
    return sandboxDB;
  }
  return lessons[current].write ? practiceDB : courseDB;
}
function element(tag, value, className) {
  const el = document.createElement(tag);
  el.textContent = value;
  if (className) el.className = className;
  return el;
}
function grid(columns, rows) {
  const table = document.createElement('table');
  const header = table.createTHead().insertRow();
  columns.forEach(label => header.append(element('th', label)));
  const body = table.createTBody();
  for (const row of rows) {
    const tr = body.insertRow();
    row.forEach(value => tr.insertCell().textContent = value ?? 'NULL');
  }
  return table;
}
function nav() {
  const menu = $('nav');
  menu.replaceChildren();
  lessons.forEach((lesson, i) => {
    const b = element('button', '', i === current ? 'active' : '');
    const number = lesson.free ? 'SQL' : lesson.optional ? 'AI' : String(i).padStart(2,'0');
    b.append(element('span', done.has(i) ? '✓' : number, 'num'), lesson.label);
    b.onclick = () => select(i);
    menu.append(b);
  });
  $('#count').textContent = done.size + ' / ' + total;
  $('.track i').style.width = 100 * done.size / total + '%';
}
function paint() {
  const q = $('#sql'), pre = $('#highlight');
  pre.replaceChildren();
  for (const token of q.value.split(/\b(SELECT|FROM|WHERE|ORDER BY|DESC|ASC|SUM|GROUP BY|JOIN|ON|AS|LIMIT|INSERT INTO|VALUES|UPDATE|SET|DELETE)\b/gi).entries()) {
    pre.append(token[0] % 2 ? element('em',token[1]) : document.createTextNode(token[1]));
  }
  $('#lines').textContent = q.value.split('\n').map((_,i) => i + 1).join('\n');
  pre.scrollTop = q.scrollTop;
  pre.scrollLeft = q.scrollLeft;
  $('#lines').scrollTop = q.scrollTop;
}
function starter() {
  const lesson = lessons[current];
  return lesson.starter || 'SELECT *\nFROM ' + (lesson.source || 'products') + ';';
}
function select(i) {
  if (courseDB && !lessons[current].lab) drafts.set(current, $('#sql').value);
  current = i;
  const lesson = lessons[i];
  $('#number').textContent = lesson.free ? 'SQL SANDBOX' : lesson.optional ? '発展編 · AI SEARCH' : 'LESSON ' + String(i).padStart(2,'0');
  $('#table-panel').hidden = i === 1;
  $('#title').textContent = lesson.title;
  $('#intro').textContent = lesson.intro;
  $('main').classList.toggle('lab-mode', Boolean(lesson.lab));
  $('#lab').hidden = !lesson.lab;
  $('#openSandbox').hidden = lesson.free;
  if (lesson.lab) {
    if (SQL) showLab(lesson.lab);
    nav();
    return;
  }
  $('#sql').value = drafts.get(i) ?? starter();
  $('#hintText').textContent = lesson.hint;
  $('#hintText').hidden = true;
  $('#restore').hidden = !lesson.write;
  $('#openSandbox').hidden = lesson.free;
  $('#tableChoice').value = lesson.source || 'products';
  $('#result').replaceChildren(element('p','SQLを実行すると、ここに結果が表示されます。'));
  if (courseDB) preview();
  paint();
  nav();
}
function preview() {
  const choice = $('#tableChoice');
  const db = activeDB();
  const names = lessons[current].free
    ? (db.exec("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT GLOB 'sqlite_*' ORDER BY name")[0]?.values.flat() || [])
    : Object.keys(schemas);
  const name = names.includes(choice.value) ? choice.value : names[0];
  choice.replaceChildren(...names.map(item => new Option(item,item)));
  if (!name) {
    $('#preview').replaceChildren();
    $('#tableFoot').textContent = 'テーブルがありません。CREATE TABLE で作成できます。';
    return;
  }
  choice.value = name;
  const identifier = '"' + name.replaceAll('"', '""') + '"';
  const order = lessons[current].free ? '' : ' ORDER BY rowid ' + (lessons[current].write ? 'DESC' : 'ASC');
  const stmt = db.prepare('SELECT * FROM ' + identifier + order + ' LIMIT 6');
  const columns = stmt.getColumnNames(), rows = [];
  while (stmt.step()) rows.push(stmt.get());
  stmt.free();
  const count = db.exec('SELECT COUNT(*) FROM ' + identifier)[0].values[0][0];
  $('#preview').replaceChildren(grid(columns,rows));
  $('#tableFoot').textContent = count + ' 行中 ' + rows.length + ' 行を表示' + (lessons[current].free ? '' : '　｜　' + schemas[name]);
}
function execute(db, query, writable, sandbox = false) {
  const results = [];
  db.run('SAVEPOINT exercise');
  try {
    for (const stmt of db.iterateStatements(query)) {
      const text = stmt.getSQL().replace(/^(?:\s|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/, '');
      const verb = text.match(/^\w+/)?.[0].toUpperCase();
      if (!['SELECT', ...(writable ? ['INSERT','UPDATE','DELETE'] : []), ...(sandbox ? ['WITH','CREATE','DROP','ALTER','REPLACE','VALUES','EXPLAIN'] : [])].includes(verb)) {
        if (sandbox) throw Error('検索、集計、データ編集、テーブルやビューの作成・変更・削除に対応しています。');
        throw Error(writable ? 'SELECT・INSERT・UPDATE・DELETE を使ってください。' : 'このレッスンではSELECTを使います。書き込みはINSERT演習と自由練習で試せます。');
      }
      const columns = stmt.getColumnNames(), rows = [];
      while (stmt.step()) {
        if (rows.length >= 1000) throw Error('結果が1,000行を超えました。LIMITで件数を指定してください。');
        rows.push(stmt.get());
      }
      results.push({verb, columns, rows, changes:db.getRowsModified()});
    }
    if (!results.length) throw Error('SQLを入力してください。');
    db.run('RELEASE exercise');
    return results;
  } catch (e) {
    db.run('ROLLBACK TO exercise; RELEASE exercise');
    throw e;
  }
}
function correct(results, existed) {
  const l = lessons[current];
  if (l.free) return false;
  if (l.write) {
    return !existed && results.some(r => r.verb === 'INSERT') &&
      practiceDB.exec(verifyProduct)[0]?.values.some(([, , category, price, stock]) => category === '文具' && price === 220 && stock === 30);
  }
  const actual = results.at(-1).rows.map(row => JSON.stringify(row));
  const expected = courseDB.exec(l.answer)[0].values.map(row => JSON.stringify(row));
  if (!l.ordered) { actual.sort(); expected.sort(); }
  return JSON.stringify(actual) === JSON.stringify(expected);
}
function run() {
  const l = lessons[current], result = $('#result');
  result.replaceChildren();
  try {
    const existed = l.write && !l.free && practiceDB.exec(verifyProduct).length > 0;
    const results = execute(activeDB(), $('#sql').value, l.write, l.free);
    preview();
    if (correct(results, existed)) {
      done.add(current);
      try { localStorage.setItem(progressKey, JSON.stringify([...done])); } catch {}
      nav();
      result.append(element('p', '✓ 正解です！', 'success'));
    } else if (!l.free && !done.has(current)) {
      result.append(element('p','課題と結果を見比べてみましょう。'));
    }
    for (const r of results) {
      if (!r.columns.length) {
        const status = ['INSERT','UPDATE','DELETE','REPLACE'].includes(r.verb)
          ? r.changes + ' 件を変更しました。' : '実行しました。';
        result.append(element('p', r.verb + '：' + status));
      }
      if (r.columns.length) {
        result.append(element('p', r.rows.length + ' 行'));
        const wrap = element('div','','scroll');
        wrap.append(grid(r.columns,r.rows));
        result.append(wrap);
      }
    }
    if (l.write && !l.free && results.some(r => r.verb === 'INSERT')) {
      const check = element('button','追加した商品をSELECTで確認','run');
      check.onclick = () => { $('#sql').value = verifyProduct; paint(); run(); };
      result.append(check);
    }
    if (done.has(current) && current + 1 < lessons.length) {
      const next = element('button',lessons[current+1].free ? '自由練習へ →' : '次のレッスンへ →','run');
      next.onclick = () => { select(current+1); $('.lessonhead').scrollIntoView({behavior:'smooth'}); };
      result.append(next);
    }
  } catch (e) {
    let msg = e.message;
    if (/UNIQUE constraint/.test(msg)) msg += ' — 同じ商品名やIDがすでにあります。SELECTで確認できます。';
    result.append(element('p','SQLを確認してください。 '+msg));
  }
  result.scrollIntoView({behavior:'smooth',block:'nearest'});
}
$('#sql').oninput = paint;
$('#sql').onscroll = paint;
$('#sql').onkeydown = e => {
  if (courseDB && !lessons[current].lab && (e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
};
$('#hint').onclick = () => { $('#hintText').hidden = !$('#hintText').hidden; };
$('#reset').onclick = () => { $('#sql').value = starter(); paint(); };
$('#restore').onclick = () => {
  if (!confirm('この練習画面のデータを初期状態に戻しますか？ 修了記録は残ります。')) return;
  if (lessons[current].free) {
    sandboxDB?.close();
    sandboxDB = newDatabase();
  } else {
    practiceDB.close();
    practiceDB = newDatabase();
  }
  preview();
  $('#result').replaceChildren(element('p','練習データを初期状態に戻しました。'));
};
$('#guide').onclick = () => $('dialog').showModal();
$('#close').onclick = () => $('dialog').close();
function openSandbox() {
  select(lessons.findIndex(l => l.free));
  $('.lessonhead').scrollIntoView({behavior:'smooth'});
}
$('#openSandbox').onclick = openSandbox;
const initial = location.hash ? lessons.findIndex(l => (l.lab || (l.free ? 'sandbox' : '')) === location.hash.slice(1)) : 0;
select(Math.max(0,initial));
$('#run').disabled = true;
initSqlJs().then(engine => {
  SQL = engine;
  courseDB = newDatabase();
  practiceDB = newDatabase();
  if (lessons[current].lab) showLab(lessons[current].lab); else preview();
  $('#run').disabled = false;
  $('#run').onclick = run;
  $('#tableChoice').onchange = preview;
}).catch(() => $('#result').textContent = 'データベースの読み込みに失敗しました。再読み込みしてください。');
