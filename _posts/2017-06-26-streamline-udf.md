---
layout: post
title:  "StreamlineのUDFが見つからない問題"
date:   2017-06-26 00:00:00
categories: [HDF, Streamline]
---

HDF 3.0にて追加されたSAMですが、何故か私の環境ではAggregate関数がうまく動かず、Stormへとトポロジをサブミットする際にJarが見つからないFileNotFoundExceptionが発生していました。[Streamlineのソースコード](https://github.com/hortonworks/streamline)を追っかけて、やっと原因が分かったのでメモしておきます。

<ol id="toc">
</ol>

## 症状

SAMからAppデプロイ時にエラーが発生、/var/log/streamline/streamline.logには以下のstack trace:

```
ERROR  [04:25:36.890] [ForkJoinPool-4-worker-4] c.h.s.c.u.ParallelStreamUtil -  Got exception while running async task java.lang.RuntimeException: java.io.FileNotFoundException: /hdf/streamline/jars/streamline-functions-f2ff4dc3-0698-4a1c-8ff8-7e150545c9f5.jar (No such file or directory)
        at com.hortonworks.streamline.common.util.ParallelStreamUtil.lambda$runAsync$0(ParallelStreamUtil.java:58)
        at java.util.concurrent.CompletableFuture$AsyncSupply.run(CompletableFuture.java:1590)
        at java.util.concurrent.CompletableFuture$AsyncSupply.exec(CompletableFuture.java:1582)
        at java.util.concurrent.ForkJoinTask.doExec(ForkJoinTask.java:289)
        at java.util.concurrent.ForkJoinPool$WorkQueue.runTask(ForkJoinPool.java:1056)
        at java.util.concurrent.ForkJoinPool.runWorker(ForkJoinPool.java:1692)
        at java.util.concurrent.ForkJoinWorkerThread.run(ForkJoinWorkerThread.java:157)
Caused by: java.io.FileNotFoundException: /hdf/streamline/jars/streamline-functions-f2ff4dc3-0698-4a1c-8ff8-7e150545c9f5.jar (No such file or directory)
        at java.io.FileInputStream.open0(Native Method)
        at java.io.FileInputStream.open(FileInputStream.java:195)
        at java.io.FileInputStream.<init>(FileInputStream.java:138)
        at com.hortonworks.streamline.common.util.LocalFileSystemStorage.downloadFile(LocalFileSystemStorage.java:86)
        at com.hortonworks.streamline.streams.actions.topology.service.TopologyActionsService.downloadAndCopyJars(TopologyActionsService.java:210)
        at com.hortonworks.streamline.streams.actions.topology.service.TopologyActionsService.setUpExtraJars(TopologyActionsService.java:193)
        at com.hortonworks.streamline.streams.actions.topology.state.TopologyStates$4.deploy(TopologyStates.java:95)
        at com.hortonworks.streamline.streams.actions.topology.state.TopologyContext.deploy(TopologyContext.java:87)
        at com.hortonworks.streamline.streams.actions.topology.service.TopologyActionsService.deployTopology(TopologyActionsService.java:116)
        at com.hortonworks.streamline.streams.service.TopologyCatalogResource.lambda$deploy$3(TopologyCatalogResource.java:493)
        at com.hortonworks.streamline.common.util.ParallelStreamUtil.lambda$runAsync$0(ParallelStreamUtil.java:56)
        ... 6 common frames omitted

```

SAMでAGGREGATEを使うと発生する。

## 原因

エラーの通り、必要なjarファイルがなくなっている。
SAMインストール時にバンドルされているUDF(AVGとかMIN, MAXとか)はbootstrap-udf.shからStreamlineのAPIへとPOSTされる。
しかし何らかの操作で/hdf/streamline/jar内のファイルが削除されてしまった模様。

私の場合は、SAMの再インストールを試みたときに、AmbariからSAMのサービスを消した段階で消えてしまったと考えられます。ディレクトリをバックアップとして名称変更したため。

ファイルは無いけど、データベースにはUDFの情報が残ってしまっているのが原因。

MySQL内のSAMのメタデータを覗いてみると、次のようなレコードがありました:

```sql
$ mysql -u streamline -p

mysql> use streamline; 
mysql> select id, name, jarStoragePath from udf;
+----+-------------+---------------------------------------------------------------+
| id | name        | jarStoragePath                                                |
+----+-------------+---------------------------------------------------------------+
|  1 | STDDEV      | streamline-functions-f2ff4dc3-0698-4a1c-8ff8-7e150545c9f5.jar |
|  2 | STDDEVP     | streamline-functions-f2ff4dc3-0698-4a1c-8ff8-7e150545c9f5.jar |
|  3 | VARIANCE    | streamline-functions-f2ff4dc3-0698-4a1c-8ff8-7e150545c9f5.jar |
|  4 | VARIANCEP   | streamline-functions-f2ff4dc3-0698-4a1c-8ff8-7e150545c9f5.jar |
|  5 | MEAN        | streamline-functions-f2ff4dc3-0698-4a1c-8ff8-7e150545c9f5.jar |
|  6 | NUMBERSUM   | streamline-functions-f2ff4dc3-0698-4a1c-8ff8-7e150545c9f5.jar |
|  7 | LONGCOUNT   | streamline-functions-f2ff4dc3-0698-4a1c-8ff8-7e150545c9f5.jar |
|  8 | IDENTITY    | streamline-functions-f2ff4dc3-0698-4a1c-8ff8-7e150545c9f5.jar |
|  9 | MIN         | builtin                                                       |
| 10 | MAX         | builtin                                                       |
| 11 | UPPER       | builtin                                                       |
| 12 | LOWER       | builtin                                                       |
| 13 | INITCAP     | builtin                                                       |
| 14 | SUBSTRING   | builtin                                                       |
| 15 | CHAR_LENGTH | builtin                                                       |
| 16 | CONCAT      | builtin                                                       |
| 17 | ROUND       | streamline-functions-664a23f1-f736-472d-a63d-3b3a52e1ab39.jar |
+----+-------------+---------------------------------------------------------------+
17 rows in set (0.00 sec)
```


## 修復方法

bootstrap-udf.shがこれらのUDFをインストールするので、手動で再実行することにしました。
すでに同名のUDFがあるとAPIがエラーになるので、UDFテーブルをクリアしてから実行:

```
mysql> truncate udf;

# 再作成
cd /usr/hdf/current/streamline
bootstrap/bootstrap-udf.sh http://localhost:7777/api/v1/catalog
```

これで無事にAppがデプロイできるようになりました。

## 今回参照したソースコード

- [bootstrap-udf.sh](https://github.com/hortonworks/streamline/blob/master/bootstrap/bootstrap-udf.sh): ここからStreamlineのAPIを叩いて必要なUDFをインストールしています。API実行方法の良いサンプルにもなりますね。
- [StormTopologyDependenciesHandler.java](https://github.com/hortonworks/streamline/blob/master/streams/actions/src/main/java/com/hortonworks/streamline/streams/actions/topology/service/StormTopologyDependenciesHandler.java): SAMのGUIでデザインしたAppから作成されたトポロジを解析して、依存関係を解決しています。
- [Mean.java](https://github.com/hortonworks/streamline/blob/master/streams/functions/src/main/java/com/hortonworks/streamline/streams/udaf/Mean.java): AVG関数を実装しています。これらのクラスは/usr/hdf/current/streamline/bootstrap/udf-jars/streamline-functions-0.5.0.3.0.0.0-453.jar内にあるのですが、bootstrap-udf.shがREST APIでこのjarをPOSTする際にUUIDが与えられてstreamline-functions-UUID.jarという名前でUDFテーブルに登録されるわけですねー。
- streamline-env.sh: IntelliJからデバッグするために、Ambariの`streamline-env template`に以下の一文を追加しました

    ``` 
    export STREAMLINE_HEAP_OPTS="-Xmx1G -Xms1G -agentlib:jdwp=transport=dt_socket,server=y,suspend=n,address=18000"
    ```
