# a3ensite

- `a3ensite make sites` - Generate apache or nginx configuration file
- `a3ensite make hosts` - Generate hosts entries to /etc/hosts or any other Hosts.FileLoc
- `a3ensite status sites` - Print sites status [Count, Status]

### Reference

- `$[VARIABLE]$` = _required variable_ - apply content & show line or throw an error if not.
- `$?[VARIABLE]$` = _optional variable_ - apply content & show line if variable is set.
- `$![VARIABLE]$` = _display variable_ - show line if variable is set.

### config - a3ensite.json

> sites and output location configuration in JSON

```
{
  "options": {
        "Hosts": {
            "FileLoc": "/etc/hosts",
            "HostNameKey": "ServerName",
            "HostIpKey": "ServerIp",
        }
  },
  "server": {
    "EnabledLoc": "/tmp"
  },
  "defaults": {
    "Servername": "server0"
  },
  "sites": [
    {
      "ServerName": "server1",
      "ServerAlias": "alias1",
      "ServerIp": "127.0.0.1",
      "ServerOptional": "optional-value-1"
    },
    {
      "ServerName": "server2",
      "ServerAlias": "alias2",
      "ServerIp": "127.0.0.1",
      "ServerHidden": "hidden-value-2"
    },
    {
      "ServerName": "dev.local",
      "ServerAlias": "www.dev.local",
      "ServerIp": "127.0.0.1",
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

---

> a3ensite enable | make

---

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
