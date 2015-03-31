---
layout: post
title:  "RowMatrix.columnSimilaritiesでIndexOutofBoundsException"
date:   2015-03-31 21:00:00
categories: [Spark]
---

教訓: 夜遅くにハマったら、お風呂に入ってさっさと寝ましょう。

翻訳メモリの実装が実践で使えるくらいになってきたので、登録する翻訳元ファイルを増やして、文の類似度を計算しようとしたら、出ましたよ! 例外が!

{% highlight text %}
15/03/31 21:00:46 ERROR Executor: Exception in task 0.0 in stage 12.0 (TID 11)
java.lang.ArrayIndexOutOfBoundsException: 580
	at org.apache.spark.mllib.stat.MultivariateOnlineSummarizer$$anonfun$add$3.apply$mcVID$sp(MultivariateOnlineSummarizer.scala:75)
	at org.apache.spark.mllib.linalg.SparseVector.foreachActive(Vectors.scala:391)
	at org.apache.spark.mllib.stat.MultivariateOnlineSummarizer.add(MultivariateOnlineSummarizer.scala:73)
	at org.apache.spark.mllib.linalg.distributed.RowMatrix$$anonfun$16.apply(RowMatrix.scala:389)
	at org.apache.spark.mllib.linalg.distributed.RowMatrix$$anonfun$16.apply(RowMatrix.scala:389)
{% endhighlight %}

今まで10数個のXMLファイル、200文程度のデータ量でやっていて普通に動いていたのに。
ファイル数を増やしたら例外が発生するなんて、何か引き当てたか!? と昨日は夜遅くにどハマりしてました。


諦めて次の日、再度コードを眺めていると、分かったんです、原因。

Vector.sparseで指定するサイズを誤っていたのです。何とも単純なミス。

{% highlight scala %}
Vectors.sparse(size, indices, values)
{% endhighlight %}

SparseなVectorは、存在する値のみ指定すれば良いので、今回扱っているような単語インデックスに向いています。
そして、文章間の類似度を計算するのに、RowMatrixを利用しています、Matrixはこんなイメージ:

|  | s(1) | s(2) | s(n) |
|--|----|----|----|
| t(1) | 0.1 | - | TFIDF of t(1) in s(n) |
| t(2) | - | 0.5 | TFIDF of t(2) in s(n) |
| t(m) | TFIDF of t(m) in s(1) | TFIDF of t(m) in s(2) | TFIDF of t(m) in s(n) |

- s: 文章(sentence)です。
- t: 文章中に現れる単語(term)。
- TFIDFを計算して各要素の値としています。
- s(1)にはt(2)が出現しないので、ここをSparseとして扱うことに意味がある!

と、コードを書く前にこのMatrixイメージを描いていました。
そしたら、**このMatrixのサイズは辞書中の単語数だと勘違い**していたんですね!

なので、例外が発生した際のコードはこんなんになってました:

{% highlight scala %}
val size = m // ここが間違い、辞書中の単語数を指定していた
val indices = Array(1, 2, ... n)
val values = Array(0.1, 0.5, ... "TFIDF of t(m) in s(n)")
Vectors.sparse(size, indices, values)
{% endhighlight %}

修正後はこちら:

{% highlight scala %}
val size = n // indicesが文章のIDなので、正解は全文章のID数を指定しないといけなかったです。
{% endhighlight %}

少量のデータでは、辞書中の単語数が、文章数よりも少なかったから何とか動いてたんですね。
分かってしまえば大したことないですが、答えが見つかるまでは非常にツラいですねー、そんなときは明日の自分に任せて早く寝ましょうw
