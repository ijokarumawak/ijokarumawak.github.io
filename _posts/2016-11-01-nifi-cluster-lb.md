---
layout: post
title:  "NiFi Cluster and Load Balancer"
date:   2016-11-01 03:00:00
categories: [NiFi]
---

In this post, I'm going to share how to deploy a Load Balancer (LB) in front of a NiFi cluster.

<ol id="toc">
</ol>


## Why do we need a Load Balancer for NiFi cluster?

The easiest way to start using NiFi is deploying it as a standalone NiFi instance. However, when you need more throughput, NiFi can form a cluster to distribute load among multiple NiFi nodes.

From 1.0, thanks to the Zero Master Clustering architecture, we can access NiFi Web UI via any node in a cluster. Although it's more reliable, it can be unclear which endpoint to specify for things like Remote Process Group url, clients for processors like ListenTCP or ListenSyslog acting as servers.

NiFi Site-to-Site protocol is cluster-topology aware and automatically distributes load among nodes, but users may wonder which hostname to specify. You can point to any node in the cluster, but what if the node goes down?

If ListenXXX processors runs in a cluster, we could configure it with `On Primary Node` scheduler to make it simply runs only on a single node (we used to specify a primary node). But it doesn't scale, and will be a SPOF. If every node can receive incoming request, NiFi can be more powerful.

To address above concerns, adding a LB in front of your NiFi cluster would be a great solution.

## Use Docker Compose to create an environment

There're so many docker containers nowadays, so I started with searching docker hub. I was so glad to find following containers to form a NiFi environment looks like following diagram, these containers made my task way easier:

- [mkobit/nifi](https://github.com/mkobit/docker-nifi), I added startup script so that it automatically picks up container's hostname and updates nifi.properties.
- [zookeeper](https://hub.docker.com/_/zookeeper/), NiFi uses Zookeeper for cluster coordination.
- [dockercloud/haproxy](https://github.com/docker/dockercloud-haproxy), this docker image detect exposed ports on linked service containers, it's really useful with docker-compose.

![](/assets/images/nifi-cluster-lb-nw.png)

### Exposed ports on NiFi Node

On a NiFi node container, following ports have to be accessible from other hosts (port numbers can be configurable, so it might be different from your environment). So I exposed these at [nifi-node/Dockerfile]( https://github.com/ijokarumawak/docker-compose-nifi-cluster/blob/7de29addcd050ef2f45c7ae73a82924f1f916ed4/nifi-node/Dockerfile#L5). Within these ports, only 8080 and 9001 are the ones that facing external network, thus candidates to be accessed through a LB.

| Port | Protocol | LB? | Memo |
|------|----------|-----|------|
|8080|HTTP|Yes|NiFi Web API (UI, REST, HTTP S2S)|
|8081|TCP|No|RAW S2S|
|8082|TCP|No|Cluster Node Protocol|
|9001|TCP|Yes|Misc. used by server type processors|

Technically, RAW S2S is accessed from external network, but since Site-to-Site clients handle load-balancing, it's unnecessary to add it under LB.

### Specify which ports are accessible via LB

As mentioned in dockercloud/haproxy document, it uses all exported ports on application containers as routing destination. So unless specifying the purpose of those ports, haproxy load balances incoming HTTP request toward them. Default setting caused an odd behavior, that only 1/4 NiFi HTTP requests succeed (there're four ports, 8080, 8081, 8082 and 9001, but only 8080 can accept the request).

I excluded port 8081 and 8082 to be used by LB, by setting `EXCLUDE_PORTS` environment value for [nifi-nodes docker-compose service](https://github.com/ijokarumawak/docker-compose-nifi-cluster/blob/7de29addcd050ef2f45c7ae73a82924f1f916ed4/docker-compose.yml#L18).

Then, used [TCP_PORTS environment value]( https://github.com/ijokarumawak/docker-compose-nifi-cluster/blob/7de29addcd050ef2f45c7ae73a82924f1f916ed4/docker-compose.yml#L20) to specify that 9001 is a TCP port, not for http protocol.

These settings allow haproxy to route http request to NiFi nodes 8080 port, and TCP connection to 9001 port.

## Scaling number of NiFi nodes

Once Docker compose file is setup correctly, scaling out number of NiFi node is easy as executing following single command line:

{% highlight bash %}
$ docker-compose scale nifi-nodes=2
{% endhighlight %}

Now I can see a two nodes cluster by accessing Docker host address from a web browser:

![](/assets/images/nifi-cluster-lb-ui.png)

## ListenTCP

Let's set up a NiFi data flow to confirm whether incoming requests get distributed as expected.
Added a Listen TCP, configured it to listen on port 9001, and execute following netcat command several times:

{% highlight bash %}
$ netcat 192.168.99.100 9001
a (input some characters and enter, these are sent to ListenTCP)
e
g
t
s
{% endhighlight %}

Then, look at the stats from NiFi UI...
Tah Dah!

![](/assets/images/nifi-cluster-lb-listentcp.png)

## Summary

There's many stuff to learn, such as NiFi clustering, Zookeeper, Docker container, Docker compose and HAProxy. I struggled with setting it up correctly. But once it's done, you can get a nice distributed testing environment up and running really quickly, and also, I expect these containers can be deployed on larger container pools for production use. Or of course, these stack can be deployed on cloud VM instances or physical on-premise servers without docker.

The [docker compose sample project](https://github.com/ijokarumawak/docker-compose-nifi-cluster/tree/7de29addcd050ef2f45c7ae73a82924f1f916ed4) is available on Github. I'm planning to explorer deeper with SSL termination and other protocol such as WebSocket using this environment. See you next time!

<script>
function whenAvailable(name, callback) {
    var interval = 100; // ms
    window.setTimeout(function() {
        if (window[name]) {
            callback(window[name]);
        } else {
            window.setTimeout(arguments.callee, interval);
        }
    }, interval);
}

function createToC(){
  var hs = $("h2,h3,h4", $(".post")[1]);
  var toc = $("#toc");
  var parents = [toc, undefined, undefined];
  for(var i = 0; i < hs.length; i++){
    var hi = hs[i].nodeName.substring(1);
    var p = parents[hi - 2];
    var h = $('<li/>');
    h.append($('<a/>', {
      text: hs[i].innerHTML,
      href: "#" + hs[i].id
    }));
    $(p).append(h);
    parents[hi - 1] = h;
  }
}

whenAvailable("$", createToC);

</script>
