let labDatabase;
function labButton(label, action, primary = false) {
  const button = element('button', label, primary ? 'run' : 'lab-button');
  button.onclick = action;
  return button;
}
function finishLab() {
  const footer = $('#lab-footer');
  if (footer.children.length) return;
  if (!lessons[current].optional) {
    done.add(current);
    try { localStorage.setItem(progressKey,JSON.stringify([...done])); } catch {}
    nav();
    footer.append(element('span','✓ レッスン修了','teal'));
  }
  const next = lessons[current+1];
  footer.append(labButton(current === 0 ? 'レッスン1でSQLを実行する →' : next.free ? '自由SQLエディタへ →' : next.optional ? '発展編へ →' : '次のレッスンへ →', () => {
    select(current+1);
    $('.lessonhead').scrollIntoView({behavior:'smooth'});
  }));
}
function showLab(kind) {
  labDatabase?.close();
  labDatabase = newDatabase();
  const panel = element('section','', 'lab-panel');
  const footer = element('div','','lab-footer');
  footer.id = 'lab-footer';
  $('#lab').replaceChildren(panel, footer);
  if (kind === 'intro') introLab(panel);
  if (kind === 'primary') primaryLab(panel);
  if (kind === 'index') indexLab(panel);
  if (kind === 'vector') vectorLab(panel);
  if (done.has(current) || lessons[current].optional) finishLab();
}
function primaryLab(panel) {
  const db = labDatabase;
  const id = document.createElement('input');
  Object.assign(id,{type:'number',min:'1',step:'1',value:'1'});
  const label = element('label','登録する商品ID　');
  label.append(id);
  const code = element('pre','');
  const status = element('p','最初に ID 1 を試してください。');
  status.setAttribute('aria-live','polite');
  const rows = element('div','','scroll');
  const render = () => {
    code.textContent = "INSERT INTO products (id, name, category, price, stock)\nVALUES (" + (id.value || '?') + ", '定規', '文具', 150, 20);";
    const r = db.exec('SELECT id, name, price FROM products ORDER BY id')[0];
    rows.replaceChildren(grid(r.columns,r.values));
  };
  let duplicateSeen = false, inserted = false;
  id.oninput = render;
  const insert = () => {
    const key = id.valueAsNumber;
    if (!Number.isSafeInteger(key) || key < 1) { status.textContent='1以上の整数を入力してください。'; return; }
    try {
      db.run("INSERT INTO products (id,name,category,price,stock) VALUES (?, '定規','文具',150,20)",[key]);
      inserted = true;
      status.textContent = '登録成功。商品ID '+key+' で定規が1行追加されました。';
    } catch (e) {
      if (/products\.id/.test(e.message)) {
        duplicateSeen = true;
        status.textContent = '登録できませんでした。ID '+key+' は使用済みです。表に新しい行は追加されません。次は空いているID（例：7）を試しましょう。';
      } else status.textContent = '登録できませんでした。'+e.message;
    }
    render();
    if (duplicateSeen && inserted) finishLab();
  };
  panel.append(element('h3','主キー制約を試す'),label,labButton('登録してみる',insert,true),code,status,rows);
  render();
}
function indexLab(panel) {
  const db = labDatabase;
  const query = 'SELECT id, name, price FROM products WHERE price >= 1000;';
  const explain = () => db.exec('EXPLAIN QUERY PLAN '+query)[0].values.map(row=>row[3]).join('\n');
  const before = explain();
  const plans = element('div','');
  const results = element('div','','scroll');
  const compare = labButton('インデックスを作成して比較',() => {
    db.run('CREATE INDEX IF NOT EXISTS idx_products_price ON products(price)');
    plans.replaceChildren(grid(['状態','SQLiteの実行計画'],[['作成前',before],['作成後',explain()]]));
    const r = db.exec(query)[0];
    results.replaceChildren(element('p','検索結果は同じ2商品です。'),grid(r.columns,r.values));
    note.textContent = 'SCAN は表全体を調べる方法、SEARCH は索引から対象を絞る方法です。索引を増やすと、保存領域と商品登録・更新時の処理も増えます。';
    finishLab();
  },true);
  const note = element('p','まず作成前の実行計画を確認しましょう。');
  plans.append(grid(['状態','SQLiteの実行計画'],[['作成前',before]]));
  panel.append(element('h3','同じ検索の実行計画を比較'),element('pre','EXPLAIN QUERY PLAN\n'+query),plans,element('pre','CREATE INDEX idx_products_price ON products(price);'),compare,note,results);
}
function vectorLab(panel) {
  const db = labDatabase;
  db.run('CREATE TABLE features(product_id INTEGER PRIMARY KEY, study INTEGER, travel INTEGER); INSERT INTO features VALUES (1,5,3),(2,0,1),(3,4,5),(4,1,5),(5,2,4),(6,5,4);');
  const sliders = [], values = [];
  const ranking = element('div','','scroll');
  const query = `SELECT p.name AS 商品, f.study AS 学習, f.travel AS 携帯,
       (f.study - $s)*(f.study - $s) + (f.travel - $t)*(f.travel - $t) AS 距離の二乗
FROM features f JOIN products p ON p.id = f.product_id
ORDER BY 距離の二乗 ASC, p.id ASC LIMIT 3;`;
  const code = element('pre','');
  const update = () => {
    const [s,t] = sliders.map(x=>Number(x.value));
    values.forEach((v,i)=>v.value=sliders[i].value);
    const r = db.exec(query,{$s:s,$t:t})[0];
    ranking.replaceChildren(grid(r.columns,r.values));
    code.textContent = query.replaceAll('$s',String(s)).replaceAll('$t',String(t));
  };
  panel.append(element('h3','好みを選ぶ'),element('p','0は重視しない、5は強く重視する設定です。'));
  for (const [i,name] of ['学習向き','持ち運び向き'].entries()) {
    const label = element('label','','vector-axis');
    const input = document.createElement('input');
    Object.assign(input,{type:'range',min:'0',max:'5',step:'1',value:i===0?'5':'3'});
    input.setAttribute('aria-label',name);
    const output = element('output',input.value);
    sliders.push(input); values.push(output);
    label.append(element('span',name),input,output);
    panel.append(label);
    input.oninput = update;
  }
  const details = document.createElement('details');
  details.append(element('summary','ランキングを計算するSQL'),code);
  panel.append(element('h3','好みに近い商品 上位3件'),ranking,element('p','2つの軸の差をそれぞれ二乗して足し、小さい順に並べます。0は好みと商品が両方の軸で一致した状態です。同点は商品ID順です。'),details,element('p','この例では商品の特徴量を手作業で設定しています。AI検索では、埋め込みモデルで商品説明や検索文を数値の列（ベクトル）に変換し、近いものを探せます。'));
  update();
}

