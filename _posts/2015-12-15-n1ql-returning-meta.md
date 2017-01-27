---
layout: post
title:  "N1QL: DMLのRETURNING句を調査しながらGo言語の基礎を学ぶ"
date:   2015-12-15 23:30:00
categories: [Couchbase]
---

昨日の[Embulk Output Couchbase プラグインを Scala で書く](http://www.zaneli.com/blog/20151214) by [zaneli](http://qiita.com/zaneli@github)さん、に続く、[Couchbase Advent Calendar](http://qiita.com/advent-calendar/2015/couchbase)、12/15分の記事です。先日の記事、[N1QL INSERT](/couchbase/2015/12/11/n1ql-insert/)からの続きです。ほぼGo言語の勉強メモになってしまった!

<ol id="toc">
</ol>

## まえがき

先日、N1QLでインサートしたドキュメントのメタデータを返す方法が分からず、もやもやしていました。例えば、次のようなクエリを実行するとき、タイムスタンプやUUIDを使って動的にKeyを生成した場合は、Keyが返ってきてほしいものですよね。

{% highlight sql %}
-- サンプル: 集計結果のJSONドキュメントを保存する
INSERT INTO `default` AS r
(PRIMARY KEY UUID(), VALUE {
    "count": cnt, "avg": avg, "min": min, "max": max})
SELECT COUNT(u) AS cnt, AVG(u.age) AS avg,
  MAX(u.age) AS max, MIN(u.age) AS min
  FROM `default` AS u WHERE u.age IS NOT MISSING
RETURNING r
{% endhighlight %}

実行結果は次のように返却されます:
{% highlight json%}
[ {
    "r": {
      "avg": 16.6, "count": 5,
      "max": 34, "min": 5 }
  } ]
{% endhighlight %}

<!--

https://issues.couchbase.com/browse/MB-16241

> When objects are manipulated by N1QL directly, it would internally use SET operation, which can return these seq# to Query engine. That in turn can be used for future at_plus operations.

> But in either case, we'd not expose seq# on META.

> However At some point in discussion with Gerald, he mentioned that we cannot prevent folks from indexing on META().functions because we don't have strict validation.

META()の項目もGSIに利用できるけど、あくまでKVのメタデータなので、GSIでインデクシングするとタイムラグが発生することがある。

-->

Goの勉強がてらQueryエンジンのソースコードを追ってみました。

結果から言うと、インサートしたドキュメントの返却方法はわかりませんでした。今、クエリ実装チームに問い合わせているところですw

というわけで、今日の記事はほとんど私のGo言語勉強メモです。

## KVにインサートした結果のあたりからソースコードリーディング開始

[前にDMLの更新モードを調査](/couchbase/2015/12/03/n1ql-dml/)した際に、QueryサービスからDataサービスにドキュメントをインサートする箇所は分かったので、今回はそこから始めました。

[execution/insert_send.go](https://github.com/couchbase/query/blob/master/execution/insert_send.go)
{% highlight go %}
func (this *SendInsert) flushBatch(context *Context) bool {
(中略)
	// Capture the inserted keys in case there is a RETURNING clause
	for i, k := range keys {
		av := value.NewAnnotatedValue(make(map[string]interface{}))
		av.SetAttachment("meta", map[string]interface{}{"id": k})
		av.SetField(this.plan.Alias(), dpairs[i].Value)
		if !this.sendItem(av) {
			return false
		}
	}
{% endhighlight %}

metaでインサートしたドキュメントのkeyをav.SetAttachmentしている。
avってなんだ?Attachmentってなんだ?

avはNewAnnotatedValueで作成されているもの。

## Goでの変数代入、"="と":="の違いは何?

`:=`は関数の中で変数を宣言するのに使える。varとTypeを書く必要ない。
パッケージレベルで書く場合はvar使わないといけない。
ってなことさえ知らないGo初心者です。。
[A Tour of Go](https://tour.golang.org/basics/10)分かりやすくていいっすね。

`this.sendItem(av)`は?

## そもそもthisって誰よ?

Goにはクラスは無いが、functionをstructに紐付けてmethodとして扱える。
先のコードではSendInsert structのflushBatchというmethodになる。
Goでは`this`に特別な意味合いはない。[Stackoverflow](http://stackoverflow.com/questions/29028512/go-this-keyword)

## StructとAnonymous FieldでOO指向的なクラス階層

んーっと、でもinsert_send.goにはsendItemってfunctionは実装されていないんだけど、どこにあるのか。。?
最近Githubの検索機能がうまく動かずツラい。ソースをgrepすると、

execution/base.goにありました。

{% highlight go %}
func (this *base) sendItem(item value.AnnotatedValue) bool {
	select {
  // stopChannelに何かあれば読み捨てて終了
	case <-this.stopChannel: // Never closed
		return false
	default:
	}

	select {
  // itemChannelにitemを送信
	case this.output.ItemChannel() <- item:
		return true
	case <-this.stopChannel: // Never closed
		return false
	}
}
{% endhighlight %}

これまた意味不明。SendInsertとbase structの関係は一体どこで紐付いてるのか??
おー、これが[Anonymous fields](http://golangtutorials.blogspot.jp/2011/06/anonymous-fields-in-structs-like-object.html)ってやつか。SendInsertにはbaseって無名フィールドが定義されていて、これがbaseを継承する感じになっているらしい。

## Goroutine、channel、select

baseのsendItemが呼ばれることは分かったけどー。
まずはcaseの解読。おっと、switchじゃなくて、selectだ!

selectはcaseのいずれかがreadyになっているときにそれを実行する。Readyとはchannelにアイテムがあることだろう。channelはgoroutine間でデータをやりとりするもの。 [A Tour of Go](https://tour.golang.org/concurrency/2)

channelはmake()しないと使えない。makeの引数は何ですか?
一つ目はchannelの型。
二つ目はbufferサイズ。ちなみに以下はdeadlockになる:

{% highlight go %}
func main() {
	ch := make(chan int, 2)
	ch <- 1
	ch <- 2
	ch <- 3
	fmt.Println(<-ch)
	fmt.Println(<-ch)
}
{% endhighlight %}

execution/base.goでは、以下のようにitemChannelとstopChannelを定義している:

{% highlight go %}
func newBase() base {
	return base{
    // pipelineCapは512
		itemChannel: make(value.AnnotatedChannel, GetPipelineCap()),
		stopChannel: make(StopChannel, 1),
	}
}
{% endhighlight %}

base.goの`runConsumer()`を見ると、consumerにitemChannelから読み込んで渡している箇所がある。
{% highlight go %}
			select {
			case item, ok = <-this.input.ItemChannel():
				if ok {
					ok = cons.processItem(item, context)
				}
			case <-this.stopChannel: // Never closed
				break loop
			}
{% endhighlight %}

ここまでくると、実行計画を見てconsumerを特定するのが良さげか?

## N1QLの実行計画を元に動きを追ってみる

今回実行しているN1QLの実行計画を見ると、最後の方で、SendInsert -> InitialProject -> FinalProjectの流れとなっている。
普通に考えると、先ほどの文脈ではSendInsertのconsumerがInitialProjectになるはず。

[execution/project_initial.go](https://github.com/couchbase/query/blob/master/execution/project_initial.go)を見ると、ありました。`processItem`!
ここに渡ってきたitemのattachmentにmetaがあるはず。

Termsってのは、実行計画にあったresult_termsだろう。
このあたりで[META()](https://github.com/couchbase/query/blob/master/expression/func_meta.go)が何やってるか見ておこう。

やはりattachmentのmetaを取得しているのだけど、なぜ返ってこないんだろう。


{% highlight go %}
func (this *Meta) Evaluate(item value.Value, context Context) (value.Value, error) {
(中略)
	switch val := val.(type) {
	case value.AnnotatedValue:
    // attachmentのmetaを取得している。
		return value.NewValue(val.GetAttachment("meta")), nil
{% endhighlight %}

## まとめ

結局RETURNING句でKeyを返す方法はわかりませんでしたが、Go言語の基本的なことが分かってきたので良しとします! Keyを返す方法が分かったら共有しまーす。
