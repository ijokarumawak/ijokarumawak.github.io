---
layout: page
title: NiFi Tutorials
permalink: /tutorials/nifi/
---

1. [実行環境](env)
1. [Hello Wold](hello-world): 一番シンプルなデータフローを作ってみよう
1. NiFiのデータフローを共有するには?
    - TemplateはXMLファイルでexport/importできる [doc](https://nifi.apache.org/docs/nifi-docs/html/user-guide.html#Import_Template)
    - [NiFi Registryでフローのバージョン管理](nifi-registry)
1. Kafkaあれこれ
    - [メッセージのPublish/Consume確認](kafka-pub-con)
1. RDBMSあれこれ
    - [MySQL JDBCドライバをインストール](mysql-jdbc-download)
    - MySQLにテーブル作成 [template](templates/MySQL_Example.xml)
1. NiFiでデータを受信する [template](templates/HTTP_Upload.xml)

以下、今後のネタ帳 (comming soon...)

1. 新しいデータをストリーム形式で収集するには?
    - ファイルシステムやオブジェクトストレージなどはList/Fetchが定番
    - データベースの差分をキャプチャするGenerateTableFetch、QueryDatabaseTable
1. NiFiでデータ処理スピードが追いつかないとどうなる?
    - 上流に待ってもらうのがBackPressure
    - 処理対象のデータ優先度を決めるPrioritizer
    - すべてのデータが必要?鮮度重視ならExpirationも検討
1. Record Schema管理のプラクティス
    - InferAvroSchemaを使ってSchemaを推測する
    - 汎用的に利用できるSchemaを用意しておこう
    - データ変換系のProcessorで入出力のSchema名を個別に指定する小ワザ
1. NiFiで簡易的なデータ集計を行うには?
    - QueryRecordを使うとFlowFileをSQLで集計可能 [template](templates/Record_Statistics.xml)
    - CalcurateRecordStatsは任意のRecord Pathでレコード数を集計 [template](template/Record_Statistics.xml)
    - AttributeRollingWindowはFlowFileのAttribute毎に通過したFlowFile数を集計
1. 小さなデータをまとめるには?
1. データをフィルタリングするには?
1. NiFiからNiFiへデータを転送するには?
    - Site-to-Site (S2S)はNiFiに組み込まれた標準のデータ転送プロトコル
1. フロー内で別の箇所の処理完了を待ってから何かをするには?
    - Wait/Notifyを組み合わせて待ち合わせを実現する
