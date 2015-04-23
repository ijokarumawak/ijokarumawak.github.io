---
layout: post
title:  "訳: Couchbase Server 4.0 デベロッパープレビューの紹介"
date:   2015-04-23 12:30:00
categories: [Couchbase]
---

いよいよ、Couchbase Server 4.0がデベロッパープレビューとして触れるようになりました! N1QLのDPは先行して外付けのエンジンとして利用可能でしたが、このリリースでは4.0の機能を一つのパッケージとして統合したかたちでお試しいただけます。プロダクトマネージメントディレクター、Cihanのブログを和訳しましたので、ご覧ください。

原文はこちら: [Introducing Couchbase Server 4.0 Developer Preview](http://blog.couchbase.com/introducing-developer-preview-for-couchbase-server-4.0)

- [SQL for Documents (コードネーム: N1QL)](#s4d)
- [新グローバルセカンダリインデックス (GSI)](#gsi)
- [多次元スケーリング](#mds)
- [SDKとJDBC/ODBCによる接続](#odbc)
- [よりシンプルなセキュリティコンプライアンス](#security)

---


ついにCouchbase Server 4.0がデベロッパープレビューとして、そのヴェールを脱ぐ時がきました。

この早期リリースでは、SQL for Documents (コードネーム: N1QL) による新規のクエリインターフェース、グローバルセカンダリインデックス (Global Secondary Index: GSI) によるまったく新しい低レイテンシのクエリ用のインデックス、多次元スケーリング (Multi-Dimensional Scaling: MDS) と呼ばれる革新的かつスケーラブルな新アーキテクチャ、シンプルになったセキュリティとコンプライアンス、これらを含む非常に多くの素晴らしい機能拡張を盛り込んでいます。

これらの機能のうちいくつかは2年以上の作業を経て、そして以前のバージョンで提供されたデータベース変更プロトコル(DCP)やチューナブルメモリといった抜本的なアーキテクチャの改善を元に開発されています。

これらの機能追加によりCouchbase Server 4.0は、リアルタイムでスケーラブルなNoSQLプラットフォームをお探しのエンタープライズ企業にとって、非常に強力なリリースとなっています。

# What's new in 4.0?

<!-- close the quote' -->

詳細を見てみましょう!

<a id="s4d"></a>

## SQL for Documents (コードネーム: N1QL)

多くの方はSQLを長年お使いで、一見しただけで、Couchbase ServerのSQL for Documentに親しみを覚えていただけるでしょう。
しかしながら、SQL for Documentsは加えていくつかの協力な独自の機能を持ち合わせています。

SQL for DocumentsはネイティブにJSONを扱います。
SQL for DocumentsはCouchbase Serverの柔軟なデータモデル (すなわち、JSONをベースとしたドキュメントデータ) を扱い、JSONを返すことで、アプリケーションとデータベースにおけるオブジェクトの忠実な表現を可能としています。
SQL for Documentsは基本的なデータ型に加え、ネイティブに配列や入れ子のドキュメント型に対応し、条件一致によるこれらに対する操作をクエリ言語から容易に行うことができます。
完全に機能するSQLの実装としては、多くの可能性を期待されるでしょう。JOINや、サブクエリ、NEST/UNNESTといった機能は、以前のクライアント側での複雑なコードの多くを改善できます。

SQL for Documentsによってアプリケーションコードを非常に簡潔に記述することができるのです!

<a id="gsi"></a>

## 新グローバルセカンダリインデックス (GSI)

Couchbase Server 4.0は、クエリを高速化しスケールするためにインデックスを作成する、ユニークな方法を追加しています。

新しいグローバルセカンダリインデックス (GSI)によって、以前は不可能だった、ビッグデータをリアルタイムのレイテンシによりクエリできる、新しい種別のアプリケーションの開発が可能になります。

すべてのデータマネージメント環境において、インデックスは主要なデータ操作 (INSERT, UPDATE, DELETE) と常に競合しています。
バージョン4.0の新しいGSIテクノロジでは、メインのデータから独立してスケールし、独立して分割できるインデックスの作成が可能で、データの格納とインデックスのメンテナンス間でのリソースの競合を最小化できます。

SQL for Documentsはまた、以前からCouchbase Serverで利用可能だった、JSONドキュメントへの高速なアクセスを提供するパワフルな手段であるインクリメンタルなMapReduce Viewも活用します。

<a id="mds"></a>

## 多次元スケーリング

新しい多次元スケーリング (Multi-Dimentional Scaling: MDS) モデルは多くのアプリケーションが要求するレイテンシとスループットに大変革をもたらします。

既存のビッグデータやNoSQLデータベースでは、従来のスケーラビリティモデルはワークロードを均一にコモディティなマシン間で分散する、均一的なスケールアウトです。
これは以前からのCouchbase Serverが動作する手法であり、継続してこのシンプルなトポロジをCouchbase Server 4.0のMDSでも利用できます。

<img src="http://blog.couchbase.com/binaries/content/gallery/website/blogs/april-2014/developer-preview-4-blog-images/slide11.jpg" />

図: 均一なスケーリング

このリリースで加わったのは、レイテンシ要件の厳しいアプリケーションにおいて、高度なユーザがクラスタアーキテクチャを調整し、アプリケーション性能を向上させる選択肢です。
多次元スケーリングによって、データ、インデクシング、クエリの負荷ごとに異なるサービスをデプロイすることができます。

これらのワークロードを含む各「領域」では、個別にハードウェアの選定が可能で、例えばデータサービスがスケールアウトする一方、インデクシングとクエリサービスは、より大きなノードにデプロイすることでスケールアップできます。

<img src="http://blog.couchbase.com/binaries/content/gallery/website/blogs/april-2014/developer-preview-4-blog-images/slide12.jpg" />

図: 多次元スケーリングによる独立したスケーリング

<a id="odbc"></a>

## SDKとJDBC/ODBCによる接続

ネイティブなCouchbase Server SDKはSQL for Documents (コードネーム: N1QL)、そしてリリースされるすべての新機能と連携できます。
お気に入りのSDKの最新版をダウンロードするだけで接続できます! 接続するだけで満足なさらないように...

リレーショナルSQLは長い歴史を持ち、TableauやMicrosoft Office、SAP Business Objectsといった、データ管理、レポート作成や可視化など多くの既存ツールが広まっています。
既存のツールとCouchbase Serverを連携したシステムを構築を試される場合、同時にデベロッパープレビューとしてSimba technologiesからリリースされている、Couchbase Server 4.0へSQL-92スタンダードによるデータアクセスを可能とする[ODBCとJDBCドライバ](http://simba.com/couchbase/couchbase-odbc-jdbc-connectivity-solutions-developer-previews-now-available)をご利用ください。

<a id="security"></a>

## よりシンプルなセキュリティコンプライアンス

セキュリティは最も重要な課題で、多くの企業では内部統制を課したり、外部のルールや規則を遵守する必要があります。
Couchbase Server 4.0では、よりシンプルにPCI、HIPAA、FISMAなどのセキュリティ標準を遵守するセキュリティコントロールが可能です。

バージョン4.0はネイティブにLDAPと連携した管理者アカウントの管理、新規の監査ログ機能によって、管理者操作をきめ細かく追跡することができます。
これらがデータファイルやネットワーク転送時の暗号化といった既存の機能に加わります。

## より深く!

ここではCouchbase Server 4.0が持たらす新しい機能の概要を説明しただけですが、これ以外にも多くあります...
より詳細な情報は[getting started guide](http://docs.couchbase.com/4.0/intro/index.html)をご覧ください。

## OK! どこから4.0をはじめれば良いの?

次の点に注意してください: Couchbase Server 4.0はまだ活発な開発途上にあります。
これは***あなたの声***が製品の最終バージョンに大きく影響するということを意味します。
お試しいただき、ぜひフィードバックをお送りください。
フィードバックの提供は簡単です! [feedback page](http://docs.couchbase.com/4.0/intro/giving-feedback.html)にフィードバック方法をまとめています。

デベロッパープレビューは簡単にお使いいただけます。

- はじめの一歩として、[getting started guide](http://docs.couchbase.com/4.0/intro/index.html)をご覧ください。
- ダウンロードして利用を開始するには:
  - Couchbase Server 4.0 Developer Previewを[プレリリースページ](http://www.couchbase.com/nosql-databases/downloads#PreRelease)からダウンロードしてください
  - Java、.Net、Nodeやその他の開発言語でネイティブなSDKの最新バージョンは、[ダウンロードページの"client libraries"セクション](http://www.couchbase.com/nosql-databases/downloads)にあります
  - Couchbase Server 4.0 Developer PreviewにSQL-92で接続できるSimba ODBC & JDBCドライバのダウンロードは[こちら](http://simba.com/couchbase/couchbase-odbc-jdbc-connectivity-solutions-developer-previews-now-available)を参照してください。

より詳細な情報、4.0リリースの最新情報は、[Couchbase Server 4.0のページ](http://www.couchbase.com/coming-in-couchbase-server-4-0)をご覧ください。
