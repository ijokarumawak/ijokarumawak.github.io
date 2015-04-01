---
layout: post
title:  "cbrestoreで特定のドキュメントだけをリストアする"
date:   2015-04-01 16:00:00
categories: [Couchbase]
---

システムの開発中には、データベースの状態を特定の時点に戻したい場合が良くあります。今回はキーを指定して、Couchbase Serverで特定のドキュメントだけをリストアする方法を紹介します。

- [バックアップ内容の確認](#step1)
- [バックアップファイルの中身をみてみよう](#step2)
- [リストアオプションの解説](#step3)
- [最終的なリストアコマンド](#step4)

<a id="step1"></a>

## バックアップ内容の確認

まずは、リストア対象のドキュメントが期待するものかどうか事前に確認しましょう。誤って他のドキュメントを復元してしまっては大変ですからー。

{% highlight bash %}
# 復元したいドキュメント
df08385b-6b48-48c0-ab38-ae082427b976

# cbbackupで作成したバックアップファイルはこのように取得日時のディレクトリに作成されます:
root@vagrant-ubuntu-trusty-64:/opt/couchbase# ll /vagrant/couchbase-backup
total 0
drwxr-xr-x 1 vagrant vagrant 272 Mar 30 13:22 ./
drwxr-xr-x 1 vagrant vagrant 340 Mar 25 02:46 ../
drwxr-xr-x 1 vagrant vagrant 170 Mar 19 07:25 2015-03-18T061428Z/
drwxr-xr-x 1 vagrant vagrant 102 Mar 25 02:53 2015-03-25T025323Z/
drwxr-xr-x 1 vagrant vagrant 102 Mar 27 06:05 2015-03-27T055823Z/
drwxr-xr-x 1 vagrant vagrant 102 Mar 27 07:23 2015-03-27T071648Z/
drwxr-xr-x 1 vagrant vagrant 102 Mar 30 13:22 2015-03-30T132242Z/
drwxr-xr-x 1 vagrant vagrant 102 Mar 30 13:22 2015-03-30T132247Z/

# 各バックアップ時点のディレクトリには、次のような名前のファイルがあります:
$ cd couchbase-backup/2015-03-30T132247Z/2015-03-30T132247Z-full/bucket-translation/node-192.168.40.10%3A8091
data-0000.cbb

# Couchbase Serverのバックアップファイルはsqliteファイル!
$ file data-0000.cbb
data-0000.cbb: SQLite 3.x database, user version 2015

{% endhighlight %}


<a id="step2"></a>

## バックアップファイルの中身をみてみよう

事前に戻したいドキュメントを確認したいときはsqlite3コマンドで中身を参照できます。
別名のバケットを作ってそこにリストアしてから確認という手もありますね。

{% highlight sqlite3 %}
$ sqlite3 data-0000.cbb
sqlite> .tables
cbb_meta  cbb_msg

cbb_msgのスキーマ
sqlite> .schema cbb_msg
CREATE TABLE cbb_msg
                     (cmd integer,
                      vbucket_id integer,
                      key blob,
                      flg integer,
                      exp integer,
                      cas text,
                      meta blob,
                      val blob,
                      seqno integer,
                      dtype integer,
                      meta_size integer,
                      conf_res integer);

う、keyはblobかー。'='ではなくて'like'で検索すると見つけられました。
sqlite> select * from cbb_msg where key like "df08385b-6b48-48c0-ab38-ae082427b976";
87|91|df08385b-6b48-48c0-ab38-ae082427b976|33554432|0|1427720881431314432|37|{"uri":"/ .... ,"status":"Done"}|38|1|5|0

{% endhighlight %}


<a id="step3"></a>

## リストアオプションの解説

使用するオプションを説明します。

#### -k: キーに対する正規表現を指定

今回は対象が1件だけだったので、完全一致として"^id$"という形にしました。

{% highlight text %}
-k "^df08385b-6b48-48c0-ab38-ae082427b976$"
{% endhighlight %}

#### -n: dry-runで実行すると、パラメータのチェックのみ

実行前に-nつけて確認しておくと安心ですね。

{% highlight text %}
# Errorの場合
error: backup_dir is not a directory: /vagrant/couchbase-backup/a
# Okの場合
done, but no data written due to dry-run
{% endhighlight %}

#### 対象期間の指定

バックアップファイルが複数取得されている場合、日付オプションを指定して対象を絞ることができます。

{% highlight text %}
--from-date=2014-01-20 --to-date=2014-03-31
from > to でないといけません、from == toだと0件。
{% endhighlight %}

#### 対象バケットの指定

- -b: source bucket 指定しない場合はバックアップ内の全バケットが対象
- -B: distination bucket 一緒の場合は省略しても良い

リストア対象を明確にするためにも、指定することをお勧めします。


<a id="step4"></a>

## 最終的なリストアコマンド

最終的なコマンドがこちら:

{% highlight bash %}

$ ./bin/cbrestore -u Administrator -p password \
 --from-date=2015-03-30 --to-date=2015-03-31 \
 -k "^df08385b-6b48-48c0-ab38-ae082427b976$" \
 -b translation -B res /vagrant/couchbase-backup/ http://localhost:8091

2015-04-01 07:10:38,603: w0 skipping msg with key: 48419eed-1b1c-45ef-9ae5-6e3e17a21ec3
 ...
2015-04-01 07:10:38,687: w0 skipping msg with key: 13293288-b68a-4580-bdf0-35d2c11b73dc
  [                    ] 0.3% (1/estimated 363 msgs)
bucket: translation, msgs transferred...
       :                total |       last |    per sec
 byte  :                 7030 |       7030 |    40190.9
done

{% endhighlight %}

"skipping msg with key:"で対象外のドキュメントがスキップされているのがわかります。
"(1/estimated 363 msgs)"で、1件だけリストアされていますね!
