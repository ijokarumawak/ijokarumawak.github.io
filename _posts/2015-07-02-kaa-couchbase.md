---
layout: post
title:  "Couchbase Connect 15: IoTデータにCouchbase Server, Couchbase Mobile, Kaaを使ってアクセスする"
date:   2015-07-02 17:00:00
categories: [Couchbase]
---

すでに開催から1ヶ月ほど経ちましたが、6月に開催されたCouchbase Connect 15のセッションビデオやスライドが公開されているので、面白いものを紹介していきたいと思います。 今日は[CyberVision, Inc.](http://www.cybervisiontech.com)のCTO、Andrewさんによる[「Accessing IoT Data with Couchbase Server, Couchbase Mobile and Kaa」](http://connect15.couchbase.com/agenda/accessing-iot-data-couchbase-server-couchbase-mobile-kaa/)を紹介します。


冒頭ではIoTについて:

- 低価格でパワフルなデバイスが利用可能になった。
- IoT関連の新規プロジェクトは毎日のように出現する非常に競争が激しい分野。
- 製品は明確なコンセプトを打ち出していかいないといけない。

とおっしゃってました。

[KAA](http://www.kaaproject.org/)(カー)はオープンソースのIoTプラットフォーム:

- 10Kb RAM フットプリント (C SDK)
- データデリバリーを保証
- 水平分散、フォールトトレラント

などの特徴があります。
KAAプロジェクト自体、CyberVisionが主に開発しているようです。

<img src="/assets/images/kaa-overview.png">

## デモシステム

<img src="/assets/images/kaa-couchbase-integration.png">

このセッションで紹介しているIoTシステムの構成:

- KAAはデバイスと直接やり取りする
- Couchbase Liteはダッシュボードのモバイルアプリケーション用に使っている
- KAAのプラグインでCouchbaseのコネクタがあるとのこと

[KAAのソースコード](https://github.com/kaaproject/kaa)はGithubで公開されていますね。
Couchbase Serverへの接続部分の実装は[LogEventCouchbaseDao](https://github.com/kaaproject/kaa/blob/master/server/appenders/couchbase/appender/src/main/java/org/kaaproject/kaa/server/appenders/couchbase/appender/LogEventCouchbaseDao.java)にありました。

連携用データのスキーマ定義に、KAAの内部ではAVROを使っているようです。


<img src="/assets/images/kaa-couchbase-demo.png">

- ソーラーパネルがどのように動作しているか、エネルギーをどの程度生成しているか
- 複数のゾーンにソーラーパネルを配置
- IntelのEdisonを利用
- 右側のは6つのゾーンの状態を表示しているAndroidアプリ

テレマトリーデータのスキーマも紹介されていました、一つのJSON内に以下の情報を保持しています:

- VoltageReport, timestamp, samples
  - samples配列内: VoltageSample, zoneId, panelId, voltage

ゾーン毎のセンサーデータ集計をCouchbase ServerのViewで行っています。

{% highlight bash %}
// timestamp, ゾーンIDをキーに、voltageをバリューに出力
emit([ts, doc.event.samples[i].zoneId], doc.event.samples[i].voltage);
{% endhighlight %}

Reduceは_statsを利用して集計。
Viewの結果を別のJSONドキュメントとしてCouchbase Serverに保存して、SyncGateway経由でタブレットのCouchbase Liteに同期し、モバイルアプリで表示しています。

デモビデオでは、ソーラーパネルを手で隠すとリアルタイムにダッシュボードに反映される様子が紹介されています。
レスポンス良いですね!ビデオで是非ご覧ください :)

データ転送の実装はたったの二日で完了したとのこと、素晴らしい!

以上、オープンソースのIoTプロジェクトKAAとCouchbase Server、Couchbase Mobileを組み合わせたシステムの紹介でした。
次回をお楽しみに!

