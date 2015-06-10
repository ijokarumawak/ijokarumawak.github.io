---
layout: post
title:  "Couchbase Serverの統計情報をJSONで保存しTableauで分析する"
date:   2015-06-11 12:00:00
categories: [Couchbase]
---

今日は引き続きcbstatsについて紹介します。[前回の記事](/couchbase/2015/06/10/cbstats-csv/)では、cbstatsの出力をCSV形式で保存する例を紹介しましたが、今回は3.0.1から利用可能になった'-j'オプションを利用してJSON形式で出力し、それをCouchbase Serverに保存してN1QLを使ってTableauに渡して分析するということをやってみました。

## いつのまにか -j オプション増えとるやんけ!?

cbstatsの結果はテキスト形式で出力され、モニタリングではawkやgrepコマンドで整形して利用していましたが、いつの間にか -j という結果をJSONで出力する素晴らしいオプションが増えていました。

この[コミット](https://github.com/membase/ep-engine/commit/0b7c515c3d30e6e089e9ccb4db06a8147ee03c51)で追加されたようです。
[関連チケット](https://issues.couchbase.com/browse/MB-11454)を見ると3.0.1から追加されていたのですね。
これは非常に便利だ!



## Node.js使ってJSONにしてCouchbaseに保存

cbstatsを5秒間隔で実行し、結果のJSONをCouchbase Serverのcbstatsというバケットに保存するNode.jsスクリプト、[collect-cbstats-json.js](https://github.com/ijokarumawak/cb-server-tools/blob/master/bin/collect-cbstats-json.js)を作成しました。
利用するには、まずbinディレクトリで:

{% highlight bash %}
$ npm install
{% endhighlight %}

を実行し、依存ライブラリをインストールします。
その後、以下のように、cbstatsを取得するホスト名と、バケット名を指定して実行します:

{% highlight bash %}
$ node ./collect-cbstats-json.js hostname bucketname
{% endhighlight %}


## Tableauで見る

Couchbase Server 4.0の目玉機能であるN1QLを利用し、Tableauなどのツールから利用するには、ODBCドライバのインストールが必要です。
Couchbase Server用ODBCドライバのインストール方法については、また別の機会に紹介したいと思います。

Tableauのサイトから14日間使えるFree Trial版をダウンロードしていざ接続!と意気込んだまではよかったのですが、[ここ](http://kb.tableau.com/articles/knowledgebase/customizing-odbc-connections)に描いてあるODBCのデータソースが見つかりません。

もしかしてWindowsしかダメなの? と思い探すと、[そうみたい](http://kb.tableau.com/articles/issue/generic-odbc-data-connection-unavailable-on-the-mac)。。

Macの場合は、WindowsでTableau Desktopを開くか、データをExtractしてそれを読み込むかという回避策が記載されていました。

仕方がないので、一旦Excelを経由することにしました。

## ExcelからODBC経由でCouchbase Serverに保存した統計情報を取得

N1QLで検索するには、まずプライマリインデックスを作成する必要があります。N1QLのインデックスにはおなじみのView(MapReduce)を利用するものと、GSI(Global Secondary Index)を使うものがあります。

{% highlight javascript %}
cbq> create primary index on cbstats;
{
    "requestID": "c94f57b2-e14a-458b-979a-49293c7b9a4f",
    "signature": null,
    "results": [
    ],
    "status": "success",
    "metrics": {
        "elapsedTime": "272.801944ms",
        "executionTime": "272.725203ms",
        "resultCount": 0,
        "resultSize": 0
    }
}
{% endhighlight %}

4.0ベータでは、特に指定しない場合Viewのインデックスとなりますが、内部でstale=okを利用しているようで、JSONドキュメントを追加してもN1QLの検索でヒットしないことがあります。そのような場合は一度該当Viewをstale=falseでクエリすると更新されます。
GSIを明示的に使ったほうがストレスを感じずに済むのでオススメです。

またまた、問題が。ExcelのODBCからselect * from cbstats;をすると何もデータは帰ってきません。4.0ベータのcbstats JSON内には299の項目があり、どうやらExcelのODBCは255列までの上限がある模様です。

240項目程度に抑えたら取得できました。

以下のクエリでは、項目数をさらに抑えていますが、このようにSQLでCouchbase Serverにアクセスすることができてしまいます!

{% highlight sql %}
select time,accepting_conns,auth_cmds,auth_errors,bucket_active_conns,bucket_conns,bytes,bytes_read,bytes_written,cas_badval,cas_hits,cas_misses,cmd_flush,cmd_get,cmd_set,cmd_total_gets from cbstats order by time;
{% endhighlight %}

<img src="/assets/images/excel-odbc-data-source.png">

## Tablaueと連携

Mac版のTablaueではODBCドライバが利用できないので、今回はExcelのファイルを経由しました。Couchbase ServerとTablaueが直接連携している感は全くないですが、Windowsユーザの方は問題ないはず!

ColumnsにはTimeを利用しましょう。cbstatsのtimeはUnix Epoch形式なので、以下の様にDATE関数で変換し、さらにDATEADD関数で日本のタイムゾーンに合わせると良いでしょう:

{% highlight bash %}
# Japan Time Zone UTC+9:00
DATEADD('hour',9,(DATE("1/1/1970") + ([Time]/86400)))
{% endhighlight %}

複数の項目を一つのグラフに描画する場合は、Measure Valuesを使ってまとめるとよい感じです。

<img src="/assets/images/cbstats-tableau.png">

## まとめ

N1QLの登場でExcelやTableauといったツールとの連携が可能になりました。スキーマレスのJSONドキュメント指向NoSQLデータベースのCouchbase Serverにデータをどしどし保存して、ビジネスに活用しましょう!

今回の企画は、「cbstatsの結果をとにかく溜めておいて後で分析したらどうだろう」ということでやってみましたが、cbstatsの全ての項目を保持しておくというのは現実的ではないかもしれません。
統計情報ではなく、単に設定値の項目も多いです。

運用中のモニタリングにはREST APIを利用して取得する方が良いように思います。より実践的なモニタリングについては、[こちらの記事](/couchbase/2015/04/03/monitoring-couchbase-cluster/)もご参照ください。

それでも問題解決時や性能検証など、細かいところを調査する場合は非常に役に立つ情報が満載です。

以下にcbstatsの各項目についての情報が記載されているリンクをまとめておきます:

- [ep-engineの統計情報の各項目詳細](https://github.com/membase/ep-engine/blob/3.0.3/docs/stats.org)
- cmd_total_getsなどの[memcached系統計情報実装](https://github.com/couchbase/memcached/blob/3.0/daemon/memcached.c)
- [memcached系統計情報の各項目詳細](http://www.pal-blog.de/entwicklung/perl/memcached-statistics-stats-command.html) 

