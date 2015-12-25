---
layout: post
title:  "Couchbase SDKで振り返る2015年"
date:   2015-12-25 12:00:00
categories: [Couchbase]
---

Merry Xmas! ということで、[Couchbase Advent Calendar 2015](http://qiita.com/advent-calendar/2015/couchbase)も本日で最後! 最終日にふさわしいネタかは微妙ですが、 
各言語向け公式SDKの2015年分リリースノートを振り返り、面白そうなものをピックアップしてみます。バグフィックスではなく、新機能的なものにフォーカスしています。
各言語向けの変更点を見ることで2015年はどんな年だったかがわかる!かも(笑)

2015年1月から各言語向けのSDKでAPIを統一した2.0シリーズが出てきています。
CB4.0対応(N1QL、MDS)、非同期のAPIも大きなテーマですね。

リリース時期とバージョン、面白そうな変更点を表にまとめてみました!
詳細は表の下にコメントしています。

|月|CB|C|Go|Java|.NET|Node.js|PHP|Python|
|-:||-|-|-|-|-|-|-|-|
|1||2.4.6: pkgconfig(.pc)ファイルを提供、unsafe_optimizeオプション||||||2.0.0 B1:実験的acouchbase実装(asyncio)|
|2||2.4.7: N1QL、Geoの実験的サポート開始|0.1.0:初公式SDK|2.1.0: リトライストラテジ||2.0.5: 最新版io.jsへの対応|2.0.4||
|3|3.0.3|2.4.8|0.2.0|2.1.1||2.0.6|2.0.5|2.0.0 B2:N1QL、Geoサポート|
|4|[4.0DP](/couchbase/2015/04/23/introducing-developer-preview-for-couchbase-server-4.0/)|2.4.9: seqnoでのdurability constraint||2.1.2: Nagleアルゴリズムはデフォルトで無効に。RetryBuilder。||2.0.7, 2.0.8|2.0.6: PHP 5.6完全対応、5.3は非推奨に。2.0.7|2.0.0: split_result|
|5||2.5.0: n1qlback||2.1.3: パスワード付きBucketへのN1QL|2.1.0: TAPでのAsync系API実装。すでにN1QLでのRYOWの話が。SendWithRetry。2.1.1|||2.0.1|
|6|[4.0B](http://blog.couchbase.com/announcing-couchbase-server-4.0-beta)|2.5.1: MDS対応|0.3.0: bulk||2.1.2: MDS対応|||2.0.2|
|7|3.1.0|2.5.2|1.0.0B|2.1.4|2.1.3|2.0.9, 2.0.10|||
|8|[4.0RC](http://blog.couchbase.com/2015/august/couchbase-server-4.0-release-candidate-is-here)|2.5.3: Prepared statment||||2.0.11, 2.0.12||2.0.3|
|9|||1.0.0: labsからcouchbaseリポへ|2.2.0: CB4.0に対応。2.1系からのMigration Notes||2.1.0: MDS対応||2.0.4|
|10|[4.0](http://www.couchbase.com/press-releases/couchbase-announces-general-availability-of-its-4.0-release), 3.1.1|||2.2.1: DCPの向上、Stringのエンコード性能向上。2.1.5|2.2: travel-sample。2.2.1|2.1.2: prebuild対応|||
|11|3.1.2|2.5.4|1.0.1||2.2.2||2.1.0|2.0.5: TwistedのN1QL APIを修正|
|12|3.1.3, [4.1](/couchbase/2015/12/10/cb-41/)|||2.2.2: openBucketのキャッシュ。2.1.6|||||



## 少し掘り下げてみてみましょう

Cのライブラリをインストールすると、コマンドラインからCouchbase Serverのデータ入出力ができる、cbcコマンドや、負荷をかけるcbc-pillowfightなどのツールが使えて便利。このたびN1QLを使って負荷をかける[cbc-n1qlback](http://docs.couchbase.com/sdk-api/couchbase-c-client-2.5.2/md_doc_cbc-n1qlback.html)が追加されました。ニッケルバックといえばカナダのロックバンドですよねw

Javaは2.1と2.2が平行してリリースされていた状態。2.2では一部のAPIが名称変更されています。2.1から2.2へ移行する場合、[Migration Notes](http://developer-stage.cbauthx.com/documentation/server/4.0/sdks/java-2.2/release-notes.html)を見てください。

送信するパケット数を削減し、TCP/IPネットワークを効率的に利用する[Nagleアルゴリズム](https://en.wikipedia.org/wiki/Nagle%27s_algorithm)がデフォルトで無効になりました。
JIRAのチケット[JVMCBC-168](https://issues.couchbase.com/browse/JVMCBC-168)にはほとんど説明が書いてないですが、[コミットメッセージ](http://review.couchbase.org/#/c/48112/)に詳細記述あり。
Javaライブラリの修正点についてはコミットメッセージの方がだいたい詳しく書いてあります。
バッファするので無効にした方がレイテンシが改善。モダンなネットワーク向けの最適化アルゴリズムではなく、[Nettyでも](https://github.com/netty/netty/issues/939)デフォルトが無効になっているようです。

JavaでStringのエンコード性能向上というのがあります。これはStringをUTF-8のバイトに変換する際の話で、テストの結果を見ると約4倍の性能向上となっています。変更点は[こちら](http://review.couchbase.org/#/c/55910/3/src/main/java/com/couchbase/client/java/transcoder/TranscoderUtils.java)。良くやる変換なので参考にするといいかも。

祝Goの公式SDK。ドキュメントの[bulk](http://developer-stage.cbauthx.com/documentation/server/4.0/sdks/go-beta/bulk-operations.html)操作をサポートしているのは便利ですね。

そういえばRubyは? 一応[2.0のブランチ](https://github.com/couchbase/couchbase-ruby-client/tree/release20)があるけど進んでいない様子。N1QLをはじめCouchbase Server 4.0の機能を利用するには、Rubyは現時点では使えなさそう。

.NETでのTAPは、Couchbase ServerがDCPの前に使ってたTAPプロトコルではなく、[Task-based Asyncronous Pattern](https://msdn.microsoft.com/en-us/library/hh873175(v=vs.110).aspx)のこと。

.NETのリリースノートに記載されているtravel-sampleはN1QLを活用したフライトチケット検索のサンプルアプリで、[Java](https://github.com/couchbaselabs/try-cb-java), [.NET](https://github.com/couchbaselabs/try-cb-dotnet), [Node.js](https://github.com/Couchbaselabs/try-cb-nodejs), [Go](https://github.com/couchbaselabs/try-cb-golang)版があります。

Node.jsライブラリのインストール中にnode-gypのrebuildでnodeバインディングをクリアしてビルドしていましたが、[prebuild](https://www.npmjs.com/package/prebuild)を使って、事前にビルドされたものを利用する形に[変更](https://github.com/couchbase/couchnode/commit/af37d28cc2f07e063adf6d9da565a5e5caad65a6)されました。

io.jsへの対応が入っていて思い出しましたが、[Node.jsとio.jsが同じコードベースに](https://nodejs.org/en/blog/announcements/foundation-v4-announce/)というニュースもありましたね。

PHPは5.6に対応、5.3は非推奨とのこと。PHPって最新バージョンいくつなのか知らなかったので見てみたら、今年の12月に[7.0がリリース](https://secure.php.net/)されていたのですね。なぜver 6がなく7なのか?はこちらを見ると良いでしょう。[PHP RFC: Name of Next Release of PHP](https://wiki.php.net/rfc/php6)。

Pythonの非同期実装では、geventとTwistedが利用できます。詳細は[Using asynchronous frameworks](http://developer-stage.cbauthx.com/documentation/server/4.0/sdks/python-2.0/asynchronous-frameworks.html)を見ると良いでしょう。

Pythonでもバルク更新ができます。バルク更新結果で正常とエラーが混ざっていた場合に、エラーになったものをリトライ系の処理に回すときに利用できるのが[CouchbaseErrorのsplit_results()](http://pythonhosted.org/couchbase/api/exceptions.html)です。

## まとめ

アドベントカレンダー向けのネタとして、今年1年のCouchbase SDK動向を追ってみました。APIの名称はクライアントライブラリ2.xシリーズで統一されるようになりましたが、中身は当然ながら各言語らしい実装となっています。
同じテーマをいろんな言語の実装で横並びで見ると、面白いもんですね。

それではみなさん良いお年を!
