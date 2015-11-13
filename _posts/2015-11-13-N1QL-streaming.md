---
layout: post
title:  "巨大な結果を返すN1QLクエリをストリーム形式で処理しよう"
date:   2015-11-13 16:00:00
categories: [Couchbase]
---

みなさん、N1QL使ってますか? 便利ですよねー。でもどうやって動いてるのか幾つか気になるところもあります。今回はその中でも、`select * from huge_bucket`みたいにLimit付けずに膨大な結果を返すようなクエリを発行したら、どこでどうなるのか実験してみました。

## N1QLクエリの流れ

アプリケーションからN1QLを実行した時の流れをおさらいしておきましょう。

`App` --- HTTP:REST ---> `Query Service` --- Memcached Binary ---> `Data Service`

- Javaなどのアプリケーションからクエリを実行すると、SDKがCouchbaseクラスタ内のQuery Serviceに対してRESTでクエリを送信
- Query Serviceはクエリを解析してインデックスが使えればIndex Serviceにもアクセスしますが、今回はここは割愛、また別の機会に掘り下げてみます
- Query ServiceはData ServiceからJSONドキュメントを取得して必要な情報に加工し
- 最終的にクエリの結果はJSONでアプリに帰ってくるわけですが、巨大なJSONだったらどうなっちゃうの??

今回実験では30万件弱のドキュメントが保存されているバケットを使います。あまり大きくはないですが、実験には十分でしょう。

## まずはRESTを直接叩いてみる

Query Serviceで稼働しているN1QLクエリのREST APIを直接叩いて、Query ServiceがどのようにHTTPのレスポンスを返しているのかを観察してみました。

30万件程度のJSONドキュメントを全て返すクエリを次のcURLコマンドで実行します。HTTPの情報だけ見えれば良いので、結果は/dev/nullへ。

{% highlight bash %}
$ curl -i -v http://localhost:8093/query/service \
-d "statement=SELECT * FROM couchmusic1" -o /dev/null
{% endhighlight %}

すると、実行直後、すぐにレスポンスの返却が始まるのがわかります。そして各ドキュメントを返却している間にも、Couchbaseの管理画面を見ると、バケットへのgetリクエストが継続していることが分かります。

つまり、Query Serviceはちゃんとレスポンスをストリームで返してくれるということです。なので、大量の結果を返すN1QLクエリを発行しても、Query Serviceのプロセスのメモリに溜まってしまうということは心配しなくても良いですね。

<img src="/assets/images/n1ql-stream/curl-output.png">

### ORDER BYには注意しよう

先ほどの例はORDER BYを利用していないのでQuery Serviceでデータを溜めることなく、うまくストリームで返すことができますが、ORDER BYを指定すると全てのドキュメントをQuery Serviceで処理してからHTTPレスポンスを返すことになり結果がなかなか返ってきません。

ORDER BY, LIMITはクエリプランの最後に効いてくるので、WHERE句で対象を現実的な件数に絞れるようにするのが良いですね。

## Javaから実行

先ほどの実験で、Query Serviceはクエリ結果をストリームできる場合はちゃんとHTTPのchunkで部分的にデータを返してくれるということがわかりました。

では、Java用のSDKライブラリではどのようにこれを処理しているのでしょう。一つの巨大なJSON文字列をパースしてる最中にOOM発生...なんてことにはならないもんでしょうか?

## 一番やっちゃいけないもの: allRows()

SDKのAPIで一番避けたいのは、`allRows()`を使って全てのJSONドキュメントを一度に参照することですね。結果が数件しかないのがわかっているのなら良いのですが、これをやってしまうと当然全てのドキュメントがメモリ上に展開されてしまうのです。。

{% highlight java %}
Statement query = select(x("*")).from(i("couchmusic1"));
List<N1qlQueryRow> allRows = bucket.query(query).allRows();
System.out.println(allRows);
{% endhighlight %}

## ではrows()なら良いのか

もう一つ、結果のドキュメントを取得するメソッドとして`rows()`があります。
以下のコードでは、N1qlQueryResultのiterator()が実行され、その中でrows()が呼ばれます。
一見、一件ずつ取っている様に見えますが。。

{% highlight java %}
for(N1qlQueryRow row : bucket.query(query)){
  System.out.println(row);
}
{% endhighlight %}

これも、全部のドキュメントが返却されるまでループが始まりません。何故ならN1qlQueryResult自体がブロッキング処理の実装だからです。

N1QLクエリの結果が返ってくるに従い、ストリーム形式で何か処理を行いたい場合にはこれではダメなのです。

