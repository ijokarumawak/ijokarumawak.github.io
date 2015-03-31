---
layout: post
title:  "Scalaのパターンマッチングに恋をする"
date:   2015-03-30 18:00:00
categories: [Scala]
---

あぁ、あなたはなんてエレガントなのでしょう。。。

## Before

昨日まではこんなコード。処理するタグが増えるたびにcase文を書いていたので、なんだかなー、と思ってました。

{% highlight scala %}

val xml = new XMLEventReader(Source.fromFile(file))
for(event <- xml){

	event match {
		case EvElemStart(_,"uicontrol",attrs,_) => {
			doSomething("uicontrol", attrs)
		}
		case EvElemStart(_,"wintitle",attrs,_) => {
			doSomething("wintitle", attrs)
		}
	}

}
{% endhighlight %}

## After

パターンマッチングに正規表現がそのまま渡せるなんて知らなかったんです。
しかもマッチングしたグループを自動的に変数に代入してくれるだなんて。

{% highlight scala %}

val xml = new XMLEventReader(Source.fromFile(file))
val inlineTags = """^(uicontrol|wintitle)$""".r
for(event <- xml){

	event match {
		case EvElemStart(_,inlineTags(tagName),attrs,_) => {
			doSomething(tagName, attrs)
		}
	}

}
{% endhighlight %}

恐らくこの感動はScala初心者のうちしか味わえない! と思い、残しておきます。

