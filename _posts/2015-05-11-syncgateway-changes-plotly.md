---
layout: post
title:  "Plot.lyのstreaming APIでSyncGatewayの_changesをリアルタイムでグラフに描画する"
date:   2015-05-11 22:00:00
categories: [Couchbase]
---

GW開け、久々の投稿です。今回は簡単な実装でリアルタイムにストリームデータをグラフ描画できる[Plot.ly](https://plot.ly/)を使って、SyncGatewayの_changes APIで受信したドキュメントの変更をグラフ化してみました。デモビデオもあります!

以前から、SyncGatewayの_changes APIについては、[_changesでドキュメントの変更通知を受信](/couchbase/2015/04/10/syncgateway-changes/)や、[_changesでのチャネル指定](/couchbase/2015/04/21/syncgateway-changes-channel/)でも紹介してきましたが、これを使ってリアルタイムにグラフ描画をやってみたかったのです。

手軽にデータを可視化するツールを探していてPlot.lyを見つけました。ストリーミングAPIも備えているので、まさに本企画に持ってこいです :)

今回のデモではiPhoneのエミュレータを使っていますが、Raspberry PieやArduinoなどでCouchbase Liteを稼働させれば、デバイスで取得したセンサーデータをCouchbase Serverに溜め込みつつ、リアルタイムにグラフを表示するなどに使えますね。

Plot.lyでも直接これらのデバイスからデータを送信するためのライブラリが用意されていますが、Couchbaseを利用することで、デバイスからのデータ同期を簡単に行い、かつネットワークに接続できない場合でもローカルデータベースに保存し、非同期に同期を行うことが可能になります。
また、Couchbase ServerのSQL for Document(N1QL)やViewを利用したデータ分析や、Hadoopをベースとしたより大規模な分析にもつなげられるでしょう。

# Table of Contents

1. <a href="#architecture">システム構成</a>
2. <a href="#demo">デモビデオ</a>
3. <a href="#async-realtime">非同期のデータをリアルタイム表示するのは難しい</a>

コード解説

1. <a href="#dependencies">利用ライブラリ</a>
2. <a href="#graph-options">グラフオプション</a>
3. <a href="#create-stream-graph">ストリーム用のグラフを作成</a>
4. <a href="#changes-api">SyncGatewayの_changesを定期的に実行</a>
5. <a href="#streaming-plotly">Plot.lyにデータをストリーミング</a>

<a id="architecture"></a>

# システム構成

システム構成は以下の図の通りです。
Node.jsで稼働させるsync-streaming.jsを今回コーディングしました。

<img src="/assets/images/syncgateway-changes-plotly.png" width="671">

<a id="demo"></a>

# デモビデオ

さて、まずは動作している様子をビデオでお楽しみください!
ものぐさなので、アプリケーションはKitchen Syncをそのまま利用しています。
レコード作成時間をX軸、入力したテキストの文字数をY軸にプロットしました。

<iframe width="640" height="390" src="https://www.youtube.com/embed/wZpWTxMznTI" frameborder="0" allowfullscreen></iframe>

<br>
<br>

<a id="async-realtime"></a>

# 非同期のデータをリアルタイム表示するのは難しい

「なんかグラフの更新が滑らかではなくカクカクしていないか?」

と感じた方もいらっしゃるでしょう。これはデータサンプリング数が不足しているためです。

Kitchen Syncでデータを更新した場合のみ_changes APIからデータが返されます。一方、定期的にグラフを進めるためには、データ変更が発生しない場合にもPlot.lyにデータを送信する必要があります。

ここで、Kitchen Syncでレコードを作成した際の時刻と、Node.jsアプリ側でデータ変更を受信できなかった場合のデータの時刻が問題になってきます。

グラフを滑らかに表示しようとしてY=0の点をNode.js側で頻繁に作成してしまうと、以下の図のように、非同期でKitchen Syncから送信される点の時刻を追い越してしまうことがあるのです。

<img src="/assets/images/plotly-graph-timestamp-missmatch.png" width="400px">

このため、今回のコードでは、「n回連続でデータ変更がなかった場合に現在時刻より少し前にY=0の点を作成する」ということをやっています。

が、実際はサーバ側で0埋めするのではなく、データを生成する側のアプリケーションで、値0の状態を記録しておくのがベストでしょう。

---

# コード解説

