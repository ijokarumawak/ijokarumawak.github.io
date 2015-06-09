---
layout: post
title:  "ソースコードリーディング: menelaus_web.erl"
date:   2015-06-09 23:00:00
categories: [Couchbase]
---

Couchbase Serverはオープンソースです。Enterprise Editionであっても、そのソースコードはGithub上に公開されています。
今日は「ソースコードリーディング」と題して、Couchbase Serverの中でも重要なプロジェクトns_serverのmenelaus_web.erlを紹介します。

## ソースコードの在り処

[ns_server](https://github.com/couchbase/ns_server)は他のプロジェクトと同様、GithubのCouchbaseアカウントで公開されています。ns_serverはCouchbase Serverクラスタにおいて、クラスタ管理の機能を司るプロジェクトです。

当プロジェクトのソースコードは50%以上がErlangで記述されています。かなり癖のある言語だと思いますが、幾つかの基本を押さえていれば割とスムーズにコードは読めるようになるでしょう。

どうして今回、ns_serverについてブログを書こうと思ったかというと、Couchbase Serverのログや統計情報のモニタリングを行うときに、以前から管理コンソールや管理用REST APIの詳細な実装が見てみたいと思っていたからです。

## 管理用REST APIの実装

それでは、早速管理用REST APIの実装を見ていきましょう。
管理用REST APIの実装のメインは[**menelaus_web.erl**](https://github.com/couchbase/ns_server/blob/master/src/menelaus_web.erl)です。

Erlangは関数型言語です。そしてこのソースの中で、最も重要な関数は**loop_inner/4**でしょう。
Erlangでは、関数を特定する際に、*関数名/引数の数*という表現を使います。

loop_innerの中では、以下のようなコードが沢山あります:

{% highlight erlang %}
["pools", "default"] ->
    {auth_any_bucket, fun check_and_handle_pool_info/2, ["default"]};
{% endhighlight %}

これは、管理用REST APIのURLと紐付いていて、上記のコードは*http://host:8091/pools/default*にアクセスすると、check_and_handle_pool_infoという関数の、引数が二つのものを実行するという定義です。

*auth*や、*auth_ro*、*auth_any_bucket*、などのキーワードは、そのRESTエンドポイントを実行する際に必要なアクセス権限です。cURLコマンドを実行する際に:

{% highlight bash %}
curl -u admin:password http://host:8091/pools/default
{% endhighlight %}

のようにユーザIDとパスワードを指定しますが、Couchbase Serverでは参照専用のユーザと、管理者用ユーザの二つがあります。接続するユーザの権限に応じて、実行可能なRESTエンドポイントが異なることが分かります。

## エンドポイントで利用可能な引数を見てみる: /logs

管理用REST APIについては、豊富なドキュメントも用意されていますが、ドキュメントに記載されていない便利なエンドポイントや引数も存在します。

ここでは、Web管理コンソールのLogタブに表示されるイベントを取得できる/logsについて見てみましょう。ちなみにWeb管理コンソールでは管理用REST APIを実行して表示する情報を取得しているので、ChromeのDevToolsのNetworkタブを見ると、どのエンドポイントにアクセスしているかが分かります。

Logタブでは*http://host:8091/logs?_=1433857782357*の様に、epochのタイムスタンプを指定して最新のlogイベントを取得しているようです。

該当のErlang実装を見てみると、以下のようになっています:

{% highlight erlang %}
["logs"] ->
  {auth_ro, fun menelaus_alert:handle_logs/1};
{% endhighlight %}

これはmenelaus_alertというモジュールのhandle_logs関数の引数が一つのものをマッピングしています。
menelaus_alart.erlのソースの中には、確かにhandle_logsという関数が実装されていますね。

{% highlight erlang %}
handle_logs(Req) ->
  reply_json(Req, {struct, [{list, build_logs(Req:parse_qs())}]}).
{% endhighlight %}

どうやらparse_qsを実行してリクエストパラメータを解析しているようです。そして解析したパラメータをbuild_logsという関数に渡しています。

{% highlight erlang %}
build_logs(Params) ->
  {MinTStamp, Limit} = common_params(Params),
  build_log_structs(ns_log:recent(), MinTStamp, Limit).
{% endhighlight %}

build_logsでは、さらにcommon_params関数を呼び出し、その結果をMinTStampとLimitという変数に代入しています。Erlangでは変数名を大文字で始めるのがルールです。小文字で始まるものはAtomというEnumのようなオブジェクトになります。

{% highlight erlang %}
common_params(Params) ->
  MinTStamp = case proplists:get_value("sinceTime", Params) of
                   undefined -> 0;
                   V -> list_to_integer(V)
               end,
  Limit = case proplists:get_value("limit", Params) of
              undefined -> ?DEFAULT_LIMIT;
              L -> list_to_integer(L)
          end,
  {MinTStamp, Limit}.
{% endhighlight %}

さらにcommon_params関数の内部を覗いてみると、sinceTimeとlimitというパラメータを読み取っているのが分かります。case分では、それぞれのパラメータが指定されている場合にはlist_to_integerで整数に変換し、指定されていない場合(undefined)は初期値を利用するようになっています。

*?DEFAULT_LIMIT*というのはマクロで、同ソース内に:

{% highlight erlang %}
-define(DEFAULT_LIMIT, 250).
{% endhighlight %}

として定義されています。limitを指定しない場合はlogイベントの250件を返すということですね。


## 管理用REST APIの結果はjqコマンドにつなげると便利!

さて、今回はREST APIの実装を少し見てみましたが、実際に商用環境などでこの結果をモニタリングツールなどと連携する場合、レスポンスのJSON内の特定の値を取得したいと思われるでしょう。そんなときに便利なのが[jq](http://stedolan.github.io/jq/)コマンドです。

Linuxのパッケージリポジトリにも登録されているのでapt-get install jqやyumで簡単にインストールできます。

前述の/logsエンドポイントで返却されるJSONには、logレベルとしてinfo、warning、errorといった値があります。jqコマンドを組み合わせると「info以外のlogイベントを取得する」といったことが可能です。

以下にcURLコマンドとjqコマンドを組み合わせたCouchbase Serverのlogイベントを取得するコマンドを示します:

{% highlight bash %}
curl -u admin:password http://host:8091/logs |jq '.list[] | select(.type!="info")'
{% endhighlight %}

上記を実行すると、info以外のlogイベントが存在する場合、以下のような結果を取得できます:

{% highlight json %}
{
"node": "ns_1@172.17.0.6",
"type": "warning",
"code": 5,
"module": "ns_node_disco",
"tstamp": 1433837537492,
"shortText": "node down",
"text": "Node 'ns_1@172.17.0.6' saw that node 'ns_1@172.17.0.8' went down. Details: [{nodedown_reason,\n connection_closed}]",
"serverTime": "2015-06-09T08:12:17.492Z"
}
{% endhighlight %}

## Couchbase Serverのlog監視の道のりは続く

先に説明した/logsのエンドポイントから、モニタリングで必要なlogイベントの全てが取得できれば良いのですが、実際はそう簡単なものでもありません。

/logsエンドポイントで取得できるのはns_logのエントリだけで、**XDCR関連のエラーなどはここには出力されません**。

残念ながら現在は一つの機能だけで全てのlogイベントを取得できるわけではなく、複数の監視方法を組み合わせるのが現実的です。モニタリング対象となる数あるイベントの中の数種類を、/logsのエンドポイントから取得できるということが、Couchbase Server管理者の皆様にとって少しでもお役にたてば嬉しく思います。

Couchbase Serverの挙動に問題がある場合、ログだけでなく、cbstatsで取得できる様々な統計情報にその影響が現れます。
Couchbase Serverではログ監視だけではなく、これらの統計情報もモニタリングすることが非常に重要です。

どの様な統計情報をモニタリングすべきかは、[訳: Couchbaseクラスタのモニタリング](/couchbase/2015/04/03/monitoring-couchbase-cluster/)もご参照ください。

P.S
もっとスムーズにコードが読めるようになりたいもんですw
