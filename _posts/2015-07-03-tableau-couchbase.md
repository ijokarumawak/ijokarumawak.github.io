---
layout: post
title:  "Couchbase Connect 15: TableauとCouchbaseでビジュアルアナリティクス"
date:   2015-07-03 19:00:00
categories: [Couchbase]
---

Couchbase Connect 15のセッションビデオやスライド紹介シリーズ第二弾、今日は[Tableau](http://www.tableau.com/)のProduct Manager、Jeffさん、Claraさんによる[「Visual Analytics with Tableau & Couchbase」](http://connect15.couchbase.com/agenda/visual-analytics-tableau-couchbase/)を紹介します。


セッション内のアジェンダ:

- ビジュアルアナリティクス
- Tableau最新情報
- Couchbase + Tableau: データインサイトをドライブ
- Demo: N1QL + ODBC Simba driver

Tableauでは「人々がデータを見て理解するのを助ける」をミッションとして掲げています。
データを取得して、可視化して、インサイトを得て、アクションを起こす、そういったプロセスをよりスムースに、迅速に繰り返し行えるツールを提供しています。　


[GartnerのMagic Quadrant BI部門](http://www.informationweek.com/big-data/big-data-analytics/gartner-bi-magic-quadrant-2015-spots-market-turmoil/d/d-id/1319214)では、2015年に最も使いやすいBIとしてトップに立っています。

<img src="/assets/images/tableau-gartner-mq-bi.png">

Tableau Desktop、Tableau Server/Tableau Online (Hosted version)、Tableau Publicといった製品群で構成されます。
Tableau Publicは"Youtube for data."と表現していた様に、データ分析を公開して共有できるオープンなサービスです。

最新版の[v9.0](https://www.tableau.com/new-features/9.0)では、"Smart meets fast"として、ドラッグやボタン操作でより簡単にデータ分析、20%の速度向上、クエリの並列化、マルチコアの有効活用などの改善があり、Tableauの歴史の中でも非常に大きなものだそうです。


ビッグデータはデータソースが分散していたり、様々なデータタイプを扱う必要がありますが、Tableauを共通インタフェースとして分析でき、オンライン、オフラインのハイブリッド分析も可能です。

## Couchbase + Tableau

Couchbase ServerではJSONで様々な形式のデータを柔軟に扱うことができます。
Couchbase Serverに保存したJSONはN1QLでクエリすることができますが、Tableauでデータを分析する際には、ODBC接続のデータソースとして扱います。
Simbaが開発しているCouchbase ServerのODBCドライバがSQLをN1QLに変換してくれます。

<img src="/assets/images/tableau-odbc.png">

このODBCドライバはJSONデータのスキーマを推測でき、クエリの結果を直接テーブルの行列モデルで扱うことができます。
このため、JSONを行列にマッピングする作業は不要となっています

## デモ!

Couchbase Serverに保存したJSONドキュメントをTableauで可視化するデモを披露しておられます。
非常に見ていて楽しいです、是非ビデオの方もご覧ください。

Couchbase上のlandmarkバケット内にあるドキュメントの紹介がまずありました:

<img width="400" src="/assets/images/tableau-landmark-json.png">

中にはgeoがあり、入れ子構造になっていますよね?

これからこのデータにTableauからアクセスします:

- ODBCドライバのセットアップ
- Tableau Desktopから接続
- バケットの一覧からlandmarkをドラッグ

<img width="300" src="/assets/images/tableau-json-flattening.png">

すると、ODBCドライバがJSONスキーマを推測して行列に変換してくれて、入れ子になっていたgeoも、Geo\|LatとGeo\|Lonに展開されています!


## ランドマークは地図上のどこにある?

地図上へデータをプロットするのもサクサクっとできてしまいます、さらに、マウスでカリフォルニア付近を囲んでそこにフォーカスも可能。
そして、ColorにランドマークのActivity要素をマッピングすると、buy, do, drink, eatなどのアクティビティで色分けできます。
doだけ選択して表示するのもクリック操作でこんなに簡単。

<img src="/assets/images/tableau-landmark-on-map.png">

## YelpのデータとJoin

その後、landmarkのデータとYelpのデータをJoinしちゃいます。
YalpのデータはClaraさん自身がスクレイプしてCouchbaseに保存したそうです。

そして、両バケットをLeft join!

<img src="/assets/images/tableau-left-join.png">

Yelpのレビュー数をサイズに、レイティングを色に、URLを詳細にマッピングします。
どのlandmarkが人気なのか一目でわかりますね、サイズが大きくても色が薄いものは行っても混んでて満足度が低そう、などと推測できます。

<img src="/assets/images/tableau-landmark-with-yelp.png">

## ダッシュボードを作成

- 出来上がったワークシートをダッシュボードのキャンバスにドラッグ
- 地図の下にWebページ描画のウィジェットも配置
- 地図上のデータポイントをクリックした時に、同ページ内にそのURLのWebページを表示させる設定も簡単にできちゃいます


<img src="/assets/images/tableau-map-dashboard.png">

出来上がったダッシュボードはTableau Server/Tableau Onlineにアップロードして共有できます。
以上、デモのハイライトを私なりに紹介させていただきましたが、是非ビデオの方でどれだけ簡単にこれらの操作ができるかご覧ください :)

## QA

セッションの最後には、次のような質疑応答がありました:

- リアルタイムアナリティクスはサポートされないの?
  - リフレッシュを押してね、自動でリフレッシュするのもできる

- データソースの連携方法は主に以下の3つ: ODBC, クラウドデータソース(GA, SFDCなど), Web Data Connector(現在はBeta, REST API経由でデータにアクセスできる、デベロッパーが独自に実装できる)

- JSONのArray構造は同一行にカラムとしてしか展開できない?
  - デモで使ったのはSimple Flatteningとして複数カラムに展開、その他にもNormalizingとして要素を行に展開もできるようになる予定。

## さいごに

Tableau素晴らしいですね、是非みなさんもCouchbase Serverに色々なデータを保存してデータ分析を行い、業務に役立ててみてください!
ちなみに本日、「ハンズオン：初めて学ぶデータ分析ツール「Tableau Software」14日間無償ライセンス付」に参加させていただきました。
短時間に色々な操作が学べてTableau初めての方には非常にオススメです。頻繁に開催されていて、次回は[7/15](http://www.tableau.com/ja-jp/node/40331)とのことです。

Have a nice weekend!

