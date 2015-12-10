---
layout: post
title:  "Couchbase Server 3.1.2 リリース、修正箇所から学ぶソースコード"
date:   2015-12-07 18:00:00
categories: [Couchbase]
---

少し前になりますが、11月16日にCouchbase Server 3.xの最新バグフィックス版3.1.2がリリースされました。今日はリリースの内容をちょっと深堀りして紹介してみたいと思います。そしてより詳細にCouchbase Serverの挙動を理解すべく、該当箇所のソースコードを確認します。

[3.1.2 リリースノート](http://docs.couchbase.com/admin/admin/rel-notes/rel-notes3.0.html)翻訳

| Issue | 説明 |
|-------|------|
| [MB-16385](http://www.couchbase.com/issues/browse/MB-16385) | パーティションの一部を利用してViewをクエリすると大量のメモリを消費。|
| <del>[MB-16357](http://www.couchbase.com/issues/browse/MB-16357)</del> | <del>コンパクションの実行中にvBucketの状態がactiveからreplicaに変わると、コンパクションスレッドとmemcachedスレッドの間のレースコンディションによりassertionが実行されクラッシュを誘発する可能性。</del> edited Dec 10, 2015: 3.1.2のリリースノートの記載が誤っていたため3.1.2で解決されたと思われたが、こちらは3.1.4で解決される予定|
| [MB-16421](http://www.couchbase.com/issues/browse/MB-16421) | XDCR中に宛先クラスタでgetMetaが実行され、続けてGETリクエストがクライアントから実行されると、バックグラウンドでのアイテムフェッチ操作が完了せず、大量のディスク参照が発生し、クライアント側ではタイムアウトとなる。|
| [MB-16528](http://www.couchbase.com/issues/browse/MB-16528) | バケット設定を変更した後、バケットがmemcachedにロードされる前にデルタnodeリカバリを開始すると、リバランス操作によりnodeがクラスタから削除されるが、クラスタvBucketマップ上にはそのnodeが残ってしまう場合がある。|
| [MB-13948](http://www.couchbase.com/issues/browse/MB-13948) | ドキュメント毎に大量のkey-valueペアをemitする場合、View MapReduce処理のmapフェーズで大量のメモリを消費。|
| [MB-16055](http://www.couchbase.com/issues/browse/MB-16055) | クラスタのRAM割当量をCLIで変更すると、read-onlyユーザが削除される。|

ふむふむ、なるほど、全部は細かく調査できませんが、気になるものを優先してどんな原因でどんな修正が行われたのかちょっと見てみましょう。

# MB-16385: Viewクエリのメモリ消費量改善

チケットを見ると、2.0以降のすべてのバージョンが対象のようですね。4.x系のバージョンでは4.1.0で対応がリリースされる予定です。

チケットの説明を簡単に訳すと...

> Viewエンジンは、Viewクエリ実行時に特定のパーティション(vBucket)だけをフィルタリングしてクエリすることをサポートしている。この機能はリバランス中に対象のデータが更新/クリーンアップされても、Viewの結果を安定させるために利用される。
> 
> 巨大なデータセットではこの動的なフィルタリングが多くのnodeにアクセスする必要がある場合がある。これは最終結果に含まれるべきkey-valueペアが最終的なReduce結果を返すまでメモリ上に保持されることとなり、大量のメモリ利用を引き起こす。
> 
> この問題に対する対処はkey-valueペアを中間のステップでreduceし、reduceした結果だけを渡すことである。

と、あります。なので、reduceを利用したViewクエリをアプリケーションから実行中にリバランスを実行すると影響を受けることになります。

修正箇所としては、[couch_btree.erl](https://github.com/couchbase/couchdb/blob/master/src/couchdb/couch_btree.erl)の`reduce_stream_kp_node2`の以下の部分です:

{% highlight erlang %}
        #btree{reduce=ReduceFun} = Bt,
        {ok, Acc2, GroupedReds2Tmp, GroupedKVsAcc2, GroupedKey2} = lists:foldl(
            fun({_, Node}, {ok, A, RedsAcc, KVsAcc, K}) ->
                {ok, A2, RedsAcc2, KVsAcc2, K2} = reduce_stream_node(
                    Bt, Dir, Node, KeyStart, InEndRangeFun, K,
                    KVsAcc, RedsAcc, KeyGroupFun, Fun, FilterFun, A),
                % ここで中間のReduceを実行するのが追加された
                % Reduce the KVs early to reduce memory usage
                Red = ReduceFun(reduce, KVsAcc2),
                RedsAcc3 = [Red | RedsAcc2],
                {ok, A2, RedsAcc3, [], K2}
            end,
            {ok, Acc, GroupedReds1 ++ GroupedRedsAcc, GroupedKVsAcc, GroupedKey},
            NeedFilter),
        % Rereduce the reduces early to reduce memory usage
        GroupedReds2 = [ReduceFun(rereduce, GroupedReds2Tmp)]
{% endhighlight %}

ぬぅ、Erlang読めない。。

# MB-16421: XDCR + Full EjectionモードでGetリクエストがタイムアウト

これは一体どういうことなのでしょうか。JIRAチケットの説明を簡単に訳してみると...

> XDCRを利用した宛先クラスタ上で、ソースクラスタで書き込まれたキーに対するGetが実行された場合に正しく処理する必要がある。
> 
> 宛先クラスタでgetMetaが実行されると、keyとmetadataだけがリストアされる(ディスクからメモリに展開される)、そのため、この状態はnon-resident(keyだけがメモリ上に存在し、valueはメモリに存在しない状態)となる。この直後、クライアントからGetがこのkeyに対して実行されると - メモリ上にアイテムが存在するがnon-residentであるため、bgfetch(バックグラウンドでのディスクフェッチ)が発生する。Full Ejectionモードでは、bgfetchでは、アイテムはtemp-initialアイテムの場合のみリストアされる、このため、アイテムはリストアされないがep-engineはSUCCESSをmemcachedに返してしまう、これはep-engineを再び参照するが、アイテムがまだnon-residentであるため、bgfetchを再び実行してしまう。
> このオペレーションは無限に継続し、大量のディスクリードを行い、クライアント側ではGetオペレーションのタイムアウトが発生する。
> 対応策としては、Full Ejectionモードの際に、tempInitialかnon-residentの場合はアイテムをリストアすることであろう。

と記載されています。んー、tempInitailのアイテムってどんなんなんでしょう? CouchbaseのJIRAチケットには、ソースが回収されると、Gerrit Reviewsというところから、修正箇所が確認できます。今回修正されたのは[ep.cc](https://github.com/membase/ep-engine/blob/master/src/ep.cc)中の以下のif文の条件です:

{% highlight cpp %}
void EventuallyPersistentStore::completeBGFetch(const std::string &key,
                                                uint16_t vbucket,
                                                const void *cookie,
                                                hrtime_t init,
                                                bool isMeta) {
(中略)
                switch (eviction_policy) {
                    case VALUE_ONLY:
                        if (v && !v->isResident() && !v->isDeleted()) {
                            restore = true;
                        }
                        break;
                    case FULL_EVICTION:
                        if (v) {
                            if (v->isTempInitialItem() ||
                                // この条件が追加された
                                (!v->isResident() && !v->isDeleted())) {
                                restore = true;
                            }
                        }
                        break;
                    default:
                        throw std::logic_error("Unknown eviction policy");
                }
{% endhighlight %}


StoredValue->isTempInitial()ってなんだ??
[stored-value.h](https://github.com/membase/ep-engine/blob/master/src/stored-value.h)には以下の定義があります。

{% highlight cpp %}
    /**
     * Is this an initial temporary item?
     */
    bool isTempInitialItem() {
        return bySeqno == state_temp_init;
    }
{% endhighlight %}


state_temp_initを利用している箇所を調べていくと、tempInitialなItemはバックグラウンドのディスクフェッチ用の一時的なアイテムであることがわかりました。
[ep.cc](https://github.com/membase/ep-engine/blob/master/src/ep.cc)のGetリクエストを処理する実装では、bgFetchを実行する際にtempInitialなアイテムを追加しています。非同期でディスクを読みに行くので、その状態を記録しているわけですね。


{% highlight cpp %}
GetValue EventuallyPersistentStore::getInternal(const std::string &key,
                                                uint16_t vbucket,
                                                const void *cookie,
                                                bool queueBG,
                                                bool honorStates,
                                                vbucket_state_t allowedState,
                                                bool trackReference) {
(中略)
        if (vb->maybeKeyExistsInFilter(key)) {
            ENGINE_ERROR_CODE ec = ENGINE_EWOULDBLOCK;
            if (queueBG) { // Full eviction and need a bg fetch.
                ec = addTempItemForBgFetch(lh, bucket_num, key, vb,
                                           cookie, false);
            }
            return GetValue(NULL, ec, -1, true);
        } else {
            // As bloomfilter predicted that item surely doesn't exist
            // on disk, return ENONET, for getInternal().
            GetValue rv;
            return rv;
        }

{% endhighlight %}

XDCRで宛先クラスタ上にアイテムが存在するかを判定する際に、keyとmetadataをメモリ上に展開した後、getを実行すると、すでにkeyはRAM上に存在するのでtempInitialなアイテムは作成されません。このためbgFetchではアイテムをリストアしない(Memcachedにロードされない)ので、無限にループしてしまうのですね。

Full Ejectionモードの時に、アイテムのkeyとmetadataだけがRAMに展開されている状況を想定していなかったのでしょう。。Full Ejectionではvalueをメモリから除去する際に、keyとmetadataもメモリから除去しますからね。。。

# まとめ

時間の都合で二つしか深堀りできませんでしたが、発生した問題を回収するために変更されたソースコードをみると、どんな機能がどこで実装されているのかを手っ取り早く知ることができます。Couchbase Serverはオープンソースで開発言語も様々、読み物としてもオススメですねw
