#!/usr/bin/env node
import fs from "fs";
import url from "url";
import path from "path";
import minimist, { ParsedArgs } from "minimist";
//{ accessSync, constants }

const default_argv = {
  template: "./a3ensite.conf",
  config: "./a3ensite.json",
};

function print_error(...args: [any]) {
  console.warn(...args);
  console.warn("-----------------------------\n");
  process.exit(0);
}
function print_log(...args: [any]) {
  console.log(...args);
}
print_log("-> Still Lovin You");

const app$argv: ParsedArgs = minimist(process.argv.slice(2), {
  default: default_argv,
});
const app$config: AppConfig = setup_config();
const tasks: { [key: string]: { [key: string]: any } } = {
  make: {
    hosts: $make_hosts,
    sites: $make_sites,
  },
  unmake: {
    hosts: null,
    sites: null,
  },
  status: {
    hosts: null,
    sites: $sites_status,
  },
};
let task: any = tasks;
for (let i = 0; i < app$argv._.length; i++) {
  const taskname = app$argv._[i];
  if (!task) break;
  task = task[taskname];
}
if (typeof task != "function")
  print_error(
    `error: '${app$argv._.join(
      "->"
    )}' ~ Invalid task  \n Help \n--config a3ensite.json \n--template a3ensite.conf`
  );
else {
  task();
  print_log(`success = '${app$argv._.join("->")}'`);
}
print_log("\n");

function $make_hosts() {
  const start_tag = "#a3ensite-start";
  const end_tag = "#a3ensite-end";
  const curr_hosts = fs.readFileSync("/etc/hosts", "utf8");
  const start_pos = curr_hosts.indexOf(start_tag);
  const end_pos = curr_hosts.indexOf(end_tag);
  let new_hosts = curr_hosts;
  if (start_pos > -1 && end_pos > -1) {
    new_hosts = `${curr_hosts.substring(0, start_pos)}${curr_hosts.substring(
      end_pos + end_tag.length,
      curr_hosts.length
    )}`;
  }
  const local_hosts: string[] = [];
  local_hosts.push(`${start_tag} #### DO NOT EDIT`);
  for (let i = 0; i < app$config.sites.length; i++) {
    const site = app$config.sites[i];
    let $ip: string =
      site[app$config.options.hosts.HostIpKey] ||
      app$config.defaults[app$config.options.hosts.HostIpKey];
    let $name: string =
      site[app$config.options.hosts.HostNameKey] ??
      app$config.defaults[app$config.options.hosts.HostNameKey];
    local_hosts.push(`${$ip} ${$name}`);
  }
  local_hosts.push(end_tag);
  new_hosts = new_hosts + local_hosts.join("\n");
  fs.writeFileSync("/etc/hosts", new_hosts);
}

type HostOptions = {
  HostNameKey: string;
  HostIpKey: string;
};
interface AppConfig {
  options: {
    hosts: HostOptions;
  };
  defaults: {
    EnabledLoc: string;
    [key: string]: string;
  };
  server: {
    EnabledLoc: string;
    OutputFile: string;
    [key: string]: string;
  };
  sites: { [key: string]: string }[];
  $changed_time: number;
  $config_file: string;
}

type VarList = {
  name: string;
  pos: number;
  value: string[];
};
type Graph = {
  line: string;
  varlist: VarList[];
};
type VarBuild = {
  graph: Graph[];
  count: number;
};
function $build() {
  const body = setup_template(app$argv);
  if (!Array.isArray(app$config.sites))
    print_error("[Array] config.sites is required");
  const sites = app$config.sites;
  const var_builds: VarBuild[] = [];
  for (let site of sites) {
    const state = [];
    const var_build: VarBuild = {
      graph: [],
      count: 1,
    };
    for (let input of body) {
      const varlist = input.varlist;
      let line: string | null = input.line;
      const _varlist: VarList[] = [];
      for (const var_ of varlist) {
        let _value: string[] = [];
        if (site[var_.name] !== undefined) {
          if (var_.typed != "display") _value.push(site[var_.name]);
        } else if (app$config.defaults[var_.name] !== undefined) {
          if (var_.typed != "display")
            _value.push(app$config.defaults[var_.name]);
        } else {
          if (var_.typed == "optional" || var_.typed == "display") {
            line = null;
            break;
          } else {
            print_error(`Missing ${var_.name}`);
          }
        }
        if (_value.length == 0) continue;
        if (var_build.count == 1) var_build.count = _value.length;
        else if (_value.length != var_build.count) {
          print_error(
            `${input.template_file}: ${input.numberline} Expected ${var_build.count} values, Found ${_value.length} values`
          );
        }
        _varlist.push({
          name: var_.name,
          pos: var_.pos,
          value: _value,
        });
      }
      if (line === null) continue;
      var_build.graph.push({
        line: line,
        varlist: [..._varlist],
      });
    }
    var_builds.push(var_build);
  }

  const output = [];
  for (let var_build of var_builds) {
    for (let i = 0; i < var_build.count; i++) {
      for (let build of var_build.graph) {
        const varlist = [...build.varlist];
        let line = build.line;
        while (varlist.length) {
          const var_: VarList = varlist.pop() as VarList;
          let _value = var_.value.length != 1 ? var_.value[i] : var_.value[1];
          line = line.replace(`~//${var_.pos}//~`, _value);
        }
        output.push(line);
      }
    }
  }

  return output.join("\n");
}

