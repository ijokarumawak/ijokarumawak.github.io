jQuery(document).ready(function($){
    // todo: jquery stuff should need to put here.
});

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

if (window.location.pathname.length > 1) {
  // Don't want to create ToC on Top page.
  whenAvailable("$", createToC);
}

