const seed = `
CREATE TABLE products (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, category TEXT NOT NULL,
  price INTEGER NOT NULL CHECK(price >= 0), stock INTEGER NOT NULL CHECK(stock >= 0)
);
CREATE TABLE customers (id INTEGER PRIMARY KEY, name TEXT NOT NULL, city TEXT NOT NULL);
CREATE TABLE orders (id INTEGER PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id), ordered_on TEXT NOT NULL);
CREATE TABLE order_items (
  order_id INTEGER NOT NULL REFERENCES orders(id), product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL CHECK(quantity > 0), unit_price INTEGER NOT NULL CHECK(unit_price >= 0),
  PRIMARY KEY(order_id, product_id)
);
INSERT INTO products VALUES (1,'方眼ノート','文具',350,40),(2,'マグカップ','雑貨',1200,18),
 (3,'ゲルインクペン','文具',180,65),(4,'トートバッグ','雑貨',1800,12),
 (5,'ブックカバー','雑貨',950,20),(6,'付箋セット','文具',420,32);
INSERT INTO customers VALUES (1,'佐藤 葵','さいたま市'),(2,'鈴木 陸','横浜市'),(3,'田中 結','千葉市');
INSERT INTO orders VALUES (1001,1,'2026-11-01'),(1002,3,'2026-11-02'),(1003,1,'2026-11-03'),(1004,2,'2026-11-03');
INSERT INTO order_items VALUES (1001,1,2,350),(1001,3,1,180),(1002,2,2,1200),(1003,4,1,1800),(1004,5,1,950),(1004,6,2,420);`;
const startQuery = 'SELECT *\nFROM products;';
const addProduct = "INSERT INTO products (name, category, price, stock)\nVALUES ('クリアファイル', '文具', 220, 30);";
const verifyProduct = "SELECT * FROM products WHERE name = 'クリアファイル';";
const schemas = {
  products:'商品｜id 商品ID・name 商品名・category 分類・price 単価（円）・stock 在庫数',
  customers:'顧客｜id 顧客ID・name 氏名・city 居住地',
  orders:'注文｜id 注文ID・customer_id 顧客ID・ordered_on 注文日',
  order_items:'注文明細｜order_id 注文ID・product_id 商品ID・quantity 個数・unit_price 購入時の単価（円）'
};
const lessons = [
  {lab:'intro',label:'チュートリアル',title:'チュートリアル',intro:'商品表を見ながら、データベースの言葉と、このアプリの操作を覚えましょう。'},
  {label:'最初のSELECT',title:'最初のクエリを実行しよう',intro:'商品表からすべての列を読み出します。下のSQLは入力済みです。「SQLを実行」を押して、商品6件が表示されることを確認しましょう。',answer:startQuery,hint:'SELECT * はすべての列、FROM products は商品の表を指定します。'},
  {label:'列を選ぶ',title:'値札に必要な情報を取り出そう',intro:'products から商品名（name）と価格（price）の2列を、この順で表示しましょう。',answer:'SELECT name, price FROM products;',hint:'SELECT の後に name, price と書きます。'},
  {label:'条件で絞り込む',title:'文具だけを探そう',intro:'products から分類（category）が「文具」の商品だけを、すべての列で表示しましょう。',answer:"SELECT * FROM products WHERE category = '文具';",hint:"FROM products の後に WHERE category = '文具' を追加します。"},
  {label:'並べ替える',title:'高い商品から並べよう',intro:'products の全列を価格（price）の高い順に表示しましょう。',answer:'SELECT * FROM products ORDER BY price DESC;',ordered:true,hint:'ORDER BY price DESC で価格の降順になります。'},
  {label:'集計する',title:'注文ごとの購入金額を計算しよう',intro:'order_items は1注文に含まれる商品を記録する表です。注文IDと、その注文の合計金額（個数×購入時の単価の合計）の2列を表示しましょう。',source:'order_items',answer:'SELECT order_id, SUM(quantity * unit_price) FROM order_items GROUP BY order_id;',hint:'SUM(quantity * unit_price) で金額を合計し、GROUP BY order_id で注文ごとにまとめます。'},
  {label:'テーブルを結合',title:'誰が注文したかを調べよう',intro:'orders.customer_id は customers.id に対応します。2つの表を結合して、注文IDと顧客名の2列を表示しましょう。',source:'orders',answer:'SELECT orders.id, customers.name FROM orders JOIN customers ON orders.customer_id = customers.id;',hint:'JOIN customers ON orders.customer_id = customers.id で同じ顧客の行をつなぎます。'},
  {label:'商品を追加する',title:'INSERTで新商品を登録しよう',intro:'新商品「クリアファイル」を文具・220円・在庫30個で登録しましょう。SQLを実行したら、追加した商品をSELECTで確認できます。',write:true,starter:addProduct,hint:'INSERT INTO の列と VALUES の値は同じ順番です。商品IDは自動で割り振られます。'},
  {lab:'primary',label:'主キー',title:'同じ商品IDで登録すると？',intro:'主キーは、表の中で1行を特定する目印です。products の主キーは id です。既存のIDと新しいIDで、同じ商品を登録してみましょう。'},
  {lab:'index',label:'インデックス',title:'価格の索引を作ってみよう',intro:'価格が1,000円以上の商品を探します。価格列にインデックスを作り、同じSQLでもSQLiteの探し方がどう変わるか見てみましょう。'},
  {lab:'vector',optional:true,label:'ベクトル検索',title:'好みに近い商品を探そう',intro:'商品を「学習向き」と「持ち運び向き」の2つの数値で表します。好みを動かして、近い商品を探しましょう。'},
  {label:'自由SQLエディタ',title:'自由SQLエディタ',intro:'ECサイトのデータを使い、課題や採点なしでSQLiteを試せます。JOINやWITHでの分析、商品の追加・更新・削除、自分のテーブルの作成もできます。複数のSQLはセミコロンで区切ってください。途中でエラーが出た場合は、その回の変更がすべて取り消されます。',write:true,free:true,starter:startQuery,hint:"UPDATE products SET price = 380 WHERE id = 1; で価格変更、DELETE FROM products WHERE name = 'クリアファイル'; で指定商品の削除ができます。WHERE で対象を選びましょう。"}
];