function enabled$loc() {
  const loc = app$config.server.EnabledLoc;
  const output_file = app$config.server.OutputFile || "a3ensite.live.conf";
  if (!access$check(loc))
    print_error(`config.server.EnabledLoc ${loc} is unaccessable.`);
  return path.join(loc, output_file);
}

function $make_sites() {
  const output = $build();
  const loc = enabled$loc();
  fs.writeFileSync(loc, output);
  print_log("-> a3ensite applied");
  $sites_status();
}
function $disable() {
  const loc = enabled$loc();
  const state = {
    enabled: fs.existsSync(loc),
  };
  if (!state.enabled) {
    print_log("-> a3ensite already disabled");
  } else {
    print_log("-> a3ensite disabling...");
    fs.writeFileSync(loc, "");
    print_log("-> a3ensite disabled");
  }
  $sites_status();
}
function $sites_status() {
  const loc = enabled$loc();
  const state = {
    enabled: fs.existsSync(loc),
    changed: false,
  };
  if (state.enabled) {
    const latest = fs.statSync(loc);
    state.changed = latest.mtimeMs < app$config.$changed_time;
  }
  print_log(`Sites: ${app$config.sites.length}`);
  print_log(`Status: ${state.enabled ? "Enabled" : "Disabled"}`);
  if (state.changed) {
    print_log(`Config: Config File Changed ~ ${app$config.$config_file}`);
  }
}

function setup_config() {
  const config_file = app$argv.config;
  if (!fs.existsSync(config_file))
    print_error(`--config file not found ${config_file}`);
  const config = JSON.parse(fs.readFileSync(config_file, "utf8"));
  const _stat = fs.statSync(config_file);
  let _config: AppConfig = {
    options: config.options || { host: {} },
    server: config.server || {},
    defaults: config.defaults || {},
    sites: config.sites,
    $changed_time: _stat.mtimeMs,
    $config_file: config_file,
  };
  if (!_config.server?.EnabledLoc)
    print_error(`config.server.EnabledLoc is required`);
  return _config;
}

function setup_template(app$argv: ParsedArgs) {
  const template_file = app$argv.template;
  if (!fs.existsSync(template_file))
    print_error(`--template file not found ${template_file}`);
  const template = fs.readFileSync(template_file, "utf8");
  const lines = template.split("\n");
  const output = [];
  let numberline = 0;
  for (let line of lines) {
    let pos = 0;
    const varlist = [];
    let var_ = line.match(/\$\??\!?\[([^\s]+)\]\$/);
    while (var_ && var_["index"]) {
      let typed = "required";
      const _flag = var_[0];
      const flag = var_[1];
      const _i = var_["index"];
      const before = line.slice(0, _i);
      const after = line.slice(_i + _flag.length);
      if (_flag.indexOf("$?") == 0) {
        typed = "optional";
        line = `${before}~//${pos}//~${after}`;
      } else if (_flag.indexOf("$!") == 0) {
        typed = "display";
        line = `${before}${after}`;
      } else {
        line = `${before}~//${pos}//~${after}`;
      }
      varlist.push({
        name: flag,
        pos,
        typed,
      });
      pos++;
      var_ = line.match(/\$\??\!?\[([^\s]+)\]\$/);
    }
    output.push({ template_file, numberline, varlist, line });
    numberline++;
  }
  return output;
}

function access$check(loc: string) {
  try {
    fs.accessSync(loc, fs.constants.R_OK | fs.constants.W_OK);
    return true;
  } catch (err) {
    return false;
  }
}
