---
title: "HTTP servers and an overview of the CGI interface"
date: 2024-01-07
description: "A toy project in Rust"
summary: "An overview of HTTP servers and CGI"
tags: ["rust", "http", "cgi", "web", "project", "backend"]
---

After finishing the [Rust book](https://doc.rust-lang.org/book/) and its final project (a very simple HTTP server), I decided to expand it to deal with more scenarios, and also add in some dynamic behavior with CGI for fun. This was a good opportunity to learn more about HTTP and CGI and inspired me to write about it.

## An introduction to the HTTP protocol

The [HTTP protocol](https://en.wikipedia.org/wiki/HTTP) is used to access resources and transmit data over the web. When you access a web page in a browser, it sends an HTTP request to a computer running the server. Consider the following request:

{{< highlight http >}}
GET / HTTP/1.1
Host: example.org
{{< / highlight >}}

The first line contains an [HTTP verb](https://developer.mozilla.org/en-US/docs/Web/HTTP/Methods), in this case `GET`. There are different HTTP verbs (or methods) used to perform different actions with a given resource. The `GET` method conventionally indicates that we want to read the resource. The following `\` represents a path to the resource we want to access (in this case, the root path). And finally, `HTTP/1.1` represents which version of HTTP we are using.
    Following this first line, a list of [headers](https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers) is supplied. These headers give the server some metadata about our request. In our case, we just supplied the `Host` header, which tells the server program what is the domain to which we are sending our request.

If you have the `netcat` command available, you can actually interact with an HTTP server and directly send a request. Run `netcat example.org 80`, which opens up a [TCP](https://en.wikipedia.org/wiki/Transmission_Control_Protocol) connection to example.org at port 80 (the default port for HTTP). Then you can copy and paste the request above and press enter twice. The server will respond with something like this:

{{< highlight plaintext >}}
HTTP/1.1 200 OK
Accept-Ranges: bytes
*a bunch of other HTTP headers*
...
Content-Length: 1256

*the actual HTML for the page*
{{< / highlight >}}

At this point you can close the connection to the server by killing netcat with CTRL+C.

The response contains an initial line that is somewhat similar to the request's, indicating the HTTP version being used, and then an [HTTP status code](https://developer.mozilla.org/en-US/docs/Web/HTTP/Status), in this case `200 OK` indicating that the request could be fulfilled successfully. Following that we have some headers for the response, a blank line, and then the actual data of interest (the [body](https://developer.mozilla.org/en-US/docs/Web/HTTP/Messages#body)).

Speaking of it, the HTTP request can also have a body, for instance:

{{< highlight http >}}
POST /anything HTTP/1.1
Host: httpbin.org
Content-Length: 10

1234567890
{{< / highlight >}}

The above request accesses the `/anything` path on [httpbin.org](httpbin.org), a utility for inspecting and testing HTTP requests. This specific path responds with data about the request sent to it. If you run `netcat httpbin.org 80` and send this request you will get a response similar to this:

{{< highlight http >}}
HTTP/1.1 200 OK
Date: Thu, 28 Dec 2023 05:28:02 GMT
Content-Type: application/json
Content-Length: 332
Connection: keep-alive
Server: gunicorn/19.9.0
Access-Control-Allow-Origin: *
Access-Control-Allow-Credentials: true

{
  "args": {}, 
  "data": "1234567890", 
  "files": {}, 
  "form": {}, 
  "headers": {
    "Content-Length": "10", 
    "Host": "httpbin.org", 
    "X-Amzn-Trace-Id": "..."
  }, 
  "json": 1234567890, 
  "method": "POST", 
  "origin": "XXX.XXX.XXX.XXX", 
  "url": "http://httpbin.org/anything"
}
{{< / highlight >}}

Here we get a JSON formatted response containing the request body, as seen in the `data` section of the response. The `headers` section displays the request headers we sent (the `X-Amzn-Trace-Id` header wasn't sent by us, but was added on their end). The request body is used for sending additional information to the server such as form data.

<div style="background-color:white; padding: 20px">
{{< mermaid >}}
sequenceDiagram
    participant B as Browser
    participant S as HTTP Server
    participant F as Filesystem
    B->>S: GET / HTTP/1.1<br />Host: example.org
    S->>F: Read contents of index.html
    F->>S: Page contents
    S->>B: HTTP/1.1 200 OK<br />Date: Thu, 28 Dec 2023 05:28:02 GMT<br /> Content-Type: application/json<br /> Content-Length: 332<br /><br />File contents...
{{< /mermaid >}}
</div>
<em>Request/response cycle for a static HTTP server</em>

An HTTP server's job is to receive and parse requests and return the correct HTTP responses. A simple server is able to serve static HTML pages and files, but many modern applications require things such as database access, file storage, connection to external services, etc. To deal with these scenarios we need servers capable of running more intricate code for each request and generating the content to be returned to the user.

## Dynamic behaviour with CGI

One way to add the dynamic behaviors described above is through CGI (or [Common Gateway Interface](https://en.wikipedia.org/wiki/common_gateway_interface)). It is an interface definition for HTTP servers and it specifies how to communicate with external programs when a request is received. Then, as long as this external program conforms to the CGI specification, it can read the incoming data and generate an adequate response.

From now on we will refer to an external program which can communicate to a server via CGI as a CGI script (although compiled programs also work perfectly fine for this). HTTP servers capable of communicating with such programs will be referred to as CGI servers.

<div style="background-color:white; padding: 20px">
{{< mermaid >}}
sequenceDiagram
    participant B as Browser
    participant S as CGI Server
    participant Sc as CGI Script
    B->>S: GET /cgi-bin/example.pl HTTP/1.1<br />Host: myexamplecgiserver.org
    S->>Sc: Request data via environment<br />variables and standard input
    activate Sc
    Note right of Sc: Here the script can<br />access databases,<br />read files,<br />run computations,<br />etc...
    Sc->>S: Execution response
    deactivate Sc
    S->>B: HTTP/1.1 200 OK<br />Date: Thu, 28 Dec 2023 05:28:02 GMT<br /> Content-Type: application/json<br /> Content-Length: 332<br /><br />File contents...
{{< /mermaid >}}
</div>
<em>Request/response cycle for a CGI server</em>

### Interface description
When a CGI server receives an incoming request, it needs to check if it should return a static page or call a CGI script, which is usually inferred by the request path. CGI scripts are commonly accessed via paths beginning with `/cgi-bin/`. It then executes the corresponding script from the configured folder in a new process. General data about the request is sent via CGI Metavariables, which are similar in spirit to HTTP headers and passed as environment variables to the process, and the request body is sent via standard input. After the script is finished executing, it returns the response metadata as well as the body formatted such that it can be parsed by the server and returned as a proper HTTP response.

Precise details regarding the metadata sent to CGI scripts and back to the server can be found in the [official RFC (3875)](https://datatracker.ietf.org/doc/html/rfc3875), but an overview of such details is given below.

### CGI Metavariables

| Metavariable | Description |
| ------------ | ----------- |
| `AUTH_TYPE` | Identifies the authentication mechanism being used by the server to authenticate the user, if any. |
| `CONTENT_LENGTH` | Size of the body of the incoming request. Must be set if there is any body content in the request. |
| `CONTENT_TYPE` | The [MIME type](https://developer.mozilla.org/en-US/docs/Web/HTTP/Basics_of_HTTP/MIME_types) of the body of the incoming request, if present. |
| `GATEWAY_INTERFACE` | Specifies the dialect of CGI being used by the server (`CGI/1.1` , for example). |
| `PATH_INFO` | A URI path to be interpreted by the CGI script. |
| `PATH_TRANSLATED` | A translated version of the above path after being parsed as a local URI and translated to the server's document repository structure (to be completely fair, I have no idea why this would be useful, but since the CGI interface is quite dated, maybe it made sense in its original context). |
| `QUERY_STRING` | The [query string](https://en.wikipedia.org/wiki/Query_string) supplied in the incoming request. It's normally what comes after `?` in the URI. |
| `REMOTE_ADDR` | The network address of the client sending the request (an IPv4 or IPv6 value). |
| `REMOTE_HOST` | The fully qualified domain name of the client sending the request. As long as I am aware, this field only makes sense if the client is registered in a [DNS server](https://en.wikipedia.org/wiki/Domain_Name_System). |
| `REMOTE_IDENT` | Provides identity information reported about the connection. |
| `REMOTE_USER` | User identification string supplied by the client as part of user authentication, if applicable. Must be set depending on the value of the AUTH_TYPE metavariable. |
| `REQUEST_METHOD` | The HTTP method used by the script to process the request, e.g., GET, POST, PUT, DELETE. |
| `SCRIPT_NAME` | The section of the URI path which specifies which CGI script is being called (for instance, if the path was `/cgi-bin/my_script.py`, this would be set to `my_script.py`). |
| `SERVER_NAME` | Name of the server host to which the client request is directed. It usually means the name of the machine running the CGI server. |
| `SERVER_PORT` | The TCP/IP port on which this request was received. |
| `SERVER_PROTOCOL` | The name and version of the application protocol used for this CGI request. |
| `SERVER_SOFTWARE` | The name and version of the CGI Server. In my project I used the name "Rust Web CGI/0.0.1". |

HTTP headers not covered by the fields above can be passed to the CGI script via extra metavariables prefixed with `HTTP_`.

### CGI Response
The output from the CGI script is returned via the standard output. It contains a header section and a body section, separated by a blank line. The header section contains one CGI header per line (not to be confused with HTTP headers) and the body is returned to the client as is. The CGI response headers define what kind of response is to be generated.

#### CGI response header fields

| Response header field | Description |
| ------------ | ----------- |
| `Content-Type` | The MIME type of the body of the CGI response, if present. |
| `Location` | Specifies to the server that the script is returning a reference to a document. Then, this field will contain either an absolute URI or a local URI path. |
| `Status` | The HTTP status to be returned. |

As with the CGI metavariables, the script is allowed to return extra headers relating to the HTTP protocol or to the specific CGI implementation.

#### CGI response types

| Response type | Description |
| ------------ | ----------- |
| Document response | When the response contains a Content-Type header and a response body. It is the most straightforward response, and the body is returned to the user with the required HTTP metadata. |
| Local redirect response | When the response contains a Location header and its value represents a local URI path. In this case the server generates the response that it would have produced if a request to the specified local URI path was received. For example, if the server is receiving a request for `http://example.com` and a Location header of `example.html` was returned by the script, the server will return the same as if the client's request was directed towards `http://example.com/example.html`. |
| Client redirect response | When the response contains a Location header and its value represents an absolute URI path. In this case the server responds with a `302 Found` status and a reference to the URI for which the client is being redirected. |
| Client redirect response with document | This case is similar to the previous one, except that a message body is also returned by the CGI script, as well as a Content-Type and Status. The client is redirected but the message body is returned to the client as well. If the client is a web browser, this response body is most likely going to be ignored. |

### Some CGI script examples

To understand the CGI interface more concretely, let's discuss some examples. The examples below can be found in the repository for my CGI server implementation in Rust: 

{{< highlight bash "linenos=table" >}}
#!/bin/bash

read INDATA
printf "Content-Type: text/html\n\n"
printf "Body: ${INDATA}<br />"
export VAR=$(env)
printf "${VAR//$'\n'/<br />}"

{{< / highlight >}}

The example above is a bash script that returns an HTML page containing the environment variables it received as well as the incoming request body.

{{< alert >}}
**Do not use such a script in production!** The generated response exposes all environment variables sent to the script, and might contain sensitive data!
{{< /alert >}}

In this case, we are accessing the environment variables and standard input directly, but some languages have tools to abstract this interfacing for us. Take for instance our next example, now in Python:

{{< highlight python "linenos=table" >}}
#!/bin/python

# Import modules for CGI handling
import cgi

# Create instance of FieldStorage
form = cgi.FieldStorage()

# Get data from fields
first_name = form.getvalue('first_name')
last_name = form.getvalue('last_name')

print("Content-type:text/html")
print()
print("<html>")
print('<head>')
print("<title>Greeter</title>")
print('</head>')
print('<body>')
print("<h2>Hello %s %s</h2>" % (first_name, last_name))
print('</body>')
print('</html>')
{{< / highlight >}}

In this example, we use the `cgi` module which parses data sent via a request so that we can acess it directly. This page might be accessed after submitting the following form:

{{< highlight html "linenos=table" >}}
<form action = "/cgi-bin/simple_form.py" method = "post">
    First Name: <input type = "text" name = "first_name"><br />
    Last Name: <input type = "text" name = "last_name" />

    <input type = "submit" value = "Submit" />
</form>
{{< / highlight >}}

As long as the Python script resides in the `/cgi-bin/simple_form.py` path, after submitting this form we will be greeted with the supplied first and last names correctly set.

### CGI drawbacks and modern alternatives

Nowadays CGI isn't used as much, and more modern mechanisms have been developed. One of the main drawbacks of CGI is that it creates a separate process every time it receives a request for a CGI script, which creates a lot of overhead and makes the server less performant. We have new alternatives: the [Apache HTTP server](https://httpd.apache.org/), for instance, has modules supporting communication with specific languages (`mod_perl`, `mod_php`, `mod_python`, etc). There are also language-specific mechanisms such as Python's [WSGI](https://en.wikipedia.org/wiki/Web_Server_Gateway_Interface) and specific programs for receiving these requests, such as [Gunicorn](https://gunicorn.org/). These can be called by more general HTTP servers acting as a [reverse proxy](https://en.wikipedia.org/wiki/Reverse_proxy), such as the Apache server or [Nginx](https://www.nginx.com/).

## Conclusion
The CGI specification was written in 1993 as a way to allow developers to create scripts that integrated with HTTP servers for dynamic interactions. Even though it isn't as popular anymore, understanding the inner workings, advantages and drawbacks of old interfaces and protocols can give us an understanding of why modern solutions are implemented as they are. It can also give us an appreciation for the engineering work that goes into defining and perfecting these interfaces and protocols that will be used by people all over the world. Implementing a simple version of this certainly was a fun experience, and if you are curious to see such an implementation you are welcome to see my repository and play with it! :)

{{< github repo="lucasaug/rust-web-cgi" >}}


Thank you so much for reading my first post!

## References
- [RFC 3875 (the original proposal for the CGI interface)](https://www.rfc-editor.org/rfc/rfc3875.pdf)
- [Chapter 3 of "CGI Programming 101", by Jacqueline D. Hamilton](https://www.cgi101.com/book/ch3/text.html)
- [Chapter 3.2 of O'Reilly's "CGI Programming on the World Wide Web", by Shishir Gundavaram](https://www.oreilly.com/openbook/cgi/ch03_02.html)

## Credits
- [Thumbnail image by Miguel Á. Padriñán on Pexels](https://www.pexels.com/pt-br/foto/botoes-teclado-mensagem-palavra-2882570/)