function introLab(panel) {
  const terms = [
    ['テーブル（表）','同じ種類のデータをまとめた表です。products は商品を集めたテーブルで、customers は顧客を集めた別のテーブルです。'],
    ['レコード（行）','横の1行が1件のデータです。色のついた行を左から読むと、商品ID 1の「方眼ノート」は350円で、在庫が40個あるとわかります。'],
    ['カラム（列）','縦の1列が1つの項目です。色のついた price 列には、どの商品も価格が円で入っています。name 列には商品名が入ります。'],
    ['クエリ（問い合わせ）','「どの表から、何を取り出すか」をデータベースに伝える指示です。SQLは、その指示を書くための言葉です。']
  ];
  const steps = element('ol','','tutorial-steps');
  for (const [title, instruction] of [
    ['商品表を読む', 'この画面で4つの用語を選び、表のどこを指すか確かめます。すべて見ると「レッスン1でSQLを実行する」が表示されます。'],
    ['SQLを実行する', 'レッスン1では、入力済みのSQLをそのまま「SQLを実行」で試せます。次の課題からは、取り出したい列や条件を自分で書き換えます。'],
    ['結果を見て次へ進む', '実行結果の表を課題と見比べます。困ったら「ヒント」を開き、書き直して再実行しましょう。正解したら「次のレッスンへ」を押します。']
  ]) {
    const step = element('li','');
    step.append(element('strong',title),element('p',instruction));
    steps.append(step);
  }
  panel.append(element('h3','このアプリの進め方'),steps,element('p','レッスン一覧から好きな課題に移れます。✓ はこのブラウザで修了した課題です。自由SQLエディタでは、採点なしで試せます。'));
  const controls = element('div','','term-controls');
  const progress = element('small','','term-progress');
  progress.setAttribute('aria-live','polite');
  const explanation = element('p','');
  explanation.setAttribute('aria-live','polite');
  const data = labDatabase.exec('SELECT * FROM products ORDER BY id')[0];
  const sample = grid(data.columns,data.values);
  const wrap = element('div','','scroll intro-table');
  wrap.append(sample);
  const example = element('div','');
  const visited = new Set();
  function choose(index) {
    visited.add(index);
    progress.textContent = '確認した用語　' + visited.size + ' / ' + terms.length;
    [...controls.children].forEach((b,i) => b.setAttribute('aria-pressed',String(i === index)));
    explanation.textContent = terms[index][1];
    sample.className = ['mark-table','mark-row','mark-column',''][index];
    example.replaceChildren();
    if (index === 3) {
      const query = 'SELECT name FROM products WHERE id = 1;';
      const result = labDatabase.exec(query)[0].values[0][0];
      example.append(element('p','たとえば「商品ID 1 の名前を教えて」という問い合わせは、SQLでこう書けます。'),element('pre',query),element('p','返ってくる答えは「'+result+'」です。'));
    }
    if (visited.size === terms.length) finishLab();
  }
  terms.forEach(([label],i) => controls.append(labButton(label,()=>choose(i))));
  panel.append(element('h3','商品表で用語を確かめよう'),controls,progress,explanation,wrap,example);
  choose(0);
}
