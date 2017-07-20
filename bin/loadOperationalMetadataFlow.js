#!/usr/bin/env node

/***
 * Copyright 2016 IBM Corp. All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

"use strict";

/**
 * @file Loads an operational metadata (OMD) flow file into a target DataStage system (different from environment where job ran) -- run from engine tier of target system
 * @license Apache-2.0
 * @requires ibm-igc-lineage
 * @requires fs-extra
 * @requires pretty-data
 * @requires prompt
 * @requires yargs
 * @requires shelljs
 * @example
 * // loads the operational metadata from inputOMD.xml.flow to the target DataStage system (using engine and credential details from authorisation file)
 * ./mapOperationalMetadataFlow.js -f inputOMD.xml.flow -o outputOMD.xml.flow -p isadmin
 */

const fs = require('fs-extra');
const pd = require('pretty-data').pd;
const shell = require('shelljs');
const igclineage = require('ibm-igc-lineage');
const commons = require('ibm-iis-commons');
const prompt = require('prompt');
prompt.colors = false;

// Command-line setup
const yargs = require('yargs');
const argv = yargs
    .usage('Usage: $0 -f <path> -o <path> -a <authfile>')
    .option('f', {
      alias: 'file',
      describe: 'Input file from which to read operational metadata',
      demand: true, requiresArg: true, type: 'string'
    })
    .option('e', {
      alias: 'engine',
      describe: 'Full hostname of the target engine tier',
      requiresArg: true, type: 'string'
    })
    .option('o', {
      alias: 'output',
      describe: 'Output file into which to write modified operational metadata',
      demand: true, requiresArg: true, type: 'string'
    })
    .option('a', {
      alias: 'authfile',
      describe: 'Authorisation file containing environment context',
      requiresArg: true, type: 'string'
    })
    .help('h')
    .alias('h', 'help')
    .wrap(yargs.terminalWidth())
    .argv;

// Base settings
const inputFile = argv.file;
const outputFile = argv.output;
let targetEngine = argv.engine;

const envCtx = new commons.EnvironmentContext(null, argv.authfile);

if (typeof targetEngine === 'undefined' || targetEngine === null || targetEngine === "") {
  targetEngine = envCtx.engine;
}

const xmldata = fs.readFileSync(inputFile, 'utf8');
const omd = new igclineage.OMDHandler();
omd.parseOMD(xmldata.toString());

console.log("Loading operational metadata for: " + omd.getRunMessage() + " (" + omd.getRunStatus() + ")");

omd.replaceHostname(targetEngine);

const modOMD = omd.getCustomisedOMD();
const output = pd.xml(modOMD);

const outOpts = {
  "encoding": 'utf8',
  "mode": 0o644,
  "flag": 'w'
};
fs.writeFileSync(outputFile, output, outOpts);

if (shell.test('-f', "/.dshome")) {

  const dshome = shell.cat("/.dshome");
  const cmd = dshome.replace("\n", "") +
          "/../../Clients/istools/cli/istool.sh workbench importOMD" +
          " -dom " + argv.domain +
          " -af " + envCtx.authFile +
          " -f \"" + outputFile + "\"";
  const result = shell.exec(cmd, {"shell": "/bin/bash"});

  //console.log(result);
  shell.exit(result.code);

} else {
  console.error("Unable to find /.dshome -- this does not appear to be an engine tier.");
  shell.exit(1);
}
