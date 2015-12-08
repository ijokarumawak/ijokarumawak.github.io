---
layout: post
title:  "Query WorkbenchでガンガンN1QL! その1"
date:   2015-12-08 18:30:00
categories: [Couchbase]
---

[Couchbase Advent Calendar](http://qiita.com/advent-calendar/2015/couchbase)、12/8分の記事です。今日はN1QLでJSONをいじくり倒す際に便利なQuery Workbenchを紹介します! 第1回目はインストールと起動方法です。


## Query Workbenchとは

Couchbase Serverをインストールすると、コマンドラインから実行可能な`cbq`というコマンドが付属しています。これだけでも結構便利なのですが、結果のJSONが生のJSON形式で出力されたり、過去のクエリのヒストリにはアクセスできるけど、結果は保持されてなかったり、CUIなので少し使い勝手が悪いこともありますね。

そこで本日ご紹介するのが、ブラウザからN1QLを発行して結果を綺麗に閲覧できるQuery Workbenchというツールです!

## 実行方法

[Couchbaseのダウンロードページ](http://www.couchbase.com/nosql-databases/downloads)の`Tools`から、Couchbase Query Workbenchで、お使いのOS用のファイルをダウンロードしましょう。

Zipを展開して、中にあるコマンドを実行するだけです。`./launch-cbq-gui.sh`

起動したら、ブラウザから`localhost:8094`にアクセスしましょう。

## 画面の紹介

すると、以下の画面が表示されます:

<img src="/assets/images/cbq-gui/screen.png">

説明の必要は全くないですねw
試しに、`travel-sample`にあるインデックスの一覧を検索してみましょう:

{% highlight sql %}
select idx.name, idx.index_key from system:indexes idx
where keyspace_id = "travel-sample";
{% endhighlight %}

Resultsに結果が出力されます。

### JSON表示

<img src="/assets/images/cbq-gui/json.png">

ちょっと結果が見辛いですねー。

### Table表示

<img src="/assets/images/cbq-gui/table.png" width="300px">

Tableにすると、いい感じで見えますね。

### Tree表示

Tree表示は特に`explain`でクエリの実行計画を見る時に便利です。

<img src="/assets/images/cbq-gui/tree.png" width="500px" >

今日は短いですが、ここまで :)
明日は、ドキュメントをサンプリングしてスキーマを推測する`Describe`の機能をご紹介します!