それでは今回記述したプログラムのポイントを紹介したいと思います。
sync-streaming.jsのコード全体は[Gist](https://gist.github.com/ijokarumawak/c2d7d47da0d8bf6812dd)をご覧ください。

<a id="dependencies"></a>

## ライブラリ

利用するライブラリをnpmでインストールします。

{% highlight bash %}
# Plot.lyのNode.js用ライブラリ、他にもPython用など色々。
$ npm install plotly

# SyncGatewayへHTTPリクエストを送信するのに利用。
$ npm install request

# 日付フォーマットの変換をお手軽に。
$ npm install moment
{% endhighlight %}

<a id="graph-options"></a>

## グラフオプション

グラフのレイアウトやX, Y軸の設定は[こちら](https://plot.ly/nodejs/figure-labels/)を参考に行いました。リアルタイムのグラフでは、X軸をdateにすると良い感じですが、Plot.lyのdate型は[**YYYY-MM-DD hh:mm:ss.sss**のフォーマットしか受け付けない](https://plot.ly/nodejs/figure-labels/)ため注意が必要です。今回はMoment.jsを使ってフォーマット変換をしています。

Plot.lyでは作成したグラフはワークスペース内に保存されます。fileoptで上書きするのか、更新するのかを指定します。

{% highlight javascript %}
var graphOptions = {
  // fileopt : "extend",
  fileopt : "overwrite",
  filename : "sync-stream-test",
  layout: {
    title: "Changes stream",
    xaxis: {
      type: "date",
      autorange: true
    },
    yaxis: {
      type: "linear",
      range: [0, 50],
      autorange: true
    }
  }
};
{% endhighlight %}

<a id="create-stream-graph"></a>

## ストリーム用のグラフを作成

グラフ作成時の初期データとして、streamを指定するのがポイントですね。
[Plot.lyの設定ページ](https://plot.ly/settings)に行くと、streaming用のtokenが確認できます。API呼び出し用のトークンとは別物なので注意してください。

maxpointsで一度に表示可能なサンプル点の数を指定します。この数以上になると古い点が捨てられていきます。

実際の点はSyncGatewayから取得したデータを利用するので、初期データとしては空の配列を渡しておきましょう。

Plot.lyのライブラリを呼び出し、グラフを作成します。成功すると、ブラウザからグラフが閲覧できるようになります。ログにもURLを出力していますが、作成したグラフはワークスペースに保存されるので、Plot.lyのサイトから確認することもできます。

{% highlight javascript %}
var streamToken = 'your-stream-token';
var init_data = [{
    x : [], y : [],
    stream : {
        token : streamToken,
        maxpoints : 20
    }
}];

plotly.plot(init_data, graphOptions, function (err, msg) {
  // (中略)
});
{% endhighlight %}

<a id="changes-api"></a>

## SyncGatewayの_changesを定期的に実行

setIntervalを利用して定期的にSyncGatewayへ問い合わせます。
返されるデータのlast_seqを次回問い合わせ時のsinceに指定して、前回からの差分のみ取得しているところがポイントです。

今回はそこまでやっていませんが、取得が完了したlast_seqはファイルかデータベースに保存しておき、本プロセスが終了した後に再開する際に利用すると良いでしょう。sinceを指定しない場合、頭から_changesを読むことになってしまいます。

{% highlight javascript %}
var loop = setInterval(function () {
  var option = {
    url: 'http://localhost:4984/kitchen-sync/_changes',
    json: true,
    body: {
      include_docs: true,
      since: since,
      limit: limit
    }
  };
  console.log('Fetching changes...');
  request.post(option, function(err, httpResponse, body){
    // (中略: 取得データをPlot.lyにストリーミング、詳細は後述)
    since = body.last_seq;
  });
}, fetchFreqInMillis);
{% endhighlight %}

<a id="streaming-plotly"></a>

## Plot.lyにデータをストリーミング

一度の_changes APIの結果で、複数の(limitで指定した件数の)ドキュメント変更が返されます。これらをループして、Plot.lyに送信します。末尾には**\n**が必要です。

{% highlight javascript %}
for(var i = 0; i < body.results.length; i++){
  var r = body.results[i];
  var streamObject = {
    x: moment(r.doc.created_at).format(dateFormat),
    y: r.doc.text.length
  };
  stream.write(JSON.stringify(streamObject)+'\n');
}
{% endhighlight %}

いかがでしたでしょうか? 何がすごいって、Plot.lyがすごいですね!自分でD3とかを使ってグラフ描画の実装を始めなくても簡単にグラフが描画できます。非常にお手軽です!