ここでRxJavaの登場!

# 非同期APIを利用してストリーム処理しよう

CouchbaseのJava SDKで非同期と言ったら、AsyncBucketの出番ですね。以下の様に実装することで、前述のcURLで確認した様にN1QLクエリの結果が部分的に返却される度に処理を行うことができます。全ての結果を待つ必要なく、処理が終わったらGCでクリアされるので効率的ですね!

{% highlight java %}
// 非同期処理の完了を待つ為のlatch
CountDownLatch latch = new CountDownLatch(1);

// 非同期版APIを使ってストリーム処理!
bucket.async().query(query)
  .flatMap(res -> res.rows())
  .subscribe(
    // 各ドキュメントに対する処理
    row -> System.out.println(row),
    // 例外発生時の処理
    error -> System.out.printStackTrace(),
    // 全て完了した際の処理
    () -> latch.countDown());

// 非同期処理の終了を待つ
try {
  latch.await();
} catch (InterruptedException e) {
  e.printStackTrace();
}

// クラスタとの接続を切る
cluster.disconnect();
{% endhighlight %}

## ライブラリの中ではどうやってJSONを部分的にパースしてるの??

ここで、素朴な疑問が湧いてきます。JSONって部分的にパースできるの?

```
cbq> select name from `travel-sample` limit 2;
```

上記のクエリの様に複数ドキュメントの結果を持つクエリでは、結果のJSON内のresults配列に各ドキュメントが格納されて帰ってきます:

{% highlight json %}
{
    "requestID": "309cac29-169d-42a6-8263-fd11ea365e22",
    "signature": { "name": "json" },
    "results": [
        { "name": "AirTran Airways" },
        { "name": "Astraeus" }
    ],
    "status": "success",
    "metrics": {
        "elapsedTime": "38.412667ms",
        "executionTime": "38.367839ms",
        "resultCount": 2,
        "resultSize": 91
    }
}
{% endhighlight %}

JavaのSDKではどうやって部分的にresults配列内の各要素をパースしているんでしょうか。ちょっとソースコードを見てみました。

この辺りの実装を担当しているのは:

- `N1qlQueryExecutor`: executeQueryメソッドで部分的に受信したHTTPレスポンスを処理する各種Observableを生成し、AsyncN1qlQueryResultを返す。それぞれのObservableでは、GenericQueryResponseを処理する。
- `AsyncN1qlQueryResult`: 各種Observableを格納している単なる入れ物だが、これが結構大事。RxJavaでObservableを複数利用し合成(compose)された非同期処理のロジックが格納されている。
- `QueryHandler`: handleGenericQueryResponseメソッドで、HTTPレスポンスを実際に解析している。最初の数バイトを読んでエラー判定したりしてる。parseQueryResponseメソッドで受信したchunkに応じて対象部分のObservableにByteBuffを渡している。例) parseQueryRowsでは、queryRowObservableへ。
- `GenericQueryResponse`: N1QLクエリ結果の部分的なレスポンスを受信するObservableを持っている。これらのストリームはN1qlQueryExecuter.executeQueryメソッドで記述されている実装で処理されることになる。

GenericQueryResponseを見ると、クエリ実行結果のJSONを部分的に読み取る為のByteBufを持っているのが分かります。
{% highlight java %}
    private final Observable<ByteBuf> errors;
    private final Observable<ByteBuf> rows;
    private final Observable<String> queryStatus;
    private final Observable<ByteBuf> info;
    private final Observable<ByteBuf> signature;
{% endhighlight %}

要はQueryHandlerでHTTPレスポンスのchunkを解析し、意味のある単位でByteBuffに変換してストリームに流してあげているわけですね。

途中でCouchbaseCoreのrequestRingBufferの辺りに行き着きましたが、この辺りはまた別の機会に読んでみたいと思います。今日はお腹いっぱい(笑)


## まとめ

今日は以前から自分の中でもやもやしてたN1QLクエリ結果のストリーミング部分の実装を細かく追ってみました。Couchbase Java SDKの非同期APIを使えば効率的に大量の結果を処理することが分かりましたね。スッキリ!

しかし、RxJavaは難しい! でも慣れてくるとじわじわ良さが分かってきますね。

最後に宣伝...

Couchbase、非同期プログラミング、N1QLが学べる***開発者向けトレーニングコース***、[CD220](https://training.couchbase.com/instructor-led-training/cd220-developing-couchbase-nosql-applications)! 次回の開催は2016年3月頃を予定しています! もっと早く受けたい!という方はご相談ください、特別対応可能です :)
