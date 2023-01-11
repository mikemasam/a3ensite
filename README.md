# a3ensite

### Reference
* `$[VARIABLE]$` = *required variable* - apply content & show line or throw an error if not.
* `$?[VARIABLE]$` = *optional variable* - apply content & show line if variable is set.
* `$![VARIABLE]$` = *display variable* - show line if variable is set.
### config - a3ensite.json
> sites and output location configuration in JSON
```
{
  "server": {
    "EnabledLoc": "/tmp"
  },
  "sites": [
    {
      "ServerName": "server1",
      "ServerAlias": "alias1",
      "ServerOptional": "optional-value-1"
    },
    {
      "ServerName": "server2",
      "ServerAlias": "alias2",
      "ServerHidden": "hidden-value-2"
    },
    {
      "ServerName": "dev.local",
      "ServerAlias": "www.dev.local",
      "WebSocket": "ws://dev.local"
    }
  ]
}
```

### template - -a3ensite.conf-
> template for generating output
```
<VirtualHost *:80>
  ServerName $[ServerName]$
  ServerAlias $[ServerAlias]$
  ServerOptional $?[ServerOptional]$
  ProxyPreserveHost On $![ServerHidden]$

  RewriteEngine on                            $![WebSocket]$
  RewriteCond %{HTTP:Upgrade} websocket [NC]  $![WebSocket]$
  RewriteCond %{HTTP:Connection} upgrade [NC] $![WebSocket]$
  RewriteRule ^/?(.*) "$?[WebSocket]$/$1" [P,L]
<VirtualHost>
```

***
> a3ensite --enable
***

### output - a3ensite.live.conf
> Generated output
```
<VirtualHost *:80>
  ServerName server1
  ServerAlias alias1
  ServerOptional optional-value-1

<VirtualHost>

<VirtualHost *:80>
  ServerName server2
  ServerAlias alias2
  ProxyPreserveHost On

<VirtualHost>

<VirtualHost *:80>
  ServerName dev.local
  ServerAlias www.dev.local

  RewriteEngine on
  RewriteCond %{HTTP:Upgrade} websocket [NC]
  RewriteCond %{HTTP:Connection} upgrade [NC]
  RewriteRule ^/?(.*) "ws://dev.local/$1" [P,L]
<VirtualHost>
```
