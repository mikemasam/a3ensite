#! /usr/bin/env node
import fs from 'fs';
import nodefs from 'node:fs';
import url from 'url';
import path from 'path';
//{ accessSync, constants }
console.log("-> Still Lovin You");
console.log("\n");

function console_error(message){
  console.warn(message);
  console.warn("-----------------------------\n");
  process.exit(0);
}

//console.log("ENV", local_file("a3ensite.json"));
const app$argv = setup_argv();
const app$config = setup_config();
const tasks = ["enable", "disable", "status"];
const $tasks = [$enable, $disable, $status];
let handled = false;
for(let i = 0; i < tasks.length; i++){
  const taskname = tasks[i];
  if(!app$argv[taskname]) continue;
  handled = true;
  const task = $tasks[i];
  task();
}
if(handled == false){
  console_error("Help \n--config a3ensite.json \n--template a3ensite.conf");
}
console.log("\n");

function $build(){
  const body = setup_template(app$argv);
  if(!Array.isArray(app$config.sites)) console_error("[Array] config.sites is required");
  const sites = app$config.sites;
  const output = [];
  for(let site of sites){
    const state = [];
    for(let input of body){
      const varlist = input.varlist;
      let line = input.line;
      const _varlist = [];
      for(const var_ of varlist){
        if(site[var_.name] !== undefined){
          _varlist.push({
            name: var_.name,
            pos: var_.pos,
            value: site[var_.name],
          });
        }else if(app$config.defaults[var_.name] !== undefined){
          _varlist.push({
            name: var_.name,
            pos: var_.pos,
            value: app$config.defaults[var_.name],
          });
        }else{
          if(input.optional) {
            line = null;
          } else {
            console_error(`Missing ${var_.name}`);
          }
        }
      }
      if(line === null) continue;
      while(_varlist.length){
        const var_ = _varlist.pop();
        line = line.replace(`~//${var_.pos}//~`, var_.value);
      }
      output.push(line);
    }
  }
  return output.join("\n");
}

function enabled$loc(){
  const loc = app$config.server.EnabledLoc;
  const output_file = app$config.server.OutputFile || 'a3ensite.live.conf';;
  if(!access$check(loc)) console_error(`config.server.EnabledLoc ${loc} is unaccessable.`);
  return path.join(loc, output_file);
}

function $enable(){
  const output = $build();
  //: '/etc/apache2/sites-enabled' }
  const loc = enabled$loc();
  fs.writeFileSync(loc, output);
  //console.log(app$config);
  console.log("-> a3ensite applied");
  $status();
}
function $disable(){
  const loc = enabled$loc();
  const state = {
    enabled: fs.existsSync(loc)
  };
  if(!state.enabled) {
    console.log("-> a3ensite already disabled");
  }else{
    console.log("-> a3ensite disabling...");
    fs.writeFileSync(loc, "");
    console.log("-> a3ensite disabled");
  }
  $status();
}
function $status(){
  const loc = enabled$loc();
  const state = {
    enabled: fs.existsSync(loc),
    changed: false
  };
  if(state.enabled){
    const latest = nodefs.statSync(loc);
    state.changed = latest.mtimeMs < app$config.$changed_time;
  }
  console.log(`Sites: ${app$config.sites.length}`);
  console.log(`Status: ${ state.enabled ? "Enabled" : "Disabled" }`);
  if(state.changed){
    console.log(`Config: Config File Changed ~ ${app$config.$config_file}`);
  }
}

function setup_config(){
  const _config = {
    server: {},
    defaults: {},
    sites: []
  }
  const config_file = app$argv.config || app$argv.$config
  if(!fs.existsSync(config_file)) console_error(`--config file not found ${config_file}`);
  //|| local_file()
  const config = JSON.parse(fs.readFileSync(config_file, 'utf8'));
  _config.server = { ..._config.server, ...config.server }
  _config.defaults = { ..._config.defaults, ...config.defaults }
  _config.sites = [ ..._config.sites, ...config.sites ]
  const _stat = nodefs.statSync(config_file);
  _config.$changed_time = _stat.mtimeMs;
  _config.$config_file = config_file;
  if(!_config.server?.EnabledLoc) console_error(`config.server.EnabledLoc is required`);
  return _config;
}

function setup_argv(){
  const _argv = process.argv.splice(2);
  const argv = {
    $template: "./a3ensite.conf",
    $config: "./a3ensite.json",
  };
  for(let i = 0; i < _argv.length; i++){
    const arg = _argv[i];
    if(!arg) throw `Invalid argument ${arg}`;
    if(arg.indexOf("--") == 0){
      argv[arg.slice(2)] = true;
    }else{
      const last = _argv[i - 1].slice(2);
      if(argv[last] !== true) console_error(`Invalid argument ${arg}`);
      else {
        argv[last] = arg;
      }
    }
    //if(!arg ||  != 0) throw `Invalid argument ${arg}`;
  }
  return argv;
}

function setup_template(app$argv){
  const template_file = app$argv.template || app$argv.$template;
  if(!fs.existsSync(template_file)) console_error(`--template file not found ${template_file}`);
  const template = fs.readFileSync(template_file, 'utf8');
  const lines = template.split("\n");
  const output = [];
  for(let line of lines){
    let pos = 0;
    const varlist = [];
    let var_ = line.match(/\$\??\[([^\s]+)\]\$/)
    let optional = false;
    while(var_ && var_['index']){
      const _flag = var_[0];
      const flag = var_[1];
      //console.log(var_);
      const _i = var_['index'];
      const before = line.slice(0, _i);
      const after = line.slice(_i + _flag.length);
      line = `${before}~//${pos}//~${after}`;
      if(_flag.indexOf("$?") == 0) optional = true;
      varlist.push({
        name: flag,
        pos,
      });
      pos++;
      var_ = line.match(/\$\[([^\s]+)\]\$/)

    }
    output.push({ varlist, line, optional });
    //console.log(line);
  }
  return output;
}


function local_file(filename){
  const __filename = url.fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  return path.join(__dirname, filename);
}


function access$check(loc){
  try {
    nodefs.accessSync(loc, nodefs.constants.R_OK | nodefs.constants.W_OK);
    return true;
  } catch (err) {
    return false;
  }
}
