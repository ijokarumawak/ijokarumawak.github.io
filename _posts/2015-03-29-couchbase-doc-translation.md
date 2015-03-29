---
layout: post
title:  "Couchbase Server公式ドキュメントの翻訳"
date:   2015-03-29 23:00:00
categories: [Couchbase]
---

こんばんは、ご存知の方もいらっしゃるかと思いますが、私、[Couchbase](http://couchbase.com/)というドキュメント型NoSQLデータベースを提供する会社で働いております。

日本での普及活動を日々行っているわけですが、日本語の情報が少なくて、という声をしばしば耳にします。

## [Couchbase Server日本語ドキュメント](http://labs.couchbase.com/docs-ja/preview/contents/Couchbase-intro.html): Preview版

そこで、[公式ドキュメント](http://docs.couchbase.com/admin/admin/Couchbase-intro.html)の日本語訳をコツコツと進めています。結構なボリュームなので、いつになったら完了するのやら、と思いつつ、終わったところからプレビューとして公開してますので、良かったらご参照ください。

また、翻訳のプロセスは[Githubのプロジェクト](https://github.com/couchbaselabs/docs-ja)を利用してオープンにやっているので、翻訳にご協力していただけると非常に嬉しいです! 「このページの訳が早く欲しい」みたいなコメントもモチベーションが上がるのでお待ちしてます。ご興味のある方はTwitterとかFBでお気軽にメッセージ送ってください。

## 翻訳メモリ、自作中

余談ですが、以前、Couchbase Server 2.0のドキュメントも翻訳していました。当時はGoogle Translator Toolkitを使っていたのですが、今回は使ってません。理由として:

- XMLファイルをアップロードできない: ドキュメントはDITA形式で記述されたXMLファイルが元になっていますが、XMLを直接アップロードできないのです。以前はXSLTを使ってHTMLに変換して、またXMLに戻して、とやっていました。しかしどうにも面倒で、再生成したXMLファイルのインデントとオリジナルの英文とが一致せず、変更時のDiffが取りづらいとか、色々問題がありました。
- デフォルトで機械翻訳が反映されるが結局ほぼ訳し直す: 割と良い感じで機械翻訳してくれることもありますが、直訳でなく、文脈を意識した自然な日本語としては満足できず、手作業で訳すことが多いです。

そこで、せっかくなのでCouchbase Serverを使って翻訳メモリを自分で作ることにしましたー。
Sparkも使ってみたかったので勉強も兼ねて。(ここそこで散々「Sparking!」とシャウトしていたので、使わない訳にはいかないでしょう、と)

また、「中の人」の特典を活かし、時期バージョンのCouchbase Serverを使って開発してます。N1QL便利です!

ある程度動くようになったので、綺麗なコードではないですが、Githubで公開してます。Couchbase使ったアプリのコードって実際どんなんやねん、という方は見てみると何か得るものがあるかも。。プロジェクトは現在以下の2つで構成されてます:

### [translation-spark](https://github.com/ijokarumawak/translation-spark)

Sparkを使ったバッチアプリケーションです。

1. DITAのXMLファイルからテキストを抽出して、センテンスで区切ってCouchbase Serverに登録
2. Couchbase ServerのSparkコネクタとN1QLを使ってJSONドキュメントを読み込み、Sparking!
3. Lucene使って単語分割、TFIDFを計算しセンテンスをベクトル化、RowMatrixを作成
4. 各センテンスのコサイン類似度を計算して、似たセンテンスの上位n件をCouchbase Serverに保存

ってなことを実装しています。ScalaもSparkもまだまだへっぽこですが、とりあえず期待通りの動き。

### [translation-ui](https://github.com/ijokarumawak/translation-ui)

AngularとNode.jsで開発してるWebアプリです。今んとこ次の機能が動くようになりました:

- 英文、和文を並べて表示して、翻訳作業ができる、データはCouchbase Serverに保存
- 和文のテキストエリアを選択すると、Sparkで計算した似たような文書を表示できる
- 似た文書、英文そのものをコピーで入力できる
- 訳した日本語をクリップボードにコピーできる


今後はユーザ認証など実装して、みなさんに使ってもらえるようにしたいです。そしたら手伝ってくれる人も増えるかなー、なんて。

開発を通して得るものが多いので、時間を見つけてここで共有していきたいと思います! おやすみなさいー。
