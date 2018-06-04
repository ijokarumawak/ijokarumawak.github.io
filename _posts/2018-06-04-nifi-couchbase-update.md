---
layout: post
title:  "Apache NiFi, PullRequest#2750: Couchbase連携強化"
date:   2018-06-04 00:00:00
categories: [NiFi, Couchbase]
---

初めてApache NiFiプロジェクトにCouchbase接続用の部品をコントリビュートしてから早二年半くらい経つのですね。。その後は他のエリアを扱ってて、特にメンテできてなかったのですが、NiFiもCouchbaseもそれぞれに進化しています。久々に新しい機能を追加するPull Requestを投げてみました！

<ol id="toc">
</ol>

注: 執筆時点ではまだレビュー中なので、本記事の内容は変わる可能性があります。
Disclaimer: The content of this post describes the new contributions those are not merged into Apache NiFi project yet as of this writing, and may change.


## 新機能の一覧

本記事で紹介するNiFiとCouchbase連携の新機能は次のJIRAチケットが対象です。[NIFI-5054](https://issues.apache.org/jira/browse/NIFI-5054): Couchbase Authentication, [NIFI-5257](https://issues.apache.org/jira/browse/NIFI-5257): Expand Couchbase integration。

1. User/Password認証、RBAC (Roll Based Access Control)
2. CouchbaseをNiFiのCacheストレージとして使おう! CouchbaseMapCacheClient
3. NiFiのFlowFileをエンリッチ! CouchbaseKeyValueLookupService
4. NiFiのRecordをエンリッチ! CouchbaseRecordLookupService

## 1. User/Password認証

Couchbase Server 5.0以前は、Bucketにパスワードを設定できました。5.0からバケットとは独立して、ユーザ/パスワード認証ができるようになりました。
このユーザ認証はユーザに紐づくロールでの権限ができるので、特定のバケットを読み取り専用にするなど、アクセス制御が可能です。
NiFiのProcessorは随分昔に作られたままで、この認証方式に対応していなかったので、これに対応しました。

![](/assets/images/20180604/CouchbaseUsers.png)
![](/assets/images/20180604/NiFiCouchbaseUser.png)

## 2. CouchbaseをNiFiのCacheストレージとして使おう!

NiFiのフロー内部のそれぞれのProcessor間で情報を引き継ぐオブジェクトはFlowFileです。FlowFileのAttributeを使えば、複数のProcessorで変数を元に処理を行うことができます。例えばUpdateAttributeなどでAttribute 'x'の値を3としておき、後続のRouteOnAttributeで'x > 2'といった条件でフローを分岐させるなどです。

しかし、FlowFileのAttributeでは、複数のFlowFileにまたがって状態を管理することができません。どうしてもProcessorとして状態を保持する必要があります。さらに複数のProcessorで状態を共有するには、Processor内部の変数管理でも実現できません。このようなケースに対応するために、NiFiではDistributedMapCacheというController Serviceを使います。

Wait/Notifyが良い例です。WaitとNotifyという二つのProcessorを組み合わせて、条件に一致するまでFlowFileを待たせることができます。WaitはWait/Notifyペア共通の値となる、SignalIdentifierをキーとして、DistributedMapCacheに保持されている状態を参照し、FlowFileをsuccessまたはwaitのRelationshipへと転送します。Notifyは同じSignalIdentifierをキーとして、DistributedMapCacheの値を更新します。

Wait/Notifyに関する詳しい説明は、こちらの記事、[How to wait for all fragments to be processed, then do something?](/nifi/2017/02/02/nifi-notify-batch/)も参考にしてください。

さて、これらのProcessorはDistributedMapCacheという仕組み(プロトコル)を使っているクライアントにあたります。その先の実際に値を保持しているプログラムとして、NiFiはDistributedMapCacheServerというController Serviceをバンドルしています。NiFiをインストールすれば使えるので便利なのですが、NiFiをクラスタモードで利用していると次のような問題があります。

- 現在、Primary NodeでのみController Serviceを動かす仕組みがないので、それぞれのNiFiノード上でDistributedMapCacheServerを動作させる必要がある
- この際、各ノードで閉じたキャッシュ管理をする分には、DistributedMapCacheの接続先を、'localhost'にすれば良いのだが、クラスタ全体で共有するとなると、どこかのノードのアドレスを指定する必要がある。例、3ノード、n1, n2, n3で共有したい場合、接続先をn1にすれば共有は可能
- 前述の例で、接続先のノードがダウンしてしまうと、そのノードが復旧するまでキャッシュも利用できない


さて、[PR-2750](https://github.com/apache/nifi/pull/2750)に含まれるのが、このDistributedMapCacheプロトコルをCouchbase Serverに対して実行できる、CouchbaseMapCacheClientというController Serviceです。外部のCouchbase Serverクラスタをキャッシュストレージとして利用できるので、前述のNiFiクラスタ環境で発生する課題を解決できます。

加えて、Couchbase Serverが持つノード間レプリケーションやデータ永続化でさらに可用性の高いキャッシュストレージとして利用できますね。そもそもCouchbase Serverを高性能なキャッシュサーバとして利用するケースが多いので、この組み合わせは理にかなっているでしょう。

![](/assets/images/20180604/DistributedMapCache.png)

## 3. NiFiのFlowFileをエンリッチ! CouchbaseKeyValueLookupService

NiFiを利用する際に、入力のFlowFileにさらなる情報を付与する「エンリッチ」という処理があります。LookupServiceというController Serviceの実相クラスがいくつかあり、対応するデータソースを参照して、FlowFileのAttributeに情報を付け加えることができます。

今回、CouchbaseKeyValueLookupServiceを追加して、Couchbase Serverに保存されたドキュメントのデータをLookupできるようにしました。

さらに、Sub Document APIを利用して、ドキュメントの一部だけを参照できるようにしています。

![](/assets/images/20180604/LookupAttribute.png)

## 4. NiFiのRecordをエンリッチ! CouchbaseRecordLookupService

NiFiではRecordというデータモデルをうまく利用すると、FlowFileのコンテンツを効率的に扱えます。単一のFlowFile内に複数のRecordオブジェクトを格納できるます。先のLookupAttributeはFlowFile単位でのLookupでしたが、LookupRecordを使うと、RecordごとにLookupが可能です。

CouchbaseRecordLookupServiceを利用すると、Couchbase Serverに保存されたドキュメントをRecordに付与できます。

![](/assets/images/20180604/LookupRecord.png)
