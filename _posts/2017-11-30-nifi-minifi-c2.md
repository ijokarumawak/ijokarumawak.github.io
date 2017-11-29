---
layout: post
title:  "Apache NiFiのサブプロジェクトMiNiFiのC2を試してみる"
date:   2017-11-30 00:00:00
categories: [NiFi]
---

Apache NiFiのサブプロジェクト、MiNiFiを使うと、小さなフットプリントでデータフローを実行できます。そのMiNiFiのフローをCommand and Controlするサーバプログラムが[Apache NiFi MiNiFi Command and Control (C2) Server](https://github.com/apache/nifi-minifi/tree/master/minifi-c2)です。今回はC2サーバを試してみます。

<ol id="toc">
</ol>

## ビルド

```
# MiNiFiプロジェクトをクローン
git clone git@github.com:apache/nifi-minifi.git

# ビルド
cd nifi-minifi
mvn -T 2.0C -DskipTests clean install

```

## 起動してみる

ビルドが成功したら、[minifi-c2](https://github.com/apache/nifi-minifi/tree/master/minifi-c2)のREADME.mdに記載の通り、出来上がったbin.tar.gzを適当な場所に展開しましょう。と思いましたが、ビルド時に作成され、すでに展開されているディレクトリもあるので、そこで作業してしまいます。

設定ファイルの説明が記載されていますが、とりあえずデフォルトのまま、起動シェルを叩いてみます。

```
cd nifi-minifi/minifi-c2/minifi-c2-assembly/target/minifi-c2-0.2.1-SNAPSHOT-bin/minifi-c2-0.2.1-SNAPSHOT/
./bin/c2.sh

# ちなみに、debugと引数に入れると、5005ポートでremote debugが可能に。
./bin/c2.sh debug
```

以下のログが表示されるので、10080番ポートで起動しているようですね:
```
2017-11-29 22:55:49,821 INFO [main] o.eclipse.jetty.server.AbstractConnector Started ServerConnector@5286c33a{HTTP/1.1,[http/1.1]}{0.0.0.0:10080}
2017-11-29 22:55:49,822 INFO [main] org.eclipse.jetty.server.Server Started @1885ms
```

## APIを叩いてみる

`CacheConfigurationProvider`はfilesディレクトリの中身を参照していて、files内のファイルに対応したURLへとリクエストを投げると、そのファイルの内容が返却されるようです。cURL実行すると、確かに返ってきますね。注READMEに記載のURL例はraspiですが、実際のファイル名はraspi3:

```
curl -i "http://localhost:10080/c2/config?class=raspi3&version=1"

MiNiFi Config Version: 3
Flow Controller:
  name: MiNiFi Flow
  comment: ''
(以下省略)

```

## CacheConfigurationProviderは単にファイルを返してるだけじゃないか

[CacheConfigurationProvider](https://github.com/apache/nifi-minifi/blob/master/minifi-c2/minifi-c2-provider/minifi-c2-provider-cache/src/main/java/org/apache/nifi/minifi/c2/provider/cache/CacheConfigurationProvider.java)のソース見ると、ConfigurationCacheの実装はinjectできるようになってますが、非常に単純ですね。

これだけだとあまりおもしろくないので、他のConfigurationProviderも見てみましょう。

DelegatingConfigurationProviderはとあるC2サーバから更に他のC2サーバへとリクエストを委譲するやつ。

NiFiRestConfigurationProviderが面白そうです。
CacheConfigurationProviderの強化版という感じで、Cacheに該当のConfigが無い場合はNiFiのREST APIを叩いて、templateを探してダウンロードしてCacheに登録してくれる代物!


## その前に、MiNiFiをセットアップ

MiNiFiの[Getting Started](https://nifi.apache.org/minifi/getting-started.html)を参考に、TailFailからS2SでNiFiへデータ転送するMiNiFiフローを作って動作確認。

コマンド備忘録:
```
# TemplateをDLして、config.ymlに変換
~/dev/nifi-minifi/minifi-toolkit/minifi-toolkit-assembly/target/minifi-toolkit-0.2.1-SNAPSHOT-bin/minifi-toolkit-0.2.1-SNAPSHOT/bin/config.sh transform ~/Downloads/minifi-flow-v1.xml conf/config.yml

# Tail対象のファイルに追記してNiFiにデータが転送されたことを確認。
echo hello >> /tmp/input.txt
```

OK, it works!

## NiFiRestConfigurationProviderを試す

```
vi conf/minifi-c2-context.xml
# 下記定義を有効に
<bean class="org.apache.nifi.minifi.c2.provider.nifi.rest.NiFiRestConfigurationProvider">
    <constructor-arg>
        <bean class="org.apache.nifi.minifi.c2.cache.filesystem.FileSystemConfigurationCache">
            <constructor-arg>
                <value>./cache</value>
            </constructor-arg>
            <constructor-arg>
                <value>${class}/${class}</value>
            </constructor-arg>
        </bean>
    </constructor-arg>
    <constructor-arg>
        <value>http://localhost:8080/nifi-api</value>
    </constructor-arg>
    <constructor-arg>
        <value>${class}.v${version}</value>
    </constructor-arg>
</bean>

```

でC2を再起動。

なるほど、versionを指定しなければ最新をとってくれるのか。
TailFileの読み込みファイル名を変更する前後で、`minifi.v1`と`minifi.v2`のtemplateを作成し、C2に問い合わせ。
```
# 変更前、minifi.v1という名前のtemplateをNiFiで作成しておく
curl -i "http://localhost:10080/c2/config?class=minifi" |grep "File to Tail"
# 結果
      File to Tail: /tmp/input.txt


# NiFiでTaiFileの対象を変更して、minifi.v2のtemplateを作成
curl -i "http://localhost:10080/c2/config?class=minifi" |grep "File to Tail"
# 結果
      File to Tail: /tmp/input2.txt
```

## まとめ
コマンド実行のメモ程度の内容ですが、一通り、NiFi、MiNiFi、C2 Serverと連携して動かすことができたので満足!これでMiNiFiのフローをNiFi側で管理できる準備が整いました。次回はMiNiFi側の設定もちゃんとやって自動化するところまでやってみようかと思いまーす。
