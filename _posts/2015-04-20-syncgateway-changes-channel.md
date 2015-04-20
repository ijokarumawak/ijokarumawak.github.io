---
layout: post
title:  "SyncGatewayの_changesでドキュメントの変更通知を受信 (チャネル編)"
date:   2015-04-20 15:00:00
categories: [Couchbase]
---

[前回](/couchbase/2015/04/10/syncgateway-changes/)はcURLを利用してドキュメントの変更を受信してみました。今回はその続きで、channelを利用してみましょう。

SyncGatewayのチャネル機能を使うと、JSONドキュメントのルーティング管理ができます。特定のユーザ間で共有するドキュメントや、データ種別により後続のシステムへ振り分ける際に利用できます。

1. <a href="#step-1">Sync Function</a>
2. <a href="#step-2">filterとchannel</a>
5. <a href="#step-3">cURLで実行してみよう</a>

<a id="step-1"></a>

## Sync Function

SyncGatewayでは、保存するJSONドキュメント内の任意の項目を、チャネルの値として利用できます。どの項目をチャネルとして利用するのかは、Sync Functionで定義します。

ここでは、デフォルトのSync Functionをそのまま利用し、JSONドキュメント内の"channels"という項目をチャネルとします。

{% highlight javascript %}
function(doc) {channel(doc.channels);}
{% endhighlight %}

<a id="step-2"></a>

## filterとchannels

チャネルを指定して変更を受信するには、changes APIを呼び出す際にfilterとchannelsオプションを指定します。

[SyncGatewayのソース](https://github.com/couchbase/sync_gateway/blob/master/src/github.com/couchbase/sync_gateway/rest/changes_api.go)を見ると、channelsを指定しても、デフォルトではユーザが参照できるすべてのチャネルを対象とするようです。

channelsで指定したチャネルだけの変更を受信するには、filterも指定する必要があります。現在はfilterには"sync_gateway/bychannel"しか指定できないようですね。

cURLでチャネルを指定して変更を受信するには、以下のコマンドを実行します:

{% highlight bash %}
curl -H "Content-Type: application/json" \
  "http://localhost:4984/kitchen-sync/_changes?feed=continuous&include_docs=true&filter=sync_gateway/bychannel&channels=a"
{% endhighlight %}

<a id="step-3"></a>

# cURLで実行してみよう

ターミナルを3つ立ち上げて、それぞれで以下のコマンドを実行してみましょう:

1. チャネルaを受信
2. チャネルbを受信
3. チャネルa, bへルーティングされるドキュメントを保存

ドキュメントの登録には以下のコマンドを利用します、チャネルa, bそれぞれに3件ずつJSONドキュメントを流します:

{% highlight bash %}
for i in `seq 1 3`;
do
  curl -H "Content-Type: application/json" http://localhost:4984/kitchen-sync/ \
    -d "{\"source]\": \"cURL-a\", \"val\": $i, \"channels\": [\"a\"]}";
  curl -H "Content-Type: application/json" http://localhost:4984/kitchen-sync/ \
    -d "{\"source]\": \"cURL-b\", \"val\": $i, \"channels\": [\"b\"]}";
done
{% endhighlight %}

ターミナル1の結果:
{% highlight bash %}
{"seq":287,"id":"b141b01f94ca857082a0d27534e5ffc2","doc":{"_id":"b141b01f94ca857082a0d27534e5ffc2","_rev":"1-a53ea5c366073722f67d71f1a8d292cc","channels":["a"],"source]":"cURL-a","val":1},"changes":[{"rev":"1-a53ea5c366073722f67d71f1a8d292cc"}]}
{"seq":289,"id":"9676535e268a5f1d1dd36d574cef9e45","doc":{"_id":"9676535e268a5f1d1dd36d574cef9e45","_rev":"1-d2f9d1465922efbc067ea946c5edf2c0","channels":["a"],"source]":"cURL-a","val":2},"changes":[{"rev":"1-d2f9d1465922efbc067ea946c5edf2c0"}]}
{"seq":291,"id":"4ecd46daea74ea22cb169113e4f7369f","doc":{"_id":"4ecd46daea74ea22cb169113e4f7369f","_rev":"1-70d5317ad5febccf99f571969a101c95","channels":["a"],"source]":"cURL-a","val":3},"changes":[{"rev":"1-70d5317ad5febccf99f571969a101c95"}]}
{% endhighlight %}

ターミナル2の結果:
{% highlight bash %}
{"seq":288,"id":"e80189b5a84a7756c518a6b6341054de","doc":{"_id":"e80189b5a84a7756c518a6b6341054de","_rev":"1-a4f498196bb77db357fac3797f73746b","channels":["b"],"source]":"cURL-b","val":1},"changes":[{"rev":"1-a4f498196bb77db357fac3797f73746b"}]}
{"seq":290,"id":"c2aa9a3d5bae76485e02c2b01844e81a","doc":{"_id":"c2aa9a3d5bae76485e02c2b01844e81a","_rev":"1-3d21d2d6e904bc062ecbb0d101215f12","channels":["b"],"source]":"cURL-b","val":2},"changes":[{"rev":"1-3d21d2d6e904bc062ecbb0d101215f12"}]}
{"seq":292,"id":"a782931bfa8c36804efbee01040f8623","doc":{"_id":"a782931bfa8c36804efbee01040f8623","_rev":"1-a1cd2e5317283677656c1f704f9467b6","channels":["b"],"source]":"cURL-b","val":3},"changes":[{"rev":"1-a1cd2e5317283677656c1f704f9467b6"}]}
{% endhighlight %}

JSONドキュメント内のchannels要素によって、チャネルが振り分けられましたね!
これを使えばJSONドキュメントの処理対象を絞ったり、changesを利用した後続の処理を分割し、スループットを高めることもできそうですね。
