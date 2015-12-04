---
layout: post
title:  "2.5kb以上のJSONドキュメントを管理画面で表示させる"
date:   2015-12-04 23:59:00
categories: [Couchbase]
---

Couchbase Advent Calendar用記事12/4分! 今日は皆さん多分遭遇したことのあるCouchbase Server Admin ConsoleでJSONのサイズが2.5kbを超えると編集どころか表示すらできなくなっちゃうワーニングメッセージを回避する方法を紹介しまーす。

**注**: ソースコードを一部いじるので自己責任でお願いしますね!

このワーニングメッセージをご覧になった方はいらっしゃるでしょうか? 開発中やプロダクション環境で保存されたJSONドキュメントの中身を見たいのに、サイズ上限(2.5kb)を超えた途端編集できない、見ることもできない!
<img src="/assets/images/json-edit-size-limit/warning.png">

このワーニングのチェックはJavascriptを利用し、ブラウザ上で行っています。
該当のJavascriptファイルは:

- Mac: /Applications/Couchbase Server.app/Contents/Resources/couchbase-core/lib/ns_server/erlang/lib/ns_server/priv/public/js/documents.js
- Linux: /opt/couchbase/lib/ns_server/erlang/lib/ns_server/priv/public/js/documents.js


この中に`docBytesLimit`という変数でチェック用のサイズ上限が定義されています。2,500から25,000に変更!
<img src="/assets/images/json-edit-size-limit/docBytesLimit.png">

さっきのJavascriptファイルを変更後、ブラウザのキャッシュをクリアしてリロードすると...

Ta-da-! 問題なく見えるようになります :)
<img src="/assets/images/json-edit-size-limit/without-warning.png">

本日はここまで、Have a great weekend!
