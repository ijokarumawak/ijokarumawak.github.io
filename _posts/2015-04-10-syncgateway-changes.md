---
layout: post
title:  "SyncGatewayの_changesでドキュメントの変更通知を受信"
date:   2015-04-10 14:30:00
categories: [Couchbase]
---

SyncGatewayの_changes APIを利用して、変更されたドキュメントを継続的に取得するcURLサンプル。Sync Gatewayのソースコードを読みながら、指定できるオプションなどを紹介します。

用途としては、Couchbase Liteなどから登録されたドキュメントをストリームで受信し、リアルタイムな分析を行うストリーム処理系に渡すなどがあります。

1. <a href="#step-1">REST APIを利用したJSONドキュメントの登録</a>
2. <a href="#step-2">_changes API</a>
3. <a href="#step-3">_changes APIのクエリパラメータ</a>
4. <a href="#step-4">SyncGatewayのGo実装を見てみよう</a>
5. <a href="#step-5">cURLで実行してみよう</a>

<a id="step-1"></a>

# ドキュメントの登録

まずは、ドキュメントの登録方法から見てみましょう。
データベース名のURLに保存するJSONをPOSTするだけです、簡単ですね。

{% highlight bash %}
curl -H "Content-Type: application/json" http://localhost:4984/kitchen-sync/ \
 -d '{"source": "cURL", "val": 1}'

HTTP/1.1 200 OK
Content-Length: 94
Content-Type: application/json
Etag: 1-19ae5baa29d8b81534fb86de3407f482
Location: e13b68fe5f561a78ece06bf7be322c36
Server: Couchbase Sync Gateway/1.00
Date: Fri, 10 Apr 2015 03:44:21 GMT

{"id":"e13b68fe5f561a78ece06bf7be322c36","ok":true,"rev":"1-19ae5baa29d8b81534fb86de3407f482"}

{% endhighlight %}

<a id="step-2"></a>

# _changes API

GET \/{db}\/_changes

このエンドポイントで変更通知を受信することができます。
何もパラメータを指定しないと、データベース開始時点からの変更が全て返却されます。
ただし、同じドキュメントを複数回更新している場合は、最新のリビジョンのみを返します。

{% highlight bash %}
curl -H "Content-Type: application/json" http://localhost:4984/kitchen-sync/_changes
{% endhighlight %}


<a id="step-3"></a>

# クエリパラメータ

_changesにはいくつかのパラメータを指定できます:

- include_docs: デフォルトではドキュメントidとrevのみが返される
- limit: 件数を絞る
- descending: 順序を逆にする、最新のn件を取得したい場合に <-- 使いたかったのだけど...
- ... etc

基本的には[CouchbaseLiteのドキュメント](http://developer.couchbase.com/mobile/develop/references/couchbase-lite/rest-api/database/get-changes/index.html)に記載されているのと同じですが、SyncGatewayでは一部実装されていないものもあるようですね。

<a id="step-4"></a>

# SyncGatewayのGo実装を見てみよう

SyncGatewayで指定可能なパラメータはこちらを参照すると良いでしょう。
[sync_gateway/db/changes.go](https://github.com/couchbase/sync_gateway/blob/master/src/github.com/couchbase/sync_gateway/db/changes.go)


{% highlight go %}
// Options for changes-feeds
type ChangesOptions struct {
	Since       SequenceID // sequence # to start _after_
	Limit       int        // Max number of changes to return, if nonzero
	Conflicts   bool       // Show all conflicting revision IDs, not just winning one?
	IncludeDocs bool       // Include doc body of each change?
	Wait        bool       // Wait for results, instead of immediately returning empty result?
	Continuous  bool       // Run continuously until terminated?
	Terminator  chan bool  // Caller can close this channel to terminate the feed
	HeartbeatMs uint64     // How often to send a heartbeat to the client
	TimeoutMs   uint64     // After this amount of time, close the longpoll connection
}
{% endhighlight %}

Descendingは見当たらないですね。
しかし、SinceとConitnuousを組み合わせると、ある時点から継続的に変更を受信することができます。

ログを見ると、Continuousがtrueになっているリクエストがありました。Couchbase LiteからはWebSocketを利用して継続的に変更を取得しているようです。

{% highlight text %}
13:14:30.598891 HTTP:  #002: GET /kitchen-sync/_changes?feed=websocket
13:14:30.599522 HTTP+: #002:     --> 101 Upgraded to WebSocket protocol  (0.0 ms)
13:14:30.600480 Changes: MultiChangesFeed({*}, {Since:212 Limit:0 Conflicts:true IncludeDocs:false Wait:true Continuous:true Terminator:0xc210054060}) ...
{% endhighlight %}

HTTPリクエストで設定したパラメータを解析して、前述のChangesOptionsを生成しています。
パラメータに何を指定すれば良いのかは、restパッケージのhandleChanges()を見ると分かりそうですね。

[sync_gateway/rest/changes_api.go](https://github.com/couchbase/sync_gateway/blob/master/src/github.com/couchbase/sync_gateway/rest/changes_api.go)


feedの指定は以下の通り:

{% highlight go %}
	switch feed {
	case "normal", "":
		return h.sendSimpleChanges(userChannels, options)
	case "longpoll":
		options.Wait = true
		return h.sendSimpleChanges(userChannels, options)
	case "continuous":
		return h.sendContinuousChangesByHTTP(userChannels, options)
	case "websocket":
		return h.sendContinuousChangesByWebSocket(userChannels, options)
	default:
		return base.HTTPErrorf(http.StatusBadRequest, "Unknown feed type")
	}
{% endhighlight %}

<a id="step-5"></a>

# cURLで実行してみよう

コンソールを二つ立ち上げます。
一つ目のコンソールで変更をリスンしつつ、

{% highlight bash %}
// feedオプションを指定
curl -H "Content-Type: application/json" \
  "http://localhost:4984/kitchen-sync/_changes?feed=continuous&include_docs=true"
{% endhighlight %}


もう一つのコンソールから、複数のドキュメントを登録してみましょう。
{% highlight bash %}
for i in `seq 1 3`;
do
  curl -H "Content-Type: application/json" http://localhost:4984/kitchen-sync/ \
    -d "{\"source\": \"cURL\", \"val\": $i}";
done
{% endhighlight %}

一つ目のコンソールで、変更されたドキュメントが表示されました!
{% highlight json %}
{"seq":236,"id":"695d59cc3bacf246fbf4e945fcb038b6","doc":{"_id":"695d59cc3bacf246fbf4e945fcb038b6","_rev":"1-81243e5196b32067c9605cea71047dee","source]":"cURL","val":1},"changes":[{"rev":"1-81243e5196b32067c9605cea71047dee"}]}
{"seq":237,"id":"b1a9942769ad7da2acbc7dee8fe5dc84","doc":{"_id":"b1a9942769ad7da2acbc7dee8fe5dc84","_rev":"1-f3d312e52dc49359967a4eae6dab7303","source]":"cURL","val":2},"changes":[{"rev":"1-f3d312e52dc49359967a4eae6dab7303"}]}
{"seq":238,"id":"8bfea699dcd19efd246fc3a3f43f30e5","doc":{"_id":"8bfea699dcd19efd246fc3a3f43f30e5","_rev":"1-116e5606156a893fa452537aa007f529","source]":"cURL","val":3},"changes":[{"rev":"1-116e5606156a893fa452537aa007f529"}]}
{% endhighlight %}

