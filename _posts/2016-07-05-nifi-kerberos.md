---
layout: post
title:  "NiFiでKerberizeされたKafka、HDFSに接続する"
date:   2016-07-05 23:00:00
categories: [NiFi]
---

KerberizeされたKafkaにNiFiからアクセスするのに苦労している時、同僚が「KafkaをKerberizeすると非常にセキュア、セキュリティ頑丈過ぎて自分でも入れないw」なんてジョークを飛ばしてました。
それぐらい難しいんだなー、と少し安心しつつ、やっぱり結構苦労しました。久々にまとまった量の情報になったので残しておきます。

If you're looking for English, it's available [here](https://community.hortonworks.com/articles/43446/how-to-connect-nifi-with-kerberized-hdp-kafka-and.html).

NiFiからKafkaやHDFSに接続する記事は色々あるのですが、Kerberosが絡むと、Zookeeper、Kafka、HDFS、Ambari、Ranger、NiFiと色々設定が広範囲に渡り、ちらばったドキュメントを参照しないといけないので、まず全体像を把握するのがとても難しかったです。

以下の手順はHDP SandboxをKerberizeしてNiFiから接続するラフな手順をまとめたもので、不必要なものも、不足もあるかもしれませんが、全体的にはこんな感じの手順になります:

- HDPのSandboxに最新のHDFをダウンロードしてインストール
- Kafkaデフォルトでは起動していないので、Ambariから起動、メンテナンスモード解除
- 影響のあるサービスをリスタートする
- MIT KDCをインストールして設定する [参考](http://docs.hortonworks.com/HDPDocuments/HDP2/HDP-2.4.2/bk_Security_Guide/content/_optional_install_a_new_mit_kdc.html)
- AmbariからKerberosを有効にする
- AmbariのKerberosウィザードにしたがって進める
- Check Pigのテストが失敗するが、Completeボタンで前に進む
- いくつかのサービスが起動してない状態になったので、Ambariから起動
- Kerberos関連のKafka設定を行う [参考](http://docs.hortonworks.com/HDPDocuments/HDP2/HDP-2.4.2/bk_secure-kafka-ambari/content/ch_secure-kafka-overview.html)
- Kafka listenersの設定を`PLAINTEXT://localhost:6667`から`PLAINTEXTSASL://localhost:6667`にAmbariから変更
- AmbariのRanger設定から`Kafka ranger plugin`, Kafkaの設定から`Enable Ranger for KAFKA`をそれぞれ有効にする [参考](http://docs.hortonworks.com/HDPDocuments/HDP2/HDP-2.4.2/bk_Security_Guide/content/kafka_plugin.html)
- RangerでKafkaのACLを設定する [参考](https://docs.hortonworks.com/HDPDocuments/HDP2/HDP-2.3.0/bk_Ranger_User_Guide/content/kafka_service.html)
- 後から別ユーザで接続しようと思っても、すでに他のKerberosユーザでConsumer Group接続している場合は、同一のGroup idで他のKerberosユーザからは接続できないので注意
- KerberizedされたKafkaにNiFiが接続できるようにNiFiを設定 [参考](https://community.hortonworks.com/articles/28180/how-to-configure-hdf-12-to-send-to-and-get-data-fr.html?platform=hootsuite) サンプルコード貼り付けるときにダブルクォーテーションに注意
- `/etc/krb5.conf`をnifi.propertiesのnifi.kerberos.krb5.fileに設定
- HDFSのアクセス制御はRangerのみで管理することが推奨されている [参考](http://hortonworks.com/blog/best-practices-in-hdfs-authorization-with-apache-ranger/)
- PutKafka, GetKafka, PutHDFSなどを使ってNiFiのフローを作成する

[Gist](https://gist.github.com/ijokarumawak/efd46abec052aa49e54ea53c1a0806f4)にはサンプルのNiFi templateとかも置いてあります。何かのお役に立てばこれ幸い。

