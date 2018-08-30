---
layout: nifi-tutorial
title: NiFiチュートリアルの環境
permalink: /tutorials/nifi/env
---

チュートリアルのテキストでは、サーバのホスト名を'nifi-tutorial'として記載します。お使いのPCの/etc/hostsファイルに次のエントリを追加しておくと良いでしょう:

```
# サーバのIPアドレス
xx.xx.xx.xx nifi-tutorial
```

以下のアプリケーションがDockerコンテナで起動しています:

- [NiFi](https://hub.docker.com/r/apache/nifi/)
    - <a href="http://nifi-tutorial:8080/nifi" target="_blank">Web UI</a>へ
    - 8080の他、8081 - 8085ポートが接続可能になっています。ListenHTTPなどで利用できます。
    - データフロー オーケストレーション。他のコンテナはNiFiの動作に必要なわけではなく、チュートリアルで作成するデータフローからアクセスするデータソース先として利用します。
- [NiFi Registry](https://hub.docker.com/r/apache/nifi-registry/)
    - <a href="http://nifi-tutorial:18080/nifi-registry" target="_blank">Web UI</a>
    - NiFiのフローをバージョン管理
- [MySQL](https://hub.docker.com/r/mysql/mysql-server/)
    - port=3306
    - users: root:Password!123, nifi:Password!123
    - databases: nifi
    - RDBMS。
- [Zookeeper](https://hub.docker.com/r/wurstmeister/zookeeper/):
    - client port=2181
    - Kafkaで利用します。
- [Kafka](https://hub.docker.com/r/wurstmeister/kafka/):
    - ver 1.1.0
    - port=9091
    - topic auto-creation enabled.


## 環境作成方法
ハンズオンイベントではこちらでサーバを用意します。後日、ご自身でチュートリアルの環境を構築したい場合はこちらのAWS Fargate用タスク定義、[ecs-task-definition.json](ecs-task-definition.json)を利用してください。同様の構成はDocker composeでも構築可能です。