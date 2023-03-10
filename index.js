#! /usr/bin/env node
import fs from 'fs';
import nodefs from 'node:fs';
import url from 'url';
import path from 'path';
//{ accessSync, constants }
function print_error(...args){
  console.warn(...args);
  console.warn("-----------------------------\n");
  process.exit(0);
}
function print_log(...args){
  console.log(...args);
}
print_log("-> Still Lovin You");
print_log("\n");


//print_log("ENV", local_file("a3ensite.json"));
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
  print_error("Help \n--config a3ensite.json \n--template a3ensite.conf");
}
print_log("\n");

function $build(){
  const body = setup_template(app$argv);
  if(!Array.isArray(app$config.sites)) print_error("[Array] config.sites is required");
  const sites = app$config.sites;
  const var_builds = [];
  for(let site of sites){
    const state = [];
    const var_build = { graph: [], count: 1 };
    for(let input of body){
      const varlist = input.varlist;
      let line = input.line;
      const _varlist = [];
      for(const var_ of varlist){
        let _value = undefined;
        if(site[var_.name] !== undefined){
          if(var_.typed != "display"){
            _value = site[var_.name];
          }
        }else if(app$config.defaults[var_.name] !== undefined){
          if(var_.typed != "display"){
            _value = app$config.defaults[var_.name];
          }
        }else{
          if(var_.typed == "optional" || var_.typed == "display") {
            line = null;
            break;
          } else {
            print_error(`Missing ${var_.name}`);
          }
        }
        if(_value === undefined) continue;
        if(!Array.isArray(_value)) _value = [_value];
        if(_value.length > 1){
          if(var_build.count == 1) var_build.count = _value.length;
          else if(_value.length != var_build.count){
            print_error(`${input.template_file}: ${input.numberline} Expected ${var_build.count} values, Found ${_value.length} values`);
          }
        }
        _varlist.push({
          name: var_.name,
          pos: var_.pos,
          value: _value,
        });
      }
      if(line === null) continue;
      var_build.graph.push({
        line: line,
        varlist: [..._varlist]
      });
//      while(_varlist.length){
//        const var_ = _varlist.pop();
//        line = line.replace(`~//${var_.pos}//~`, var_.value);
//      }
//      output.push(line);
    }
    var_builds.push(var_build);
  }

  const output = [];
  for(let var_build of var_builds){
    for(let i = 0; i < var_build.count; i++){
      for(let build of var_build.graph){
        const varlist = [...build.varlist];
        let line = build.line;
        while(varlist.length){
          const var_ = varlist.pop();
          let _value = var_.value;
          if(_value.length != 1) _value = _value[i];
          line = line.replace(`~//${var_.pos}//~`, _value);
        }
        output.push(line);
      }
    }
  }


  //console.log(JSON.stringify(var_builds, 2, '  '));
  return output.join("\n");
}

function enabled$loc(){
  const loc = app$config.server.EnabledLoc;
  const output_file = app$config.server.OutputFile || 'a3ensite.live.conf';;
  if(!access$check(loc)) print_error(`config.server.EnabledLoc ${loc} is unaccessable.`);
  return path.join(loc, output_file);
}

function $enable(){
  const output = $build();
  //: '/etc/apache2/sites-enabled' }
  const loc = enabled$loc();
  fs.writeFileSync(loc, output);
  //console.log(app$config);
  print_log("-> a3ensite applied");
  $status();
}
function $disable(){
  const loc = enabled$loc();
  const state = {
    enabled: fs.existsSync(loc)
  };
  if(!state.enabled) {
    print_log("-> a3ensite already disabled");
  }else{
    print_log("-> a3ensite disabling...");
    fs.writeFileSync(loc, "");
    print_log("-> a3ensite disabled");
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
  print_log(`Sites: ${app$config.sites.length}`);
  print_log(`Status: ${ state.enabled ? "Enabled" : "Disabled" }`);
  if(state.changed){
    print_log(`Config: Config File Changed ~ ${app$config.$config_file}`);
  }
}

function setup_config(){
  const _config = {
    server: {},
    defaults: {},
    sites: []
  }
  const config_file = app$argv.config || app$argv.$config
  if(!fs.existsSync(config_file)) print_error(`--config file not found ${config_file}`);
  //|| local_file()
  const config = JSON.parse(fs.readFileSync(config_file, 'utf8'));
  _config.server = { ..._config.server, ...config.server }
  _config.defaults = { ..._config.defaults, ...config.defaults }
  _config.sites = [ ..._config.sites, ...config.sites ]
  const _stat = nodefs.statSync(config_file);
  _config.$changed_time = _stat.mtimeMs;
  _config.$config_file = config_file;
  if(!_config.server?.EnabledLoc) print_error(`config.server.EnabledLoc is required`);
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
      if(argv[last] !== true) print_error(`Invalid argument ${arg}`);
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
  if(!fs.existsSync(template_file)) print_error(`--template file not found ${template_file}`);
  const template = fs.readFileSync(template_file, 'utf8');
  const lines = template.split("\n");
  const output = [];
  let numberline = 0;
  for(let line of lines){
    let pos = 0;
    const varlist = [];
    let var_ = line.match(/\$\??\!?\[([^\s]+)\]\$/)
    while(var_ && var_['index']){
      let typed = "required";
      const _flag = var_[0];
      const flag = var_[1];
      //console.log(var_);
      const _i = var_['index'];
      const before = line.slice(0, _i);
      const after = line.slice(_i + _flag.length);
      if(_flag.indexOf("$?") == 0) {
        typed = "optional";
        line = `${before}~//${pos}//~${after}`;
      } else if(_flag.indexOf("$!") == 0) {
        typed = "display";
        line = `${before}${after}`;
      } else {
        line = `${before}~//${pos}//~${after}`;
      }
      varlist.push({
        name: flag,
        pos,
        typed
      });
      pos++;
      var_ = line.match(/\$\??\!?\[([^\s]+)\]\$/)

    }
    output.push({ template_file, numberline, varlist, line });
    numberline++;
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
