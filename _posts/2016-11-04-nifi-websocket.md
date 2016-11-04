---
layout: post
title:  "NiFi WebSocket support"
date:   2016-11-04 10:00:00
categories: [NiFi]
---

This post is meant for describing how NiFi WebSocket components work. It is currently under reviewing process, so the final design might be different.

<ol id="toc">
</ol>

## Basics of WebSocket protocol

WebSocket is a fully duplex and bi-directional protocol. The most interesting characteristics (at least for me) is that there is no difference or roll such as server or client for each peer after those established a WebSocket connection.
Each peer can send messages at will.
However, a connection is always initiated by a WebSocket client.

For example:

- A client sends a HTTP request to a server (URL e.g. ws://example.com/web-socket).
- The server accepts the request and upgrade HTTP protocol to WebSocket protocol.
- (at this point, each peer can send or receive messages asynchronously)
- The client can send a message to the server
  - The server receives it
- The server can send a message to the client
  - The client receives it

I wondered, should NiFi be a client? or a server? Then decided to support both. NiFi can be not only a WebSocket client, but also a WebSocket server!

## How it works? Modules

Since the protocol itself is more complex than (or simply different from) other protocols, it was tough to put it into NiFi data flow processing model.
Some might feel it is too complex to use, so let me try to explain how it works.

![](/assets/images/nifi-websocket/modules.png)

As shown in above diagram, it is devided into three modules described below, for extensibility and testability.
Each of these are individual NAR.
Both `nifi-websocket-processors-nar` and `nifi-websocket-services-jetty-nar` have NAR dependency to `nifi-websocket-services-api-nar`.

### nifi-websocket-services-api

- WebSocketClientService: An Interface acts as a WebSocket client.
- WebSocketServerService: An Interface acts as a WebSocket server.
- Features:
  - WebSocket events: Both Client and Server services adopt event-driven processing so that WebSocket processors can react to.
    - `connected`: Fired when a remote client connects with WebSocketServerService, or a WebSocketClientService connects with a remote WebSocket server.
    - `text message`: Fired when it receives text WebSocket message.
    - `binary message`: Fired when it receives binary WebSocket message.
  - Send message: Provides methods to send text and binary WebSocket message to a connected remote peer.
  - Multiple endpoints: It registeres processors to endpoints. WebSocketServerService uses an URI path as an endpoint. For example, the sanme WebSocket server instance can manage two WebSocket endpoints, such as `ws://hostname:listen-port/endpoint-1` and `ws://hostname:listen-port/endpoint-2`. Connected sessions are manages separately within each endpoints.
Likewise, WebSocketClientService uses a `clientId` to distinguish endpoints. Multiple WebSocket client instances can share the same WebSocketClientService instance.

### nifi-websocket-services-jetty

This module contains actual implementation of nifi-websocket-services-api using Jetty.

- Features:
  - Plain WebSocket (ws://), and Secure WebSocket (wss://) protocols are supported.
  - Uses SSLContextService to refer Java keystore and truststore for secure communication.

### nifi-websocket-processors

In order to use these functionalities in a NiFi data flow, we need to put it on a canvas as Processors.

- `ConnectWebSocket` and `ListenWebSocket`: These work as WebSocket gateways. These processors are registered to WebSocketServer and receives WebSocket events described earlier. When those events are fired, it will be converted to NiFi FlowFile, then sent to relationsips accordingly. There are three relationships, `connected`, `text message` and `binary message`. ConnectWebSocket uses WebSocketClientService to actively connect to a remote WebSocket endpoint, while ListenWebSocket uses WebSocketServerService to wait passively for remote WebSocket clients to connect. 
- `PutWebSocket`: This processor can use with both ConnectWebSocket and ListenWebSocket, since there is no distinction after connection is made. It sends a WebSocket message using an incoming FlowFile content as message payload.

## How can I use? Use Cases

Ok, enough descriptions, let's see how can we use these component in NiFi data flow!

### NiFi as a client to talk with a remote WebSocket server

To use NiFi as a WebSocket client, we need a WebSocketClientService.
To add the service:

![](/assets/images/nifi-websocket/websocket-client-add.jpg)

1. Click the gear icon on Operate palette
2. Click the plus sign
3. Enter 'WebSocket' tag to search the ControllerService
4. Click the edit icon of the JettyWebSocketClient controller service

Then, the service needs to be configured as follows:

![](/assets/images/nifi-websocket/websocket-client-config.jpg)

<ol start="5">
<li>Set ws://echo.websocket.org to WebSocket URI. This URI is publicly available to test WebSocket client. It simply echoes back the message it receives.</li>
<li>Click the enable icon, and the service is ready!</li>
</ol>

Nest, let's setup the data flow using processors:

![](/assets/images/nifi-websocket/websocket-client-flow.jpg)

- ConnectWebSocket: Uses the JettyWebSocketClientService added earlier. `connected` and `text message` are routed to ReplaceText. `binary message` is terminated here because we don't use it in this example.
- ReplaceText: Add some prefix to update text content
- PutWebSocket: This processor sends messages to the remote WebSocket server. Don't forget to set `Run Schedule` longer than default like 3 sec, otherwise this ping-pong loop goes too fast like DoS attack...
- UpdateAttribute: This is the end of data flow, and keep it stopped so that we can accumulate the FlowFiles in the relationship and check the contents

By right click the `success` relationship, the queued FlowFiles can be seen. Its file size is growing as ReplaceText prepend text each time.

![](/assets/images/nifi-websocket/websocket-client-files.jpg)


### NiFi as a server to talk with a remote WebSocket client

Once you get the idea, setting up NiFi as a WebSocket server is easy, almost the same!

We just need to use `JettyWebSocketServer` controller service instead, and set `Listen Port`:

![](/assets/images/nifi-websocket/websocket-server-add.jpg)

Then, replace the ConnectWebSocket processor with `ListenWebSocket` processor, and specify the `Server URL Path` that you want to receive WebSocket requests:

![](/assets/images/nifi-websocket/websocket-server-flow.jpg)

Then, open [websocket.org echo](http://www.websocket.org/echo.html) from a web browser, set location as `ws://localhost:9001/server-demo`, and click Connect, then Send. NiFi will echo back the message!



### Secure WebSocket connection

To use secure WebSocket connection, we need another controller service, `StandardSSLContextService`. Then use it from JettyWebSocketClient or JettyWebSocketServer. The URL should use `wss://` protocol for secure connection.

### Scalability

When NiFi is deployed as a cluster for scalability, we can run these WebSocket component on every node. To distribute loads when you use NiFi as WebSocket server, you will need a Load Balancer such as HAProxy in front of NiFi cluster. Please also refer the previous post, [NiFi Cluster and Load Balancer](http://127.0.0.1:4000/nifi/2016/11/01/nifi-cluster-lb/).

## Summary

In this post, I covered the basic usage of these WebSocket controller services and processors. Since the WebSocket gateway processors (ConnectWebSocket/ListenWebSocket) and PutWebSocket can be used separately, we can design more complex and interesting data flow by putting more flow in between.

I hope this post will help the Pull Request reviewing process to go smoothly, and these will be merged into master soon!

Thanks for reading!

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
